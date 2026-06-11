-- ══════════════════════════════════════════════════════════════
--  CI TEST BOOTSTRAP — stubs the Supabase-managed objects that the
--  schema references, so schema_part_*.sql can build on a vanilla
--  (postgis/postgis) Postgres in CI. NOT for production — Supabase
--  provides all of these for real.
-- ══════════════════════════════════════════════════════════════

-- Supabase roles (schema GRANTs/REVOKEs and `TO authenticated` policies need these).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')          THEN CREATE ROLE anon          NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')  THEN CREATE ROLE service_role  NOLOGIN; END IF;
END $$;

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