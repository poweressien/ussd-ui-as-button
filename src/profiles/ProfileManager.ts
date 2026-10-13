// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GenericParser } from '../engine/GenericParser';
import { CarrierProfileParser } from '../engine/ParserPlugin';
import { UssdParser } from '../engine/UssdParser';
import { CarrierProfileData } from './CarrierProfile';
import { mtnNg } from './mtn-ng';
import { airtelNg } from './airtel-ng';
import { gloNg } from './glo-ng';
import { nineMobileNg } from './nine-mobile-ng';

const BUILTIN_PROFILES: CarrierProfileData[] = [mtnNg, airtelNg, gloNg, nineMobileNg];

const STORAGE_KEY = 'ussdui:carrier-profiles:v1';

/**
 * ProfileManager
 * --------------
 * Owns the set of known carrier profiles: registers each one's rules with
 * UssdParser, and offers a lookup so Settings/SIM screens can show which
 * profile (if any) applies to a detected SIM. Profiles are cached to
 * on-device storage so the app has something to render offline — this is
 * about the UI shell rendering without a network, not about USSD itself
 * working offline (it can't; see docs/ANDROID-USSD-LIMITATIONS.md).
 */
export class ProfileManager {
  private static profiles: Map<string, CarrierProfileData> = new Map();
  private static initialized = false;

  static init(): void {
    if (this.initialized) return;
    for (const profile of BUILTIN_PROFILES) {
      this.registerProfile(profile);
    }
    this.initialized = true;
    // Fire and forget — cache the built-ins so a cold offline start still
    // has profile metadata (branding, sample service list) to show.
    void this.persistToCache();
  }

  static registerProfile(profile: CarrierProfileData): void {
    this.profiles.set(profile.id, profile);
    UssdParser.register(
      new CarrierProfileParser(`carrier:${profile.id}`, profile.id, profile.rules, GenericParser.parse)
    );
  }

  static getProfile(id: string): CarrierProfileData | undefined {
    return this.profiles.get(id);
  }

  static listProfiles(): CarrierProfileData[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Best-effort match from a SIM's carrier display name (as reported by
   * Android) to one of our profile ids. Falls back to undefined, which
   * means "no profile — GenericParser only," never a guess.
   */
  static matchByCarrierName(carrierName: string | undefined): string | undefined {
    if (!carrierName) return undefined;
    const normalized = carrierName.toLowerCase();
    if (normalized.includes('mtn')) return 'mtn-ng';
    if (normalized.includes('airtel')) return 'airtel-ng';
    if (normalized.includes('glo')) return 'glo-ng';
    if (normalized.includes('9mobile') || normalized.includes('etisalat')) return 'nine-mobile-ng';
    return undefined;
  }

  private static async persistToCache(): Promise<void> {
    try {
      const serializable = Array.from(this.profiles.values()).map((p) => ({
        id: p.id,
        displayName: p.displayName,
        brandColor: p.brandColor,
        knownServices: p.knownServices,
      }));
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch {
      // Non-fatal — the in-memory profiles registered in init() are already
      // enough for the current session; the cache is only a cold-start aid.
    }
  }
}
