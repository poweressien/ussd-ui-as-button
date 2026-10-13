// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import { ScreenMessage } from '../types/ussd';

/**
 * Shared context passed to every parser in the chain so overrides can
 * decide whether they apply (e.g. "only handle text from *894# on MTN").
 */
export interface ParserContext {
  carrierId?: string; // e.g. 'mtn-ng'
  serviceCode?: string; // the USSD code that started the session, e.g. '*894#'
  stepIndex: number; // 0 for the first screen of a session, increments after each input
}

/**
 * A parsing rule that may or may not have an opinion about a given raw
 * response. Returning `null` means "not mine — defer to the next parser in
 * the chain." This is what lets carrier/service overrides sit in front of
 * GenericParser without needing to reimplement full parsing themselves.
 */
export interface ParserPlugin {
  readonly id: string;
  canHandle(raw: string, context: ParserContext): boolean;
  tryParse(raw: string, context: ParserContext): ScreenMessage | null;
}

/**
 * A single carrier/service override rule: match on raw text (regex) and/or
 * step index, and either return a fully custom ScreenMessage or a partial
 * one (title/branding) that gets merged over whatever GenericParser would
 * have produced.
 */
export interface ProfileRule {
  /** Optional: only apply this rule at a specific step of the session. */
  atStep?: number;
  /** Match the raw text. */
  match: RegExp;
  /** Human label shown in the debug panel, e.g. "MTN Transfer amount prompt". */
  label: string;
  /** Build the override. Receives the GenericParser result as a starting point. */
  build: (raw: string, fallback: ScreenMessage) => ScreenMessage;
}

/**
 * Base class for a carrier-wide parser (branding, known menu quirks that
 * apply across every service on that carrier). Concrete carrier profiles
 * (see src/profiles/) extend this with their own rule list.
 */
export class CarrierProfileParser implements ParserPlugin {
  constructor(
    public readonly id: string,
    private readonly carrierId: string,
    private readonly rules: ProfileRule[],
    private readonly genericFallback: (raw: string) => ScreenMessage
  ) {}

  canHandle(_raw: string, context: ParserContext): boolean {
    return context.carrierId === this.carrierId;
  }

  tryParse(raw: string, context: ParserContext): ScreenMessage | null {
    const applicable = this.rules.filter(
      (r) => (r.atStep === undefined || r.atStep === context.stepIndex) && r.match.test(raw)
    );
    if (applicable.length === 0) return null;

    const fallback = this.genericFallback(raw);
    // Last matching rule wins, so more specific rules can be appended after
    // broader ones in a profile's rule list.
    return applicable[applicable.length - 1].build(raw, fallback);
  }
}

/**
 * Base class for a single-service override (e.g. one bank's USSD menu on
 * one carrier). Takes precedence over CarrierProfileParser when both match,
 * because it's scoped to a specific serviceCode as well as a carrier.
 */
export class ServiceProfileParser implements ParserPlugin {
  constructor(
    public readonly id: string,
    private readonly carrierId: string,
    private readonly serviceCode: string,
    private readonly rules: ProfileRule[],
    private readonly genericFallback: (raw: string) => ScreenMessage
  ) {}

  canHandle(_raw: string, context: ParserContext): boolean {
    return context.carrierId === this.carrierId && context.serviceCode === this.serviceCode;
  }

  tryParse(raw: string, context: ParserContext): ScreenMessage | null {
    const applicable = this.rules.filter(
      (r) => (r.atStep === undefined || r.atStep === context.stepIndex) && r.match.test(raw)
    );
    if (applicable.length === 0) return null;

    const fallback = this.genericFallback(raw);
    return applicable[applicable.length - 1].build(raw, fallback);
  }
}
