/**
 * Deploy the JettonSubscriptionRegistry to TON testnet.
 *
 * Env:
 *   TESTNET_MNEMONIC   (required) 24-word wallet mnemonic; this wallet becomes the owner.
 *   PRICE              (optional) price in micro-USDT (default 2000000 = 2 USDT).
 *   PERIOD             (optional) subscription length in seconds (default 2592000 = 30 days).
 *   TONCENTER_API_KEY  (optional) toncenter testnet API key.
 *
 * Run:  npm run deploy:testnet
 */
import { toNano } from '@ton/core';
import { JettonSubscriptionRegistry } from '../build/JettonSubscriptionRegistry_JettonSubscriptionRegistry';
import { envOr, makeClient, openWallet } from './common';

async function main() {
    const price = BigInt(envOr('PRICE', '2000000'));
    const period = BigInt(envOr('PERIOD', '2592000'));

    const client = makeClient();
    const { address: owner, sender } = await openWallet(client);
    console.log('Owner wallet:', owner.toString({ testOnly: true }));
    console.log(`Price: ${price} micro-USDT  Period: ${period}s`);

    const registry = client.open(await JettonSubscriptionRegistry.fromInit(owner, price, period));
    console.log('Registry address:', registry.address.toString({ testOnly: true }));

    const deployed = await client.isContractDeployed(registry.address);
    if (deployed) {
        console.log('Already deployed — nothing to do.');
        return;
    }

    await registry.send(sender, { value: toNano('0.1') }, { $$type: 'Deploy', queryId: 0n });
    console.log('Deploy message sent. Check the explorer:');
    console.log(`  https://testnet.tonviewer.com/${registry.address.toString({ testOnly: true })}`);
    console.log('Next: set the jetton wallet with scripts/setJettonWallet.ts once it is known.');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
