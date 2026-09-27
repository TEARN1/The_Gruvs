-- ============================================================
--  THE GRUVS — SPORTS & COMPETITIVE EVENTS PLATFORM
--  Run in: Supabase → SQL Editor → Run
--  Idempotent — safe to re-run.
-- ============================================================

-- ── SPORT TYPE REGISTRY ──────────────────────────────────────────────────────
-- Stored per-event; drives which UI components to render

-- ── EVENT SPORT CONFIG — one row per event ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_sport_config (
  event_id          UUID        PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  sport_type        TEXT        NOT NULL,   -- soccer|rugby|basketball|cricket|athletics|tennis|boxing|volleyball|netball|swimming|golf|motorsport|cycling|esports|chess|darts|other
  format            TEXT        DEFAULT 'league' CHECK (format IN ('league','knockout','group_stage','round_robin','single','relay','time_trial','grand_prix')),
  -- Scoring rules (flexible per sport)
  win_points        INTEGER     DEFAULT 3,
  draw_points       INTEGER     DEFAULT 1,
  loss_points       INTEGER     DEFAULT 0,
  tiebreaker_order  TEXT[]      DEFAULT '{"goal_difference","goals_for","head_to_head","away_goals"}',
  -- Match format config
  periods           INTEGER     DEFAULT 2,    -- halves / quarters / sets / rounds
  period_duration   INTEGER     DEFAULT 45,   -- minutes (0 = time-unlimited)
  extra_time        BOOLEAN     DEFAULT true,
  penalties         BOOLEAN     DEFAULT true,
  -- Tournament config
  group_count       INTEGER     DEFAULT 1,
  teams_advance     INTEGER     DEFAULT 2,    -- per group advancing to knockout
  -- Visibility
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
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  group_id    UUID        REFERENCES public.sport_groups(id) ON DELETE SET NULL,
  name        TEXT        NOT NULL,
  short_name  TEXT,                            -- e.g. "MAN" for Manchester
  logo_url    TEXT,
  color1      TEXT        DEFAULT '#00f2ff',
  color2      TEXT        DEFAULT '#ffffff',
  manager     TEXT,
  home_ground TEXT,
  -- Roster (stored as JSONB array of {name, number, position, photo_url})
  players     JSONB       DEFAULT '[]',
  -- Registration
  captain_user_id UUID    REFERENCES public.profiles(id) ON DELETE SET NULL,
  contact_name TEXT,
  contact_phone TEXT,
  -- Stats (computed, cached here for performance)
  played      INTEGER     DEFAULT 0,
  won         INTEGER     DEFAULT 0,
  drawn       INTEGER     DEFAULT 0,
  lost        INTEGER     DEFAULT 0,
  goals_for   INTEGER     DEFAULT 0,
  goals_against INTEGER   DEFAULT 0,
  goal_diff   INTEGER     DEFAULT 0,
  points      INTEGER     DEFAULT 0,
  form        TEXT[]      DEFAULT '{}',       -- last 5: W/D/L/N
  position    INTEGER,                        -- league table rank
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sport_teams_event ON public.sport_teams(event_id);
ALTER TABLE public.sport_teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sport_teams_read" ON public.sport_teams;
CREATE POLICY "sport_teams_read" ON public.sport_teams FOR SELECT USING (true);
DROP POLICY IF EXISTS "sport_teams_host" ON public.sport_teams;
CREATE POLICY "sport_teams_host" ON public.sport_teams FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()));

-- ── SPORT ATHLETES (individual sports) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sport_athletes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  team_id     UUID        REFERENCES public.sport_teams(id) ON DELETE SET NULL,
  group_id    UUID        REFERENCES public.sport_groups(id) ON DELETE SET NULL,
  user_id     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  name        TEXT        NOT NULL,
  bib_number  TEXT,
  photo_url   TEXT,
  nationality TEXT,
  date_of_birth DATE,
  personal_best JSONB     DEFAULT '{}',       -- {event: "100m", time: "9.58", date: "2009-08-16"}
  stats       JSONB       DEFAULT '{}',       -- sport-specific stats
  seed        INTEGER,                        -- tournament seeding
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sport_athletes_event ON public.sport_athletes(event_id);
ALTER TABLE public.sport_athletes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sport_athletes_read" ON public.sport_athletes;
CREATE POLICY "sport_athletes_read" ON public.sport_athletes FOR SELECT USING (true);

-- ── SPORT MATCHES / FIXTURES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sport_matches (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  group_id        UUID        REFERENCES public.sport_groups(id) ON DELETE SET NULL,
  round           TEXT,                       -- "Matchday 1", "Quarter-Final", "Final", "Heat 1"
  round_number    INTEGER     DEFAULT 1,
  match_number    INTEGER     DEFAULT 1,
  -- Teams / participants
  home_team_id    UUID        REFERENCES public.sport_teams(id) ON DELETE SET NULL,
  away_team_id    UUID        REFERENCES public.sport_teams(id) ON DELETE SET NULL,
  home_athlete_id UUID        REFERENCES public.sport_athletes(id) ON DELETE SET NULL,
  away_athlete_id UUID        REFERENCES public.sport_athletes(id) ON DELETE SET NULL,
  -- Venue
  venue_name      TEXT,
  venue_address   TEXT,
  -- Scheduling
  scheduled_at    TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  status          TEXT        DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','half_time','completed','postponed','cancelled','abandoned')),
  -- Full-time scores
  home_score      INTEGER     DEFAULT 0,
  away_score      INTEGER     DEFAULT 0,
  -- AET / penalties
  home_score_aet  INTEGER,
  away_score_aet  INTEGER,
  home_score_pens INTEGER,
  away_score_pens INTEGER,
  -- Result
  result          TEXT        CHECK (result IN ('home_win','away_win','draw','home_walkover','away_walkover')),
  winner_team_id  UUID        REFERENCES public.sport_teams(id) ON DELETE SET NULL,
  winner_athlete_id UUID      REFERENCES public.sport_athletes(id) ON DELETE SET NULL,
  -- Sport-specific detail (period scores, innings, sets, etc.)
  match_data      JSONB       DEFAULT '{}',
  -- Referee / officials
  referee         TEXT,
  officials       JSONB       DEFAULT '[]',
  -- Attendance
  attendance      INTEGER,
  -- Live current state
  current_minute  INTEGER     DEFAULT 0,
  current_period  INTEGER     DEFAULT 1,
  -- Commentary / match report
  match_report    TEXT,
  man_of_match    TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sport_matches_event    ON public.sport_matches(event_id);
CREATE INDEX IF NOT EXISTS idx_sport_matches_status   ON public.sport_matches(status);
CREATE INDEX IF NOT EXISTS idx_sport_matches_round    ON public.sport_matches(event_id, round_number);
ALTER TABLE public.sport_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sport_matches_read" ON public.sport_matches;
CREATE POLICY "sport_matches_read" ON public.sport_matches FOR SELECT USING (true);
DROP POLICY IF EXISTS "sport_matches_host" ON public.sport_matches;
CREATE POLICY "sport_matches_host" ON public.sport_matches FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()));

-- ── MATCH EVENTS (goals, cards, tries, wickets, etc.) ────────────────────────
CREATE TABLE IF NOT EXISTS public.sport_match_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      UUID        NOT NULL REFERENCES public.sport_matches(id) ON DELETE CASCADE,
  event_id      UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  event_type    TEXT        NOT NULL,         -- goal|yellow_card|red_card|substitution|try|conversion|penalty_kick|wicket|ace|foul|injury|var_review|own_goal|penalty_miss|offside|corner|free_kick|ko|tko|submission|sprint_start|finish|heat_result
  team_id       UUID        REFERENCES public.sport_teams(id) ON DELETE SET NULL,
  athlete_id    UUID        REFERENCES public.sport_athletes(id) ON DELETE SET NULL,
  player_name   TEXT,                         -- denormalised for display without join
  player_number TEXT,
  assist_name   TEXT,                         -- soccer assist, cricket run-out fielder, etc.
  minute        INTEGER,                      -- match minute (null for individual sports)
  extra_time    BOOLEAN     DEFAULT false,
  period        INTEGER     DEFAULT 1,
  score_home    INTEGER,                      -- score at time of event
  score_away    INTEGER,
  detail        JSONB       DEFAULT '{}',     -- extra detail (e.g. substitution: {player_off, player_on})
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_match_events_match   ON public.sport_match_events(match_id);
CREATE INDEX IF NOT EXISTS idx_match_events_type    ON public.sport_match_events(event_type);
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

-- ── INDIVIDUAL SPORT RESULTS (athletics, swimming, golf, etc.) ───────────────
CREATE TABLE IF NOT EXISTS public.sport_individual_results (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  match_id        UUID        REFERENCES public.sport_matches(id) ON DELETE CASCADE,  -- heat/round this belongs to
  athlete_id      UUID        REFERENCES public.sport_athletes(id) ON DELETE SET NULL,
  team_id         UUID        REFERENCES public.sport_teams(id) ON DELETE SET NULL,
  discipline      TEXT,                       -- "100m", "Long Jump", "100m Butterfly", "Hole 1"
  round_name      TEXT,                       -- "Heats", "Semi-Final", "Final"
  heat_number     INTEGER,
  lane_number     INTEGER,
  starting_position INTEGER,
  finish_position INTEGER,
  -- Time / score / distance / height depending on sport
  result_time     TEXT,                       -- "9.58", "1:43.87" (stored as text for formatting)
  result_score    FLOAT,                      -- numeric for sorting
  result_distance FLOAT,                      -- metres for field events
  result_height   FLOAT,                      -- metres for high jump / pole vault
  result_weight   FLOAT,                      -- kg for powerlifting
  result_points   FLOAT,                      -- decathlon points, golf score
  wind_reading    FLOAT,                      -- m/s for sprints/jumps
  -- Status
  status          TEXT        DEFAULT 'valid' CHECK (status IN ('valid','dq','dns','dnf','nj','nm','pb','sb','wr','ar','cr')),
  status_label    TEXT,                       -- human-readable status
  -- Golf-specific
  par             INTEGER,
  strokes         INTEGER,
  to_par          INTEGER,                    -- computed: strokes - par
  -- Notes
  notes           TEXT,
  is_personal_best BOOLEAN    DEFAULT false,
  is_record       BOOLEAN     DEFAULT false,
  record_type     TEXT,                       -- 'world'|'african'|'national'|'event'
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_indiv_results_event    ON public.sport_individual_results(event_id);
CREATE INDEX IF NOT EXISTS idx_indiv_results_athlete  ON public.sport_individual_results(athlete_id);
CREATE INDEX IF NOT EXISTS idx_indiv_results_discipline ON public.sport_individual_results(discipline);
ALTER TABLE public.sport_individual_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "indiv_results_read" ON public.sport_individual_results;
CREATE POLICY "indiv_results_read" ON public.sport_individual_results FOR SELECT USING (true);

-- ── LEAGUE TABLE (cached / computed) ─────────────────────────────────────────
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
  -- Bonus / deductions
  bonus_points    INTEGER     DEFAULT 0,
  points_deducted INTEGER     DEFAULT 0,
  -- Form guide (last 5 results as W/D/L)
  form            TEXT[]      DEFAULT '{}',
  -- Home / away splits
  home_played     INTEGER     DEFAULT 0,
  home_won        INTEGER     DEFAULT 0,
  home_drawn      INTEGER     DEFAULT 0,
  home_lost       INTEGER     DEFAULT 0,
  away_played     INTEGER     DEFAULT 0,
  away_won        INTEGER     DEFAULT 0,
  away_drawn      INTEGER     DEFAULT 0,
  away_lost       INTEGER     DEFAULT 0,
  -- Last updated
  last_updated    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, team_id)
);
CREATE INDEX IF NOT EXISTS idx_league_table_event    ON public.sport_league_table(event_id, position);
ALTER TABLE public.sport_league_table ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "league_table_read" ON public.sport_league_table;
CREATE POLICY "league_table_read" ON public.sport_league_table FOR SELECT USING (true);

-- ── TOP PERFORMERS (cached leaderboard) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sport_top_performers (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  category      TEXT        NOT NULL,     -- "top_scorers"|"top_assists"|"clean_sheets"|"top_try_scorers"|"top_wicket_takers"
  team_id       UUID        REFERENCES public.sport_teams(id) ON DELETE SET NULL,
  athlete_id    UUID        REFERENCES public.sport_athletes(id) ON DELETE SET NULL,
  player_name   TEXT        NOT NULL,
  player_photo  TEXT,
  value         FLOAT       NOT NULL DEFAULT 0,
  extra_data    JSONB       DEFAULT '{}',
  position      INTEGER     DEFAULT 0,
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_top_performers_event ON public.sport_top_performers(event_id, category);
ALTER TABLE public.sport_top_performers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "top_performers_read" ON public.sport_top_performers;
CREATE POLICY "top_performers_read" ON public.sport_top_performers FOR SELECT USING (true);

-- ── LIVE SPORT COMMENTARY ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sport_live_commentary (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    UUID        NOT NULL REFERENCES public.sport_matches(id) ON DELETE CASCADE,
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  author_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  minute      INTEGER,
  period      INTEGER     DEFAULT 1,
  type        TEXT        DEFAULT 'update' CHECK (type IN ('update','goal','card','substitution','whistle','injury','var','highlight','stats','final')),
  body        TEXT        NOT NULL,
  media_url   TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
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

-- ── SPORT MEDIA (match photos/videos) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sport_media (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  match_id      UUID        REFERENCES public.sport_matches(id) ON DELETE SET NULL,
  uploader_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url     TEXT        NOT NULL,
  media_type    TEXT        DEFAULT 'image' CHECK (media_type IN ('image','video')),
  caption       TEXT,
  tags          TEXT[],     -- player names, team names tagged
  minute        INTEGER,    -- match minute this was captured
  likes_count   INTEGER     DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sport_media_event ON public.sport_media(event_id, created_at DESC);
ALTER TABLE public.sport_media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sport_media_read" ON public.sport_media;
CREATE POLICY "sport_media_read" ON public.sport_media FOR SELECT USING (true);
DROP POLICY IF EXISTS "sport_media_own" ON public.sport_media;
CREATE POLICY "sport_media_own" ON public.sport_media FOR INSERT WITH CHECK (uploader_id = auth.uid());

-- ── SPORT FOLLOWERS (follow a tournament/league) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.sport_event_followers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id     UUID        REFERENCES public.sport_teams(id) ON DELETE SET NULL,  -- which team they support
  notify_goals     BOOLEAN DEFAULT true,
  notify_results   BOOLEAN DEFAULT true,
  notify_fixtures  BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);
ALTER TABLE public.sport_event_followers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sport_followers_own" ON public.sport_event_followers;
CREATE POLICY "sport_followers_own" ON public.sport_event_followers FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "sport_followers_read" ON public.sport_event_followers;
CREATE POLICY "sport_followers_read" ON public.sport_event_followers FOR SELECT USING (true);

-- ── ENABLE REALTIME ──────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sport_matches','sport_match_events','sport_live_commentary','sport_league_table']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- ── FUNCTION: Recompute League Table ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recompute_league_table(p_event_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_config  public.event_sport_config%ROWTYPE;
  v_match   RECORD;
BEGIN
  SELECT * INTO v_config FROM public.event_sport_config WHERE event_id = p_event_id;

  -- Reset all table entries for this event
  UPDATE public.sport_league_table SET
    played=0,won=0,drawn=0,lost=0,goals_for=0,goals_against=0,
    goal_diff=0,points=0,form='{}',
    home_played=0,home_won=0,home_drawn=0,home_lost=0,
    away_played=0,away_won=0,away_drawn=0,away_lost=0,
    last_updated=now()
  WHERE event_id = p_event_id;

  -- Ensure rows exist for all teams
  INSERT INTO public.sport_league_table (event_id, team_id, group_id)
    SELECT t.event_id, t.id, t.group_id
    FROM public.sport_teams t
    WHERE t.event_id = p_event_id
  ON CONFLICT (event_id, team_id) DO NOTHING;

  -- Process each completed match
  FOR v_match IN
    SELECT * FROM public.sport_matches
    WHERE event_id = p_event_id AND status = 'completed'
      AND home_team_id IS NOT NULL AND away_team_id IS NOT NULL
  LOOP
    -- Determine result
    IF v_match.result = 'home_win' OR
       (v_match.result IS NULL AND v_match.home_score > v_match.away_score) THEN
      -- Home win
      UPDATE public.sport_league_table SET
        played=played+1, won=won+1,
        goals_for=goals_for+v_match.home_score,
        goals_against=goals_against+v_match.away_score,
        goal_diff=goal_diff+(v_match.home_score-v_match.away_score),
        points=points+(v_config.win_points),
        form=array_append(form,'W'),
        home_played=home_played+1, home_won=home_won+1,
        last_updated=now()
      WHERE event_id=p_event_id AND team_id=v_match.home_team_id;

      UPDATE public.sport_league_table SET
        played=played+1, lost=lost+1,
        goals_for=goals_for+v_match.away_score,
        goals_against=goals_against+v_match.home_score,
        goal_diff=goal_diff+(v_match.away_score-v_match.home_score),
        points=points+(v_config.loss_points),
        form=array_append(form,'L'),
        away_played=away_played+1, away_lost=away_lost+1,
        last_updated=now()
      WHERE event_id=p_event_id AND team_id=v_match.away_team_id;

    ELSIF v_match.result = 'away_win' OR
          (v_match.result IS NULL AND v_match.away_score > v_match.home_score) THEN
      -- Away win
      UPDATE public.sport_league_table SET
        played=played+1, lost=lost+1,
        goals_for=goals_for+v_match.home_score,
        goals_against=goals_against+v_match.away_score,
        goal_diff=goal_diff+(v_match.home_score-v_match.away_score),
        points=points+(v_config.loss_points),
        form=array_append(form,'L'),
        home_played=home_played+1, home_lost=home_lost+1,
        last_updated=now()
      WHERE event_id=p_event_id AND team_id=v_match.home_team_id;

      UPDATE public.sport_league_table SET
        played=played+1, won=won+1,
        goals_for=goals_for+v_match.away_score,
        goals_against=goals_against+v_match.home_score,
        goal_diff=goal_diff+(v_match.away_score-v_match.home_score),
        points=points+(v_config.win_points),
        form=array_append(form,'W'),
        away_played=away_played+1, away_won=away_won+1,
        last_updated=now()
      WHERE event_id=p_event_id AND team_id=v_match.away_team_id;

    ELSE
      -- Draw
      UPDATE public.sport_league_table SET
        played=played+1, drawn=drawn+1,
        goals_for=goals_for+v_match.home_score,
        goals_against=goals_against+v_match.away_score,
        goal_diff=goal_diff+(v_match.home_score-v_match.away_score),
        points=points+(v_config.draw_points),
        form=array_append(form,'D'),
        home_played=home_played+1, home_drawn=home_drawn+1,
        last_updated=now()
      WHERE event_id=p_event_id AND team_id=v_match.home_team_id;

      UPDATE public.sport_league_table SET
        played=played+1, drawn=drawn+1,
        goals_for=goals_for+v_match.away_score,
        goals_against=goals_against+v_match.home_score,
        goal_diff=goal_diff+(v_match.away_score-v_match.home_score),
        points=points+(v_config.draw_points),
        form=array_append(form,'D'),
        away_played=away_played+1, away_drawn=away_drawn+1,
        last_updated=now()
      WHERE event_id=p_event_id AND team_id=v_match.away_team_id;
    END IF;
  END LOOP;

  -- Trim form to last 5
  UPDATE public.sport_league_table
  SET form = form[greatest(1,cardinality(form)-4) : cardinality(form)]
  WHERE event_id = p_event_id;

  -- Re-rank by points → goal_diff → goals_for
  WITH ranked AS (
    SELECT id,
      ROW_NUMBER() OVER (ORDER BY points DESC, goal_diff DESC, goals_for DESC) AS rn
    FROM public.sport_league_table
    WHERE event_id = p_event_id
  )
  UPDATE public.sport_league_table lt SET position = r.rn
  FROM ranked r WHERE lt.id = r.id;

  -- Sync cached stats back to sport_teams
  UPDATE public.sport_teams t SET
    played = lt.played, won = lt.won, drawn = lt.drawn, lost = lt.lost,
    goals_for = lt.goals_for, goals_against = lt.goals_against,
    goal_diff = lt.goal_diff, points = lt.points,
    form = lt.form, position = lt.position, updated_at = now()
  FROM public.sport_league_table lt
  WHERE lt.event_id = p_event_id AND lt.team_id = t.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_league_table(UUID) TO authenticated;

-- ── TRIGGER: Auto-recompute on match completion ───────────────────────────────
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
