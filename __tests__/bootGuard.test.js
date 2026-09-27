import AsyncStorage from '@react-native-async-storage/async-storage';
import { recordCriticalCrash, shouldEnterSafeMode, clearCrashLog } from '../src/utils/bootGuard';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('bootGuard', () => {
  it('does not trip with no recorded crashes', async () => {
    expect(await shouldEnterSafeMode()).toBe(false);
  });

  it('does not trip after fewer than the threshold', async () => {
    await recordCriticalCrash();
    await recordCriticalCrash();
    expect(await shouldEnterSafeMode()).toBe(false);
  });

  it('trips after the threshold is reached within the window', async () => {
    await recordCriticalCrash();
    await recordCriticalCrash();
    await recordCriticalCrash();
    expect(await shouldEnterSafeMode()).toBe(true);
  });

  it('ignores crashes older than the trip window', async () => {
    const old = Date.now() - 10 * 60 * 1000; // 10 minutes ago
    await AsyncStorage.setItem('gruvs_boot_crashes', JSON.stringify([old, old, old]));
    expect(await shouldEnterSafeMode()).toBe(false);
  });

  it('caps the log at 10 entries', async () => {
    for (let i = 0; i < 15; i++) await recordCriticalCrash();
    const raw = await AsyncStorage.getItem('gruvs_boot_crashes');
    expect(JSON.parse(raw).length).toBe(10);
  });

  it('clearCrashLog resets the trip state', async () => {
    await recordCriticalCrash();
    await recordCriticalCrash();
    await recordCriticalCrash();
    expect(await shouldEnterSafeMode()).toBe(true);
    await clearCrashLog();
    expect(await shouldEnterSafeMode()).toBe(false);
  });

  it('fails open (never trips) if storage is unreadable', async () => {
    const spy = jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('storage broken'));
    expect(await shouldEnterSafeMode()).toBe(false);
    spy.mockRestore();
  });
});
