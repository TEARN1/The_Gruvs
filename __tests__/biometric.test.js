import { Biometric } from '../src/services/biometric';
import AsyncStorage from '@react-native-async-storage/async-storage';

// expo-local-authentication + AsyncStorage are mocked in jest.setup.js.
// These tests lock in the critical "fail-open" guarantee: the app must never
// lock a user out when biometrics are unavailable or error.
describe('Biometric (fail-open security)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('isAvailable is false when there is no hardware / enrollment', async () => {
    await expect(Biometric.isAvailable()).resolves.toBe(false);
  });

  it('authenticate FAILS OPEN (returns true) when biometrics are unavailable', async () => {
    await expect(Biometric.authenticate()).resolves.toBe(true);
  });

  it('app lock is OFF by default and persists when toggled', async () => {
    await expect(Biometric.isLockEnabled()).resolves.toBe(false);
    await Biometric.setLockEnabled(true);
    await expect(Biometric.isLockEnabled()).resolves.toBe(true);
    await Biometric.setLockEnabled(false);
    await expect(Biometric.isLockEnabled()).resolves.toBe(false);
  });

  it('guard never blocks when the lock is disabled', async () => {
    await expect(Biometric.guard()).resolves.toBe(true);
  });

  it('exposes a human-readable biometric label', async () => {
    await expect(Biometric.label()).resolves.toEqual(expect.any(String));
  });
});
