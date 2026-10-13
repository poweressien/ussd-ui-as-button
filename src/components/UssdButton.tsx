// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFx } from './PressableFx';
import { UssdButtonComponent } from '../types/ussd';
import { colors, radius, spacing, typography } from '../theme';

interface Props {
  component: UssdButtonComponent;
  onPress: (input: string) => void;
  disabled?: boolean;
}

/**
 * Renders one menu option. The digit badge on the left is exactly the
 * `input` value the parser read from the network's own numbering — never a
 * hardcoded position — so what's sent always matches what's shown.
 */
export function UssdButton({ component, onPress, disabled }: Props): React.JSX.Element {
  return (
    <PressableFx
      onPress={() => onPress(component.input)}
      disabled={disabled}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={component.label}
    >
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{component.input}</Text>
      </View>
      <Text style={styles.label}>{component.label}</Text>
    </PressableFx>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  pressed: {
    backgroundColor: colors.border,
  },
  disabled: {
    opacity: 0.4,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  badgeText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  label: {
    ...typography.body,
    color: colors.textPrimary,
    flexShrink: 1,
  },
});
