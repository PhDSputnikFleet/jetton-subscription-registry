/**
 * Owner op: set the registry's own USDT jetton wallet (the anti-spoof anchor).
 *
 * Env:
 *   TESTNET_MNEMONIC   (required) owner wallet mnemonic.
 *   REGISTRY_ADDRESS   (required) the deployed registry address.
 *   JETTON_WALLET      (required) the registry's own USDT jetton wallet address.
 *   TONCENTER_API_KEY  (optional) toncenter testnet API key.
 *
 * Run:  npm run set:wallet
 */
import { Address, toNano } from '@ton/core';
import { JettonSubscriptionRegistry } from '../build/JettonSubscriptionRegistry_JettonSubscriptionRegistry';
import { makeClient, openWallet, requireEnv } from './common';

async function main() {
    const registryAddress = Address.parse(requireEnv('REGISTRY_ADDRESS'));
    const jettonWallet = Address.parse(requireEnv('JETTON_WALLET'));

    const client = makeClient();
    const { sender } = await openWallet(client);

    const registry = client.open(JettonSubscriptionRegistry.fromAddress(registryAddress));
    await registry.send(sender, { value: toNano('0.05') }, {
        $$type: 'SetJettonWallet',
        wallet: jettonWallet,
    });
    console.log('SetJettonWallet sent:', jettonWallet.toString({ testOnly: true }));
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
