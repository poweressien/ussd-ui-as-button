import { addCustomCode, appendKey, backspace, BUILTIN_CATEGORIES, isDialable, removeCustomCode } from '../../src/data/quickCodes';

describe('dial pad + quick codes', () => {
  it('builds and edits the number', () => {
    let b = '';
    for (const k of '*123#') b = appendKey(b, k);
    expect(b).toBe('*123#');
    expect(backspace(b)).toBe('*123');
    expect(appendKey(b, 'x')).toBe(b);
  });
  it('only dials real USSD strings', () => {
    expect(isDialable('*123#')).toBe(true);
    expect(isDialable('*13a#')).toBe(false);
    expect(isDialable('1')).toBe(false);
  });
  it('custom codes: add once, remove', () => {
    let l = addCustomCode([], '*310#', 'My code');
    l = addCustomCode(l, '*310#');
    expect(l).toEqual([{ code: '*310#', label: 'My code' }]);
    expect(addCustomCode(l, 'abc')).toEqual(l);
    expect(removeCustomCode(l, '*310#')).toEqual([]);
  });
  it('every built-in code is dialable', () => {
    for (const c of BUILTIN_CATEGORIES) for (const q of c.codes) expect(isDialable(q.code)).toBe(true);
  });
  it('has every Nigerian network with the current unified codes', () => {
    const ids = BUILTIN_CATEGORIES.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['banks', 'mtn', 'airtel', 'glo', 't2']));
    for (const id of ['mtn', 'airtel', 'glo', 't2'] as const) {
      const codes = BUILTIN_CATEGORIES.find((c) => c.id === id)!.codes.map((q) => q.code);
      expect(codes.length).toBeGreaterThanOrEqual(4);
      for (const c of ['*310#', '*323#', '*312#', '*303#']) expect(codes).toContain(c);
    }
  });
  it('no duplicate codes inside a category', () => {
    for (const c of BUILTIN_CATEGORIES) {
      const codes = c.codes.map((q) => q.code);
      expect(new Set(codes).size).toBe(codes.length);
    }
  });
});
