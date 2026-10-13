import { UssdSessionManager } from '../../src/engine/UssdSessionManager';
import { useUssdStore } from '../../src/state/ussdStore';
import { UssdSessionState, UssdTransportEvents } from '../../src/types/ussd';
import { UssdTransport } from '../../src/transport/UssdTransport';

/** A transport that accepts calls but never emits a response — the only way to prove the 30s timeout actually fires. */
class NeverRespondingTransport implements UssdTransport {
  readonly mode = 'REAL' as const;
  setListeners(_events: UssdTransportEvents): void {}
  async start(): Promise<void> {}
  async sendInput(): Promise<void> {}
  async cancel(): Promise<void> {}
}

describe('UssdSessionManager — timeout handling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('moves the session to TIMEOUT after 30s with no response', async () => {
    const manager = UssdSessionManager.createForTesting(new NeverRespondingTransport());

    await manager.start('*123#', 0);
    expect(useUssdStore.getState().sessionState).toBe(UssdSessionState.WAITING_FOR_RESPONSE);

    jest.advanceTimersByTime(30_000);

    expect(useUssdStore.getState().sessionState).toBe(UssdSessionState.TIMEOUT);
    expect(useUssdStore.getState().lastError?.code).toBe('TIMEOUT');
  });

  it('does not time out if a response arrives first', async () => {
    class RespondsQuicklyTransport implements UssdTransport {
      readonly mode = 'REAL' as const;
      private events: UssdTransportEvents | null = null;
      setListeners(events: UssdTransportEvents): void {
        this.events = events;
      }
      async start(): Promise<void> {
        setTimeout(() => this.events?.onResponse('1. Transfer\n2. Airtime'), 5_000);
      }
      async sendInput(): Promise<void> {}
      async cancel(): Promise<void> {}
    }

    const manager = UssdSessionManager.createForTesting(new RespondsQuicklyTransport());
    await manager.start('*123#', 0);

    jest.advanceTimersByTime(5_000);
    expect(useUssdStore.getState().sessionState).toBe(UssdSessionState.DISPLAYING_SCREEN);

    // The timeout timer from the original request should have been cleared
    // by the response — advancing well past 30s total must not flip it back.
    jest.advanceTimersByTime(30_000);
    expect(useUssdStore.getState().sessionState).toBe(UssdSessionState.DISPLAYING_SCREEN);
  });

  it('arms a fresh timeout for each sendInput() call', async () => {
    class RespondsThenHangsTransport implements UssdTransport {
      readonly mode = 'REAL' as const;
      private events: UssdTransportEvents | null = null;
      setListeners(events: UssdTransportEvents): void {
        this.events = events;
      }
      async start(): Promise<void> {
        this.events?.onResponse('1. Transfer\n2. Airtime');
      }
      async sendInput(): Promise<void> {
        // never responds to the follow-up input
      }
      async cancel(): Promise<void> {}
    }

    const manager = UssdSessionManager.createForTesting(new RespondsThenHangsTransport());
    await manager.start('*123#', 0);
    expect(useUssdStore.getState().sessionState).toBe(UssdSessionState.DISPLAYING_SCREEN);

    await manager.submit('1');
    expect(useUssdStore.getState().sessionState).toBe(UssdSessionState.WAITING_FOR_RESPONSE);

    jest.advanceTimersByTime(30_000);
    expect(useUssdStore.getState().sessionState).toBe(UssdSessionState.TIMEOUT);
  });
});
