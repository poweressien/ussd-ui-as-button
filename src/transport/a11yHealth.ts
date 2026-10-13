// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import { NativeModules } from 'react-native';
import { secureLogger } from '../utils/secureLogger';

export type A11yStatus = 'OFF' | 'STALE' | 'CONNECTED' | 'UNAVAILABLE';

/** Raw status from the service itself (Settings switch AND actually running). */
export async function rawStatus(): Promise<A11yStatus> {
  const m = NativeModules.UssdAccessibilityModule;
  try {
    if (m?.getAccessibilityStatus) return (await m.getAccessibilityStatus()) as A11yStatus;
    if (m?.isAccessibilityServiceEnabled) return (await m.isAccessibilityServiceEnabled()) ? 'CONNECTED' : 'OFF';
  } catch {
    // fall through
  }
  return 'UNAVAILABLE';
}

/**
 * Status, healing it first when possible. Android marks the service
 * "malfunctioning" whenever the app's process is killed; if the app was granted
 * WRITE_SECURE_SETTINGS (one-time adb command) it switches the service off/on
 * itself, which is exactly what the person would otherwise do by hand.
 */
export async function statusWithRepair(): Promise<A11yStatus> {
  const st = await rawStatus();
  if (st !== 'STALE') return st;
  const m = NativeModules.UssdAccessibilityModule;
  if (!m?.repairService) return st;
  try {
    const r = (await m.repairService()) as string;
    secureLogger.info('a11yHealth', `repairService -> ${r}`);
    return r === 'CONNECTED' ? 'CONNECTED' : 'STALE';
  } catch {
    return 'STALE';
  }
}
