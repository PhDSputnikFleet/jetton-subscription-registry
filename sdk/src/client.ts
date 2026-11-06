import { Address } from '@ton/core';
import { TonClient } from '@ton/ton';
import type { Config, Grant } from './types';

/**
 * Either a toncenter JSON-RPC endpoint URL (e.g.
 * `https://toncenter.com/api/v2/jsonRPC` for mainnet or
 * `https://testnet.toncenter.com/api/v2/jsonRPC` for testnet) or a ready
 * `TonClient` instance.
 */
export type Endpoint = string | TonClient;

function resolveClient(endpoint: Endpoint): TonClient {
    return typeof endpoint === 'string' ? new TonClient({ endpoint }) : endpoint;
}

function toAddress(a: Address | string): Address {
    return typeof a === 'string' ? Address.parse(a) : a;
}

/** Read `access(code)` — is the grant for `code` currently valid? */
export async function getAccess(
    endpoint: Endpoint,
    registryAddress: Address | string,
    code: number | bigint,
): Promise<boolean> {
    const client = resolveClient(endpoint);
    const { stack } = await client.runMethod(toAddress(registryAddress), 'access', [
        { type: 'int', value: BigInt(code) },
    ]);
    return stack.readBoolean();
}

/** Read `grant(code)` — the full grant record, or `null` if none. */
export async function getGrant(
    endpoint: Endpoint,
    registryAddress: Address | string,
    code: number | bigint,
): Promise<Grant | null> {
    const client = resolveClient(endpoint);
    const { stack } = await client.runMethod(toAddress(registryAddress), 'grant', [
        { type: 'int', value: BigInt(code) },
    ]);
    const g = stack.readTupleOpt();
    if (g === null) return null;
    return {
        payer: g.readAddress(),
        amount: g.readBigNumber(),
        paidAt: Number(g.readBigNumber()),
        expiresAt: Number(g.readBigNumber()),
    };
}

/** Read `config()` — the registry's owner, jetton wallet, price, period, total. */
export async function getConfig(
    endpoint: Endpoint,
    registryAddress: Address | string,
): Promise<Config> {
    const client = resolveClient(endpoint);
    const { stack } = await client.runMethod(toAddress(registryAddress), 'config', []);
    return {
        owner: stack.readAddress(),
        jettonWallet: stack.readAddress(),
        price: stack.readBigNumber(),
        period: Number(stack.readBigNumber()),
        total: Number(stack.readBigNumber()),
    };
}
