// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '../navigation/RootNavigator';
import { currentScreenFrom, useUssdStore } from '../state/ussdStore';
import { useSettingsStore } from '../state/settingsStore';
import { UssdSessionManager } from '../engine/UssdSessionManager';
import { UssdSessionState } from '../types/ussd';
import { UssdNavigation } from '../components/UssdNavigation';
import { UssdScreen } from '../components/UssdScreen';
import { UssdLoading } from '../components/UssdLoading';
import { UssdError } from '../components/UssdError';
import { UssdSuccess } from '../components/UssdSuccess';
import { RawResponsePanel } from '../components/RawResponsePanel';
import { colors } from '../theme';

const BUSY_STATES = new Set([UssdSessionState.STARTING, UssdSessionState.WAITING_FOR_RESPONSE, UssdSessionState.SENDING_INPUT]);
const ERROR_STATES = new Set([
  UssdSessionState.FAILED,
  UssdSessionState.TIMEOUT,
  UssdSessionState.CANCELLED,
  UssdSessionState.UNSUPPORTED,
]);

export function UssdSessionScreen(): React.JSX.Element {
  const { goBack } = useNavigation();
  // Raw-response panel is a developer-only tool: needs the hidden unlock AND the switch.
  const developerMode = useSettingsStore((s) => s.developerMode && s.devUnlocked);
  const sessionState = useUssdStore((s) => s.sessionState);
  const code = useUssdStore((s) => s.code);
  const transportMode = useUssdStore((s) => s.transportMode);
  const stepIndex = useUssdStore((s) => s.stepIndex);
  const lastError = useUssdStore((s) => s.lastError);
  const screen = useUssdStore((s) => currentScreenFrom(s));

  const manager = UssdSessionManager.get();

  useEffect(() => {
    // Leaving the session screen while a session is still open should end it
    // cleanly rather than leaving a dangling native session behind.
    return () => {
      const st = useUssdStore.getState().sessionState;
      if (BUSY_STATES.has(st) || st === UssdSessionState.DISPLAYING_SCREEN) {
        void manager.cancel();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (input: string) => {
    void manager.submit(input);
  };

  const renderBody = () => {
    if (ERROR_STATES.has(sessionState)) {
      // FAILED can come from two different places: a real network response
      // that the parser itself classified as an error (e.g. "Invalid
      // selection") — in which case `screen` holds the network's own text
      // and that's what should be shown — or an actual transport-level
      // failure (timeout, cancel, USSD_ERROR_SERVICE_UNAVAIL) where there's
      // no such screen and `lastError` is the real source of truth. Showing
      // the generic "unknown error" fallback for the first case was the bug.
      if (sessionState === UssdSessionState.FAILED && screen?.isError) {
        return <UssdError rawMessage={screen.raw} onDismiss={goBack} />;
      }
      if (sessionState === UssdSessionState.CANCELLED && !lastError) {
        return <UssdError rawMessage="Session cancelled. Nothing was sent." onDismiss={goBack} />;
      }
      return <UssdError error={lastError} onDismiss={goBack} />;
    }
    if (sessionState === UssdSessionState.SUCCESS && screen) {
      return <UssdSuccess message={screen.raw} onDone={goBack} />;
    }
    if (BUSY_STATES.has(sessionState) && !screen) {
      return <UssdLoading />;
    }
    if (screen) {
      return <UssdScreen screen={screen} onSubmit={handleSubmit} disabled={sessionState === UssdSessionState.SENDING_INPUT} />;
    }
    return <UssdLoading />;
  };

  return (
    <View style={styles.container}>
      <UssdNavigation
        code={code}
        sessionState={sessionState}
        transportMode={transportMode}
        showBack
        onBack={() => {
          // Inside a menu: go up one level. Otherwise leave the session screen (ending the session).
          const inMenu = stepIndex > 0 && !ERROR_STATES.has(sessionState) && sessionState !== UssdSessionState.SUCCESS;
          if (inMenu) {
            manager.goBack();
            return;
          }
          goBack();
        }}
        showCancel={BUSY_STATES.has(sessionState) || sessionState === UssdSessionState.DISPLAYING_SCREEN}
        onCancel={() => void manager.cancel()}
      />
      <View style={styles.body}>{renderBody()}</View>
      {developerMode && <RawResponsePanel screen={screen} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, justifyContent: 'center' },
});
