// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import { ScreenMessage, UssdError, UssdSessionState } from '../types/ussd';
import { UssdParser } from './UssdParser';

/**
 * FlowEngine
 * ----------
 * Pure reducer for a single USSD session. Every function here takes a
 * FlowState and returns a new one — no transport calls, no storage, no
 * React. UssdSessionManager is the only thing that calls these functions
 * and is responsible for the side effects (talking to the transport,
 * writing into the Zustand store). Keeping this pure is what makes
 * "start -> response -> button -> input -> response -> next screen" testable
 * as plain data in tests/flow/mockFlow.integration.test.ts without needing
 * a real or mock transport at all.
 */

export interface FlowState {
  sessionState: UssdSessionState;
  code: string;
  carrierId?: string;
  simSlot?: number;
  stepIndex: number;
  /** Every screen seen so far, oldest first. history[history.length - 1] is current. */
  history: ScreenMessage[];
  lastError?: UssdError;
}

export function createInitialState(code: string, carrierId?: string, simSlot?: number): FlowState {
  return {
    sessionState: UssdSessionState.STARTING,
    code,
    carrierId,
    simSlot,
    stepIndex: 0,
    history: [],
  };
}

export function currentScreen(state: FlowState): ScreenMessage | undefined {
  return state.history[state.history.length - 1];
}

/** A raw response arrived from the transport (real or mock) — parse and advance. */
export function onResponse(state: FlowState, raw: string): FlowState {
  const screen = UssdParser.parse(raw, {
    carrierId: state.carrierId,
    serviceCode: state.code,
    stepIndex: state.stepIndex,
  });

  const nextSessionState = screen.isTerminal
    ? screen.isError
      ? UssdSessionState.FAILED
      : UssdSessionState.SUCCESS
    : UssdSessionState.DISPLAYING_SCREEN;

  return {
    ...state,
    sessionState: nextSessionState,
    history: [...state.history, screen],
  };
}

/** The user tapped a button / submitted a field — about to call transport.sendInput(). */
export function onInputSubmit(state: FlowState): FlowState {
  return {
    ...state,
    sessionState: UssdSessionState.SENDING_INPUT,
    stepIndex: state.stepIndex + 1,
  };
}

/** The transport (or the platform) reported an error. */
export function onTransportError(state: FlowState, error: UssdError): FlowState {
  const sessionState =
    error.code === 'TIMEOUT'
      ? UssdSessionState.TIMEOUT
      : error.code === 'CANCELLED'
      ? UssdSessionState.CANCELLED
      : error.code === 'UNSUPPORTED_CONTINUATION'
      ? UssdSessionState.UNSUPPORTED
      : UssdSessionState.FAILED;

  return { ...state, sessionState, lastError: error };
}

/** The user cancelled from the UI (before any transport-level error occurred). */
export function onCancel(state: FlowState): FlowState {
  return { ...state, sessionState: UssdSessionState.CANCELLED };
}

/**
 * Step back to the previous screen. Note this only rewinds the *local*
 * history/UI — it cannot rewind an already-open USSD dialog on the network,
 * since the public API has no concept of "undo." Going back and re-sending
 * a different option restarts the session on the real transport (see
 * NativeUssdTransport and docs/ANDROID-USSD-LIMITATIONS.md).
 */
export function goBack(state: FlowState): FlowState {
  if (state.history.length <= 1) return state;
  return {
    ...state,
    history: state.history.slice(0, -1),
    stepIndex: Math.max(0, state.stepIndex - 1),
    sessionState: UssdSessionState.DISPLAYING_SCREEN,
  };
}

export function isSessionOver(state: FlowState): boolean {
  return [
    UssdSessionState.SUCCESS,
    UssdSessionState.FAILED,
    UssdSessionState.TIMEOUT,
    UssdSessionState.CANCELLED,
    UssdSessionState.UNSUPPORTED,
  ].includes(state.sessionState);
}
