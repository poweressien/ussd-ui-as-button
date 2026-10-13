// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import { ProfileRule } from '../engine/ParserPlugin';

/**
 * Shape of a single carrier profile.
 *
 * IMPORTANT: every profile shipped in this folder (mtn-ng, airtel-ng,
 * glo-ng, nine-mobile-ng) is a SAMPLE/DEMO profile written for this
 * project. None of it is provided by, endorsed by, or verified against the
 * named operator. `knownServices` codes are illustrative placeholders —
 * replace them with codes you have personally verified before shipping
 * anything that relies on them. See docs/PARSER-DESIGN.md.
 */
export interface KnownService {
  code: string;
  label: string;
  /** Always true in the sample profiles shipped here. */
  unverified: true;
}

export interface CarrierProfileData {
  id: string; // e.g. 'mtn-ng'
  displayName: string; // e.g. 'MTN Nigeria (sample profile)'
  brandColor: string; // used only for local UI theming, not an official mark
  knownServices: KnownService[];
  rules: ProfileRule[];
}

export function placeholderService(code: string, label: string): KnownService {
  return { code, label, unverified: true };
}
