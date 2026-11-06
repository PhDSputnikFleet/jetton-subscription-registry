# JettonSubscriptionRegistry

An open-source **on-chain USDT (jetton) subscription / access-grant primitive for TON** — a small
smart contract + tooling that lets any Telegram Mini App (or any TON app) take recurring/access
payments in USDT and read who-paid-what **from the chain**, instead of trusting an off-chain poller.

Written in [Tact](https://tact-lang.org/), tested with [@ton/sandbox](https://github.com/ton-org/sandbox).
MIT licensed.

## Why

Mini Apps that want to charge users in crypto re-implement jetton-payment plumbing from scratch,
usually off-chain and insecurely. This gives them a reusable on-chain contract:

- the payer sends USDT to the contract's jetton wallet with a numeric **code** in the transfer's
  forward payload;
- the contract verifies the transfer came from **its own** jetton wallet (anti-spoof), checks the
  amount covers the price, and records an **access grant** on-chain with an expiry;
- the app backend reads `access(code)` — the on-chain source of truth — rather than matching
  transfers itself.

## On-chain model

```
payer ── USDT (+ code in forward payload) ──▶ contract's jetton wallet
                                                   │ transfer_notification (0x7362d09c)
                                                   ▼
                                     JettonSubscriptionRegistry
                                     • require(sender == our jetton wallet)   # anti-spoof
                                     • require(amount >= price)               # coverage
                                     • grants[code] = {payer, amount, paidAt, expiresAt}
                                                   │
          app backend ── get access(code) ───────▶ (bool: still valid?)
```

## Contract interface

Messages:
- `JettonTransferNotification` (TEP-74, op `0x7362d09c`) — the payment path (from the jetton wallet).
- `SetJettonWallet { wallet }` — owner sets the contract's own USDT jetton wallet (the anti-spoof anchor).
- `SetPrice { price, period }` — owner sets the price (micro-USDT) and subscription length (seconds).
- `"withdraw"` — owner-triggered sweep of collected USDT (transfer body built in the integration layer).

Get-methods:
- `access(code): Bool` — is the grant for `code` still valid (now < expiresAt)?
- `grant(code): Grant?` — `{ payer, amount, paidAt, expiresAt }` or null.
- `config(): Config` — `{ owner, jettonWallet, price, period, total }`.

## Repo layout

```
contracts/   Tact source (the on-chain primitive)
tests/       @ton/sandbox unit tests (6)
sdk/         TypeScript SDK: read access(code) + build a TON Connect payment
scripts/     deploy / setJettonWallet / setPrice / read, testnet→mainnet
demo/        generic static TON Connect page (connect → pay → read access, no bot)
docs/        PLAN (DDD), SECURITY (threat model), TOKENOMICS
```

## Build & test

```bash
npm install
npm run build   # tact -> FunC -> BoC + TypeScript bindings in ./build
npm test        # @ton/sandbox unit tests (6)
```

Covered by tests: covering payment records a grant, overpayment accepted, **underpaid ignored**,
**spoofed notification from a non-jetton-wallet sender rejected**, unknown code has no access,
owner-only config.

## Quickstart

**Read access from an app backend** (SDK):

```ts
import { getAccess } from '@phdsputnik/jetton-subscription-registry-sdk';
const ok = await getAccess(client, registryAddress, code); // bool, straight from chain
```

**Let a user pay** (SDK → TON Connect):

```ts
import { buildJettonPayment } from '@phdsputnik/jetton-subscription-registry-sdk';
const msg = buildJettonPayment({ registry, jettonMaster, amount, code });
await tonConnectUI.sendTransaction({ messages: [msg], validUntil: ... });
```

See `sdk/` for the full API and `demo/` for a standalone wallet→pay→read page.

**Deploy** (testnet): see `scripts/README.md` (`deployTestnet.ts`, `setJettonWallet`, `setPrice`).

## Live deployment (TON testnet)

| | |
|---|---|
| Registry | [`kQCbeOQwL7kHBLfreG7Ib8VDDI2L7ZbdDBYviZDN5FjA4cjB`](https://testnet.tonviewer.com/kQCbeOQwL7kHBLfreG7Ib8VDDI2L7ZbdDBYviZDN5FjA4cjB) |
| State | `active` — `config()` get-method returns exit 0 on-chain |
| Project token | Sputnik / SPUT — [`EQDMHUcRLHtcTzjSeq2KnZWdi8q_Ek923O1cFeDl_RiwpkeJ`](https://testnet.tonviewer.com/EQDMHUcRLHtcTzjSeq2KnZWdi8q_Ek923O1cFeDl_RiwpkeJ) (see [docs/TOKENOMICS.md](docs/TOKENOMICS.md)) |

## Status / roadmap

- [x] Core contract + Sandbox tests (6)
- [x] TypeScript SDK (`getAccess`, `buildJettonPayment`) for app integration
- [x] Generic standalone demo (connect wallet → pay → read access, no bot)
- [x] Testnet deploy scripts + **live testnet deployment** (address above)
- [x] Project token (testnet) + tokenomics/allocation ([docs/TOKENOMICS.md](docs/TOKENOMICS.md))
- [x] Threat model + maintainer self-review ([docs/SECURITY.md](docs/SECURITY.md))
- [ ] Independent security audit (the grant funds this)
- [ ] Mainnet deploy (hardening checklist in SECURITY/TOKENOMICS)

Reference consumer (production): a private Telegram onboarding Mini App using this primitive for
paid-invite settlement.

## License

MIT — see [LICENSE](LICENSE).
