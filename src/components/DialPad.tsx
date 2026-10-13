// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFx } from './PressableFx';
import { colors, radius, spacing } from '../theme';

const KEYS: { key: string; sub?: string }[][] = [
  [{ key: '1' }, { key: '2', sub: 'ABC' }, { key: '3', sub: 'DEF' }],
  [{ key: '4', sub: 'GHI' }, { key: '5', sub: 'JKL' }, { key: '6', sub: 'MNO' }],
  [{ key: '7', sub: 'PQRS' }, { key: '8', sub: 'TUV' }, { key: '9', sub: 'WXYZ' }],
  [{ key: '*' }, { key: '0', sub: '+' }, { key: '#' }],
];

interface Props {
  onKey: (key: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onCall: () => void;
  canCall: boolean;
}

/** A real dial pad: big keys, letters under the digits, backspace (hold to clear) and a green call key. */
export function DialPad({ onKey, onBackspace, onClear, onCall, canCall }: Props): React.JSX.Element {
  return (
    <View style={styles.pad}>
      {KEYS.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((k) => (
            <PressableFx
              key={k.key}
              onPress={() => onKey(k.key)}
              android_ripple={{ color: colors.border, borderless: false }}
              style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
              accessibilityLabel={`Key ${k.key}`}
            >
              <Text style={styles.keyText}>{k.key}</Text>
              <Text style={styles.keySub}>{k.sub ?? ' '}</Text>
            </PressableFx>
          ))}
        </View>
      ))}
      <View style={styles.row}>
        <View style={styles.cell} />
        <PressableFx
          onPress={onCall}
          disabled={!canCall}
          accessibilityLabel="Dial"
          style={({ pressed }) => [styles.call, !canCall && styles.callDisabled, pressed && styles.callPressed]}
        >
          <Text style={styles.callText}>CALL</Text>
        </PressableFx>
        <PressableFx
          onPress={onBackspace}
          onLongPress={onClear}
          delayLongPress={450}
          accessibilityLabel="Backspace (hold to clear)"
          style={({ pressed }) => [styles.cell, styles.back, pressed && styles.keyPressed]}
        >
          <Text style={styles.backText}>⌫</Text>
        </PressableFx>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  key: {
    flex: 1,
    marginHorizontal: spacing.xs,
    height: 62,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: { backgroundColor: colors.border },
  keyText: { color: colors.textPrimary, fontSize: 26, fontWeight: '600', lineHeight: 30 },
  keySub: { color: colors.textMuted, fontSize: 9, letterSpacing: 1.5, height: 11 },
  cell: { flex: 1, marginHorizontal: spacing.xs, height: 62 },
  back: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg },
  backText: { color: colors.textSecondary, fontSize: 26 },
  call: {
    flex: 1,
    marginHorizontal: spacing.xs,
    height: 62,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callPressed: { backgroundColor: colors.accentMuted },
  callDisabled: { opacity: 0.35 },
  callText: { color: '#06120C', fontWeight: '800', fontSize: 16, letterSpacing: 1 },
});
