-- ══════════════════════════════════════════════════════════════
--  THE GRUVS — DB DRIFT AUDIT  (READ-ONLY — changes nothing)
-- ══════════════════════════════════════════════════════════════
--  Paste into Supabase → SQL Editor → Run. Returns ONE result set
--  of (severity, category, object, detail) rows describing where the
--  live database drifts from the intended schema. Safe to run anytime;
--  it only SELECTs from the catalog. Send the output back for diagnosis.
-- ══════════════════════════════════════════════════════════════

WITH
-- 1) Duplicate function overloads (e.g. two check_rate_limit signatures).
--    These cause 42725 "function name is not unique" on bare-name GRANT/DROP.
dup_funcs AS (
  SELECT 'WARN'::text AS severity, 'DUPLICATE_FUNCTION' AS category,
         p.proname AS object,
         string_agg(p.oid::regprocedure::text, '  |  ' ORDER BY p.oid::regprocedure::text) AS detail
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
  GROUP BY p.proname
  HAVING count(*) > 1
),
-- 2) Tables with RLS enabled but ZERO policies → fully locked to clients.
rls_no_policy AS (
  SELECT 'HIGH'::text, 'RLS_ENABLED_NO_POLICY', c.relname,
         'RLS on, 0 policies — clients get nothing back'
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
    AND NOT EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = c.oid)
),
-- 3) SECURITY DEFINER functions WITHOUT a pinned search_path (advisor + priv-esc).
secdef_mutable AS (
  SELECT 'WARN'::text, 'SECDEF_MUTABLE_SEARCH_PATH', p.oid::regprocedure::text,
         'SECURITY DEFINER without SET search_path'
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef
    AND NOT EXISTS (
      SELECT 1 FROM unnest(coalesce(p.proconfig,'{}')) cfg WHERE cfg LIKE 'search_path=%'
    )
),
-- 4) Expected tables that are MISSING entirely.
expected_tables(t) AS (
  VALUES ('profiles'),('events'),('event_rsvps'),('event_vibes'),('follows'),
         ('reels'),('messages'),('security_logs'),('blocked_users'),('muted_users'),
         ('competitions'),('clubs'),('sport_teams'),('sport_matches'),('players'),
         ('tournament_officials'),('tournament_role_votes'),('match_predictions'),
         ('campaign_analytics'),('audience_segments'),('ad_campaigns'),
         ('path_stars'),('path_crossings'),('event_views'),('surveys'),
         ('survey_responses'),('notification_queue'),('ticket_tokens')
),
missing_tables AS (
  SELECT 'HIGH'::text, 'MISSING_TABLE', et.t, 'expected table not found'
  FROM expected_tables et
  WHERE to_regclass('public.'||et.t) IS NULL
),
-- 5) Expected columns on known drift-hotspot tables that are MISSING.
--    (Only the columns we have seen diverge — extend as needed.)
expected_cols(t, c) AS (
  VALUES
    -- campaign_analytics.impressions/clicks/conversions were checked here
    -- until 2026-08-18, when a Phase-0 pass confirmed they were a STALE
    -- expectation, not real drift: the live design is an event-log table
    -- (one row per event_type: 'impression'|'click'|'conversion'), and both
    -- the writer (EventContextualAds.js) and reader
    -- (CampaignManager.getPerformance in dataFlow.js) already use that shape.
    -- Checking for columns that were deliberately never built produced 3
    -- false positives on every run — removed rather than "fixed live."
    ('campaign_analytics','campaign_id'),
    ('audience_segments','campaign_id'),
    ('path_stars','from_user_id'),('path_stars','to_user_id'),
    ('path_stars','event_id'),('path_stars','user_id'),
    ('events','end_date'),('events','competition_id'),('events','audience'),
    ('events','poster_mode'),('events','secret_act'),('events','power_backup'),
    ('profiles','writing_style'),('profiles','theme_id'),('profiles','clan_name'),
    ('profiles','birth_date'),('profiles','surname'),('profiles','beacon_expires_at'),
    ('messages','message_type'),('messages','parent_id'),
    ('competitions','vote_threshold'),('reels','metadata'),('reels','visibility')
),
missing_cols AS (
  SELECT 'MED'::text, 'MISSING_COLUMN', ec.t||'.'||ec.c, 'expected column not found'
  FROM expected_cols ec
  WHERE to_regclass('public.'||ec.t) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=ec.t AND column_name=ec.c
    )
),
-- 6) Inventory of views + their column lists (eyeball player_leaderboard /
--    public_profiles shape clashes that block CREATE OR REPLACE VIEW).
view_cols AS (
  SELECT 'INFO'::text, 'VIEW_COLUMNS', table_name,
         string_agg(column_name, ', ' ORDER BY ordinal_position) AS detail
  FROM information_schema.views v
  JOIN information_schema.columns c USING (table_schema, table_name)
  WHERE v.table_schema = 'public'
  GROUP BY table_name
)
SELECT * FROM dup_funcs
UNION ALL SELECT * FROM rls_no_policy
UNION ALL SELECT * FROM secdef_mutable
UNION ALL SELECT * FROM missing_tables
UNION ALL SELECT * FROM missing_cols
UNION ALL SELECT * FROM view_cols
ORDER BY 1, 2, 3;