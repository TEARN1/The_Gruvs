-- ═══════════════════════════════════════════════════════════════════════════
-- private_chat_media.sql — stop DM attachments being world-readable
--
-- PROBLEM: the `chat_media` bucket is PUBLIC. Storage RLS stops anyone LISTING
-- it, but a public bucket serves any object to anyone who has (or guesses, or
-- is forwarded) the URL — forever, with no auth. DM attachments are private
-- correspondence; they must not be fetchable by a stranger with a link.
--
-- ORDER OF OPERATIONS (important — do not reorder):
--   1. Ship the client that renders attachments through signed URLs
--      (src/utils/signedMedia.js + SignedImage). Signed URLs work on a PUBLIC
--      bucket too, so this is a no-op for users.   <-- ALREADY SHIPPED
--   2. THEN run this file to flip the bucket private. Existing conversations
--      keep working because the client is already signing.
--
-- Rollback: set public = true.
-- ═══════════════════════════════════════════════════════════════════════════

-- Flip the bucket private: objects are no longer served without a signature.
update storage.buckets
   set public = false
 where id = 'chat_media';

-- Owner-only read remains the RLS rule (set in security_layers.sql). Signed URLs
-- are minted server-side by Storage for a caller who passes this policy, so a
-- participant can still see the attachment — but only via a short-lived,
-- unguessable link, and never anonymously.
--
-- Reference (already applied, shown for context):
--   create policy chat_media_owner_read on storage.objects
--     for select to authenticated
--     using (bucket_id = 'chat_media'
--            and (storage.foldername(name))[1] = (auth.uid())::text);

-- ── Verify ─────────────────────────────────────────────────────────────────
-- select id, public from storage.buckets where id = 'chat_media';   -- want: false
--
-- Then, as an anonymous client, a raw object URL must 400/404:
--   curl -s -o /dev/null -w '%{http_code}\n' \
--     'https://<proj>.supabase.co/storage/v1/object/public/chat_media/<uid>/<file>'
