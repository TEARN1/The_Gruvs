/**
 * Returns a resized Supabase Storage URL using the built-in image transform API.
 * Passes through non-Supabase URLs (pravatar, unsplash, etc.) unchanged.
 *
 * Usage:
 *   <Image source={{ uri: storageThumb(avatarUrl, 80, 80) }} />
 *   <Image source={{ uri: storageThumb(coverUrl, 800, 420) }} />
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

export function storageThumb(url, width, height, quality = 75) {
  if (!url) return url;
  // Must be a public Supabase Storage object URL.
  if (!url.includes('/storage/v1/object/public/')) return url;
  // In the app, EXPO_PUBLIC_SUPABASE_URL is set → restrict to our own project.
  // In tests (no inlined env) → accept any *.supabase.* host. App behaviour is
  // unchanged because real builds always have SUPABASE_URL.
  const ours = SUPABASE_URL
    ? url.startsWith(SUPABASE_URL)
    : /\.supabase\.(co|in|net)\//.test(url);
  if (!ours) return url;

  const params = new URLSearchParams();
  if (width)   params.set('width',   String(width));
  if (height)  params.set('height',  String(height));
  params.set('resize',  'cover');
  params.set('quality', String(quality));

  // Strip any existing query (e.g. transform params from a previous call) so we
  // never produce a double-query like `url?a=1?b=2` or duplicate params.
  const base = url.split('?')[0];
  return `${base}?${params.toString()}`;
}

/** Convenience presets */
export const thumb = {
  avatar:    (url) => storageThumb(url, 80,  80),
  avatarLg:  (url) => storageThumb(url, 200, 200),
  cover:     (url) => storageThumb(url, 800, 420),
  coverSm:   (url) => storageThumb(url, 400, 210),
  thumbnail: (url) => storageThumb(url, 300, 200),
};

/**
 * Network-aware thumb — on cellular, reduce image quality to save data.
 * Pass isMetered=true when expo-network reports a cellular connection.
 */
export function adaptiveThumb(url, width, height, isMetered = false) {
  return storageThumb(url, width, height, isMetered ? 45 : 75);
}
