// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import { ScreenMessage } from '../types/ussd';
import { GenericParser } from './GenericParser';
import { ParserContext, ParserPlugin } from './ParserPlugin';

/**
 * UssdParser
 * ----------
 * The single entry point the rest of the app calls to turn raw USSD text
 * into a ScreenMessage. It is NOT one universal regex: it's a chain of
 * pluggable parsers, most specific first:
 *
 *   1. Registered ServiceProfileParsers  (one bank's menu on one carrier)
 *   2. Registered CarrierProfileParsers  (a whole carrier's quirks/branding)
 *   3. GenericParser                     (always available, carrier-agnostic)
 *
 * Carrier/service profiles register themselves via `UssdParser.register()`
 * (see src/profiles/ProfileManager.ts, which loads the sample profiles).
 */
export class UssdParser {
  private static plugins: ParserPlugin[] = [];

  static register(plugin: ParserPlugin): void {
    this.plugins.push(plugin);
  }

  static clearPlugins(): void {
    this.plugins = [];
  }

  static parse(raw: string, context: ParserContext): ScreenMessage {
    for (const plugin of this.plugins) {
      if (plugin.canHandle(raw, context)) {
        const result = plugin.tryParse(raw, context);
        if (result) return result;
        // canHandle() was true but tryParse() had no rule for this exact
        // text — fall through to the next plugin instead of stopping here.
      }
    }
    return GenericParser.parse(raw);
  }
}
