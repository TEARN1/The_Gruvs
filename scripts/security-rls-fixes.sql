-- ============================================================================
-- The Gruvs — Security RLS remediation
-- Generated from the live security audit (see SECURITY-AUDIT.md).
--
-- ⚠️  READ FIRST:
--   • These change READ access. Test on a Supabase BRANCH or staging project
--     before production — an over-tight policy can break a feature.
--   • Run statements one block at a time and re-run `node scripts/sec-probe.js`
--     after each to confirm the hole is closed and the app still works.
--   • Replace policy names if they collide with existing ones.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- §1  CRITICAL — stop anonymous GPS harvesting from live_checkins
-- ─────────────────────────────────────────────────────────────────────────────
-- Today an anonymous caller can SELECT raw lat/lon. Block anon entirely; serve
-- nearby locations only through the privacy-aware get_safe_nearby_vibers RPC.

ALTER TABLE public.live_checkins ENABLE ROW LEVEL SECURITY;

-- Remove any policy that grants public/anon read (adjust the name to match yours)
DROP POLICY IF EXISTS "live_checkins are viewable by everyone" ON public.live_checkins;
DROP POLICY IF EXISTS "Enable read access for all users"        ON public.live_checkins;

-- Owner can always see their own check-ins.
CREATE POLICY "live_checkins: owner reads own"
  ON public.live_checkins FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- (Optional, only if "who was there" must show others) — authenticated users may
-- read check-ins for an event, but NOT logged-out anon. Prefer fuzzing lat/lon
-- in a view/RPC rather than exposing raw coordinates. Uncomment if needed:
-- CREATE POLICY "live_checkins: authed read for events"
--   ON public.live_checkins FOR SELECT
--   TO authenticated
--   USING (true);

-- IMPORTANT: ensure get_safe_nearby_vibers is SECURITY DEFINER and rounds/fuzzes
-- coordinates so it can read the table on the caller's behalf without leaking
-- exact positions.


-- ─────────────────────────────────────────────────────────────────────────────
-- §2  MEDIUM — hide PII columns on profiles
-- ─────────────────────────────────────────────────────────────────────────────
-- RLS is row-level and cannot hide columns. Use column-level REVOKE so the
-- public discovery read keeps working but PII is never selectable by anon.
-- (The owner still reads their own PII through an authenticated, own-row path —
--  see the view below if your app reads these columns for the logged-in user.)

REVOKE SELECT (email, push_token, phone, emergency_contacts, siblings, first_name, surname)
  ON public.profiles FROM anon;

-- If you also want to keep other authenticated users from reading each other's
-- PII (recommended), revoke from authenticated too and read self-PII via a view:
-- REVOKE SELECT (email, push_token, phone, emergency_contacts, siblings)
--   ON public.profiles FROM authenticated;

-- Proper long-term fix: a public view with only safe columns, read by the app
-- for OTHER users; the base table stays own-row-only.
-- CREATE OR REPLACE VIEW public.profiles_public AS
--   SELECT id, username, display_name, avatar_url, bio, vibe_score, is_verified,
--          city, interests, identity_mode, is_discoverable
--   FROM public.profiles
--   WHERE is_discoverable IS DISTINCT FROM false;
-- GRANT SELECT ON public.profiles_public TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- §3  MEDIUM — server-side admin flag (replaces hardcoded client email gate)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Grant yourself admin (run once, replace with your user id):
-- UPDATE public.profiles SET is_admin = true WHERE id = '<your-auth-uid>';

-- Make sure is_admin can NEVER be set by a normal user. The profiles UPDATE
-- policy must exclude is_admin, e.g. only allow self-update of non-admin fields.
-- Admin RPCs (below) should check: (SELECT is_admin FROM profiles WHERE id = auth.uid())


-- ─────────────────────────────────────────────────────────────────────────────
-- §4  LOW — require login to read the social graph (follows)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "follows are viewable by everyone" ON public.follows;
CREATE POLICY "follows: authenticated read"
  ON public.follows FOR SELECT
  TO authenticated
  USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- §7  VERIFY — admin RPCs must check the caller is an admin INSIDE the function
-- ─────────────────────────────────────────────────────────────────────────────
-- Example shape your admin_suspend_user / admin_flag_user should have:
--
-- CREATE OR REPLACE FUNCTION public.admin_suspend_user(p_user_id uuid)
-- RETURNS void
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = public
-- AS $$
-- BEGIN
--   IF NOT (SELECT is_admin FROM public.profiles WHERE id = auth.uid()) THEN
--     RAISE EXCEPTION 'not authorized';
--   END IF;
--   UPDATE public.profiles SET is_discoverable = false, is_online = false
--   WHERE id = p_user_id;
-- END;
-- $$;
--
-- Without the is_admin check, ANY logged-in user could call the RPC directly.


-- ─────────────────────────────────────────────────────────────────────────────
-- After applying: re-run  node scripts/sec-probe.js  — live_checkins should show
-- 🔒 protected (0 rows to anon) and the PII columns should no longer be
-- selectable by the anon key.
-- ─────────────────────────────────────────────────────────────────────────────
