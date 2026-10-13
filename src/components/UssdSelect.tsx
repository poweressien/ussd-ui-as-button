// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { UssdButtonComponent } from '../types/ussd';
import { colors, radius, spacing, typography } from '../theme';

interface Props {
  /** Same button components UssdScreen would otherwise stack vertically. */
  options: UssdButtonComponent[];
  onSelect: (input: string) => void;
  placeholder?: string;
}

function Separator(): React.JSX.Element {
  return <View style={styles.separator} />;
}

/**
 * UssdScreen switches to this instead of a plain button stack once a menu
 * gets long (see UssdScreen's SELECT_THRESHOLD) — a 12-option data-bundle
 * menu reads a lot better as a picker than as twelve stacked buttons.
 */
export function UssdSelect({ options, onSelect, placeholder = 'Choose an option' }: Props): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Pressable
        style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
      >
        <Text style={styles.triggerText}>{placeholder}</Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <FlatList
              data={options}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                  onPress={() => {
                    setOpen(false);
                    onSelect(item.input);
                  }}
                >
                  <View style={styles.optionBadge}>
                    <Text style={styles.optionBadgeText}>{item.input}</Text>
                  </View>
                  <Text style={styles.optionLabel}>{item.label}</Text>
                </Pressable>
              )}
              ItemSeparatorComponent={Separator}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  triggerPressed: { backgroundColor: colors.border },
  triggerText: { ...typography.body, color: colors.textPrimary },
  chevron: { color: colors.textSecondary, fontSize: 16 },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '70%',
    paddingVertical: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  optionPressed: { backgroundColor: colors.surfaceRaised },
  optionBadge: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  optionBadgeText: { color: colors.textPrimary, fontSize: 12, fontWeight: '700' },
  optionLabel: { ...typography.body, color: colors.textPrimary },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: spacing.lg + 26 + spacing.md },
});
