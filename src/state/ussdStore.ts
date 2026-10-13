// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import { create } from 'zustand';
import { ScreenMessage, UssdError, UssdSessionState } from '../types/ussd';

/**
 * ussdStore
 * ---------
 * The single source of truth the UI reads from during a session. Nothing
 * in here talks to a transport directly — UssdSessionManager is the only
 * writer. Components only ever call the actions exposed by
 * UssdSessionManager (which update this store internally) or read from it.
 */
export interface UssdStoreState {
  sessionState: UssdSessionState;
  code: string;
  stepIndex: number;
  history: ScreenMessage[];
  lastError?: UssdError;
  transportMode: 'REAL' | 'DEMO';

  // --- internal setters, called only by UssdSessionManager ---
  _reset: (code: string, transportMode: 'REAL' | 'DEMO') => void;
  _setSessionState: (s: UssdSessionState) => void;
  _pushScreen: (screen: ScreenMessage, stepIndex: number) => void;
  _popScreen: (stepIndex: number) => void;
  _setError: (error: UssdError | undefined) => void;
}

export const useUssdStore = create<UssdStoreState>((set) => ({
  sessionState: UssdSessionState.IDLE,
  code: '',
  stepIndex: 0,
  history: [],
  lastError: undefined,
  transportMode: 'DEMO',

  _reset: (code, transportMode) =>
    set({
      sessionState: UssdSessionState.STARTING,
      code,
      stepIndex: 0,
      history: [],
      lastError: undefined,
      transportMode,
    }),

  _setSessionState: (sessionState) => set({ sessionState }),

  _pushScreen: (screen, stepIndex) =>
    set((state) => ({ history: [...state.history, screen], stepIndex })),

  _popScreen: (stepIndex) =>
    set((state) => ({
      history: state.history.length > 1 ? state.history.slice(0, -1) : state.history,
      stepIndex,
    })),

  _setError: (lastError) => set({ lastError }),
}));

export function currentScreenFrom(state: UssdStoreState): ScreenMessage | undefined {
  return state.history[state.history.length - 1];
}
