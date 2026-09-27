-- ── Event Media & Schema Patch ────────────────────────────────────────────────
-- Run this ONCE in: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- Safe to re-run (all statements are idempotent).

-- Add schedule column to events (stores DJ sets, performers, timeline slots)
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS schedule JSONB DEFAULT '[]'::jsonb;

-- 1. Create bucket (or update if already exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-media',
  'event-media',
  true,
  52428800,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','video/mp4','video/quicktime','video/x-m4v']
)
ON CONFLICT (id) DO UPDATE SET
  public             = true,
  file_size_limit    = 52428800,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','video/mp4','video/quicktime','video/x-m4v'];

-- 2. Public read (anyone can view event media)
DROP POLICY IF EXISTS "event_media_public_read" ON storage.objects;
CREATE POLICY "event_media_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-media');

-- 3. Authenticated upload — path must start with the user's own ID
DROP POLICY IF EXISTS "event_media_auth_insert" ON storage.objects;
CREATE POLICY "event_media_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'event-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. Update own files
DROP POLICY IF EXISTS "event_media_auth_update" ON storage.objects;
CREATE POLICY "event_media_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'event-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 5. Delete own files
DROP POLICY IF EXISTS "event_media_auth_delete" ON storage.objects;
CREATE POLICY "event_media_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'event-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
