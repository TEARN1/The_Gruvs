-- ============================================================
-- patch_storage_media.sql
-- Run once in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Safe to re-run — all statements are idempotent
-- ============================================================

-- 1. Create the event-media bucket (public, 100 MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-media',
  'event-media',
  true,
  104857600,
  ARRAY[
    'image/jpeg','image/jpg','image/png','image/webp','image/gif',
    'image/heic','image/heif',
    'video/mp4','video/quicktime','video/x-m4v','video/webm'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 104857600;

-- 2. Create the avatars bucket if missing
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  10485760,
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Create the reels bucket if missing
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reels',
  'reels',
  true,
  524288000,
  ARRAY['video/mp4','video/quicktime','video/x-m4v','video/webm','image/jpeg','image/png','image/gif']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ── Storage policies ────────────────────────────────────────────────────────

-- event-media: public read
DROP POLICY IF EXISTS "Public read event-media"    ON storage.objects;
DROP POLICY IF EXISTS "Auth upload event-media"    ON storage.objects;
DROP POLICY IF EXISTS "Owner delete event-media"   ON storage.objects;
DROP POLICY IF EXISTS "Owner update event-media"   ON storage.objects;

CREATE POLICY "Public read event-media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-media');

CREATE POLICY "Auth upload event-media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'event-media' AND auth.role() = 'authenticated');

CREATE POLICY "Owner delete event-media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'event-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owner update event-media"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'event-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- avatars: public read
DROP POLICY IF EXISTS "Public read avatars"  ON storage.objects;
DROP POLICY IF EXISTS "Auth upload avatars"  ON storage.objects;
DROP POLICY IF EXISTS "Owner delete avatars" ON storage.objects;

CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Auth upload avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Owner delete avatars"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- reels: public read
DROP POLICY IF EXISTS "Public read reels"  ON storage.objects;
DROP POLICY IF EXISTS "Auth upload reels"  ON storage.objects;
DROP POLICY IF EXISTS "Owner delete reels" ON storage.objects;

CREATE POLICY "Public read reels"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'reels');

CREATE POLICY "Auth upload reels"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'reels' AND auth.role() = 'authenticated');

CREATE POLICY "Owner delete reels"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'reels' AND auth.uid()::text = (storage.foldername(name))[1]);
