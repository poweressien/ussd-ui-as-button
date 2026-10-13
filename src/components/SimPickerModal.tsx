// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { PressableFx } from './PressableFx';
import { SimSlotInfo } from '../types/ussd';
import { colors, radius, spacing, typography } from '../theme';

interface Props {
  visible: boolean;
  code: string;
  sims: SimSlotInfo[];
  selectedSlot: number;
  onPick: (slotIndex: number) => void;
  onClose: () => void;
}

/** "Dial with which SIM?" sheet, shown whenever the phone has more than one active SIM. */
export function SimPickerModal({ visible, code, sims, selectedSlot, onPick, onClose }: Props): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <Text style={styles.title}>Dial with which SIM?</Text>
          <Text style={styles.code}>{code}</Text>
          {sims.map((sim) => (
            <PressableFx
              key={sim.slotIndex}
              onPress={() => onPick(sim.slotIndex)}
              style={({ pressed }) => [styles.sim, sim.slotIndex === selectedSlot && styles.simLast, pressed && styles.simPressed]}
            >
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{sim.slotIndex + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.simName}>{sim.carrierName && sim.carrierName !== 'Unknown' ? sim.carrierName : sim.displayName}</Text>
                <Text style={styles.simSub}>SIM {sim.slotIndex + 1}{sim.slotIndex === selectedSlot ? ' · used last' : ''}</Text>
              </View>
            </PressableFx>
          ))}
          <PressableFx onPress={onClose} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </PressableFx>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: { ...typography.title, color: colors.textPrimary },
  code: { ...typography.mono, fontSize: 16, color: colors.accent, marginTop: spacing.xs, marginBottom: spacing.md },
  sim: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  simLast: { borderColor: colors.accent },
  simPressed: { backgroundColor: colors.border },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  badgeText: { color: '#06120C', fontWeight: '800', fontSize: 16 },
  simName: { ...typography.subtitle, color: colors.textPrimary },
  simSub: { ...typography.body, fontSize: 12, color: colors.textMuted },
  cancel: { alignItems: 'center', paddingVertical: spacing.md },
  cancelText: { ...typography.subtitle, color: colors.textSecondary },
});
