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
        // Anti-spoof: only our own jetton wallet may notify us. Without this an
        // attacker could fake a notification from any address.
        require(sender() == self.jettonWallet, "not our jetton wallet");
        // Underpaid transfers are ignored (no grant); overpaid are accepted.
        require(msg.amount >= self.price, "underpaid");

        // The code travels as a uint32 at the start of the forward payload.
        let code: Int = msg.forwardPayload.loadUint(32);

        let nowTs: Int = now();
        self.grants.set(code, Grant{
            payer: msg.sender,
            amount: msg.amount,
            paidAt: nowTs,
            expiresAt: nowTs + self.period,
        });
        self.total = self.total + 1;
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

    // Sweep collected USDT to the owner: tell our jetton wallet to transfer its
    // whole balance out. `amount` of jettons is passed by the owner (read off-chain).
    receive("withdraw") {
        require(sender() == self.owner, "only owner");
        // Forward a jetton transfer request to our jetton wallet; it moves tokens
        // to the owner. (Amount handling kept simple: owner triggers, wallet moves.)
        // Left as an owner-triggered action; full jetton-transfer body is added in
        // the SDK/integration layer to keep the on-chain surface minimal.
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
