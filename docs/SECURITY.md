# Security — threat model & self-review

This documents the contract's trust assumptions and a maintainer self-review, to scope the external
audit the grant funds. It is NOT an audit.

## Self-review fixes applied (2026-11-06)
A pre-submission self-review found and fixed three issues; all are covered by the 11 Sandbox tests:
1. **Forward-payload parsing (was critical).** The payment path read the code with a bare
   `loadUint(32)`, ignoring the TEP-74 `forward_payload:(Either Cell ^Cell)` selector bit — so a
   real jetton-wallet notification (and our own SDK, which stores the payload as a ref) would revert
   and record no grant. Now the Either bit is read and the ref branch (`loadRef().beginParse()`) is
   followed; both inline and ref forms are accepted and tested.
2. **`withdraw` was a no-op (was critical).** The old `"withdraw"` receiver had an empty body, so
   collected jettons were unrecoverable. Replaced with `WithdrawJettons { amount, to }`, which emits a
   real TEP-74 transfer (op `0x0f8a7ea5`) from the contract's jetton wallet.
3. **Jetton-wallet-configured guard (was medium).** `init` sets `jettonWallet = owner` as a
   placeholder; payments are now refused (`require(jettonWallet != owner)`) until `SetJettonWallet`
   anchors the real wallet, closing the window where an owner-origin notification could be accepted.

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
| Malformed forward payload | Either bit handled (inline + ref). If the (unwrapped) payload lacks a 32-bit code, `loadUint(32)` reverts → no grant recorded, USDT lands in the jetton wallet but is now recoverable via `WithdrawJettons`. Senders must include the code. |
| Value handling / bounce | Only `WithdrawJettons` (owner-only) emits a message — a TEP-74 jetton transfer to our own jetton wallet with `SendRemainingValue`. No bounce handler yet; **audit item.** The notification path sends no value. |
| Integer overflow | Amounts are VarUInteger (coins); `code` is uint32; no arithmetic overflow surface. |
| Admin key compromise | Owner controls config + withdraw. **Mainnet: multisig + timelock required.** |

## Open items for the external audit
- Confirm the `jettonWallet` anti-spoof anchor against the real USDT master's wallet computation.
- Review the `WithdrawJettons` jetton-transfer body for correct response/excess handling + add a
  `bounced` handler for the transfer.
- Review storage-growth mitigation once implemented.
- Fuzz the forward-payload parsing (Either inline vs ref, short payloads) + over/underpay boundaries.
- End-to-end test the payment path against the real USDT jetton wallet on testnet/mainnet (the
  Sandbox tests reproduce the SDK's exact payload encoding, but a live jetton-wallet e2e is pending).
