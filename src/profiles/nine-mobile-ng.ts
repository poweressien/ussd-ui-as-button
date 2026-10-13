// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import { CarrierProfileData, placeholderService } from './CarrierProfile';

/**
 * Sample profile only — see CarrierProfile.ts. Codes below are placeholders,
 * not verified 9mobile Nigeria USSD codes.
 */
export const nineMobileNg: CarrierProfileData = {
  id: 'nine-mobile-ng',
  displayName: '9mobile Nigeria (sample profile)',
  brandColor: '#00A99D',
  knownServices: [
    placeholderService('*XXX#', 'Sample: balance & account menu — replace with a verified code'),
    placeholderService('*XXX#', 'Sample: data bundle menu — replace with a verified code'),
  ],
  rules: [],
};
