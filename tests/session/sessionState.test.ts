import {
  createInitialState,
  currentScreen,
  goBack,
  isSessionOver,
  onCancel,
  onInputSubmit,
  onResponse,
  onTransportError,
} from '../../src/engine/FlowEngine';
import { UssdSessionState } from '../../src/types/ussd';

describe('FlowEngine — session state transitions', () => {
  it('starts in STARTING with empty history', () => {
    const state = createInitialState('*894#');
    expect(state.sessionState).toBe(UssdSessionState.STARTING);
    expect(state.history).toHaveLength(0);
    expect(state.stepIndex).toBe(0);
  });

  it('moves to DISPLAYING_SCREEN on a non-terminal response and records it in history', () => {
    let state = createInitialState('*894#');
    state = onResponse(state, '1. Transfer\n2. Airtime');
    expect(state.sessionState).toBe(UssdSessionState.DISPLAYING_SCREEN);
    expect(state.history).toHaveLength(1);
    expect(currentScreen(state)?.type).toBe('screen');
  });

  it('moves to SENDING_INPUT and increments stepIndex when the user submits input', () => {
    let state = createInitialState('*894#');
    state = onResponse(state, '1. Transfer\n2. Airtime');
    state = onInputSubmit(state);
    expect(state.sessionState).toBe(UssdSessionState.SENDING_INPUT);
    expect(state.stepIndex).toBe(1);
  });

  it('moves to SUCCESS when a terminal, non-error response arrives', () => {
    let state = createInitialState('*894#');
    state = onResponse(state, 'Transaction successful.');
    expect(state.sessionState).toBe(UssdSessionState.SUCCESS);
    expect(isSessionOver(state)).toBe(true);
  });

  it('moves to FAILED when a terminal error response arrives', () => {
    let state = createInitialState('*894#');
    state = onResponse(state, 'Invalid PIN. Transaction failed.');
    expect(state.sessionState).toBe(UssdSessionState.FAILED);
    expect(isSessionOver(state)).toBe(true);
  });

  it('moves to TIMEOUT on a TIMEOUT transport error', () => {
    let state = createInitialState('*894#');
    state = onTransportError(state, { code: 'TIMEOUT', message: 'no response' });
    expect(state.sessionState).toBe(UssdSessionState.TIMEOUT);
    expect(state.lastError?.code).toBe('TIMEOUT');
  });

  it('moves to UNSUPPORTED on an UNSUPPORTED_CONTINUATION transport error', () => {
    let state = createInitialState('*894#');
    state = onTransportError(state, { code: 'UNSUPPORTED_CONTINUATION', message: 'not supported' });
    expect(state.sessionState).toBe(UssdSessionState.UNSUPPORTED);
  });

  it('moves to FAILED for any other transport error code', () => {
    let state = createInitialState('*894#');
    state = onTransportError(state, { code: 'USSD_ERROR_SERVICE_UNAVAIL', message: 'no service' });
    expect(state.sessionState).toBe(UssdSessionState.FAILED);
  });

  it('moves to CANCELLED when the user cancels', () => {
    let state = createInitialState('*894#');
    state = onCancel(state);
    expect(state.sessionState).toBe(UssdSessionState.CANCELLED);
    expect(isSessionOver(state)).toBe(true);
  });

  it('goBack pops the last screen and decrements stepIndex', () => {
    let state = createInitialState('*894#');
    state = onResponse(state, 'Welcome\n1. Transfer\n2. Airtime');
    const firstScreen = currentScreen(state);

    state = onInputSubmit(state);
    state = onResponse(state, 'Enter account number');
    expect(state.history).toHaveLength(2);

    state = goBack(state);
    expect(state.history).toHaveLength(1);
    expect(state.stepIndex).toBe(0);
    expect(currentScreen(state)).toEqual(firstScreen);
  });

  it('goBack is a no-op on the first screen (nothing to go back to)', () => {
    let state = createInitialState('*894#');
    state = onResponse(state, '1. Transfer\n2. Airtime');
    const before = state;
    state = goBack(state);
    expect(state.history).toHaveLength(1);
    expect(state).toEqual(before);
  });

  it('isSessionOver is false for every non-terminal state', () => {
    let state = createInitialState('*894#');
    expect(isSessionOver(state)).toBe(false);
    state = onResponse(state, '1. Transfer');
    expect(isSessionOver(state)).toBe(false);
    state = onInputSubmit(state);
    expect(isSessionOver(state)).toBe(false);
  });
});
