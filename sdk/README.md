# jetton-subscription-registry-sdk

A tiny TypeScript SDK for the [`JettonSubscriptionRegistry`](../README.md) contract — an on-chain
USDT (jetton) subscription / access-grant primitive for TON.

It does two things:

1. **Read** the registry's on-chain state (`access`, `grant`, `config`) via a toncenter endpoint.
2. **Build** a TON Connect jetton-payment message so a user can pay the registry in USDT with an
   invite `code`.

The SDK keeps the convenience logic (payload building, stack decoding) off-chain so the audited
contract surface stays minimal.

## Install

```bash
npm install jetton-subscription-registry-sdk @ton/core @ton/ton
```

`@ton/core` and `@ton/ton` are declared as dependencies; install alongside your app.

## Reading access

```ts
import { getAccess, getGrant, getConfig } from 'jetton-subscription-registry-sdk';

const endpoint = 'https://testnet.toncenter.com/api/v2/jsonRPC'; // or mainnet
const registry = 'EQ...'; // the deployed registry address

// Is the grant for this invite code still valid?
const ok = await getAccess(endpoint, registry, 7788);

// Full grant record (or null).
const grant = await getGrant(endpoint, registry, 7788);
// -> { payer, amount, paidAt, expiresAt } | null

// Registry config.
const cfg = await getConfig(endpoint, registry);
// -> { owner, jettonWallet, price, period, total }
```

`endpoint` may also be a pre-configured `TonClient` (e.g. with an `apiKey`):

```ts
import { TonClient } from '@ton/ton';
const client = new TonClient({ endpoint, apiKey: process.env.TONCENTER_API_KEY });
await getAccess(client, registry, 7788);
```

## Building a payment (TON Connect)

```ts
import { buildJettonPayment } from 'jetton-subscription-registry-sdk';

const message = buildJettonPayment({
  payerJettonWallet: 'EQ...', // the connected user's USDT jetton wallet
  registry: 'EQ...',          // the registry (alias: registryAddress)
  amount: 2_000_000n,         // 2 USDT (6 decimals)
  code: 7788,                 // invite code -> forward payload
  responseTo: 'EQ...',        // the connected user's main wallet (refund of excess TON; alias: responseAddress)
  forwardTonAmount: 50_000_000n, // optional, default 0.05 TON
});

// message -> { address, amount, payload } (payload = base64 BOC of the transfer body)

await tonConnectUI.sendTransaction({
  validUntil: Math.floor(Date.now() / 1000) + 300,
  messages: [message],
});
```

The transfer body is a standard TEP-74 jetton `transfer` (op `0x0f8a7ea5`) with
`destination = registryAddress` and a forward payload holding the `code` as a `uint32`.

## API

| Function | Purpose |
|---|---|
| `getAccess(endpoint, registry, code)` | `Promise<boolean>` — grant valid now? |
| `getGrant(endpoint, registry, code)` | `Promise<Grant \| null>` |
| `getConfig(endpoint, registry)` | `Promise<Config>` |
| `buildJettonPayment(params)` | `TonConnectMessage` — `{ address, amount, payload }` |
| `buildJettonTransferBody(params)` | the raw `Cell` body (advanced) |
| `buildForwardPayload(code)` | the forward-payload `Cell` (advanced) |

## Build

```bash
npm install
npm run build   # tsc -> dist/
```

## License

MIT
