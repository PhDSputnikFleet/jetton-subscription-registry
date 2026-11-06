# Security — threat model & self-review

This documents the contract's trust assumptions and a maintainer self-review, to scope the external
audit the grant funds. It is NOT an audit.

## Trust model
- **owner** — a single address today; can set the jetton wallet, set price/period, and withdraw.
  For mainnet this MUST be a multisig + timelock (see `TOKENOMICS.md` hardening). The owner is trusted.
- **jettonWallet** — the registry's OWN USDT jetton wallet, set by the owner. It is the single address
  allowed to create grants. The whole anti-spoof guarantee rests on the owner setting this correctly to
  the jetton wallet that the USDT master computes for the registry address.

## Invariants (enforced on-chain)
1. `require(sender() == jettonWallet)` on `JettonTransferNotification` — only our jetton wallet can
   record grants. Blocks a spoofed notification from an arbitrary address.
2. `require(amount >= price)` — underpaid transfers record no grant.
3. `require(sender() == owner)` on every admin message — config/withdraw are owner-only.
4. Each grant stores `expiresAt = paidAt + period`; `access(code)` returns `now() < expiresAt`.

## Reviewed risks
| Risk | Status / note |
|---|---|
| Spoofed grant from arbitrary sender | Mitigated by invariant 1. **Residual:** if the owner sets `jettonWallet` wrong, that address could spoof — operational, not code. |
| Under/overpay | Underpaid rejected; overpaid accepted (no refund) — by design. |
| Code reuse / renewal | A payment with an existing `code` overwrites the grant (last-write-wins = renewal). Codes are bearer tokens: anyone who knows a code can pay/extend it. Documented, intended. |
| Replay | Jetton notification carries a `queryId`; a given on-chain transfer is a single message — no replay path on-chain. |
| Storage growth | `grants` map grows unbounded; expired grants are not auto-pruned → rising storage/gas over time. **Mitigation to design:** a prune op for expired codes, or cap + off-chain indexing of history. Flagged for audit. |
| Malformed forward payload | `loadUint(32)` throws if the payload lacks 32 bits → the receive reverts, no grant recorded, USDT still lands in the jetton wallet (recoverable via withdraw). Senders must include the code. |
| Value handling / bounce | `receive` paths send no value except `withdraw` (owner-only, jetton-transfer body built off-chain in the SDK). No fund-loss on the notification path. |
| Integer overflow | Amounts are VarUInteger (coins); `code` is uint32; no arithmetic overflow surface. |
| Admin key compromise | Owner controls config + withdraw. **Mainnet: multisig + timelock required.** |

## Open items for the external audit
- Confirm the `jettonWallet` anti-spoof anchor against the real USDT master's wallet computation.
- Review the (to-be-added) `withdraw` jetton-transfer body for correct response/excess handling.
- Review storage-growth mitigation once implemented.
- Fuzz the forward-payload parsing + over/underpay boundaries.
