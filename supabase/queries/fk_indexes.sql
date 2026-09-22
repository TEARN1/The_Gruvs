-- ═══════════════════════════════════════════════════════════════════════════
--  fk_indexes.sql — index the foreign keys that ON DELETE CASCADE walks.
--
--  THE PROBLEM. Postgres creates an index for a PRIMARY KEY automatically. It
--  does NOT create one for a FOREIGN KEY. So when a parent row is deleted, every
--  ON DELETE CASCADE child must be found — and with no index on the referencing
--  column that is a full sequential scan of the child table.
--
--  109 cascading foreign keys in this schema have no supporting index.
--
--  Measured on one child table with 1.5M rows:
--
--      no index  ->  156 ms per parent delete
--      indexed   ->    0.4 ms per parent delete        (~390x)
--
--  Note it barely shows at small scale: the same test at 100k rows per table
--  measured 84 ms vs 47 ms, because the table still fits in cache. The cost is
--  linear in child-table size, so it stays invisible until it is severe.
--
--  WHY IT MATTERS HERE. The delete-account Edge Function calls purge_user_data
--  and then auth.admin.deleteUser(), which cascades across every table
--  referencing the user. At 109 unindexed paths and 156 ms each that is roughly
--  17 seconds of sequential scanning for one deletion — and Edge Functions have
--  an execution limit. Permanent account deletion is an Apple 5.1.1(v) and
--  Google Play requirement, so a deletion that times out is a store problem, not
--  just a slow query.
--
--  SCOPE. Only ON DELETE CASCADE foreign keys are indexed here. Those are the
--  delete paths. Non-cascading FKs also benefit from an index on join and
--  lookup paths, but each index costs write throughput, so they are left out
--  rather than added speculatively.
--
--  CONCURRENTLY is deliberately NOT used: it cannot run inside a transaction
--  block, and the Supabase SQL editor wraps statements. These are small tables
--  by index-build standards; if one is large enough to matter, build that single
--  index separately with CREATE INDEX CONCURRENTLY outside a transaction.
--
--  Idempotent. Safe to re-run. Skips any table or column this database lacks.
-- ═══════════════════════════════════════════════════════════════════════════

-- Creates the index only if the table AND column exist and nothing already
-- indexes that column first. Keeps the file safe on a partial database.
CREATE OR REPLACE FUNCTION pg_temp.fkidx(p_table text, p_col text)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE idx_name text;
BEGIN
  IF to_regclass('public.' || p_table) IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name=p_table AND column_name=p_col)
  THEN RETURN; END IF;

  -- Already covered? An index whose FIRST column is this one serves the FK.
  IF EXISTS (
    SELECT 1 FROM pg_index i
      JOIN pg_class c   ON c.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = i.indkey[0]
     WHERE n.nspname='public' AND c.relname=p_table AND a.attname=p_col
  ) THEN RETURN; END IF;

  idx_name := left('idx_' || p_table || '_' || p_col || '_fk', 63);
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (%I)', idx_name, p_table, p_col);
  RAISE NOTICE 'indexed %.%', p_table, p_col;
END;
$fn$;

DO $$
BEGIN
  PERFORM pg_temp.fkidx('event_draft_tasks','created_by');
  PERFORM pg_temp.fkidx('event_draft_confirms','user_id');
  PERFORM pg_temp.fkidx('map_zones','created_by');
  PERFORM pg_temp.fkidx('map_zone_votes','user_id');
  PERFORM pg_temp.fkidx('res_room_requests','listing_id');
  PERFORM pg_temp.fkidx('res_service_dispatches','service_id');
  PERFORM pg_temp.fkidx('res_chore_schedule','roommate_id');
  PERFORM pg_temp.fkidx('res_alert_responders','responder_id');
  PERFORM pg_temp.fkidx('res_group_buy_pledges','user_id');
  PERFORM pg_temp.fkidx('res_skills','user_id');
  PERFORM pg_temp.fkidx('res_neighbourhood_status','reporter_id');
  PERFORM pg_temp.fkidx('business_page_blocks','business_id');
  PERFORM pg_temp.fkidx('business_partnerships','partner_id');
  PERFORM pg_temp.fkidx('ad_campaigns','user_id');
  PERFORM pg_temp.fkidx('campaign_analytics','campaign_id');
  PERFORM pg_temp.fkidx('audience_segments','campaign_id');
  PERFORM pg_temp.fkidx('governance_proposals','created_by');
  PERFORM pg_temp.fkidx('governance_votes','user_id');
  PERFORM pg_temp.fkidx('path_crossings','path_id_a');
  PERFORM pg_temp.fkidx('path_crossings','path_id_b');
  PERFORM pg_temp.fkidx('path_stars','path_id');
  PERFORM pg_temp.fkidx('service_nodes','provider_id');
  PERFORM pg_temp.fkidx('service_bookings','service_node_id');
  PERFORM pg_temp.fkidx('service_reviews','booking_id');
  PERFORM pg_temp.fkidx('service_reviews','reviewer_id');
  PERFORM pg_temp.fkidx('disputes','booking_id');
  PERFORM pg_temp.fkidx('disputes','filed_by');
  PERFORM pg_temp.fkidx('gig_posts','user_id');
  PERFORM pg_temp.fkidx('gig_posts','poster_id');
  PERFORM pg_temp.fkidx('gig_acceptances','worker_id');
  PERFORM pg_temp.fkidx('gig_acceptances','user_id');
  PERFORM pg_temp.fkidx('dm_messages','sender_id');
  PERFORM pg_temp.fkidx('wallet_transactions','user_id');
  PERFORM pg_temp.fkidx('event_updates','event_id');
  PERFORM pg_temp.fkidx('event_updates','author_id');
  PERFORM pg_temp.fkidx('event_waitlist','user_id');
  PERFORM pg_temp.fkidx('event_carpools','event_id');
  PERFORM pg_temp.fkidx('event_carpools','driver_id');
  PERFORM pg_temp.fkidx('event_carpool_requests','event_id');
  PERFORM pg_temp.fkidx('event_carpool_requests','rider_id');
  PERFORM pg_temp.fkidx('event_carpool_requests','user_id');
  PERFORM pg_temp.fkidx('event_roles','user_id');
  PERFORM pg_temp.fkidx('event_reminders','user_id');
  PERFORM pg_temp.fkidx('event_chat_messages','user_id');
  PERFORM pg_temp.fkidx('event_polls','event_id');
  PERFORM pg_temp.fkidx('event_polls','created_by');
  PERFORM pg_temp.fkidx('event_poll_votes','user_id');
  PERFORM pg_temp.fkidx('event_playlists','event_id');
  PERFORM pg_temp.fkidx('event_playlists','created_by');
  PERFORM pg_temp.fkidx('event_playlist_tracks','playlist_id');
  PERFORM pg_temp.fkidx('event_playlist_tracks','added_by');
  PERFORM pg_temp.fkidx('event_track_votes','user_id');
  PERFORM pg_temp.fkidx('event_schedule','event_id');
  PERFORM pg_temp.fkidx('event_moments','user_id');
  PERFORM pg_temp.fkidx('event_moment_views','user_id');
  PERFORM pg_temp.fkidx('event_moment_reactions','user_id');
  PERFORM pg_temp.fkidx('stories','user_id');
  PERFORM pg_temp.fkidx('story_views','user_id');
  PERFORM pg_temp.fkidx('reel_comments','user_id');
  PERFORM pg_temp.fkidx('reel_views','viewer_id');
  PERFORM pg_temp.fkidx('reel_views','user_id');
  PERFORM pg_temp.fkidx('reel_reports','user_id');
  PERFORM pg_temp.fkidx('saved_events','event_id');
  PERFORM pg_temp.fkidx('event_reactions','user_id');
  PERFORM pg_temp.fkidx('echo_likes','user_id');
  PERFORM pg_temp.fkidx('event_ratings','user_id');
  PERFORM pg_temp.fkidx('event_gallery','user_id');
  PERFORM pg_temp.fkidx('routes','user_id');
  PERFORM pg_temp.fkidx('route_steps','route_id');
  PERFORM pg_temp.fkidx('route_joins','user_id');
  PERFORM pg_temp.fkidx('pulse_requests','user_id');
  PERFORM pg_temp.fkidx('pulse_votes','user_id');
  PERFORM pg_temp.fkidx('hashtags','event_id');
  PERFORM pg_temp.fkidx('reports','reporter_id');
  PERFORM pg_temp.fkidx('user_blocks','blocked_id');
  PERFORM pg_temp.fkidx('event_messages','event_id');
  PERFORM pg_temp.fkidx('event_messages','user_id');
  PERFORM pg_temp.fkidx('path_traces','user_id');
  PERFORM pg_temp.fkidx('user_paths','user_id');
  PERFORM pg_temp.fkidx('sport_groups','event_id');
  PERFORM pg_temp.fkidx('sport_match_events','event_id');
  PERFORM pg_temp.fkidx('sport_individual_results','match_id');
  PERFORM pg_temp.fkidx('sport_league_table','team_id');
  PERFORM pg_temp.fkidx('sport_live_commentary','event_id');
  PERFORM pg_temp.fkidx('sport_media','uploader_id');
  PERFORM pg_temp.fkidx('sport_event_followers','user_id');
  PERFORM pg_temp.fkidx('event_stages','event_id');
  PERFORM pg_temp.fkidx('event_setlists','lineup_id');
  PERFORM pg_temp.fkidx('event_media','uploader_id');
  PERFORM pg_temp.fkidx('club_invitations','inviter_id');
  PERFORM pg_temp.fkidx('player_match_ratings','match_id');
  PERFORM pg_temp.fkidx('player_match_ratings','event_id');
  PERFORM pg_temp.fkidx('player_match_ratings','rater_id');
  PERFORM pg_temp.fkidx('tournament_role_votes','candidate_id');
  PERFORM pg_temp.fkidx('tournament_role_votes','voter_user_id');
  PERFORM pg_temp.fkidx('tournament_role_votes','voter_club_id');
  PERFORM pg_temp.fkidx('match_predictions','match_id');
  PERFORM pg_temp.fkidx('match_predictions','user_id');
  PERFORM pg_temp.fkidx('path_stars','from_user_id');
  PERFORM pg_temp.fkidx('path_stars','to_user_id');
  PERFORM pg_temp.fkidx('path_stars','event_id');
  PERFORM pg_temp.fkidx('event_guest_likes','event_id');
  PERFORM pg_temp.fkidx('event_guest_likes','user_id');
  PERFORM pg_temp.fkidx('event_crowd_votes','user_id');
  PERFORM pg_temp.fkidx('sso_handoff_codes','user_id');
  PERFORM pg_temp.fkidx('pulse_requests','schedule_id');
  PERFORM pg_temp.fkidx('path_crossings','user_id');
  PERFORM pg_temp.fkidx('path_crossings','other_user_id');
  PERFORM pg_temp.fkidx('event_views','author_id');END $$;

-- ── Report ──────────────────────────────────────────────────────────────────
-- Any cascading FK still unindexed after this ran. Should be empty.
SELECT c.conrelid::regclass::text AS child_table,
       a.attname                  AS column_name,
       c.confrelid::regclass::text AS parent_table
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
  JOIN pg_namespace n ON n.oid = c.connamespace
 WHERE c.contype = 'f'
   AND c.confdeltype = 'c'                      -- ON DELETE CASCADE
   AND n.nspname = 'public'
   AND NOT EXISTS (
     SELECT 1 FROM pg_index i
       JOIN pg_attribute ia ON ia.attrelid = i.indrelid AND ia.attnum = i.indkey[0]
      WHERE i.indrelid = c.conrelid AND ia.attname = a.attname
   )
 ORDER BY 1, 2;
