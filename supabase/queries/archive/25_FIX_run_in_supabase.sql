-- ============================================================
--  THE GRUVS — DATABASE FIX
--  Run this ONCE in: Supabase → SQL Editor → Run
--
--  What this fixes:
--    • Migration 19 (sports platform) partially applied — sport_groups
--      was created but all other tables were missing. This re-runs 19
--      safely (all statements use CREATE TABLE IF NOT EXISTS).
--    • Migrations 21-24 never applied: sport_media_likes, soft_delete,
--      event_parity, clubs_and_awards.
--    • event_media table stub added (required by migration 23).
--    • sport_media_own RLS policy bug fixed (USING → WITH CHECK).
--
--  Idempotent — safe to re-run if any step already succeeded.
-- ============================================================

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  PART 1 — MIGRATION 19: SPORTS PLATFORM (missing tables)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ── EVENT SPORT CONFIG ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_sport_config (
  event_id          UUID        PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  sport_type        TEXT        NOT NULL,
  format            TEXT        DEFAULT 'league' CHECK (format IN ('league','knockout','group_stage','round_robin','single','relay','time_trial','grand_prix')),
  win_points        INTEGER     DEFAULT 3,
  draw_points       INTEGER     DEFAULT 1,
  loss_points       INTEGER     DEFAULT 0,
  tiebreaker_order  TEXT[]      DEFAULT '{"goal_difference","goals_for","head_to_head","away_goals"}',
  periods           INTEGER     DEFAULT 2,
  period_duration   INTEGER     DEFAULT 45,
  extra_time        BOOLEAN     DEFAULT true,
  penalties         BOOLEAN     DEFAULT true,
  group_count       INTEGER     DEFAULT 1,
  teams_advance     INTEGER     DEFAULT 2,
  is_public         BOOLEAN     DEFAULT true,
  registration_open BOOLEAN     DEFAULT true,
  max_teams         INTEGER,
  max_athletes      INTEGER,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.event_sport_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sport_config_read" ON public.event_sport_config;
CREATE POLICY "sport_config_read" ON public.event_sport_config FOR SELECT USING (true);
DROP POLICY IF EXISTS "sport_config_host" ON public.event_sport_config;
CREATE POLICY "sport_config_host" ON public.event_sport_config FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()));

-- ── SPORT GROUPS (for group-stage tournaments) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.sport_groups (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,           -- "Group A", "Pool 1", etc.
  position    INTEGER     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.sport_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sport_groups_read" ON public.sport_groups;
CREATE POLICY "sport_groups_read" ON public.sport_groups FOR SELECT USING (true);

-- ── SPORT TEAMS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sport_teams (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  group_id        UUID        REFERENCES public.sport_groups(id) ON DELETE SET NULL,
  name            TEXT        NOT NULL,
  short_name      TEXT,
  logo_url        TEXT,
  color1          TEXT        DEFAULT '#00f2ff',
  color2          TEXT        DEFAULT '#ffffff',
  manager         TEXT,
  home_ground     TEXT,
  players         JSONB       DEFAULT '[]',
  captain_user_id UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  contact_name    TEXT,
  contact_phone   TEXT,
  played          INTEGER     DEFAULT 0,
  won             INTEGER     DEFAULT 0,
  drawn           INTEGER     DEFAULT 0,
  lost            INTEGER     DEFAULT 0,
  goals_for       INTEGER     DEFAULT 0,
  goals_against   INTEGER     DEFAULT 0,
  goal_diff       INTEGER     DEFAULT 0,
  points          INTEGER     DEFAULT 0,
  form            TEXT[]      DEFAULT '{}',
  position        INTEGER,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sport_teams_event ON public.sport_teams(event_id);
ALTER TABLE public.sport_teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sport_teams_read" ON public.sport_teams;
CREATE POLICY "sport_teams_read" ON public.sport_teams FOR SELECT USING (deleted_at IS NULL);
DROP POLICY IF EXISTS "sport_teams_host" ON public.sport_teams;
CREATE POLICY "sport_teams_host" ON public.sport_teams FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()));

-- ── SPORT ATHLETES ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sport_athletes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  team_id       UUID        REFERENCES public.sport_teams(id) ON DELETE SET NULL,
  group_id      UUID        REFERENCES public.sport_groups(id) ON DELETE SET NULL,
  user_id       UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  name          TEXT        NOT NULL,
  bib_number    TEXT,
  photo_url     TEXT,
  nationality   TEXT,
  date_of_birth DATE,
  personal_best JSONB       DEFAULT '{}',
  stats         JSONB       DEFAULT '{}',
  seed          INTEGER,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sport_athletes_event ON public.sport_athletes(event_id);
ALTER TABLE public.sport_athletes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sport_athletes_read" ON public.sport_athletes;
CREATE POLICY "sport_athletes_read" ON public.sport_athletes FOR SELECT USING (true);

-- ── SPORT MATCHES ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sport_matches (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  group_id          UUID        REFERENCES public.sport_groups(id) ON DELETE SET NULL,
  round             TEXT,
  round_number      INTEGER     DEFAULT 1,
  match_number      INTEGER     DEFAULT 1,
  home_team_id      UUID        REFERENCES public.sport_teams(id) ON DELETE SET NULL,
  away_team_id      UUID        REFERENCES public.sport_teams(id) ON DELETE SET NULL,
  home_athlete_id   UUID        REFERENCES public.sport_athletes(id) ON DELETE SET NULL,
  away_athlete_id   UUID        REFERENCES public.sport_athletes(id) ON DELETE SET NULL,
  venue_name        TEXT,
  venue_address     TEXT,
  scheduled_at      TIMESTAMPTZ,
  started_at        TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  status            TEXT        DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','half_time','completed','postponed','cancelled','abandoned')),
  home_score        INTEGER     DEFAULT 0,
  away_score        INTEGER     DEFAULT 0,
  home_score_aet    INTEGER,
  away_score_aet    INTEGER,
  home_score_pens   INTEGER,
  away_score_pens   INTEGER,
  result            TEXT        CHECK (result IN ('home_win','away_win','draw','home_walkover','away_walkover')),
  winner_team_id    UUID        REFERENCES public.sport_teams(id) ON DELETE SET NULL,
  winner_athlete_id UUID        REFERENCES public.sport_athletes(id) ON DELETE SET NULL,
  match_data        JSONB       DEFAULT '{}',
  referee           TEXT,
  officials         JSONB       DEFAULT '[]',
  attendance        INTEGER,
  current_minute    INTEGER     DEFAULT 0,
  current_period    INTEGER     DEFAULT 1,
  match_report      TEXT,
  man_of_match      TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sport_matches_event  ON public.sport_matches(event_id);
CREATE INDEX IF NOT EXISTS idx_sport_matches_status ON public.sport_matches(status);
CREATE INDEX IF NOT EXISTS idx_sport_matches_round  ON public.sport_matches(event_id, round_number);
ALTER TABLE public.sport_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sport_matches_read" ON public.sport_matches;
CREATE POLICY "sport_matches_read" ON public.sport_matches FOR SELECT USING (true);
DROP POLICY IF EXISTS "sport_matches_host" ON public.sport_matches;
CREATE POLICY "sport_matches_host" ON public.sport_matches FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()));

-- ── SPORT MATCH EVENTS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sport_match_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      UUID        NOT NULL REFERENCES public.sport_matches(id) ON DELETE CASCADE,
  event_id      UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  event_type    TEXT        NOT NULL,
  team_id       UUID        REFERENCES public.sport_teams(id) ON DELETE SET NULL,
  athlete_id    UUID        REFERENCES public.sport_athletes(id) ON DELETE SET NULL,
  player_name   TEXT,
  player_number TEXT,
  assist_name   TEXT,
  minute        INTEGER,
  extra_time    BOOLEAN     DEFAULT false,
  period        INTEGER     DEFAULT 1,
  score_home    INTEGER,
  score_away    INTEGER,
  detail        JSONB       DEFAULT '{}',
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_match_events_match ON public.sport_match_events(match_id);
CREATE INDEX IF NOT EXISTS idx_match_events_type  ON public.sport_match_events(event_type);
ALTER TABLE public.sport_match_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "match_events_read" ON public.sport_match_events;
CREATE POLICY "match_events_read" ON public.sport_match_events FOR SELECT USING (true);
DROP POLICY IF EXISTS "match_events_host" ON public.sport_match_events;
CREATE POLICY "match_events_host" ON public.sport_match_events FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.sport_matches sm
    JOIN public.events e ON e.id = sm.event_id
    WHERE sm.id = match_id AND e.author_id = auth.uid()
  ));

-- ── SPORT INDIVIDUAL RESULTS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sport_individual_results (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  match_id          UUID        REFERENCES public.sport_matches(id) ON DELETE CASCADE,
  athlete_id        UUID        REFERENCES public.sport_athletes(id) ON DELETE SET NULL,
  team_id           UUID        REFERENCES public.sport_teams(id) ON DELETE SET NULL,
  discipline        TEXT,
  round_name        TEXT,
  heat_number       INTEGER,
  lane_number       INTEGER,
  starting_position INTEGER,
  finish_position   INTEGER,
  result_time       TEXT,
  result_score      FLOAT,
  result_distance   FLOAT,
  result_height     FLOAT,
  result_weight     FLOAT,
  result_points     FLOAT,
  wind_reading      FLOAT,
  status            TEXT        DEFAULT 'valid' CHECK (status IN ('valid','dq','dns','dnf','nj','nm','pb','sb','wr','ar','cr')),
  status_label      TEXT,
  par               INTEGER,
  strokes           INTEGER,
  to_par            INTEGER,
  notes             TEXT,
  is_personal_best  BOOLEAN     DEFAULT false,
  is_record         BOOLEAN     DEFAULT false,
  record_type       TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_indiv_results_event      ON public.sport_individual_results(event_id);
CREATE INDEX IF NOT EXISTS idx_indiv_results_athlete    ON public.sport_individual_results(athlete_id);
CREATE INDEX IF NOT EXISTS idx_indiv_results_discipline ON public.sport_individual_results(discipline);
ALTER TABLE public.sport_individual_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "indiv_results_read" ON public.sport_individual_results;
CREATE POLICY "indiv_results_read" ON public.sport_individual_results FOR SELECT USING (true);

-- ── SPORT LEAGUE TABLE ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sport_league_table (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  group_id        UUID        REFERENCES public.sport_groups(id) ON DELETE SET NULL,
  team_id         UUID        NOT NULL REFERENCES public.sport_teams(id) ON DELETE CASCADE,
  position        INTEGER     DEFAULT 0,
  played          INTEGER     DEFAULT 0,
  won             INTEGER     DEFAULT 0,
  drawn           INTEGER     DEFAULT 0,
  lost            INTEGER     DEFAULT 0,
  goals_for       INTEGER     DEFAULT 0,
  goals_against   INTEGER     DEFAULT 0,
  goal_diff       INTEGER     DEFAULT 0,
  points          INTEGER     DEFAULT 0,
  bonus_points    INTEGER     DEFAULT 0,
  points_deducted INTEGER     DEFAULT 0,
  form            TEXT[]      DEFAULT '{}',
  home_played     INTEGER     DEFAULT 0,
  home_won        INTEGER     DEFAULT 0,
  home_drawn      INTEGER     DEFAULT 0,
  home_lost       INTEGER     DEFAULT 0,
  away_played     INTEGER     DEFAULT 0,
  away_won        INTEGER     DEFAULT 0,
  away_drawn      INTEGER     DEFAULT 0,
  away_lost       INTEGER     DEFAULT 0,
  last_updated    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, team_id)
);
CREATE INDEX IF NOT EXISTS idx_league_table_event ON public.sport_league_table(event_id, position);
ALTER TABLE public.sport_league_table ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "league_table_read" ON public.sport_league_table;
CREATE POLICY "league_table_read" ON public.sport_league_table FOR SELECT USING (true);

-- ── SPORT TOP PERFORMERS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sport_top_performers (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  category     TEXT        NOT NULL,
  team_id      UUID        REFERENCES public.sport_teams(id) ON DELETE SET NULL,
  athlete_id   UUID        REFERENCES public.sport_athletes(id) ON DELETE SET NULL,
  player_name  TEXT        NOT NULL,
  player_photo TEXT,
  value        FLOAT       NOT NULL DEFAULT 0,
  extra_data   JSONB       DEFAULT '{}',
  position     INTEGER     DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_top_performers_event ON public.sport_top_performers(event_id, category);
ALTER TABLE public.sport_top_performers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "top_performers_read" ON public.sport_top_performers;
CREATE POLICY "top_performers_read" ON public.sport_top_performers FOR SELECT USING (true);

-- ── SPORT LIVE COMMENTARY ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sport_live_commentary (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id   UUID        NOT NULL REFERENCES public.sport_matches(id) ON DELETE CASCADE,
  event_id   UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  author_id  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  minute     INTEGER,
  period     INTEGER     DEFAULT 1,
  type       TEXT        DEFAULT 'update' CHECK (type IN ('update','goal','card','substitution','whistle','injury','var','highlight','stats','final')),
  body       TEXT        NOT NULL,
  media_url  TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_commentary_match ON public.sport_live_commentary(match_id, created_at DESC);
ALTER TABLE public.sport_live_commentary ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commentary_read" ON public.sport_live_commentary;
CREATE POLICY "commentary_read" ON public.sport_live_commentary FOR SELECT USING (true);
DROP POLICY IF EXISTS "commentary_host" ON public.sport_live_commentary;
CREATE POLICY "commentary_host" ON public.sport_live_commentary FOR ALL
  USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid())
  );

-- ── SPORT MEDIA ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sport_media (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  match_id    UUID        REFERENCES public.sport_matches(id) ON DELETE SET NULL,
  uploader_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url   TEXT        NOT NULL,
  media_type  TEXT        DEFAULT 'image' CHECK (media_type IN ('image','video')),
  caption     TEXT,
  tags        TEXT[],
  minute      INTEGER,
  likes_count INTEGER     DEFAULT 0,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sport_media_event ON public.sport_media(event_id, created_at DESC);
ALTER TABLE public.sport_media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sport_media_read" ON public.sport_media;
CREATE POLICY "sport_media_read" ON public.sport_media FOR SELECT USING (deleted_at IS NULL);
DROP POLICY IF EXISTS "sport_media_own" ON public.sport_media;
-- FIX: FOR INSERT must use WITH CHECK not USING
CREATE POLICY "sport_media_own" ON public.sport_media FOR INSERT WITH CHECK (uploader_id = auth.uid());

-- ── SPORT EVENT FOLLOWERS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sport_event_followers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id         UUID        REFERENCES public.sport_teams(id) ON DELETE SET NULL,
  notify_goals    BOOLEAN     DEFAULT true,
  notify_results  BOOLEAN     DEFAULT true,
  notify_fixtures BOOLEAN     DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);
ALTER TABLE public.sport_event_followers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sport_followers_own" ON public.sport_event_followers;
CREATE POLICY "sport_followers_own" ON public.sport_event_followers FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "sport_followers_read" ON public.sport_event_followers;
CREATE POLICY "sport_followers_read" ON public.sport_event_followers FOR SELECT USING (true);

-- ── RECOMPUTE LEAGUE TABLE FUNCTION ──────────────────────────────────────────
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

CREATE OR REPLACE FUNCTION public.on_match_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    PERFORM public.recompute_league_table(NEW.event_id);
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_match_status_change ON public.sport_matches;
CREATE TRIGGER trg_match_status_change
  BEFORE UPDATE ON public.sport_matches
  FOR EACH ROW EXECUTE FUNCTION public.on_match_status_change();

-- ── REALTIME (sport tables) ───────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sport_matches','sport_match_events','sport_live_commentary','sport_league_table'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END;
$$;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  PART 2 — MIGRATION 21: SPORT MEDIA LIKES
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS public.sport_media_likes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id   UUID        NOT NULL REFERENCES public.sport_media(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(media_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_sport_media_likes_media ON public.sport_media_likes(media_id);
CREATE INDEX IF NOT EXISTS idx_sport_media_likes_user  ON public.sport_media_likes(user_id);
ALTER TABLE public.sport_media_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sport_media_likes_read" ON public.sport_media_likes;
CREATE POLICY "sport_media_likes_read" ON public.sport_media_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "sport_media_likes_own" ON public.sport_media_likes;
CREATE POLICY "sport_media_likes_own" ON public.sport_media_likes FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.sync_sport_media_likes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.sport_media SET likes_count = likes_count + 1 WHERE id = NEW.media_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.sport_media SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.media_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_sport_media_likes_count ON public.sport_media_likes;
CREATE TRIGGER trg_sport_media_likes_count
  AFTER INSERT OR DELETE ON public.sport_media_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_sport_media_likes_count();


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  PART 3 — MIGRATION 22: SOFT DELETE
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ── EVENTS ───────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') THEN
    EXECUTE 'ALTER TABLE public.events ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_events_not_deleted ON public.events(event_date DESC) WHERE deleted_at IS NULL';
    EXECUTE 'DROP POLICY IF EXISTS "events_select" ON public.events';
    EXECUTE 'CREATE POLICY "events_select" ON public.events FOR SELECT USING (deleted_at IS NULL AND (is_published = true OR author_id = auth.uid()))';
  END IF;
END;
$$;

-- ── SPORT MEDIA ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sport_media') THEN
    EXECUTE 'ALTER TABLE public.sport_media ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sport_media_not_deleted ON public.sport_media(event_id, created_at DESC) WHERE deleted_at IS NULL';
    EXECUTE 'DROP POLICY IF EXISTS "sport_media_read" ON public.sport_media';
    EXECUTE 'CREATE POLICY "sport_media_read" ON public.sport_media FOR SELECT USING (deleted_at IS NULL)';
  END IF;
END;
$$;

-- ── EVENT LINEUP ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_lineup') THEN
    EXECUTE 'ALTER TABLE public.event_lineup ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ';
    EXECUTE 'DROP POLICY IF EXISTS "lineup_read" ON public.event_lineup';
    EXECUTE 'CREATE POLICY "lineup_read" ON public.event_lineup FOR SELECT USING (deleted_at IS NULL)';
  END IF;
END;
$$;

-- ── EVENT VENDORS ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_vendors') THEN
    EXECUTE 'ALTER TABLE public.event_vendors ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ';
    EXECUTE 'DROP POLICY IF EXISTS "vendors_read" ON public.event_vendors';
    EXECUTE 'CREATE POLICY "vendors_read" ON public.event_vendors FOR SELECT USING (deleted_at IS NULL)';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete(p_table TEXT, p_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  EXECUTE format('UPDATE public.%I SET deleted_at = now() WHERE id = $1', p_table) USING p_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.soft_delete(TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_deleted(p_table TEXT, p_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  EXECUTE format('UPDATE public.%I SET deleted_at = NULL WHERE id = $1', p_table) USING p_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.restore_deleted(TEXT, UUID) TO authenticated;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  PART 4 — MIGRATION 23: EVENT PARITY
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- event_media stub (event_gallery already exists, event_media is separate)
CREATE TABLE IF NOT EXISTS public.event_media (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  uploader_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url   TEXT        NOT NULL,
  media_type  TEXT        DEFAULT 'image' CHECK (media_type IN ('image','video')),
  caption     TEXT,
  tags        TEXT[],
  likes_count INTEGER     DEFAULT 0,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_media_event ON public.event_media(event_id, created_at DESC);
ALTER TABLE public.event_media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_media_read" ON public.event_media;
CREATE POLICY "event_media_read" ON public.event_media FOR SELECT USING (deleted_at IS NULL);
DROP POLICY IF EXISTS "event_media_own" ON public.event_media;
CREATE POLICY "event_media_own" ON public.event_media FOR INSERT WITH CHECK (uploader_id = auth.uid());

-- Event followers
CREATE TABLE IF NOT EXISTS public.event_followers (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id           UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notify_lineup     BOOLEAN     DEFAULT true,
  notify_updates    BOOLEAN     DEFAULT true,
  notify_nowplaying BOOLEAN     DEFAULT true,
  notify_results    BOOLEAN     DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_followers_event ON public.event_followers(event_id);
CREATE INDEX IF NOT EXISTS idx_event_followers_user  ON public.event_followers(user_id);
ALTER TABLE public.event_followers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_followers_own" ON public.event_followers;
CREATE POLICY "event_followers_own" ON public.event_followers FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "event_followers_read" ON public.event_followers;
CREATE POLICY "event_followers_read" ON public.event_followers FOR SELECT USING (true);

-- Now playing
CREATE TABLE IF NOT EXISTS public.event_now_playing (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  lineup_id   UUID        REFERENCES public.event_lineup(id) ON DELETE SET NULL,
  setlist_id  UUID        REFERENCES public.event_setlists(id) ON DELETE SET NULL,
  artist_name TEXT        NOT NULL,
  song_title  TEXT,
  started_at  TIMESTAMPTZ DEFAULT now(),
  ended_at    TIMESTAMPTZ,
  is_active   BOOLEAN     DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_now_playing_event ON public.event_now_playing(event_id) WHERE is_active = true;
ALTER TABLE public.event_now_playing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "now_playing_read" ON public.event_now_playing;
CREATE POLICY "now_playing_read" ON public.event_now_playing FOR SELECT USING (true);
DROP POLICY IF EXISTS "now_playing_host" ON public.event_now_playing;
CREATE POLICY "now_playing_host" ON public.event_now_playing FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.on_now_playing_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.event_now_playing SET is_active=false, ended_at=now()
  WHERE event_id=NEW.event_id AND is_active=true AND id<>NEW.id;
  IF NEW.setlist_id IS NOT NULL THEN
    UPDATE public.event_setlists SET is_played=true, played_at=now() WHERE id=NEW.setlist_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_now_playing_insert ON public.event_now_playing;
CREATE TRIGGER trg_now_playing_insert
  AFTER INSERT ON public.event_now_playing
  FOR EACH ROW EXECUTE FUNCTION public.on_now_playing_insert();

-- Event media likes
CREATE TABLE IF NOT EXISTS public.event_media_likes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id   UUID        NOT NULL REFERENCES public.event_media(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(media_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_media_likes_media ON public.event_media_likes(media_id);
CREATE INDEX IF NOT EXISTS idx_event_media_likes_user  ON public.event_media_likes(user_id);
ALTER TABLE public.event_media_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_media_likes_read" ON public.event_media_likes;
CREATE POLICY "event_media_likes_read" ON public.event_media_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "event_media_likes_own" ON public.event_media_likes;
CREATE POLICY "event_media_likes_own" ON public.event_media_likes FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.sync_event_media_likes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP='INSERT' THEN UPDATE public.event_media SET likes_count=likes_count+1 WHERE id=NEW.media_id;
  ELSIF TG_OP='DELETE' THEN UPDATE public.event_media SET likes_count=GREATEST(0,likes_count-1) WHERE id=OLD.media_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_event_media_likes_count ON public.event_media_likes;
CREATE TRIGGER trg_event_media_likes_count
  AFTER INSERT OR DELETE ON public.event_media_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_event_media_likes_count();

-- ── EVENT SESSIONS ALTERATION ────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_sessions') THEN
    EXECUTE 'ALTER TABLE public.event_sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ';
    EXECUTE 'ALTER TABLE public.event_sessions ADD COLUMN IF NOT EXISTS recording_live_url TEXT';
  END IF;
END;
$$;

-- Realtime (event parity tables)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['event_followers','event_now_playing','event_media_likes','event_sessions'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END;
$$;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  PART 5 — MIGRATION 24: CLUBS & AWARDS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS public.clubs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  short_name      TEXT,
  sport_type      TEXT,
  category        TEXT        DEFAULT 'sport',
  logo_url        TEXT,
  banner_url      TEXT,
  bio             TEXT,
  city            TEXT,
  country         TEXT        DEFAULT 'ZA',
  founded_year    INTEGER,
  home_ground     TEXT,
  colors          TEXT[]      DEFAULT '{}',
  contact_email   TEXT,
  contact_phone   TEXT,
  website         TEXT,
  social_handle   TEXT,
  members_count   INTEGER     DEFAULT 0,
  events_count    INTEGER     DEFAULT 0,
  trophies_count  INTEGER     DEFAULT 0,
  is_verified     BOOLEAN     DEFAULT false,
  is_active       BOOLEAN     DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clubs_owner ON public.clubs(owner_id);
CREATE INDEX IF NOT EXISTS idx_clubs_sport ON public.clubs(sport_type);
CREATE INDEX IF NOT EXISTS idx_clubs_city  ON public.clubs(city);
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clubs_read" ON public.clubs;
CREATE POLICY "clubs_read" ON public.clubs FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "clubs_own"  ON public.clubs;
CREATE POLICY "clubs_own"  ON public.clubs FOR ALL
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.club_memberships (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       UUID        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role          TEXT        NOT NULL DEFAULT 'player'
                CHECK (role IN ('player','captain','vice_captain','coach','manager','assistant_coach','physio','analyst','admin','performer','speaker','member')),
  position      TEXT,
  jersey_number TEXT,
  is_active     BOOLEAN     DEFAULT true,
  joined_at     DATE        DEFAULT CURRENT_DATE,
  left_at       DATE,
  season        TEXT,
  display_name  TEXT,
  photo_url     TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_club_memberships_club ON public.club_memberships(club_id, is_active);
CREATE INDEX IF NOT EXISTS idx_club_memberships_user ON public.club_memberships(user_id);
ALTER TABLE public.club_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "memberships_read"  ON public.club_memberships;
CREATE POLICY "memberships_read"  ON public.club_memberships FOR SELECT USING (true);
DROP POLICY IF EXISTS "memberships_self"  ON public.club_memberships;
CREATE POLICY "memberships_self"  ON public.club_memberships FOR ALL
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.clubs WHERE id = club_id AND owner_id = auth.uid()))
  WITH CHECK (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.clubs WHERE id = club_id AND owner_id = auth.uid()));

-- Link sport_teams to clubs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sport_teams') THEN
    EXECUTE 'ALTER TABLE public.sport_teams ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sport_teams_club ON public.sport_teams(club_id)';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.event_awards (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  recipient_user_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_club_id   UUID        REFERENCES public.clubs(id) ON DELETE SET NULL,
  recipient_name      TEXT        NOT NULL,
  recipient_photo     TEXT,
  recipient_club_name TEXT,
  category            TEXT        NOT NULL,
  award_label         TEXT        NOT NULL,
  award_icon          TEXT        DEFAULT '🏆',
  stat_value          FLOAT,
  stat_label          TEXT,
  season              TEXT,
  notes               TEXT,
  is_published        BOOLEAN     DEFAULT false,
  created_by          UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_awards_event ON public.event_awards(event_id);
CREATE INDEX IF NOT EXISTS idx_event_awards_user  ON public.event_awards(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_event_awards_club  ON public.event_awards(recipient_club_id);
ALTER TABLE public.event_awards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "awards_read" ON public.event_awards;
CREATE POLICY "awards_read" ON public.event_awards FOR SELECT USING (is_published = true);
DROP POLICY IF EXISTS "awards_host" ON public.event_awards;
CREATE POLICY "awards_host" ON public.event_awards FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.player_career_stats (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sport_type        TEXT        NOT NULL,
  events_count      INTEGER     DEFAULT 0,
  matches_count     INTEGER     DEFAULT 0,
  goals             INTEGER     DEFAULT 0,
  assists           INTEGER     DEFAULT 0,
  tries             INTEGER     DEFAULT 0,
  points_scored     INTEGER     DEFAULT 0,
  clean_sheets      INTEGER     DEFAULT 0,
  tackles           INTEGER     DEFAULT 0,
  yellow_cards      INTEGER     DEFAULT 0,
  red_cards         INTEGER     DEFAULT 0,
  best_time         TEXT,
  best_distance     FLOAT,
  best_score        FLOAT,
  personal_bests    JSONB       DEFAULT '{}',
  awards_count      INTEGER     DEFAULT 0,
  mvp_count         INTEGER     DEFAULT 0,
  last_updated      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, sport_type)
);
CREATE INDEX IF NOT EXISTS idx_career_stats_user  ON public.player_career_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_career_stats_sport ON public.player_career_stats(sport_type);
ALTER TABLE public.player_career_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "career_stats_read" ON public.player_career_stats;
CREATE POLICY "career_stats_read" ON public.player_career_stats FOR SELECT USING (true);
DROP POLICY IF EXISTS "career_stats_own"  ON public.player_career_stats;
CREATE POLICY "career_stats_own"  ON public.player_career_stats FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.club_invitations (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       UUID        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  inviter_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id    UUID        REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_email TEXT,
  role          TEXT        DEFAULT 'player',
  position      TEXT,
  message       TEXT,
  status        TEXT        DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','expired')),
  expires_at    TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_club_invitations_club    ON public.club_invitations(club_id);
CREATE INDEX IF NOT EXISTS idx_club_invitations_invitee ON public.club_invitations(invitee_id);
ALTER TABLE public.club_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invitations_own" ON public.club_invitations;
CREATE POLICY "invitations_own" ON public.club_invitations FOR ALL
  USING (invitee_id = auth.uid() OR inviter_id = auth.uid() OR EXISTS (SELECT 1 FROM public.clubs WHERE id = club_id AND owner_id = auth.uid()))
  WITH CHECK (inviter_id = auth.uid() OR EXISTS (SELECT 1 FROM public.clubs WHERE id = club_id AND owner_id = auth.uid()));

-- Triggers for clubs
CREATE OR REPLACE FUNCTION public.sync_club_members_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.clubs SET members_count=(SELECT COUNT(*) FROM public.club_memberships WHERE club_id=COALESCE(NEW.club_id,OLD.club_id) AND is_active=true) WHERE id=COALESCE(NEW.club_id,OLD.club_id);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_club_members_count ON public.club_memberships;
CREATE TRIGGER trg_club_members_count
  AFTER INSERT OR UPDATE OR DELETE ON public.club_memberships
  FOR EACH ROW EXECUTE FUNCTION public.sync_club_members_count();

CREATE OR REPLACE FUNCTION public.on_award_published()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_published = true AND NEW.recipient_user_id IS NOT NULL THEN
    INSERT INTO public.player_career_stats (user_id, sport_type, awards_count)
    VALUES (NEW.recipient_user_id, 'general', 1)
    ON CONFLICT (user_id, sport_type) DO UPDATE SET awards_count=player_career_stats.awards_count+1, last_updated=now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_award_published ON public.event_awards;
CREATE TRIGGER trg_award_published
  AFTER INSERT OR UPDATE OF is_published ON public.event_awards
  FOR EACH ROW WHEN (NEW.is_published = true)
  EXECUTE FUNCTION public.on_award_published();

-- Realtime (clubs/awards tables)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['clubs','club_memberships','event_awards','club_invitations'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  DONE — verify with:
--    SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
