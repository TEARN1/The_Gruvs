-- ══════════════════════════════════════════════════════════════
--  CI TEST BOOTSTRAP — stubs the Supabase-managed objects that the
--  schema references, so schema_part_*.sql can build on a vanilla
--  (postgis/postgis) Postgres in CI. NOT for production — Supabase
--  provides all of these for real.
-- ══════════════════════════════════════════════════════════════

-- Supabase roles (schema GRANTs/REVOKEs and `TO authenticated` policies need these).
--
-- service_role must be BYPASSRLS to match production. Without it, CI models a
-- service_role that RLS still applies to — the opposite of how it behaves live —
-- so a policy test here would pass while the real Edge Functions (which use the
-- service_role key) sail straight through the same policy. That is exactly the
-- gap that let og-meta serve auto-hidden, reported content to the public.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')          THEN CREATE ROLE anon          NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')  THEN CREATE ROLE service_role  NOLOGIN BYPASSRLS; END IF;
END $$;
-- Idempotent for a pre-existing role from an earlier bootstrap run.
ALTER ROLE service_role BYPASSRLS;

-- Extensions the schema creates (postgis comes from the postgis/postgis image).
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- auth schema + a minimal auth.users (profiles.id REFERENCES auth.users) and
-- auth.uid() (used in RLS policies, which are parsed at CREATE time).
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text
);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT 'authenticated'::text $$;

-- Supabase Realtime publication (schema does ALTER PUBLICATION supabase_realtime ADD TABLE …).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;
-- Supabase Storage stubs (schema files create buckets + storage.objects RLS
-- policies; the real storage schema only exists on hosted Supabase).
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (
  id                 text PRIMARY KEY,
  name               text,
  public             boolean DEFAULT false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id  text,
  name       text,
  owner      uuid,
  metadata   jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
-- Path helpers used inside storage RLS policies (same shape as Supabase's).
CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[]
  LANGUAGE sql IMMUTABLE AS
  $f$ SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $f$;
CREATE OR REPLACE FUNCTION storage.filename(name text) RETURNS text
  LANGUAGE sql IMMUTABLE AS
  $f$ SELECT (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)] $f$;
CREATE OR REPLACE FUNCTION storage.extension(name text) RETURNS text
  LANGUAGE sql IMMUTABLE AS
  $f$ SELECT reverse(split_part(reverse(storage.filename(name)), '.', 1)) $f$;
