import { Address, beginCell, Cell } from '@ton/core';
import { buildJettonPayment } from '../src/index';

const REG = 'EQAmVsG785JbMSErrxv8kYKdtjYnZ64jDj7QYhzJn6S35kVG';
const JW = 'EQDMHUcRLHtcTzjSeq2KnZWdi8q_Ek923O1cFeDl_RiwpkeJ';

describe('buildJettonPayment', () => {
  it('builds a valid TEP-74 transfer body carrying the code', () => {
    const msg = buildJettonPayment({
      payerJettonWallet: JW, registry: REG, responseTo: JW,
      amount: 2_000_000n, code: 7788n,
    });
    expect(msg.address).toBe(Address.parse(JW).toString());
    const body = Cell.fromBase64(msg.payload).beginParse();
    expect(body.loadUint(32)).toBe(0x0f8a7ea5); // op
    expect(body.loadUint(64)).toBe(0);          // query id
    expect(body.loadCoins()).toBe(2_000_000n);  // jetton amount
    expect(body.loadAddress().toString()).toBe(Address.parse(REG).toString()); // destination
    body.loadAddress();          // response
    expect(body.loadMaybeRef()).toBeNull();      // custom payload
    body.loadCoins();            // forward ton
    expect(body.loadBit()).toBe(true);           // forward payload as ref
    const fwd = body.loadRef().beginParse();
    expect(fwd.loadUint(32)).toBe(7788);         // the code
  });
});
