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
CREATE OR REPLACE VIEW public.player_leaderboard AS
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
GRANT EXECUTE ON FUNCTION public.search_top_players TO anon, authenticated;

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
