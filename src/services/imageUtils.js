import { supabase } from './supabase';

const SUPABASE_URL = supabase.supabaseUrl || '';

/**
 * Apply Supabase image transform params to any storage URL.
 * Falls back to the original URL for non-Supabase or already-transformed URLs.
 */
export const optimizeImage = (url, { width = 400, quality = 75, format = 'webp' } = {}) => {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('/storage/v1/object/public/')) return url;
  if (url.includes('?')) return url; // already has params
  return `${url}?width=${width}&quality=${quality}&format=${format}`;
};

export const thumbUrl  = (url) => optimizeImage(url, { width: 200, quality: 70 });
export const cardUrl   = (url) => optimizeImage(url, { width: 600, quality: 80 });
export const avatarUrl = (url) => optimizeImage(url, { width: 100, quality: 75 });
export const heroUrl   = (url) => optimizeImage(url, { width: 900, quality: 85 });
