// Single source of truth for The Resident's public web URL (the sister app —
// Gruvs and Resident share one Supabase project, login and map).
//
// Deliberately EMPTY by default. A hardcoded `http://localhost:3000` shipped to
// production once already: the Surveyor card's "Launch Resident Map" button sent
// every real user to a dev server that could never resolve. An unset value is
// honest — callers check `hasResident()` and hide the entry point rather than
// offering a link that cannot work.
//
// Set EXPO_PUBLIC_RESIDENT_URL to the deployed Resident host to light these up.
export const RESIDENT_WEB_URL = (process.env.EXPO_PUBLIC_RESIDENT_URL || '').replace(/\/+$/, '');

/** True when a Resident host is configured, so a hand-off is actually possible. */
export const hasResident = () => RESIDENT_WEB_URL.length > 0;

/** Build a path on the Resident host, or null when it isn't configured. */
export const residentUrl = (path = '') =>
  hasResident() ? `${RESIDENT_WEB_URL}/${String(path).replace(/^\/+/, '')}` : null;
