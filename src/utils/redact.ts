// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
/**
 * redact.ts
 * ---------
 * Every place in this app that might log a USSD string (raw network text,
 * user input, debug panel history) MUST go through one of these first.
 * See section 15 of the spec / docs/ANDROID-USSD-LIMITATIONS.md:
 * "Never log PINs, passwords, OTPs, account numbers, sensitive financial
 * information."
 *
 * This is deliberately conservative: it's fine for the redactor to mask a
 * few characters that weren't actually sensitive (a menu option number),
 * but it must never let a real PIN/OTP/account number/amount through.
 */

const LONG_DIGIT_RUN = /\d{4,}/g; // account numbers, phone numbers, OTPs, card-like numbers
const AMOUNT_PATTERN = /\b(?:ngn|₦|naira)\s?[\d,]+(?:\.\d{1,2})?\b/gi;
const LABELLED_SENSITIVE = /\b(pin|otp|password|passcode)\s*[:-]?\s*\d+/gi;

export function redactText(input: string): string {
  if (!input) return input;
  let out = input;
  out = out.replace(LABELLED_SENSITIVE, (_m, label) => `${label}: [REDACTED]`);
  out = out.replace(AMOUNT_PATTERN, '[REDACTED-AMOUNT]');
  out = out.replace(LONG_DIGIT_RUN, (m) => '*'.repeat(m.length));
  return out;
}

/**
 * Use for anything the user *typed* into a UssdInput — we don't try to be
 * clever about "is this actually a PIN," we just redact by input kind,
 * which the caller already knows.
 */
export function redactUserInput(value: string, inputKind: 'numeric' | 'text' | 'pin'): string {
  if (inputKind === 'pin') return '*'.repeat(Math.max(4, value.length));
  if (inputKind === 'numeric' && value.length >= 4) return '*'.repeat(value.length);
  return redactText(value);
}
