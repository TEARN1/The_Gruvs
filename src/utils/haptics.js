/**
 * haptics — one tiny, safe surface for tactile feedback across the app.
 *
 * Wraps expo-haptics with intent-named helpers so call sites read clearly
 * (haptics.success() vs Haptics.notificationAsync(...)). Every call is wrapped
 * so a missing/unsupported module never throws, and all are no-ops on web.
 */
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const ENABLED = Platform.OS !== 'web';
const safe = (fn) => { if (!ENABLED) return; try { fn(); } catch { /* haptics unavailable */ } };

export const haptics = {
  // light tap — selection, small toggles, list taps
  light:   () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  // medium — primary buttons, confirm, open sheet
  medium:  () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  // heavy — big moments (post created, check-in success)
  heavy:   () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  // selection tick — moving across segmented controls / pickers
  select:  () => safe(() => Haptics.selectionAsync()),
  // semantic notifications
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error:   () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};

// Drop-in for `import * as Haptics from 'expo-haptics'` (same names, same
// enums). 26 components called expo-haptics directly; on web every call
// rejected ("Haptic.impactAsync is not available on web") as an unhandled
// promise rejection. These resolve quietly on web and swallow native failures.
const quiet = (fn) => (...args) => {
  if (!ENABLED) return Promise.resolve();
  try { return Promise.resolve(fn(...args)).catch(() => {}); } catch { return Promise.resolve(); }
};
export const SafeHaptics = {
  ...Haptics,
  impactAsync: quiet(Haptics.impactAsync),
  selectionAsync: quiet(Haptics.selectionAsync),
  notificationAsync: quiet(Haptics.notificationAsync),
};

export default haptics;
