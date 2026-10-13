// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { RouteName, useNavigation } from '../navigation/RootNavigator';
import { useSettingsStore } from '../state/settingsStore';
import { APP_NAME } from '../appInfo';
import { colors, radius, spacing, typography } from '../theme';

declare const __DEV__: boolean | undefined;

const TITLES: Partial<Record<RouteName, string>> = {
  Home: APP_NAME,
  Settings: 'Settings',
  SimSelector: 'Choose a SIM',
  Developer: 'Developer',
  About: 'About',
};

interface MenuItem {
  label: string;
  route: RouteName;
}

/**
 * Top bar for every screen except a live USSD session (which has its own bar):
 * a back arrow when there is somewhere to go back to, the screen title, and a
 * real three-dot menu. "Developer" is only listed once it has been unlocked on
 * this device (7 taps on the version line in Settings), so normal users never see it.
 */
export function AppHeader(): React.JSX.Element {
  const { route, canGoBack, goBack, navigate } = useNavigation();
  const devUnlocked = useSettingsStore((s) => s.devUnlocked);
  const [open, setOpen] = useState(false);

  const items: MenuItem[] = [
    { label: 'Settings', route: 'Settings' },
    { label: 'Choose a SIM', route: 'SimSelector' },
    { label: 'About', route: 'About' },
  ];
  if (devUnlocked || (typeof __DEV__ !== 'undefined' && __DEV__ === true)) {
    items.push({ label: 'Developer', route: 'Developer' });
  }

  const go = (to: RouteName) => {
    setOpen(false);
    if (to !== route) navigate(to);
  };

  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        {canGoBack && (
          <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.iconBtn}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {TITLES[route] ?? APP_NAME}
      </Text>
      <View style={[styles.side, styles.sideRight]}>
        <Pressable onPress={() => setOpen(true)} hitSlop={12} accessibilityRole="button" accessibilityLabel="More options" style={styles.iconBtn}>
          <View style={styles.dots}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
            {items.map((it) => (
              <Pressable key={it.route} onPress={() => go(it.route)} style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}>
                <Text style={[styles.itemText, it.route === route && styles.itemActive]}>{it.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  side: { width: 48, alignItems: 'flex-start' },
  sideRight: { alignItems: 'flex-end' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  back: { fontSize: 34, lineHeight: 36, color: colors.textPrimary },
  title: { flex: 1, ...typography.title, fontSize: 20, color: colors.textPrimary, textAlign: 'center' },
  dots: { height: 20, justifyContent: 'space-between', alignItems: 'center' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textPrimary },
  backdrop: { flex: 1, backgroundColor: 'transparent' },
  menu: {
    position: 'absolute',
    top: 56,
    right: spacing.md,
    minWidth: 190,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    elevation: 8,
  },
  item: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  itemPressed: { backgroundColor: colors.border },
  itemText: { ...typography.body, color: colors.textPrimary },
  itemActive: { color: colors.accent, fontWeight: '700' },
});
