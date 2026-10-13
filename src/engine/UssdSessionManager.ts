// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import { useUssdStore } from '../state/ussdStore';
import { AutoUssdTransport, openStockDialer } from '../transport/AutoUssdTransport';
import { AccessibilityUssdTransport } from '../transport/AccessibilityUssdTransport';
import { MockUssdTransport } from '../transport/MockUssdTransport';
import { NativeUssdTransport } from '../transport/NativeUssdTransport';
import { UssdTransport } from '../transport/UssdTransport';
import { TransportMode, UssdChannel, UssdError, UssdSessionState } from '../types/ussd';
import { secureLogger } from '../utils/secureLogger';
import {
  createInitialState,
  FlowState,
  goBack as flowGoBack,
  onCancel as flowOnCancel,
  onInputSubmit,
  onResponse as flowOnResponse,
  onTransportError as flowOnTransportError,
} from './FlowEngine';
import { ProfileManager } from '../profiles/ProfileManager';

/**
 * UssdSessionManager
 * -------------------
 * The only place that touches both a UssdTransport and the Zustand store.
 * Screens/components never talk to a transport directly — they call
 * start()/sendInput()/cancel()/goBack() here, and read state back out of
 * useUssdStore(). Swapping DEMO <-> REAL is just picking which transport
 * gets constructed; FlowEngine and every UI component are unaffected.
 */
export class UssdSessionManager {
  private static instance: UssdSessionManager | null = null;

  static get(): UssdSessionManager {
    if (!this.instance) this.instance = new UssdSessionManager();
    return this.instance;
  }

  private transport: UssdTransport;
  private flowState: FlowState | null = null;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private readonly RESPONSE_TIMEOUT_MS = 30_000;

  private constructor(initialTransport?: UssdTransport) {
    ProfileManager.init();
    this.transport = initialTransport ?? new MockUssdTransport();
    this.bindTransportEvents();
  }

  /**
   * Test-only escape hatch: build an isolated instance around a specific
   * transport (e.g. a fake that never responds, to test timeout handling)
   * without touching the app-wide singleton returned by get().
   */
  static createForTesting(transport: UssdTransport): UssdSessionManager {
    return new UssdSessionManager(transport);
  }

  /** Call once, from Settings, whenever the transport mode or SIM changes. */
  configureTransport(
    mode: TransportMode,
    experimentalContinuation: boolean,
    auto?: { preferred?: UssdChannel | null; onChannelWorked?: (c: UssdChannel) => void },
    showOverlay: boolean = true
  ): void {
    // Detach the old transport first: it would otherwise keep receiving native
    // events and replay every tap/response into this manager a second time.
    this.transport.dispose?.();
    if (mode === 'AUTO') {
      this.transport = new AutoUssdTransport({
        // Continuation is always attempted on the direct channel in AUTO: a
        // rejection triggers the accessibility replay instead of a dead end.
        direct: new NativeUssdTransport(true),
        accessibility: new AccessibilityUssdTransport({ overlay: showOverlay }),
        preferred: auto?.preferred ?? null,
        onChannelWorked: auto?.onChannelWorked,
        openDialer: openStockDialer,
      });
    } else {
      this.transport =
        mode === 'REAL'
          ? new NativeUssdTransport(experimentalContinuation)
          : mode === 'ACCESSIBILITY'
            ? new AccessibilityUssdTransport({ overlay: showOverlay })
            : new MockUssdTransport();
    }
    this.bindTransportEvents();
  }

  async start(code: string, simSlot: number, carrierId?: string): Promise<void> {
    this.clearTimeout();
    this.flowState = createInitialState(code, carrierId, simSlot);
    useUssdStore.getState()._reset(code, this.transport.mode);
    secureLogger.info('UssdSessionManager', `Starting session (${this.transport.mode})`);
    await this.transport.start(code, simSlot);
    // Only start waiting if the call above didn't already resolve the
    // session synchronously (a fast mock response, or a transport-level
    // error like NO_TELEPHONY/PERMISSION_DENIED reported inline). Arming
    // unconditionally here would clobber whatever state that already-correct
    // synchronous event produced.
    if (this.flowState?.sessionState === UssdSessionState.STARTING) {
      this.armTimeout();
    }
  }

  /** A USSD pop-up dialled from the regular Phone app: show it in this app as buttons. */
  async adopt(simSlot = 0): Promise<boolean> {
    if (!this.transport.adopt) return false;
    this.clearTimeout();
    this.flowState = createInitialState('Dialled from Phone app', undefined, simSlot);
    useUssdStore.getState()._reset('Phone app', this.transport.mode);
    secureLogger.info('UssdSessionManager', 'Adopting a USSD dialog dialled from the Phone app');
    const ok = await this.transport.adopt();
    if (this.flowState?.sessionState === UssdSessionState.STARTING) this.armTimeout();
    return ok;
  }

  async submit(input: string): Promise<void> {
    if (!this.flowState) return;
    this.flowState = onInputSubmit(this.flowState);
    useUssdStore.getState()._setSessionState(UssdSessionState.SENDING_INPUT);
    await this.transport.sendInput(input);
    if (this.flowState?.sessionState === UssdSessionState.SENDING_INPUT) {
      this.armTimeout();
    }
  }

  async cancel(): Promise<void> {
    this.clearTimeout();
    if (!this.flowState) return;
    this.flowState = flowOnCancel(this.flowState);
    useUssdStore.getState()._setSessionState(UssdSessionState.CANCELLED);
    await this.transport.cancel();
  }

  goBack(): void {
    if (!this.flowState) return;
    this.flowState = flowGoBack(this.flowState);
    useUssdStore.getState()._popScreen(this.flowState.stepIndex);
    useUssdStore.getState()._setSessionState(this.flowState.sessionState);
  }

  private bindTransportEvents(): void {
    this.transport.setListeners({
      onResponse: (raw) => {
        this.clearTimeout();
        if (!this.flowState) return;
        this.flowState = flowOnResponse(this.flowState, raw);
        const screen = this.flowState.history[this.flowState.history.length - 1];
        useUssdStore.getState()._pushScreen(screen, this.flowState.stepIndex);
        useUssdStore.getState()._setSessionState(this.flowState.sessionState);
        // Real buttons over the phone's dialog (accessibility channel only).
        this.transport.presentScreen?.(screen);
      },
      onError: (error) => {
        this.clearTimeout();
        if (!this.flowState) return;
        this.flowState = flowOnTransportError(this.flowState, error);
        useUssdStore.getState()._setError(error);
        useUssdStore.getState()._setSessionState(this.flowState.sessionState);
        // Uncover this app's own error screen, unless the dialer hand-off is what the person needs to see.
        if (error.code !== 'ASSISTED_DIALER' && error.code !== 'ACCESSIBILITY_NOT_ENABLED' && error.code !== 'ACCESSIBILITY_STALE') {
          void this.transport.finish?.();
        }
      },
      onOverlayAction: (action) => {
        // A tap is only valid while a screen is showing; anything else is a
        // stale overlay or a double tap and would hit a dialog that has moved on.
        const st = useUssdStore.getState().sessionState;
        if (action.kind === 'input' && st !== UssdSessionState.DISPLAYING_SCREEN) return;
        if (action.kind === 'input') void this.submit(action.value);
        else if (action.kind === 'cancel') void this.cancel();
        else void this.transport.finish?.();
      },
      onSessionEnded: () => {
        this.clearTimeout();
        // A clean end with no final screen/error (e.g. user-cancelled on the
        // native side) — only overwrite state if we weren't already in a
        // terminal state from onResponse/onError.
        const state = useUssdStore.getState();
        if (state.sessionState === UssdSessionState.WAITING_FOR_RESPONSE || state.sessionState === UssdSessionState.SENDING_INPUT) {
          state._setSessionState(UssdSessionState.CANCELLED);
        }
      },
    });
  }

  private armTimeout(): void {
    this.clearTimeout();
    useUssdStore.getState()._setSessionState(UssdSessionState.WAITING_FOR_RESPONSE);
    this.timeoutHandle = setTimeout(() => {
      if (!this.flowState) return;
      const error: UssdError = {
        code: 'TIMEOUT',
        message: 'No response from the network within 30 seconds.',
      };
      this.flowState = flowOnTransportError(this.flowState, error);
      useUssdStore.getState()._setError(error);
      useUssdStore.getState()._setSessionState(UssdSessionState.TIMEOUT);
    }, this.RESPONSE_TIMEOUT_MS);
  }

  private clearTimeout(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }
}
