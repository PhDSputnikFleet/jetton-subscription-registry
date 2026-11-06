import "@stdlib/deploy";

// On-chain USDT (jetton) subscription / access-grant registry for TON Mini Apps.
//
// A Mini App creates a paid invite with a numeric `code`. The payer sends USDT
// (a TEP-74 jetton) to THIS contract's jetton wallet, with the code in the
// transfer's forward payload. The contract verifies the transfer came from its
// own jetton wallet (anti-spoof), checks the amount covers the price, and records
// an access grant on-chain. A Mini App backend then reads `access(code)` — the
// on-chain source of truth — instead of trusting its own off-chain matching.

// Standard TEP-74 jetton transfer notification (op 0x7362d09c), sent by a jetton
// wallet to its owner when it receives tokens.
message(0x7362d09c) JettonTransferNotification {
    queryId: Int as uint64;
    amount: Int as coins;          // jetton amount received (micro-USDT, 6 decimals)
    sender: Address;               // who sent the jetton (the payer's wallet owner)
    forwardPayload: Slice as remaining;
}

// Admin ops.
message SetJettonWallet { wallet: Address; }          // this contract's own USDT jetton wallet
message SetPrice { price: Int as coins; period: Int as uint32; }
// Owner sweeps collected jettons: `amount` (read off-chain from the jetton wallet
// balance) is forwarded to `to`.
message WithdrawJettons { amount: Int as coins; to: Address; }

// TEP-74 jetton transfer (op 0x0f8a7ea5) — the body WE send to our own jetton
// wallet to move tokens out on withdraw.
message(0x0f8a7ea5) JettonTransferOut {
    queryId: Int as uint64;
    amount: Int as coins;
    destination: Address;          // where the jettons go
    responseDestination: Address;  // excess TON refund
    customPayload: Cell?;
    forwardTonAmount: Int as coins;
    forwardPayload: Slice as remaining;
}

struct Grant {
    payer: Address;
    amount: Int as coins;
    paidAt: Int as uint32;
    expiresAt: Int as uint32;
}

struct Config {
    owner: Address;
    jettonWallet: Address;
    price: Int as coins;
    period: Int as uint32;
    total: Int as uint32;          // number of grants recorded
}

contract JettonSubscriptionRegistry with Deployable {
    owner: Address;
    jettonWallet: Address;         // set by admin after the contract's jetton wallet is known
    price: Int as coins;
    period: Int as uint32;         // subscription length, seconds
    grants: map<Int, Grant>;       // code -> grant
    total: Int as uint32;

    init(owner: Address, price: Int, period: Int) {
        self.owner = owner;
        self.jettonWallet = owner;  // placeholder until SetJettonWallet
        self.price = price;
        self.period = period;
        self.total = 0;
    }

    // Core: a USDT transfer landed on our jetton wallet.
    receive(msg: JettonTransferNotification) {
        // The jetton wallet MUST be configured to a real address first; otherwise
        // it is still the init placeholder (== owner) and the anti-spoof anchor is
        // meaningless. Refuse payments until SetJettonWallet has been called.
        require(self.jettonWallet != self.owner, "jetton wallet not configured");
        // Anti-spoof: only our own jetton wallet may notify us. Without this an
        // attacker could fake a notification from any address.
        require(sender() == self.jettonWallet, "not our jetton wallet");
        // Underpaid transfers are ignored (no grant); overpaid are accepted.
        require(msg.amount >= self.price, "underpaid");

        // TEP-74 forward_payload is (Either Cell ^Cell): a 1-bit selector, then the
        // payload either inline in the remaining bits or in a referenced cell. Real
        // wallets (and our SDK) store it as a ref (selector = 1); handle both forms.
        let fp: Slice = msg.forwardPayload;
        if (fp.loadBit()) {
            fp = fp.loadRef().beginParse();
        }
        // The code travels as a uint32 at the start of the (unwrapped) payload.
        let code: Int = fp.loadUint(32);

        // total counts UNIQUE grants: a repeat payment to an existing code renews it
        // (last-write-wins) without double-counting.
        if (self.grants.get(code) == null) {
            self.total = self.total + 1;
        }
        let nowTs: Int = now();
        self.grants.set(code, Grant{
            payer: msg.sender,
            amount: msg.amount,
            paidAt: nowTs,
            expiresAt: nowTs + self.period,
        });
    }

    receive(msg: SetJettonWallet) {
        require(sender() == self.owner, "only owner");
        self.jettonWallet = msg.wallet;
    }

    receive(msg: SetPrice) {
        require(sender() == self.owner, "only owner");
        self.price = msg.price;
        self.period = msg.period;
    }

    // Sweep collected jettons: instruct our own jetton wallet to transfer `amount`
    // to `msg.to`. Only the contract (owner of its jetton wallet) can move those
    // tokens, so this MUST happen on-chain here — it cannot be done off-chain.
    receive(msg: WithdrawJettons) {
        require(sender() == self.owner, "only owner");
        require(self.jettonWallet != self.owner, "jetton wallet not configured");
        send(SendParameters{
            to: self.jettonWallet,
            value: 0,
            mode: SendRemainingValue,   // fund the transfer from the incoming message
            body: JettonTransferOut{
                queryId: 0,
                amount: msg.amount,
                destination: msg.to,
                responseDestination: self.owner,
                customPayload: null,
                forwardTonAmount: 0,
                // empty forward payload: Either = left (inline), zero-length
                forwardPayload: beginCell().storeUint(0, 1).endCell().asSlice(),
            }.toCell(),
        });
    }

    // ---- get-methods: the on-chain source of truth a Mini App reads ----

    get fun access(code: Int): Bool {
        let g: Grant? = self.grants.get(code);
        if (g == null) { return false; }
        return now() < (g!!).expiresAt;
    }

    get fun grant(code: Int): Grant? {
        return self.grants.get(code);
    }

    get fun config(): Config {
        return Config{
            owner: self.owner,
            jettonWallet: self.jettonWallet,
            price: self.price,
            period: self.period,
            total: self.total,
        };
    }
}
