# Testnet deploy & admin scripts

Blueprint-style scripts to deploy and operate the `JettonSubscriptionRegistry` on **TON testnet**,
plus a read script that exercises the SDK. They use [`@ton/ton`](https://github.com/ton-org/ton)
against the toncenter testnet endpoint and derive a wallet from a mnemonic in the environment.

> Secrets are **never** hardcoded. The wallet mnemonic is read only from `TESTNET_MNEMONIC`.
> Use a throwaway testnet wallet funded from the [testnet faucet](https://t.me/testgiver_ton_bot).

## Prerequisites

```bash
npm install     # from the repo root
npm run build   # generates build/JettonSubscriptionRegistry_* used by the deploy scripts
```

## Environment

| Var | Used by | Meaning |
|---|---|---|
| `TESTNET_MNEMONIC` | deploy, set:wallet, set:price | 24-word wallet mnemonic (space-separated). Becomes the owner. |
| `PRICE` | deploy (opt), set:price | Price in micro-USDT (6 decimals). `2000000` = 2 USDT. |
| `PERIOD` | deploy (opt), set:price | Subscription length in seconds. `2592000` = 30 days. |
| `REGISTRY_ADDRESS` | set:wallet, set:price, read:access | The deployed registry address. |
| `JETTON_WALLET` | set:wallet | The registry's own USDT jetton wallet address. |
| `CODE` | read:access (opt) | An invite code to check access/grant for. |
| `TONCENTER_ENDPOINT` | all (opt) | Override endpoint; defaults to testnet toncenter. |
| `TONCENTER_API_KEY` | all (opt) | toncenter API key (raises rate limit). |

Export them inline or via a `.env` loaded by your shell. Do not commit secrets.

## Usage

```bash
# 1. Deploy (owner = your mnemonic wallet)
TESTNET_MNEMONIC="word1 word2 ... word24" npm run deploy:testnet

# 2. Point the registry at its own USDT jetton wallet (compute it off-chain from
#    the USDT jetton master + the registry address, then):
TESTNET_MNEMONIC="..." REGISTRY_ADDRESS="EQ..." JETTON_WALLET="EQ..." npm run set:wallet

# 3. (Optional) change price / period
TESTNET_MNEMONIC="..." REGISTRY_ADDRESS="EQ..." PRICE=2000000 PERIOD=2592000 npm run set:price

# 4. Read on-chain state (no secrets needed)
REGISTRY_ADDRESS="EQ..." CODE=7788 npm run read:access
```

## Mainnet

The same scripts work against mainnet by setting `TONCENTER_ENDPOINT=https://toncenter.com/api/v2/jsonRPC`.
Mainnet deploys move real funds — gate them behind review and use a dedicated owner wallet.
