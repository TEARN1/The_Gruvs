/**
 * biometric — Face ID / Touch ID / fingerprint app lock.
 *
 * Thin wrapper over expo-local-authentication. Every call is guarded so it
 * degrades to a safe "available: false / success: true" on web or any device
 * without enrolled biometrics — the app never locks the user out.
 *
 * Native biometric prompts only fire in a dev/EAS build (not Expo Go web).
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

const LOCK_KEY = '@gruvs/app_lock_enabled';
const IS_WEB = Platform.OS === 'web';

export const Biometric = {
  /** Is hardware present AND a biometric enrolled? */
  async isAvailable() {
    if (IS_WEB) return false;
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && enrolled;
    } catch {
      return false;
    }
  },

  /** Human label for the available method ('Face ID' | 'Fingerprint' | 'Biometrics'). */
  async label() {
    if (IS_WEB) return 'Biometrics';
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID';
      if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'Fingerprint';
      return 'Biometrics';
    } catch {
      return 'Biometrics';
    }
  },

  /** Prompt the user. Returns true on success (or when biometrics unavailable). */
  async authenticate(reason = 'Unlock The Gruvs') {
    if (IS_WEB) return true;
    try {
      if (!(await this.isAvailable())) return true; // never lock out
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        fallbackLabel: 'Use passcode',
        disableDeviceFallback: false,
      });
      return !!res.success;
    } catch {
      return true; // fail-open so a flaky sensor never bricks access
    }
  },

  /** User preference: is the app-lock turned on? */
  async isLockEnabled() {
    try { return (await AsyncStorage.getItem(LOCK_KEY)) === '1'; } catch { return false; }
  },

  async setLockEnabled(on) {
    try { await AsyncStorage.setItem(LOCK_KEY, on ? '1' : '0'); return true; } catch { return false; }
  },

  /** Gate used at app launch / resume — only prompts if the user enabled the lock. */
  async guard(reason) {
    if (!(await this.isLockEnabled())) return true;
    return this.authenticate(reason);
  },
};

export default Biometric;
