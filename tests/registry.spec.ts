import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, beginCell, Slice } from '@ton/core';
import { JettonSubscriptionRegistry } from '../build/JettonSubscriptionRegistry_JettonSubscriptionRegistry';
import '@ton/test-utils';

const PRICE = 2_000_000n;   // 2 USDT in micro (6 decimals)
const PERIOD = 2_592_000n;  // 30 days in seconds

// TEP-74 forward_payload is (Either Cell ^Cell): a selector bit, then the payload
// inline (selector 0) or in a referenced cell (selector 1). Real wallets AND our
// SDK (storeBit(true)+storeRef) use the ref form — the default we test against.
function codePayloadRef(code: bigint): Slice {
    return beginCell()
        .storeBit(true)
        .storeRef(beginCell().storeUint(code, 32).endCell())
        .endCell()
        .asSlice();
}
// The inline alternative, which the contract must also accept.
function codePayloadInline(code: bigint): Slice {
    return beginCell().storeBit(false).storeUint(code, 32).endCell().asSlice();
}

describe('JettonSubscriptionRegistry', () => {
    let blockchain: Blockchain;
    let owner: SandboxContract<TreasuryContract>;
    let jwallet: SandboxContract<TreasuryContract>; // stand-in for the contract's own USDT jetton wallet
    let attacker: SandboxContract<TreasuryContract>;
    let payer: SandboxContract<TreasuryContract>;
    let reg: SandboxContract<JettonSubscriptionRegistry>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        owner = await blockchain.treasury('owner');
        jwallet = await blockchain.treasury('jwallet');
        attacker = await blockchain.treasury('attacker');
        payer = await blockchain.treasury('payer');

        reg = blockchain.openContract(
            await JettonSubscriptionRegistry.fromInit(owner.address, PRICE, PERIOD),
        );
        await reg.send(owner.getSender(), { value: toNano('0.1') }, { $$type: 'Deploy', queryId: 0n });
        // tell the registry which address is its own jetton wallet (anti-spoof anchor)
        await reg.send(owner.getSender(), { value: toNano('0.05') }, { $$type: 'SetJettonWallet', wallet: jwallet.address });
    });

    const notify = (from: SandboxContract<TreasuryContract>, amount: bigint, payload: Slice) =>
        reg.send(from.getSender(), { value: toNano('0.05') }, {
            $$type: 'JettonTransferNotification',
            queryId: 0n,
            amount,
            sender: payer.address,
            forwardPayload: payload,
        });

    it('records a grant on a covering payment (ref payload, as the SDK sends)', async () => {
        await notify(jwallet, PRICE, codePayloadRef(7788n));
        expect(await reg.getAccess(7788n)).toBe(true);
        const g = await reg.getGrant(7788n);
        expect(g?.payer.toString()).toBe(payer.address.toString());
        expect(g?.amount).toBe(PRICE);
        expect((await reg.getConfig()).total).toBe(1n);
    });

    it('also accepts an inline forward payload', async () => {
        await notify(jwallet, PRICE, codePayloadInline(4321n));
        expect(await reg.getAccess(4321n)).toBe(true);
    });

    it('accepts overpayment', async () => {
        await notify(jwallet, PRICE * 2n, codePayloadRef(1234n));
        expect(await reg.getAccess(1234n)).toBe(true);
    });

    it('ignores an underpaid transfer (no grant)', async () => {
        await notify(jwallet, PRICE - 1n, codePayloadRef(5555n));
        expect(await reg.getAccess(5555n)).toBe(false);
        expect((await reg.getConfig()).total).toBe(0n);
    });

    it('rejects a spoofed notification from a non-jetton-wallet sender', async () => {
        await notify(attacker, PRICE, codePayloadRef(9999n));
        expect(await reg.getAccess(9999n)).toBe(false);
    });

    it('renewal to an existing code does not double-count total', async () => {
        await notify(jwallet, PRICE, codePayloadRef(100n));
        await notify(jwallet, PRICE, codePayloadRef(100n));
        expect((await reg.getConfig()).total).toBe(1n);
        expect(await reg.getAccess(100n)).toBe(true);
    });

    it('refuses payments until the jetton wallet is configured', async () => {
        const fresh = blockchain.openContract(
            await JettonSubscriptionRegistry.fromInit(owner.address, PRICE, PERIOD),
        );
        await fresh.send(owner.getSender(), { value: toNano('0.1') }, { $$type: 'Deploy', queryId: 0n });
        // jettonWallet is still the init placeholder (== owner); a payment must be refused
        const res = await fresh.send(owner.getSender(), { value: toNano('0.05') }, {
            $$type: 'JettonTransferNotification',
            queryId: 0n, amount: PRICE, sender: payer.address, forwardPayload: codePayloadRef(1n),
        });
        expect(res.transactions).toHaveTransaction({ to: fresh.address, success: false });
        expect(await fresh.getAccess(1n)).toBe(false);
    });

    it('unknown code has no access', async () => {
        expect(await reg.getAccess(4242n)).toBe(false);
    });

    it('only owner can change config', async () => {
        const bad = await reg.send(attacker.getSender(), { value: toNano('0.05') }, {
            $$type: 'SetPrice', price: 1n, period: 1n,
        });
        expect(bad.transactions).toHaveTransaction({ from: attacker.address, to: reg.address, success: false });
        expect((await reg.getConfig()).price).toBe(PRICE);
    });

    it('withdraw sends a jetton transfer from our jetton wallet to the destination', async () => {
        await notify(jwallet, PRICE, codePayloadRef(1n));
        const res = await reg.send(owner.getSender(), { value: toNano('0.1') }, {
            $$type: 'WithdrawJettons', amount: PRICE, to: owner.address,
        });
        // the registry must emit a jetton transfer (op 0x0f8a7ea5) to its jetton wallet
        expect(res.transactions).toHaveTransaction({
            from: reg.address,
            to: jwallet.address,
            op: 0x0f8a7ea5,
            success: true,
        });
    });

    it('only owner can withdraw', async () => {
        const bad = await reg.send(attacker.getSender(), { value: toNano('0.1') }, {
            $$type: 'WithdrawJettons', amount: PRICE, to: attacker.address,
        });
        expect(bad.transactions).toHaveTransaction({ from: attacker.address, to: reg.address, success: false });
    });
});
