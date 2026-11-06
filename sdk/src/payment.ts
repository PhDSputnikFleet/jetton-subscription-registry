import { Address, beginCell, Cell, toNano } from '@ton/core';
import type { TonConnectMessage } from './types';

/** TEP-74 jetton `transfer` op. */
export const JETTON_TRANSFER_OP = 0x0f8a7ea5;

/** Default TON forwarded with the transfer so the wallet emits a notification. */
export const DEFAULT_FORWARD_TON = toNano('0.05');

/** Default extra TON (on top of forward amount) to cover wallet + transfer gas. */
export const DEFAULT_GAS_TON = toNano('0.05');

export interface JettonPaymentParams {
    /** The payer's own USDT jetton wallet — the TON Connect message destination. */
    payerJettonWallet: Address | string;
    /** The registry contract address — the jetton transfer `destination`. */
    registry?: Address | string;
    /** Alias for `registry`. */
    registryAddress?: Address | string;
    /** Jetton amount to send, in micro-units (USDT, 6 decimals). */
    amount: bigint;
    /** The invite code, carried as a uint32 at the start of the forward payload. */
    code: number | bigint;
    /** TON forwarded to the registry to trigger its notification (default 0.05). */
    forwardTonAmount?: bigint;
    /**
     * `response_destination` — where excess TON is refunded. This should be the
     * payer's main wallet; in a TON Connect flow that is the connected account.
     * Omit for `addr_none` (no refund address).
     */
    responseTo?: Address | string | null;
    /** Alias for `responseTo`. */
    responseAddress?: Address | string | null;
    /** Jetton transfer query id (default 0). */
    queryId?: bigint;
    /**
     * TON (nanoton) to attach to the TON Connect message. Defaults to
     * `forwardTonAmount + 0.05` TON which covers the forward + gas.
     */
    value?: bigint;
}

function toAddress(a: Address | string): Address {
    return typeof a === 'string' ? Address.parse(a) : a;
}

function resolveRegistry(params: JettonPaymentParams): Address {
    const r = params.registry ?? params.registryAddress;
    if (r == null) {
        throw new Error('buildJettonPayment: `registry` (registry address) is required');
    }
    return toAddress(r);
}

function resolveResponse(params: JettonPaymentParams): Address | null {
    const raw = params.responseTo !== undefined ? params.responseTo : params.responseAddress;
    return raw == null ? null : toAddress(raw);
}

/**
 * Build the forward payload cell: a uint32 `code` at the start of the cell.
 * This is what the registry reads with `forwardPayload.loadUint(32)`.
 */
export function buildForwardPayload(code: number | bigint): Cell {
    const c = BigInt(code);
    if (c < 0n || c > 0xffffffffn) {
        throw new RangeError(`code must fit in uint32 (0..4294967295), got ${c}`);
    }
    return beginCell().storeUint(c, 32).endCell();
}

/**
 * Build the TEP-74 jetton `transfer` body (op 0x0f8a7ea5) that moves USDT from
 * the payer's jetton wallet to the registry, with the invite code in the
 * forward payload (stored as a ref cell).
 */
export function buildJettonTransferBody(params: JettonPaymentParams): Cell {
    const forwardTon = params.forwardTonAmount ?? DEFAULT_FORWARD_TON;
    const response = resolveResponse(params);
    const forwardPayload = buildForwardPayload(params.code);

    return beginCell()
        .storeUint(JETTON_TRANSFER_OP, 32)
        .storeUint(params.queryId ?? 0n, 64)
        .storeCoins(params.amount)
        .storeAddress(resolveRegistry(params)) // destination
        .storeAddress(response) // response_destination (payer), or addr_none
        .storeBit(false) // custom_payload: Maybe ^Cell = nothing
        .storeCoins(forwardTon) // forward_ton_amount
        .storeBit(true) // forward_payload: Either = right -> stored as ref
        .storeRef(forwardPayload)
        .endCell();
}

/**
 * Build a ready-to-send TON Connect message that pays the registry in USDT and
 * encodes the invite `code`.
 */
export function buildJettonPayment(params: JettonPaymentParams): TonConnectMessage {
    const forwardTon = params.forwardTonAmount ?? DEFAULT_FORWARD_TON;
    const value = params.value ?? forwardTon + DEFAULT_GAS_TON;
    const body = buildJettonTransferBody(params);

    return {
        address: toAddress(params.payerJettonWallet).toString(),
        amount: value.toString(),
        payload: body.toBoc().toString('base64'),
    };
}
