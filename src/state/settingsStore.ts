// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { TransportMode, UssdChannel } from '../types/ussd';
import { addCustomCode, QuickCode, removeCustomCode } from '../data/quickCodes';

const STORAGE_KEY = 'ussdui:settings:v1';

export interface SettingsState {
  transportMode: TransportMode;
  selectedSimSlot: number;
  developerMode: boolean;
  /** Hidden: unlocked by tapping the version line in Settings 7 times. Normal users never see developer tools. */
  devUnlocked: boolean;
  setDevUnlocked: (on: boolean) => void;
  /** Persist raw USSD responses in the debug log — off by default (spec section 15). */
  persistRawResponses: boolean;
  /** Off by default — see NativeUssdTransport's file header before enabling. */
  experimentalContinuation: boolean;
  /** Last real channel that produced a response on this device (AUTO mode). */
  lastWorkingChannel: UssdChannel | null;
  lastWorkingChannelAt: number;
  /** Draw real buttons over the phone's USSD dialog (accessibility channel). */
  showOverlay: boolean;
  /** Codes the person saved themselves. */
  customCodes: QuickCode[];
  /** Play Store prominent disclosure: null = not asked yet, true = agreed, false = declined. */
  a11yConsent: boolean | null;
  /** Pick up USSD pop-ups dialled from the regular Phone app and show them as buttons. */
  captureFromDialer: boolean;
  setCaptureFromDialer: (on: boolean) => void;
  /** True once saved settings have been read (so first-run screens don't flash). */
  hydrated: boolean;
  setA11yConsent: (v: boolean) => void;

  addCustomCode: (code: string, label?: string) => void;
  removeCustomCode: (code: string) => void;
  setTransportMode: (mode: TransportMode) => void;
  setSelectedSimSlot: (slot: number) => void;
  setDeveloperMode: (on: boolean) => void;
  setPersistRawResponses: (on: boolean) => void;
  setExperimentalContinuation: (on: boolean) => void;
  setLastWorkingChannel: (channel: UssdChannel | null) => void;
  setShowOverlay: (on: boolean) => void;
  hydrate: () => Promise<void>;
}

async function persist(state: Partial<SettingsState>): Promise<void> {
  try {
    const current = await AsyncStorage.getItem(STORAGE_KEY);
    const merged = { ...(current ? JSON.parse(current) : {}), ...state };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // Settings failing to persist should never block the UI from working.
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  transportMode: 'AUTO',
  selectedSimSlot: 0,
  a11yConsent: null,
  captureFromDialer: true,
  setCaptureFromDialer: (captureFromDialer) => {
    set({ captureFromDialer });
    void persist({ captureFromDialer });
  },
  hydrated: false,
  setA11yConsent: (a11yConsent) => {
    set({ a11yConsent });
    void persist({ a11yConsent });
  },
  developerMode: false,
  devUnlocked: false,
  setDevUnlocked: (devUnlocked) => {
    // Locking again also switches the debug panel off.
    set(devUnlocked ? { devUnlocked } : { devUnlocked, developerMode: false });
    void persist(devUnlocked ? { devUnlocked } : { devUnlocked, developerMode: false });
  },
  persistRawResponses: false,
  experimentalContinuation: false,
  lastWorkingChannel: null,
  lastWorkingChannelAt: 0,
  showOverlay: true,
  customCodes: [],

  addCustomCode: (code, label) => {
    set((st) => {
      const customCodes = addCustomCode(st.customCodes, code, label);
      void persist({ customCodes });
      return { customCodes };
    });
  },
  removeCustomCode: (code) => {
    set((st) => {
      const customCodes = removeCustomCode(st.customCodes, code);
      void persist({ customCodes });
      return { customCodes };
    });
  },

  setTransportMode: (transportMode) => {
    set({ transportMode });
    void persist({ transportMode });
  },
  setSelectedSimSlot: (selectedSimSlot) => {
    set({ selectedSimSlot });
    void persist({ selectedSimSlot });
  },
  setDeveloperMode: (developerMode) => {
    set({ developerMode });
    void persist({ developerMode });
  },
  setPersistRawResponses: (persistRawResponses) => {
    set({ persistRawResponses });
    void persist({ persistRawResponses });
  },
  setExperimentalContinuation: (experimentalContinuation) => {
    set({ experimentalContinuation });
    void persist({ experimentalContinuation });
  },

  setLastWorkingChannel: (lastWorkingChannel) => {
    const lastWorkingChannelAt = Date.now();
    set({ lastWorkingChannel, lastWorkingChannelAt });
    void persist({ lastWorkingChannel, lastWorkingChannelAt });
  },

  setShowOverlay: (showOverlay) => {
    set({ showOverlay });
    void persist({ showOverlay });
  },

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) set(JSON.parse(raw));
    } catch {
      // Fall back to defaults already set above.
    } finally {
      set({ hydrated: true });
    }
  },
}));
