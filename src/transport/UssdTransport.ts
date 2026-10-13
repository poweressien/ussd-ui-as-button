// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import { ScreenMessage, UssdTransportEvents } from '../types/ussd';

/**
 * UssdTransport
 * -------------
 * The only thing that changes between demo and real USSD. UssdSessionManager
 * talks to whichever implementation is active through this interface and
 * has no idea which one it's using — see section 9 of the original spec:
 * "The mock engine must use the SAME parser and UI engine as real USSD.
 * Only the transport layer changes."
 */
export interface UssdTransport {
  readonly mode: 'REAL' | 'DEMO';

  /** Register (or replace) the listeners that receive responses/errors. */
  setListeners(events: UssdTransportEvents): void;

  /** Dial a USSD code and start a session. */
  start(code: string, simSlot?: number): Promise<void>;

  /**
   * Send a reply to continue the current session (e.g. "1" for a menu
   * choice, or "0123456789" for an account number prompt).
   *
   * IMPORTANT (real transport only): Android's public sendUssdRequest API
   * is a single dial-and-response call. It was not designed to carry a
   * reply back into an already-open USSD dialog, and on most devices there
   * is no supported way to do that from a third-party app. NativeUssdTransport
   * documents exactly what it does and does not attempt — see
   * docs/ANDROID-USSD-LIMITATIONS.md. MockUssdTransport has no such
   * limitation, since it isn't talking to a real modem.
   */
  sendInput(input: string): Promise<void>;

  /** End the session from the client side. */
  cancel(): Promise<void>;

  /**
   * OPTIONAL. Show the parsed screen to the person through the transport's
   * own surface (the accessibility channel draws real buttons over the phone's
   * USSD dialog, which would otherwise cover and block this app's UI).
   */
  presentScreen?(screen: ScreenMessage): void;

  /** OPTIONAL. The session reached a final screen: dismiss the phone's dialog and any overlay. */
  finish?(): Promise<void>;

  /**
   * OPTIONAL. Permanently detach from native events. Called when this
   * transport is replaced. Without it every replaced transport kept listening
   * and a single tap was sent once per transport ever created.
   */
  dispose?(): void;

  /**
   * OPTIONAL. Take over a USSD pop-up the phone is already showing (the person dialled from
   * the regular Phone app). Resolves false when there is nothing to take over.
   */
  adopt?(): Promise<boolean>;
}
