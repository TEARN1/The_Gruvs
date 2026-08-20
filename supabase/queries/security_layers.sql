-- ═══════════════════════════════════════════════════════════════════════════
-- security_layers.sql — full-stack security hardening (2026-07 audit)
--
-- Driven by Supabase security advisors (322 findings) + manual RLS/storage
-- review. Verified against actual client usage before every revoke:
--   • all client .rpc() calls enumerated → nothing the app calls is broken
--   • RLS policies reference only is_admin()/is_crew_member() → EXECUTE kept
--   • client never uses storage .list()/.download()/signed URLs → SELECT
--     policy changes cannot break rendering (public buckets serve via CDN URL)
--   • every upload path starts with ${user.id}/ → strict owner-folder policies
--     carry all uploads once the loose policy is gone
--
-- LAYER 1 — default-deny function execution
--   Every SECURITY DEFINER function was executable by anon (134 findings).
--   Now: EXECUTE revoked from PUBLIC+anon on all of them, granted back to
--   authenticated + service_role; a small guest-discovery allowlist stays
--   anon-callable; internal-only functions (never called by the client) lose
--   authenticated too. Default privileges flipped so FUTURE functions are
--   born locked.
--
-- LAYER 2 — storage lockdown
--   • gruvs_media_auth_write let any signed-in user write into ANYONE's
--     folder in all 6 buckets (defeated owner-folder checks) → dropped.
--   • chat_media (DM attachments!) was publicly listable/readable → now
--     owner-only SELECT.
--   • remaining buckets: anon could enumerate all files → SELECT scoped to
--     authenticated (display unaffected — public buckets serve by URL).
--
-- LAYER 3 — social-graph / presence scrape protection
--   checkins, followers, mutual_follows are SECURITY DEFINER views (bypass
--   RLS) and were anon-readable: full presence + social graph scrapable by
--   anyone. Anon revoked; signed-in app behaviour unchanged (client doesn't
--   even query these views).
--
-- LAYER 4 — RLS theater removal (always-true policies)
--   "Service inserts X" WITH CHECK (true) policies let ANYONE insert into
--   ai_interactions / ai_predictions / ai_recommendations_cache /
--   campaign_analytics / governance_proposals. Dropped. ai_* tables are dead
--   code (0 client references) → all policies dropped, deny-all.
--
-- LAYER 5 — misc
--   touch_updated_at(): search_path pinned (was mutable).
--
-- Accepted / documented, not changed:
--   • spatial_ref_sys RLS-off: PostGIS extension-owned reference data, no
--     user data, cannot ALTER as non-owner.
--   • postgis/vector/pg_trgm/unaccent in public schema: moving breaks
--     existing indexes/columns; accepted.
--   • public_profiles & discovery views stay SECURITY DEFINER by design
--     (they exist to expose a SAFE subset while base tables stay locked).
--   • leaderboard_snapshot matview: public gamification data by design.
--
-- Dashboard-only (cannot be done via SQL — do these in Supabase dashboard):
--   • Auth → enable leaked-password protection
--   • Auth → Site URL = https://thegruvs.com
-- ═══════════════════════════════════════════════════════════════════════════


-- ── LAYER 1: default-deny function execution ────────────────────────────────
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef                                   -- SECURITY DEFINER only
      and not exists (                                  -- skip extension-owned
        select 1 from pg_depend d
        where d.objid = p.oid and d.deptype = 'e'
      )
  loop
    execute format('revoke execute on function %s from public, anon', fn.sig);
    execute format('grant execute on function %s to authenticated, service_role', fn.sig);
  end loop;
end $$;

-- Guest-discovery allowlist — the only RPCs a signed-out visitor needs
-- (feed/scout browsing + view telemetry), plus the two RLS policy helpers
-- which must stay executable by every role that hits a policy using them.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'search_events_fts', 'find_nearby_events', 'find_popular_spots',
      'find_gruv_hotspots', 'get_hot_event_ids', 'get_rising_events',
      'record_event_view', 'is_admin', 'is_crew_member'
    )
  loop
    execute format('grant execute on function %s to anon', fn.sig);
  end loop;
end $$;

-- Internal-only functions: never called by the client (verified against the
-- full .rpc() inventory) — they run inside other SECURITY DEFINER functions or
-- triggers, which do not need caller EXECUTE. No client role can call them.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'assert_admin', 'award_badge', 'award_xp',
      'credit_vibe_equity', 'debit_vibe_equity', 'create_notification',
      'apply_report_autohide', 'check_streak_badges',
      'admin_flag_user', 'admin_suspend_user',
      'enforce_event_age_gate', 'enforce_event_capacity',
      'check_in_rate_limit', 'check_rate_limit', 'touch_updated_at'
    )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn.sig);
  end loop;
end $$;

-- Future functions are born locked (no auto EXECUTE for anon / PUBLIC).
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public grant execute on functions to authenticated, service_role;


-- ── LAYER 2: storage lockdown ───────────────────────────────────────────────
-- The any-folder write hole (WITH CHECK was only a bucket list — no owner check)
drop policy if exists gruvs_media_auth_write on storage.objects;

-- chat_media: DM attachments must not be listable by the world.
drop policy if exists chat_media_public_read on storage.objects;
drop policy if exists gruvs_media_public_read on storage.objects;   -- umbrella incl. chat_media
create policy chat_media_owner_read on storage.objects
  for select to authenticated
  using (bucket_id = 'chat_media' and (storage.foldername(name))[1] = (auth.uid())::text);

-- Other buckets: block anonymous enumeration (objects still render via public
-- CDN URLs, which RLS does not gate on public buckets).
drop policy if exists avatars_public_read on storage.objects;
drop policy if exists covers_public_read on storage.objects;
drop policy if exists event_media_public_read on storage.objects;
drop policy if exists moments_public_read on storage.objects;
drop policy if exists reels_public_read on storage.objects;
create policy media_auth_read on storage.objects
  for select to authenticated
  using (bucket_id in ('avatars', 'covers', 'event-media', 'moments', 'reels'));


-- ── LAYER 3: presence / social-graph scrape protection ──────────────────────
-- check_ins (table) and checkins/followers/mutual_follows (views over it and
-- follows) existed live but in zero tracked SQL files — found 2026-08-20 when
-- db-schema-ci.yml's fresh rebuild died on the REVOKE below. Added verbatim
-- from pg_get_constraintdef/pg_get_viewdef against production.
CREATE TABLE IF NOT EXISTS public.check_ins (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now(),
  is_early_bird boolean DEFAULT false,
  UNIQUE (event_id, user_id)
);

CREATE OR REPLACE VIEW public.checkins AS
  SELECT id, event_id, user_id, created_at, is_early_bird FROM public.check_ins;

CREATE OR REPLACE VIEW public.followers AS
  SELECT follower_id, following_id, created_at FROM public.follows;

CREATE OR REPLACE VIEW public.mutual_follows AS
  SELECT a.follower_id AS user_a, a.following_id AS user_b
  FROM public.follows a
  JOIN public.follows b ON b.follower_id = a.following_id AND b.following_id = a.follower_id;

revoke select on public.checkins from anon;
revoke select on public.followers from anon;
revoke select on public.mutual_follows from anon;


-- ── LAYER 4: remove always-true (RLS-theater) policies ──────────────────────
-- ai_* tables: dead code (0 client references) → deny-all
drop policy if exists "Service inserts interactions"      on public.ai_interactions;
drop policy if exists "User reads own interactions"       on public.ai_interactions;
drop policy if exists "Users insert ai_interactions"      on public.ai_interactions;
drop policy if exists "Users read own ai_interactions"    on public.ai_interactions;
drop policy if exists "Users update own ai_interactions"  on public.ai_interactions;
drop policy if exists "ai_interactions_own"               on public.ai_interactions;
drop policy if exists "Service insert ai_predictions"     on public.ai_predictions;
drop policy if exists "Users read own ai_predictions"     on public.ai_predictions;
drop policy if exists "ai_predictions_own"                on public.ai_predictions;
drop policy if exists "ai_predictions_select"             on public.ai_predictions;
drop policy if exists "Service manages recs"              on public.ai_recommendations_cache;
drop policy if exists "Service upsert recommendations"    on public.ai_recommendations_cache;
drop policy if exists "User reads own recs"               on public.ai_recommendations_cache;
drop policy if exists "Users read own recommendations"    on public.ai_recommendations_cache;
drop policy if exists "ai_recs_own"                       on public.ai_recommendations_cache;

-- live tables: drop only the WITH CHECK (true) backdoors; scoped policies remain
drop policy if exists "System inserts campaign analytics" on public.campaign_analytics;
drop policy if exists "Service insert proposals"          on public.governance_proposals;


-- ── LAYER 5: pin mutable search_path ────────────────────────────────────────
alter function public.touch_updated_at() set search_path = '';
