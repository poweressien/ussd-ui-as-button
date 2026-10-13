// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { ScreenMessage, UssdButtonComponent } from '../types/ussd';
import { colors, spacing, typography } from '../theme';
import { UssdButton } from './UssdButton';
import { UssdSelect } from './UssdSelect';
import { UssdInput } from './UssdInput';
import { UssdConfirm } from './UssdConfirm';
import { UssdSuccess } from './UssdSuccess';
import { UssdError } from './UssdError';

interface Props {
  screen: ScreenMessage;
  onSubmit: (input: string) => void;
  disabled?: boolean;
}

/** Beyond this many options, a picker reads better than a stacked list. */
const SELECT_THRESHOLD = 6;

export function UssdScreen({ screen, onSubmit, disabled }: Props): React.JSX.Element {
  if (screen.type === 'terminal') {
    return <UssdSuccess message={screen.raw} onDone={() => {}} />;
  }

  if (screen.type === 'error') {
    return <UssdError rawMessage={screen.raw} onDismiss={() => {}} />;
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.heading}>{screen.title}</Text>

      {screen.components.map((component, index) => {
        switch (component.type) {
          case 'button': {
            const buttons = screen.components.filter((c): c is UssdButtonComponent => c.type === 'button');
            // Render the whole button group once, as a picker, the first
            // time we hit a button component — skip subsequent buttons in
            // this map so we don't duplicate them.
            if (buttons.length > SELECT_THRESHOLD) {
              if (index !== screen.components.indexOf(buttons[0])) return null;
              return <UssdSelect key="select-group" options={buttons} onSelect={onSubmit} />;
            }
            return <UssdButton key={component.id} component={component} onPress={onSubmit} disabled={disabled} />;
          }
          case 'input':
            return <UssdInput key={component.id} component={component} onSubmit={onSubmit} disabled={disabled} />;
          case 'confirm':
            return (
              <UssdConfirm
                key={component.id}
                component={component}
                onConfirm={onSubmit}
                onCancel={onSubmit}
                disabled={disabled}
              />
            );
          case 'text':
            return (
              <Text key={component.id} style={styles.plainText}>
                {component.text}
              </Text>
            );
          default:
            return null;
        }
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  // flexGrow + justifyContent: short menus sit in the middle of the screen, long ones scroll.
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  heading: { ...typography.title, color: colors.textPrimary, marginBottom: spacing.lg, textAlign: 'center' },
  plainText: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md, textAlign: 'center' },
});
