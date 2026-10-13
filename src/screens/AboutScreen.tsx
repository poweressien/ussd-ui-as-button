// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import React, { useRef } from 'react';
import { Alert, Pressable, StyleSheet, Text, ToastAndroid, View } from 'react-native';
import { useSettingsStore } from '../state/settingsStore';
import { APP_NAME, APP_PUBLISHER, APP_VERSION } from '../appInfo';
import { colors, spacing, typography } from '../theme';

const TAPS_NEEDED = 7;

function say(msg: string): void {
  try {
    ToastAndroid.show(msg, ToastAndroid.SHORT);
  } catch {
    Alert.alert(msg);
  }
}

export function AboutScreen(): React.JSX.Element {
  const devUnlocked = useSettingsStore((s) => s.devUnlocked);
  const setDevUnlocked = useSettingsStore((s) => s.setDevUnlocked);
  const taps = useRef({ n: 0, last: 0 });

  // Hidden switch for the developer's own test phone: tap the version line 7 times.
  const onVersionTap = () => {
    const now = Date.now();
    taps.current.n = now - taps.current.last > 2000 ? 1 : taps.current.n + 1;
    taps.current.last = now;
    const left = TAPS_NEEDED - taps.current.n;
    if (devUnlocked) {
      if (taps.current.n >= 3) say('Developer options are already on');
      return;
    }
    if (left <= 0) {
      setDevUnlocked(true);
      taps.current.n = 0;
      say('Developer options unlocked');
    } else if (left <= 3) {
      say(`${left} more tap${left === 1 ? '' : 's'} to unlock developer options`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{APP_NAME}</Text>
      <Pressable onPress={onVersionTap} accessibilityRole="button" accessibilityLabel="Version">
        <Text style={styles.version}>Version {APP_VERSION}</Text>
      </Pressable>
      <Text style={styles.body}>
        Turns your carrier's USSD menus into real buttons. No internet permission, no ads, no accounts. Nothing leaves your phone.
      </Text>
      <Text style={styles.body}>
        Independent app, not affiliated with or endorsed by any network or bank.
      </Text>
      <Text style={styles.publisher}>{APP_PUBLISHER}</Text>
      {devUnlocked && (
        <Pressable onPress={() => setDevUnlocked(false)} style={styles.lock}>
          <Text style={styles.lockText}>Hide developer options</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  name: { ...typography.title, fontSize: 28, color: colors.textPrimary },
  version: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.lg, padding: spacing.sm },
  body: { ...typography.body, fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.md },
  publisher: { ...typography.label, color: colors.textMuted, marginTop: spacing.lg },
  lock: { marginTop: spacing.xl, padding: spacing.md },
  lockText: { ...typography.body, fontSize: 13, color: colors.danger },
});
