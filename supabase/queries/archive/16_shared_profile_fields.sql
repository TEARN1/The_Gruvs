-- ── Shared Profile Fields (The Gruvs ↔ Next.js app) ─────────────────────────
-- Run once in Supabase SQL editor.
-- Both apps read/write the same profiles table via the same project URL + anon key.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name         TEXT,
  ADD COLUMN IF NOT EXISTS surname            TEXT,
  ADD COLUMN IF NOT EXISTS email              TEXT,
  ADD COLUMN IF NOT EXISTS siblings           JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS emergency_contacts JSONB DEFAULT '[]'::jsonb;

-- Index for cross-app lookup by email
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);

-- ── RLS: users can only read/write their own shared fields ───────────────────
-- (profiles table already has RLS enabled from schema_v5.sql)
-- No extra policies needed — existing "users manage own profile" policy covers these columns.

-- ── Helper: siblings shape ───────────────────────────────────────────────────
-- siblings: [{ "name": "Jane", "age": 22, "relationship": "sister" }, ...]

-- ── Helper: emergency_contacts shape ────────────────────────────────────────
-- emergency_contacts: [{ "name": "Mom", "phone": "+27821234567", "relationship": "mother" }, ...]

COMMENT ON COLUMN public.profiles.first_name IS 'Shared with Next.js app';
COMMENT ON COLUMN public.profiles.surname IS 'Shared with Next.js app';
COMMENT ON COLUMN public.profiles.email IS 'Mirror of auth.users email for cross-app queries';
COMMENT ON COLUMN public.profiles.siblings IS 'Array of {name, age, relationship}';
COMMENT ON COLUMN public.profiles.emergency_contacts IS 'Array of {name, phone, relationship}';
