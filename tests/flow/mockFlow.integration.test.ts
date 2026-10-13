import { UssdSessionManager } from '../../src/engine/UssdSessionManager';
import { MockUssdTransport } from '../../src/transport/MockUssdTransport';
import { currentScreenFrom, useUssdStore } from '../../src/state/ussdStore';
import { UssdSessionState } from '../../src/types/ussd';

/**
 * This is the exact walkthrough from the spec's mock-mode section:
 *   *894#  ->  1. Transfer / 2. Airtime / 3. Balance
 *   tap Transfer -> "Enter account number" -> type account
 *   -> "Enter amount" -> type amount
 *   -> confirm screen -> tap Confirm
 *   -> "Transaction successful."
 *
 * It drives the REAL MockUssdTransport through the REAL UssdSessionManager
 * (which itself drives the REAL UssdParser/GenericParser/FlowEngine) — the
 * only thing standing in for anything is the on-device modem itself, which
 * is exactly what "mock integration test" means here.
 */
describe('Mock USSD flow — start → response → button → input → response → next screen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('walks the full Transfer flow to a successful terminal screen', async () => {
    const manager = UssdSessionManager.createForTesting(new MockUssdTransport());

    // 1. Start the session on *894#
    await manager.start('*894#', 0);
    expect(useUssdStore.getState().sessionState).toBe(UssdSessionState.WAITING_FOR_RESPONSE);

    // 2. First scripted response: the menu
    await jest.advanceTimersByTimeAsync(1_000);
    let screen = currentScreenFrom(useUssdStore.getState());
    expect(screen?.type).toBe('screen');
    expect(screen?.components.map((c: any) => c.label)).toEqual(['Transfer', 'Airtime', 'Balance']);
    const transferButton = screen!.components.find((c: any) => c.label === 'Transfer') as any;
    expect(transferButton.input).toBe('1');

    // 3. Tap Transfer -> sends its real input value (not a hardcoded "1")
    await manager.submit(transferButton.input);
    await jest.advanceTimersByTimeAsync(1_000);
    screen = currentScreenFrom(useUssdStore.getState());
    expect(screen?.type).toBe('input');
    expect(screen?.title.toLowerCase()).toContain('account number');
    expect((screen?.components[0] as any).inputType).toBe('numeric');

    // 4. Type the account number
    await manager.submit('0123456789');
    await jest.advanceTimersByTimeAsync(1_000);
    screen = currentScreenFrom(useUssdStore.getState());
    expect(screen?.type).toBe('input');
    expect(screen?.title.toLowerCase()).toContain('amount');

    // 5. Type the amount
    await manager.submit('5000');
    await jest.advanceTimersByTimeAsync(1_000);
    screen = currentScreenFrom(useUssdStore.getState());
    expect(screen?.type).toBe('confirm');
    const confirmComponent = screen!.components[0] as any;
    expect(confirmComponent.confirmLabel.toLowerCase()).toBe('confirm');

    // 6. Tap Confirm -> sends its real input value
    await manager.submit(confirmComponent.confirmInput);
    await jest.advanceTimersByTimeAsync(1_500);

    // 7. Final screen: success, session over
    expect(useUssdStore.getState().sessionState).toBe(UssdSessionState.SUCCESS);
    screen = currentScreenFrom(useUssdStore.getState());
    expect(screen?.type).toBe('terminal');
    expect(screen?.isTerminal).toBe(true);
    expect(screen?.raw.toLowerCase()).toContain('successful');

    // The full session history should have exactly 5 screens: menu, account
    // prompt, amount prompt, confirm, success.
    expect(useUssdStore.getState().history).toHaveLength(5);
  });

  it('falls back to a generic demo script for a code the mock engine does not recognise', async () => {
    const manager = UssdSessionManager.createForTesting(new MockUssdTransport());
    await manager.start('*999#', 0);
    await jest.advanceTimersByTimeAsync(1_000);

    const screen = currentScreenFrom(useUssdStore.getState());
    expect(screen?.type).toBe('screen');
    expect(screen!.components.length).toBeGreaterThan(0);
  });

  it('ends the session cleanly when the user cancels mid-flow', async () => {
    const manager = UssdSessionManager.createForTesting(new MockUssdTransport());
    await manager.start('*894#', 0);
    await jest.advanceTimersByTimeAsync(1_000);

    await manager.cancel();
    expect(useUssdStore.getState().sessionState).toBe(UssdSessionState.CANCELLED);
  });
});
