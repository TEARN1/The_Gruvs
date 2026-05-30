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

export default haptics;
