// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenMessage } from '../types/ussd';
import { colors, radius, spacing, typography } from '../theme';

interface Props {
  screen?: ScreenMessage;
}

function describeComponent(c: ScreenMessage['components'][number]): string {
  switch (c.type) {
    case 'button':
      return `[ Button ]  input="${c.input}"  label="${c.label}"`;
    case 'input':
      return `[ Input ]   type=${c.inputType}${c.sensitive ? ' (sensitive)' : ''}  title="${c.title}"`;
    case 'confirm':
      return `[ Confirm ] confirm="${c.confirmInput}" cancel="${c.cancelInput}"`;
    case 'text':
      return `[ Text ]    "${c.text}"`;
    default:
      return '[ Unknown component ]';
  }
}

/**
 * This is the panel referenced in spec section 8: it exists to prove, in
 * plain sight, that the buttons on screen were generated from the network's
 * own text — not hand-authored or faked. Collapsed by default so it doesn't
 * clutter the normal user flow; only shown at all when Developer Mode is on
 * (see SettingsScreen / DeveloperScreen).
 */
export function RawResponsePanel({ screen }: Props): React.JSX.Element | null {
  const [expanded, setExpanded] = useState(false);
  if (!screen) return null;

  return (
    <View style={styles.container}>
      <Pressable onPress={() => setExpanded((e) => !e)} style={styles.header}>
        <Text style={styles.headerText}>RAW USSD RESPONSE {expanded ? '▲' : '▼'}</Text>
        <Text style={styles.parsedByText}>parsed by: {screen.parsedBy}</Text>
      </Pressable>

      {expanded && (
        <ScrollView style={styles.body} nestedScrollEnabled>
          <Text style={styles.sectionLabel}>RAW RESPONSE</Text>
          <Text style={styles.rawText}>{screen.raw}</Text>

          <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>PARSED UI</Text>
          {screen.components.map((c, i) => (
            <Text key={i} style={styles.componentLine}>
              {describeComponent(c)}
            </Text>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  headerText: { ...typography.label, color: colors.textSecondary },
  parsedByText: { ...typography.label, color: colors.textMuted, textTransform: 'none' },
  body: { maxHeight: 220, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  sectionLabel: { ...typography.label, color: colors.accent, marginBottom: spacing.xs },
  rawText: { ...typography.mono, color: colors.textPrimary, backgroundColor: colors.bg, padding: spacing.sm, borderRadius: radius.sm },
  componentLine: { ...typography.mono, color: colors.textSecondary, marginBottom: 2 },
});
