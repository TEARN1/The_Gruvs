import { Share, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';

const APP_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://the-gruvs-pt23.vercel.app';
const OG_BASE = `${process.env.EXPO_PUBLIC_FUNCTIONS_URL || 'https://feevvddvrjmfbhffccbf.supabase.co/functions/v1'}/og-meta`;

/**
 * Builds a share URL that routes through the og-meta edge function.
 * Crawlers (WhatsApp, iMessage, Twitter, etc.) hit the edge function and
 * get a rich preview. Real users are immediately 302-redirected to the SPA.
 */
export const ShareService = {
  eventUrl(eventId) {
    return `${OG_BASE}/event/${eventId}`;
  },

  profileUrl(username) {
    return `${OG_BASE}/profile/${username}`;
  },

  reelUrl(reelId) {
    return `${OG_BASE}/reel/${reelId}`;
  },

  // ─── Share an event ───────────────────────────────────────────────────────
  async shareEvent(event) {
    const url = this.eventUrl(event.id);
    const venue = [event.venue_name, event.city].filter(Boolean).join(', ');
    const message = [
      `🎉 ${event.title}`,
      venue ? `📍 ${venue}` : null,
      event.start_date
        ? `📅 ${new Date(event.start_date).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}`
        : null,
      `\n${url}`,
    ].filter(Boolean).join('\n');

    return _share({ message, url, title: event.title });
  },

  // ─── Share a profile ──────────────────────────────────────────────────────
  async shareProfile(profile) {
    const username = profile.username;
    const url = this.profileUrl(username);
    const displayName = profile.display_name || username;
    const message = `Check out ${displayName} (@${username}) on The Gruvs 👑\n\n${url}`;
    return _share({ message, url, title: `${displayName} on The Gruvs` });
  },

  // ─── Share a reel ─────────────────────────────────────────────────────────
  async shareReel(reel, creatorUsername) {
    const url = this.reelUrl(reel.id);
    const caption = reel.caption ? `"${reel.caption.slice(0, 60)}"` : 'this reel';
    const message = `Watch ${caption} by @${creatorUsername} on The Gruvs 🎬\n\n${url}`;
    return _share({ message, url, title: 'The Gruvs Reel' });
  },

  // ─── Copy link to clipboard ───────────────────────────────────────────────
  async copyEventLink(eventId) {
    const url = this.eventUrl(eventId);
    await Clipboard.setStringAsync(url);
    return url;
  },

  async copyProfileLink(username) {
    const url = this.profileUrl(username);
    await Clipboard.setStringAsync(url);
    return url;
  },

  async copyReelLink(reelId) {
    const url = this.reelUrl(reelId);
    await Clipboard.setStringAsync(url);
    return url;
  },
};

async function _share({ message, url, title }) {
  try {
    const result = await Share.share(
      Platform.OS === 'ios'
        ? { message, url }
        : { message: `${message}` },
      { dialogTitle: title || 'Share via The Gruvs' }
    );
    return result;
  } catch {
    // User dismissed or share sheet unavailable — no-op
    return null;
  }
}
