-- ══════════════════════════════════════════════════════════════════════════════
--  reels_visibility_test.sql — who sees which reel, and that clip stats can't be
--  faked. See supabase/migrations/20261020000100_reels_guest_safety_clip_stats.sql.
--  Runs as the real anon / authenticated roles inside a rolled-back transaction.
-- ══════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
BEGIN;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;

-- ── 0. The policies are there, and RESTRICTIVE (a permissive one would widen) ─
DO $$
DECLARE p record;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reels'
              AND policyname = 'Reels readable by all') THEN
    RAISE EXCEPTION 'FAIL "Reels readable by all" is back: every reel is readable by everyone';
  END IF;
  FOR p IN SELECT * FROM (VALUES ('reels_hide_deleted'), ('reels_guest_safe')) v(name) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reels'
                    AND policyname = p.name AND permissive = 'RESTRICTIVE') THEN
      RAISE EXCEPTION 'FAIL policy % missing or not RESTRICTIVE', p.name;
    END IF;
  END LOOP;
  -- Any permissive SELECT policy is OR'd with the rest, so one that ignores
  -- visibility (USING true / is_deleted = false) reopens every private reel.
  FOR p IN SELECT policyname, qual FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'reels'
              AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    IF p.qual IS NULL OR position('visibility' in p.qual) = 0 THEN
      RAISE EXCEPTION 'FAIL permissive policy "%" on reels ignores visibility: %', p.policyname, p.qual;
    END IF;
  END LOOP;
  RAISE NOTICE 'OK  reel visibility policies present and restrictive';
END $$;

-- Fixture: settled author S (30 days old), new author N (today), viewer V,
-- host H with event E. Reels: clean (S), fresh (N), reported twice (S),
-- deleted (S), mature (S), attendees-only (S). All tagged to E.
SET LOCAL session_replication_role = replica;
INSERT INTO auth.users (id) VALUES
  ('a1000000-0000-0000-0000-00000000000a'), ('a2000000-0000-0000-0000-00000000000b'),
  ('a3000000-0000-0000-0000-00000000000c'), ('a4000000-0000-0000-0000-00000000000d');
INSERT INTO public.profiles (id, username, created_at) VALUES
  ('a1000000-0000-0000-0000-00000000000a', 't_settled', now() - interval '30 days'),
  ('a2000000-0000-0000-0000-00000000000b', 't_new',     now()),
  ('a3000000-0000-0000-0000-00000000000c', 't_viewer',  now() - interval '30 days'),
  ('a4000000-0000-0000-0000-00000000000d', 't_host',    now() - interval '30 days');
INSERT INTO public.events (id, author_id, title) VALUES
  ('e1000000-0000-0000-0000-00000000000e', 'a4000000-0000-0000-0000-00000000000d', 'Clip test'),
  ('e2000000-0000-0000-0000-00000000000f', 'a4000000-0000-0000-0000-00000000000d', 'Other event');
INSERT INTO public.reels (id, user_id, media_url, event_id, report_count, deleted_at, min_age, visibility) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-00000000000a', 'x', 'e1000000-0000-0000-0000-00000000000e', 0, NULL,  13, 'public'),
  ('c1000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-00000000000b', 'x', 'e1000000-0000-0000-0000-00000000000e', 0, NULL,  13, 'public'),
  ('c1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-00000000000a', 'x', 'e1000000-0000-0000-0000-00000000000e', 2, NULL,  13, 'public'),
  ('c1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-00000000000a', 'x', 'e1000000-0000-0000-0000-00000000000e', 0, now(), 13, 'public'),
  ('c1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-00000000000a', 'x', 'e1000000-0000-0000-0000-00000000000e', 0, NULL,  18, 'public'),
  ('c1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-00000000000a', 'x', 'e1000000-0000-0000-0000-00000000000e', 0, NULL,  13, 'attendees');
SET LOCAL session_replication_role = origin;
GRANT SELECT ON public.reels TO anon, authenticated;   -- Supabase default
GRANT SELECT ON public.event_rsvps TO authenticated;

CREATE TEMP TABLE seen (who text, ids text[]) ON COMMIT DROP;
GRANT ALL ON seen TO anon, authenticated;

-- ── 1. A logged-out visitor sees only the settled, clean clip ────────────────
SET LOCAL ROLE anon;
SET LOCAL test.uid = '';
INSERT INTO seen SELECT 'anon', array_agg(right(id::text, 1) ORDER BY id) FROM public.reels
 WHERE id::text LIKE 'c1000000-%';
RESET ROLE;
DO $$ DECLARE got text[]; BEGIN
  SELECT ids INTO got FROM seen WHERE who = 'anon';
  IF got IS DISTINCT FROM ARRAY['1'] THEN
    RAISE EXCEPTION 'FAIL guest saw % (expected only the settled clip 1)', got;
  END IF;
  RAISE NOTICE 'OK  guests see settled clips only — not new-account, reported, deleted, mature or attendee-only ones';
END $$;

-- ── 2. A signed-in viewer sees new and reported clips, never deleted ones ────
SET LOCAL ROLE authenticated;
SET LOCAL test.uid = 'a3000000-0000-0000-0000-00000000000c';
INSERT INTO seen SELECT 'viewer', array_agg(right(id::text, 1) ORDER BY id) FROM public.reels
 WHERE id::text LIKE 'c1000000-%';
-- ── 3. The owner still sees their own deleted clip ───────────────────────────
SET LOCAL test.uid = 'a1000000-0000-0000-0000-00000000000a';
INSERT INTO seen SELECT 'owner', array_agg(right(id::text, 1) ORDER BY id) FROM public.reels
 WHERE id::text LIKE 'c1000000-%';
RESET ROLE;
DO $$ DECLARE v text[]; o text[]; BEGIN
  SELECT ids INTO v FROM seen WHERE who = 'viewer';
  SELECT ids INTO o FROM seen WHERE who = 'owner';
  IF v IS DISTINCT FROM ARRAY['1','2','3','5'] THEN
    RAISE EXCEPTION 'FAIL signed-in viewer saw % (expected 1,2,3,5: no deleted, no attendee-only without an RSVP)', v;
  END IF;
  IF NOT ('4' = ANY (o)) OR NOT ('6' = ANY (o)) THEN
    RAISE EXCEPTION 'FAIL owner lost sight of their own deleted / attendee-only clip: %', o;
  END IF;
  RAISE NOTICE 'OK  deleted clips hidden from everyone but their owner';
END $$;

-- ── 4. Clip stats can only record what happened ──────────────────────────────
SET LOCAL ROLE authenticated;
SET LOCAL test.uid = 'a3000000-0000-0000-0000-00000000000c';
DO $$ BEGIN
  -- An RSVP credit before any event_open from that clip is refused.
  BEGIN
    INSERT INTO public.reel_conversions (reel_id, event_id, kind)
    VALUES ('c1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-00000000000e', 'rsvp');
    RAISE EXCEPTION 'FAIL rsvp credit accepted without an event_open';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  no rsvp credit without opening the event from the clip';
  END;
  -- The open is fine.
  INSERT INTO public.reel_conversions (reel_id, event_id, kind)
  VALUES ('c1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-00000000000e', 'event_open');
  -- An RSVP credit with no RSVP behind it is refused.
  BEGIN
    INSERT INTO public.reel_conversions (reel_id, event_id, kind)
    VALUES ('c1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-00000000000e', 'rsvp');
    RAISE EXCEPTION 'FAIL rsvp credit accepted with no RSVP';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  no rsvp credit without a real RSVP';
  END;
  -- Credit for an event the clip is not tagged to is refused.
  BEGIN
    INSERT INTO public.reel_conversions (reel_id, event_id, kind)
    VALUES ('c1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-00000000000f', 'event_open');
    RAISE EXCEPTION 'FAIL credit accepted for an untagged event';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  no credit for an event the clip is not tagged to';
  END;
END $$;
RESET ROLE;
SET LOCAL session_replication_role = replica;
INSERT INTO public.event_rsvps (event_id, user_id, status)
VALUES ('e1000000-0000-0000-0000-00000000000e', 'a3000000-0000-0000-0000-00000000000c', 'going');
SET LOCAL session_replication_role = origin;
SET LOCAL ROLE authenticated;
INSERT INTO public.reel_conversions (reel_id, event_id, kind)
VALUES ('c1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-00000000000e', 'rsvp');

-- The creator can't credit their own clip.
SET LOCAL test.uid = 'a1000000-0000-0000-0000-00000000000a';
DO $$ BEGIN
  BEGIN
    INSERT INTO public.reel_conversions (reel_id, event_id, kind)
    VALUES ('c1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-00000000000e', 'event_open');
    RAISE EXCEPTION 'FAIL creator credited their own clip';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  creators cannot credit their own clips';
  END;
  -- Nor read who tapped: only totals, through my_clip_stats().
  IF EXISTS (SELECT 1 FROM public.reel_conversions) THEN
    RAISE EXCEPTION 'FAIL creator can read the viewer list';
  END IF;
  RAISE NOTICE 'OK  creators see totals, not the people behind them';
END $$;

-- ── 5. The host's totals add up ──────────────────────────────────────────────
SET LOCAL test.uid = 'a4000000-0000-0000-0000-00000000000d';
DO $$ DECLARE s record; BEGIN
  SELECT * INTO s FROM public.my_clip_stats() WHERE reel_id = 'c1000000-0000-0000-0000-000000000001';
  IF s IS NULL OR s.event_opens <> 1 OR s.rsvps <> 1 OR s.mine THEN
    RAISE EXCEPTION 'FAIL host stats wrong: %', s;
  END IF;
  IF EXISTS (SELECT 1 FROM public.my_clip_stats() WHERE reel_id = 'c1000000-0000-0000-0000-000000000004') THEN
    RAISE EXCEPTION 'FAIL a deleted clip still counts in the host stats';
  END IF;
  RAISE NOTICE 'OK  host sees 1 open → 1 RSVP for the clip, and no deleted clips';
END $$;
RESET ROLE;

-- Guests can't call the stats at all.
DO $$ BEGIN
  IF has_function_privilege('anon', 'public.my_clip_stats()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL anon can execute my_clip_stats()';
  END IF;
  RAISE NOTICE 'OK  my_clip_stats() is signed-in only';
END $$;

ROLLBACK;

\echo ''
\echo '════════════════════════════════════════════════════════════════════'
\echo ' Reel visibility + clip stats: VERIFIED'
\echo '════════════════════════════════════════════════════════════════════'
