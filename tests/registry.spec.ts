import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, beginCell, Slice } from '@ton/core';
import { JettonSubscriptionRegistry } from '../build/JettonSubscriptionRegistry_JettonSubscriptionRegistry';
import '@ton/test-utils';

const PRICE = 2_000_000n;   // 2 USDT in micro (6 decimals)
const PERIOD = 2_592_000n;  // 30 days in seconds

function codePayload(code: bigint): Slice {
    return beginCell().storeUint(code, 32).endCell().asSlice();
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

    const notify = (from: SandboxContract<TreasuryContract>, amount: bigint, code: bigint) =>
        reg.send(from.getSender(), { value: toNano('0.05') }, {
            $$type: 'JettonTransferNotification',
            queryId: 0n,
            amount,
            sender: payer.address,
            forwardPayload: codePayload(code),
        });

    it('records a grant on a covering payment and reports access', async () => {
        await notify(jwallet, PRICE, 7788n);
        expect(await reg.getAccess(7788n)).toBe(true);
        const g = await reg.getGrant(7788n);
        expect(g?.payer.toString()).toBe(payer.address.toString());
        expect(g?.amount).toBe(PRICE);
        expect((await reg.getConfig()).total).toBe(1n);
    });

    it('accepts overpayment', async () => {
        await notify(jwallet, PRICE * 2n, 1234n);
        expect(await reg.getAccess(1234n)).toBe(true);
    });

    it('ignores an underpaid transfer (no grant)', async () => {
        await notify(jwallet, PRICE - 1n, 5555n);
        expect(await reg.getAccess(5555n)).toBe(false);
        expect((await reg.getConfig()).total).toBe(0n);
    });

    it('rejects a spoofed notification from a non-jetton-wallet sender', async () => {
        await notify(attacker, PRICE, 9999n);
        expect(await reg.getAccess(9999n)).toBe(false);
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
});
