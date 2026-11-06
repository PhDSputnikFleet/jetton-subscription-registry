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

## Build & test

```bash
npm install
npm run build   # tact -> FunC -> BoC + TypeScript bindings in ./build
npm test        # @ton/sandbox unit tests
```

Covered by tests: covering payment records a grant, overpayment accepted, **underpaid ignored**,
**spoofed notification from a non-jetton-wallet sender rejected**, unknown code has no access,
owner-only config.

## Status / roadmap

- [x] Core contract + Sandbox tests (this repo)
- [ ] TypeScript SDK (`getAccess`, `buildPayment`) for app integration
- [ ] Generic standalone demo (connect wallet → pay → read access, no bot)
- [ ] Testnet → mainnet deploy scripts
- [ ] Independent security audit

Reference consumer (production): a private Telegram onboarding Mini App using this primitive for
paid-invite settlement.

## License

MIT — see [LICENSE](LICENSE).
