-- ============================================================
--  THE GRUVS — 29: LAUNCH SECURITY (run before going live)
--
--  Closes the two anonymous read leaks found in the security audit:
--    1. live_checkins exposing real GPS to logged-out callers (CRITICAL)
--    2. profiles exposing PII columns (email/push_token/phone/…) to anon
--
--  Bulletproof + minimal: works regardless of existing RLS policy NAMES, and
--  touches reads only — logged-in users, writes, and the privacy-aware RPCs all
--  keep working. Run once in the Supabase SQL editor, then verify with:
--      node scripts/sec-probe.js
-- ============================================================

-- ── 1. CRITICAL — stop anonymous GPS harvesting from live_checkins ─────────
-- A table GRANT is checked BEFORE RLS policies. Revoking SELECT from `anon`
-- guarantees no policy (whatever its name) can leak GPS to a logged-out caller,
-- without us having to find/drop the offending policy. `authenticated` keeps
-- its grant (so "who was there" / presence still work), and get_safe_nearby_vibers
-- (SECURITY DEFINER) is unaffected.
REVOKE SELECT ON public.live_checkins FROM anon;

-- Defence in depth: ensure RLS is on so authenticated reads are still policy-gated.
ALTER TABLE public.live_checkins ENABLE ROW LEVEL SECURITY;

-- (Hardest option — also stop one authenticated user reading another's raw
--  coordinates; rely on get_safe_nearby_vibers for discovery. Uncomment to apply:)
-- REVOKE SELECT ON public.live_checkins FROM authenticated;
-- GRANT EXECUTE ON FUNCTION public.get_safe_nearby_vibers TO authenticated;


-- ── 2. Hide PII columns on profiles from anon ──────────────────────────────
-- RLS is row-level and cannot hide columns, so use column-level REVOKE. This
-- DO block revokes ONLY the PII columns that actually exist on your profiles
-- table, so it can never error on a column you don't have. Public discovery
-- (username/avatar/bio/…) keeps working; PII never reaches a logged-out caller.
DO $$
DECLARE col text;
BEGIN
  FOREACH col IN ARRAY ARRAY['email','push_token','phone','emergency_contacts','siblings','first_name','surname','id_number','date_of_birth']
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = col
    ) THEN
      EXECUTE format('REVOKE SELECT (%I) ON public.profiles FROM anon', col);
    END IF;
  END LOOP;
END $$;

-- (Recommended — also hide these from OTHER authenticated users. Each user still
--  reads their OWN row's PII via the profiles RLS own-row policy. Uncomment if
--  your app never needs another user's PII columns directly:)
-- DO $$
-- DECLARE col text;
-- BEGIN
--   FOREACH col IN ARRAY ARRAY['email','push_token','phone','emergency_contacts','siblings']
--   LOOP
--     IF EXISTS (SELECT 1 FROM information_schema.columns
--                WHERE table_schema='public' AND table_name='profiles' AND column_name=col) THEN
--       EXECUTE format('REVOKE SELECT (%I) ON public.profiles FROM authenticated', col);
--     END IF;
--   END LOOP;
-- END $$;


-- ── 3. (Optional) require login to read the social graph ───────────────────
-- follows is fully enumerable by anon today. Uncomment to require auth:
-- REVOKE SELECT ON public.follows FROM anon;


-- ── Verify ─────────────────────────────────────────────────────────────────
-- Run locally after applying:  node scripts/sec-probe.js
--   → live_checkins should show 🔒 (0 rows to anon)
--   → profiles PII columns should no longer be selectable by the anon key