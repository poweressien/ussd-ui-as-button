// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { PressableFx } from './PressableFx';
import { UssdInputComponent } from '../types/ussd';
import { colors, radius, spacing, typography } from '../theme';

interface Props {
  component: UssdInputComponent;
  onSubmit: (value: string) => void;
  disabled?: boolean;
}

export function UssdInput({ component, onSubmit, disabled }: Props): React.JSX.Element {
  const [value, setValue] = useState('');

  const keyboardType = component.inputType === 'numeric' || component.inputType === 'pin' ? 'number-pad' : 'default';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{component.title}</Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={component.placeholder ?? (component.inputType === 'pin' ? '••••' : 'Type your reply')}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        secureTextEntry={component.sensitive}
        style={styles.input}
        autoFocus
        editable={!disabled}
        // Sensitive fields never touch autofill/autocomplete metadata.
        autoComplete={component.sensitive ? 'off' : undefined}
        importantForAutofill={component.sensitive ? 'no' : 'auto'}
      />
      <PressableFx
        onPress={() => value.trim().length > 0 && onSubmit(value.trim())}
        disabled={disabled || value.trim().length === 0}
        style={({ pressed }) => [
          styles.submit,
          (disabled || value.trim().length === 0) && styles.submitDisabled,
          pressed && styles.submitPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Send"
      >
        <Text style={styles.submitText}>Send</Text>
      </PressableFx>
      {component.sensitive && <Text style={styles.hint}>This value is never logged or stored.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  title: { ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  submit: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  submitPressed: { backgroundColor: colors.accentMuted },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: '#06120C', fontWeight: '700', fontSize: 15 },
  hint: { ...typography.label, color: colors.textMuted, marginTop: spacing.xs, textTransform: 'none' },
});
