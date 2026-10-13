// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
/**
 * Core type definitions for the USSD-UI engine.
 *
 * These types are transport-agnostic: the same ScreenMessage shape is
 * produced whether the raw text came from a real carrier over
 * TelephonyManager, or from the mock/demo engine. UI components only
 * ever consume ScreenMessage — they never see a transport directly.
 */

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

export enum UssdSessionState {
  IDLE = 'IDLE',
  STARTING = 'STARTING',
  WAITING_FOR_RESPONSE = 'WAITING_FOR_RESPONSE',
  DISPLAYING_SCREEN = 'DISPLAYING_SCREEN',
  SENDING_INPUT = 'SENDING_INPUT',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  TIMEOUT = 'TIMEOUT',
  CANCELLED = 'CANCELLED',
  UNSUPPORTED = 'UNSUPPORTED', // capability not available via the public Android API
}

/** States from which the UI may safely assume the session is over. */
export const TERMINAL_SESSION_STATES = new Set<UssdSessionState>([
  UssdSessionState.SUCCESS,
  UssdSessionState.FAILED,
  UssdSessionState.TIMEOUT,
  UssdSessionState.CANCELLED,
  UssdSessionState.UNSUPPORTED,
]);

// ---------------------------------------------------------------------------
// Screen components (the "structured ScreenMessage" the parser produces)
// ---------------------------------------------------------------------------

export interface UssdButtonComponent {
  type: 'button';
  id: string;
  label: string;
  /** The literal value sent back to the network when this button is tapped. */
  input: string;
}

export type UssdInputKind = 'numeric' | 'text' | 'pin';

export interface UssdInputComponent {
  type: 'input';
  id: string;
  inputType: UssdInputKind;
  title: string;
  placeholder?: string;
  /** True for PIN/OTP-style fields: mask on screen, redact in every log. */
  sensitive: boolean;
}

export interface UssdConfirmComponent {
  type: 'confirm';
  id: string;
  title: string;
  confirmLabel: string;
  confirmInput: string;
  cancelLabel: string;
  cancelInput: string;
}

export interface UssdTextComponent {
  type: 'text';
  id: string;
  text: string;
}

export type ScreenComponent =
  | UssdButtonComponent
  | UssdInputComponent
  | UssdConfirmComponent
  | UssdTextComponent;

export type ScreenKind = 'screen' | 'input' | 'confirm' | 'terminal' | 'error' | 'unsupported';

export interface ScreenMessage {
  type: ScreenKind;
  title: string;
  /** The untouched text the parser was given — always shown in the debug panel. */
  raw: string;
  components: ScreenComponent[];
  isTerminal: boolean;
  isError: boolean;
  /** Which parser produced this (e.g. "generic", "mtn-ng", "mock") — for the debug panel. */
  parsedBy: string;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Mirrors TelephonyManager.UssdResponseCallback failure codes, plus the
 * app-level codes we add on top (TIMEOUT, CANCELLED, UNSUPPORTED, NO_TELEPHONY).
 * See docs/ANDROID-USSD-LIMITATIONS.md for what each one means in practice.
 */
export type UssdErrorCode =
  | 'USSD_RETURN_FAILURE' // network/modem rejected the request (Android failureCode 0)
  | 'USSD_ERROR_SERVICE_UNAVAIL' // no USSD service available (Android failureCode 1)
  | 'SESSION_ALREADY_ACTIVE' // only one USSD session may run at a time
  | 'PERMISSION_DENIED' // CALL_PHONE not granted
  | 'ASSISTED_DIALER' // direct + accessibility channels unavailable; dialer opened for the user to press call
  | 'ACCESSIBILITY_STALE' // switched on in Settings but Android is not running the service (toggle it off/on)
  | 'ACCESSIBILITY_NOT_ENABLED' // Accessibility Mode's service isn't turned on in system Settings
  | 'NO_TELEPHONY' // device/SIM has no telephony (e.g. tablet, no SIM inserted)
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'UNSUPPORTED_CONTINUATION' // multi-step reply not supported by the public API — see limitations doc
  | 'MALFORMED_RESPONSE'
  | 'UNKNOWN';

export interface UssdError {
  code: UssdErrorCode;
  message: string;
  raw?: string;
}

// ---------------------------------------------------------------------------
// SIM / device
// ---------------------------------------------------------------------------

export interface SimSlotInfo {
  slotIndex: number; // 0 or 1
  subscriptionId: number;
  carrierName: string;
  displayName: string;
  phoneNumber?: string;
}

// ---------------------------------------------------------------------------
// Transport-facing events (see src/transport/UssdTransport.ts)
// ---------------------------------------------------------------------------

/** A tap on the native overlay (the buttons drawn above the phone's own USSD dialog). */
export interface OverlayAction {
  kind: 'input' | 'cancel' | 'done';
  value: string;
}

export interface UssdTransportEvents {
  onResponse: (raw: string) => void;
  onError: (error: UssdError) => void;
  onSessionEnded: () => void;
  /** Only the accessibility channel produces these. */
  onOverlayAction?: (action: OverlayAction) => void;
}

export type TransportMode = 'REAL' | 'DEMO' | 'ACCESSIBILITY' | 'AUTO';

/** The real-USSD channels AutoUssdTransport can route through, best first. */
export type UssdChannel = 'DIRECT' | 'ACCESSIBILITY' | 'ASSISTED';
