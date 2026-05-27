-- ─────────────────────────────────────────────────────────────────────────────
-- SCALE PATCH — indexes, RLS optimisations, partitioning hints
-- Run in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Safe to re-run (uses IF NOT EXISTS / CREATE INDEX CONCURRENTLY)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── SCHEMA FIXES (columns found missing during stress test) ─────────────────
ALTER TABLE event_polls ADD COLUMN IF NOT EXISTS allow_multi_choice BOOLEAN DEFAULT false;
ALTER TABLE event_polls ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;

-- ── HOT-PATH INDEXES ─────────────────────────────────────────────────────────

-- Events feed (LandingPage, ExplorePage)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_city_date
  ON events (city, event_date DESC)
  WHERE is_published = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_author_published
  ON events (author_id, is_published, event_date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_category_city
  ON events (category, city, event_date DESC)
  WHERE is_published = true;

-- Follows graph (feed, getFollowedIds)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_follower
  ON follows (follower_id, following_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_following
  ON follows (following_id);

-- Vibes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_vibes_event
  ON event_vibes (event_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_vibes_user_event
  ON event_vibes (user_id, event_id);

-- RSVPs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_rsvps_event_status
  ON event_rsvps (event_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_rsvps_user
  ON event_rsvps (user_id, event_id);

-- Live check-ins
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_live_checkins_event
  ON live_checkins (event_id, checked_in_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_live_checkins_user
  ON live_checkins (user_id, checked_in_at DESC);

-- Messages (DM inbox)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_conversation
  ON messages (sender_id, recipient_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_recipient_unread
  ON messages (recipient_id, read_at)
  WHERE deleted_at IS NULL;

-- Notifications
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, is_read, created_at DESC);

-- Profiles (auth hot path)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_email
  ON profiles (email)
  WHERE email IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_username
  ON profiles (username);

-- Echoes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_echoes_event
  ON echoes (event_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_echoes_user
  ON echoes (user_id, created_at DESC);

-- Saved events
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_saved_events_user
  ON saved_events (user_id, event_id);

-- Poll votes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_poll_votes_poll_user
  ON event_poll_votes (poll_id, user_id);

-- Service bookings
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_service_bookings_provider_status
  ON service_bookings (provider_id, status, created_at DESC);

-- Reels
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reels_published
  ON reels (is_published, created_at DESC)
  WHERE is_published = true;

-- Event moments
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_moments_event
  ON event_moments (event_id, created_at DESC)
  WHERE expires_at > NOW();

-- Leaderboard (vibe_score)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_vibe_score
  ON profiles (vibe_score DESC)
  WHERE vibe_score > 0;

-- Activity feed queries (CrewFeedScreen)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_rsvps_user_created
  ON event_rsvps (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_vibes_user_created
  ON event_vibes (user_id, created_at DESC);

-- ── RLS PERFORMANCE: use auth.uid() inline to avoid per-row function calls ───
-- Note: Supabase auto-wraps auth.uid() calls efficiently, but these policies
-- ensure we're using the simplest possible check without sub-selects.

-- Verify RLS is enabled on hot tables (idempotent)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_vibes ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_checkins ENABLE ROW LEVEL SECURITY;

-- ── STATISTICS TARGETS for query planner accuracy ────────────────────────────
-- Raise statistics for high-cardinality columns the planner guesses wrong on
ALTER TABLE events ALTER COLUMN city SET STATISTICS 500;
ALTER TABLE events ALTER COLUMN category SET STATISTICS 500;
ALTER TABLE events ALTER COLUMN event_date SET STATISTICS 500;
ALTER TABLE event_vibes ALTER COLUMN event_id SET STATISTICS 500;
ALTER TABLE event_rsvps ALTER COLUMN event_id SET STATISTICS 500;
ALTER TABLE follows ALTER COLUMN follower_id SET STATISTICS 500;
ALTER TABLE messages ALTER COLUMN recipient_id SET STATISTICS 500;

-- ── AUTOVACUUM TUNING for write-heavy tables ──────────────────────────────────
ALTER TABLE event_vibes SET (
  autovacuum_vacuum_scale_factor = 0.01,
  autovacuum_analyze_scale_factor = 0.005
);

ALTER TABLE live_checkins SET (
  autovacuum_vacuum_scale_factor = 0.01,
  autovacuum_analyze_scale_factor = 0.005
);

ALTER TABLE messages SET (
  autovacuum_vacuum_scale_factor = 0.01,
  autovacuum_analyze_scale_factor = 0.005
);

ALTER TABLE notifications SET (
  autovacuum_vacuum_scale_factor = 0.01,
  autovacuum_analyze_scale_factor = 0.005
);

ALTER TABLE events SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.01
);

-- ── PARTIAL INDEXES to skip dead rows in common queries ──────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_upcoming
  ON events (event_date, city)
  WHERE is_published = true AND event_date > NOW();

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unseen
  ON notifications (user_id, created_at DESC)
  WHERE is_read = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_active
  ON messages (recipient_id, created_at DESC)
  WHERE deleted_at IS NULL AND read_at IS NULL;

-- ── MATERIALIZED VIEW: leaderboard snapshot (refresh every 15 min via pg_cron) ──
CREATE MATERIALIZED VIEW IF NOT EXISTS leaderboard_snapshot AS
SELECT
  p.id,
  p.username,
  p.avatar_url,
  p.vibe_score,
  p.current_streak,
  p.city,
  COALESCE(ev.event_count, 0)   AS event_count,
  COALESCE(vi.vibe_count, 0)    AS vibe_count,
  COALESCE(ch.checkin_count, 0) AS checkin_count,
  RANK() OVER (ORDER BY p.vibe_score DESC) AS rank
FROM profiles p
LEFT JOIN (
  SELECT author_id, COUNT(*) AS event_count FROM events WHERE is_published = true GROUP BY author_id
) ev ON ev.author_id = p.id
LEFT JOIN (
  SELECT user_id, COUNT(*) AS vibe_count FROM event_vibes GROUP BY user_id
) vi ON vi.user_id = p.id
LEFT JOIN (
  SELECT user_id, COUNT(*) AS checkin_count FROM live_checkins GROUP BY user_id
) ch ON ch.user_id = p.id
WHERE p.vibe_score > 0
ORDER BY p.vibe_score DESC
LIMIT 1000;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_snapshot_id ON leaderboard_snapshot (id);

-- Refresh the materialized view (run this manually or via pg_cron)
-- SELECT cron.schedule('leaderboard-refresh', '*/15 * * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_snapshot');

-- ── FUNCTION: fast unread notification count (bypasses RLS scan) ─────────────
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::BIGINT
  FROM notifications
  WHERE user_id = p_user_id AND is_read = false;
$$;

-- ── FUNCTION: event engagement summary (replaces 6 separate count queries) ───
CREATE OR REPLACE FUNCTION get_event_engagement(p_event_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'vibes',     (SELECT COUNT(*) FROM event_vibes    WHERE event_id = p_event_id),
    'going',     (SELECT COUNT(*) FROM event_rsvps    WHERE event_id = p_event_id AND status = 'going'),
    'maybe',     (SELECT COUNT(*) FROM event_rsvps    WHERE event_id = p_event_id AND status = 'maybe'),
    'not_going', (SELECT COUNT(*) FROM event_rsvps    WHERE event_id = p_event_id AND status = 'not_going'),
    'checkins',  (SELECT COUNT(*) FROM live_checkins  WHERE event_id = p_event_id),
    'echoes',    (SELECT COUNT(*) FROM echoes          WHERE event_id = p_event_id)
  );
$$;

-- ── CONNECTION POOLER HINT ────────────────────────────────────────────────────
-- Enable pgBouncer in Transaction mode via Supabase Dashboard:
--   Settings > Database > Connection Pooling → Mode: Transaction, Pool size: 15
-- This multiplexes thousands of app connections over ~15 actual PG connections.

-- ── ANALYZE to update planner stats immediately ───────────────────────────────
ANALYZE events;
ANALYZE event_vibes;
ANALYZE event_rsvps;
ANALYZE follows;
ANALYZE messages;
ANALYZE notifications;
ANALYZE profiles;
ANALYZE live_checkins;
ANALYZE echoes;
