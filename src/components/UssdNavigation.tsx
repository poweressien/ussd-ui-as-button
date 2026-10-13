// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { UssdSessionState } from '../types/ussd';
import { colors, radius, spacing, typography } from '../theme';

interface Props {
  code: string;
  sessionState: UssdSessionState;
  transportMode: 'REAL' | 'DEMO';
  showBack: boolean;
  showCancel: boolean;
  onBack: () => void;
  onCancel: () => void;
}

const STATUS_LABEL: Record<UssdSessionState, string> = {
  IDLE: 'Idle',
  STARTING: 'Starting…',
  WAITING_FOR_RESPONSE: 'Waiting for network…',
  DISPLAYING_SCREEN: 'Connected',
  SENDING_INPUT: 'Sending…',
  SUCCESS: 'Complete',
  FAILED: 'Failed',
  TIMEOUT: 'Timed out',
  CANCELLED: 'Cancelled',
  UNSUPPORTED: 'Not supported',
};

export function UssdNavigation({
  code,
  sessionState,
  transportMode,
  showBack,
  showCancel,
  onBack,
  onCancel,
}: Props): React.JSX.Element {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {showBack ? (
          <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
            <Text style={styles.iconButton}>‹</Text>
          </Pressable>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}
      </View>

      <View style={styles.center}>
        <View style={styles.titleRow}>
          <Text style={styles.code}>{code}</Text>
          <View style={[styles.modeBadge, transportMode === 'DEMO' && styles.demoBadge]}>
            <Text style={styles.modeBadgeText}>{transportMode === 'DEMO' ? 'DEMO' : 'LIVE'}</Text>
          </View>
        </View>
        <Text style={styles.status}>{STATUS_LABEL[sessionState]}</Text>
      </View>

      <View style={styles.right}>
        {showCancel ? (
          <Pressable onPress={onCancel} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cancel session">
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  left: { width: 44, alignItems: 'flex-start' },
  right: { width: 60, alignItems: 'flex-end' },
  iconPlaceholder: { width: 24, height: 24 },
  iconButton: { fontSize: 28, color: colors.textPrimary, lineHeight: 28 },
  center: { flex: 1, alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  code: { ...typography.subtitle, color: colors.textPrimary, fontFamily: 'monospace' },
  status: { ...typography.body, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  modeBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.accentMuted,
  },
  demoBadge: { backgroundColor: colors.warning },
  modeBadgeText: { fontSize: 10, fontWeight: '700', color: '#06120C' },
  cancelText: { color: colors.danger, fontWeight: '600', fontSize: 14 },
});
