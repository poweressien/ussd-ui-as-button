// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PressableFx } from '../components/PressableFx';
import { useNavigation } from '../navigation/RootNavigator';
import { useSettingsStore } from '../state/settingsStore';
import { useDeviceStore } from '../state/deviceStore';
import { UssdSessionManager } from '../engine/UssdSessionManager';
import { useA11yOpener } from '../utils/useA11yOpener';
import { A11yStatus, statusWithRepair } from '../transport/a11yHealth';
import { DialPad } from '../components/DialPad';
import { SimPickerModal } from '../components/SimPickerModal';
import { appendKey, backspace, BUILTIN_CATEGORIES, CategoryId, isDialable, QuickCode } from '../data/quickCodes';
import { colors, radius, spacing, typography } from '../theme';

export function HomeScreen(): React.JSX.Element {
  const { navigate } = useNavigation();
  const [code, setCode] = useState('');
  const [category, setCategory] = useState<CategoryId>('banks');
  const [pending, setPending] = useState<string | null>(null); // code waiting for a SIM choice
  const transportMode = useSettingsStore((s) => s.transportMode);
  const selectedSimSlot = useSettingsStore((s) => s.selectedSimSlot);
  const setSelectedSimSlot = useSettingsStore((s) => s.setSelectedSimSlot);
  const experimentalContinuation = useSettingsStore((s) => s.experimentalContinuation);
  const showOverlay = useSettingsStore((s) => s.showOverlay);
  const lastWorkingChannel = useSettingsStore((s) => s.lastWorkingChannel);
  const lastWorkingChannelAt = useSettingsStore((s) => s.lastWorkingChannelAt);
  const setLastWorkingChannel = useSettingsStore((s) => s.setLastWorkingChannel);
  const customCodes = useSettingsStore((s) => s.customCodes);
  const addCustomCode = useSettingsStore((s) => s.addCustomCode);
  const removeCustomCode = useSettingsStore((s) => s.removeCustomCode);
  const simSlots = useDeviceStore((s) => s.simSlots);
  const refreshSimSlots = useDeviceStore((s) => s.refreshSimSlots);

  useEffect(() => {
    void refreshSimSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Accessibility health: checked (and self-repaired when permitted) on open and every time the app returns to the front.
  const [a11y, setA11y] = useState<A11yStatus | null>(null);
  const checkA11y = React.useCallback(() => {
    if (transportMode === 'DEMO') {
      setA11y(null);
      return;
    }
    void statusWithRepair().then(setA11y);
  }, [transportMode]);
  useEffect(() => {
    checkA11y();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') checkA11y();
    });
    return () => sub.remove();
  }, [checkA11y]);

  const openA11y = useA11yOpener();
  const sims = useMemo(() => [...simSlots].sort((a, b) => a.slotIndex - b.slotIndex), [simSlots]);
  const askSim = transportMode !== 'DEMO' && sims.length > 1;

  const start = async (dialCode: string, slot: number) => {
    const trimmed = dialCode.trim();
    if (!trimmed) return;
    // Remember which channel worked, but only trust that for a week — a
    // carrier/OS update can unblock the direct API again.
    const fresh = Date.now() - lastWorkingChannelAt < 7 * 24 * 60 * 60 * 1000;
    UssdSessionManager.get().configureTransport(transportMode, experimentalContinuation, {
      preferred: fresh ? lastWorkingChannel : null,
      onChannelWorked: (channel) => {
        if (channel !== lastWorkingChannel) setLastWorkingChannel(channel);
      },
    }, showOverlay);
    navigate('Session');
    await UssdSessionManager.get().start(trimmed, slot);
  };

  /** Every dial goes through here: two SIMs -> ask which one first. */
  const requestDial = (dialCode: string) => {
    const c = dialCode.trim();
    if (!c) return;
    if (!isDialable(c)) {
      Alert.alert('Not a USSD code', 'Use digits, * and # only, for example *123#.');
      return;
    }
    if (askSim) setPending(c);
    else void start(c, sims.length === 1 ? sims[0].slotIndex : selectedSimSlot);
  };

  const pickSim = (slot: number) => {
    const c = pending;
    setPending(null);
    if (!c) return;
    setSelectedSimSlot(slot);
    void start(c, slot);
  };

  const list: QuickCode[] =
    category === 'mine' ? customCodes : BUILTIN_CATEGORIES.find((c) => c.id === category)?.codes ?? [];
  const tabs: { id: CategoryId; title: string }[] = [
    ...BUILTIN_CATEGORIES.map((c) => ({ id: c.id as CategoryId, title: c.title })),
    { id: 'mine', title: `Mine${customCodes.length ? ` (${customCodes.length})` : ''}` },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <PressableFx onPress={() => navigate('SimSelector')} style={styles.simPill}>
            <Text style={styles.simPillText}>
              {sims.length > 1 ? `${sims.length} SIMs · asks each time` : `SIM ${selectedSimSlot + 1}`}
            </Text>
          </PressableFx>
        </View>

        {(a11y === 'STALE' || a11y === 'OFF') && (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>
              {a11y === 'STALE' ? 'Buttons paused: Android stopped the service' : 'Buttons are off: Accessibility not enabled'}
            </Text>
            <Text style={styles.bannerText}>
              Codes still dial, but you will see the phone's own screen. Open Accessibility settings and switch USSD-UI
              {a11y === 'STALE' ? ' OFF, then ON.' : ' ON.'}
            </Text>
            <View style={styles.bannerRow}>
              <PressableFx
                onPress={openA11y}
                style={styles.bannerBtn}
              >
                <Text style={styles.bannerBtnText}>Open settings</Text>
              </PressableFx>
              <PressableFx onPress={checkA11y} style={styles.bannerBtnAlt}>
                <Text style={styles.bannerBtnAltText}>Check again</Text>
              </PressableFx>
            </View>
          </View>
        )}

        <View style={styles.display}>
          <Text style={[styles.displayText, !code && styles.displayPlaceholder]} numberOfLines={1} adjustsFontSizeToFit>
            {code || 'Enter USSD code'}
          </Text>
          {isDialable(code) && (
            <PressableFx
              onPress={() => {
                addCustomCode(code);
                setCategory('mine');
              }}
              style={styles.saveBtn}
              accessibilityLabel="Save to Mine"
            >
              <Text style={styles.saveText}>☆ Save</Text>
            </PressableFx>
          )}
        </View>

        <DialPad
          onKey={(k) => setCode((c) => appendKey(c, k))}
          onBackspace={() => setCode((c) => backspace(c))}
          onClear={() => setCode('')}
          onCall={() => requestDial(code)}
          canCall={code.length >= 2}
        />

        <Text style={styles.quickLabel}>QUICK ACCESS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {tabs.map((t) => (
            <PressableFx key={t.id} onPress={() => setCategory(t.id)} style={[styles.tab, category === t.id && styles.tabActive]}>
              <Text style={[styles.tabText, category === t.id && styles.tabTextActive]}>{t.title}</Text>
            </PressableFx>
          ))}
        </ScrollView>

        {list.length === 0 ? (
          <Text style={styles.empty}>Nothing saved yet. Type a code on the dial pad and tap ☆ Save.</Text>
        ) : (
          <View style={styles.grid}>
            {list.map((q) => (
              <PressableFx
                key={q.code}
                onPress={() => requestDial(q.code)}
                onLongPress={
                  category === 'mine'
                    ? () => Alert.alert('Remove code?', q.code, [
                        { text: 'Keep', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: () => removeCustomCode(q.code) },
                      ])
                    : () => setCode(q.code)
                }
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              >
                <Text style={styles.cardLabel} numberOfLines={1}>{q.label}</Text>
                <Text style={styles.cardCode}>{q.code}</Text>
              </PressableFx>
            ))}
          </View>
        )}
        <Text style={styles.hint}>
          Tap to dial · hold to {category === 'mine' ? 'remove' : 'copy to the dial pad'}
        </Text>

      </ScrollView>

      <SimPickerModal
        visible={pending !== null}
        code={pending ?? ''}
        sims={sims}
        selectedSlot={selectedSimSlot}
        onPick={pickSim}
        onClose={() => setPending(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: spacing.md },
  simPill: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.accent, paddingVertical: 4, paddingHorizontal: spacing.md },
  simPillText: { ...typography.label, color: colors.accent, textTransform: 'none' },
  banner: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bannerTitle: { ...typography.subtitle, fontSize: 14, color: colors.warning },
  bannerText: { ...typography.body, fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  bannerRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  bannerBtn: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: spacing.md },
  bannerBtnText: { color: '#06120C', fontWeight: '700', fontSize: 12 },
  bannerBtnAlt: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: spacing.md },
  bannerBtnAltText: { color: colors.textSecondary, fontSize: 12 },
  display: {
    minHeight: 76,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  displayText: { flex: 1, color: colors.textPrimary, fontSize: 34, fontFamily: 'monospace', textAlign: 'center' },
  displayPlaceholder: { color: colors.textMuted, fontSize: 18 },
  saveBtn: { paddingVertical: spacing.xs, paddingLeft: spacing.sm },
  saveText: { ...typography.label, color: colors.accent, textTransform: 'none', fontSize: 13 },
  quickLabel: { ...typography.label, color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm },
  tabRow: { gap: spacing.sm, paddingBottom: spacing.sm },
  tab: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingVertical: 6, paddingHorizontal: spacing.md },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { ...typography.body, fontSize: 13, color: colors.textSecondary },
  tabTextActive: { color: '#06120C', fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  card: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  cardPressed: { backgroundColor: colors.border },
  cardLabel: { ...typography.subtitle, fontSize: 14, color: colors.textPrimary },
  cardCode: { ...typography.mono, fontSize: 15, color: colors.accent, marginTop: 2 },
  empty: { ...typography.body, fontSize: 13, color: colors.textMuted, paddingVertical: spacing.md },
  hint: { ...typography.body, fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md },
});
