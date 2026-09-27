/**
 * Returns a resized Supabase Storage URL using the built-in image transform API.
 * Passes through non-Supabase URLs (pravatar, unsplash, etc.) unchanged.
 *
 * Usage:
 *   <Image source={{ uri: storageThumb(avatarUrl, 80, 80) }} />
 *   <Image source={{ uri: storageThumb(coverUrl, 800, 420) }} />
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

/**
 * Return a RESIZED image URL. Supabase's own transform endpoint is Pro-only
 * (returns 403 on our free tier), so a full-res photo was being served
 * everywhere `thumb.*` is used — often 300KB–1MB each. Instead we route through
 * weserv.nl: a free, keyless, Cloudflare-backed image resizer/CDN that
 * downscales + re-encodes to WebP on the fly (e.g. 361KB → 66KB at w=800).
 * Non-Supabase and already-proxied URLs pass through unchanged.
 */
export function storageThumb(url, width, height, quality = 70) {
  if (!url || typeof url !== 'string') return url;
  if (url.includes('images.weserv.nl')) return url; // already resized
  if (!url.includes('/storage/v1/object/public/')) return url;
  const ours = SUPABASE_URL
    ? url.startsWith(SUPABASE_URL)
    : /\.supabase\.(co|in|net)\//.test(url);
  if (!ours) return url;

  const src = url.split('?')[0].replace(/^https?:\/\//, ''); // weserv wants scheme-less
  const params = new URLSearchParams();
  params.set('url', src);
  if (width)  params.set('w', String(width));
  if (height) params.set('h', String(height));
  params.set('fit', 'cover');
  params.set('q', String(quality));
  params.set('output', 'webp');
  params.set('we', '1'); // without-enlargement: never upscale a small source
  return `https://images.weserv.nl/?${params.toString()}`;
}

/** Convenience presets */
export const thumb = {
  avatar:    (url) => storageThumb(url, 80,  80),
  avatarLg:  (url) => storageThumb(url, 200, 200),
  cover:     (url) => storageThumb(url, 800, 420),
  coverSm:   (url) => storageThumb(url, 400, 210),
  thumbnail: (url) => storageThumb(url, 300, 200),
  feed:      (url) => storageThumb(url, 900, null, 62), // full-bleed feed image
};

/**
 * Network-aware thumb — on cellular, reduce image quality to save data.
 * Pass isMetered=true when expo-network reports a cellular connection.
 */
export function adaptiveThumb(url, width, height, isMetered = false) {
  return storageThumb(url, width, height, isMetered ? 45 : 70);
}
