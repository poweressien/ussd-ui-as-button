// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import { CarrierProfileData, placeholderService } from './CarrierProfile';

/**
 * Sample profile only — see CarrierProfile.ts. Codes below are placeholders,
 * not verified Glo Nigeria USSD codes.
 */
export const gloNg: CarrierProfileData = {
  id: 'glo-ng',
  displayName: 'Glo Nigeria (sample profile)',
  brandColor: '#00A651',
  knownServices: [
    placeholderService('*XXX#', 'Sample: balance & account menu — replace with a verified code'),
    placeholderService('*XXX#', 'Sample: data bundle menu — replace with a verified code'),
  ],
  rules: [],
};
