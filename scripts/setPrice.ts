/**
 * Owner op: set the subscription price and period.
 *
 * Env:
 *   TESTNET_MNEMONIC   (required) owner wallet mnemonic.
 *   REGISTRY_ADDRESS   (required) the deployed registry address.
 *   PRICE              (required) price in micro-USDT (e.g. 2000000 = 2 USDT).
 *   PERIOD             (required) subscription length in seconds (e.g. 2592000 = 30 days).
 *   TONCENTER_API_KEY  (optional) toncenter testnet API key.
 *
 * Run:  npm run set:price
 */
import { Address, toNano } from '@ton/core';
import { JettonSubscriptionRegistry } from '../build/JettonSubscriptionRegistry_JettonSubscriptionRegistry';
import { makeClient, openWallet, requireEnv } from './common';

async function main() {
    const registryAddress = Address.parse(requireEnv('REGISTRY_ADDRESS'));
    const price = BigInt(requireEnv('PRICE'));
    const period = BigInt(requireEnv('PERIOD'));

    const client = makeClient();
    const { sender } = await openWallet(client);

    const registry = client.open(JettonSubscriptionRegistry.fromAddress(registryAddress));
    await registry.send(sender, { value: toNano('0.05') }, {
        $$type: 'SetPrice',
        price,
        period,
    });
    console.log(`SetPrice sent: price=${price} micro-USDT period=${period}s`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
