-- ============================================================================
-- 04_backfill_match_card.sql
-- ----------------------------------------------------------------------------
-- Backfills events.match_card for matches that already existed before the
-- feature shipped: any event whose sport line-up is exactly two teams gets a
-- crest card built from those teams. New score updates keep it in step via
-- MatchManager.syncEventMatchCard; this is a one-time catch-up for old data.
--
-- Run AFTER 03_events_match_card.sql. Only touches rows where match_card is
-- still NULL, so it is safe to re-run.
-- ============================================================================

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