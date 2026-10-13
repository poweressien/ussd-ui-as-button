// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import React, { useEffect } from 'react';
import { BackHandler, Platform, StatusBar, StyleSheet, View } from 'react-native';
import { NavigationProvider, useNavigation } from './src/navigation/RootNavigator';
import { HomeScreen } from './src/screens/HomeScreen';
import { UssdSessionScreen } from './src/screens/UssdSessionScreen';
import { SimSelectorScreen } from './src/screens/SimSelectorScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { DeveloperScreen } from './src/screens/DeveloperScreen';
import { ConsentScreen } from './src/screens/ConsentScreen';
import { AboutScreen } from './src/screens/AboutScreen';
import { AppHeader } from './src/components/AppHeader';
import { PassiveCapture } from './src/components/PassiveCapture';
import { useSettingsStore } from './src/state/settingsStore';
import { colors } from './src/theme';

function Router(): React.JSX.Element {
  const { route, canGoBack, goBack } = useNavigation();
  const hydrated = useSettingsStore((s) => s.hydrated);
  const consent = useSettingsStore((s) => s.a11yConsent);

  // The phone's own Back button/gesture steps back through the app instead of closing it.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) return false;
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [canGoBack, goBack]);

  if (!hydrated) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  // First launch: show the disclosure before anything else (Google Play requirement).
  if (route === 'Home' && consent === null) return <ConsentScreen />;

  let body: React.JSX.Element;
  switch (route) {
    case 'Session':
      return <UssdSessionScreen />; // has its own top bar
    case 'Consent':
      return <ConsentScreen />;
    case 'SimSelector':
      body = <SimSelectorScreen />;
      break;
    case 'Settings':
      body = <SettingsScreen />;
      break;
    case 'Developer':
      body = <DeveloperScreen />;
      break;
    case 'About':
      body = <AboutScreen />;
      break;
    default:
      body = <HomeScreen />;
  }
  return (
    <View style={{ flex: 1 }}>
      <AppHeader />
      {body}
    </View>
  );
}

export default function App(): React.JSX.Element {
  const hydrate = useSettingsStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      {/* A solid, bordered strip behind the phone's clock/network/battery icons so the app never runs into them. */}
      <View style={[styles.statusStrip, { height: Platform.OS === 'android' ? Math.max(StatusBar.currentHeight ?? 0, 24) : 0 }]} />
      <NavigationProvider>
        <PassiveCapture />
        <Router />
      </NavigationProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  statusStrip: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.accent },
});
