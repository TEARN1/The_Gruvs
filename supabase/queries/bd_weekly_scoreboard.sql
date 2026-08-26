-- ─────────────────────────────────────────────────────────────────────────────
-- BD WEEKLY SCOREBOARD — the Monday numbers for BD_PLAYBOOK.md §7.
--
-- The playbook says "pull real numbers" every Monday. This is that pull. Run it
-- as-is in the Supabase SQL editor; it returns one row per week.
--
-- Two things it deliberately does that a naive count does not:
--   1. EXCLUDES THE FOUNDER. During the pilot you personally drive check-ins at
--      the door, so an un-excluded count measures a promoter, not a product.
--   2. SPLITS founder-present from founder-absent nights (§39). The only number
--      that proves anything is Touch Downs on nights you were NOT there.
--
-- Read-only. No writes, no DDL — safe to run any time.
-- ─────────────────────────────────────────────────────────────────────────────

WITH params AS (
  SELECT
    -- ⟨YOU⟩ your own user id, so you don't count yourself.
    '00000000-0000-0000-0000-000000000000'::uuid AS founder_id,
    -- How far back to report.
    (now() - interval '12 weeks')              AS since
),

-- Real check-ins only: founder excluded, soft-deleted/cancelled events excluded.
checkins AS (
  SELECT
    lc.user_id,
    lc.event_id,
    lc.checked_in_at,
    date_trunc('week', lc.checked_in_at) AS wk,
    e.author_id                          AS host_id
  FROM live_checkins lc
  JOIN events e ON e.id = lc.event_id
  CROSS JOIN params p
  WHERE lc.checked_in_at >= p.since
    AND lc.user_id <> p.founder_id
    AND COALESCE(e.is_deleted, false)   = false
    AND COALESCE(e.is_cancelled, false) = false
),

-- A night counts as "founder present" if the founder also checked in at that event.
founder_nights AS (
  SELECT DISTINCT lc.event_id
  FROM live_checkins lc
  CROSS JOIN params p
  WHERE lc.user_id = p.founder_id
),

-- Did this person check in again in a LATER week? That's the retention signal
-- the playbook's table is missing (§9).
returners AS (
  SELECT c.wk, COUNT(DISTINCT c.user_id) AS returning_users
  FROM checkins c
  WHERE EXISTS (
    SELECT 1 FROM checkins c2
    WHERE c2.user_id = c.user_id
      AND c2.wk > c.wk
  )
  GROUP BY c.wk
)

SELECT
  to_char(c.wk, 'YYYY-MM-DD')                              AS week_starting,
  COUNT(DISTINCT c.host_id)                                AS hosts,
  COUNT(DISTINCT c.event_id)                               AS events,
  COUNT(DISTINCT c.user_id)                                AS attendees,
  COUNT(*)                                                 AS touch_downs,
  COUNT(*) FILTER (WHERE fn.event_id IS NULL)              AS touch_downs_without_you,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE fn.event_id IS NULL)
    / NULLIF(COUNT(*), 0)
  , 1)                                                     AS pct_organic,
  COALESCE(r.returning_users, 0)                           AS users_who_came_back,
  ROUND(
    100.0 * COALESCE(r.returning_users, 0)
    / NULLIF(COUNT(DISTINCT c.user_id), 0)
  , 1)                                                     AS pct_returned
FROM checkins c
LEFT JOIN founder_nights fn ON fn.event_id = c.event_id
LEFT JOIN returners r       ON r.wk = c.wk
GROUP BY c.wk, r.returning_users
ORDER BY c.wk DESC;
