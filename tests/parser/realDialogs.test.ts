import { GenericParser } from '../../src/engine/GenericParser';

describe('GenericParser — shapes seen on a real HyperOS dialog', () => {
  it('drops the phone dialog\'s own title and builds buttons from the menu', () => {
    const r = GenericParser.parse(
      'Carrier info\n1. Account info\n2. Tariff Plans\n3. Data Services\n4. Roaming/Int\'l\n9. MTN eShop'
    );
    expect(r.type).toBe('screen');
    expect(r.title).toBe('Select an option');
    expect(r.components.map((c: any) => c.input)).toEqual(['1', '2', '3', '4', '9']);
  });

  it('keeps the prompt text of an input screen instead of showing an empty box', () => {
    const r = GenericParser.parse('Carrier info\nEnter the phone number to recharge:');
    expect(r.type).toBe('input');
    expect(r.title).toBe('Enter the phone number to recharge:');
  });

  it('shows body lines of a multi-line prompt as text', () => {
    const r = GenericParser.parse('Recharge\nBalance low.\nEnter amount:');
    expect(r.type).toBe('input');
    expect(r.components[0]).toMatchObject({ type: 'text' });
  });

  it('accepts options with no space after the dot ("1.Balance")', () => {
    const r = GenericParser.parse('Select\n1.Balance\n2.Data\n0.Back');
    expect(r.components.filter((c: any) => c.type === 'button').map((c: any) => c.input)).toEqual(['1', '2', '0']);
  });

  it('splits several options squeezed onto one line', () => {
    const r = GenericParser.parse('1.Balance 2.Data 3.Voice');
    expect(r.components.map((c: any) => c.label)).toEqual(['Balance', 'Data', 'Voice']);
  });

  it('keeps intro text above the buttons', () => {
    const r = GenericParser.parse('Hello\nYou have 2GB left\n1. Buy data\n2. Exit');
    expect(r.components[0]).toMatchObject({ type: 'text' });
  });

  it('does not read an amount like 12.50 as option 12', () => {
    const r = GenericParser.parse('Charge: 12.50 NGN');
    expect(r.type).not.toBe('screen');
  });
});

describe('GenericParser — menus written as sentences', () => {
  it('reads "Press 1 for X, 2 for Y"', () => {
    const r = GenericParser.parse('Welcome. Press 1 for Balance, 2 for Data, 3 for Airtime');
    expect(r.type).toBe('screen');
    expect(r.components.filter((c: any) => c.type === 'button').map((c: any) => [c.input, c.label])).toEqual([
      ['1', 'Balance'], ['2', 'Data'], ['3', 'Airtime'],
    ]);
  });

  it('reads "For X press 1"', () => {
    const r = GenericParser.parse('For Balance press 1, for Data press 2');
    expect(r.components.filter((c: any) => c.type === 'button').map((c: any) => c.input)).toEqual(['1', '2']);
  });
});
