// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import React, { useCallback, useEffect, useState } from 'react';
import { NativeModules, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useA11yOpener } from '../utils/useA11yOpener';
import { useSettingsStore } from '../state/settingsStore';
import { TransportMode } from '../types/ussd';
import { colors, radius, spacing, typography } from '../theme';

const { UssdAccessibilityModule } = NativeModules;

function SettingRow({
  title,
  description,
  value,
  onValueChange,
  warning,
}: {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  warning?: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={[styles.rowDescription, warning && styles.warningText]}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.accentMuted }}
        thumbColor={colors.textPrimary}
      />
    </View>
  );
}

function TransportOptionRow({
  title,
  description,
  selected,
  onPress,
}: {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable onPress={onPress} style={[styles.transportRow, selected && styles.transportRowSelected]}>
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected && <View style={styles.radioInner} />}
      </View>
      <View style={styles.transportRowText}>
        <Text style={styles.transportRowTitle}>{title}</Text>
        <Text style={styles.transportRowDescription}>{description}</Text>
      </View>
    </Pressable>
  );
}

export function SettingsScreen(): React.JSX.Element {
  const settings = useSettingsStore();
  const openA11y = useA11yOpener();
  const [a11yEnabled, setA11yEnabled] = useState<boolean | null>(null);

  const checkAccessibilityStatus = useCallback(async () => {
    if (!UssdAccessibilityModule?.getAccessibilityStatus) {
      setA11yEnabled(false);
      return;
    }
    try {
      const status: string = await UssdAccessibilityModule.getAccessibilityStatus();
      setA11yEnabled(status === 'CONNECTED');
    } catch {
      setA11yEnabled(false);
    }
  }, []);

  useEffect(() => {
    if (settings.transportMode === 'ACCESSIBILITY' || settings.transportMode === 'AUTO') {
      void checkAccessibilityStatus();
    }
  }, [settings.transportMode, checkAccessibilityStatus]);

  const setMode = (mode: TransportMode) => {
    settings.setTransportMode(mode);
    if (mode === 'ACCESSIBILITY' || mode === 'AUTO') void checkAccessibilityStatus();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>TRANSPORT</Text>
      <TransportOptionRow
        title="Demo Mode"
        description="Fully scripted, offline — no SIM or network involved."
        selected={settings.transportMode === 'DEMO'}
        onPress={() => setMode('DEMO')}
      />
      <TransportOptionRow
        title="Real USSD — Auto (recommended)"
        description="Tries the direct API first, then switches to Accessibility Mode if your phone blocks it, then hands off to the dialer. Remembers what works on this phone."
        selected={settings.transportMode === 'AUTO'}
        onPress={() => setMode('AUTO')}
      />
      <TransportOptionRow
        title="Real USSD — Direct API"
        description="Uses TelephonyManager.sendUssdRequest() directly. Fastest and most reliable where the device/OEM allows it."
        selected={settings.transportMode === 'REAL'}
        onPress={() => setMode('REAL')}
      />
      <TransportOptionRow
        title="Real USSD — Accessibility Mode"
        description="Drives the phone's own USSD pop-up instead. Use this if Direct API gets rejected on your device — see docs/ACCESSIBILITY-TRANSPORT.md."
        selected={settings.transportMode === 'ACCESSIBILITY'}
        onPress={() => setMode('ACCESSIBILITY')}
      />

      {(settings.transportMode === 'ACCESSIBILITY' || settings.transportMode === 'AUTO') && (
        <View style={styles.a11yStatusBox}>
          <Text style={[styles.a11yStatusText, a11yEnabled ? styles.a11yEnabled : styles.a11yDisabled]}>
            {a11yEnabled === null
              ? 'Checking permission status…'
              : a11yEnabled
                ? '✓ Accessibility permission is on.'
                : (settings.transportMode === 'AUTO'
                  ? '✗ Accessibility is off — Auto works without it only if your phone allows the direct API. Turn it on for phones that block it, and for multi-step menus.'
                  : '✗ Accessibility permission is off — required for this mode to work.')}
          </Text>
          <View style={styles.a11yButtonRow}>
            <Pressable style={styles.a11ySecondaryButton} onPress={() => void checkAccessibilityStatus()}>
              <Text style={styles.a11ySecondaryButtonText}>Check again</Text>
            </Pressable>
            <Pressable
              style={styles.a11yPrimaryButton}
              onPress={openA11y}
            >
              <Text style={styles.a11yPrimaryButtonText}>Open Accessibility Settings</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Text style={styles.sectionLabel}>PRIVACY</Text>
      <SettingRow
        title="Accessibility consent"
        description="You agreed to let USSD-UI read your carrier's USSD pop-up to show buttons. Turn this off to withdraw consent (also switch USSD-UI off in system Accessibility settings)."
        value={settings.a11yConsent === true}
        onValueChange={(v) => (v ? openA11y() : settings.setA11yConsent(false))}
      />

      <SettingRow
        title="Catch codes dialled from the Phone app"
        description="Dial *123# in your normal Phone app and USSD-UI takes over the pop-up and shows it as buttons. It only reacts to the phone's own USSD pop-up. Needs Accessibility."
        value={settings.captureFromDialer}
        onValueChange={settings.setCaptureFromDialer}
      />

      <Text style={styles.sectionLabel}>DISPLAY</Text>
      <SettingRow
        title="Buttons over the phone's USSD pop-up"
        description="Hides your phone's own USSD dialog and shows real buttons for each option instead. Needs Accessibility turned on. Turn off to see the plain system pop-up."
        value={settings.showOverlay}
        onValueChange={settings.setShowOverlay}
      />

      {settings.devUnlocked && (
        <>
        <Text style={styles.sectionLabel}>DEVELOPER</Text>
        <SettingRow
          title="Developer mode"
          description="Show the raw-response debug panel during a session."
          value={settings.developerMode}
          onValueChange={settings.setDeveloperMode}
        />
        <SettingRow
          title="Persist raw responses"
          description="Keep raw USSD text in the on-device log after the session ends. Off by default — see Security in the README."
          value={settings.persistRawResponses}
          onValueChange={settings.setPersistRawResponses}
          warning={settings.persistRawResponses}
        />
        <SettingRow
          title="Experimental re-dial on reply"
          description="Direct API only: attempt a best-effort follow-up dial when replying mid-session. Not guaranteed to work — most carriers will reject it. Read docs/ANDROID-USSD-LIMITATIONS.md before enabling."
          value={settings.experimentalContinuation}
          onValueChange={settings.setExperimentalContinuation}
          warning={settings.experimentalContinuation}
        />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  sectionLabel: { ...typography.label, color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  transportRowSelected: { borderColor: colors.accent },
  transportRowText: { flex: 1, marginLeft: spacing.md },
  transportRowTitle: { ...typography.subtitle, color: colors.textPrimary },
  transportRowDescription: { ...typography.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioOuterSelected: { borderColor: colors.accent },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  a11yStatusBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  a11yStatusText: { ...typography.body, fontSize: 13, marginBottom: spacing.sm },
  a11yEnabled: { color: colors.success },
  a11yDisabled: { color: colors.warning },
  a11yButtonRow: { flexDirection: 'row', gap: spacing.sm },
  a11ySecondaryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  a11ySecondaryButtonText: { ...typography.body, fontSize: 12, color: colors.textSecondary },
  a11yPrimaryButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  a11yPrimaryButtonText: { ...typography.body, fontSize: 12, color: '#06120C', fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowText: { flex: 1, marginRight: spacing.md },
  rowTitle: { ...typography.subtitle, color: colors.textPrimary },
  rowDescription: { ...typography.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  warningText: { color: colors.warning },
});
