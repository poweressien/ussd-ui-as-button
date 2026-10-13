// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import { NativeModules } from 'react-native';
import { create } from 'zustand';
import { SimSlotInfo } from '../types/ussd';
import { secureLogger } from '../utils/secureLogger';

const { UssdModule } = NativeModules;

export interface DeviceState {
  simSlots: SimSlotInfo[];
  loading: boolean;
  error?: string;
  refreshSimSlots: () => Promise<void>;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  simSlots: [],
  loading: false,
  error: undefined,

  refreshSimSlots: async () => {
    if (!UssdModule?.getSimSlots) {
      // Demo mode, web preview, or a build without the native module linked yet.
      set({
        simSlots: [
          { slotIndex: 0, subscriptionId: -1, carrierName: 'Demo SIM 1', displayName: 'SIM 1 (Demo)' },
          { slotIndex: 1, subscriptionId: -2, carrierName: 'Demo SIM 2', displayName: 'SIM 2 (Demo)' },
        ],
        loading: false,
        error: undefined,
      });
      return;
    }

    set({ loading: true, error: undefined });
    try {
      const slots: SimSlotInfo[] = await UssdModule.getSimSlots();
      set({ simSlots: slots, loading: false });
    } catch (e) {
      const err = e as { code?: string; message?: string } | undefined;
      secureLogger.warn('deviceStore', `Failed to read SIM slots: ${err?.code ?? 'UNKNOWN'}`);
      const reason =
        err?.code === 'PERMISSION_DENIED'
          ? 'READ_PHONE_STATE permission is not granted — check Settings → Apps → this app → Permissions.'
          : err?.message
            ? `Could not read SIM information: ${err.message}`
            : 'Could not read SIM information from this device.';
      set({ loading: false, error: reason });
    }
  },
}));
