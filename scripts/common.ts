import { mnemonicToPrivateKey } from '@ton/crypto';
import { Address, OpenedContract } from '@ton/core';
import { TonClient, WalletContractV4 } from '@ton/ton';

export const TESTNET_ENDPOINT = 'https://testnet.toncenter.com/api/v2/jsonRPC';

/** Read a required env var or exit with a clear message. */
export function requireEnv(name: string): string {
    const v = process.env[name];
    if (!v || v.trim() === '') {
        console.error(`Missing required env var: ${name}`);
        process.exit(1);
    }
    return v.trim();
}

/** Optional env var with a default. */
export function envOr(name: string, fallback: string): string {
    const v = process.env[name];
    return v && v.trim() !== '' ? v.trim() : fallback;
}

export function makeClient(): TonClient {
    return new TonClient({
        endpoint: envOr('TONCENTER_ENDPOINT', TESTNET_ENDPOINT),
        // Optional toncenter API key raises the rate limit; not required.
        apiKey: process.env.TONCENTER_API_KEY?.trim() || undefined,
    });
}

/**
 * Build a wallet + sender from the `TESTNET_MNEMONIC` env var (24 space-separated
 * words). Never hardcode secrets; this is the only place the mnemonic is read.
 */
export async function openWallet(client: TonClient): Promise<{
    wallet: OpenedContract<WalletContractV4>;
    address: Address;
    sender: ReturnType<OpenedContract<WalletContractV4>['sender']>;
}> {
    const mnemonic = requireEnv('TESTNET_MNEMONIC').split(/\s+/);
    const key = await mnemonicToPrivateKey(mnemonic);
    const wallet = WalletContractV4.create({ workchain: 0, publicKey: key.publicKey });
    const opened = client.open(wallet);
    return {
        wallet: opened,
        address: wallet.address,
        sender: opened.sender(key.secretKey),
    };
}
