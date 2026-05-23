-- ============================================================
--  THE GRUVS — Advanced Features Patch
--  Co-Management, Live Chat, Activity Fanout, Polls, Playlist
--  Run in Supabase SQL Editor — fully idempotent
-- ============================================================

-- ══════════════════════════════════════════════════════════════
--  PATCH 001: Event Roles (Co-Host, Moderator, Scanner, VIP Manager)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS event_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('co_host','moderator','scanner','vip_manager')),
  granted_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_roles_event ON event_roles(event_id);
CREATE INDEX IF NOT EXISTS idx_event_roles_user  ON event_roles(user_id);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='event_roles') THEN
    ALTER TABLE event_roles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "event_roles_select" ON event_roles;
    DROP POLICY IF EXISTS "event_roles_insert" ON event_roles;
    DROP POLICY IF EXISTS "event_roles_delete" ON event_roles;
    CREATE POLICY "event_roles_select" ON event_roles FOR SELECT USING (true);
    CREATE POLICY "event_roles_insert" ON event_roles FOR INSERT
      WITH CHECK (
        EXISTS (SELECT 1 FROM events WHERE id = event_id AND author_id = auth.uid())
        OR EXISTS (SELECT 1 FROM event_roles er2 WHERE er2.event_id = event_roles.event_id AND er2.user_id = auth.uid() AND er2.role = 'co_host')
      );
    CREATE POLICY "event_roles_delete" ON event_roles FOR DELETE
      USING (
        granted_by = auth.uid()
        OR EXISTS (SELECT 1 FROM events WHERE id = event_id AND author_id = auth.uid())
      );
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════
--  PATCH 002: Event Polls + Votes
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS event_polls (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL REFERENCES profiles(id),
  question    TEXT NOT NULL,
  options     JSONB NOT NULL DEFAULT '[]',
  closes_at   TIMESTAMPTZ,
  is_multiple BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_polls_event ON event_polls(event_id, created_at DESC);

CREATE TABLE IF NOT EXISTS event_poll_votes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id    UUID NOT NULL REFERENCES event_polls(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  option_ids JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON event_poll_votes(poll_id);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='event_polls') THEN
    ALTER TABLE event_polls ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "polls_select" ON event_polls;
    DROP POLICY IF EXISTS "polls_insert" ON event_polls;
    DROP POLICY IF EXISTS "polls_delete" ON event_polls;
    CREATE POLICY "polls_select" ON event_polls FOR SELECT USING (true);
    CREATE POLICY "polls_insert" ON event_polls FOR INSERT
      WITH CHECK (
        EXISTS (SELECT 1 FROM events WHERE id = event_id AND author_id = auth.uid())
        OR EXISTS (SELECT 1 FROM event_roles WHERE event_id = event_polls.event_id AND user_id = auth.uid() AND role IN ('co_host'))
      );
    CREATE POLICY "polls_delete" ON event_polls FOR DELETE
      USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM events WHERE id = event_id AND author_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='event_poll_votes') THEN
    ALTER TABLE event_poll_votes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "poll_votes_select" ON event_poll_votes;
    DROP POLICY IF EXISTS "poll_votes_insert" ON event_poll_votes;
    CREATE POLICY "poll_votes_select" ON event_poll_votes FOR SELECT USING (true);
    CREATE POLICY "poll_votes_insert" ON event_poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Atomic vote RPC
CREATE OR REPLACE FUNCTION cast_poll_vote(
  p_poll_id  UUID,
  p_user_id  UUID,
  p_option_ids JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result JSONB;
BEGIN
  INSERT INTO event_poll_votes(poll_id, user_id, option_ids)
  VALUES (p_poll_id, p_user_id, p_option_ids)
  ON CONFLICT (poll_id, user_id) DO UPDATE SET option_ids = p_option_ids;

  -- Recount all votes for each option from scratch (avoid race drift)
  UPDATE event_polls
  SET options = (
    SELECT jsonb_agg(
      opt || jsonb_build_object('votes',
        (SELECT COUNT(*) FROM event_poll_votes epv
         WHERE epv.poll_id = p_poll_id
           AND epv.option_ids @> jsonb_build_array(opt->>'id'))
      )
    )
    FROM jsonb_array_elements(options) AS opt
  )
  WHERE id = p_poll_id
  RETURNING options INTO v_result;

  RETURN v_result;
END;
$$;

-- ══════════════════════════════════════════════════════════════
--  PATCH 003: Live Event Chat Room
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS event_chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message    TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500),
  reply_to   UUID REFERENCES event_chat_messages(id) ON DELETE SET NULL,
  pinned     BOOLEAN NOT NULL DEFAULT false,
  pinned_by  UUID REFERENCES profiles(id),
  deleted    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_event_time ON event_chat_messages(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_pinned     ON event_chat_messages(event_id, pinned) WHERE pinned = true;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='event_chat_messages') THEN
    ALTER TABLE event_chat_messages ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "chat_select" ON event_chat_messages;
    DROP POLICY IF EXISTS "chat_insert" ON event_chat_messages;
    DROP POLICY IF EXISTS "chat_update" ON event_chat_messages;
    CREATE POLICY "chat_select" ON event_chat_messages FOR SELECT USING (true);
    CREATE POLICY "chat_insert" ON event_chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "chat_update" ON event_chat_messages FOR UPDATE
      USING (
        auth.uid() = user_id
        OR EXISTS (SELECT 1 FROM events WHERE id = event_id AND author_id = auth.uid())
        OR EXISTS (SELECT 1 FROM event_roles WHERE event_id = event_chat_messages.event_id
                   AND user_id = auth.uid() AND role IN ('co_host','moderator'))
      );
  END IF;
END $$;

-- Enable realtime for chat
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='event_chat_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE event_chat_messages;
  END IF;
END $$;

-- Chat rate-limit RPC (server-side enforcement)
CREATE OR REPLACE FUNCTION can_send_chat(p_user_id UUID, p_event_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COUNT(*) < 5
  FROM event_chat_messages
  WHERE user_id = p_user_id
    AND event_id = p_event_id
    AND created_at > now() - interval '5 seconds'
    AND deleted = false;
$$;

-- ══════════════════════════════════════════════════════════════
--  PATCH 004: Activity Feed Fanout Table + Triggers
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS activity_feed (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action_type    TEXT NOT NULL,
  target_id      UUID,
  target_type    TEXT,
  target_title   TEXT,
  actor_username TEXT,
  actor_avatar   TEXT,
  read           BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_recipient ON activity_feed(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_unread    ON activity_feed(recipient_id, read) WHERE read = false;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='activity_feed') THEN
    ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "activity_select" ON activity_feed;
    DROP POLICY IF EXISTS "activity_insert" ON activity_feed;
    DROP POLICY IF EXISTS "activity_update" ON activity_feed;
    CREATE POLICY "activity_select" ON activity_feed FOR SELECT USING (auth.uid() = recipient_id);
    CREATE POLICY "activity_insert" ON activity_feed FOR INSERT WITH CHECK (true);
    CREATE POLICY "activity_update" ON activity_feed FOR UPDATE USING (auth.uid() = recipient_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='activity_feed') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE activity_feed;
  END IF;
END $$;

-- Fanout function
CREATE OR REPLACE FUNCTION fanout_activity_to_followers(
  p_actor_id    UUID,
  p_action_type TEXT,
  p_target_id   UUID,
  p_target_type TEXT,
  p_target_title TEXT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_username TEXT;
  v_avatar   TEXT;
BEGIN
  SELECT username, avatar_url INTO v_username, v_avatar
  FROM profiles WHERE id = p_actor_id;

  INSERT INTO activity_feed (recipient_id, actor_id, action_type, target_id, target_type, target_title, actor_username, actor_avatar)
  SELECT
    f.follower_id,
    p_actor_id,
    p_action_type,
    p_target_id,
    p_target_type,
    p_target_title,
    v_username,
    v_avatar
  FROM follows f
  WHERE f.following_id = p_actor_id
    AND f.follower_id != p_actor_id
  ON CONFLICT DO NOTHING;
END;
$$;

-- RSVP fanout trigger
CREATE OR REPLACE FUNCTION trg_fanout_rsvp_fn() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_title TEXT;
BEGIN
  IF NEW.status = 'going' THEN
    SELECT title INTO v_title FROM events WHERE id = NEW.event_id;
    PERFORM fanout_activity_to_followers(NEW.user_id, 'rsvp_going', NEW.event_id, 'event', v_title);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_fanout_rsvp ON event_rsvps;
CREATE TRIGGER trg_fanout_rsvp
  AFTER INSERT OR UPDATE ON event_rsvps
  FOR EACH ROW EXECUTE FUNCTION trg_fanout_rsvp_fn();

-- Vibe fanout trigger
CREATE OR REPLACE FUNCTION trg_fanout_vibe_fn() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_title TEXT;
BEGIN
  SELECT title INTO v_title FROM events WHERE id = NEW.event_id;
  PERFORM fanout_activity_to_followers(NEW.user_id, 'vibe_sent', NEW.event_id, 'event', v_title);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_fanout_vibe ON event_vibes;
CREATE TRIGGER trg_fanout_vibe
  AFTER INSERT ON event_vibes
  FOR EACH ROW EXECUTE FUNCTION trg_fanout_vibe_fn();

-- New event fanout trigger
CREATE OR REPLACE FUNCTION trg_fanout_event_fn() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM fanout_activity_to_followers(NEW.author_id, 'new_event', NEW.id, 'event', NEW.title);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_fanout_event ON events;
CREATE TRIGGER trg_fanout_event
  AFTER INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION trg_fanout_event_fn();

-- Co-host invite: insert into activity_feed directly (called from app via RPC)
CREATE OR REPLACE FUNCTION notify_cohost_invite(
  p_event_id    UUID,
  p_invitee_id  UUID,
  p_inviter_id  UUID,
  p_event_title TEXT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_username TEXT; v_avatar TEXT;
BEGIN
  SELECT username, avatar_url INTO v_username, v_avatar FROM profiles WHERE id = p_inviter_id;
  INSERT INTO activity_feed (recipient_id, actor_id, action_type, target_id, target_type, target_title, actor_username, actor_avatar)
  VALUES (p_invitee_id, p_inviter_id, 'co_host_invite', p_event_id, 'event', p_event_title, v_username, v_avatar);
END;
$$;

-- Mark all read RPC
CREATE OR REPLACE FUNCTION mark_activity_read(p_user_id UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE activity_feed SET read = true WHERE recipient_id = p_user_id AND read = false;
$$;

-- ══════════════════════════════════════════════════════════════
--  PATCH 005: Carpool Enhancements
-- ══════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='event_carpools') THEN
    ALTER TABLE event_carpools
      ADD COLUMN IF NOT EXISTS departure_time  TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS return_trip     BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS pickup_lat      FLOAT,
      ADD COLUMN IF NOT EXISTS pickup_lng      FLOAT,
      ADD COLUMN IF NOT EXISTS status         TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open','full','departed','cancelled'));
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='event_carpool_requests') THEN
    ALTER TABLE event_carpool_requests
      ADD COLUMN IF NOT EXISTS status  TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','accepted','declined')),
      ADD COLUMN IF NOT EXISTS message TEXT;
  END IF;
END $$;

-- Enable realtime for carpools
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='event_carpools') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE event_carpools;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='event_carpool_requests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE event_carpool_requests;
  END IF;
END $$;

-- Accept carpool request atomically
CREATE OR REPLACE FUNCTION accept_carpool_request(
  p_request_id UUID,
  p_driver_id  UUID
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_carpool_id   UUID;
  v_seats_avail  INT;
  v_seats_taken  INT;
BEGIN
  SELECT carpool_id INTO v_carpool_id
  FROM event_carpool_requests WHERE id = p_request_id;

  SELECT seats_available INTO v_seats_avail
  FROM event_carpools WHERE id = v_carpool_id AND driver_id = p_driver_id;

  IF NOT FOUND THEN RETURN false; END IF;

  SELECT COUNT(*) INTO v_seats_taken
  FROM event_carpool_requests
  WHERE carpool_id = v_carpool_id AND status = 'accepted';

  IF v_seats_taken >= v_seats_avail THEN RETURN false; END IF;

  UPDATE event_carpool_requests SET status = 'accepted' WHERE id = p_request_id;

  -- Check if now full
  SELECT COUNT(*) INTO v_seats_taken
  FROM event_carpool_requests
  WHERE carpool_id = v_carpool_id AND status = 'accepted';

  IF v_seats_taken >= v_seats_avail THEN
    UPDATE event_carpools SET status = 'full' WHERE id = v_carpool_id;
  END IF;

  RETURN true;
END;
$$;

-- Decline carpool request
CREATE OR REPLACE FUNCTION decline_carpool_request(
  p_request_id UUID,
  p_driver_id  UUID
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE event_carpool_requests SET status = 'declined'
  WHERE id = p_request_id
    AND carpool_id IN (SELECT id FROM event_carpools WHERE driver_id = p_driver_id);
  RETURN FOUND;
END;
$$;

-- ══════════════════════════════════════════════════════════════
--  PATCH 006: Event Playlist + Track Voting
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS event_playlists (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_by   UUID NOT NULL REFERENCES profiles(id),
  name         TEXT NOT NULL DEFAULT 'Event Playlist',
  spotify_url  TEXT,
  youtube_url  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id)
);

CREATE TABLE IF NOT EXISTS event_playlist_tracks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES event_playlists(id) ON DELETE CASCADE,
  added_by    UUID NOT NULL REFERENCES profiles(id),
  track_id    TEXT NOT NULL,
  platform    TEXT NOT NULL CHECK (platform IN ('spotify','youtube')),
  title       TEXT NOT NULL,
  artist      TEXT,
  thumbnail   TEXT,
  duration_ms INT,
  votes       INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (playlist_id, track_id, platform)
);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_votes ON event_playlist_tracks(playlist_id, votes DESC);

CREATE TABLE IF NOT EXISTS event_track_votes (
  track_id UUID NOT NULL REFERENCES event_playlist_tracks(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (track_id, user_id)
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='event_playlists') THEN
    ALTER TABLE event_playlists ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "playlists_select" ON event_playlists;
    DROP POLICY IF EXISTS "playlists_insert" ON event_playlists;
    DROP POLICY IF EXISTS "playlists_update" ON event_playlists;
    CREATE POLICY "playlists_select" ON event_playlists FOR SELECT USING (true);
    CREATE POLICY "playlists_insert" ON event_playlists FOR INSERT WITH CHECK (auth.uid() = created_by);
    CREATE POLICY "playlists_update" ON event_playlists FOR UPDATE
      USING (auth.uid() = created_by OR EXISTS (SELECT 1 FROM events WHERE id = event_id AND author_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='event_playlist_tracks') THEN
    ALTER TABLE event_playlist_tracks ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "tracks_select" ON event_playlist_tracks;
    DROP POLICY IF EXISTS "tracks_insert" ON event_playlist_tracks;
    CREATE POLICY "tracks_select" ON event_playlist_tracks FOR SELECT USING (true);
    CREATE POLICY "tracks_insert" ON event_playlist_tracks FOR INSERT WITH CHECK (auth.uid() = added_by);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='event_playlist_tracks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE event_playlist_tracks;
  END IF;
END $$;

-- Atomic track vote (upvote only, one per user per track)
CREATE OR REPLACE FUNCTION vote_track(p_track_id UUID, p_user_id UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_new_votes INT;
BEGIN
  INSERT INTO event_track_votes(track_id, user_id) VALUES (p_track_id, p_user_id)
  ON CONFLICT DO NOTHING;

  IF FOUND THEN
    UPDATE event_playlist_tracks SET votes = votes + 1 WHERE id = p_track_id
    RETURNING votes INTO v_new_votes;
  ELSE
    SELECT votes INTO v_new_votes FROM event_playlist_tracks WHERE id = p_track_id;
  END IF;

  RETURN v_new_votes;
END;
$$;

-- Unvote track
CREATE OR REPLACE FUNCTION unvote_track(p_track_id UUID, p_user_id UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_new_votes INT;
BEGIN
  DELETE FROM event_track_votes WHERE track_id = p_track_id AND user_id = p_user_id;
  IF FOUND THEN
    UPDATE event_playlist_tracks SET votes = GREATEST(0, votes - 1) WHERE id = p_track_id
    RETURNING votes INTO v_new_votes;
  ELSE
    SELECT votes INTO v_new_votes FROM event_playlist_tracks WHERE id = p_track_id;
  END IF;
  RETURN v_new_votes;
END;
$$;

-- Get or create playlist for an event
CREATE OR REPLACE FUNCTION get_or_create_playlist(p_event_id UUID, p_user_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id UUID;
BEGIN
  SELECT id INTO v_id FROM event_playlists WHERE event_id = p_event_id;
  IF NOT FOUND THEN
    INSERT INTO event_playlists(event_id, created_by)
    VALUES (p_event_id, p_user_id)
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;

-- ══════════════════════════════════════════════════════════════
--  PATCH 007: Enable realtime for polls
-- ══════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='event_polls') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE event_polls;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='event_roles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE event_roles;
  END IF;
END $$;

-- ✅ Advanced features patch complete
