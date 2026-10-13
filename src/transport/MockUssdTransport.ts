// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import { UssdTransportEvents } from '../types/ussd';
import { secureLogger } from '../utils/secureLogger';
import { UssdTransport } from './UssdTransport';

/**
 * MockUssdTransport
 * ------------------
 * Simulates a carrier USSD session entirely on-device — no SIM, no network,
 * no native module involved. It emits raw text through the exact same
 * UssdTransportEvents interface NativeUssdTransport uses, so
 * UssdSessionManager, UssdParser, and every UI component are none the wiser
 * about which transport is active.
 *
 * The default script mirrors the spec's own demo walkthrough:
 *   *894#  ->  Transfer / Airtime / Balance menu
 *   Transfer -> "Enter account number" -> "Enter amount" -> confirm -> success
 *
 * Any other code gets a small generic fallback script so demo mode never
 * just breaks on an unrecognised input.
 */

interface ScriptStep {
  /** Raw text to emit for this step. */
  response: string;
  /** ms of artificial "network" delay before the response arrives. */
  delayMs: number;
}

type Script = ScriptStep[];

const TRANSFER_DEMO_SCRIPT: Script = [
  { response: '1. Transfer\n2. Airtime\n3. Balance', delayMs: 900 },
  { response: 'Enter account number', delayMs: 700 },
  { response: 'Enter amount', delayMs: 700 },
  { response: 'Transfer NGN {amount} to {account}?\n1. Confirm\n2. Cancel', delayMs: 700 },
  { response: 'Transaction successful. NGN {amount} sent to {account}.', delayMs: 1100 },
];

const GENERIC_FALLBACK_SCRIPT: Script = [
  { response: '1. Check balance\n2. Buy airtime\n3. Exit', delayMs: 900 },
  { response: 'This is demo mode — you selected an option in the sample menu.', delayMs: 700 },
];

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

export class MockUssdTransport implements UssdTransport {
  readonly mode = 'DEMO' as const;

  private events: UssdTransportEvents | null = null;
  private script: Script = [];
  private stepIndex = 0;
  private active = false;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;
  private vars: Record<string, string> = {};

  setListeners(events: UssdTransportEvents): void {
    this.events = events;
  }

  async start(code: string): Promise<void> {
    this.clearPendingTimer();
    this.script = code.trim() === '*894#' ? TRANSFER_DEMO_SCRIPT : GENERIC_FALLBACK_SCRIPT;
    this.stepIndex = 0;
    this.active = true;
    this.vars = {};
    secureLogger.info('MockUssdTransport', `Demo session started for ${code}`);
    this.emitCurrentStep();
  }

  async sendInput(input: string): Promise<void> {
    if (!this.active) return;

    // Demo-only bookkeeping so the confirm/success screens can echo back what
    // the user typed, purely for realism — never logged or persisted.
    if (this.script === TRANSFER_DEMO_SCRIPT) {
      if (this.stepIndex === 1) this.vars.account = input;
      if (this.stepIndex === 2) this.vars.amount = input;
    }

    this.stepIndex += 1;
    if (this.stepIndex >= this.script.length) {
      // User replied after the final scripted step (e.g. tapped an option on
      // a fallback screen) — end the session gracefully rather than throwing.
      this.active = false;
      this.events?.onSessionEnded();
      return;
    }
    this.emitCurrentStep();
  }

  async cancel(): Promise<void> {
    this.clearPendingTimer();
    if (this.active) {
      this.active = false;
      secureLogger.info('MockUssdTransport', 'Demo session cancelled by user');
      this.events?.onSessionEnded();
    }
  }

  private emitCurrentStep(): void {
    const step = this.script[this.stepIndex];
    this.pendingTimer = setTimeout(() => {
      if (!this.active) return;
      const text = fillTemplate(step.response, this.vars);
      this.events?.onResponse(text);
      if (this.stepIndex === this.script.length - 1) {
        this.active = false;
      }
    }, step.delayMs);
  }

  private clearPendingTimer(): void {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
  }
}
