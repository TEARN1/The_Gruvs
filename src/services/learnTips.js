/**
 * Learn-the-app tips: a week of local notifications, one feature a day.
 *
 * Local only (expo-notifications on the device): no server, no cost, nothing
 * sent anywhere. Scheduled once per install, and only when the user has
 * ALREADY allowed notifications — this never shows a permission prompt.
 * Tapping a tip opens the tab it talks about (see useNotifications).
 */
import { Platform } from 'react-native';

const STORE_KEY = '@gruvs_learn_tips_v1';
const TIP_HOUR = 18; // early evening: when people plan their night

// Every tip names a feature that exists today, and the tab that holds it.
export const TIPS = [
  { tab: 'map', title: 'Road closed? Long queue?', body: 'Tap the warning button on the Map to drop a live tip. The crowd confirms it.' },
  { tab: 'explore', title: 'Find your people', body: 'Explore → Find Vibers shows who is on The Gruvs, who is online and who is near you.' },
  { tab: 'feed', title: 'Only this weekend?', body: 'On The Drop, tap the sliders to filter by date, or pick a category like Music or Food.' },
  { tab: 'feed', title: 'Lock It In', body: 'Going to something? Lock It In on the event card so your crew knows, and get reminded on the day.' },
  { tab: 'map', title: 'Where is it busy right now?', body: 'Turn on Live Now or the Heatmap on the Map to see where people are actually checked in.' },
  { tab: 'chats', title: 'Call your crew for free', body: 'Open a chat in Linked Up and tap the phone or camera for a voice or video call.' },
  { tab: 'profile', title: 'You choose who sees you', body: 'Vibe Card → Settings has Ghost and Incognito modes. Your location is never shared unless you turn it on.' },
];

/**
 * When each tip fires: the first one tomorrow at TIP_HOUR (never the same
 * evening the person installed), then one per day. Pure, for tests.
 */
export function buildTipSchedule(now = new Date(), tips = TIPS) {
  return tips.map((tip, i) => {
    const at = new Date(now);
    at.setDate(at.getDate() + i + 1);
    at.setHours(TIP_HOUR, 0, 0, 0);
    return { id: `gruvs-tip-${i + 1}`, at, ...tip };
  });
}

/** Schedule the series if it hasn't been, and notifications are already allowed. */
export async function scheduleLearnTips() {
  if (Platform.OS === 'web') return false;
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    if (await AsyncStorage.getItem(STORE_KEY)) return false;

    const Notifications = require('expo-notifications');
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return false; // never prompt for tips

    for (const tip of buildTipSchedule()) {
      await Notifications.scheduleNotificationAsync({
        identifier: tip.id, // fixed ids: re-scheduling replaces, never duplicates
        content: { title: tip.title, body: tip.body, data: { type: 'tip', tab: tip.tab } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: tip.at },
      });
    }
    await AsyncStorage.setItem(STORE_KEY, new Date().toISOString());
    return true;
  } catch {
    return false; // tips are a nicety; never break the app over them
  }
}

/** Stop any tips that haven't fired yet (e.g. from Settings). */
export async function cancelLearnTips() {
  if (Platform.OS === 'web') return;
  try {
    const Notifications = require('expo-notifications');
    await Promise.all(TIPS.map((_, i) => Notifications.cancelScheduledNotificationAsync(`gruvs-tip-${i + 1}`)));
  } catch { /* nothing scheduled */ }
}
