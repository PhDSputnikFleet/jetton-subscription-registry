import { Address, Cell, toNano } from '@ton/core';
import {
    buildJettonPayment,
    buildJettonTransferBody,
    JETTON_TRANSFER_OP,
} from '../sdk/src/payment';

// Deterministic, valid raw addresses (workchain 0, fixed hashes).
const REGISTRY = new Address(0, Buffer.alloc(32, 0x11));
const PAYER_JWALLET = new Address(0, Buffer.alloc(32, 0x22));
const PAYER_MAIN = new Address(0, Buffer.alloc(32, 0x33));

const AMOUNT = 2_000_000n; // 2 USDT (6 decimals)
const CODE = 7788;

describe('buildJettonTransferBody', () => {
    it('encodes a valid TEP-74 transfer body with the code in a ref forward payload', () => {
        const body = buildJettonTransferBody({
            payerJettonWallet: PAYER_JWALLET,
            registryAddress: REGISTRY,
            amount: AMOUNT,
            code: CODE,
            responseAddress: PAYER_MAIN,
            forwardTonAmount: toNano('0.05'),
        });

        const s = body.beginParse();
        expect(s.loadUint(32)).toBe(JETTON_TRANSFER_OP);
        expect(s.loadUintBig(64)).toBe(0n); // queryId default
        expect(s.loadCoins()).toBe(AMOUNT);
        expect(s.loadAddress().toString()).toBe(REGISTRY.toString()); // destination
        expect(s.loadMaybeAddress()?.toString()).toBe(PAYER_MAIN.toString()); // response
        expect(s.loadBit()).toBe(false); // custom_payload = nothing
        expect(s.loadCoins()).toBe(toNano('0.05')); // forward_ton_amount
        expect(s.loadBit()).toBe(true); // forward_payload stored as ref

        const fp = s.loadRef().beginParse();
        expect(fp.loadUint(32)).toBe(CODE); // the invite code the contract reads
        expect(s.remainingBits).toBe(0);
    });

    it('writes addr_none when no response address is given', () => {
        const body = buildJettonTransferBody({
            payerJettonWallet: PAYER_JWALLET,
            registryAddress: REGISTRY,
            amount: AMOUNT,
            code: CODE,
        });
        const s = body.beginParse();
        s.loadUint(32); // op
        s.loadUintBig(64); // queryId
        s.loadCoins(); // amount
        s.loadAddress(); // destination
        expect(s.loadMaybeAddress()).toBeNull(); // response = addr_none
    });

    it('rejects a code that does not fit in uint32', () => {
        expect(() =>
            buildJettonTransferBody({
                payerJettonWallet: PAYER_JWALLET,
                registryAddress: REGISTRY,
                amount: AMOUNT,
                code: 0x1_0000_0000n,
            }),
        ).toThrow(/uint32/);
    });
});

describe('buildJettonPayment', () => {
    it('returns a TON Connect message whose payload is a valid BOC of the transfer body', () => {
        const msg = buildJettonPayment({
            payerJettonWallet: PAYER_JWALLET,
            registryAddress: REGISTRY,
            amount: AMOUNT,
            code: CODE,
            responseAddress: PAYER_MAIN,
            forwardTonAmount: toNano('0.05'),
        });

        expect(msg.address).toBe(PAYER_JWALLET.toString());
        // default value = forwardTonAmount + 0.05 gas
        expect(msg.amount).toBe((toNano('0.05') + toNano('0.05')).toString());

        const expected = buildJettonTransferBody({
            payerJettonWallet: PAYER_JWALLET,
            registryAddress: REGISTRY,
            amount: AMOUNT,
            code: CODE,
            responseAddress: PAYER_MAIN,
            forwardTonAmount: toNano('0.05'),
        });
        const reparsed = Cell.fromBase64(msg.payload);
        expect(reparsed.equals(expected)).toBe(true);
    });

    it('honours an explicit value override', () => {
        const msg = buildJettonPayment({
            payerJettonWallet: PAYER_JWALLET,
            registryAddress: REGISTRY,
            amount: AMOUNT,
            code: CODE,
            value: toNano('0.2'),
        });
        expect(msg.amount).toBe(toNano('0.2').toString());
    });
});
