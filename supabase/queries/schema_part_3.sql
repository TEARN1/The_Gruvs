-- ══════════════════════════════════════════════════════════════
--  THE GRUVS — CONSOLIDATED SCHEMA · PART 3 of 4
-- ══════════════════════════════════════════════════════════════
--  Run the schema_part_*.sql files IN ORDER on a FRESH Supabase database.
--  Byte-faithful concatenation of the original numbered migrations — the
--  originals are preserved in supabase/queries/archive/ (nothing deleted).
--  Covers: 19_sports_platform.sql … 28_talent_universal.sql
--
--  BUILD-ONCE: a handful of CREATE POLICY / ADD COLUMN lack IF-EXISTS guards,
--  so for an existing DB run only the newer archived increments instead.
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
--  SOURCE: 19_sports_platform.sql
-- ══════════════════════════════════════════════════════════════

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


-- ══════════════════════════════════════════════════════════════
--  SOURCE: 20_event_management.sql
-- ══════════════════════════════════════════════════════════════

-- ============================================================
--  THE GRUVS — EVENT MANAGEMENT PLATFORM v1
--  Universal management tables for all non-sport event types:
--  music, conference, food/market, festival, workshop,
--  hackathon, networking, film, arts, comedy, etc.
--  Run in: Supabase → SQL Editor → Run
-- ============================================================

-- ── EVENT LINEUP (Music / Festival / Conference) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_lineup (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,           -- Artist / Speaker / Performer name
  role          TEXT,                           -- Headliner / Support / Keynote / Panelist / MC / DJ
  stage         TEXT,                           -- Main Stage / Side Stage / Room A / Tent B
  photo_url     TEXT,
  bio           TEXT,
  genre         TEXT,                           -- Music genre or talk topic
  set_start     TEXT,                           -- HH:MM set start time
  set_end       TEXT,                           -- HH:MM set end time
  set_date      DATE,                           -- For multi-day events
  social_handle TEXT,                           -- @handle
  booking_status TEXT DEFAULT 'confirmed' CHECK (booking_status IN ('confirmed','tentative','cancelled')),
  position      INTEGER DEFAULT 0,
  extra_data    JSONB DEFAULT '{}',             -- tech rider, hospitality, etc.
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lineup_event ON public.event_lineup(event_id, set_date, set_start);
ALTER TABLE public.event_lineup ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lineup_read" ON public.event_lineup;
CREATE POLICY "lineup_read" ON public.event_lineup FOR SELECT USING (true);
DROP POLICY IF EXISTS "lineup_host" ON public.event_lineup;
CREATE POLICY "lineup_host" ON public.event_lineup FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()));

-- ── EVENT STAGES (Multi-stage festivals) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_stages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  color       TEXT        DEFAULT '#00f2ff',
  capacity    INTEGER,
  description TEXT,
  position    INTEGER     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.event_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stages_read" ON public.event_stages;
CREATE POLICY "stages_read" ON public.event_stages FOR SELECT USING (true);
DROP POLICY IF EXISTS "stages_host" ON public.event_stages;
CREATE POLICY "stages_host" ON public.event_stages FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()));

-- ── EVENT SETLISTS (Music) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_setlists (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  lineup_id     UUID        REFERENCES public.event_lineup(id) ON DELETE CASCADE,
  artist_name   TEXT        NOT NULL,
  track_number  INTEGER     DEFAULT 1,
  song_title    TEXT        NOT NULL,
  duration_sec  INTEGER,
  is_played     BOOLEAN     DEFAULT false,
  played_at     TIMESTAMPTZ,
  notes         TEXT,                           -- "Extended mix", "With guest", etc.
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_setlists_event ON public.event_setlists(event_id, lineup_id);
ALTER TABLE public.event_setlists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "setlists_read" ON public.event_setlists;
CREATE POLICY "setlists_read" ON public.event_setlists FOR SELECT USING (true);
DROP POLICY IF EXISTS "setlists_host" ON public.event_setlists;
CREATE POLICY "setlists_host" ON public.event_setlists FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()));

-- ── EVENT VENDORS / STALLS (Food Markets, Expos, Craft Fairs) ────────────────
CREATE TABLE IF NOT EXISTS public.event_vendors (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  owner_id      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  name          TEXT        NOT NULL,           -- Vendor / stall name
  category      TEXT,                           -- Food / Drinks / Crafts / Fashion / Tech / Art / Services
  description   TEXT,
  logo_url      TEXT,
  stall_number  TEXT,                           -- A12, Stall 5, etc.
  contact       TEXT,                           -- Phone / email combined
  website       TEXT,
  social_handle TEXT,
  menu_items    JSONB DEFAULT '[]',             -- [{name, price, description, available}]
  is_confirmed  BOOLEAN DEFAULT true,
  is_active     BOOLEAN DEFAULT true,
  extra_data    JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendors_event ON public.event_vendors(event_id);
ALTER TABLE public.event_vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vendors_read" ON public.event_vendors;
CREATE POLICY "vendors_read" ON public.event_vendors FOR SELECT USING (true);
DROP POLICY IF EXISTS "vendors_host" ON public.event_vendors;
CREATE POLICY "vendors_host" ON public.event_vendors FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()));

-- ── EVENT SESSIONS (Conference / Workshop / Seminar) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.event_sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  type          TEXT        DEFAULT 'talk',     -- talk / panel / workshop / keynote / breakout / q_and_a / demo / award / break
  room          TEXT,                           -- Conference Room B, Auditorium, etc.
  speaker       TEXT,                           -- Speaker / facilitator name
  description   TEXT,
  start_time    TEXT,                           -- HH:MM
  end_time      TEXT,
  session_date  DATE,
  capacity      INTEGER,
  attendee_count INTEGER DEFAULT 0,
  is_live       BOOLEAN DEFAULT false,
  recording_url TEXT,
  slides_url    TEXT,
  position      INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_event ON public.event_sessions(event_id, session_date, start_time);
ALTER TABLE public.event_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sessions_read" ON public.event_sessions;
CREATE POLICY "sessions_read" ON public.event_sessions FOR SELECT USING (true);
DROP POLICY IF EXISTS "sessions_host" ON public.event_sessions;
CREATE POLICY "sessions_host" ON public.event_sessions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()));

-- ── EVENT SPEAKERS / FACILITATORS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_speakers (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  title         TEXT,                           -- "CEO at XYZ", "Award-Winning Author"
  company       TEXT,
  photo_url     TEXT,
  bio           TEXT,
  topic         TEXT,
  social_handle TEXT,
  website       TEXT,
  is_keynote    BOOLEAN DEFAULT false,
  position      INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_speakers_event ON public.event_speakers(event_id);
ALTER TABLE public.event_speakers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "speakers_read" ON public.event_speakers;
CREATE POLICY "speakers_read" ON public.event_speakers FOR SELECT USING (true);
DROP POLICY IF EXISTS "speakers_host" ON public.event_speakers;
CREATE POLICY "speakers_host" ON public.event_speakers FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()));

-- ── EVENT TEAMS (Hackathon / Competition / Networking) ────────────────────────
CREATE TABLE IF NOT EXISTS public.event_teams (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  leader_id     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  members       JSONB DEFAULT '[]',             -- [{user_id, name, role}]
  project_title TEXT,
  project_desc  TEXT,
  project_url   TEXT,
  demo_url      TEXT,
  tech_stack    TEXT[],
  submitted     BOOLEAN DEFAULT false,
  submitted_at  TIMESTAMPTZ,
  score         FLOAT,
  judge_notes   TEXT,
  position      INTEGER,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_teams_event ON public.event_teams(event_id);
ALTER TABLE public.event_teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_teams_read" ON public.event_teams;
CREATE POLICY "event_teams_read" ON public.event_teams FOR SELECT USING (true);
DROP POLICY IF EXISTS "event_teams_host" ON public.event_teams;
CREATE POLICY "event_teams_host" ON public.event_teams FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()));

-- ── EVENT JUDGE SCORES (Hackathon / Talent Shows / Competitions) ─────────────
CREATE TABLE IF NOT EXISTS public.event_judge_scores (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  judge_id      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  judge_name    TEXT        NOT NULL,
  participant_id UUID,                          -- team_id or lineup_id
  participant_name TEXT,
  category      TEXT,                           -- Criteria name
  score         FLOAT       NOT NULL,
  max_score     FLOAT       DEFAULT 10,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_judge_scores_event ON public.event_judge_scores(event_id);
ALTER TABLE public.event_judge_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "judge_scores_read" ON public.event_judge_scores;
CREATE POLICY "judge_scores_read" ON public.event_judge_scores FOR SELECT USING (true);
DROP POLICY IF EXISTS "judge_scores_host" ON public.event_judge_scores;
CREATE POLICY "judge_scores_host" ON public.event_judge_scores FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()));

-- ── EVENT LIVE UPDATES (catch-all real-time updates for any event) ────────────
-- (Extends existing event_updates table — this adds structured types)
ALTER TABLE public.event_updates ADD COLUMN IF NOT EXISTS update_type TEXT DEFAULT 'general'
  CHECK (update_type IN ('general','artist_change','delay','cancellation','set_now_playing','vendor_spotlight','session_starting','result','award','announcement','safety','weather'));
ALTER TABLE public.event_updates ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
ALTER TABLE public.event_updates ADD COLUMN IF NOT EXISTS reactions_count INTEGER DEFAULT 0;

-- Enable realtime on management tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'event_lineup'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_lineup;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'event_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'event_updates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_updates;
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════
--  SOURCE: 21_sport_media_likes.sql
-- ══════════════════════════════════════════════════════════════

-- ============================================================
--  THE GRUVS — SPORT MEDIA LIKES
--  Replaces the dumb likes_count integer with a proper likes
--  table so you can track who liked what, prevent double-likes,
--  and show "liked by people you follow".
--  Run in: Supabase → SQL Editor → Run
--  Idempotent — safe to re-run.
-- ============================================================

-- ── LIKES TABLE ───────────────────────────────────────────────────────────────
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
CREATE POLICY "sport_media_likes_own" ON public.sport_media_likes FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── KEEP likes_count IN SYNC VIA TRIGGER ─────────────────────────────────────
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

-- ── REALTIME ──────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'sport_media_likes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sport_media_likes;
  END IF;
END;
$$;


-- ══════════════════════════════════════════════════════════════
--  SOURCE: 22_soft_delete.sql
-- ══════════════════════════════════════════════════════════════

-- ============================================================
--  THE GRUVS — SOFT DELETE
--  Adds deleted_at to events, sport_teams, sport_media,
--  event_lineup, event_vendors so nothing is permanently gone.
--  Existing RLS SELECT policies are replaced to exclude
--  soft-deleted rows automatically.
--  Run in: Supabase → SQL Editor → Run
--  Idempotent — safe to re-run.
-- ============================================================

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

-- ── SPORT TEAMS ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sport_teams') THEN
    EXECUTE 'ALTER TABLE public.sport_teams ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ';

    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sport_teams_not_deleted ON public.sport_teams(event_id) WHERE deleted_at IS NULL';

    EXECUTE 'DROP POLICY IF EXISTS "sport_teams_read" ON public.sport_teams';
    EXECUTE 'CREATE POLICY "sport_teams_read" ON public.sport_teams FOR SELECT USING (deleted_at IS NULL)';
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

-- ── SOFT-DELETE HELPER FUNCTION ───────────────────────────────────────────────
-- Usage: SELECT soft_delete('events', '<uuid>');
CREATE OR REPLACE FUNCTION public.soft_delete(p_table TEXT, p_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  EXECUTE format('UPDATE public.%I SET deleted_at = now() WHERE id = $1', p_table)
    USING p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete(TEXT, UUID) TO authenticated;

-- ── RESTORE HELPER ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.restore_deleted(p_table TEXT, p_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  EXECUTE format('UPDATE public.%I SET deleted_at = NULL WHERE id = $1', p_table)
    USING p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_deleted(TEXT, UUID) TO authenticated;


-- ══════════════════════════════════════════════════════════════
--  SOURCE: 23_event_parity.sql
-- ══════════════════════════════════════════════════════════════

-- ============================================================
--  THE GRUVS — NON-SPORT EVENT PARITY
--  Brings music/conference/market events up to the same level
--  as the sports platform:
--    • event_followers — follow any event (not just sport)
--    • event_media_likes — proper likes for event_media
--    • now_playing — real-time "currently playing" for setlists
--    • event_sessions now-live tracking
--  Run in: Supabase → SQL Editor → Run
--  Idempotent — safe to re-run.
-- ============================================================

-- ── EVENT FOLLOWERS (mirrors sport_event_followers for all events) ────────────
CREATE TABLE IF NOT EXISTS public.event_followers (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id           UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notify_lineup     BOOLEAN     DEFAULT true,   -- artist/speaker changes
  notify_updates    BOOLEAN     DEFAULT true,   -- general announcements
  notify_nowplaying BOOLEAN     DEFAULT true,   -- now playing / set starting
  notify_results    BOOLEAN     DEFAULT true,   -- hackathon scores, award results
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

-- ── NOW PLAYING (real-time current setlist entry) ─────────────────────────────
-- One active row per event at any time. Host marks a song as playing;
-- previous row is automatically cleared by trigger.
CREATE TABLE IF NOT EXISTS public.event_now_playing (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  lineup_id   UUID        REFERENCES public.event_lineup(id) ON DELETE SET NULL,
  setlist_id  UUID        REFERENCES public.event_setlists(id) ON DELETE SET NULL,
  artist_name TEXT        NOT NULL,
  song_title  TEXT,
  started_at  TIMESTAMPTZ DEFAULT now(),
  ended_at    TIMESTAMPTZ,
  is_active   BOOLEAN     DEFAULT true,
  UNIQUE(event_id, is_active) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX IF NOT EXISTS idx_now_playing_event ON public.event_now_playing(event_id) WHERE is_active = true;
ALTER TABLE public.event_now_playing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "now_playing_read" ON public.event_now_playing;
CREATE POLICY "now_playing_read" ON public.event_now_playing FOR SELECT USING (true);
DROP POLICY IF EXISTS "now_playing_host" ON public.event_now_playing;
CREATE POLICY "now_playing_host" ON public.event_now_playing FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()));

-- Trigger: when a new now_playing is inserted, close out the previous active one
CREATE OR REPLACE FUNCTION public.on_now_playing_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.event_now_playing
  SET is_active = false, ended_at = now()
  WHERE event_id = NEW.event_id
    AND is_active = true
    AND id <> NEW.id;

  -- Mark the matched setlist entry as played
  IF NEW.setlist_id IS NOT NULL THEN
    UPDATE public.event_setlists
    SET is_played = true, played_at = now()
    WHERE id = NEW.setlist_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_now_playing_insert ON public.event_now_playing;
CREATE TRIGGER trg_now_playing_insert
  AFTER INSERT ON public.event_now_playing
  FOR EACH ROW EXECUTE FUNCTION public.on_now_playing_insert();

-- ── EVENT MEDIA TABLE (created if missing) ────────────────────────────────────
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

-- ── EVENT MEDIA LIKES (for general event photos/videos) ──────────────────────
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

-- Sync likes_count on event_media (add column if it doesn't exist)
ALTER TABLE public.event_media ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION public.sync_event_media_likes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.event_media SET likes_count = likes_count + 1 WHERE id = NEW.media_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.event_media SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.media_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_media_likes_count ON public.event_media_likes;
CREATE TRIGGER trg_event_media_likes_count
  AFTER INSERT OR DELETE ON public.event_media_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_event_media_likes_count();

-- ── SESSION LIVE TRACKING ─────────────────────────────────────────────────────
-- is_live already on event_sessions; add soft end tracking
ALTER TABLE public.event_sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE public.event_sessions ADD COLUMN IF NOT EXISTS recording_live_url TEXT;

-- ── REALTIME ──────────────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'event_followers',
    'event_now_playing',
    'event_media_likes',
    'event_sessions'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END;
$$;


-- ══════════════════════════════════════════════════════════════
--  SOURCE: 24_clubs_and_awards.sql
-- ══════════════════════════════════════════════════════════════

-- ============================================================
--  THE GRUVS — CLUBS, MEMBERSHIPS & UNIVERSAL AWARDS
--
--  Architecture:
--    clubs              — club/team account (owned by a user profile)
--    club_memberships   — players/staff linked to a club with full history
--    sport_teams        — gets club_id FK (team is a club's entry in an event)
--    event_awards       — universal awards for any event type
--    player_career_stats — cached aggregate stats per player per sport
--
--  A "club" can be:
--    - A football club (players, fixtures, trophies)
--    - A music group / band (performers)
--    - A debate / esports team (participants)
--    - Any organised group that enters events repeatedly
--
--  Run in: Supabase → SQL Editor → Run
--  Idempotent — safe to re-run.
-- ============================================================

-- ── CLUBS ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clubs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  short_name      TEXT,                           -- e.g. "AMA" for Amazulu FC
  sport_type      TEXT,                           -- soccer|rugby|basketball|music|esports|debate|other
  category        TEXT        DEFAULT 'sport',    -- sport|music|esports|arts|education|other
  logo_url        TEXT,
  banner_url      TEXT,
  bio             TEXT,
  city            TEXT,
  country         TEXT        DEFAULT 'ZA',
  founded_year    INTEGER,
  home_ground     TEXT,
  colors          TEXT[]      DEFAULT '{}',       -- ['#00f2ff','#ffffff']
  contact_email   TEXT,
  contact_phone   TEXT,
  website         TEXT,
  social_handle   TEXT,
  -- Stats (cached)
  members_count   INTEGER     DEFAULT 0,
  events_count    INTEGER     DEFAULT 0,
  trophies_count  INTEGER     DEFAULT 0,
  -- Verification
  is_verified     BOOLEAN     DEFAULT false,
  is_active       BOOLEAN     DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clubs_owner    ON public.clubs(owner_id);
CREATE INDEX IF NOT EXISTS idx_clubs_sport    ON public.clubs(sport_type);
CREATE INDEX IF NOT EXISTS idx_clubs_city     ON public.clubs(city);

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clubs_read"  ON public.clubs;
CREATE POLICY "clubs_read"  ON public.clubs FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "clubs_own"   ON public.clubs;
CREATE POLICY "clubs_own"   ON public.clubs FOR ALL
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- ── CLUB MEMBERSHIPS ──────────────────────────────────────────────────────────
-- Full history: a player can have multiple rows (different seasons/clubs)
CREATE TABLE IF NOT EXISTS public.club_memberships (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Role within the club
  role            TEXT        NOT NULL DEFAULT 'player'
                  CHECK (role IN ('player','captain','vice_captain','coach','manager','assistant_coach','physio','analyst','admin','performer','speaker','member')),
  -- Sport/team-specific
  position        TEXT,                           -- striker|midfielder|goalkeeper|vocalist|etc.
  jersey_number   TEXT,
  -- Status
  is_active       BOOLEAN     DEFAULT true,
  joined_at       DATE        DEFAULT CURRENT_DATE,
  left_at         DATE,                           -- NULL = current member
  season          TEXT,                           -- "2024", "2024/25", etc.
  -- Profile snapshot (denormalised for display without join)
  display_name    TEXT,
  photo_url       TEXT,
  -- Notes
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_club_memberships_club   ON public.club_memberships(club_id, is_active);
CREATE INDEX IF NOT EXISTS idx_club_memberships_user   ON public.club_memberships(user_id);

ALTER TABLE public.club_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "memberships_read"       ON public.club_memberships;
CREATE POLICY "memberships_read"       ON public.club_memberships FOR SELECT USING (true);
DROP POLICY IF EXISTS "memberships_self"       ON public.club_memberships;
CREATE POLICY "memberships_self"       ON public.club_memberships FOR ALL
  USING (user_id = auth.uid() OR
         EXISTS (SELECT 1 FROM public.clubs WHERE id = club_id AND owner_id = auth.uid()))
  WITH CHECK (user_id = auth.uid() OR
              EXISTS (SELECT 1 FROM public.clubs WHERE id = club_id AND owner_id = auth.uid()));

-- ── LINK sport_teams TO clubs ─────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sport_teams') THEN
    EXECUTE 'ALTER TABLE public.sport_teams ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sport_teams_club ON public.sport_teams(club_id)';
  END IF;
END;
$$;

-- ── EVENT AWARDS — universal for all event types ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_awards (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  -- Who gets it
  recipient_user_id UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_club_id UUID        REFERENCES public.clubs(id) ON DELETE SET NULL,
  recipient_name    TEXT        NOT NULL,          -- denormalised display name
  recipient_photo   TEXT,
  recipient_club_name TEXT,
  -- Award details
  category          TEXT        NOT NULL,
  -- Sport: player_of_tournament|top_scorer|top_assists|golden_glove|best_xi|mvp|fair_play
  -- Music: best_performance|headline_act|crowd_favourite|best_newcomer
  -- Hackathon: best_project|most_innovative|best_design|best_pitch|people_choice
  -- Conference: best_speaker|best_workshop|best_panel
  -- Universal: participant_of_year|most_valuable|best_in_show
  award_label       TEXT        NOT NULL,          -- human display, e.g. "Golden Boot"
  award_icon        TEXT        DEFAULT '🏆',
  -- Stats attached to the award (optional)
  stat_value        FLOAT,                         -- e.g. 12 (goals), 9.4 (score)
  stat_label        TEXT,                          -- e.g. "goals", "avg score"
  -- Season / context
  season            TEXT,                          -- "2024", "2024/25"
  notes             TEXT,
  -- Visibility
  is_published      BOOLEAN     DEFAULT false,
  created_by        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_awards_event     ON public.event_awards(event_id);
CREATE INDEX IF NOT EXISTS idx_event_awards_user      ON public.event_awards(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_event_awards_club      ON public.event_awards(recipient_club_id);

ALTER TABLE public.event_awards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "awards_read"   ON public.event_awards;
CREATE POLICY "awards_read"   ON public.event_awards FOR SELECT USING (is_published = true);
DROP POLICY IF EXISTS "awards_host"   ON public.event_awards;
CREATE POLICY "awards_host"   ON public.event_awards FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()));

-- ── PLAYER / PERFORMER CAREER STATS (cached aggregate) ────────────────────────
-- One row per user per sport/category — recomputed by trigger or on-demand
CREATE TABLE IF NOT EXISTS public.player_career_stats (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sport_type          TEXT        NOT NULL,
  -- Appearances
  events_count        INTEGER     DEFAULT 0,
  matches_count       INTEGER     DEFAULT 0,
  -- Offensive
  goals               INTEGER     DEFAULT 0,
  assists             INTEGER     DEFAULT 0,
  tries               INTEGER     DEFAULT 0,
  points_scored       INTEGER     DEFAULT 0,
  -- Defensive
  clean_sheets        INTEGER     DEFAULT 0,
  tackles             INTEGER     DEFAULT 0,
  -- Disciplinary
  yellow_cards        INTEGER     DEFAULT 0,
  red_cards           INTEGER     DEFAULT 0,
  -- Individual sports
  best_time           TEXT,
  best_distance       FLOAT,
  best_score          FLOAT,
  personal_bests      JSONB       DEFAULT '{}',
  -- Awards
  awards_count        INTEGER     DEFAULT 0,
  mvp_count           INTEGER     DEFAULT 0,
  -- Meta
  last_updated        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, sport_type)
);
CREATE INDEX IF NOT EXISTS idx_career_stats_user  ON public.player_career_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_career_stats_sport ON public.player_career_stats(sport_type);

ALTER TABLE public.player_career_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "career_stats_read"  ON public.player_career_stats;
CREATE POLICY "career_stats_read"  ON public.player_career_stats FOR SELECT USING (true);
DROP POLICY IF EXISTS "career_stats_own"   ON public.player_career_stats;
CREATE POLICY "career_stats_own"   ON public.player_career_stats FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── CLUB INVITATIONS ──────────────────────────────────────────────────────────
-- Club admin invites a player by user_id or email; player accepts to join
CREATE TABLE IF NOT EXISTS public.club_invitations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  inviter_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id  UUID        REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_email TEXT,
  role        TEXT        DEFAULT 'player',
  position    TEXT,
  message     TEXT,
  status      TEXT        DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','expired')),
  expires_at  TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_club_invitations_club    ON public.club_invitations(club_id);
CREATE INDEX IF NOT EXISTS idx_club_invitations_invitee ON public.club_invitations(invitee_id);

ALTER TABLE public.club_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invitations_own"   ON public.club_invitations;
CREATE POLICY "invitations_own"   ON public.club_invitations FOR ALL
  USING (invitee_id = auth.uid() OR inviter_id = auth.uid() OR
         EXISTS (SELECT 1 FROM public.clubs WHERE id = club_id AND owner_id = auth.uid()))
  WITH CHECK (inviter_id = auth.uid() OR
              EXISTS (SELECT 1 FROM public.clubs WHERE id = club_id AND owner_id = auth.uid()));

-- ── TRIGGER: sync members_count on clubs ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_club_members_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.clubs
  SET members_count = (
    SELECT COUNT(*) FROM public.club_memberships
    WHERE club_id = COALESCE(NEW.club_id, OLD.club_id) AND is_active = true
  )
  WHERE id = COALESCE(NEW.club_id, OLD.club_id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_club_members_count ON public.club_memberships;
CREATE TRIGGER trg_club_members_count
  AFTER INSERT OR UPDATE OR DELETE ON public.club_memberships
  FOR EACH ROW EXECUTE FUNCTION public.sync_club_members_count();

-- ── TRIGGER: increment awards_count on player_career_stats ───────────────────
CREATE OR REPLACE FUNCTION public.on_award_published()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_published = true AND NEW.recipient_user_id IS NOT NULL THEN
    INSERT INTO public.player_career_stats (user_id, sport_type, awards_count)
    VALUES (NEW.recipient_user_id, 'general', 1)
    ON CONFLICT (user_id, sport_type) DO UPDATE
      SET awards_count = player_career_stats.awards_count + 1,
          last_updated = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_published ON public.event_awards;
CREATE TRIGGER trg_award_published
  AFTER INSERT OR UPDATE OF is_published ON public.event_awards
  FOR EACH ROW WHEN (NEW.is_published = true)
  EXECUTE FUNCTION public.on_award_published();

-- ── REALTIME ──────────────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['clubs','club_memberships','event_awards','club_invitations'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END;
$$;


-- ══════════════════════════════════════════════════════════════
--  SOURCE: 25_FIX_run_in_supabase.sql
-- ══════════════════════════════════════════════════════════════

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


-- ══════════════════════════════════════════════════════════════
--  SOURCE: 26_security_hardening_v2.sql
-- ══════════════════════════════════════════════════════════════

-- ============================================================
--  THE GRUVS — 26: SECURITY HARDENING (v2)
--  public_profiles view, schema access controls,
--  security grants, audit helpers, rate-limit functions
--
--  Fix vs. earlier draft: the public_profiles view is dropped and
--  recreated instead of CREATE OR REPLACE. An existing view had a
--  different column layout (e.g. "city" where this one outputs
--  "location"), and CREATE OR REPLACE VIEW cannot rename/reorder
--  existing columns (ERROR 42P16). DROP + CREATE sidesteps that.
-- ============================================================

-- ── Restrict schema creation ──────────────────────────────────
-- Prevents anon/authenticated roles from creating objects in public schema
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM anon;
REVOKE CREATE ON SCHEMA public FROM authenticated;

-- ── public_profiles view (safe projection) ───────────────────
-- Exposes only what anonymous visitors should see.
-- DROP first: CREATE OR REPLACE cannot change an existing view's column
-- names/order (the previous view exposed "city" in this position).
-- NOTE: if the DROP fails with "other objects depend on it", inspect the
-- dependents first, then re-run with CASCADE and recreate them.
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles AS
SELECT
  p.id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.bio,
  p.location,
  p.role,
  p.vibe_score,
  p.followers_count,
  p.following_count,
  p.xp,
  p.badges,
  p.verified,
  p.show_online,
  CASE WHEN p.show_online THEN p.last_seen ELSE NULL END AS last_seen,
  p.updated_at
FROM public.profiles p;

-- Run the view with the querying user's privileges (respects profiles RLS),
-- not the view owner's. Requires Postgres 15+ (Supabase supports it).
ALTER VIEW public.public_profiles SET (security_invoker = true);

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- ── Security definer wrapper for profile upsert ───────────────
-- Prevents users from escalating their own role/sis_score
CREATE OR REPLACE FUNCTION public.upsert_own_profile(
  p_display_name TEXT DEFAULT NULL,
  p_username     TEXT DEFAULT NULL,
  p_bio          TEXT DEFAULT NULL,
  p_location     TEXT DEFAULT NULL,
  p_avatar_url   TEXT DEFAULT NULL,
  p_cover_url    TEXT DEFAULT NULL,
  p_show_online  BOOLEAN DEFAULT NULL,
  p_share_events BOOLEAN DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET
    display_name = COALESCE(p_display_name, display_name),
    username     = COALESCE(p_username,     username),
    bio          = COALESCE(p_bio,          bio),
    location     = COALESCE(p_location,     location),
    avatar_url   = COALESCE(p_avatar_url,   avatar_url),
    cover_url    = COALESCE(p_cover_url,    cover_url),
    show_online  = COALESCE(p_show_online,  show_online),
    share_events = COALESCE(p_share_events, share_events),
    updated_at   = now()
  WHERE id = auth.uid();
END;
$$;

-- ── Rate limiter helper ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_action TEXT,
  p_window_seconds INTEGER DEFAULT 60,
  p_max_calls INTEGER DEFAULT 30
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Uses security_logs table from 07_gruvs_social.sql
  SELECT COUNT(*) INTO v_count
  FROM public.security_logs
  WHERE user_id = auth.uid()
    AND action = p_action
    AND created_at > now() - (p_window_seconds || ' seconds')::interval;
  RETURN v_count < p_max_calls;
END;
$$;

-- ── Log security event ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_action  TEXT,
  p_details JSONB DEFAULT '{}'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.security_logs (user_id, action, details)
  VALUES (auth.uid(), p_action, p_details);
END;
$$;

-- ── Blocked / muted users (tables defined in 01_gruvs_social.sql) ──
-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_blocked_users_user    ON public.blocked_users(user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON public.blocked_users(blocked_id);
CREATE INDEX IF NOT EXISTS idx_muted_users_user      ON public.muted_users(user_id);
CREATE INDEX IF NOT EXISTS idx_muted_users_muted     ON public.muted_users(muted_id);

-- ── Verify admin helper (used by admin-only RPCs) ─────────────
CREATE OR REPLACE FUNCTION public.assert_admin()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;
END;
$$;

-- ── Admin: promote/demote user ────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_user_role(p_user_id UUID, p_role TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin();
  IF p_role NOT IN ('user','host','vendor','moderator','admin') THEN
    RAISE EXCEPTION 'INVALID_ROLE';
  END IF;
  UPDATE public.profiles SET role = p_role WHERE id = p_user_id;
END;
$$;

-- ── Admin: suspend user ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_suspensions (
  user_id    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason     TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  suspended_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.user_suspensions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "suspensions_admin" ON public.user_suspensions;
CREATE POLICY "suspensions_admin" ON public.user_suspensions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── Grant execute on safe RPCs ────────────────────────────────
GRANT EXECUTE ON FUNCTION public.upsert_own_profile       TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_security_event        TO authenticated;
GRANT EXECUTE ON FUNCTION public.secure_check_in           TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_rsvp_tier          TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_ticket_token     TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_wallet_balance  TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_sis_score          TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_trending_events   TO authenticated;


-- ══════════════════════════════════════════════════════════════
--  SOURCE: 27_talent_platform.sql
-- ══════════════════════════════════════════════════════════════

-- ============================================================
--  THE GRUVS — 27: TALENT PLATFORM
--  Persistent player identities, career history, seasons,
--  ratings, event guest mentions, follow-a-player, and the
--  scout leaderboard / talent-search engine.
--
--  Builds ON the existing sport schema (19_sports_platform.sql)
--  and clubs (24_clubs_and_awards.sql). All additive — new tables
--  + one ADD COLUMN; nothing existing is dropped or renamed.
--
--  Idea: a "player" today only exists inside ONE event
--  (sport_athletes). This file gives every player ONE identity that
--  all appearances, goals, seasons and teams link back to — so a
--  scout can view a full career and rank talent globally.
-- ============================================================

-- ── 1. PLAYERS — one persistent identity per athlete ──────────
-- May be linked to a Gruvs user (claimed) or stand alone (a guest
-- tagged on an event who hasn't joined yet → "everyone is someone").
CREATE TABLE IF NOT EXISTS public.players (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        REFERENCES public.profiles(id) ON DELETE SET NULL, -- the claim
  full_name       TEXT        NOT NULL,
  known_as        TEXT,                                   -- display / jersey name
  sport_type      TEXT,                                   -- soccer|rugby|basketball|athletics|...
  primary_position TEXT,                                  -- striker|winger|gk|fly_half|...
  date_of_birth   DATE,
  nationality     TEXT,
  region          TEXT,                                   -- province/city for local scouting
  country         TEXT        DEFAULT 'ZA',
  height_cm       INTEGER,
  preferred_foot  TEXT,                                   -- left|right|both
  photo_url       TEXT,
  bio             TEXT,
  current_club_id UUID        REFERENCES public.clubs(id) ON DELETE SET NULL,
  -- Cached career totals (kept live by triggers; truth via recompute fn)
  career_apps     INTEGER     DEFAULT 0,
  career_goals    INTEGER     DEFAULT 0,
  career_assists  INTEGER     DEFAULT 0,
  career_yellow   INTEGER     DEFAULT 0,
  career_red      INTEGER     DEFAULT 0,
  career_mvp      INTEGER     DEFAULT 0,
  career_rating   NUMERIC(4,2) DEFAULT 0,                 -- avg across rated matches
  follower_count  INTEGER     DEFAULT 0,
  is_verified     BOOLEAN     DEFAULT false,              -- identity verified
  created_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_players_user      ON public.players(user_id);
CREATE INDEX IF NOT EXISTS idx_players_sport     ON public.players(sport_type);
CREATE INDEX IF NOT EXISTS idx_players_region    ON public.players(region);
CREATE INDEX IF NOT EXISTS idx_players_club      ON public.players(current_club_id);
CREATE INDEX IF NOT EXISTS idx_players_goals     ON public.players(sport_type, career_goals DESC);
-- One claim per user (a user maps to at most one player identity)
CREATE UNIQUE INDEX IF NOT EXISTS uq_players_user ON public.players(user_id) WHERE user_id IS NOT NULL;

-- Link a per-event appearance to the global player identity.
ALTER TABLE public.sport_athletes
  ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES public.players(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sport_athletes_player ON public.sport_athletes(player_id);

-- ── 2. COMPETITIONS & SEASONS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.competitions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,                     -- "Gauteng Premier League"
  sport_type    TEXT        NOT NULL,
  kind          TEXT        DEFAULT 'league',             -- league|cup|tournament|friendly
  region        TEXT,
  country       TEXT        DEFAULT 'ZA',
  logo_url      TEXT,
  organizer_id  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_competitions_sport ON public.competitions(sport_type);

CREATE TABLE IF NOT EXISTS public.seasons (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id  UUID        REFERENCES public.competitions(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,                   -- "2025/26"
  start_date      DATE,
  end_date        DATE,
  is_current      BOOLEAN     DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seasons_competition ON public.seasons(competition_id);

-- ── 3. CAREER HISTORY — spells at clubs, per season ───────────
CREATE TABLE IF NOT EXISTS public.player_team_spells (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     UUID        NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  club_id       UUID        REFERENCES public.clubs(id) ON DELETE SET NULL,
  club_name     TEXT,                                     -- denormalised (club may be external)
  season_id     UUID        REFERENCES public.seasons(id) ON DELETE SET NULL,
  shirt_number  TEXT,
  position      TEXT,
  joined_at     DATE,
  left_at       DATE,
  is_current    BOOLEAN     DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spells_player ON public.player_team_spells(player_id);
CREATE INDEX IF NOT EXISTS idx_spells_club   ON public.player_team_spells(club_id);

-- ── 4. PER-SEASON STATS (ratings "for each season") ───────────
CREATE TABLE IF NOT EXISTS public.player_season_stats (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID        NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  season_id       UUID        REFERENCES public.seasons(id) ON DELETE SET NULL,
  competition_id  UUID        REFERENCES public.competitions(id) ON DELETE SET NULL,
  club_id         UUID        REFERENCES public.clubs(id) ON DELETE SET NULL,
  appearances     INTEGER     DEFAULT 0,
  goals           INTEGER     DEFAULT 0,
  assists         INTEGER     DEFAULT 0,
  yellow_cards    INTEGER     DEFAULT 0,
  red_cards       INTEGER     DEFAULT 0,
  clean_sheets    INTEGER     DEFAULT 0,
  minutes_played  INTEGER     DEFAULT 0,
  avg_rating      NUMERIC(4,2) DEFAULT 0,
  mvp_count       INTEGER     DEFAULT 0,
  extra           JSONB       DEFAULT '{}',
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(player_id, season_id)
);
CREATE INDEX IF NOT EXISTS idx_season_stats_player ON public.player_season_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_season_stats_season ON public.player_season_stats(season_id);

-- ── 5. PER-MATCH RATINGS (0–10) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.player_match_ratings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   UUID        NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  match_id    UUID        REFERENCES public.sport_matches(id) ON DELETE CASCADE,
  event_id    UUID        REFERENCES public.events(id) ON DELETE CASCADE,
  rater_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating      NUMERIC(3,1) NOT NULL CHECK (rating >= 0 AND rating <= 10),
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(player_id, match_id, rater_id)                   -- one rating per rater per match
);
CREATE INDEX IF NOT EXISTS idx_match_ratings_player ON public.player_match_ratings(player_id);

-- ── 6. EVENT GUESTS — "mention the guests who'll be there" ─────
CREATE TABLE IF NOT EXISTS public.event_guests (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  player_id   UUID        REFERENCES public.players(id) ON DELETE SET NULL,
  user_id     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL, -- mentioned Gruvs user
  guest_name  TEXT,                                       -- free-text if neither linked
  role        TEXT        DEFAULT 'player',               -- player|performer|host|judge|guest|coach
  team_side   TEXT,                                       -- home|away|null
  club_id     UUID        REFERENCES public.clubs(id) ON DELETE SET NULL,
  added_by    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_guests_event  ON public.event_guests(event_id);
CREATE INDEX IF NOT EXISTS idx_event_guests_player ON public.event_guests(player_id);
CREATE INDEX IF NOT EXISTS idx_event_guests_user   ON public.event_guests(user_id);

-- ── 7. FOLLOW A PLAYER (not just users) ───────────────────────
CREATE TABLE IF NOT EXISTS public.player_followers (
  player_id   UUID        NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  follower_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (player_id, follower_id)
);
CREATE INDEX IF NOT EXISTS idx_player_followers_follower ON public.player_followers(follower_id);

-- ============================================================
--  AUTO-ROLLUP: when a match event is logged, bump the player's
--  cached career totals so leaderboards update instantly.
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_rollup_match_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_player UUID;
BEGIN
  IF NEW.athlete_id IS NULL THEN RETURN NEW; END IF;
  SELECT player_id INTO v_player FROM public.sport_athletes WHERE id = NEW.athlete_id;
  IF v_player IS NULL THEN RETURN NEW; END IF;

  UPDATE public.players SET
    career_goals   = career_goals   + (CASE WHEN NEW.event_type = 'goal'        THEN 1 ELSE 0 END),
    career_assists = career_assists + (CASE WHEN NEW.event_type = 'assist'      THEN 1 ELSE 0 END),
    career_yellow  = career_yellow  + (CASE WHEN NEW.event_type = 'yellow_card' THEN 1 ELSE 0 END),
    career_red     = career_red     + (CASE WHEN NEW.event_type = 'red_card'    THEN 1 ELSE 0 END),
    updated_at     = now()
  WHERE id = v_player;

  -- Soccer assists are also commonly recorded on the goal row's assist_name;
  -- credit the assisting athlete if linked via detail->>'assist_athlete_id'.
  IF NEW.event_type = 'goal' AND (NEW.detail->>'assist_athlete_id') IS NOT NULL THEN
    UPDATE public.players p SET career_assists = career_assists + 1, updated_at = now()
    FROM public.sport_athletes sa
    WHERE sa.id = (NEW.detail->>'assist_athlete_id')::uuid AND p.id = sa.player_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rollup_match_event ON public.sport_match_events;
CREATE TRIGGER trg_rollup_match_event
  AFTER INSERT ON public.sport_match_events
  FOR EACH ROW EXECUTE FUNCTION public.tg_rollup_match_event();

-- Keep follower_count and career_rating honest.
CREATE OR REPLACE FUNCTION public.tg_player_follower_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.players SET follower_count = follower_count + 1 WHERE id = NEW.player_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.players SET follower_count = GREATEST(0, follower_count - 1) WHERE id = OLD.player_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_player_follower_count ON public.player_followers;
CREATE TRIGGER trg_player_follower_count
  AFTER INSERT OR DELETE ON public.player_followers
  FOR EACH ROW EXECUTE FUNCTION public.tg_player_follower_count();

CREATE OR REPLACE FUNCTION public.tg_player_rating_avg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pid UUID;
BEGIN
  v_pid := COALESCE(NEW.player_id, OLD.player_id);
  UPDATE public.players SET
    career_rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM public.player_match_ratings WHERE player_id = v_pid), 0),
    updated_at = now()
  WHERE id = v_pid;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_player_rating_avg ON public.player_match_ratings;
CREATE TRIGGER trg_player_rating_avg
  AFTER INSERT OR UPDATE OR DELETE ON public.player_match_ratings
  FOR EACH ROW EXECUTE FUNCTION public.tg_player_rating_avg();

-- Full recompute (source of truth / drift repair) — appearances + goals
-- from the actual appearance + event rows.
CREATE OR REPLACE FUNCTION public.recompute_player_career(p_player_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.players p SET
    career_apps    = COALESCE((SELECT COUNT(*) FROM public.sport_athletes WHERE player_id = p_player_id), 0),
    career_goals   = COALESCE((SELECT COUNT(*) FROM public.sport_match_events me JOIN public.sport_athletes sa ON sa.id = me.athlete_id WHERE sa.player_id = p_player_id AND me.event_type = 'goal'), 0),
    career_yellow  = COALESCE((SELECT COUNT(*) FROM public.sport_match_events me JOIN public.sport_athletes sa ON sa.id = me.athlete_id WHERE sa.player_id = p_player_id AND me.event_type = 'yellow_card'), 0),
    career_red     = COALESCE((SELECT COUNT(*) FROM public.sport_match_events me JOIN public.sport_athletes sa ON sa.id = me.athlete_id WHERE sa.player_id = p_player_id AND me.event_type = 'red_card'), 0),
    career_rating  = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM public.player_match_ratings WHERE player_id = p_player_id), 0),
    follower_count = COALESCE((SELECT COUNT(*) FROM public.player_followers WHERE player_id = p_player_id), 0),
    updated_at     = now()
  WHERE p.id = p_player_id;
END;
$$;

-- ============================================================
--  SCOUT ENGINE — leaderboard view + flexible search RPC
-- ============================================================
-- Public leaderboard surface with computed age (never exposes DOB).
-- DROP first (not plain CREATE OR REPLACE): on an existing DB the view may
-- already be the later category-aware 26-column shape (see source 28 below),
-- and CREATE OR REPLACE cannot drop columns (ERROR 42P16). CASCADE removes the
-- dependent search_top_players fn, which is recreated immediately after.
DROP VIEW IF EXISTS public.player_leaderboard CASCADE;
CREATE VIEW public.player_leaderboard AS
SELECT
  p.id, p.full_name, p.known_as, p.sport_type, p.primary_position,
  p.nationality, p.region, p.country, p.photo_url,
  p.current_club_id, c.name AS current_club_name,
  p.career_apps, p.career_goals, p.career_assists,
  p.career_rating, p.career_mvp, p.follower_count, p.is_verified,
  CASE WHEN p.date_of_birth IS NOT NULL
       THEN date_part('year', age(p.date_of_birth))::int END AS age,
  p.user_id
FROM public.players p
LEFT JOIN public.clubs c ON c.id = p.current_club_id;

GRANT SELECT ON public.player_leaderboard TO anon, authenticated;

-- "Find me the top U-20 striker in Gauteng" — rank by any metric, filter by
-- sport, age bracket, region, position. (No race filter — by design.)
CREATE OR REPLACE FUNCTION public.search_top_players(
  p_sport     TEXT    DEFAULT NULL,
  p_metric    TEXT    DEFAULT 'goals',     -- goals|assists|apps|rating|followers
  p_region    TEXT    DEFAULT NULL,
  p_position  TEXT    DEFAULT NULL,
  p_min_age   INT     DEFAULT NULL,
  p_max_age   INT     DEFAULT NULL,
  p_limit     INT     DEFAULT 10
)
RETURNS SETOF public.player_leaderboard
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.player_leaderboard pl
  WHERE (p_sport    IS NULL OR pl.sport_type = p_sport)
    AND (p_region   IS NULL OR pl.region ILIKE '%' || p_region || '%')
    AND (p_position IS NULL OR pl.primary_position = p_position)
    AND (p_min_age  IS NULL OR pl.age >= p_min_age)
    AND (p_max_age  IS NULL OR pl.age <= p_max_age)
  ORDER BY
    CASE p_metric
      WHEN 'goals'     THEN pl.career_goals
      WHEN 'assists'   THEN pl.career_assists
      WHEN 'apps'      THEN pl.career_apps
      WHEN 'followers' THEN pl.follower_count
      ELSE 0 END DESC,
    CASE WHEN p_metric = 'rating' THEN pl.career_rating ELSE 0 END DESC,
    pl.career_goals DESC
  LIMIT GREATEST(1, LEAST(p_limit, 100));
END;
$$;
GRANT EXECUTE ON FUNCTION public.search_top_players(text, text, text, text, int, int, int) TO anon, authenticated;

-- ============================================================
--  ROW LEVEL SECURITY
--  Discovery data is publicly readable (that's the point); writes
--  are restricted to the creator / claiming user / admins.
-- ============================================================
ALTER TABLE public.players              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_team_spells   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_season_stats  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_match_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_guests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_followers     ENABLE ROW LEVEL SECURITY;

-- Public read
DROP POLICY IF EXISTS players_read ON public.players;
CREATE POLICY players_read ON public.players FOR SELECT USING (true);
DROP POLICY IF EXISTS competitions_read ON public.competitions;
CREATE POLICY competitions_read ON public.competitions FOR SELECT USING (true);
DROP POLICY IF EXISTS seasons_read ON public.seasons;
CREATE POLICY seasons_read ON public.seasons FOR SELECT USING (true);
DROP POLICY IF EXISTS spells_read ON public.player_team_spells;
CREATE POLICY spells_read ON public.player_team_spells FOR SELECT USING (true);
DROP POLICY IF EXISTS season_stats_read ON public.player_season_stats;
CREATE POLICY season_stats_read ON public.player_season_stats FOR SELECT USING (true);
DROP POLICY IF EXISTS ratings_read ON public.player_match_ratings;
CREATE POLICY ratings_read ON public.player_match_ratings FOR SELECT USING (true);
DROP POLICY IF EXISTS guests_read ON public.event_guests;
CREATE POLICY guests_read ON public.event_guests FOR SELECT USING (true);
DROP POLICY IF EXISTS pfollowers_read ON public.player_followers;
CREATE POLICY pfollowers_read ON public.player_followers FOR SELECT USING (true);

-- Players: any authenticated user can create a player; only the creator,
-- the claiming user, or an admin can update.
DROP POLICY IF EXISTS players_insert ON public.players;
CREATE POLICY players_insert ON public.players FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by OR created_by IS NULL);
DROP POLICY IF EXISTS players_update ON public.players;
CREATE POLICY players_update ON public.players FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = user_id
         OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Competitions / seasons: organizer or admin.
DROP POLICY IF EXISTS competitions_write ON public.competitions;
CREATE POLICY competitions_write ON public.competitions FOR ALL TO authenticated
  USING (auth.uid() = organizer_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (auth.uid() = organizer_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS seasons_write ON public.seasons;
CREATE POLICY seasons_write ON public.seasons FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.competitions co WHERE co.id = competition_id
                 AND (co.organizer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))));

-- Spells & season stats: the player's owner (creator/claim) or admin.
DROP POLICY IF EXISTS spells_write ON public.player_team_spells;
CREATE POLICY spells_write ON public.player_team_spells FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id
                 AND (p.created_by = auth.uid() OR p.user_id = auth.uid()
                      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))));
DROP POLICY IF EXISTS season_stats_write ON public.player_season_stats;
CREATE POLICY season_stats_write ON public.player_season_stats FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id
                 AND (p.created_by = auth.uid() OR p.user_id = auth.uid()
                      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))));

-- Ratings: any authenticated user may rate; only their own rating is editable.
DROP POLICY IF EXISTS ratings_write ON public.player_match_ratings;
CREATE POLICY ratings_write ON public.player_match_ratings FOR ALL TO authenticated
  USING (auth.uid() = rater_id) WITH CHECK (auth.uid() = rater_id);

-- Event guests: the event's author manages the guest list.
DROP POLICY IF EXISTS guests_write ON public.event_guests;
CREATE POLICY guests_write ON public.event_guests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid()));

-- Player followers: a user manages their own follows.
DROP POLICY IF EXISTS pfollowers_write ON public.player_followers;
CREATE POLICY pfollowers_write ON public.player_followers FOR ALL TO authenticated
  USING (auth.uid() = follower_id) WITH CHECK (auth.uid() = follower_id);


-- ══════════════════════════════════════════════════════════════
--  SOURCE: 28_talent_universal.sql
-- ══════════════════════════════════════════════════════════════

-- ============================================================
--  THE GRUVS — 28: UNIVERSAL TALENT
--  Generalises the talent platform (27) from soccer-only to EVERY
--  event category — music, comedy, hackathon, fashion, debate,
--  esports, sport, etc. Adds a category + flexible metrics, makes
--  per-event performance host-editable, and rolls it all up into
--  universal career counters (events / rating / awards / fans).
--
--  Additive: only ADD COLUMN + CREATE OR REPLACE. Nothing dropped
--  except the search RPC (its parameter list changes).
-- ============================================================

-- ── 1. TALENT (players) gets a category + generic metrics ─────
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS category      TEXT;          -- music|comedy|sport|hackathon|fashion|debate|esports|...
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS headline      TEXT;          -- "Afro-house DJ" / "Striker" / "Stand-up"
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS metrics       JSONB DEFAULT '{}';  -- domain stats: {shows:12} / {goals:9} / {builds:4}
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS career_events INTEGER DEFAULT 0;   -- universal "appearances" across all categories
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS career_awards INTEGER DEFAULT 0;

-- ── 2. EVENT GUESTS become host-editable performance records ──
ALTER TABLE public.event_guests ADD COLUMN IF NOT EXISTS rating    NUMERIC(3,1) CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10));
ALTER TABLE public.event_guests ADD COLUMN IF NOT EXISTS placement INTEGER;       -- 1 = winner/MOTM, 2, 3…
ALTER TABLE public.event_guests ADD COLUMN IF NOT EXISTS award     TEXT;          -- "MVP" / "Best Set" / "1st Place"
ALTER TABLE public.event_guests ADD COLUMN IF NOT EXISTS metrics   JSONB DEFAULT '{}'; -- per-event domain stats
ALTER TABLE public.event_guests ADD COLUMN IF NOT EXISTS notes     TEXT;

-- ── 3. Roll event_guests up into universal career counters ────
CREATE OR REPLACE FUNCTION public.tg_rollup_event_guest()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pid UUID;
BEGIN
  v_pid := COALESCE(NEW.player_id, OLD.player_id);
  IF v_pid IS NULL THEN RETURN NULL; END IF;
  UPDATE public.players p SET
    career_events = COALESCE((SELECT COUNT(DISTINCT event_id) FROM public.event_guests WHERE player_id = v_pid), 0),
    career_awards = COALESCE((SELECT COUNT(*) FROM public.event_guests WHERE player_id = v_pid AND award IS NOT NULL AND award <> ''), 0),
    career_rating = COALESCE((
      SELECT ROUND(AVG(r)::numeric, 2) FROM (
        SELECT rating AS r FROM public.player_match_ratings WHERE player_id = v_pid
        UNION ALL
        SELECT rating AS r FROM public.event_guests WHERE player_id = v_pid AND rating IS NOT NULL
      ) all_ratings
    ), p.career_rating),
    updated_at = now()
  WHERE p.id = v_pid;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_rollup_event_guest ON public.event_guests;
CREATE TRIGGER trg_rollup_event_guest
  AFTER INSERT OR UPDATE OR DELETE ON public.event_guests
  FOR EACH ROW EXECUTE FUNCTION public.tg_rollup_event_guest();

-- Extend the source-of-truth recompute with the universal counters.
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

-- ── 4. Leaderboard view + scout RPC become category-aware ─────
-- CREATE OR REPLACE may only APPEND columns to a view → safe to add
-- category / career_events / career_awards at the end.
CREATE OR REPLACE VIEW public.player_leaderboard AS
SELECT
  p.id, p.full_name, p.known_as, p.sport_type, p.primary_position,
  p.nationality, p.region, p.country, p.photo_url,
  p.current_club_id, c.name AS current_club_name,
  p.career_apps, p.career_goals, p.career_assists,
  p.career_rating, p.career_mvp, p.follower_count, p.is_verified,
  CASE WHEN p.date_of_birth IS NOT NULL
       THEN date_part('year', age(p.date_of_birth))::int END AS age,
  p.user_id,
  p.category, p.headline, p.career_events, p.career_awards
FROM public.players p
LEFT JOIN public.clubs c ON c.id = p.current_club_id;

GRANT SELECT ON public.player_leaderboard TO anon, authenticated;

-- Param list changes → drop the old signature first.
DROP FUNCTION IF EXISTS public.search_top_players(text, text, text, text, int, int, int);

CREATE OR REPLACE FUNCTION public.search_top_players(
  p_category  TEXT    DEFAULT NULL,   -- any event category; NULL = all
  p_metric    TEXT    DEFAULT 'rating',-- events|rating|awards|followers|goals|assists|apps
  p_region    TEXT    DEFAULT NULL,
  p_position  TEXT    DEFAULT NULL,
  p_min_age   INT     DEFAULT NULL,
  p_max_age   INT     DEFAULT NULL,
  p_sport     TEXT    DEFAULT NULL,    -- optional finer sport filter
  p_limit     INT     DEFAULT 10
)
RETURNS SETOF public.player_leaderboard
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.player_leaderboard pl
  WHERE (p_category IS NULL OR pl.category = p_category)
    AND (p_sport    IS NULL OR pl.sport_type = p_sport)
    AND (p_region   IS NULL OR pl.region ILIKE '%' || p_region || '%')
    AND (p_position IS NULL OR pl.primary_position = p_position)
    AND (p_min_age  IS NULL OR pl.age >= p_min_age)
    AND (p_max_age  IS NULL OR pl.age <= p_max_age)
  ORDER BY
    CASE p_metric
      WHEN 'events'    THEN pl.career_events
      WHEN 'awards'    THEN pl.career_awards
      WHEN 'goals'     THEN pl.career_goals
      WHEN 'assists'   THEN pl.career_assists
      WHEN 'apps'      THEN pl.career_apps
      WHEN 'followers' THEN pl.follower_count
      ELSE 0 END DESC,
    CASE WHEN p_metric = 'rating' THEN pl.career_rating ELSE 0 END DESC,
    pl.career_rating DESC, pl.career_events DESC
  LIMIT GREATEST(1, LEAST(p_limit, 100));
END;
$$;
GRANT EXECUTE ON FUNCTION public.search_top_players(text, text, text, text, int, int, text, int) TO anon, authenticated;

