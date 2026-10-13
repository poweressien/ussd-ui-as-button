// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import { useEffect, useRef } from 'react';
import { AppState, NativeEventEmitter, NativeModules } from 'react-native';
import { useNavigation } from '../navigation/RootNavigator';
import { useSettingsStore } from '../state/settingsStore';
import { useUssdStore } from '../state/ussdStore';
import { UssdSessionManager } from '../engine/UssdSessionManager';
import { configureFromSettings } from '../engine/configureFromSettings';
import { UssdSessionState } from '../types/ussd';

const ACTIVE = new Set<UssdSessionState>([
  UssdSessionState.STARTING,
  UssdSessionState.WAITING_FOR_RESPONSE,
  UssdSessionState.DISPLAYING_SCREEN,
  UssdSessionState.SENDING_INPUT,
]);

/**
 * Invisible. Makes "dial from the regular Phone app" work: when the phone shows a USSD
 * pop-up that this app did not start, take it over and show it as buttons.
 * Runs only when the person agreed to Accessibility AND left "Catch codes from the Phone app" on.
 */
export function PassiveCapture(): null {
  const nav = useNavigation();
  const routeRef = useRef(nav.route);
  routeRef.current = nav.route;
  const navigateRef = useRef(nav.navigate);
  navigateRef.current = nav.navigate;

  const consent = useSettingsStore((s) => s.a11yConsent);
  const capture = useSettingsStore((s) => s.captureFromDialer);
  const transportMode = useSettingsStore((s) => s.transportMode);
  const enabled = consent === true && capture && transportMode !== 'DEMO';
  const busy = useRef(false);

  // Tell the native service (it remembers this even when the app is closed).
  useEffect(() => {
    void NativeModules.UssdAccessibilityModule?.setPassiveCapture?.(enabled);
  }, [enabled]);

  useEffect(() => {
    const mod = NativeModules.UssdAccessibilityModule;
    if (!enabled || !mod) return undefined;

    const adopt = async () => {
      if (busy.current) return;
      if (ACTIVE.has(useUssdStore.getState().sessionState)) return; // a session of ours is already running
      busy.current = true;
      try {
        configureFromSettings();
        if (routeRef.current !== 'Session') navigateRef.current('Session');
        await UssdSessionManager.get().adopt(useSettingsStore.getState().selectedSimSlot);
      } finally {
        setTimeout(() => {
          busy.current = false;
        }, 1500);
      }
    };

    const checkPending = async () => {
      try {
        if (await mod.consumePendingAdopt?.()) await adopt();
      } catch {
        // best effort
      }
    };

    const emitter = new NativeEventEmitter(mod);
    const sub = emitter.addListener('UssdA11y:onDialogText', () => void adopt());
    void checkPending();
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') void checkPending();
    });
    return () => {
      sub.remove();
      app.remove();
    };
  }, [enabled]);

  return null;
}
