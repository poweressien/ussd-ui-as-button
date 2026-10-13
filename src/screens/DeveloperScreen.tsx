// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import React, { useEffect, useState } from 'react';
import { FlatList, NativeModules, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { secureLogger } from '../utils/secureLogger';
import { ProfileManager } from '../profiles/ProfileManager';
import { colors, radius, spacing, typography } from '../theme';

interface DeviceInfo {
  manufacturer: string;
  brand: string;
  model: string;
  sdkInt: number;
  release: string;
  securityPatch: string;
  hasCallPhone: boolean;
  hasReadPhoneState: boolean;
}

export function DeveloperScreen(): React.JSX.Element {
  const [entries, setEntries] = useState(secureLogger.recent());
  const profiles = ProfileManager.listProfiles();
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [a11y, setA11y] = useState<string>('…');
  const [build, setBuild] = useState<string>('');
  const [a11yDebug, setA11yDebug] = useState<string>('');

  useEffect(() => {
    void (async () => {
      try {
        setDevice(await NativeModules.UssdModule?.getDeviceInfo?.());
        setA11y(String((await NativeModules.UssdAccessibilityModule?.getAccessibilityStatus?.()) ?? 'unknown'));
        setBuild(String((await NativeModules.UssdAccessibilityModule?.getBuildInfo?.()) ?? 'old build'));
      } catch {
        // Diagnostics are best-effort.
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>DIAGNOSTICS (include when reporting a blocked phone)</Text>
      <Text style={styles.disclaimer}>
        {device
          ? `${device.manufacturer} ${device.model} · Android ${device.release} (API ${device.sdkInt}) · patch ${device.securityPatch || 'n/a'}\nCALL_PHONE: ${device.hasCallPhone ? 'yes' : 'no'} · READ_PHONE_STATE: ${device.hasReadPhoneState ? 'yes' : 'no'} · Accessibility: ${a11y}\nBuild: ${build}`
          : 'Device info unavailable (native module not linked).'}
      </Text>

      <View style={styles.reportRow}>
        <Pressable
          style={styles.reportButton}
          onPress={async () => {
            const m = NativeModules.UssdAccessibilityModule;
            const body = String((await m?.getReport?.(true)) ?? 'bridge unavailable');
            const head = device
              ? `${device.manufacturer} ${device.model} Android ${device.release} (API ${device.sdkInt}) a11y=${a11y} build=${build}\n\n`
              : '';
            await Share.share({ message: head + body });
          }}
        >
          <Text style={styles.reportButtonText}>Share report (with menu text)</Text>
        </Pressable>
        <Pressable
          style={styles.reportButtonAlt}
          onPress={async () => {
            const m = NativeModules.UssdAccessibilityModule;
            await Share.share({ message: String((await m?.getReport?.(false)) ?? 'bridge unavailable') });
          }}
        >
          <Text style={styles.reportButtonAltText}>Structure only</Text>
        </Pressable>
      </View>
      <Text style={styles.disclaimer}>
        Dial a code and let the problem happen, then come here and tap Share report. It contains the last few menu texts,
        not PINs or replies.
      </Text>

      <View style={styles.logHeader}>
        <Text style={styles.sectionLabel}>ACCESSIBILITY TRACE</Text>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Pressable
            onPress={async () => {
              const m = NativeModules.UssdAccessibilityModule;
              setA11yDebug(String((await m?.getTrace?.()) ?? 'bridge unavailable'));
            }}
          >
            <Text style={styles.clearText}>Trace</Text>
          </Pressable>
          <Pressable
            onPress={async () => {
              const m = NativeModules.UssdAccessibilityModule;
              setA11yDebug(String((await m?.dumpTree?.()) ?? 'bridge unavailable'));
            }}
          >
            <Text style={styles.clearText}>Dump screen</Text>
          </Pressable>
        </View>
      </View>
      {a11yDebug ? (
        <ScrollView style={{ maxHeight: 220 }}>
          <Text selectable style={styles.logLine}>{a11yDebug}</Text>
        </ScrollView>
      ) : (
        <Text style={styles.disclaimer}>
          Dial a code, then tap Trace (what the reader saw) or Dump screen (structure of the open dialog; no message text is included).
        </Text>
      )}

      <Text style={styles.sectionLabel}>LOADED CARRIER PROFILES</Text>
      {profiles.map((p) => (
        <View key={p.id} style={styles.profileRow}>
          <View style={[styles.swatch, { backgroundColor: p.brandColor }]} />
          <Text style={styles.profileName}>{p.displayName}</Text>
        </View>
      ))}
      <Text style={styles.disclaimer}>
        Sample profiles only — none of the above are verified against or endorsed by the named operator. See
        docs/PARSER-DESIGN.md.
      </Text>

      <View style={styles.logHeader}>
        <Text style={styles.sectionLabel}>OPERATIONAL LOG (REDACTED)</Text>
        <Pressable
          onPress={() => {
            secureLogger.clear();
            setEntries([]);
          }}
        >
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
      </View>

      <FlatList
        data={[...entries].reverse()}
        keyExtractor={(_, i) => String(i)}
        style={styles.logList}
        renderItem={({ item }) => (
          <Text style={[styles.logLine, item.level === 'error' && styles.logError, item.level === 'warn' && styles.logWarn]}>
            [{item.tag}] {item.message}
          </Text>
        )}
        ListEmptyComponent={<Text style={styles.emptyLog}>No log entries yet — start a session to see one.</Text>}
        onRefresh={() => setEntries(secureLogger.recent())}
        refreshing={false}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  sectionLabel: { ...typography.label, color: colors.textMuted, marginBottom: spacing.sm },
  profileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  swatch: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.sm },
  profileName: { ...typography.body, fontSize: 13, color: colors.textSecondary },
  disclaimer: { ...typography.body, fontSize: 12, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.lg },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reportRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  reportButton: { flex: 1, backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  reportButtonText: { color: '#06120C', fontWeight: '700', fontSize: 13 },
  reportButtonAlt: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, alignItems: 'center' },
  reportButtonAltText: { color: colors.textSecondary, fontSize: 12 },
  clearText: { ...typography.label, color: colors.danger },
  logList: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  logLine: { ...typography.mono, fontSize: 11, color: colors.textSecondary, marginBottom: 2 },
  logWarn: { color: colors.warning },
  logError: { color: colors.danger },
  emptyLog: { ...typography.body, color: colors.textMuted, padding: spacing.md },
});
