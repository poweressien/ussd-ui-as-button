// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFx } from './PressableFx';
import { UssdConfirmComponent } from '../types/ussd';
import { colors, radius, spacing, typography } from '../theme';

interface Props {
  component: UssdConfirmComponent;
  onConfirm: (input: string) => void;
  onCancel: (input: string) => void;
  disabled?: boolean;
}

export function UssdConfirm({ component, onConfirm, onCancel, disabled }: Props): React.JSX.Element {
  return (
    <View>
      <Text style={styles.title}>{component.title}</Text>
      <View style={styles.row}>
        <PressableFx
          onPress={() => onCancel(component.cancelInput)}
          disabled={disabled}
          style={({ pressed }) => [styles.button, styles.cancelButton, pressed && styles.cancelPressed, disabled && styles.disabled]}
          accessibilityRole="button"
        >
          <Text style={styles.cancelText}>{component.cancelLabel}</Text>
        </PressableFx>
        <PressableFx
          onPress={() => onConfirm(component.confirmInput)}
          disabled={disabled}
          style={({ pressed }) => [styles.button, styles.confirmButton, pressed && styles.confirmPressed, disabled && styles.disabled]}
          accessibilityRole="button"
        >
          <Text style={styles.confirmText}>{component.confirmLabel}</Text>
        </PressableFx>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  button: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  disabled: { opacity: 0.4 },
  cancelButton: { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
  cancelPressed: { backgroundColor: colors.border },
  cancelText: { ...typography.body, color: colors.textSecondary, fontWeight: '600' },
  confirmButton: { backgroundColor: colors.accent, borderColor: colors.accent },
  confirmPressed: { backgroundColor: colors.accentMuted },
  confirmText: { ...typography.body, color: '#06120C', fontWeight: '700' },
});
