// Expo inlines EXPO_PUBLIC_* only for static `process.env.NAME` reads — a
// dynamic `process.env[key]` is always undefined in a release build, which made
// this check report the keys missing even when they were bundled.
const REQUIRED = {
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
};

/**
 * Call once at app boot (before any Supabase call).
 * Throws a readable error in dev; logs a warning in production so the app
 * degrades gracefully rather than crashing with a cryptic network error.
 */
export function validateEnv() {
  const missing = Object.keys(REQUIRED).filter(key => !REQUIRED[key]);
  if (missing.length === 0) return;

  const msg = `[The Gruvs] Missing required environment variables:\n  ${missing.join('\n  ')}\n\nCreate a .env file at the project root. See .env.example for the required keys.`;

  if (__DEV__) {
    throw new Error(msg);
  } else {
    console.error(msg);
  }
}
