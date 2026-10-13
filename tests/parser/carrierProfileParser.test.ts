import { GenericParser } from '../../src/engine/GenericParser';
import { CarrierProfileParser, ServiceProfileParser } from '../../src/engine/ParserPlugin';
import { UssdParser } from '../../src/engine/UssdParser';

describe('CarrierProfileParser / ServiceProfileParser override chain', () => {
  beforeEach(() => {
    UssdParser.clearPlugins();
  });

  it('lets a carrier profile override the parsed title for text it recognises', () => {
    UssdParser.register(
      new CarrierProfileParser(
        'carrier:test-ng',
        'test-ng',
        [
          {
            match: /SPECIAL_MENU_MARKER/,
            label: 'test override',
            build: (_raw, fallback) => ({ ...fallback, title: 'Overridden by carrier profile', parsedBy: 'test-ng' }),
          },
        ],
        GenericParser.parse
      )
    );

    const result = UssdParser.parse('SPECIAL_MENU_MARKER\n1. A\n2. B', { carrierId: 'test-ng', stepIndex: 0 });
    expect(result.title).toBe('Overridden by carrier profile');
    expect(result.parsedBy).toBe('test-ng');
  });

  it('falls through to GenericParser when the carrier profile has no rule for this text', () => {
    UssdParser.register(
      new CarrierProfileParser(
        'carrier:test-ng',
        'test-ng',
        [{ match: /NEVER_MATCHES_ANYTHING/, label: 'x', build: (_r, f) => f }],
        GenericParser.parse
      )
    );

    const result = UssdParser.parse('1. Transfer\n2. Airtime', { carrierId: 'test-ng', stepIndex: 0 });
    expect(result.parsedBy).toBe('generic');
    expect(result.components).toHaveLength(2);
  });

  it('ignores a carrier profile registered for a different carrier than the active session', () => {
    UssdParser.register(
      new CarrierProfileParser(
        'carrier:other-ng',
        'other-ng',
        [{ match: /.*/, label: 'x', build: (_r, f) => ({ ...f, title: 'SHOULD NOT APPEAR' }) }],
        GenericParser.parse
      )
    );

    const result = UssdParser.parse('1. Transfer', { carrierId: 'test-ng', stepIndex: 0 });
    expect(result.title).not.toBe('SHOULD NOT APPEAR');
  });

  it('lets a ServiceProfileParser (carrier + specific USSD code) take precedence over a CarrierProfileParser', () => {
    // Registration order is what decides precedence: UssdParser tries
    // plugins in the order they were registered. A project wiring up its
    // own service-specific overrides should register those before the
    // carrier-wide profile so the more specific rule wins, which is what
    // this test proves.
    UssdParser.register(
      new ServiceProfileParser(
        'service:test-ng:*894#',
        'test-ng',
        '*894#',
        [{ match: /Welcome/, label: 'service-level', build: (_r, f) => ({ ...f, title: 'Service-level title' }) }],
        GenericParser.parse
      )
    );
    UssdParser.register(
      new CarrierProfileParser(
        'carrier:test-ng',
        'test-ng',
        [{ match: /Welcome/, label: 'carrier-level', build: (_r, f) => ({ ...f, title: 'Carrier-level title' }) }],
        GenericParser.parse
      )
    );

    const result = UssdParser.parse('Welcome\n1. A', {
      carrierId: 'test-ng',
      serviceCode: '*894#',
      stepIndex: 0,
    });
    expect(result.title).toBe('Service-level title');
  });

  it('scopes a step-specific rule to only the step it was written for', () => {
    UssdParser.register(
      new CarrierProfileParser(
        'carrier:test-ng',
        'test-ng',
        [{ atStep: 2, match: /Enter/, label: 'step-2-only', build: (_r, f) => ({ ...f, title: 'Step 2 override' }) }],
        GenericParser.parse
      )
    );

    const atWrongStep = UssdParser.parse('Enter amount', { carrierId: 'test-ng', stepIndex: 1 });
    const atRightStep = UssdParser.parse('Enter amount', { carrierId: 'test-ng', stepIndex: 2 });

    expect(atWrongStep.title).not.toBe('Step 2 override');
    expect(atRightStep.title).toBe('Step 2 override');
  });
});
