-- ============================================================================
-- 04_backfill_match_card.sql
-- ----------------------------------------------------------------------------
-- Catches up events.match_card for matches that pre-date the feature.
--   Pass 1: any event whose sport line-up is exactly two teams gets a crest
--           card (no score) — these are matches without a fixture row yet.
--   Pass 2: any event with a single sport_matches fixture gets the full card,
--           mapping the score to the fixture's actual home/away team (by id,
--           so scores never end up swapped) plus status, kickoff and penalties.
--
-- Run AFTER 03_events_match_card.sql. Re-runnable: pass 1 only fills NULLs,
-- pass 2 overwrites single-fixture events with the authoritative card (the app
-- keeps it in step afterwards via MatchManager.syncEventMatchCard).
-- ============================================================================

-- Pass 1 — crest-only for two-team events that don't have a fixture yet.
WITH t AS (
  SELECT
    event_id,
    count(*) AS n,
    (array_agg(
       jsonb_build_object('id', id, 'name', name, 'logo_url', logo_url, 'color', color1)
       ORDER BY position NULLS LAST, name))[1] AS home,
    (array_agg(
       jsonb_build_object('id', id, 'name', name, 'logo_url', logo_url, 'color', color1)
       ORDER BY position NULLS LAST, name))[2] AS away
  FROM public.sport_teams
  GROUP BY event_id
)
UPDATE public.events e
SET match_card = jsonb_build_object('home', t.home, 'away', t.away)
FROM t
WHERE t.event_id = e.id
  AND t.n = 2
  AND e.match_card IS NULL;

-- Pass 2 — full card (crest + status + score) for single-fixture events.
WITH single AS (
  SELECT sm.event_id, sm.home_team_id, sm.away_team_id, sm.home_score, sm.away_score,
         sm.home_score_pens, sm.away_score_pens, sm.status, sm.scheduled_at
  FROM public.sport_matches sm
  WHERE (SELECT count(*) FROM public.sport_matches x WHERE x.event_id = sm.event_id) = 1
),
crest AS (
  SELECT id, jsonb_build_object('id', id, 'name', name, 'logo_url', logo_url, 'color', color1) AS j
  FROM public.sport_teams
)
UPDATE public.events e
SET match_card =
      jsonb_build_object('home', h.j, 'away', a.j,
                         'status', s.status, 'scheduled_at', s.scheduled_at)
   || CASE WHEN s.status IN ('live', 'completed', 'half_time')
           THEN jsonb_build_object('home_score', coalesce(s.home_score, 0),
                                   'away_score', coalesce(s.away_score, 0))
           ELSE '{}'::jsonb END
   || CASE WHEN s.home_score_pens IS NOT NULL AND s.away_score_pens IS NOT NULL
           THEN jsonb_build_object('home_score_pens', s.home_score_pens,
                                   'away_score_pens', s.away_score_pens)
           ELSE '{}'::jsonb END
FROM single s
JOIN crest h ON h.id = s.home_team_id
JOIN crest a ON a.id = s.away_team_id
WHERE e.id = s.event_id;