// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { UssdError as UssdErrorType } from '../types/ussd';
import { useA11yOpener } from '../utils/useA11yOpener';
import { colors, radius, spacing, typography } from '../theme';

interface Props {
  error?: UssdErrorType;
  rawMessage?: string;
  onDismiss: () => void;
}

/**
 * Renders both real network/session failures AND the honest
 * UNSUPPORTED_CONTINUATION case (see NativeUssdTransport) with a visibly
 * different tone/copy — "not supported" is not the same situation as "the
 * network rejected this," and the UI should never blur that distinction.
 */
export function UssdError({ error, rawMessage, onDismiss }: Props): React.JSX.Element {
  const openA11y = useA11yOpener();
  const isUnsupported = error?.code === 'UNSUPPORTED_CONTINUATION';
  const needsA11y = error?.code === 'ACCESSIBILITY_NOT_ENABLED' || error?.code === 'ACCESSIBILITY_STALE' || error?.code === 'ASSISTED_DIALER';

  return (
    <View style={[styles.container, isUnsupported && styles.unsupportedContainer]}>
      <Text style={styles.icon}>{isUnsupported ? '🛈' : '⚠'}</Text>
      <Text style={styles.title}>{isUnsupported ? 'Not supported on this device' : 'Session ended'}</Text>
      <Text style={styles.message}>{error?.message ?? rawMessage ?? 'The session ended without a reply from the network. Please try again.'}</Text>
      {isUnsupported && (
        <Text style={styles.subMessage}>
          This isn't a bug — Android's public API often can't reply inside an open USSD session. Auto mode with
          Accessibility turned on gets around this. See docs/RESTRICTION-WORKAROUNDS.md.
        </Text>
      )}
      {needsA11y && (
        <Pressable
          onPress={openA11y}
          style={({ pressed }) => [styles.dismiss, styles.primaryAction, pressed && styles.dismissPressed]}
        >
          <Text style={styles.primaryActionText}>{error?.code === 'ACCESSIBILITY_STALE' ? 'Open Accessibility settings (switch OFF → ON)' : 'Turn on Accessibility Mode'}</Text>
        </Pressable>
      )}
      <Pressable onPress={onDismiss} style={({ pressed }) => [styles.dismiss, pressed && styles.dismissPressed]}>
        <Text style={styles.dismissText}>Close</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.lg,
    margin: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  unsupportedContainer: { borderColor: colors.warning },
  icon: { fontSize: 28, marginBottom: spacing.sm },
  title: { ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.xs },
  message: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  subMessage: {
    ...typography.body,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  dismiss: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  dismissPressed: { opacity: 0.7 },
  primaryAction: { backgroundColor: colors.accent },
  primaryActionText: { color: '#06120C', fontWeight: '700' },
  dismissText: { color: colors.textPrimary, fontWeight: '600' },
});
