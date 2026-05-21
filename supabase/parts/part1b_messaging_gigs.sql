CREATE POLICY "Hashtags readable" ON hashtags FOR SELECT USING (true);


-- ============================================================
--  NOTIFICATIONS
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='user_id')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='recipient_id') THEN
    ALTER TABLE notifications RENAME COLUMN user_id TO recipient_id;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='is_read')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='read') THEN
    ALTER TABLE notifications RENAME COLUMN is_read TO read;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS notifications (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  type         TEXT        NOT NULL,
  title        TEXT,
  body         TEXT,
  data         JSONB       DEFAULT '{}',
  event_id     UUID        REFERENCES events(id) ON DELETE CASCADE,
  echo_id      UUID        REFERENCES echoes(id) ON DELETE CASCADE,
  read         BOOLEAN     DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_id     UUID REFERENCES profiles(id) ON DELETE SET NULL;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type         TEXT;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title        TEXT;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body         TEXT;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data         JSONB DEFAULT '{}';
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_id     UUID REFERENCES events(id) ON DELETE CASCADE;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS echo_id      UUID REFERENCES echoes(id) ON DELETE CASCADE;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read         BOOLEAN DEFAULT false;
  END IF;
END $$;

DROP INDEX IF EXISTS notifications_user_id;
DROP INDEX IF EXISTS notifications_unread;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
    CREATE INDEX IF NOT EXISTS notifications_recipient_id ON notifications(recipient_id, created_at DESC);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
    CREATE INDEX IF NOT EXISTS notifications_unread       ON notifications(recipient_id) WHERE read = false;
  END IF;
END $$;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own notifications" ON notifications;
DROP POLICY IF EXISTS "System insert notifications"  ON notifications;
DROP POLICY IF EXISTS "Users mark own as read"       ON notifications;
CREATE POLICY "Users read own notifications" ON notifications FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY "System insert notifications"  ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users mark own as read"       ON notifications FOR UPDATE USING (auth.uid() = recipient_id);

CREATE OR REPLACE FUNCTION create_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_owner UUID;
BEGIN
  IF TG_TABLE_NAME = 'event_vibes' AND TG_OP = 'INSERT' THEN
    SELECT COALESCE(author_id, user_id) INTO v_owner FROM events WHERE id = new.event_id;
    IF v_owner IS DISTINCT FROM new.user_id THEN
      INSERT INTO notifications(recipient_id, actor_id, type, event_id)
      VALUES (v_owner, new.user_id, 'vibe', new.event_id) ON CONFLICT DO NOTHING;
    END IF;
  ELSIF TG_TABLE_NAME = 'echoes' AND TG_OP = 'INSERT' THEN
    SELECT COALESCE(author_id, user_id) INTO v_owner FROM events WHERE id = new.event_id;
    IF v_owner IS DISTINCT FROM new.user_id THEN
      INSERT INTO notifications(recipient_id, actor_id, type, event_id, echo_id, body)
      VALUES (v_owner, new.user_id, 'echo', new.event_id, new.id, left(new.body, 80));
    END IF;
  ELSIF TG_TABLE_NAME = 'follows' AND TG_OP = 'INSERT' THEN
    INSERT INTO notifications(recipient_id, actor_id, type)
    VALUES (new.following_id, new.follower_id, 'follow');
  END IF;
  RETURN null;
END;
$$;

DROP TRIGGER IF EXISTS event_vibes_notify ON event_vibes;
DROP TRIGGER IF EXISTS echoes_notify      ON echoes;
DROP TRIGGER IF EXISTS follows_notify     ON follows;
CREATE TRIGGER event_vibes_notify AFTER INSERT ON event_vibes  FOR EACH ROW EXECUTE FUNCTION create_notification();
CREATE TRIGGER echoes_notify      AFTER INSERT ON echoes       FOR EACH ROW EXECUTE FUNCTION create_notification();
CREATE TRIGGER follows_notify     AFTER INSERT ON follows      FOR EACH ROW EXECUTE FUNCTION create_notification();


-- ============================================================
--  MESSAGES  (primary messaging table — replaces direct_messages)
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body             TEXT        CHECK (body IS NULL OR length(body) <= 4000),
  message_type     TEXT        DEFAULT 'text',
  media_url        TEXT,
  parent_id        UUID        REFERENCES messages(id) ON DELETE SET NULL,
  event_id         UUID        REFERENCES events(id)   ON DELETE SET NULL,
  latitude         DOUBLE PRECISION,
  longitude        DOUBLE PRECISION,
  is_request       BOOLEAN     DEFAULT false,
  request_accepted BOOLEAN     DEFAULT false,
  reaction         TEXT,
  read_at          TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_id        UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS recipient_id     UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS body             TEXT;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type     TEXT DEFAULT 'text';
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url        TEXT;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS parent_id        UUID REFERENCES messages(id) ON DELETE SET NULL;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS event_id         UUID REFERENCES events(id)   ON DELETE SET NULL;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS latitude         DOUBLE PRECISION;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS longitude        DOUBLE PRECISION;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_request       BOOLEAN DEFAULT false;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS request_accepted BOOLEAN DEFAULT false;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at          TIMESTAMPTZ;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at     TIMESTAMPTZ;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS reaction         TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
    CREATE INDEX IF NOT EXISTS messages_sender      ON messages(sender_id,    created_at DESC);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
    CREATE INDEX IF NOT EXISTS messages_recipient   ON messages(recipient_id, created_at DESC);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
    CREATE INDEX IF NOT EXISTS messages_convo       ON messages(LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id), created_at DESC);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
    CREATE INDEX IF NOT EXISTS messages_unread      ON messages(recipient_id, read_at) WHERE read_at IS NULL AND deleted_at IS NULL;
  END IF;
END $$;

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Message participants can read"  ON messages;
DROP POLICY IF EXISTS "Users send own messages"        ON messages;
DROP POLICY IF EXISTS "Users update own messages"      ON messages;
CREATE POLICY "Message participants can read"  ON messages FOR SELECT
  USING ((auth.uid() = sender_id OR auth.uid() = recipient_id) AND deleted_at IS NULL);
CREATE POLICY "Users send own messages"        ON messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users update own messages"      ON messages FOR UPDATE
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Keep legacy direct_messages table working (alias)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='direct_messages') THEN
    -- Create a view alias
    EXECUTE 'CREATE OR REPLACE VIEW direct_messages AS SELECT id, sender_id, recipient_id, body, (read_at IS NOT NULL) AS read, created_at FROM messages';
  END IF;
END $$;

-- DM rooms for group/pair context tracking
CREATE TABLE IF NOT EXISTS dm_rooms (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participant_2  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message   TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count_1 INTEGER     DEFAULT 0,
  unread_count_2 INTEGER     DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'dm_rooms') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS dm_rooms_pair_uniq
      ON dm_rooms (LEAST(CAST(participant_1 AS text), CAST(participant_2 AS text)), GREATEST(CAST(participant_1 AS text), CAST(participant_2 AS text)));
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'dm_rooms') THEN
    ALTER TABLE dm_rooms ADD COLUMN IF NOT EXISTS participant_1    UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE dm_rooms ADD COLUMN IF NOT EXISTS participant_2    UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE dm_rooms ADD COLUMN IF NOT EXISTS last_message     TEXT;
    ALTER TABLE dm_rooms ADD COLUMN IF NOT EXISTS last_message_at  TIMESTAMPTZ;
    ALTER TABLE dm_rooms ADD COLUMN IF NOT EXISTS unread_count_1   INTEGER DEFAULT 0;
    ALTER TABLE dm_rooms ADD COLUMN IF NOT EXISTS unread_count_2   INTEGER DEFAULT 0;
    ALTER TABLE dm_rooms ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'dm_rooms') THEN
    CREATE INDEX IF NOT EXISTS dm_rooms_p1 ON dm_rooms(participant_1, last_message_at DESC);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'dm_rooms') THEN
    CREATE INDEX IF NOT EXISTS dm_rooms_p2 ON dm_rooms(participant_2, last_message_at DESC);
  END IF;
END $$;

ALTER TABLE dm_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "DM room participants can read"   ON dm_rooms;
DROP POLICY IF EXISTS "DM room participants can update" ON dm_rooms;
CREATE POLICY "DM room participants can read"   ON dm_rooms FOR SELECT
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);
CREATE POLICY "DM room participants can update" ON dm_rooms FOR ALL
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

DROP TRIGGER IF EXISTS dm_rooms_touch ON dm_rooms;
CREATE TRIGGER dm_rooms_touch BEFORE UPDATE ON dm_rooms
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Compat alias: conversations → dm_rooms
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='conversations') THEN
    DROP VIEW conversations CASCADE;
  END IF;
END $$;
CREATE OR REPLACE VIEW conversations
  WITH (security_invoker = true)
AS SELECT * FROM dm_rooms;


-- ============================================================
--  ROUTES  (Royal Routes)
-- ============================================================
CREATE TABLE IF NOT EXISTS routes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  description TEXT,
  steps       JSONB       DEFAULT '[]',
  color       TEXT        DEFAULT '#00f2ff',
  icon        TEXT,
  join_count  INTEGER     DEFAULT 0,
  vibe_score  INTEGER     DEFAULT 0,
  active      BOOLEAN     DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'routes') THEN
    ALTER TABLE routes ADD COLUMN IF NOT EXISTS user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE routes ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE routes ADD COLUMN IF NOT EXISTS steps       JSONB   DEFAULT '[]';
    ALTER TABLE routes ADD COLUMN IF NOT EXISTS color       TEXT    DEFAULT '#00f2ff';
    ALTER TABLE routes ADD COLUMN IF NOT EXISTS icon        TEXT;
    ALTER TABLE routes ADD COLUMN IF NOT EXISTS join_count  INTEGER DEFAULT 0;
    ALTER TABLE routes ADD COLUMN IF NOT EXISTS vibe_score  INTEGER DEFAULT 0;
    ALTER TABLE routes ADD COLUMN IF NOT EXISTS active      BOOLEAN DEFAULT true;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'routes') THEN
    CREATE INDEX IF NOT EXISTS routes_active  ON routes(active, join_count DESC);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'routes') THEN
    CREATE INDEX IF NOT EXISTS routes_user_id ON routes(user_id);
  END IF;
END $$;

ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Routes readable"         ON routes;
DROP POLICY IF EXISTS "Users manage own routes" ON routes;
CREATE POLICY "Routes readable"         ON routes FOR SELECT USING (true);
CREATE POLICY "Users manage own routes" ON routes FOR ALL    USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS route_joins (
  route_id   UUID        NOT NULL REFERENCES routes(id)   ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (route_id, user_id)
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'route_joins') THEN
    ALTER TABLE route_joins ADD COLUMN IF NOT EXISTS route_id UUID REFERENCES routes(id)   ON DELETE CASCADE;
    ALTER TABLE route_joins ADD COLUMN IF NOT EXISTS user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE route_joins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Route joins readable"         ON route_joins;
DROP POLICY IF EXISTS "Users manage own route joins" ON route_joins;
CREATE POLICY "Route joins readable"         ON route_joins FOR SELECT USING (true);
CREATE POLICY "Users manage own route joins" ON route_joins FOR ALL    USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS route_steps (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id   UUID        NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  event_id   UUID        REFERENCES events(id) ON DELETE SET NULL,
  position   INTEGER     NOT NULL DEFAULT 0,
  title      TEXT,
  lat        FLOAT,
  lon        FLOAT,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'route_steps') THEN
    ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS route_id UUID REFERENCES routes(id) ON DELETE CASCADE;
    ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;
    ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;
    ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS title    TEXT;
    ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS lat      FLOAT;
    ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS lon      FLOAT;
    ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS notes    TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'route_steps') THEN
    CREATE INDEX IF NOT EXISTS route_steps_route ON route_steps(route_id, position);
  END IF;
END $$;

ALTER TABLE route_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Route steps readable" ON route_steps;
CREATE POLICY "Route steps readable" ON route_steps FOR SELECT USING (true);


-- ============================================================
--  DIGITAL FOOTPRINT  (paths, traces, stars, crossings)
-- ============================================================
CREATE TABLE IF NOT EXISTS paths (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT,
  description TEXT,
  color       TEXT        DEFAULT '#00f2ff',
  is_public   BOOLEAN     DEFAULT true,
  star_count  INTEGER     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'paths') THEN
    ALTER TABLE paths ADD COLUMN IF NOT EXISTS user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE paths ADD COLUMN IF NOT EXISTS title       TEXT;
    ALTER TABLE paths ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE paths ADD COLUMN IF NOT EXISTS color       TEXT    DEFAULT '#00f2ff';
    ALTER TABLE paths ADD COLUMN IF NOT EXISTS is_public   BOOLEAN DEFAULT true;
    ALTER TABLE paths ADD COLUMN IF NOT EXISTS star_count  INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'paths') THEN
    CREATE INDEX IF NOT EXISTS paths_user ON paths(user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'paths') THEN
    CREATE INDEX IF NOT EXISTS paths_public ON paths(is_public, created_at DESC) WHERE is_public = true;
  END IF;
END $$;

ALTER TABLE paths ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public paths readable" ON paths;
DROP POLICY IF EXISTS "Users manage own paths" ON paths;
CREATE POLICY "Public paths readable"  ON paths FOR SELECT USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "Users manage own paths" ON paths FOR ALL    USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS path_traces (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id    UUID        NOT NULL REFERENCES paths(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lat        FLOAT       NOT NULL,
  lon        FLOAT       NOT NULL,
  event_id   UUID        REFERENCES events(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'path_traces') THEN
    ALTER TABLE path_traces ADD COLUMN IF NOT EXISTS path_id    UUID REFERENCES paths(id)    ON DELETE CASCADE;
    ALTER TABLE path_traces ADD COLUMN IF NOT EXISTS user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE path_traces ADD COLUMN IF NOT EXISTS lat        FLOAT;
    ALTER TABLE path_traces ADD COLUMN IF NOT EXISTS lon        FLOAT;
    ALTER TABLE path_traces ADD COLUMN IF NOT EXISTS event_id   UUID REFERENCES events(id)   ON DELETE SET NULL;
    ALTER TABLE path_traces ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'path_traces') THEN
    CREATE INDEX IF NOT EXISTS path_traces_path ON path_traces(path_id, recorded_at);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'path_traces') THEN
    CREATE INDEX IF NOT EXISTS path_traces_user ON path_traces(user_id);
  END IF;
END $$;

ALTER TABLE path_traces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Path traces readable" ON path_traces;
DROP POLICY IF EXISTS "Users manage own traces" ON path_traces;
CREATE POLICY "Path traces readable"    ON path_traces FOR SELECT USING (true);
CREATE POLICY "Users manage own traces" ON path_traces FOR ALL    USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS path_stars (
  path_id    UUID        NOT NULL REFERENCES paths(id)    ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (path_id, user_id)
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'path_stars') THEN
    ALTER TABLE path_stars ADD COLUMN IF NOT EXISTS path_id UUID REFERENCES paths(id)    ON DELETE CASCADE;
    ALTER TABLE path_stars ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE path_stars ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Path stars readable"         ON path_stars;
DROP POLICY IF EXISTS "Users manage own path stars" ON path_stars;
CREATE POLICY "Path stars readable"         ON path_stars FOR SELECT USING (true);
CREATE POLICY "Users manage own path stars" ON path_stars FOR ALL    USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION sync_path_stars()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN UPDATE paths SET star_count = star_count + 1            WHERE id = new.path_id;
  ELSIF TG_OP = 'DELETE' THEN UPDATE paths SET star_count = greatest(0, star_count-1) WHERE id = old.path_id;
  END IF;
  RETURN null;
END;
$$;
DROP TRIGGER IF EXISTS path_stars_sync ON path_stars;
CREATE TRIGGER path_stars_sync AFTER INSERT OR DELETE ON path_stars
  FOR EACH ROW EXECUTE FUNCTION sync_path_stars();

CREATE TABLE IF NOT EXISTS path_crossings (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id_a  UUID        NOT NULL REFERENCES paths(id) ON DELETE CASCADE,
  path_id_b  UUID        NOT NULL REFERENCES paths(id) ON DELETE CASCADE,
  lat        FLOAT,
  lon        FLOAT,
  crossed_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'path_crossings') THEN
    ALTER TABLE path_crossings ADD COLUMN IF NOT EXISTS path_id_a UUID REFERENCES paths(id) ON DELETE CASCADE;
    ALTER TABLE path_crossings ADD COLUMN IF NOT EXISTS path_id_b UUID REFERENCES paths(id) ON DELETE CASCADE;
    ALTER TABLE path_crossings ADD COLUMN IF NOT EXISTS lat       FLOAT;
    ALTER TABLE path_crossings ADD COLUMN IF NOT EXISTS lon       FLOAT;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'path_crossings') THEN
    CREATE INDEX IF NOT EXISTS path_crossings_a ON path_crossings(path_id_a);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'path_crossings') THEN
    CREATE INDEX IF NOT EXISTS path_crossings_b ON path_crossings(path_id_b);
  END IF;
END $$;

ALTER TABLE path_crossings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Path crossings readable" ON path_crossings;
CREATE POLICY "Path crossings readable" ON path_crossings FOR SELECT USING (true);

-- user_paths: which paths a user has joined/bookmarked
CREATE TABLE IF NOT EXISTS user_paths (
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  path_id    UUID        NOT NULL REFERENCES paths(id)    ON DELETE CASCADE,
  role       TEXT        DEFAULT 'follower',
  joined_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, path_id)
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_paths') THEN
    ALTER TABLE user_paths ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE user_paths ADD COLUMN IF NOT EXISTS path_id UUID REFERENCES paths(id)    ON DELETE CASCADE;
    ALTER TABLE user_paths ADD COLUMN IF NOT EXISTS role    TEXT DEFAULT 'follower';
  END IF;
END $$;

ALTER TABLE user_paths ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User paths readable"         ON user_paths;
DROP POLICY IF EXISTS "Users manage own user paths" ON user_paths;
CREATE POLICY "User paths readable"         ON user_paths FOR SELECT USING (true);
CREATE POLICY "Users manage own user paths" ON user_paths FOR ALL    USING (auth.uid() = user_id);


-- ============================================================
--  SERVICE MARKETPLACE
-- ============================================================
CREATE TABLE IF NOT EXISTS service_nodes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  category     TEXT,
  service_type TEXT,
  description  TEXT,
  price        NUMERIC,
  price_min    NUMERIC,
  price_max    NUMERIC,
  price_unit   TEXT        DEFAULT 'trip',
  tab          TEXT        DEFAULT 'Moving Help',
  location     TEXT,
  coords       geography(Point, 4326),
  rating       FLOAT       DEFAULT 0,
  review_count INTEGER     DEFAULT 0,
  available    BOOLEAN     DEFAULT true,
  media        JSONB,
  created_at   TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'service_nodes') THEN
    ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS name         TEXT;
    ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS category     TEXT;
    ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS service_type TEXT;
    ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS description  TEXT;
    ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS price        NUMERIC;
    ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS price_min    NUMERIC;
    ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS price_max    NUMERIC;
    ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS price_unit   TEXT DEFAULT 'trip';
    ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS tab          TEXT DEFAULT 'Moving Help';
    ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS location     TEXT;
    ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS coords       geography(Point, 4326);
    ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS rating       FLOAT DEFAULT 0;
    ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;
    ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS available    BOOLEAN DEFAULT true;
    ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS media        JSONB;
  END IF;
END $$;

ALTER TABLE service_nodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Services readable"         ON service_nodes;
DROP POLICY IF EXISTS "Users manage own services" ON service_nodes;
CREATE POLICY "Services readable"         ON service_nodes FOR SELECT USING (true);
CREATE POLICY "Users manage own services" ON service_nodes FOR ALL    USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS service_bookings (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id           UUID        REFERENCES service_nodes(id) ON DELETE SET NULL,
  client_id            UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider_id          UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id             UUID        REFERENCES events(id) ON DELETE SET NULL,
  status               TEXT        DEFAULT 'pending' CHECK (status IN ('pending','confirmed','in_progress','escrow_held','completed','cancelled','disputed')),
  service_type         TEXT,
  cargo_type           TEXT,
  origin_address       TEXT,
  destination_address  TEXT,
  amount_cents         INTEGER     DEFAULT 0,
  price                NUMERIC,
  notes                TEXT,
  scheduled_at         TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'service_bookings') THEN
    ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS service_id          UUID REFERENCES service_nodes(id) ON DELETE SET NULL;
    ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS client_id           UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS provider_id         UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS event_id            UUID REFERENCES events(id) ON DELETE SET NULL;
    ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS status              TEXT DEFAULT 'pending';
    ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS service_type        TEXT;
    ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS cargo_type          TEXT;
    ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS origin_address      TEXT;
    ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS destination_address TEXT;
    ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS amount_cents        INTEGER DEFAULT 0;
    ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS price               NUMERIC;
    ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS notes               TEXT;
    ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS scheduled_at        TIMESTAMPTZ;
    ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS completed_at        TIMESTAMPTZ;
    ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'service_bookings') THEN
    CREATE INDEX IF NOT EXISTS service_bookings_client   ON service_bookings(client_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'service_bookings') THEN
    CREATE INDEX IF NOT EXISTS service_bookings_provider ON service_bookings(provider_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'service_bookings') THEN
    CREATE INDEX IF NOT EXISTS service_bookings_status   ON service_bookings(status);
  END IF;
END $$;

ALTER TABLE service_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Booking participants can see" ON service_bookings;
DROP POLICY IF EXISTS "Client can book"              ON service_bookings;
DROP POLICY IF EXISTS "Participants update booking"  ON service_bookings;
CREATE POLICY "Booking participants can see" ON service_bookings FOR SELECT
  USING (auth.uid() = client_id OR auth.uid() = provider_id);
CREATE POLICY "Client can book"              ON service_bookings FOR INSERT
  WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Participants update booking"  ON service_bookings FOR UPDATE
  USING (auth.uid() = client_id OR auth.uid() = provider_id);

DROP TRIGGER IF EXISTS service_bookings_touch ON service_bookings;
CREATE TRIGGER service_bookings_touch BEFORE UPDATE ON service_bookings
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();


-- ============================================================
--  GIG POSTS + ACCEPTANCES
-- ============================================================
CREATE TABLE IF NOT EXISTS gig_posts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  title          TEXT        NOT NULL,
  description    TEXT,
  pay            NUMERIC,
  pay_rands      NUMERIC,
  category       TEXT        DEFAULT 'moving',
  tab            TEXT        DEFAULT 'Moving Help',
  time_window    TEXT        DEFAULT 'Flexible',
  poster_username TEXT,
  distance_km    FLOAT,
  location       TEXT,
  event_id       UUID        REFERENCES events(id) ON DELETE SET NULL,
  slots          INTEGER     DEFAULT 1,
  filled         INTEGER     DEFAULT 0,
  active         BOOLEAN     DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gig_posts') THEN
    ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS description     TEXT;
    ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS pay             NUMERIC;
    ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS pay_rands       NUMERIC;
    ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS category        TEXT DEFAULT 'moving';
    ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS tab             TEXT DEFAULT 'Moving Help';
    ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS time_window     TEXT DEFAULT 'Flexible';
    ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS poster_username TEXT;
    ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS distance_km     FLOAT;
    ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS location        TEXT;
    ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS event_id        UUID REFERENCES events(id) ON DELETE SET NULL;
    ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS slots           INTEGER DEFAULT 1;
    ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS filled          INTEGER DEFAULT 0;
    ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS active          BOOLEAN DEFAULT true;
  END IF;
END $$;

ALTER TABLE gig_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gigs readable"         ON gig_posts;
DROP POLICY IF EXISTS "Users manage own gigs" ON gig_posts;
CREATE POLICY "Gigs readable"         ON gig_posts FOR SELECT USING (true);
CREATE POLICY "Users manage own gigs" ON gig_posts FOR ALL    USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS gig_acceptances (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id     UUID        NOT NULL REFERENCES gig_posts(id) ON DELETE CASCADE,
  worker_id  UUID        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  status     TEXT        DEFAULT 'applied' CHECK (status IN ('applied','accepted','rejected','completed')),
  message    TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (gig_id, worker_id)
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gig_acceptances') THEN
    ALTER TABLE gig_acceptances ADD COLUMN IF NOT EXISTS gig_id    UUID REFERENCES gig_posts(id) ON DELETE CASCADE;
    ALTER TABLE gig_acceptances ADD COLUMN IF NOT EXISTS worker_id UUID REFERENCES profiles(id)  ON DELETE CASCADE;
    ALTER TABLE gig_acceptances ADD COLUMN IF NOT EXISTS status    TEXT DEFAULT 'applied';
    ALTER TABLE gig_acceptances ADD COLUMN IF NOT EXISTS message   TEXT;
    ALTER TABLE gig_acceptances ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gig_acceptances') THEN
    CREATE INDEX IF NOT EXISTS gig_acceptances_gig    ON gig_acceptances(gig_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gig_acceptances') THEN
    CREATE INDEX IF NOT EXISTS gig_acceptances_worker ON gig_acceptances(worker_id);
  END IF;
END $$;

ALTER TABLE gig_acceptances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gig acceptances visible to poster and worker" ON gig_acceptances;
DROP POLICY IF EXISTS "Workers can apply"                            ON gig_acceptances;
DROP POLICY IF EXISTS "Poster can update acceptance"                 ON gig_acceptances;
CREATE POLICY "Gig acceptances visible to poster and worker" ON gig_acceptances FOR SELECT
  USING (auth.uid() = worker_id OR EXISTS (SELECT 1 FROM gig_posts g WHERE g.id = gig_id AND g.user_id = auth.uid()));
CREATE POLICY "Workers can apply"         ON gig_acceptances FOR INSERT WITH CHECK (auth.uid() = worker_id);
CREATE POLICY "Poster can update acceptance" ON gig_acceptances FOR UPDATE
  USING (auth.uid() = worker_id OR EXISTS (SELECT 1 FROM gig_posts g WHERE g.id = gig_id AND g.user_id = auth.uid()));


-- ============================================================
--  REFERRALS
-- ============================================================
CREATE TABLE IF NOT EXISTS referrals (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code        TEXT        UNIQUE,
  status      TEXT        DEFAULT 'pending',
  reward      NUMERIC     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (referrer_id, referred_id)
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'referrals') THEN
    ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referrer_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referred_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE referrals ADD COLUMN IF NOT EXISTS code        TEXT;
    ALTER TABLE referrals ADD COLUMN IF NOT EXISTS status      TEXT    DEFAULT 'pending';
    ALTER TABLE referrals ADD COLUMN IF NOT EXISTS reward      NUMERIC DEFAULT 0;
  END IF;
END $$;

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Referrals readable by owner" ON referrals;
CREATE POLICY "Referrals readable by owner" ON referrals FOR ALL
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);


-- ============================================================
--  REPORTS + DISPUTES
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type TEXT        NOT NULL CHECK (target_type IN ('event','profile','echo','message')),
  target_id   UUID        NOT NULL,
  reason      TEXT        NOT NULL,
  details     TEXT,
  status      TEXT        DEFAULT 'pending' CHECK (status IN ('pending','reviewed','resolved','dismissed')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reports') THEN
    ALTER TABLE reports ADD COLUMN IF NOT EXISTS reporter_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE reports ADD COLUMN IF NOT EXISTS target_type TEXT;
    ALTER TABLE reports ADD COLUMN IF NOT EXISTS target_id   UUID;
    ALTER TABLE reports ADD COLUMN IF NOT EXISTS reason      TEXT;
    ALTER TABLE reports ADD COLUMN IF NOT EXISTS details     TEXT;
    ALTER TABLE reports ADD COLUMN IF NOT EXISTS status      TEXT DEFAULT 'pending';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reports') THEN
    CREATE INDEX IF NOT EXISTS reports_reporter ON reports(reporter_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reports') THEN
    CREATE INDEX IF NOT EXISTS reports_status   ON reports(status);
  END IF;
END $$;

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users insert own reports" ON reports;
DROP POLICY IF EXISTS "Users see own reports"    ON reports;
CREATE POLICY "Users insert own reports" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users see own reports"    ON reports FOR SELECT USING (auth.uid() = reporter_id);

CREATE TABLE IF NOT EXISTS disputes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID        REFERENCES service_bookings(id) ON DELETE CASCADE,
  raised_by    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason       TEXT        NOT NULL,
  status       TEXT        DEFAULT 'open' CHECK (status IN ('open','resolved','closed')),
  resolution   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'disputes') THEN
    ALTER TABLE disputes ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES service_bookings(id) ON DELETE CASCADE;
    ALTER TABLE disputes ADD COLUMN IF NOT EXISTS raised_by  UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE disputes ADD COLUMN IF NOT EXISTS reason     TEXT;
    ALTER TABLE disputes ADD COLUMN IF NOT EXISTS status     TEXT DEFAULT 'open';
    ALTER TABLE disputes ADD COLUMN IF NOT EXISTS resolution TEXT;
  END IF;
END $$;

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Dispute parties can see" ON disputes;
CREATE POLICY "Dispute parties can see" ON disputes FOR ALL USING (auth.uid() = raised_by);


-- ============================================================
--  BUSINESS PROFILES + TEAM
-- ============================================================
CREATE TABLE IF NOT EXISTS business_profiles (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  business_name  TEXT        NOT NULL,
  business_type  TEXT,
  tagline        TEXT,
  description    TEXT,
  logo_url       TEXT,
  cover_url      TEXT,
  primary_color  TEXT        DEFAULT '#00f2ff',
  accent_color   TEXT        DEFAULT '#8b5cf6',
  verified       BOOLEAN     DEFAULT false,
  tier           TEXT        DEFAULT 'starter',
  store_enabled  BOOLEAN     DEFAULT false,
  store_slug     TEXT        UNIQUE,
  store_config   JSONB       DEFAULT '{}',
  website        TEXT,
  phone          TEXT,
  email          TEXT,
  location       TEXT,
  total_revenue  NUMERIC     DEFAULT 0,
  follower_count INTEGER     DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'business_profiles') THEN
    ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS user_id        UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS business_name  TEXT;
    ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS business_type  TEXT;
    ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS tagline        TEXT;
    ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS description    TEXT;
    ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS logo_url       TEXT;
    ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS cover_url      TEXT;
    ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS primary_color  TEXT DEFAULT '#00f2ff';
    ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS accent_color   TEXT DEFAULT '#8b5cf6';
    ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS verified       BOOLEAN DEFAULT false;
    ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS tier           TEXT DEFAULT 'starter';
    ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS store_enabled  BOOLEAN DEFAULT false;
    ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS store_slug     TEXT;
    ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS store_config   JSONB DEFAULT '{}';
    ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS website        TEXT;
    ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS phone          TEXT;
    ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS email          TEXT;
    ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS location       TEXT;
    ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS total_revenue  NUMERIC DEFAULT 0;
    ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0;
    ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "business_profiles_owner"       ON business_profiles;
DROP POLICY IF EXISTS "business_profiles_public_read" ON business_profiles;
CREATE POLICY "business_profiles_owner"       ON business_profiles FOR ALL    USING (user_id = auth.uid());
CREATE POLICY "business_profiles_public_read" ON business_profiles FOR SELECT USING (true);

DROP TRIGGER IF EXISTS business_profiles_touch ON business_profiles;
CREATE TRIGGER business_profiles_touch BEFORE UPDATE ON business_profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Business team members (role hierarchy)
CREATE TABLE IF NOT EXISTS business_team_members (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID        NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL DEFAULT 'staff'
    CHECK (role IN ('owner','ceo','manager','sales_manager','staff')),
  permissions JSONB       DEFAULT '{}',
  invited_by  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  accepted    BOOLEAN     DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, user_id)
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'business_team_members') THEN
    ALTER TABLE business_team_members ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE;
    ALTER TABLE business_team_members ADD COLUMN IF NOT EXISTS user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE business_team_members ADD COLUMN IF NOT EXISTS role        TEXT DEFAULT 'staff';
    ALTER TABLE business_team_members ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';
    ALTER TABLE business_team_members ADD COLUMN IF NOT EXISTS invited_by  UUID REFERENCES profiles(id) ON DELETE SET NULL;
    ALTER TABLE business_team_members ADD COLUMN IF NOT EXISTS accepted    BOOLEAN DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'business_team_members') THEN
    CREATE INDEX IF NOT EXISTS biz_team_business ON business_team_members(business_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'business_team_members') THEN
    CREATE INDEX IF NOT EXISTS biz_team_user     ON business_team_members(user_id);
  END IF;
END $$;

ALTER TABLE business_team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Team readable by members"     ON business_team_members;
DROP POLICY IF EXISTS "Owner manages team"           ON business_team_members;
CREATE POLICY "Team readable by members" ON business_team_members FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM business_profiles bp WHERE bp.id = business_id AND bp.user_id = auth.uid()
  ));
CREATE POLICY "Owner manages team" ON business_team_members FOR ALL
  USING (EXISTS (
    SELECT 1 FROM business_profiles bp WHERE bp.id = business_id AND bp.user_id = auth.uid()
  ));

-- Business partnerships
CREATE TABLE IF NOT EXISTS business_partnerships (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID        NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  partner_id   UUID        NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  status       TEXT        DEFAULT 'pending' CHECK (status IN ('pending','active','declined','ended')),
  terms        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'business_partnerships') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS business_partnerships_pair_uniq
      ON business_partnerships (LEAST(CAST(requester_id AS text), CAST(partner_id AS text)), GREATEST(CAST(requester_id AS text), CAST(partner_id AS text)));
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'business_partnerships') THEN
    ALTER TABLE business_partnerships ADD COLUMN IF NOT EXISTS requester_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE;
    ALTER TABLE business_partnerships ADD COLUMN IF NOT EXISTS partner_id   UUID REFERENCES business_profiles(id) ON DELETE CASCADE;
    ALTER TABLE business_partnerships ADD COLUMN IF NOT EXISTS status       TEXT DEFAULT 'pending';
    ALTER TABLE business_partnerships ADD COLUMN IF NOT EXISTS terms        TEXT;
  END IF;
END $$;

ALTER TABLE business_partnerships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Partnership parties can read" ON business_partnerships;
CREATE POLICY "Partnership parties can read" ON business_partnerships FOR SELECT USING (true);


-- ============================================================
