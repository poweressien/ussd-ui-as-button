// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import { NativeEventEmitter, NativeModules } from 'react-native';
import { UssdError, UssdTransportEvents } from '../types/ussd';
import { secureLogger } from '../utils/secureLogger';
import { UssdTransport } from './UssdTransport';

/**
 * NativeUssdTransport
 * --------------------
 * Talks to the Kotlin native module (android/.../UssdModule.kt) through
 * React Native's bridge. This file does no telephony work itself — it only
 * forwards calls down and native events back up, translating both into the
 * shapes the rest of the app already understands (UssdTransport, UssdError).
 *
 * READ THIS BEFORE WIRING UP sendInput() TO A "SEQUENTIAL FLOW":
 * Android's public TelephonyManager.sendUssdRequest() is a single
 * dial-and-response call. There is no supported public API for replying
 * into an already-open USSD dialog on most devices — see
 * docs/ANDROID-USSD-LIMITATIONS.md, which is written from Android's own
 * UssdResponseCallback docs plus real-world reports of exactly this
 * limitation. By default this transport does NOT pretend otherwise: calling
 * sendInput() reports a clear UNSUPPORTED_CONTINUATION error rather than
 * silently failing or faking a response. An explicit, off-by-default
 * "experimental re-dial" mode (see settingsStore) will attempt a best-effort
 * follow-up dial instead, with no guarantee it matches what the carrier
 * expects.
 */

const { UssdModule } = NativeModules;

const EVENT_RESPONSE = 'UssdUI:onResponse';
const EVENT_ERROR = 'UssdUI:onError';
const EVENT_SESSION_ENDED = 'UssdUI:onSessionEnded';

interface NativeErrorPayload {
  code: string;
  message: string;
  raw?: string;
}

function toUssdError(payload: NativeErrorPayload): UssdError {
  const known: UssdError['code'][] = [
    'USSD_RETURN_FAILURE',
    'USSD_ERROR_SERVICE_UNAVAIL',
    'SESSION_ALREADY_ACTIVE',
    'PERMISSION_DENIED',
    'NO_TELEPHONY',
    'TIMEOUT',
    'CANCELLED',
    'UNSUPPORTED_CONTINUATION',
    'MALFORMED_RESPONSE',
  ];
  const code = (known as string[]).includes(payload.code) ? (payload.code as UssdError['code']) : 'UNKNOWN';
  return { code, message: payload.message, raw: payload.raw };
}

export class NativeUssdTransport implements UssdTransport {
  readonly mode = 'REAL' as const;

  private events: UssdTransportEvents | null = null;
  private emitter: NativeEventEmitter | null = null;
  private subscriptions: { remove: () => void }[] = [];

  constructor(private readonly experimentalContinuation: boolean = false) {
    if (!UssdModule) {
      secureLogger.warn(
        'NativeUssdTransport',
        'UssdModule native module not found — running on an unsupported platform, or the native build has not linked it.'
      );
      return;
    }
    this.emitter = new NativeEventEmitter(UssdModule);
  }

  setListeners(events: UssdTransportEvents): void {
    this.events = events;
    this.detachSubscriptions();
    if (!this.emitter) return;

    this.subscriptions = [
      this.emitter.addListener(EVENT_RESPONSE, (raw: unknown) => {
        this.events?.onResponse(raw as string);
      }),
      this.emitter.addListener(EVENT_ERROR, (payload: unknown) => {
        this.events?.onError(toUssdError(payload as NativeErrorPayload));
      }),
      this.emitter.addListener(EVENT_SESSION_ENDED, () => {
        this.events?.onSessionEnded();
      }),
    ];
  }

  async start(code: string, simSlot?: number): Promise<void> {
    if (!UssdModule) {
      this.events?.onError({
        code: 'NO_TELEPHONY',
        message: 'USSD native module is unavailable on this build/platform.',
      });
      return;
    }
    try {
      await UssdModule.startUssdSession(code, simSlot ?? 0);
    } catch (e) {
      this.events?.onError(this.fromRejection(e));
    }
  }

  async sendInput(input: string): Promise<void> {
    if (!UssdModule) return;

    if (!this.experimentalContinuation) {
      // Honest default: don't touch the telephony API a second time and
      // claim it "worked." See the file header and docs/ANDROID-USSD-LIMITATIONS.md.
      this.events?.onError({
        code: 'UNSUPPORTED_CONTINUATION',
        message:
          'Replying into an open USSD session is not supported by the public Android API on most devices. ' +
          'Enable "Experimental re-dial" in Settings to try a best-effort follow-up dial instead (not guaranteed to work).',
      });
      return;
    }

    try {
      await UssdModule.sendUssdInput(input);
    } catch (e) {
      this.events?.onError(this.fromRejection(e));
    }
  }

  async cancel(): Promise<void> {
    if (!UssdModule) return;
    try {
      await UssdModule.cancelUssdSession();
    } catch {
      secureLogger.warn('NativeUssdTransport', 'cancelUssdSession rejected — session was likely already over.');
    } finally {
      this.detachSubscriptions();
    }
  }

  private fromRejection(e: unknown): UssdError {
    const err = e as { code?: string; message?: string } | undefined;
    return toUssdError({
      code: err?.code ?? 'UNKNOWN',
      message: err?.message ?? 'Unknown native USSD error.',
    });
  }

  dispose(): void {
    this.events = null;
    this.detachSubscriptions();
  }

  private detachSubscriptions(): void {
    this.subscriptions.forEach((s) => s.remove());
    this.subscriptions = [];
  }
}
