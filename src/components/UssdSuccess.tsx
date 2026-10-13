// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

interface Props {
  message: string;
  onDone: () => void;
}

export function UssdSuccess({ message, onDone }: Props): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>✓</Text>
      <Text style={styles.title}>Success</Text>
      <Text style={styles.message}>{message}</Text>
      <Pressable onPress={onDone} style={({ pressed }) => [styles.done, pressed && styles.donePressed]}>
        <Text style={styles.doneText}>Done</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.success,
    padding: spacing.lg,
    margin: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  icon: {
    fontSize: 28,
    color: colors.success,
    marginBottom: spacing.sm,
    fontWeight: '700',
  },
  title: { ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.xs },
  message: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  done: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  donePressed: { backgroundColor: colors.accentMuted },
  doneText: { color: '#06120C', fontWeight: '700' },
});
