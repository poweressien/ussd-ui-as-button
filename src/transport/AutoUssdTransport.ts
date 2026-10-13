// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import { NativeModules } from 'react-native';
import { ScreenMessage, UssdError, UssdErrorCode, UssdChannel, UssdTransportEvents } from '../types/ussd';
import { secureLogger } from '../utils/secureLogger';
import { UssdTransport } from './UssdTransport';

/** A real-USSD child transport, plus the one extra question Auto needs answered. */
export interface AccessibilityChannel extends UssdTransport {
  isEnabled(): Promise<boolean>;
  /** OFF / STALE / CONNECTED (optional: absent in simple fakes). */
  status?(): Promise<'OFF' | 'STALE' | 'CONNECTED'>;
  /** Listen for the phone's USSD dialog without dialling (optional: absent in simple fakes). */
  armPassive?(): Promise<void>;
  /** Take over a phone dialog that is already on screen (optional). */
  adoptExistingDialog?(): Promise<boolean>;
}

export interface AutoTransportOptions {
  direct: UssdTransport;
  accessibility: AccessibilityChannel;
  /** Channel that worked last time on this device, if recent. Tried first. */
  preferred?: UssdChannel | null;
  /** Called whenever a channel actually delivered a response. */
  onChannelWorked?: (channel: UssdChannel) => void;
  /** Opens the stock dialer with the code pre-filled (last resort). */
  openDialer?: (code: string, simSlot: number) => Promise<void>;
  /**
   * Try the direct API before accessibility even when accessibility is on.
   * Off by default: the direct API cannot return interactive menus, so it only
   * delays the buttons. Kept for tests and for one-shot-only use.
   */
  directFirst?: boolean;
}

/**
 * Errors that mean "this channel is blocked/unavailable", i.e. worth trying
 * another one. Deliberately excludes SESSION_ALREADY_ACTIVE, TIMEOUT and
 * CANCELLED — those are about this session, not about the channel.
 */
const FAILOVER_CODES = new Set<UssdErrorCode>([
  'USSD_RETURN_FAILURE',
  'USSD_ERROR_SERVICE_UNAVAIL',
  'PERMISSION_DENIED',
  'NO_TELEPHONY',
  'ACCESSIBILITY_NOT_ENABLED',
  'UNKNOWN',
]);

const CONTINUATION_FAILURE_CODES = new Set<UssdErrorCode>([
  'UNSUPPORTED_CONTINUATION',
  'USSD_RETURN_FAILURE',
  'USSD_ERROR_SERVICE_UNAVAIL',
]);

/**
 * AutoUssdTransport
 * ------------------
 * One transport that walks the ladder of ways an Android app can get USSD
 * through, so the user never has to know which one their phone allows:
 *
 *   1. DIRECT         TelephonyManager.sendUssdRequest()  (fast, no extra setup)
 *   2. ACCESSIBILITY  dial through the system + drive its dialog (works where
 *                     the direct API is blocked; needs the service switched on)
 *   3. ASSISTED       open the stock dialer with the code filled in; the user
 *                     presses call (needs no permission at all)
 *
 * Two behaviours worth knowing:
 *  - FAILOVER at start: if the first channel is rejected before any response
 *    arrives, the next one is tried automatically.
 *  - REPLAY on continuation failure: the direct API often cannot reply into an
 *    open menu. If a reply is rejected and the accessibility channel is on,
 *    the session is re-dialled through accessibility and the earlier inputs
 *    are replayed silently, then the failed reply is sent; only the final
 *    screen reaches the UI. Inputs live in memory only for the life of the
 *    session (they may include PINs) and are wiped on cancel/start.
 *
 * The channel that worked is reported via onChannelWorked so next time the
 * ladder can skip a channel known to be blocked.
 */
export class AutoUssdTransport implements UssdTransport {
  readonly mode = 'REAL' as const;

  private events: UssdTransportEvents | null = null;
  private active: UssdChannel | null = null;
  private ladder: UssdChannel[] = [];
  private ladderIndex = 0;
  private gotResponse = false;
  private a11yWasEnabled: boolean | null = null;

  private code = '';
  private simSlot = 0;
  private path: string[] = [];
  private pendingInput: string | null = null;
  private replayQueue: string[] | null = null;
  private lastError: UssdError | null = null;

  constructor(private readonly opts: AutoTransportOptions) {}

  /** For diagnostics/UI: which channel is carrying the current session. */
  get activeChannel(): UssdChannel | null {
    return this.active;
  }

  setListeners(events: UssdTransportEvents): void {
    this.events = events;
    this.bindChildren();
  }

  private bindChildren(): void {
    this.opts.direct.setListeners(this.childEvents('DIRECT'));
    this.opts.accessibility.setListeners(this.childEvents('ACCESSIBILITY'));
  }

  private childEvents(channel: UssdChannel): UssdTransportEvents {
    return {
      onResponse: (raw) => void this.handleResponse(channel, raw),
      onError: (err) => void this.handleError(channel, err),
      onSessionEnded: () => {
        if (channel === this.active) this.events?.onSessionEnded();
      },
      onOverlayAction: (action) => this.events?.onOverlayAction?.(action),
    };
  }

  // -------------------------------------------------------------------
  // start / failover
  // -------------------------------------------------------------------

  async start(code: string, simSlot?: number): Promise<void> {
    this.code = code;
    this.simSlot = simSlot ?? 0;
    this.path = [];
    this.pendingInput = null;
    this.replayQueue = null;
    this.gotResponse = false;
    this.lastError = null;
    this.a11yWasEnabled = null;
    this.ladderIndex = -1;
    this.bindChildren(); // children detach their listeners on cancel()

    // (status() heals a dead service first when it can.) If it is still not running the code
    // is dialled anyway: the person gets the phone's own screen instead of buttons, never a refusal.
    this.a11yWasEnabled = await this.opts.accessibility.isEnabled();
    // The direct API can only ever return one-shot answers: an interactive menu
    // comes back as failureCode -1 and the text is thrown away. So when the
    // accessibility service is on, go straight to it. That is what produces the
    // buttons, and it avoids a slow doomed direct attempt first. Direct stays as
    // the fallback, and as the first choice only when accessibility is off.
    this.ladder =
      this.a11yWasEnabled && (!this.opts.directFirst || this.opts.preferred === 'ACCESSIBILITY')
        ? ['ACCESSIBILITY', 'DIRECT'] : ['DIRECT', 'ACCESSIBILITY'];
    // Listen for the phone's own dialog from the very first moment (some OEM builds
    // show it even for a direct request and never call back).
    if (this.a11yWasEnabled) await this.opts.accessibility.armPassive?.();

    await this.advance();
  }

  /** Move to the next channel on the ladder, or to the assisted handoff, or give up. */
  private async advance(): Promise<void> {
    this.ladderIndex += 1;

    if (this.ladderIndex < this.ladder.length) {
      const channel = this.ladder[this.ladderIndex];
      if (channel === 'ACCESSIBILITY') {
        const enabled = await this.opts.accessibility.isEnabled();
        this.a11yWasEnabled = enabled;
        if (!enabled) return this.advance();
        this.active = channel;
        secureLogger.info('AutoUssdTransport', 'Trying ACCESSIBILITY channel');
        // The phone may already be showing the dialog from the direct attempt:
        // take it over instead of dialling a second time.
        if (await this.opts.accessibility.adoptExistingDialog?.()) return;
        await this.opts.accessibility.start(this.code, this.simSlot);
      } else {
        this.active = channel;
        secureLogger.info('AutoUssdTransport', 'Trying DIRECT channel');
        await this.opts.direct.start(this.code, this.simSlot);
      }
      return;
    }

    // Ladder exhausted.
    this.active = null;
    if (this.a11yWasEnabled === false && this.opts.openDialer) {
      try {
        await this.opts.openDialer(this.code, this.simSlot);
        this.active = 'ASSISTED';
        this.events?.onError({
          code: 'ASSISTED_DIALER',
          message:
            'Your code was dialled and the phone is showing its own USSD screen. ' +
            'Buttons are off because Accessibility is not running — open Accessibility settings and switch USSD-UI off and on.',
        });
        return;
      } catch {
        // fall through to the plain error below
      }
    }
    this.events?.onError(
      this.lastError ?? {
        code: 'UNKNOWN',
        message: 'No USSD channel is available on this device.',
      }
    );
  }

  // -------------------------------------------------------------------
  // child events
  // -------------------------------------------------------------------

  private async handleResponse(channel: UssdChannel, raw: string): Promise<void> {
    // The accessibility reader only emits for a dialog the phone really showed
    // while we were listening, so it is always genuine: adopt it even if the
    // direct channel is still "active" (it hung instead of failing).
    if (channel === 'ACCESSIBILITY' && this.active !== 'ACCESSIBILITY') {
      this.active = 'ACCESSIBILITY';
    }
    if (channel !== this.active) return; // stale event from a channel we already left

    // Silent replay in progress: feed the next recorded input, don't surface this screen.
    if (this.replayQueue) {
      const next = this.replayQueue.shift();
      if (next !== undefined) {
        await this.opts.accessibility.sendInput(next);
        return;
      }
      this.replayQueue = null; // this response answers the originally failed input
    }

    this.gotResponse = true;
    if (this.pendingInput !== null) {
      this.path.push(this.pendingInput);
      this.pendingInput = null;
    }
    this.opts.onChannelWorked?.(channel);
    this.events?.onResponse(raw);
  }

  private async handleError(channel: UssdChannel, err: UssdError): Promise<void> {
    if (channel !== this.active) return;
    this.lastError = err;

    if (this.replayQueue) {
      // Replay itself failed; there is nothing left to fall back to.
      this.replayQueue = null;
      this.events?.onError({
        code: 'UNSUPPORTED_CONTINUATION',
        message: `Could not rebuild the session through Accessibility Mode (${err.message})`,
      });
      return;
    }

    // Blocked before any response -> try the next channel.
    if (!this.gotResponse && FAILOVER_CODES.has(err.code)) {
      secureLogger.info('AutoUssdTransport', `${channel} failed (${err.code}); failing over`);
      await this.advance();
      return;
    }

    // Mid-session: the direct API could not carry the reply.
    if (
      this.gotResponse &&
      channel === 'DIRECT' &&
      this.pendingInput !== null &&
      CONTINUATION_FAILURE_CODES.has(err.code)
    ) {
      if (await this.opts.accessibility.isEnabled()) {
        await this.replayThroughAccessibility();
        return;
      }
      this.events?.onError({
        code: 'UNSUPPORTED_CONTINUATION',
        message:
          'This phone cannot reply inside a USSD menu through the direct API. Turn on Accessibility Mode in Settings and try again — it can.',
      });
      return;
    }

    this.events?.onError(err);
  }

  private async replayThroughAccessibility(): Promise<void> {
    secureLogger.info('AutoUssdTransport', 'Direct continuation rejected; replaying via ACCESSIBILITY');
    const queue = [...this.path];
    if (this.pendingInput !== null) queue.push(this.pendingInput);
    this.replayQueue = queue;
    this.ladder = ['ACCESSIBILITY'];
    this.ladderIndex = 0;
    this.active = 'ACCESSIBILITY';
    // path and pendingInput are kept: the final response of the replay is
    // attributed to pendingInput, which then joins path as usual.
    await this.opts.accessibility.start(this.code, this.simSlot);
  }

  // -------------------------------------------------------------------
  // sendInput / cancel
  // -------------------------------------------------------------------

  async sendInput(input: string): Promise<void> {
    if (this.replayQueue) return; // mid-replay: the UI is still waiting on the previous send
    if (this.active === 'ASSISTED' || this.active === null) {
      this.events?.onError({
        code: 'UNSUPPORTED_CONTINUATION',
        message: 'Reply inside the phone dialer — this app is not driving the session on this channel.',
      });
      return;
    }
    this.pendingInput = input;
    if (this.active === 'DIRECT') {
      await this.opts.direct.sendInput(input);
    } else {
      await this.opts.accessibility.sendInput(input);
    }
  }

  /** A USSD pop-up dialled from the regular Phone app: drive it through the accessibility channel. */
  async adopt(): Promise<boolean> {
    this.bindChildren();
    this.path = [];
    this.pendingInput = null;
    this.replayQueue = null;
    this.gotResponse = false;
    this.lastError = null;
    this.code = '';
    this.ladder = ['ACCESSIBILITY'];
    this.ladderIndex = 0;
    this.active = 'ACCESSIBILITY';
    // Replay needs a code to re-dial; none exists for an adopted dialog, so it is simply not attempted.
    return (await this.opts.accessibility.adopt?.()) ?? false;
  }

  presentScreen(screen: ScreenMessage): void {
    if (this.active === 'ACCESSIBILITY') this.opts.accessibility.presentScreen?.(screen);
  }

  async finish(): Promise<void> {
    if (this.active === 'ACCESSIBILITY') await this.opts.accessibility.finish?.();
  }

  dispose(): void {
    this.replayQueue = null;
    this.events = null;
    this.opts.direct.dispose?.();
    this.opts.accessibility.dispose?.();
  }

  async cancel(): Promise<void> {
    const channel = this.active;
    this.active = null;
    this.replayQueue = null;
    this.path = [];
    this.pendingInput = null;
    if (channel === 'DIRECT') await this.opts.direct.cancel();
    else if (channel === 'ACCESSIBILITY') await this.opts.accessibility.cancel();
    else this.events?.onSessionEnded();
  }
}

/** Real-device dialer opener, used as AutoTransportOptions.openDialer. */
export async function openStockDialer(code: string, simSlot = 0): Promise<void> {
  const mod = NativeModules.UssdAccessibilityModule;
  // Dial straight away (ACTION_CALL on the chosen SIM) so the person does not have to press call;
  // fall back to the pre-filled dialer if the call permission is missing.
  if (mod?.startUssdViaDialer) {
    await mod.startUssdViaDialer(code, simSlot);
    return;
  }
  if (!mod?.openDialerWithCode) throw new Error('Dialer bridge unavailable');
  await mod.openDialerWithCode(code);
}
