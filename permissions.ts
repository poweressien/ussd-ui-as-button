import { PermissionsAndroid, Platform, Linking } from 'react-native';

export type PermissionResult = 'granted' | 'denied' | 'never_ask_again';

/**
 * Requests the three permissions UssdModule needs. Call this BEFORE
 * getSimInfo() or dialUssd() -- declaring permissions in AndroidManifest.xml
 * is not enough on Android 6+, they must also be granted at runtime.
 */
export async function requestUssdPermissions(): Promise<PermissionResult> {
  if (Platform.OS !== 'android') return 'granted';

  const perms = [
    PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
    PermissionsAndroid.PERMISSIONS.READ_PHONE_NUMBERS,
    PermissionsAndroid.PERMISSIONS.CALL_PHONE,
  ];

  const results = await PermissionsAndroid.requestMultiple(perms);
  const values = Object.values(results);

  if (values.every((r) => r === PermissionsAndroid.RESULTS.GRANTED)) {
    return 'granted';
  }
  if (values.some((r) => r === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN)) {
    return 'never_ask_again';
  }
  return 'denied';
}

/**
 * PermissionsAndroid won't show the OS prompt again once the user has hit
 * "never ask again" -- the only way forward is the app's own settings page.
 */
export function openAppSettingsForPermissions(): void {
  Linking.openSettings();
}
