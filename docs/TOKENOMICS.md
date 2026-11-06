# Sputnik (SPUT) — tokenomics & allocation

A project token for the JettonSubscriptionRegistry ecosystem: governance of grant/incentive
allocation and rewards for participants who perform a measurable function (integrators, operators,
maintainers). Not a fee-claim token. Designed as a **grant-funded / public-goods** token — no private
investor round.

> Status: **deployed on TON testnet** for the grant demo. Mainnet parameters (mint disabled, multisig
> admin, LP lock) are specified below and applied at the mainnet TGE.

## Supply
**1,000,000,000 SPUT (1B), fixed, 9 decimals, mint permanently disabled at mainnet TGE.**

Why 1B: supply size is economically neutral — ownership %, vesting and liquidity are what matter — so
the choice optimizes for legibility and reward granularity. 1B is the common infra/DeFi middle ground
(matches Uniswap's 1B UNI): fine-grained for small ecosystem/airdrop rewards (5% = 50M) yet readable as
a cap table. A fixed, non-mintable supply is itself a trust signal.

## Allocation

| Bucket | % | Vesting / lockup |
|---|---:|---|
| Community / public-goods (retro + prospective grants, airdrop to real users/contributors) | 30% | Streamed vs milestones; airdrop anti-sybil + staggered claims |
| Ecosystem & developer incentives (integrations, operators, tooling) | 20% | Emitted over 3-5 yr, DAO-approved |
| DAO treasury | 20% | DAO/multisig + timelock; published budget, 3-5 yr runway |
| Core contributors / future hires | 15% | **12-mo cliff → 36-mo linear (4 yr), 0% at TGE**, on-chain |
| Liquidity (DEX) | 5% | LP locked or burned, multisig-controlled, lock published |
| Foundation / legal steward | 5% | Same 4-yr vest as contributors |
| Reserve (unallocated at genesis) | 5% | Held by DAO, vests on grant |
| Investors | 0% | none — grant-funded |

Community + ecosystem + treasury = **75%**. Insiders (contributors + foundation) = **20%**, all on 4-year
vests, **0% at TGE**.

## Rationale (grounded in named examples)
Grant-funded public-goods projects optimize for durable funding and credible decentralization over
founder ownership — hence 0% investors and enlarged treasury/community pools. **Optimism** is the
template for the *architecture* (explicit public-goods line + long-lived treasury + retroactive
funding), though its exact split is too investor-heavy to copy. **Uniswap** (60% community, ~21% team,
4-year vesting) sets the community-majority + 4-yr-vest norm. **Gitcoin (GTC)** shows a token whose job
is governing grant allocation, not claiming fees — the right framing here. **The Graph / Filecoin /
Arweave** reinforce: reward participants who perform a measurable protocol function (indexers,
operators, maintainers), not passive holders — hence the dedicated ecosystem/operator bucket. The 15%
contributor share stays above the retention-hurting "artificially tiny" zone while the 12-mo-cliff /
4-yr vest signals commitment.

## Mainnet hardening (checklist — reviewers verify on-chain)
- [ ] Publish the **verified Jetton master** address (not just ticker/logo).
- [ ] **Disable `mintable`** (or hard cap behind multisig) — prove on-chain.
- [ ] Move **admin** from a single EOA to a **multisig + timelock**; renounce metadata-change rights or make metadata DAO-governed.
- [ ] **Lock or burn LP**; publish the lock. Avoid low-float/high-FDV.
- [ ] No insider unlock at TGE (>5% at TGE is a red flag); keep insiders ≤20% combined.
- [ ] Treasury under multisig + public reporting, never a discretionary EOA.

## Testnet deployment (current)
- Network: **TON testnet**
- Name / symbol / decimals: **Sputnik / SPUT / 9**
- Total supply: **1,000,000,000**
- Jetton master: `EQDMHUcRLHtcTzjSeq2KnZWdi8q_Ek923O1cFeDl_RiwpkeJ`
- Explorer: https://testnet.tonviewer.com/EQDMHUcRLHtcTzjSeq2KnZWdi8q_Ek923O1cFeDl_RiwpkeJ
- Note: on testnet the full supply is minted to the deploy wallet and `mintable` is still open — the
  mainnet hardening above (disable mint, multisig, vesting contracts) is applied at the real TGE.
