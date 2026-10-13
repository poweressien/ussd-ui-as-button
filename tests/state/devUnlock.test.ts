jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
}));
import { useSettingsStore } from '../../src/state/settingsStore';

describe('developer tools stay hidden for normal users', () => {
  it('are locked by default', () => {
    expect(useSettingsStore.getState().devUnlocked).toBe(false);
    expect(useSettingsStore.getState().developerMode).toBe(false);
  });
  it('locking again also turns the debug panel off', () => {
    const s = useSettingsStore.getState();
    s.setDevUnlocked(true);
    s.setDeveloperMode(true);
    expect(useSettingsStore.getState().devUnlocked).toBe(true);
    s.setDevUnlocked(false);
    expect(useSettingsStore.getState().devUnlocked).toBe(false);
    expect(useSettingsStore.getState().developerMode).toBe(false);
  });
});
