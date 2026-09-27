-- ═══════════════════════════════════════════════════════════════════════════
-- definer_views_audit.sql — the 10 SECURITY DEFINER views (advisor ERRORs)
--
-- BACKGROUND. A Postgres view runs with the privileges of its OWNER unless
-- `security_invoker = true` (PG15+; we're on PG17). A definer view therefore
-- BYPASSES the querying user's RLS — it sees every row. That's fine when the
-- view is a deliberately curated public projection, and a leak when the view
-- exposes relationship/presence rows RLS was meant to scope.
--
-- REGRESSION FOUND: schema_part_3.sql:2342 hardened public_profiles with
--   ALTER VIEW public.public_profiles SET (security_invoker = true);
-- but schema_part_4.sql:363 later runs CREATE OR REPLACE VIEW on the same
-- view WITHOUT the option — silently reverting it to definer. The live
-- advisor confirms it is definer today. Any future CREATE OR REPLACE will
-- revert it again, so the ALTER must live in the LAST file that touches it.
--
-- ⚠️ DO NOT RUN BLIND. Flipping a view to invoker changes who sees what.
--    Verify each step against live behaviour (esp. signed-out browsing).
-- ═══════════════════════════════════════════════════════════════════════════


-- ── TRIAGE ───────────────────────────────────────────────────────────────────
--
-- KEEP DEFINER (intentional public projection — flipping BREAKS the product):
--   • public_profiles — the guest-browsing projection. It exposes ONLY safe
--     columns (username, display_name, avatar_url, bio, location, role,
--     vibe_score, counts, xp, badges, verified, show_online, gated last_seen).
--     anon is walled off from `profiles` itself, so invoker=true would return
--     ZERO rows to signed-out users and kill guest browsing. The curated
--     column list IS the control here, not RLS.
--     ↳ Residual risk (accepted, documented): it ignores ghost/incognito and
--       block, so it can enumerate profiles. Contained because the columns are
--       already public-by-design. Revisit if profile enumeration becomes abuse.
--
-- SHOULD BE INVOKER (these expose relationship/presence rows that RLS scopes;
-- a definer view lets ANY authenticated user read ALL rows, ignoring ghost
-- mode, blocks and discoverability):
--   • checkins            — who was physically where, when  ← most sensitive
--   • followers           — social graph
--   • mutual_follows      — social graph
--   • active_story_counts — presence-ish
--   • trending_users      — derived from the above
--   • user_levels         — derived profile stats
--   • events_this_week    — event rows (RLS-scoped)
--   • trending_reels      — reel rows (visibility-scoped)
--   • player_leaderboard  — derived player stats
--
-- ── STEP 1 (safe, do first): confirm what's actually live ────────────────────
-- Run this and read the output BEFORE applying anything below.
--
--   select c.relname,
--          coalesce((select option_value from pg_options_to_table(c.reloptions)
--                    where option_name = 'security_invoker'), 'false') as invoker,
--          pg_get_userbyid(c.relowner) as owner,
--          array_agg(distinct a.grantee::regrole::text) as grantees
--   from pg_class c
--   join pg_namespace n on n.oid = c.relnamespace
--   left join information_schema.role_table_grants a
--          on a.table_name = c.relname and a.table_schema = n.nspname
--   where n.nspname = 'public' and c.relkind = 'v'
--     and c.relname in ('public_profiles','checkins','followers','mutual_follows',
--                       'active_story_counts','trending_users','user_levels',
--                       'events_this_week','trending_reels','player_leaderboard')
--   group by c.relname, c.reloptions, c.relowner
--   order by c.relname;
--
-- ── STEP 2: re-apply the reverted hardening intent ───────────────────────────
-- public_profiles stays DEFINER on purpose (see triage). Nothing to do — but
-- record the decision so nobody "fixes" the advisor warning and breaks guests:
COMMENT ON VIEW public.public_profiles IS
  'DELIBERATELY security_definer: curated public projection for signed-out '
  'browsing (anon cannot read profiles directly). Safety comes from the '
  'column list, not RLS. Do NOT set security_invoker — it returns 0 rows to '
  'guests and breaks guest browsing.';

-- ── STEP 3: flip the relationship/presence views to invoker ──────────────────
-- Guarded per view so a missing one cannot abort the run. Apply, then TEST:
--   • signed-out home page still loads (public_profiles untouched, should pass)
--   • a signed-in user still sees their own followers/checkins
--   • a GHOST user no longer appears in another user's checkins view
-- If any surface goes empty, revert that single view with
--   ALTER VIEW public.<name> SET (security_invoker = false);
DO $$
DECLARE v text;
BEGIN
  FOREACH v IN ARRAY ARRAY[
    'checkins','followers','mutual_follows','active_story_counts',
    'trending_users','user_levels','events_this_week','trending_reels',
    'player_leaderboard'
  ] LOOP
    IF to_regclass('public.' || v) IS NOT NULL THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v);
      RAISE NOTICE 'security_invoker=true -> %', v;
    END IF;
  END LOOP;
END $$;

-- ── STEP 4: stop the regression recurring ────────────────────────────────────
-- schema_part_4.sql:363 recreates public_profiles and drops its options. Any
-- file that CREATE OR REPLACEs a view MUST re-assert its options immediately
-- after. Left as a note rather than an edit so the part files stay a faithful
-- record; the COMMENT in step 2 is the durable in-DB warning.
