# Build plan — JettonSubscriptionRegistry → DoraHacks BUIDL

Goal: turn the shipped contract (v1 + 6 tests) into a complete, submittable open-source TON
primitive: SDK + demo + deploy + (testnet) project token + tokenomics. Fast, parallel, correct.

## Domain model (DDD)

**Ubiquitous language:** `code` (per-invite reference), `grant` (a paid access record), `access`
(is a grant currently valid), `jettonWallet` (the registry's own USDT wallet — the anti-spoof anchor),
`price`, `period`, `owner`.

**Aggregate root:** `Registry`. Owns the `grants` map + config. Invariants enforced on-chain:
1. only the registry's OWN jetton wallet may create/mutate grants (anti-spoof);
2. a grant is recorded only if `amount >= price` (coverage);
3. every grant carries `expiresAt = paidAt + period`;
4. only `owner` may change config / withdraw.

**Value objects:** `Grant{payer, amount, paidAt, expiresAt}`, `Config{...}`.

**Bounded contexts (→ workstreams):**
- *On-chain* — the Tact contract (DONE v1). The source of truth.
- *Integration* — the TS **SDK**: read `access(code)`, build a TON Connect payment.
- *Application* — the **demo** (generic) + the private bot (reference consumer).
- *Operations* — **deploy** scripts (testnet→mainnet), the project **token**.

Decision (argued): keep the on-chain surface MINIMAL (grants + config + anti-spoof). Everything
convenience (jetton-transfer body building, address math, polling) lives in the SDK, off-chain. Smaller
attack surface = cheaper audit = exactly what a grant reviewer rewards. We do NOT put token logic in
the registry — the project token is a SEPARATE jetton; coupling them would bloat the audited contract.

## Workstreams (parallel)

1. **SDK** (`sdk/`, TS): `getAccess(client, registry, code)`, `getGrant`, `getConfig`,
   `buildJettonPayment(registry, jettonMaster, amount, code)` → a TON Connect `messages[]` entry.
   Published-ready (package.json, types, a README). Verified against the Sandbox.
2. **Demo** (`demo/`): a generic static TON Connect page — connect wallet → pay the registry in
   (test) USDT with a code → read `access(code)` back. No bot. Runs standalone.
3. **Deploy** (`scripts/`): Blueprint-style deploy to **testnet**, `setJettonWallet`, `setPrice`,
   a read-script. Mainnet path documented, gated. **DONE + live on testnet:**
   `kQCl0kxWOtWz_OLYXAgxcTHw2jKxDRAjNIg7rIdeBLGEEgsg` (state `active`, `config()` exit 0; redeployed
   after the pre-submission security fixes — see docs/SECURITY.md).
4. **Audit prep** (`docs/SECURITY.md`): threat model + self-review (access control, bounce handling,
   over/underpay, storage growth, replay). Sets up the external audit the grant funds.
5. **Token (testnet)** + **tokenomics** (`docs/TOKENOMICS.md`): deploy a project jetton on testnet;
   fixed-supply allocation per researched best practice (community/ecosystem, team+vesting, treasury/DAO,
   liquidity, advisors). Argued, not copied.

## Testnet choice (argued)
TON **testnet** (not a devnet/local): it is the canonical pre-mainnet for TON, has public explorers
(testnet.tonviewer/tonscan) + faucet, and matches the eventual mainnet deploy 1:1. We already have a
working testnet toolchain (tonutils + a funded payer wallet from the earlier e2e). So the token + the
registry both go to TON testnet first.

## Non-negotiables
- Commits carry NO Claude/AI attribution.
- Production onboardbot payment rail is untouched.
- Every artifact compiles / tests green before commit.
