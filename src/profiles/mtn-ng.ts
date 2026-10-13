// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import { CarrierProfileData, placeholderService } from './CarrierProfile';

/**
 * Sample profile only — see CarrierProfile.ts. Codes below are placeholders,
 * not verified MTN Nigeria USSD codes.
 */
export const mtnNg: CarrierProfileData = {
  id: 'mtn-ng',
  displayName: 'MTN Nigeria (sample profile)',
  brandColor: '#FFCC08',
  knownServices: [
    placeholderService('*XXX#', 'Sample: balance & account menu — replace with a verified code'),
    placeholderService('*XXX#', 'Sample: data bundle menu — replace with a verified code'),
  ],
  // No branding/menu overrides are shipped by default — GenericParser handles
  // MTN's menu text just like any other carrier's until you add rules here
  // from menus you've personally captured and verified.
  rules: [],
};
