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
  if (!url || !SUPABASE_URL) return url;
  // Only transform URLs from our own Supabase storage
  if (!url.startsWith(SUPABASE_URL) || !url.includes('/storage/v1/object/public/')) return url;

  const params = new URLSearchParams();
  if (width)   params.set('width',   String(width));
  if (height)  params.set('height',  String(height));
  params.set('resize',  'cover');
  params.set('quality', String(quality));

  return `${url}?${params.toString()}`;
}

/** Convenience presets */
export const thumb = {
  avatar:    (url) => storageThumb(url, 80,  80),
  avatarLg:  (url) => storageThumb(url, 200, 200),
  cover:     (url) => storageThumb(url, 800, 420),
  coverSm:   (url) => storageThumb(url, 400, 210),
  thumbnail: (url) => storageThumb(url, 300, 200),
};
