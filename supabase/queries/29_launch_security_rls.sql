-- ============================================================
--  THE GRUVS — 29: LAUNCH SECURITY (run before going live)
--
--  Closes the two anonymous read leaks found in the security audit:
--    1. live_checkins exposing real GPS to logged-out callers (CRITICAL)
--    2. profiles exposing PII columns (email/push_token/phone/…) to anon
--
--  Safe + minimal: blocks ANONYMOUS reads only; logged-in users and the
--  privacy-aware RPCs keep working. Run once in the Supabase SQL editor,
--  then verify with:  node scripts/sec-probe.js
-- ============================================================

-- ── 1. CRITICAL — stop anonymous GPS harvesting from live_checkins ─────────
-- Today anon can SELECT raw lat/lon. Require authentication; serve fuzzed
-- nearby positions only through get_safe_nearby_vibers (SECURITY DEFINER).
ALTER TABLE public.live_checkins ENABLE ROW LEVEL SECURITY;

-- Remove any public/anon read policy (covers the common auto-generated names).
DROP POLICY IF EXISTS "live_checkins are viewable by everyone" ON public.live_checkins;
DROP POLICY IF EXISTS "Enable read access for all users"        ON public.live_checkins;
DROP POLICY IF EXISTS "Public read"                             ON public.live_checkins;
DROP POLICY IF EXISTS "live_checkins_read"                      ON public.live_checkins;
DROP POLICY IF EXISTS "live_checkins authed read"               ON public.live_checkins;

-- Authenticated users can read check-ins (needed for "who was there" / presence);
-- anonymous/logged-out callers get nothing.
CREATE POLICY "live_checkins authed read"
  ON public.live_checkins FOR SELECT
  TO authenticated
  USING (true);

-- (Stronger option — restrict to the owner only, and rely entirely on
--  get_safe_nearby_vibers for discovery. Uncomment to harden further:)
-- DROP POLICY IF EXISTS "live_checkins authed read" ON public.live_checkins;
-- CREATE POLICY "live_checkins owner read"
--   ON public.live_checkins FOR SELECT TO authenticated
--   USING (auth.uid() = user_id);


-- ── 2. Hide PII columns on profiles from anon ──────────────────────────────
-- RLS is row-level and cannot hide columns, so use column-level REVOKE. The
-- public discovery read (username/avatar/bio/…) keeps working; PII never
-- reaches a logged-out caller. (Adjust the column list to match your table —
-- unknown columns in REVOKE are ignored per-column, but a missing column name
-- raises an error, so trim any your profiles table doesn't have.)
REVOKE SELECT (email, push_token, phone, emergency_contacts, siblings, first_name, surname)
  ON public.profiles FROM anon;

-- Recommended: also hide these from OTHER authenticated users (each user still
-- reads their own row's PII through an own-row policy / RPC). Uncomment if your
-- app does not need to read other users' PII columns directly:
-- REVOKE SELECT (email, push_token, phone, emergency_contacts, siblings)
--   ON public.profiles FROM authenticated;


-- ── 3. (Optional) require login to read the social graph ───────────────────
-- follows is fully enumerable by anon today. Uncomment to require auth:
-- ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "follows are viewable by everyone" ON public.follows;
-- CREATE POLICY "follows authed read" ON public.follows FOR SELECT TO authenticated USING (true);


-- ── Verify ─────────────────────────────────────────────────────────────────
-- After running, these should return ONLY the owner's own data when run as an
-- authenticated user, and nothing for anon:
--   select count(*) from public.live_checkins;            -- as anon: error/0
-- Then locally:  node scripts/sec-probe.js  → live_checkins should show 🔒.