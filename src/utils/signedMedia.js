/**
 * signedMedia — serve private chat attachments through short-lived signed URLs.
 *
 * DM attachments live in the `chat_media` bucket. Storage RLS stops anyone
 * *listing* the bucket, but while the bucket is public a leaked object URL is
 * readable by anyone, forever. Private bucket + signed URLs closes that.
 *
 * Signed URLs work on a bucket whether it is public or private, so the client
 * can be switched over FIRST and the bucket flipped to private afterwards with
 * no downtime (see supabase/queries/private_chat_media.sql).
 *
 * If signing fails for any reason we fall back to the stored URL, so a signing
 * hiccup can never blank out someone's conversation.
 */
import { supabase } from '../services/supabase';

const BUCKET = 'chat_media';
const MARKER = `/${BUCKET}/`;
const TTL_SECONDS = 3600;          // 1 hour
const REFRESH_MARGIN_MS = 60_000;  // re-sign a minute before expiry

const cache = new Map(); // objectPath -> { url, expiresAt }

/** Pull the storage object path out of a stored chat_media URL. */
export const chatMediaPath = (url) => {
  if (typeof url !== 'string') return null;
  const i = url.indexOf(MARKER);
  if (i === -1) return null;
  const raw = url.slice(i + MARKER.length).split('?')[0];
  if (!raw) return null;
  try { return decodeURIComponent(raw); } catch { return raw; }
};

/**
 * Resolve a stored chat_media URL to a fresh signed URL.
 * Anything that isn't a chat_media URL is returned untouched.
 */
export async function signedChatMediaUrl(storedUrl) {
  const path = chatMediaPath(storedUrl);
  if (!path) return storedUrl; // not a chat attachment — leave it alone

  const hit = cache.get(path);
  if (hit && hit.expiresAt > Date.now() + REFRESH_MARGIN_MS) return hit.url;

  try {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, TTL_SECONDS);
    if (error || !data?.signedUrl) return storedUrl; // fail open — never blank the chat
    cache.set(path, { url: data.signedUrl, expiresAt: Date.now() + TTL_SECONDS * 1000 });
    return data.signedUrl;
  } catch {
    return storedUrl;
  }
}
