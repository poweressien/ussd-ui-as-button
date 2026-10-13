// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import React from 'react';
import { NativeModules, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '../navigation/RootNavigator';
import { useSettingsStore } from '../state/settingsStore';
import { colors, radius, spacing, typography } from '../theme';

/**
 * Prominent disclosure + consent for the Accessibility service (Google Play policy).
 * Shown on first launch, before anything asks for the permission, and again whenever
 * the person has not agreed and tries to turn buttons on.
 */
export function ConsentScreen(): React.JSX.Element {
  const { canGoBack, goBack } = useNavigation();
  const setConsent = useSettingsStore((s) => s.setA11yConsent);

  const answer = (agreed: boolean) => {
    setConsent(agreed);
    if (agreed) void NativeModules.UssdAccessibilityModule?.openAccessibilitySettings?.();
    if (canGoBack) goBack();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Turn USSD menus into buttons</Text>
        <Text style={styles.lead}>
          To show your carrier's USSD menu as tappable buttons, USSD-UI needs your permission to use Android's
          Accessibility service. Please read what that means:
        </Text>

        <Block heading="What it reads">
          Only the text of your phone's own USSD pop-up (the box titled "Carrier info" or "USSD message"), whether you
          dialled from this app or from the regular Phone app. It looks at nothing else: not your other apps,
          messages, passwords or screens.
        </Block>
        <Block heading="What it does">
          Shows that pop-up's options as buttons. When you tap one, it types your choice into the pop-up and presses
          Send, exactly as you would by hand. If you dial from the Phone app, it takes over that pop-up and shows the buttons. You can turn this off in Settings ("Catch codes dialled from the Phone app").
        </Block>
        <Block heading="What happens to your data">
          Nothing leaves your phone. This app has no internet permission, no accounts, no analytics and no ads. Menu
          text is used on screen and then discarded. PINs and replies you type are never saved.
        </Block>
        <Block heading="Your control">
          You can say no and still dial codes (you will see the phone's own pop-up instead of buttons). You can switch
          the service off at any time in Settings → Accessibility → USSD-UI.
        </Block>
      </ScrollView>

      <View style={styles.actions}>
        <Pressable onPress={() => answer(true)} style={styles.agree} accessibilityRole="button">
          <Text style={styles.agreeText}>I agree — continue</Text>
        </Pressable>
        <Pressable onPress={() => answer(false)} style={styles.decline} accessibilityRole="button">
          <Text style={styles.declineText}>No thanks</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Block({ heading, children }: { heading: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <View style={styles.block}>
      <Text style={styles.blockHeading}>{heading}</Text>
      <Text style={styles.blockBody}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg },
  title: { ...typography.title, fontSize: 24, color: colors.textPrimary, marginBottom: spacing.sm },
  lead: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  block: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  blockHeading: { ...typography.label, color: colors.accent, marginBottom: 4 },
  blockBody: { ...typography.body, fontSize: 14, color: colors.textPrimary },
  actions: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  agree: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  agreeText: { color: '#06120C', fontWeight: '700', fontSize: 16 },
  decline: { alignItems: 'center', paddingVertical: spacing.md },
  declineText: { ...typography.subtitle, color: colors.textSecondary },
});
