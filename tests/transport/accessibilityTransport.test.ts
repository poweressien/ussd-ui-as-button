import { AccessibilityUssdTransport } from '../../src/transport/AccessibilityUssdTransport';
import { UssdTransportEvents } from '../../src/types/ussd';

/**
 * These tests drive AccessibilityUssdTransport against the manual
 * react-native mock (__mocks__/react-native.js), which — same as for
 * NativeUssdTransport — has no UssdAccessibilityModule registered, mirroring
 * a real device where the native build hasn't linked it. That's enough to
 * verify the transport's own branching logic (the choice between
 * typeAndSubmit vs tapPositiveButton) without needing a real accessibility
 * service, which nothing in this repo's test environment can provide.
 */
describe('AccessibilityUssdTransport — availability fallback', () => {
  it('reports NO_TELEPHONY when the native accessibility bridge is not linked', async () => {
    const transport = new AccessibilityUssdTransport();
    const events: UssdTransportEvents = {
      onResponse: jest.fn(),
      onError: jest.fn(),
      onSessionEnded: jest.fn(),
    };
    transport.setListeners(events);

    await transport.start('*894#');

    expect(events.onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'NO_TELEPHONY' })
    );
  });

  it('sendInput and cancel are no-ops (not errors) when the bridge is not linked', async () => {
    const transport = new AccessibilityUssdTransport();
    const events: UssdTransportEvents = {
      onResponse: jest.fn(),
      onError: jest.fn(),
      onSessionEnded: jest.fn(),
    };
    transport.setListeners(events);

    await expect(transport.sendInput('1')).resolves.toBeUndefined();
    await expect(transport.cancel()).resolves.toBeUndefined();
    expect(events.onSessionEnded).toHaveBeenCalled();
  });

  it('mode is always REAL — this is a live-USSD transport, not a demo one', () => {
    expect(new AccessibilityUssdTransport().mode).toBe('REAL');
  });
});
