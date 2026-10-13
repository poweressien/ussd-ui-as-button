import { GenericParser } from '../../src/engine/GenericParser';

const buttons = (r: ReturnType<typeof GenericParser.parse>) =>
  r.components.filter((c) => c.type === 'button').map((c: any) => `${c.input}=${c.label}`);

describe('real Airtel/MTN dialogs from the device', () => {
  it('mixed "1. X" and "3 4GB @ N1000" lines all become buttons, plus * Next', () => {
    const r = GenericParser.parse(
      ['1. My Airtel Offer', '2. Data Plans', '3  4GB @ N1000', '4 10GB @N3000', '5 4GB @N1500', '6 3GB @N750', '7 1GB @N500', '8 2GB @ N600', '9 8GB @N2500', '* Next'].join('\n')
    );
    expect(r.type).toBe('screen');
    expect(buttons(r)).toEqual([
      '1=My Airtel Offer', '2=Data Plans', '3=4GB @ N1000', '4=10GB @N3000', '5=4GB @N1500',
      '6=3GB @N750', '7=1GB @N500', '8=2GB @ N600', '9=8GB @N2500', '*=Next',
    ]);
  });

  it('closing messages are terminal (Done), not an empty reply box', () => {
    for (const t of [
      'You currently do not have access to this service. Please contact your bank for further assistance. Thank you.',
      'Sorry, you are not eligible for a loan now. Eligibility is reviewed periodically based on service usage and other criteria, Please check again later.',
    ]) {
      const r = GenericParser.parse(t);
      expect(r.isTerminal).toBe(true);
      expect(r.components.some((c) => c.type === 'input')).toBe(false);
    }
  });

  it('a lone amount line is not an option', () => {
    const r = GenericParser.parse('Balance\n5 000 NGN');
    expect(buttons(r)).toEqual([]);
  });

  it('a real prompt stays an input', () => {
    const r = GenericParser.parse('Enter amount:');
    expect(r.type).toBe('input');
  });
});
