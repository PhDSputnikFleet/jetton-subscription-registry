import type { Address } from '@ton/core';

/** A recorded access grant, keyed by `code` in the registry. */
export interface Grant {
    /** The payer's wallet owner address (from the jetton transfer notification). */
    payer: Address;
    /** Jetton amount paid, in micro-units (USDT has 6 decimals). */
    amount: bigint;
    /** Unix seconds when the grant was recorded. */
    paidAt: number;
    /** Unix seconds when the grant expires (`paidAt + period`). */
    expiresAt: number;
}

/** The registry's public configuration (its `config()` get-method). */
export interface Config {
    owner: Address;
    /** The registry's own USDT jetton wallet — the anti-spoof anchor. */
    jettonWallet: Address;
    /** Price in micro-units (USDT, 6 decimals). */
    price: bigint;
    /** Subscription length in seconds. */
    period: number;
    /** Number of grants recorded so far. */
    total: number;
}

/**
 * A TON Connect message entry (`messages[]` item) ready to hand to
 * `tonConnectUI.sendTransaction({ messages: [msg] })`.
 */
export interface TonConnectMessage {
    /** Destination of the on-chain message — here, the payer's jetton wallet. */
    address: string;
    /** TON (nanoton) to attach, as a decimal string. */
    amount: string;
    /** Base64 BOC of the message body. */
    payload: string;
}
