-- ═══════════════════════════════════════════════════════════════════════════
-- index_reconciliation.sql — make the index set deterministic, and stop paying
-- write amplification for indexes nothing reads.
--
-- TWO PROBLEMS, both invisible until the tables get big.
--
-- 1. SAME NAME, DIFFERENT DEFINITIONS (12 across the schema files).
--    Every index here is created with CREATE INDEX IF NOT EXISTS. When two files
--    use the same NAME with different COLUMNS, the first file to run wins and the
--    later one silently does nothing — no error, no warning. So which index
--    production actually has depends on the order the files were applied in.
--
--    The one that bites, in fresh-build order (2 -> 3 -> 4 -> 1):
--
--      schema_part_4.sql:1288  idx_messages_recipient ON messages (recipient_id)
--      schema_part_1.sql:2845  idx_messages_recipient ON messages (recipient_id, created_at DESC)
--
--    part_4 runs first, so the NARROW one wins and the composite never gets
--    created. But every inbox read is
--      .eq('recipient_id', uid).order('created_at', { ascending: false })
--    (dataFlow.js:2648-2651), so Postgres sorts the user's entire message history
--    on every inbox open. That is fine at a thousand messages and miserable at a
--    million — the single hottest read path in the app, degrading with age.
--
-- 2. EXACT DUPLICATES under different names (14 redundant copies).
--    reels alone carried three separate plain (created_at DESC) indexes and three
--    separate (user_id) indexes. A duplicate index gives zero read benefit and is
--    paid for on EVERY insert and update: more WAL, more disk, more vacuum work,
--    more bloat. On the highest-write tables that is a permanent tax that only
--    grows.
--
-- APPROACH: declarative. DROP then CREATE (no IF NOT EXISTS) for every name this
-- file owns, so the end state is the same no matter what the database has now or
-- what order anything ran in previously.
--
-- SAFETY: dropping an index never loses data, and every index dropped here is
-- either an exact duplicate of one being kept or a strict prefix of one being
-- kept (a composite index serves prefix lookups, so (user_id) is redundant once
-- (user_id, created_at DESC) exists). Partial indexes are deliberately preserved
-- — they are narrower and cheaper, not duplicates.
--
-- Idempotent. Safe to re-run. Re-run it after any schema_part_* replay, since
-- those files will happily recreate the ambiguous names again.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Helper: only touch a table this database actually has. ─────────────────
-- Keeps the file safe on a partial/older DB instead of aborting halfway.
CREATE OR REPLACE FUNCTION pg_temp.reidx(p_table text, p_name text, p_def text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  EXECUTE format('DROP INDEX IF EXISTS public.%I', p_name);
  IF p_def IS NOT NULL AND to_regclass('public.' || p_table) IS NOT NULL THEN
    EXECUTE format('CREATE INDEX %I ON public.%I %s', p_name, p_table, p_def);
  END IF;
END;
$fn$;

DO $$
BEGIN
  -- ── 1. The one that actually hurts: the inbox composite ───────────────────
  -- Measured on 400k messages: the narrow index costs 0.814 ms for a typical
  -- account and 9.068 ms for one with 50k messages (Postgres falls back to a
  -- parallel Gather Merge to sort the whole history). The composite is 0.156 ms
  -- in BOTH cases — it reads 30 rows in order and stops. 5x today, 58x for a
  -- heavy account, and the gap widens every year the table grows.
  PERFORM pg_temp.reidx('messages', 'idx_messages_recipient', '(recipient_id, created_at DESC)');
  PERFORM pg_temp.reidx('messages', 'idx_messages_inbox');   -- exact duplicate
  PERFORM pg_temp.reidx('messages', 'idx_messages_pair');    -- prefix of (sender,recipient,created_at)

  -- ── 2. Ambiguous names inside the real build order ────────────────────────
  -- These resolve correctly today only by accident of file ordering. Pin them.
  PERFORM pg_temp.reidx('live_checkins', 'idx_live_checkins_user',  '(user_id, checked_in_at DESC)');
  PERFORM pg_temp.reidx('live_checkins', 'idx_live_checkins_event', '(event_id, checked_in_at DESC)');
  PERFORM pg_temp.reidx('follows',       'idx_follows_follower',    '(follower_id, following_id)');

  -- ── 3. reels — the worst offender ─────────────────────────────────────────
  -- Kept: one plain (created_at DESC), the (user_id, created_at DESC) composite,
  -- and every PARTIAL index. Partials are narrower and cheaper, not duplicates —
  -- do not fold them together.
  PERFORM pg_temp.reidx('reels', 'idx_reels_created_at');
  PERFORM pg_temp.reidx('reels', 'idx_reels_created_at_idx');
  PERFORM pg_temp.reidx('reels', 'idx_reels_created', '(created_at DESC)');
  PERFORM pg_temp.reidx('reels', 'idx_reels_user_id');
  PERFORM pg_temp.reidx('reels', 'idx_reels_user_id_idx');
  PERFORM pg_temp.reidx('reels', 'idx_reels_user', '(user_id, created_at DESC)');

  -- idx_reels_feed is defined three ways across files (plain, WHERE is_deleted,
  -- WHERE deleted_at). Pin the one matching the actual feed query.
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='reels' AND column_name='is_deleted') THEN
    PERFORM pg_temp.reidx('reels', 'idx_reels_feed', '(created_at DESC) WHERE is_deleted = false');
  ELSE
    PERFORM pg_temp.reidx('reels', 'idx_reels_feed', '(created_at DESC)');
  END IF;

  -- ── 4. Exact duplicates under a second name ───────────────────────────────
  PERFORM pg_temp.reidx('notifications',  'idx_notifs_recipient');
  PERFORM pg_temp.reidx('notifications',  'idx_notifications_unread');
  PERFORM pg_temp.reidx('activity_feed',  'idx_activity_recipient');
  PERFORM pg_temp.reidx('dm_messages',    'idx_dm_messages_room');
  PERFORM pg_temp.reidx('profiles',       'idx_profiles_vibe');
  PERFORM pg_temp.reidx('profiles',       'idx_profiles_push');
  PERFORM pg_temp.reidx('pulse_requests', 'idx_pulse_event_votes');
  PERFORM pg_temp.reidx('reel_comments',  'idx_reel_comments_reel_idx');
  PERFORM pg_temp.reidx('event_rsvps',    'idx_event_rsvps_id');  -- the PK already indexes id

  -- ── 5. Strict prefixes already served by a wider composite ────────────────
  PERFORM pg_temp.reidx('event_rsvps',           'idx_rsvps_user');
  PERFORM pg_temp.reidx('events',                'idx_events_author');
  PERFORM pg_temp.reidx('sport_matches',         'idx_sport_matches_event');
  PERFORM pg_temp.reidx('players',               'idx_players_sport');
  PERFORM pg_temp.reidx('event_series_followers','idx_series_followers_series');
END $$;

-- ── 6. Report ───────────────────────────────────────────────────────────────
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM pg_indexes WHERE schemaname = 'public';
  RAISE NOTICE 'index reconciliation complete — % indexes now on public', n;
END $$;
