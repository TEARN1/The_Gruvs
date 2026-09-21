-- ═══════════════════════════════════════════════════════════════════════════
--  APP_DB_CONTRACT_CHECK.sql   —   paste into the Supabase SQL editor, hit Run.
--
--  WHAT THIS IS. Every table and RPC the app actually calls, checked against
--  what this database actually has. It answers one question: which parts of
--  The Gruvs are silently doing nothing right now?
--
--  WHY IT MATTERS. Every RPC call in the client is wrapped in a resilient()
--  chain or a try/catch — 134 call sites, zero of them unguarded. That is good
--  engineering, and it is also why a missing function never shows up as a
--  crash. It shows up as a feature that quietly stops working. The 2026-07-19
--  audit found 48 RPCs missing this way; vibe_equity minting, live event
--  updates and crowd votes had done nothing for months while looking fine.
--
--  READ-ONLY. Selects from system catalogs only. Touches no user data, writes
--  nothing, returns no PII. Safe to run on production any time.
--
--  Generated from the client source, so it cannot drift from what the app
--  really needs. Regenerate with:  npm run audit:contract
-- ═══════════════════════════════════════════════════════════════════════════

\echo ''
\echo '═══ 1. RPCs the app calls that this database does not have ═══'

WITH required(name) AS (VALUES
-- >>> GENERATED: rpcs <<<
    ('accept_crew_invite'),
    ('accept_gig'),
    ('add_gallery_item'),
    ('add_pulse_request'),
    ('add_reel_comment'),
    ('apply_vibe_decay'),
    ('bulk_notify_cancel'),
    ('can_send_chat'),
    ('cancel_event'),
    ('cast_match_prediction'),
    ('cast_poll_vote'),
    ('cast_pulse_vote'),
    ('cast_role_vote'),
    ('check_handle_available'),
    ('check_in_attendee'),
    ('check_in_live'),
    ('count_path_crossings'),
    ('create_business_profile'),
    ('create_campaign'),
    ('create_crew'),
    ('create_dm_room'),
    ('create_event_poll'),
    ('create_gig_post'),
    ('create_story'),
    ('create_user_profile'),
    ('decrement_reel_like'),
    ('decrement_vibe_count'),
    ('delete_event'),
    ('delete_page_block'),
    ('distribute_to_war_chest'),
    ('draft_add_member'),
    ('draft_claim_field'),
    ('draft_confirm_launch'),
    ('draft_create'),
    ('draft_fork_event'),
    ('draft_launch'),
    ('draft_set_field'),
    ('draft_set_status'),
    ('draft_task_add'),
    ('draft_task_assign'),
    ('draft_task_delete'),
    ('draft_task_toggle'),
    ('drop_path_trace'),
    ('events_near_home'),
    ('find_gruv_hotspots'),
    ('find_nearby_events'),
    ('find_popular_spots'),
    ('follow_user'),
    ('generate_ticket_token'),
    ('get_boosted_hosts'),
    ('get_crossed_paths'),
    ('get_economic_velocity'),
    ('get_follower_integrity_aggregate'),
    ('get_hot_event_ids'),
    ('get_moderation_queue'),
    ('get_mutual_online'),
    ('get_my_profile'),
    ('get_or_create_playlist'),
    ('get_precision_economic_metrics'),
    ('get_rising_events'),
    ('get_safe_nearby_vibers'),
    ('increment_pulse_votes'),
    ('increment_reel_like'),
    ('increment_vibe_count'),
    ('join_route'),
    ('leave_route'),
    ('mark_activity_read'),
    ('mark_stories_seen'),
    ('moderate_content'),
    ('mutual_online_count'),
    ('my_home_area'),
    ('notify_cohost_invite'),
    ('post_event_update'),
    ('process_gift'),
    ('profiles_within_radius'),
    ('publish_store'),
    ('recompute_league_table'),
    ('recompute_player_career'),
    ('record_daily_activity'),
    ('record_event_view'),
    ('redeem_ad_gift'),
    ('release_escrow_to_provider'),
    ('remove_event_reaction'),
    ('remove_rsvp'),
    ('reorder_page_blocks'),
    ('request_cashout'),
    ('request_verification'),
    ('save_reel'),
    ('search_events_fts'),
    ('search_top_players'),
    ('secure_check_in'),
    ('send_message_v2'),
    ('send_path_star'),
    ('send_spark_notifications'),
    ('set_home_area'),
    ('submit_event_rating'),
    ('submit_report'),
    ('submit_service_review'),
    ('suggested_follows'),
    ('survey_results'),
    ('unfollow_user'),
    ('unsave_reel'),
    ('unvote_track'),
    ('update_campaign'),
    ('update_event'),
    ('update_page_block'),
    ('update_profile'),
    ('update_reel_caption'),
    ('update_sis_score'),
    ('update_username'),
    ('upsert_event_reaction'),
    ('upsert_rsvp'),
    ('upsert_rsvp_tier'),
    ('vote_track'),
    ('zone_create'),
    ('zone_remove'),
    ('zone_verify'),
    ('zones_near')
-- <<< END GENERATED: rpcs >>>
)
SELECT r.name AS missing_rpc,
       'app calls this; no function with this name exists' AS impact
  FROM required r
 WHERE NOT EXISTS (
   SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = r.name
 )
 ORDER BY r.name;

\echo ''
\echo '═══ 2. Tables the app reads/writes that this database does not have ═══'

WITH required(name) AS (VALUES
-- >>> GENERATED: tables <<<
    ('activity_feed'),
    ('ad_campaigns'),
    ('ad_tokens'),
    ('analytics_events'),
    ('app_updates'),
    ('audience_segments'),
    ('business_page_blocks'),
    ('business_partnerships'),
    ('business_profiles'),
    ('campaign_analytics'),
    ('cashout_requests'),
    ('client_errors'),
    ('club_invitations'),
    ('club_memberships'),
    ('clubs'),
    ('coin_ledger'),
    ('competitions'),
    ('contextual_ads'),
    ('crew_invites'),
    ('crew_members'),
    ('crews'),
    ('diamond_ledger'),
    ('disputes'),
    ('dm_rooms'),
    ('echo_likes'),
    ('echoes'),
    ('event_awards'),
    ('event_carpool_requests'),
    ('event_carpools'),
    ('event_chat_messages'),
    ('event_checkins'),
    ('event_crowd_votes'),
    ('event_draft_tasks'),
    ('event_drafts'),
    ('event_followers'),
    ('event_gallery'),
    ('event_gallery_likes'),
    ('event_guest_likes'),
    ('event_guests'),
    ('event_judge_scores'),
    ('event_lineup'),
    ('event_moment_reactions'),
    ('event_moment_views'),
    ('event_moments'),
    ('event_now_playing'),
    ('event_playlist_tracks'),
    ('event_polls'),
    ('event_ratings'),
    ('event_reactions'),
    ('event_reminders'),
    ('event_roles'),
    ('event_rsvps'),
    ('event_series'),
    ('event_series_followers'),
    ('event_sessions'),
    ('event_setlists'),
    ('event_speakers'),
    ('event_sport_config'),
    ('event_stages'),
    ('event_stamps'),
    ('event_teams'),
    ('event_track_votes'),
    ('event_traffic_routes'),
    ('event_updates'),
    ('event_vendors'),
    ('event_vibes'),
    ('event_views'),
    ('event_waitlist'),
    ('events'),
    ('follows'),
    ('gift_registry'),
    ('gig_acceptances'),
    ('gig_posts'),
    ('global_economy_params'),
    ('governance_proposals'),
    ('governance_votes'),
    ('hashtags'),
    ('live_checkins'),
    ('match_predictions'),
    ('media_likes'),
    ('messages'),
    ('muted_users'),
    ('notifications'),
    ('path_crossings'),
    ('path_stars'),
    ('path_traces'),
    ('paths'),
    ('player_career_stats'),
    ('player_followers'),
    ('player_match_ratings'),
    ('player_season_stats'),
    ('player_team_spells'),
    ('players'),
    ('profiles'),
    ('pulse_requests'),
    ('pulse_votes'),
    ('reel_comment_likes'),
    ('reel_comments'),
    ('reel_likes'),
    ('reel_reports'),
    ('reel_views'),
    ('reels'),
    ('reports'),
    ('res_alerts'),
    ('res_lift_clubs'),
    ('res_listings'),
    ('route_joins'),
    ('route_steps'),
    ('routes'),
    ('saved_events'),
    ('saved_reels'),
    ('seasons'),
    ('security_logs'),
    ('service_bookings'),
    ('service_nodes'),
    ('service_reviews'),
    ('sport_athletes'),
    ('sport_event_followers'),
    ('sport_individual_results'),
    ('sport_league_table'),
    ('sport_live_commentary'),
    ('sport_match_events'),
    ('sport_matches'),
    ('sport_media'),
    ('sport_media_likes'),
    ('sport_teams'),
    ('sport_top_performers'),
    ('sso_handoff_codes'),
    ('stories'),
    ('story_views'),
    ('survey_responses'),
    ('surveys'),
    ('ticket_tokens'),
    ('tournament_officials'),
    ('tournament_role_votes'),
    ('user_blocks'),
    ('user_deep_profile'),
    ('user_paths'),
    ('verification_requests'),
    ('wallet_transactions'),
    ('web_push_subscriptions')
-- <<< END GENERATED: tables >>>
)
SELECT r.name AS missing_table
  FROM required r
 WHERE to_regclass('public.' || r.name) IS NULL
 ORDER BY r.name;

\echo ''
\echo '═══ 3. Security posture — the findings from the security audit ═══'

SELECT check_name, status, detail FROM (
  -- 🔴 Any signed-in user could set their own role to admin. The guard trigger
  -- was SECURITY DEFINER, where current_user is the OWNER, so it never fired.
  SELECT 1 AS ord,
    'profile trust-column guard' AS check_name,
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'protect_profile_trust_columns')
        THEN '🔴 MISSING'
      WHEN (SELECT prosecdef FROM pg_proc WHERE proname = 'protect_profile_trust_columns' LIMIT 1)
        THEN '🔴 BROKEN — SECURITY DEFINER'
      ELSE '✅ OK'
    END AS status,
    'DEFINER here means current_user is the owner, so the guard never fires and role=admin is self-assignable. Fix: definer_rpc_hardening.sql' AS detail

  UNION ALL
  -- 🔴 SECURITY DEFINER + granted to clients + no auth.uid() check. Checks the
  -- REAL privilege, so a partial "REVOKE FROM authenticated" (which leaves the
  -- default PUBLIC grant in place) still reads as exposed.
  SELECT 2,
    'client-executable DEFINER writers',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.prosecdef
         AND p.proname IN ('increment_wallet_balance','update_sis_score','soft_delete','restore_deleted')
         AND (has_function_privilege('authenticated', p.oid, 'EXECUTE')
           OR has_function_privilege('anon', p.oid, 'EXECUTE'))
    ) THEN '🔴 EXPOSED' ELSE '✅ OK' END,
    'increment_wallet_balance / update_sis_score / soft_delete / restore_deleted executable by any signed-in user with no caller check. Fix: definer_rpc_hardening.sql'

  UNION ALL
  SELECT 3, 'authorized escrow release',
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'release_escrow_to_provider')
         THEN '✅ OK' ELSE '⚠️  MISSING' END,
    'Without it, escrow release marks bookings completed but never pays the provider. Fix: definer_rpc_hardening.sql'

  UNION ALL
  SELECT 4, 'live_checkins GPS exposure',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname='public' AND c.relname='live_checkins' AND c.relrowsecurity
    ) THEN '✅ RLS on' ELSE '🔴 RLS OFF' END,
    'Exact user coordinates readable by anon defeats the whole identity-privacy system. Fix: scripts/security-rls-fixes.sql'

  UNION ALL
  SELECT 5, 'auto-hide moderation policies',
    CASE WHEN (SELECT count(*) FROM pg_policies
                WHERE schemaname='public' AND policyname LIKE '%hide_autohidden%') >= 3
         THEN '✅ OK' ELSE '⚠️  INCOMPLETE' END,
    'These RESTRICTIVE policies are the only thing hiding reported content. Fix: schema_part_4.sql'

  UNION ALL
  SELECT 6, 'public_profiles visibility mode',
    CASE WHEN COALESCE((SELECT option_value FROM pg_class c
            JOIN pg_namespace n ON n.oid=c.relnamespace,
            pg_options_to_table(c.reloptions)
           WHERE n.nspname='public' AND c.relname='public_profiles'
             AND option_name='security_invoker' LIMIT 1), 'false') = 'true'
         THEN '🔴 INVOKER — guests get "permission denied"'
         ELSE '✅ definer (correct)' END,
    'anon has no SELECT policy on profiles, so an invoker view breaks every signed-out page load'
) s ORDER BY ord;

\echo ''
\echo '═══ 4. Retention & maintenance — does anything clean up? ═══'

SELECT item, status FROM (
  SELECT 1 AS ord, 'pg_cron extension' AS item,
    CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron')
         THEN '✅ enabled' ELSE '🔴 NOT ENABLED — no retention has ever run' END AS status
  UNION ALL SELECT 2, 'run_maintenance_l1 (daily purges)',
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname='run_maintenance_l1')
         THEN '✅ present' ELSE '⚠️  missing — maintenance_levels.sql not applied' END
  UNION ALL SELECT 3, 'run_maintenance_l2 (weekly purges)',
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname='run_maintenance_l2')
         THEN '✅ present' ELSE '⚠️  missing — maintenance_levels.sql not applied' END
  UNION ALL SELECT 4, 'purge_stale_location (POPIA s.14)',
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname='purge_stale_location')
         THEN '✅ present' ELSE '⚠️  missing — data_retention.sql not applied' END
) t ORDER BY ord;

\echo ''
\echo '═══ 5. Performance — the index the build silently gets wrong ═══'

SELECT 'idx_messages_recipient' AS index_name,
       COALESCE((SELECT indexdef FROM pg_indexes
                  WHERE schemaname='public' AND indexname='idx_messages_recipient'),
                'MISSING') AS current_definition,
       CASE WHEN (SELECT indexdef FROM pg_indexes
                   WHERE schemaname='public' AND indexname='idx_messages_recipient')
                 LIKE '%created_at%'
            THEN '✅ composite — inbox reads are index-ordered'
            ELSE '🔴 narrow — every inbox open sorts the user''s whole history (9ms vs 0.16ms at 50k messages). Fix: index_reconciliation.sql'
       END AS verdict;

\echo ''
\echo '═══ 6. Table sizes — what is actually growing ═══'

SELECT relname AS table_name,
       to_char(n_live_tup, 'FM999,999,999') AS approx_rows,
       pg_size_pretty(pg_total_relation_size(relid)) AS total_size
  FROM pg_stat_user_tables
 WHERE schemaname = 'public'
 ORDER BY pg_total_relation_size(relid) DESC
 LIMIT 15;

\echo ''
\echo 'Done. Sections 1 and 2 list what the app expects and this database lacks.'
\echo 'Section 3 is the security posture — anything red there is exploitable now.'
