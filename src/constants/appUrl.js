// Single source of truth for the public web URL of the app. Set
// EXPO_PUBLIC_APP_URL to your production host (a domain once HTTPS is set up, or
// the droplet IP for now). Everything that builds a shareable/redirect link
// (password reset, share previews, tickets, reels) reads this — no more
// scattered hardcoded hosts drifting out of date.
export const APP_WEB_URL = (process.env.EXPO_PUBLIC_APP_URL || 'https://thegruvs.com').replace(/\/+$/, '');
