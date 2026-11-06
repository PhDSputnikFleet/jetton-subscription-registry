# Jetton Access Registry — TON Connect demo

A single static page that proves the on-chain access primitive end to end, with **no bot and no
backend**. A grant reviewer opens the page, connects a TON wallet, pays with a USDT jetton transfer
that carries an access `code`, and then reads the registry's `access(code)` get-method to confirm the
grant was recorded on-chain.

## What it does

1. Loads [`@tonconnect/ui`](https://unpkg.com/@tonconnect/ui@2/dist/tonconnect-ui.min.js) (CDN) and
   [`@ton/core`](https://esm.sh/@ton/core@0.60.0) (ESM) directly in the browser — no build step.
2. Reads all configuration from URL query params (see below).
3. Shows a **TON Connect** button to connect any TON wallet.
4. On **Pay**:
   - resolves the payer's jetton wallet for `jettonMaster` via the tonapi `get_wallet_address`
     get-method;
   - builds a **TEP-74 jetton transfer** body client-side with `@ton/core`
     (op `0x0f8a7ea5`; `amount`, `destination = registry`, `response_destination = owner`,
     `forward_ton_amount ≈ 0.05 TON`, and `forward_payload = ` a ref cell whose first field is
     `storeUint(code, 32)`);
   - sends it via `tonConnectUI.sendTransaction({ messages: [{ address: payerJettonWallet,
     amount: '100000000', payload: <BOC base64> }] })`.
5. On **Check access**: reads `access(code)` from the registry via the public tonapi get-method
   endpoint `/v2/blockchain/accounts/{registry}/methods/access?args={code}` on the selected network
   and shows **ACCESS VALID** / **NO ACCESS**.

The registry records the grant when **its own** jetton wallet notifies it of an incoming transfer
whose amount ≥ price; the `code` (uint32) sits at the very start of the transfer's forward payload.

## URL query params

| Param          | Meaning                                              | Example                                            |
| -------------- | ---------------------------------------------------- | -------------------------------------------------- |
| `registry`     | Registry contract address (the recipient)            | `EQAvDfWF...13T4kDck`                               |
| `jettonMaster` | USDT jetton master address                           | `EQAvDfWF...13T4kDck`                               |
| `amount`       | Jetton amount in **minimal units** (USDT = 6 dp)     | `1000000` (= 1.0 USDT)                              |
| `code`         | Access code, a `uint32`                              | `7`                                                |
| `net`          | `testnet` or `mainnet` (default `mainnet`)           | `testnet`                                          |

## Run it

It is a static page — no server is strictly required, but a static server avoids any `file://`
quirks and matches how a reviewer would host it.

```bash
# from the repo root
cd demo
python3 -m http.server 8777
```

Then open (replace the addresses with your deployed testnet values):

```
http://127.0.0.1:8777/index.html?registry=EQAvDfWFCRkk2UA1pA07KPuyUwZ3bHe6UTdROhbO13T4kDck&jettonMaster=EQAvDfWFCRkk2UA1pA07KPuyUwZ3bHe6UTdROhbO13T4kDck&amount=1000000&code=7&net=testnet
```

Or just open `index.html` directly in a browser and append the same `?...` query string.

## tonconnect-manifest.json

`tonConnectUI` fetches `tonconnect-manifest.json` (served next to `index.html`). The `url` field in
that manifest is shown by wallets during connect — change it to wherever you host the demo. For
local testing the included values work as-is.

## Notes / limits

- The full **wallet-sign → broadcast** step needs a real wallet tap and cannot be exercised
  headlessly. Everything up to opening the wallet is client-side and verifiable: the page renders,
  the TON Connect button mounts, params are parsed, and the jetton-transfer BOC is built with
  `@ton/core` (round-trip parse confirms op `0x0f8a7ea5`, destination = registry, forward payload =
  ref cell starting with the `uint32` code).
- Reads go through the public **tonapi** HTTP API (`tonapi.io` / `testnet.tonapi.io`). Unauthenticated
  use is rate-limited; for heavy use add an API key.
