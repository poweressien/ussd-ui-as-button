import { GenericParser } from '../../src/engine/GenericParser';

describe('GenericParser — option detection & button mapping', () => {
  it('parses a numbered menu into button components', () => {
    const result = GenericParser.parse('Welcome\n1. Transfer\n2. Airtime\n3. Data\n4. Balance');
    expect(result.type).toBe('screen');
    expect(result.title).toBe('Welcome');
    expect(result.components).toHaveLength(4);
    expect(result.components[0]).toMatchObject({ type: 'button', label: 'Transfer', input: '1' });
    expect(result.components[3]).toMatchObject({ type: 'button', label: 'Balance', input: '4' });
  });

  it('accepts punctuation-free option lines ("1 Transfer")', () => {
    const result = GenericParser.parse('1 Transfer\n2 Airtime\n3 Balance');
    expect(result.type).toBe('screen');
    expect(result.components.map((c: any) => c.label)).toEqual(['Transfer', 'Airtime', 'Balance']);
  });

  it('accepts ")" and ":" as option separators', () => {
    const result = GenericParser.parse('1) Transfer\n2: Airtime');
    expect(result.components.map((c: any) => c.input)).toEqual(['1', '2']);
  });

  it('never hardcodes which digit a label maps to — derives it from the menu order shown', () => {
    // Deliberately out of numeric order and not starting at 1, to prove the
    // mapping is read from the text rather than assumed.
    const result = GenericParser.parse('3. Transfer\n7. Airtime\n1. Balance');
    const byLabel = Object.fromEntries(result.components.map((c: any) => [c.label, c.input]));
    expect(byLabel).toEqual({ Transfer: '3', Airtime: '7', Balance: '1' });
  });

  it('does not mistake a bare echoed number for a menu option', () => {
    const result = GenericParser.parse('Your account number is\n0123456789');
    expect(result.type).not.toBe('screen');
  });
});

describe('GenericParser — input prompt detection', () => {
  it('detects a numeric input prompt from "account number"', () => {
    const result = GenericParser.parse('Enter account number');
    expect(result.type).toBe('input');
    expect(result.components[0]).toMatchObject({ type: 'input', inputType: 'numeric', sensitive: false });
  });

  it('detects a numeric input prompt from "amount"', () => {
    const result = GenericParser.parse('Enter amount');
    expect(result.components[0]).toMatchObject({ inputType: 'numeric' });
  });

  it('detects a PIN prompt and marks it sensitive', () => {
    const result = GenericParser.parse('Enter your PIN to continue');
    expect(result.components[0]).toMatchObject({ inputType: 'pin', sensitive: true });
  });

  it('detects an OTP prompt as sensitive', () => {
    const result = GenericParser.parse('Enter the OTP sent to your phone');
    expect(result.components[0]).toMatchObject({ inputType: 'pin', sensitive: true });
  });

  it('falls back to free text when nothing more specific matches', () => {
    const result = GenericParser.parse('Enter your full name');
    expect(result.components[0]).toMatchObject({ inputType: 'text', sensitive: false });
  });
});

describe('GenericParser — confirm detection', () => {
  it('recognises a two-option confirm/cancel menu and derives the real input codes', () => {
    const result = GenericParser.parse('Transfer NGN5,000 to 0123456789?\n1. Confirm\n2. Cancel');
    expect(result.type).toBe('confirm');
    expect(result.components[0]).toMatchObject({
      type: 'confirm',
      confirmInput: '1',
      cancelInput: '2',
    });
  });

  it('derives non-standard confirm/cancel digits from the menu instead of assuming 1/0', () => {
    const result = GenericParser.parse('Approve payment?\n9. Confirm\n8. Cancel');
    expect(result.components[0]).toMatchObject({ confirmInput: '9', cancelInput: '8' });
  });

  it('reads reply digits out of a prose confirm prompt when there is no numbered list', () => {
    const result = GenericParser.parse(
      'Confirm transfer of NGN5,000 to 08012345678? Reply 1 to confirm or 2 to cancel'
    );
    expect(result.type).toBe('confirm');
    expect(result.components[0]).toMatchObject({ confirmInput: '1', cancelInput: '2' });
  });

  it('falls back to the 1/0 convention only when no digits are readable from a prose confirm prompt', () => {
    const result = GenericParser.parse('Please confirm this action.');
    expect(result.type).toBe('confirm');
    expect(result.components[0]).toMatchObject({ confirmInput: '1', cancelInput: '0' });
  });
});

describe('GenericParser — bare informational displays (balance checks)', () => {
  it('treats a real carrier balance display as terminal instead of a redundant input prompt', () => {
    // Exact real response captured from a live *310# session — see
    // docs/PARSER-DESIGN.md for why the parser is designed to be refined
    // against real captured text like this.
    const result = GenericParser.parse('Pulse main account: N14.53');
    expect(result.type).toBe('terminal');
    expect(result.isTerminal).toBe(true);
    expect(result.isError).toBe(false);
  });

  it('recognises other balance-flavoured phrasings the same way', () => {
    expect(GenericParser.parse('Your available balance is NGN500.00').type).toBe('terminal');
    expect(GenericParser.parse('Wallet balance: 2,300').type).toBe('terminal');
  });

  it('does not let "account" alone trigger this — "Enter account number" stays an input prompt', () => {
    const result = GenericParser.parse('Enter account number');
    expect(result.type).toBe('input');
  });

  it('does not treat a balance screen that also asks for a reply as terminal', () => {
    const result = GenericParser.parse('Your balance is low. Please provide a top-up amount');
    expect(result.type).not.toBe('terminal');
  });
});

describe('GenericParser — terminal & error detection', () => {
  it('recognises a success message as terminal', () => {
    const result = GenericParser.parse('Transaction successful. NGN5,000 sent to 0123456789.');
    expect(result.type).toBe('terminal');
    expect(result.isTerminal).toBe(true);
    expect(result.isError).toBe(false);
  });

  it('recognises a failure message as a terminal error', () => {
    const result = GenericParser.parse('Invalid PIN entered. Please try again.');
    expect(result.type).toBe('error');
    expect(result.isTerminal).toBe(true);
    expect(result.isError).toBe(true);
  });

  it('flags an option screen as an error when it also contains failure language', () => {
    const result = GenericParser.parse('Transaction failed\n1. Retry\n2. Exit');
    expect(result.type).toBe('screen');
    expect(result.isError).toBe(true);
  });
});
