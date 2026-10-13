// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import { useSettingsStore } from '../state/settingsStore';
import { UssdSessionManager } from './UssdSessionManager';

/** Point the session manager at the transport the person's current settings call for. */
export function configureFromSettings(): void {
  const s = useSettingsStore.getState();
  const fresh = Date.now() - s.lastWorkingChannelAt < 7 * 24 * 60 * 60 * 1000;
  UssdSessionManager.get().configureTransport(
    s.transportMode,
    s.experimentalContinuation,
    {
      preferred: fresh ? s.lastWorkingChannel : null,
      onChannelWorked: (channel) => {
        if (channel !== s.lastWorkingChannel) s.setLastWorkingChannel(channel);
      },
    },
    s.showOverlay
  );
}
