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
