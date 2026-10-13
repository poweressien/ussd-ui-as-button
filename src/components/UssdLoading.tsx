// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

interface Props {
  label?: string;
}

export function UssdLoading({ label = 'Waiting for network…' }: Props): React.JSX.Element {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" color={colors.accent} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl, gap: spacing.md },
  label: { ...typography.body, color: colors.textSecondary },
});
