// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import { NativeModules } from 'react-native';
import { useNavigation } from '../navigation/RootNavigator';
import { useSettingsStore } from '../state/settingsStore';

/**
 * The only way the app sends a person to system Accessibility settings.
 * Google Play requires the in-app disclosure and an explicit "I agree" first,
 * so without consent this opens the disclosure screen instead.
 */
export function useA11yOpener(): () => void {
  const { navigate } = useNavigation();
  const consent = useSettingsStore((s) => s.a11yConsent);
  return () => {
    if (consent !== true) {
      navigate('Consent');
      return;
    }
    void NativeModules.UssdAccessibilityModule?.openAccessibilitySettings?.();
  };
}
