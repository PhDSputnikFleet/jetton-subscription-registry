/**
 * Read the registry's on-chain state via the SDK (no wallet / no secrets needed).
 *
 * Env:
 *   REGISTRY_ADDRESS   (required) the deployed registry address.
 *   CODE               (optional) an invite code to check access/grant for.
 *   TONCENTER_ENDPOINT (optional) override; defaults to testnet toncenter.
 *   TONCENTER_API_KEY  (optional) toncenter API key.
 *
 * Run:  npm run read:access
 */
import { TonClient } from '@ton/ton';
import { getAccess, getConfig, getGrant } from '../sdk/src';
import { envOr, requireEnv, TESTNET_ENDPOINT } from './common';

async function main() {
    const registryAddress = requireEnv('REGISTRY_ADDRESS');
    const client = new TonClient({
        endpoint: envOr('TONCENTER_ENDPOINT', TESTNET_ENDPOINT),
        apiKey: process.env.TONCENTER_API_KEY?.trim() || undefined,
    });

    const cfg = await getConfig(client, registryAddress);
    console.log('Config:');
    console.log('  owner:       ', cfg.owner.toString({ testOnly: true }));
    console.log('  jettonWallet:', cfg.jettonWallet.toString({ testOnly: true }));
    console.log('  price:       ', cfg.price.toString(), 'micro-USDT');
    console.log('  period:      ', cfg.period, 's');
    console.log('  total grants:', cfg.total);

    const codeEnv = process.env.CODE?.trim();
    if (codeEnv) {
        const code = BigInt(codeEnv);
        const ok = await getAccess(client, registryAddress, code);
        const grant = await getGrant(client, registryAddress, code);
        console.log(`\nCode ${code}:`);
        console.log('  access:', ok);
        console.log('  grant: ', grant
            ? {
                payer: grant.payer.toString({ testOnly: true }),
                amount: grant.amount.toString(),
                paidAt: grant.paidAt,
                expiresAt: grant.expiresAt,
            }
            : null);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
