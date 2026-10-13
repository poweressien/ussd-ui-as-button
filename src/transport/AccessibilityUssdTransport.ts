// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import { NativeEventEmitter, NativeModules } from 'react-native';
import { OverlayAction, ScreenMessage, UssdError, UssdTransportEvents } from '../types/ussd';
import { screenToOverlayPayload } from './overlayPayload';
import { secureLogger } from '../utils/secureLogger';
import { UssdTransport } from './UssdTransport';
import { statusWithRepair } from './a11yHealth';

const { UssdAccessibilityModule } = NativeModules;

const EVENT_DIALOG_TEXT = 'UssdA11y:onDialogText';
const EVENT_OVERLAY_ACTION = 'UssdA11y:onOverlayAction';

/** How long to poll for a dialog the service never announced. */
const START_POLL_MS = 15_000;
const REPLY_POLL_MS = 12_000;
const POLL_INTERVAL_MS = 600;

export const STALE_ERROR: UssdError = {
  code: 'ACCESSIBILITY_STALE',
  message:
    'USSD-UI Accessibility is switched on but Android is not running it (this happens after every app update or reinstall). ' +
    'Open Accessibility settings, switch USSD-UI OFF and ON again, then dial again. Nothing was dialled.',
};
export const OFF_ERROR: UssdError = {
  code: 'ACCESSIBILITY_NOT_ENABLED',
  message:
    "Accessibility Mode's permission isn't turned on yet. Open Settings → Accessibility Mode to enable it, then try again.",
};

interface DialogTextPayload {
  message: string;
  hasInputField: boolean;
  buttonLabels: string[];
}

/**
 * AccessibilityUssdTransport
 * ---------------------------
 * Drives the SYSTEM's own USSD dialog (via UssdAccessibilityService and an
 * ACTION_CALL / ACTION_DIAL intent) instead of calling
 * TelephonyManager.sendUssdRequest(). This is the channel that still works
 * when an OEM/Android release blocks the direct API for third-party apps —
 * and it is the only channel that can carry a genuine multi-step session.
 * See docs/RESTRICTION-WORKAROUNDS.md.
 *
 * v2: besides the service's push events, the transport POLLS the service
 * (peekDialog) after every dial/reply. Some OEM builds never fire the window
 * events the service listens for, or fire them before the JS listener is
 * attached; polling makes both cases recoverable. If nothing shows up in
 * time it reports an error instead of letting the session hang.
 *
 * The system dialog shows a menu as ONE text body plus ONE reply field, so
 * sendInput() always means "type this into that field and press Send" when a
 * field is present, never "find a button matching this value".
 */
export class AccessibilityUssdTransport implements UssdTransport {
  readonly mode = 'REAL' as const;

  private events: UssdTransportEvents | null = null;
  private emitter: NativeEventEmitter | null = null;
  private subscriptions: { remove: () => void }[] = [];
  private lastHasInputField = false;
  private lastSignature: string | null = null;
  private awaiting = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly options: { overlay?: boolean } = {}) {
    if (!UssdAccessibilityModule) {
      secureLogger.warn(
        'AccessibilityUssdTransport',
        'UssdAccessibilityModule not found — this build may not include the accessibility bridge.'
      );
      return;
    }
    this.emitter = new NativeEventEmitter(UssdAccessibilityModule);
  }

  /** True when the bridge exists AND the user has switched the service on in system Settings. */
  async isEnabled(): Promise<boolean> {
    return (await this.status()) === 'CONNECTED';
  }

  /** OFF = switch is off; STALE = switch is on but Android isn't running the service; CONNECTED = working. */
  async status(): Promise<'OFF' | 'STALE' | 'CONNECTED'> {
    const st = await statusWithRepair();
    return st === 'UNAVAILABLE' ? 'OFF' : st;
  }

  setListeners(events: UssdTransportEvents): void {
    this.events = events;
    this.detachSubscriptions();
    if (!this.emitter) return;
    this.subscriptions = [
      this.emitter.addListener(EVENT_DIALOG_TEXT, (payload: unknown) => {
        this.handleDialog(payload as DialogTextPayload);
      }),
      this.emitter.addListener(EVENT_OVERLAY_ACTION, (payload: unknown) => {
        this.events?.onOverlayAction?.(payload as OverlayAction);
      }),
    ];
  }

  private detachSubscriptions(): void {
    this.subscriptions.forEach((s) => s.remove());
    this.subscriptions = [];
  }

  dispose(): void {
    this.awaiting = false;
    this.stopPolling();
    this.events = null;
    this.detachSubscriptions();
  }

  /**
   * Start listening for the phone's USSD dialog WITHOUT dialling. Used by
   * AutoUssdTransport before a direct attempt, because some OEM builds show
   * the system dialog even for sendUssdRequest() and then never call back.
   */
  async armPassive(): Promise<void> {
    try {
      await UssdAccessibilityModule?.hideOverlay?.(); // never leave a previous session's buttons on screen
      await UssdAccessibilityModule?.setOverlayEnabled?.(this.options.overlay !== false);
      await UssdAccessibilityModule?.armService?.();
      this.lastSignature = null;
      this.awaiting = true;
    } catch {
      // Best effort.
    }
  }

  /** If the phone's dialog is already on screen (e.g. from a direct attempt), take it over. */
  async adoptExistingDialog(): Promise<boolean> {
    try {
      const d = (await UssdAccessibilityModule?.peekDialog?.()) as DialogTextPayload | null | undefined;
      if (d) {
        this.awaiting = true;
        this.handleDialog(d);
        return true;
      }
    } catch {
      // fall through
    }
    return false;
  }

  async adopt(): Promise<boolean> {
    if (!UssdAccessibilityModule) return false;
    try {
      this.lastSignature = null;
      await UssdAccessibilityModule.setOverlayEnabled?.(this.options.overlay !== false);
      if (await this.adoptExistingDialog()) return true;
      // The pop-up may still be drawing: wait a few seconds for it.
      this.beginAwait(8_000);
      return true;
    } catch {
      return false;
    }
  }

  presentScreen(screen: ScreenMessage): void {
    if (this.options.overlay === false) return;
    try {
      void UssdAccessibilityModule?.showOverlay?.(JSON.stringify(screenToOverlayPayload(screen)));
    } catch {
      // The RN UI still works behind the dialog; the overlay is an enhancement.
    }
  }

  async finish(): Promise<void> {
    this.awaiting = false;
    this.stopPolling();
    try {
      await UssdAccessibilityModule?.finishSession?.();
    } catch {
      // Dialog may already be gone.
    }
  }

  private handleDialog(payload: DialogTextPayload): void {
    this.lastHasInputField = payload.hasInputField;
    this.lastSignature = `${payload.message}|${payload.hasInputField}`;
    this.awaiting = false;
    this.stopPolling();
    this.events?.onResponse(payload.message);
  }

  private beginAwait(maxMs: number): void {
    this.awaiting = true;
    this.stopPolling();
    if (!UssdAccessibilityModule?.peekDialog) return;
    const deadline = Date.now() + maxMs;
    this.pollTimer = setInterval(async () => {
      if (!this.awaiting) {
        this.stopPolling();
        return;
      }
      if (Date.now() > deadline) {
        this.awaiting = false;
        this.stopPolling();
        this.events?.onError({
          code: 'UNKNOWN',
          message:
            "Couldn't read the phone's USSD pop-up. Either it didn't appear, or this phone's pop-up layout isn't recognised. Try again, or turn off \"Buttons over the phone's USSD pop-up\" in Settings to use the phone's own screen.",
        });
        return;
      }
      try {
        const d = (await UssdAccessibilityModule.peekDialog()) as DialogTextPayload | null;
        if (d && this.awaiting && `${d.message}|${d.hasInputField}` !== this.lastSignature) {
          this.handleDialog(d);
        }
      } catch {
        // Polling is best-effort; the push events may still arrive.
      }
    }, POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async start(code: string, simSlot?: number): Promise<void> {
    if (!UssdAccessibilityModule) {
      this.events?.onError({
        code: 'NO_TELEPHONY',
        message: 'Accessibility USSD bridge is unavailable on this build.',
      });
      return;
    }
    try {
      const st = await this.status();
      if (st !== 'CONNECTED') {
        this.events?.onError(st === 'STALE' ? STALE_ERROR : OFF_ERROR);
        return;
      }
      this.lastHasInputField = false;
      this.lastSignature = null;
      await UssdAccessibilityModule.hideOverlay?.();
      await UssdAccessibilityModule.setOverlayEnabled?.(this.options.overlay !== false);
      this.beginAwait(START_POLL_MS);
      await UssdAccessibilityModule.startUssdViaDialer(code, simSlot ?? 0);
    } catch (e) {
      this.awaiting = false;
      this.stopPolling();
      this.events?.onError(this.fromRejection(e));
    }
  }

  async sendInput(input: string): Promise<void> {
    if (!UssdAccessibilityModule) return;
    try {
      // A menu/prompt screen has a reply field — type into it. A plain
      // info/error screen has none — dismiss it via its OK-equivalent.
      this.beginAwait(REPLY_POLL_MS);
      const ok = this.lastHasInputField
        ? await UssdAccessibilityModule.typeAndSubmit(input)
        : await UssdAccessibilityModule.tapPositiveButton();
      if (!ok) {
        this.awaiting = false;
        this.stopPolling();
        this.events?.onError({
          code: 'UNKNOWN',
          message: "Could not find that control in the carrier's dialog — it may have already changed or closed.",
        });
      }
    } catch (e) {
      this.awaiting = false;
      this.stopPolling();
      this.events?.onError(this.fromRejection(e));
    }
  }

  async cancel(): Promise<void> {
    this.awaiting = false;
    this.stopPolling();
    if (UssdAccessibilityModule) {
      try {
        await UssdAccessibilityModule.hideOverlay?.();
        await UssdAccessibilityModule.cancelDialog();
      } catch {
        // Best effort — the dialog may already be closed.
      }
    }
    this.detachSubscriptions();
    this.events?.onSessionEnded();
  }

  private fromRejection(e: unknown): UssdError {
    const err = e as { code?: string; message?: string } | undefined;
    return { code: 'UNKNOWN', message: err?.message ?? 'Unknown accessibility-transport error.' };
  }
}
