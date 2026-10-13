import { GenericParser } from '../../src/engine/GenericParser';

describe('GenericParser — malformed responses', () => {
  it('never throws, even on an empty string', () => {
    expect(() => GenericParser.parse('')).not.toThrow();
  });

  it('returns an error ScreenMessage for an empty response', () => {
    const result = GenericParser.parse('');
    expect(result.isError).toBe(true);
    expect(result.components).toHaveLength(1);
  });

  it('handles a response that is only whitespace the same as empty', () => {
    const result = GenericParser.parse('   \n\n   ');
    expect(result.isError).toBe(true);
  });

  it('never throws on null/undefined-ish input coerced to a string', () => {
    // The transport layer always hands us a string, but a native bridge on
    // an unusual device could still hand back something unexpected — the
    // parser should degrade gracefully rather than crash the session.
    expect(() => GenericParser.parse(undefined as unknown as string)).not.toThrow();
  });

  it('does not crash on unrecognisable noise text and preserves it as raw', () => {
    const raw = '##??!! \u0000 unexpected-binary-ish-noise @@@';
    const result = GenericParser.parse(raw);
    expect(() => result).not.toThrow();
    expect(result.raw).toBe(raw);
    expect(result.type).toBe('input'); // falls back to a free-text prompt rather than erroring
  });

  it('handles Windows-style CRLF line endings the same as LF', () => {
    const result = GenericParser.parse('Welcome\r\n1. Transfer\r\n2. Airtime\r\n');
    expect(result.type).toBe('screen');
    expect(result.components).toHaveLength(2);
  });

  it('handles a single stray digit with no menu structure as an input prompt, not a menu', () => {
    const result = GenericParser.parse('5');
    expect(result.type).not.toBe('screen');
  });

  it('handles duplicate option numbers without throwing (keeps both, last one wins on send)', () => {
    const result = GenericParser.parse('1. Transfer\n1. Airtime');
    expect(() => result).not.toThrow();
    expect(result.components).toHaveLength(2);
  });

  it('handles an extremely long response without throwing', () => {
    const raw = Array.from({ length: 500 }, (_, i) => `${(i % 9) + 1}. Option ${i}`).join('\n');
    expect(() => GenericParser.parse(raw)).not.toThrow();
  });
});
