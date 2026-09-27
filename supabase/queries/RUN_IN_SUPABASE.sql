-- ════════════════════════════════════════════════════════════════════════════
--  THE GRUVS — RUN THIS IN SUPABASE (one paste fixes the live app)
--  Supabase → SQL Editor → paste ALL of this → Run.  Idempotent · safe to re-run
--  · no DROP / no data loss.  Bundles FIX_LIVE_ISSUES + FIX_COMPETITION_ENGINE
--  + FIX_SOCIAL_RPCS.
--
--  Fixes: check-in (Touch Down), DMs (the 400), reels, profile columns, Vibe
--  Passport, the competition engine (standings, careers, votes, predictions),
--  AND the social RPCs (follow button + story posting/reshare fast path).
--  After running, also set Supabase → Auth → URL Config → Site URL =
--  https://thegruvs.com (+ Redirect URLs) to finish password reset.
-- ════════════════════════════════════════════════════════════════════════════


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  PART 1 of 2 — LIVE ISSUES (check-in, DMs, reels, profile)                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- ════════════════════════════════════════════════════════════════════════════
--  THE GRUVS — FIX LIVE ISSUES (reels black video, reels Explore error, check-in)
--  Paste this whole file into Supabase → SQL Editor → Run. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

-- 1) BLACK VIDEO: these reels are videos saved with an image-looking name, and
--    media_type was never set to 'video', so the app renders them as a photo
--    (black frame). Mark them as video.
UPDATE public.reels
SET media_type = 'video'
WHERE id IN (
  'e5245a84-1291-4f4e-b0fa-5754c8c62a5b',
  'd2909991-dd83-4058-ab56-f50c4a79e871',
  '12780b46-eae0-4d3d-9031-b3153876358b',
  'bcc01894-0acf-44f0-8fe7-5a10bc7f2d6b',
  '98527ff5-297b-435e-a776-f119ce5a0ba4',
  'df273ecc-d7f7-4c04-a335-f4ccd53293ea',
  '16222c83-34de-4fe0-bb70-8548d8cc7110',
  '22e9fed7-03d2-4015-85c5-25f8e605e547'
);

-- 2) REELS ERROR (Explore tab): the app reads reels.thumbnail_url, which is
--    missing in the live DB. Add it (nullable; the app falls back to cover_url).
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- 3) CHECK-IN: the GPS-privacy hardening revoked lat/lon from LOGGED-IN users too,
--    not just anonymous visitors — which breaks the check-in map. Restore read
--    access for authenticated users only (anonymous stays blocked = no GPS harvesting).
GRANT SELECT ON public.live_checkins TO authenticated;
GRANT SELECT (lat, lon) ON public.live_checkins TO authenticated;
-- anon remains revoked (do NOT grant to anon).

-- 4) PROFILE COLUMNS the app uses but that were never migrated to the live DB.
--    Their absence throws "column does not exist", breaking signup personalization,
--    profile display, and Find Them targeting.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name    TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS surname       TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clan_name     TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS home_village  TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS home_base_lat FLOAT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS home_base_lon FLOAT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date    DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birthday      DATE;    -- app also queries this name
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_year    INTEGER; -- and this one
-- NOTE: the app inconsistently uses birth_date / birthday / birth_year for date-of-birth.
-- All three are added so nothing errors; consolidating to a single column is a future cleanup.

-- 5) NEW FEATURES added since (profile age field + Vibe Passport stamps).
--    profiles.age: ProfilePage reads (load) AND writes (save) it -> both 400 without it.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age INTEGER;

--    event_stamps: Vibe Passport reads it (ViberProfileModal). Table never existed,
--    so the read 404s (currently swallowed -> empty passport). Create it so it works.
CREATE TABLE IF NOT EXISTS public.event_stamps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id    UUID REFERENCES public.events(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  venue_name  TEXT,
  stamp_icon  TEXT DEFAULT 'award',
  stamp_color TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_stamps_user ON public.event_stamps(user_id);
ALTER TABLE public.event_stamps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS event_stamps_read ON public.event_stamps;
CREATE POLICY event_stamps_read ON public.event_stamps FOR SELECT TO authenticated USING (true);
-- (stamps are minted server-side / by a future trigger; no client INSERT policy on purpose)

-- 6) CHECK-IN (Touch Down) — probing the live DB showed live_checkins is missing
--    the identity_mode column (so ghost/incognito check-ins can't carry their mode),
--    and the write relied on a UNIQUE(user_id,event_id) that may be absent + an
--    INSERT policy that may be missing. Add all three, safely + idempotently.
ALTER TABLE public.live_checkins ADD COLUMN IF NOT EXISTS identity_mode TEXT DEFAULT 'public';
ALTER TABLE public.live_checkins ADD COLUMN IF NOT EXISTS expires_at    TIMESTAMPTZ;
ALTER TABLE public.live_checkins ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ DEFAULT now();

-- one row per user per event — add the unique constraint only if none exists on
-- (user_id, event_id), de-duping any existing rows first so it can be created.
DO $$
DECLARE has_uniq boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.live_checkins'::regclass AND c.contype = 'u'
      AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
             FROM unnest(c.conkey) k
             JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k)
          = ARRAY['event_id','user_id']
  ) INTO has_uniq;
  IF NOT has_uniq THEN
    DELETE FROM public.live_checkins a USING public.live_checkins b
      WHERE a.ctid < b.ctid AND a.user_id = b.user_id AND a.event_id = b.event_id;
    ALTER TABLE public.live_checkins
      ADD CONSTRAINT live_checkins_user_event_uniq UNIQUE (user_id, event_id);
  END IF;
END $$;

-- ensure an authenticated user can write their OWN check-in (RLS INSERT/UPDATE).
ALTER TABLE public.live_checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS live_checkins_select     ON public.live_checkins;
CREATE POLICY live_checkins_select     ON public.live_checkins FOR SELECT USING (true);
DROP POLICY IF EXISTS live_checkins_insert     ON public.live_checkins;
CREATE POLICY live_checkins_insert     ON public.live_checkins FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS live_checkins_update_own ON public.live_checkins;
CREATE POLICY live_checkins_update_own ON public.live_checkins FOR UPDATE USING (user_id = auth.uid());

-- 7) DIRECT MESSAGES (the 400 on send): MessageManager.send writes message_type,
--    is_request, request_accepted, media_url, parent_id, event_id, latitude,
--    longitude — if the live `messages` table is missing ANY of these, the INSERT
--    400s. Add them all (additive, idempotent) + ensure participant RLS.
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS body             TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type     TEXT DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_url        TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS parent_id        UUID;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS event_id         UUID;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS latitude         DOUBLE PRECISION;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS longitude        DOUBLE PRECISION;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_request       BOOLEAN DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS request_accepted BOOLEAN DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at          TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS messages_select_parts ON public.messages;
CREATE POLICY messages_select_parts ON public.messages FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());
DROP POLICY IF EXISTS messages_insert_own ON public.messages;
CREATE POLICY messages_insert_own ON public.messages FOR INSERT WITH CHECK (sender_id = auth.uid());
DROP POLICY IF EXISTS messages_update_parts ON public.messages;
CREATE POLICY messages_update_parts ON public.messages FOR UPDATE
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- 8) DIAGNOSTIC (read-only — changes nothing). If DMs STILL 400 after the column
--    adds above, the cause is a CHECK constraint or trigger — run these two and
--    share the output so we can pinpoint the exact rule rejecting the insert.
SELECT conname, pg_get_constraintdef(oid) AS check_definition
FROM pg_constraint
WHERE conrelid = 'public.messages'::regclass AND contype = 'c';

SELECT tgname AS trigger_name, pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgrelid = 'public.messages'::regclass AND NOT tgisinternal;

-- ✅ Done.

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  PART 2 of 2 — COMPETITION ENGINE (standings, careers, votes)             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- ════════════════════════════════════════════════════════════════════════════
--  THE GRUVS — COMPETITION ENGINE FUNCTIONS (deploy to live DB)
--  Paste this whole file into Supabase → SQL Editor → Run. Safe to re-run.
--
--  WHY: the competition tables exist on live, but 4 engine RPCs were never
--  deployed — so standings never recompute, player careers never update, and
--  governance votes / match predictions 404. These are the exact CREATE OR
--  REPLACE definitions from schema_part_3 / schema_part_4 (idempotent, no data
--  loss) — extracted so you don't have to run the giant schema files on prod.
--    • recompute_league_table   — rebuilds the league table after a match
--    • recompute_player_career  — rolls match events up into FIFA-card stats
--    • cast_role_vote           — tournament governance voting
--    • cast_match_prediction    — match prediction casting
-- ════════════════════════════════════════════════════════════════════════════

-- 1) recompute_league_table ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recompute_league_table(p_event_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_config  public.event_sport_config%ROWTYPE;
  v_match   RECORD;
BEGIN
  SELECT * INTO v_config FROM public.event_sport_config WHERE event_id = p_event_id;
  UPDATE public.sport_league_table SET
    played=0,won=0,drawn=0,lost=0,goals_for=0,goals_against=0,
    goal_diff=0,points=0,form='{}',
    home_played=0,home_won=0,home_drawn=0,home_lost=0,
    away_played=0,away_won=0,away_drawn=0,away_lost=0,
    last_updated=now()
  WHERE event_id = p_event_id;
  INSERT INTO public.sport_league_table (event_id, team_id, group_id)
    SELECT t.event_id, t.id, t.group_id FROM public.sport_teams t
    WHERE t.event_id = p_event_id
  ON CONFLICT (event_id, team_id) DO NOTHING;
  FOR v_match IN
    SELECT * FROM public.sport_matches
    WHERE event_id = p_event_id AND status = 'completed'
      AND home_team_id IS NOT NULL AND away_team_id IS NOT NULL
  LOOP
    IF v_match.result = 'home_win' OR (v_match.result IS NULL AND v_match.home_score > v_match.away_score) THEN
      UPDATE public.sport_league_table SET played=played+1,won=won+1,goals_for=goals_for+v_match.home_score,goals_against=goals_against+v_match.away_score,goal_diff=goal_diff+(v_match.home_score-v_match.away_score),points=points+(v_config.win_points),form=array_append(form,'W'),home_played=home_played+1,home_won=home_won+1,last_updated=now() WHERE event_id=p_event_id AND team_id=v_match.home_team_id;
      UPDATE public.sport_league_table SET played=played+1,lost=lost+1,goals_for=goals_for+v_match.away_score,goals_against=goals_against+v_match.home_score,goal_diff=goal_diff+(v_match.away_score-v_match.home_score),points=points+(v_config.loss_points),form=array_append(form,'L'),away_played=away_played+1,away_lost=away_lost+1,last_updated=now() WHERE event_id=p_event_id AND team_id=v_match.away_team_id;
    ELSIF v_match.result = 'away_win' OR (v_match.result IS NULL AND v_match.away_score > v_match.home_score) THEN
      UPDATE public.sport_league_table SET played=played+1,lost=lost+1,goals_for=goals_for+v_match.home_score,goals_against=goals_against+v_match.away_score,goal_diff=goal_diff+(v_match.home_score-v_match.away_score),points=points+(v_config.loss_points),form=array_append(form,'L'),home_played=home_played+1,home_lost=home_lost+1,last_updated=now() WHERE event_id=p_event_id AND team_id=v_match.home_team_id;
      UPDATE public.sport_league_table SET played=played+1,won=won+1,goals_for=goals_for+v_match.away_score,goals_against=goals_against+v_match.home_score,goal_diff=goal_diff+(v_match.away_score-v_match.home_score),points=points+(v_config.win_points),form=array_append(form,'W'),away_played=away_played+1,away_won=away_won+1,last_updated=now() WHERE event_id=p_event_id AND team_id=v_match.away_team_id;
    ELSE
      UPDATE public.sport_league_table SET played=played+1,drawn=drawn+1,goals_for=goals_for+v_match.home_score,goals_against=goals_against+v_match.away_score,goal_diff=goal_diff+(v_match.home_score-v_match.away_score),points=points+(v_config.draw_points),form=array_append(form,'D'),home_played=home_played+1,home_drawn=home_drawn+1,last_updated=now() WHERE event_id=p_event_id AND team_id=v_match.home_team_id;
      UPDATE public.sport_league_table SET played=played+1,drawn=drawn+1,goals_for=goals_for+v_match.away_score,goals_against=goals_against+v_match.home_score,goal_diff=goal_diff+(v_match.away_score-v_match.home_score),points=points+(v_config.draw_points),form=array_append(form,'D'),away_played=away_played+1,away_drawn=away_drawn+1,last_updated=now() WHERE event_id=p_event_id AND team_id=v_match.away_team_id;
    END IF;
  END LOOP;
  UPDATE public.sport_league_table SET form=form[greatest(1,cardinality(form)-4):cardinality(form)] WHERE event_id=p_event_id;
  WITH ranked AS (SELECT id,ROW_NUMBER() OVER (ORDER BY points DESC,goal_diff DESC,goals_for DESC) AS rn FROM public.sport_league_table WHERE event_id=p_event_id)
  UPDATE public.sport_league_table lt SET position=r.rn FROM ranked r WHERE lt.id=r.id;
  UPDATE public.sport_teams t SET played=lt.played,won=lt.won,drawn=lt.drawn,lost=lt.lost,goals_for=lt.goals_for,goals_against=lt.goals_against,goal_diff=lt.goal_diff,points=lt.points,form=lt.form,position=lt.position,updated_at=now()
  FROM public.sport_league_table lt WHERE lt.event_id=p_event_id AND lt.team_id=t.id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.recompute_league_table(UUID) TO authenticated;

-- 2) recompute_player_career ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recompute_player_career(p_player_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.players p SET
    career_apps    = COALESCE((SELECT COUNT(*) FROM public.sport_athletes WHERE player_id = p_player_id), 0),
    career_events  = COALESCE((SELECT COUNT(DISTINCT event_id) FROM public.event_guests WHERE player_id = p_player_id), 0),
    career_awards  = COALESCE((SELECT COUNT(*) FROM public.event_guests WHERE player_id = p_player_id AND award IS NOT NULL AND award <> ''), 0),
    career_goals   = COALESCE((SELECT COUNT(*) FROM public.sport_match_events me JOIN public.sport_athletes sa ON sa.id = me.athlete_id WHERE sa.player_id = p_player_id AND me.event_type = 'goal'), 0),
    career_yellow  = COALESCE((SELECT COUNT(*) FROM public.sport_match_events me JOIN public.sport_athletes sa ON sa.id = me.athlete_id WHERE sa.player_id = p_player_id AND me.event_type = 'yellow_card'), 0),
    career_red     = COALESCE((SELECT COUNT(*) FROM public.sport_match_events me JOIN public.sport_athletes sa ON sa.id = me.athlete_id WHERE sa.player_id = p_player_id AND me.event_type = 'red_card'), 0),
    career_rating  = COALESCE((
      SELECT ROUND(AVG(r)::numeric, 2) FROM (
        SELECT rating AS r FROM public.player_match_ratings WHERE player_id = p_player_id
        UNION ALL
        SELECT rating AS r FROM public.event_guests WHERE player_id = p_player_id AND rating IS NOT NULL
      ) all_ratings
    ), 0),
    follower_count = COALESCE((SELECT COUNT(*) FROM public.player_followers WHERE player_id = p_player_id), 0),
    updated_at     = now()
  WHERE p.id = p_player_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.recompute_player_career(UUID) TO authenticated;

-- 3) cast_role_vote ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cast_role_vote(
  p_competition UUID,
  p_role        TEXT,
  p_candidate   UUID,
  p_club        UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_threshold INT;
  v_top_candidate UUID;
  v_top_votes INT;
BEGIN
  IF p_role NOT IN ('results_editor','log_keeper','fixtures_manager','disciplinary','head_organizer') THEN
    RAISE EXCEPTION 'INVALID_ROLE';
  END IF;
  -- The caller must own / captain the SPECIFIC team (p_club) they vote with.
  -- (Both branches must be scoped to p_club — otherwise any club owner or any
  --  team captain could cast a vote on behalf of a club that isn't theirs.)
  IF NOT EXISTS (
    SELECT 1 FROM public.clubs WHERE id = p_club AND owner_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.sport_teams WHERE club_id = p_club AND captain_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'NOT_TEAM_REP';
  END IF;

  -- Record / change this team's vote.
  INSERT INTO public.tournament_role_votes (competition_id, role, candidate_id, voter_user_id, voter_club_id)
  VALUES (p_competition, p_role, p_candidate, auth.uid(), p_club)
  ON CONFLICT (competition_id, role, voter_club_id)
  DO UPDATE SET candidate_id = EXCLUDED.candidate_id, voter_user_id = EXCLUDED.voter_user_id, created_at = now();

  SELECT vote_threshold INTO v_threshold FROM public.competitions WHERE id = p_competition;
  v_threshold := COALESCE(v_threshold, 5);

  -- Leading candidate for this role (by distinct teams).
  SELECT candidate_id, COUNT(*) INTO v_top_candidate, v_top_votes
  FROM public.tournament_role_votes
  WHERE competition_id = p_competition AND role = p_role
  GROUP BY candidate_id
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- Grant (or replace holder) when the leader reaches the threshold.
  IF v_top_votes >= v_threshold THEN
    INSERT INTO public.tournament_officials (competition_id, role, user_id, votes_at_election, elected_at)
    VALUES (p_competition, p_role, v_top_candidate, v_top_votes, now())
    ON CONFLICT (competition_id, role)
    DO UPDATE SET user_id = EXCLUDED.user_id, votes_at_election = EXCLUDED.votes_at_election, elected_at = now();
  END IF;

  RETURN jsonb_build_object(
    'threshold', v_threshold,
    'leader', v_top_candidate,
    'leader_votes', v_top_votes,
    'elected', (v_top_votes >= v_threshold)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.cast_role_vote TO authenticated;

-- 4) cast_match_prediction ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cast_match_prediction(
  p_event UUID,
  p_side  TEXT DEFAULT NULL,
  p_team  UUID DEFAULT NULL,
  p_label TEXT DEFAULT NULL,
  p_match UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total INT;
BEGIN
  INSERT INTO public.match_predictions (event_id, match_id, user_id, predicted_side, predicted_team_id, predicted_label)
  VALUES (p_event, p_match, auth.uid(), p_side, p_team, p_label)
  ON CONFLICT (event_id, user_id)
  DO UPDATE SET predicted_side = EXCLUDED.predicted_side, predicted_team_id = EXCLUDED.predicted_team_id,
                predicted_label = EXCLUDED.predicted_label, match_id = EXCLUDED.match_id, created_at = now();

  SELECT COUNT(*) INTO v_total FROM public.match_predictions WHERE event_id = p_event;
  RETURN jsonb_build_object(
    'total', v_total,
    'tally', COALESCE((
      SELECT jsonb_object_agg(k, c) FROM (
        SELECT COALESCE(predicted_label, predicted_side, 'unknown') AS k, COUNT(*) AS c
        FROM public.match_predictions WHERE event_id = p_event
        GROUP BY 1
      ) t
    ), '{}'::jsonb)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.cast_match_prediction TO authenticated;

-- ✅ Done — competition engine deployed.



-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  PART 3 of 3 — SOCIAL RPCs (follow / unfollow / stories)                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- ════════════════════════════════════════════════════════════════════════════
--  THE GRUVS — SOCIAL RPCs (follow, unfollow, stories)
--  Paste into Supabase → SQL Editor → Run. Idempotent · safe to re-run · no drops.
--
--  Why: the app's follow button, story posting and story reshare each try a
--  SECURITY DEFINER RPC first, then fall back to a direct table write. These RPCs
--  are missing on the live DB, so every action wasted retries before the fallback
--  (felt broken / sluggish). Creating them makes the primary path work instantly
--  AND sidesteps any RLS gap on the underlying tables.
--
--  Each RPC is SECURITY DEFINER but GUARDS that the caller can only act as
--  themselves (auth.uid() must match the actor) — so definer rights can't be
--  abused to follow/post on behalf of someone else.
-- ════════════════════════════════════════════════════════════════════════════

-- ── follow_user ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.follow_user(p_follower_id uuid, p_following_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_follower_id THEN
    RAISE EXCEPTION 'not authorized to follow on behalf of another user';
  END IF;
  IF p_follower_id = p_following_id THEN
    RETURN; -- can't follow yourself; no-op
  END IF;
  INSERT INTO public.follows (follower_id, following_id)
  VALUES (p_follower_id, p_following_id)
  ON CONFLICT (follower_id, following_id) DO NOTHING;
END;
$$;

-- ── unfollow_user ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.unfollow_user(p_follower_id uuid, p_following_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_follower_id THEN
    RAISE EXCEPTION 'not authorized to unfollow on behalf of another user';
  END IF;
  DELETE FROM public.follows
  WHERE follower_id = p_follower_id AND following_id = p_following_id;
END;
$$;

-- ── create_story ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_story(
  p_user_id uuid, p_url text, p_type text, p_expires_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'not authorized to post a story as another user';
  END IF;
  INSERT INTO public.stories (user_id, media_url, media_type, caption, expires_at)
  VALUES (p_user_id, p_url, COALESCE(p_type, 'image'), '', COALESCE(p_expires_at, now() + interval '24 hours'))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ── mark_stories_seen ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_stories_seen(p_story_ids uuid[], p_viewer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_viewer_id THEN
    RAISE EXCEPTION 'not authorized to mark seen as another viewer';
  END IF;
  INSERT INTO public.story_views (story_id, viewer_id)
  SELECT sid, p_viewer_id FROM unnest(p_story_ids) AS sid
  ON CONFLICT (story_id, viewer_id) DO NOTHING;
END;
$$;

-- Let signed-in users call these (definer body enforces per-user authorization).
GRANT EXECUTE ON FUNCTION public.follow_user(uuid, uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.unfollow_user(uuid, uuid)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_story(uuid, text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_stories_seen(uuid[], uuid) TO authenticated;

-- ✅ Done — social RPCs deployed (follow button + story reshare fast path).

-- ✅ ALL DONE. Now set Auth → Site URL = https://thegruvs.com.
