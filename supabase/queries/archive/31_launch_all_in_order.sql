-- ============================================================
--  THE GRUVS — 31: LAUNCH BUNDLE (run this ONE file, top to bottom)
--
--  A single, idempotent paste that stands up the entire talent +
--  tournament flow and (last) closes the pre-launch security leaks.
--  It is the verbatim content of, in run-order:
--      27_talent_platform.sql      (players, careers, scout engine)
--      28_talent_universal.sql     (every category, not just soccer)
--      30_tournament_governance.sql(role voting + fan predictions)
--      29_launch_security_rls.sql  (GPS + PII leak fixes) — PART D
--
--  SAFE TO RE-RUN: every table is IF NOT EXISTS, every column
--  ADD COLUMN IF NOT EXISTS, every policy DROP…IF EXISTS + CREATE,
--  every function CREATE OR REPLACE. Running it twice changes nothing.
--
--  REQUIRES (already live): profiles, events, clubs, sport_teams,
--  sport_athletes, sport_matches, sport_match_events.
--
--  PART D (security) tightens what the logged-out anon key can read
--  (stops GPS + PII leaks). That is the desired end state for launch.
--  If you are still testing against the anon key and want to defer it,
--  comment out PART D — the rest is independent of it.
-- ============================================================

-- ── PRE-FLIGHT GUARD ─────────────────────────────────────────
-- 27 and 28 both (re)create player_leaderboard, and 28 APPENDS columns.
-- If a prior partial run left the wider (28-shape) view in place, 27's
-- narrower CREATE OR REPLACE would throw 42P16 (cannot drop view columns).
-- Dropping it first (CASCADE also drops the search_top_players that depends
-- on it; both are recreated below) makes this bundle runnable from any state.
DROP VIEW IF EXISTS public.player_leaderboard CASCADE;


-- ============================================================
-- PART A — 27 TALENT PLATFORM
-- ============================================================
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


-- ============================================================
-- PART B — 28 UNIVERSAL TALENT
-- ============================================================
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
GRANT EXECUTE ON FUNCTION public.search_top_players TO anon, authenticated;


-- ============================================================
-- PART C — 30 TOURNAMENT GOVERNANCE + FAN PREDICTIONS
-- ============================================================
-- ============================================================
--  THE GRUVS — 30: TOURNAMENT GOVERNANCE + FAN PREDICTIONS
--
--  Two voting systems on top of the talent/competition schema (27/28):
--
--  A) GOVERNANCE — teams elect who controls a tournament's data.
--     High-stakes positions (results editor, log keeper, fixtures,
--     disciplinary, head organiser) are earned by VOTE: when ≥ N distinct
--     teams back a candidate, they are granted the role and may edit that
--     tournament's results / standings. Democratic + recallable (a new
--     candidate who passes the threshold replaces the holder).
--
--  B) PREDICTIONS — fans vote which team will win a competitive event.
--
--  Additive. Builds on competitions/seasons/clubs/sport_teams/events.
-- ============================================================

-- Per-competition vote threshold (how many teams must back a candidate).
ALTER TABLE public.competitions ADD COLUMN IF NOT EXISTS vote_threshold INTEGER NOT NULL DEFAULT 5;

-- Link an event to the competition/league it belongs to (drives governance +
-- which tournament a match's results/predictions roll up to).
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS competition_id UUID REFERENCES public.competitions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_events_competition ON public.events(competition_id);

-- ── A1. Who currently holds each elected position ─────────────
CREATE TABLE IF NOT EXISTS public.tournament_officials (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id    UUID        NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  role              TEXT        NOT NULL,   -- results_editor|log_keeper|fixtures_manager|disciplinary|head_organizer
  user_id           UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  votes_at_election INTEGER     DEFAULT 0,
  elected_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (competition_id, role)            -- one holder per role per competition
);
CREATE INDEX IF NOT EXISTS idx_officials_comp ON public.tournament_officials(competition_id);
CREATE INDEX IF NOT EXISTS idx_officials_user ON public.tournament_officials(user_id);

-- ── A2. Votes — one per TEAM per role ─────────────────────────
CREATE TABLE IF NOT EXISTS public.tournament_role_votes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id  UUID        NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL,
  candidate_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- voted FOR
  voter_user_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- who cast it
  voter_club_id   UUID        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,    -- the team they represent
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (competition_id, role, voter_club_id)   -- a team gets ONE vote per role (changeable)
);
CREATE INDEX IF NOT EXISTS idx_role_votes_tally ON public.tournament_role_votes(competition_id, role, candidate_id);

-- ── A3. cast_role_vote — record vote, tally distinct teams, grant on threshold ──
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
  -- The caller must own / captain the team they vote with.
  IF NOT EXISTS (
    SELECT 1 FROM public.clubs WHERE id = p_club AND owner_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.sport_teams WHERE event_id IS NOT NULL AND captain_user_id = auth.uid()
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

-- ── A4. Is the current user an elected official? (for gating edits) ──
CREATE OR REPLACE FUNCTION public.is_tournament_official(p_competition UUID, p_role TEXT)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournament_officials
    WHERE competition_id = p_competition AND role = p_role AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.competitions WHERE id = p_competition AND organizer_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_tournament_official TO authenticated;

-- ── B1. Fan win-predictions — one per user per event ──────────
CREATE TABLE IF NOT EXISTS public.match_predictions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  match_id         UUID        REFERENCES public.sport_matches(id) ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  predicted_side   TEXT,                         -- 'home' | 'away' | 'draw'
  predicted_team_id UUID       REFERENCES public.sport_teams(id) ON DELETE SET NULL,
  predicted_label  TEXT,                         -- denormalised team/option name for display
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (event_id, user_id)                     -- one prediction per user per event (changeable)
);
CREATE INDEX IF NOT EXISTS idx_predictions_event ON public.match_predictions(event_id);

-- ── B2. cast_match_prediction — upsert + return the live tally ──
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

-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.tournament_officials  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_role_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_predictions     ENABLE ROW LEVEL SECURITY;

-- Officials: public read (transparency). Writes only via cast_role_vote (definer) — no direct policy.
DROP POLICY IF EXISTS officials_read ON public.tournament_officials;
CREATE POLICY officials_read ON public.tournament_officials FOR SELECT USING (true);

-- Role votes: public read (open ballot for trust); a user manages only their own vote rows.
DROP POLICY IF EXISTS role_votes_read ON public.tournament_role_votes;
CREATE POLICY role_votes_read ON public.tournament_role_votes FOR SELECT USING (true);
DROP POLICY IF EXISTS role_votes_write ON public.tournament_role_votes;
CREATE POLICY role_votes_write ON public.tournament_role_votes FOR ALL TO authenticated
  USING (auth.uid() = voter_user_id) WITH CHECK (auth.uid() = voter_user_id);

-- Predictions: public read (for tallies); a user manages only their own prediction.
DROP POLICY IF EXISTS predictions_read ON public.match_predictions;
CREATE POLICY predictions_read ON public.match_predictions FOR SELECT USING (true);
DROP POLICY IF EXISTS predictions_write ON public.match_predictions;
CREATE POLICY predictions_write ON public.match_predictions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── (Apply to YOUR results tables) — gate edits to the elected results_editor ──
-- Example: only the elected results_editor / organiser / admin may write match events.
-- Adapt the competition link to how your events map to competitions.
--
-- CREATE POLICY "results editable by elected official"
--   ON public.sport_match_events FOR ALL TO authenticated
--   USING ( public.is_tournament_official(
--             (SELECT competition_id FROM public.events WHERE id = event_id), 'results_editor') )
--   WITH CHECK ( public.is_tournament_official(
--             (SELECT competition_id FROM public.events WHERE id = event_id), 'results_editor') );


-- ============================================================
-- PART D — 29 LAUNCH SECURITY (anon read hardening — the "before launch" piece)
-- ============================================================
-- ============================================================
--  THE GRUVS — 29: LAUNCH SECURITY (run before going live)
--
--  Closes the two anonymous read leaks found in the security audit:
--    1. live_checkins exposing real GPS to logged-out callers (CRITICAL)
--    2. profiles exposing PII columns (email/push_token/phone/…) to anon
--
--  Bulletproof + minimal: works regardless of existing RLS policy NAMES, and
--  touches reads only — logged-in users, writes, and the privacy-aware RPCs all
--  keep working. Run once in the Supabase SQL editor, then verify with:
--      node scripts/sec-probe.js
-- ============================================================

-- ── 1. CRITICAL — stop anonymous GPS harvesting from live_checkins ─────────
-- A table GRANT is checked BEFORE RLS policies. Revoking SELECT from `anon`
-- guarantees no policy (whatever its name) can leak GPS to a logged-out caller,
-- without us having to find/drop the offending policy. `authenticated` keeps
-- its grant (so "who was there" / presence still work), and get_safe_nearby_vibers
-- (SECURITY DEFINER) is unaffected.
REVOKE SELECT ON public.live_checkins FROM anon;

-- Defence in depth: ensure RLS is on so authenticated reads are still policy-gated.
ALTER TABLE public.live_checkins ENABLE ROW LEVEL SECURITY;

-- (Hardest option — also stop one authenticated user reading another's raw
--  coordinates; rely on get_safe_nearby_vibers for discovery. Uncomment to apply:)
-- REVOKE SELECT ON public.live_checkins FROM authenticated;
-- GRANT EXECUTE ON FUNCTION public.get_safe_nearby_vibers TO authenticated;


-- ── 2. Hide PII columns on profiles from anon ──────────────────────────────
-- RLS is row-level and cannot hide columns, so use column-level REVOKE. This
-- DO block revokes ONLY the PII columns that actually exist on your profiles
-- table, so it can never error on a column you don't have. Public discovery
-- (username/avatar/bio/…) keeps working; PII never reaches a logged-out caller.
DO $$
DECLARE col text;
BEGIN
  FOREACH col IN ARRAY ARRAY['email','push_token','phone','emergency_contacts','siblings','first_name','surname','id_number','date_of_birth']
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = col
    ) THEN
      EXECUTE format('REVOKE SELECT (%I) ON public.profiles FROM anon', col);
    END IF;
  END LOOP;
END $$;

-- (Recommended — also hide these from OTHER authenticated users. Each user still
--  reads their OWN row's PII via the profiles RLS own-row policy. Uncomment if
--  your app never needs another user's PII columns directly:)
-- DO $$
-- DECLARE col text;
-- BEGIN
--   FOREACH col IN ARRAY ARRAY['email','push_token','phone','emergency_contacts','siblings']
--   LOOP
--     IF EXISTS (SELECT 1 FROM information_schema.columns
--                WHERE table_schema='public' AND table_name='profiles' AND column_name=col) THEN
--       EXECUTE format('REVOKE SELECT (%I) ON public.profiles FROM authenticated', col);
--     END IF;
--   END LOOP;
-- END $$;


-- ── 3. (Optional) require login to read the social graph ───────────────────
-- follows is fully enumerable by anon today. Uncomment to require auth:
-- REVOKE SELECT ON public.follows FROM anon;


-- ── Verify ─────────────────────────────────────────────────────────────────
-- Run locally after applying:  node scripts/sec-probe.js
--   → live_checkins should show 🔒 (0 rows to anon)
--   → profiles PII columns should no longer be selectable by the anon key
