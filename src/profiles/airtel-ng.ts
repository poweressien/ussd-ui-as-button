// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import { CarrierProfileData, placeholderService } from './CarrierProfile';

/**
 * Sample profile only — see CarrierProfile.ts. Codes below are placeholders,
 * not verified Airtel Nigeria USSD codes.
 */
export const airtelNg: CarrierProfileData = {
  id: 'airtel-ng',
  displayName: 'Airtel Nigeria (sample profile)',
  brandColor: '#ED1C24',
  knownServices: [
    placeholderService('*XXX#', 'Sample: balance & account menu — replace with a verified code'),
    placeholderService('*XXX#', 'Sample: data bundle menu — replace with a verified code'),
  ],
  rules: [],
};
