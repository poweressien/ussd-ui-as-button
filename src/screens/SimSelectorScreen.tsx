// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDeviceStore } from '../state/deviceStore';
import { useSettingsStore } from '../state/settingsStore';
import { ProfileManager } from '../profiles/ProfileManager';
import { colors, radius, spacing, typography } from '../theme';

export function SimSelectorScreen(): React.JSX.Element {
  const { simSlots, loading, error, refreshSimSlots } = useDeviceStore();
  const selectedSimSlot = useSettingsStore((s) => s.selectedSimSlot);
  const setSelectedSimSlot = useSettingsStore((s) => s.setSelectedSimSlot);

  useEffect(() => {
    void refreshSimSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.subheading}>USSD sessions will be dialled from this SIM.</Text>

      {loading && <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.lg }} />}
      {error && <Text style={styles.error}>{error}</Text>}

      {simSlots.map((sim) => {
        const isSelected = sim.slotIndex === selectedSimSlot;
        const carrierProfileId = ProfileManager.matchByCarrierName(sim.carrierName);
        return (
          <Pressable
            key={sim.slotIndex}
            onPress={() => setSelectedSimSlot(sim.slotIndex)}
            style={[styles.card, isSelected && styles.cardSelected]}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{sim.displayName}</Text>
              {isSelected && <Text style={styles.selectedBadge}>SELECTED</Text>}
            </View>
            <Text style={styles.cardSubtitle}>{sim.carrierName}</Text>
            {carrierProfileId && <Text style={styles.profileHint}>Matched profile: {carrierProfileId} (sample)</Text>}
          </Pressable>
        );
      })}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  subheading: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  error: { ...typography.body, color: colors.danger, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardSelected: { borderColor: colors.accent },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { ...typography.subtitle, color: colors.textPrimary },
  cardSubtitle: { ...typography.body, color: colors.textSecondary, marginTop: 2 },
  profileHint: { ...typography.label, color: colors.textMuted, marginTop: spacing.xs, textTransform: 'none' },
  selectedBadge: { ...typography.label, color: colors.accent },
});
