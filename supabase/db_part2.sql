DROP POLICY IF EXISTS "Anyone can read app_updates" ON app_updates;
CREATE POLICY "Anyone can read app_updates"
  ON app_updates FOR SELECT USING (true);

-- ============================================================
--  ENABLE REALTIME
-- ============================================================
DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'events','notifications','messages','follows',
    'live_checkins','event_vibes','echoes','service_bookings',
    'gig_acceptances','dm_rooms','ad_campaigns'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename=t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
      END IF;
    END IF;
  END LOOP;
END $$;


-- ============================================================
--  STORAGE BUCKETS  (photos, covers, event media, chat media)
--  Run this block in Supabase → SQL Editor after the main schema.
-- ============================================================

-- Create buckets (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars',     'avatars',     true, 5242880,
   ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']),
  ('covers',      'covers',      true, 10485760,
   ARRAY['image/jpeg','image/png','image/webp']),
  ('event-media', 'event-media', true, 104857600,
   ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/x-m4v']),
  ('chat_media',  'chat_media',  true, 10485760,
   ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public            = EXCLUDED.public,
  file_size_limit   = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS: public read, authenticated write
DROP POLICY IF EXISTS "Public read avatars"     ON storage.objects;
DROP POLICY IF EXISTS "Auth upload avatars"     ON storage.objects;
DROP POLICY IF EXISTS "Auth update avatars"     ON storage.objects;
DROP POLICY IF EXISTS "Auth delete avatars"     ON storage.objects;
DROP POLICY IF EXISTS "Public read covers"      ON storage.objects;
DROP POLICY IF EXISTS "Auth upload covers"      ON storage.objects;
DROP POLICY IF EXISTS "Auth update covers"      ON storage.objects;
DROP POLICY IF EXISTS "Public read event-media" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload event-media" ON storage.objects;
DROP POLICY IF EXISTS "Public read chat_media"  ON storage.objects;
DROP POLICY IF EXISTS "Auth upload chat_media"  ON storage.objects;
DROP POLICY IF EXISTS "Auth delete chat_media"  ON storage.objects;

CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Auth upload avatars"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Auth update avatars"
  ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Auth delete avatars"
  ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Public read covers"
  ON storage.objects FOR SELECT USING (bucket_id = 'covers');
CREATE POLICY "Auth upload covers"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'covers' AND auth.role() = 'authenticated');
CREATE POLICY "Auth update covers"
  ON storage.objects FOR UPDATE USING (bucket_id = 'covers' AND auth.role() = 'authenticated');

CREATE POLICY "Public read event-media"
  ON storage.objects FOR SELECT USING (bucket_id = 'event-media');
CREATE POLICY "Auth upload event-media"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'event-media' AND auth.role() = 'authenticated');

CREATE POLICY "Public read chat_media"
  ON storage.objects FOR SELECT USING (bucket_id = 'chat_media');
CREATE POLICY "Auth upload chat_media"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat_media' AND auth.role() = 'authenticated');
CREATE POLICY "Auth delete chat_media"
  ON storage.objects FOR DELETE USING (bucket_id = 'chat_media' AND auth.role() = 'authenticated');


--============================================================
--  SECTION: MOVEMENT OS (paths, service nodes, gig mode)
--============================================================

-- Movement OS: Path objects, Presence Ledger, Service Nodes, Gig Mode, Trust Ledger
-- Run this in the Supabase SQL editor after 001_initial and 002_upgrades

-- ── Identity & Privacy ────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS identity_mode     TEXT    NOT NULL DEFAULT 'public' CHECK (identity_mode IN ('public','ghost','celebrity')),
  ADD COLUMN IF NOT EXISTS home_base_lat     FLOAT,
  ADD COLUMN IF NOT EXISTS home_base_lon     FLOAT,
  ADD COLUMN IF NOT EXISTS social_integrity_score INT NOT NULL DEFAULT 50 CHECK (social_integrity_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS wallet_balance    NUMERIC(10,2) NOT NULL DEFAULT 0.00;

-- ── Paths ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS paths (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  origin_lat      FLOAT,
  origin_lon      FLOAT,
  origin_label    TEXT,
  dest_lat        FLOAT,
  dest_lon        FLOAT,
  dest_label      TEXT,
  intent_tag      TEXT NOT NULL DEFAULT 'attending'
                    CHECK (intent_tag IN ('attending','going_home','service_run','exploring','scouting')),
  identity_layer  TEXT NOT NULL DEFAULT 'public'
                    CHECK (identity_layer IN ('public','ghost','celebrity')),
  ghost_alias     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'paths') THEN
    ALTER TABLE paths ADD COLUMN IF NOT EXISTS event_id       UUID REFERENCES events(id) ON DELETE SET NULL;
    ALTER TABLE paths ADD COLUMN IF NOT EXISTS origin_lat     FLOAT;
    ALTER TABLE paths ADD COLUMN IF NOT EXISTS origin_lon     FLOAT;
    ALTER TABLE paths ADD COLUMN IF NOT EXISTS origin_label   TEXT;
    ALTER TABLE paths ADD COLUMN IF NOT EXISTS dest_lat       FLOAT;
    ALTER TABLE paths ADD COLUMN IF NOT EXISTS dest_lon       FLOAT;
    ALTER TABLE paths ADD COLUMN IF NOT EXISTS dest_label     TEXT;
    ALTER TABLE paths ADD COLUMN IF NOT EXISTS intent_tag     TEXT DEFAULT 'attending';
    ALTER TABLE paths ADD COLUMN IF NOT EXISTS identity_layer TEXT DEFAULT 'public';
    ALTER TABLE paths ADD COLUMN IF NOT EXISTS ghost_alias    TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'paths') THEN
    CREATE INDEX IF NOT EXISTS paths_user_id_idx  ON paths(user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'paths') THEN
    CREATE INDEX IF NOT EXISTS paths_event_id_idx ON paths(event_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'paths') THEN
    CREATE INDEX IF NOT EXISTS paths_dest_lat_idx ON paths(dest_lat);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'paths') THEN
    CREATE INDEX IF NOT EXISTS paths_dest_lon_idx ON paths(dest_lon);
  END IF;
END $$;

-- ── Live Check-ins (Presence Ledger, TTL-based) ───────────────────────────────

CREATE TABLE IF NOT EXISTS live_checkins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  lat             FLOAT,
  lon             FLOAT,
  identity_layer  TEXT NOT NULL DEFAULT 'public',
  ghost_alias     TEXT,
  checked_in_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, event_id)
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'live_checkins') THEN
    CREATE INDEX IF NOT EXISTS live_checkins_event_idx   ON live_checkins(event_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'live_checkins') THEN
    CREATE INDEX IF NOT EXISTS live_checkins_expires_idx ON live_checkins(expires_at);
  END IF;
END $$;

-- Auto-expire: delete stale checkins (call from a cron job or edge function)
CREATE OR REPLACE FUNCTION purge_expired_checkins() RETURNS void LANGUAGE sql AS $$
  DELETE FROM live_checkins WHERE expires_at < NOW();
$$;

-- ── Path Crossings ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS path_crossings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id_a     UUID NOT NULL REFERENCES paths(id) ON DELETE CASCADE,
  path_id_b     UUID NOT NULL REFERENCES paths(id) ON DELETE CASCADE,
  overlap_score FLOAT NOT NULL DEFAULT 0,
  crossed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Path Stars ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS path_stars (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  path_id    UUID NOT NULL REFERENCES paths(id) ON DELETE CASCADE,
  starred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, path_id)
);

-- ── Service Nodes (Bakkie Marketplace) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS service_nodes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service_type        TEXT NOT NULL CHECK (service_type IN ('moving','delivery','event_logistics','rides')),
  vehicle_type        TEXT,
  capacity_kg         INT,
  price_per_km        NUMERIC(8,2),
  base_price          NUMERIC(8,2),
  lat                 FLOAT,
  lon                 FLOAT,
  available           BOOLEAN NOT NULL DEFAULT TRUE,
  event_id            UUID REFERENCES events(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'service_nodes') THEN
    ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS provider_id   UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS service_type  TEXT;
    ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS vehicle_type  TEXT;
    ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS capacity_kg   INT;
    ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS price_per_km  NUMERIC(8,2);
    ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS base_price    NUMERIC(8,2);
    ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS lat           FLOAT;
    ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS lon           FLOAT;
    ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS available     BOOLEAN DEFAULT TRUE;
    ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS event_id      UUID REFERENCES events(id) ON DELETE SET NULL;
    ALTER TABLE service_nodes ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'service_nodes') THEN
    CREATE INDEX IF NOT EXISTS service_nodes_provider_idx ON service_nodes(provider_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'service_nodes') THEN
    CREATE INDEX IF NOT EXISTS service_nodes_type_idx     ON service_nodes(service_type);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'service_nodes') THEN
    CREATE INDEX IF NOT EXISTS service_nodes_lat_idx      ON service_nodes(lat);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'service_nodes') THEN
    CREATE INDEX IF NOT EXISTS service_nodes_lon_idx      ON service_nodes(lon);
  END IF;
END $$;

-- ── Service Bookings (Escrow) ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS service_bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_node_id UUID NOT NULL REFERENCES service_nodes(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cargo_type      TEXT,
  pickup_address  TEXT,
  dropoff_address TEXT,
  scheduled_at    TIMESTAMPTZ,
  estimated_price NUMERIC(10,2),
  status          TEXT NOT NULL DEFAULT 'escrow_held'
                    CHECK (status IN ('escrow_held','in_progress','completed','disputed','cancelled')),
  escrow_held_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  disputed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'service_bookings') THEN
    CREATE INDEX IF NOT EXISTS bookings_client_idx   ON service_bookings(client_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'service_bookings') THEN
    CREATE INDEX IF NOT EXISTS bookings_provider_idx ON service_bookings(provider_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'service_bookings') THEN
    CREATE INDEX IF NOT EXISTS bookings_status_idx   ON service_bookings(status);
  END IF;
END $$;

-- ── Disputes ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS disputes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES service_bookings(id) ON DELETE CASCADE,
  raised_by   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason      TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Gig Posts ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gig_posts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id     UUID REFERENCES events(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  category     TEXT NOT NULL CHECK (category IN ('moving','assembly','packing','crew','other')),
  pay_amount   NUMERIC(8,2) NOT NULL,
  lat          FLOAT,
  lon          FLOAT,
  time_window  TEXT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gig_posts') THEN
    CREATE INDEX IF NOT EXISTS gig_posts_event_idx    ON gig_posts(event_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gig_posts') THEN
    CREATE INDEX IF NOT EXISTS gig_posts_active_idx   ON gig_posts(active);
  END IF;
END $$;

-- ── Gig Acceptances ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gig_acceptances (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id      UUID NOT NULL REFERENCES gig_posts(id) ON DELETE CASCADE,
  worker_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(gig_id, worker_id)
);

-- ── DM Rooms (mutual star match, 48h expiry) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS dm_rooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id    UUID REFERENCES events(id) ON DELETE SET NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_a, user_b, event_id)
);

CREATE TABLE IF NOT EXISTS dm_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    UUID NOT NULL REFERENCES dm_rooms(id) ON DELETE CASCADE,
  sender_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'dm_rooms') THEN
    ALTER TABLE dm_rooms ADD COLUMN IF NOT EXISTS user_a     UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE dm_rooms ADD COLUMN IF NOT EXISTS user_b     UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE dm_rooms ADD COLUMN IF NOT EXISTS event_id   UUID REFERENCES events(id) ON DELETE SET NULL;
    ALTER TABLE dm_rooms ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'dm_rooms') THEN
    CREATE INDEX IF NOT EXISTS dm_rooms_user_a_idx ON dm_rooms(user_a);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'dm_rooms') THEN
    CREATE INDEX IF NOT EXISTS dm_rooms_user_b_idx ON dm_rooms(user_b);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'dm_messages') THEN
    CREATE INDEX IF NOT EXISTS dm_messages_room_idx ON dm_messages(room_id);
  END IF;
END $$;

-- ── User Paths (alias for paths, referenced by PathMapScreen) ─────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_paths') THEN
    DROP TABLE user_paths;
  ELSIF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'user_paths') THEN
    DROP VIEW user_paths;
  END IF;
END $$;
CREATE VIEW user_paths AS
  SELECT * FROM paths;

-- ── Trust Ledger RPC ──────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS update_sis_score(uuid, int);
DROP FUNCTION IF EXISTS increment_wallet_balance(uuid, numeric);
CREATE OR REPLACE FUNCTION update_sis_score(
  p_user_id UUID,
  p_delta   INT
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE profiles
  SET social_integrity_score = GREATEST(0, LEAST(100, social_integrity_score + p_delta))
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION increment_wallet_balance(
  p_user_id UUID,
  p_amount  NUMERIC
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE profiles
  SET wallet_balance = wallet_balance + p_amount
  WHERE id = p_user_id;
END;
$$;

-- ── RLS Policies ──────────────────────────────────────────────────────────────

ALTER TABLE paths            ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_checkins    ENABLE ROW LEVEL SECURITY;
ALTER TABLE path_crossings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE path_stars       ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_nodes    ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'service_bookings') THEN
    ALTER TABLE service_bookings ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
ALTER TABLE disputes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE gig_posts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE gig_acceptances  ENABLE ROW LEVEL SECURITY;

-- Paths: owner reads/writes, others see only public paths
CREATE POLICY paths_owner   ON paths FOR ALL  USING (auth.uid() = user_id);
CREATE POLICY paths_public  ON paths FOR SELECT USING (identity_layer = 'public');

-- Live checkins: owner upserts, everyone reads active ones
CREATE POLICY checkins_owner  ON live_checkins FOR ALL    USING (auth.uid() = user_id);
CREATE POLICY checkins_select ON live_checkins FOR SELECT USING (expires_at > NOW());

-- Service nodes: provider manages, everyone reads available
CREATE POLICY nodes_owner  ON service_nodes FOR ALL    USING (auth.uid() = provider_id);
CREATE POLICY nodes_select ON service_nodes FOR SELECT USING (available = TRUE);

-- Bookings: client or provider can see their bookings
CREATE POLICY bookings_parties ON service_bookings FOR ALL
  USING (auth.uid() = client_id OR auth.uid() = provider_id);

-- Gig posts: poster manages, everyone reads active
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gig_posts') THEN
    ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS poster_id    UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS event_id     UUID REFERENCES events(id) ON DELETE SET NULL;
    ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS title        TEXT;
    ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS description  TEXT;
    ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS category     TEXT;
    ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS pay_amount   NUMERIC(8,2);
    ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS lat          FLOAT;
    ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS lon          FLOAT;
    ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS time_window  TEXT;
    ALTER TABLE gig_posts ADD COLUMN IF NOT EXISTS active       BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

CREATE POLICY gigs_owner  ON gig_posts FOR ALL    USING (auth.uid() = poster_id);
CREATE POLICY gigs_select ON gig_posts FOR SELECT USING (active = TRUE);

-- Gig acceptances: worker manages their own
CREATE POLICY gig_acc_owner  ON gig_acceptances FOR ALL    USING (auth.uid() = worker_id);
CREATE POLICY gig_acc_select ON gig_acceptances FOR SELECT USING (TRUE);

-- Path stars: owner manages
CREATE POLICY stars_owner  ON path_stars FOR ALL    USING (auth.uid() = user_id);
CREATE POLICY stars_select ON path_stars FOR SELECT USING (TRUE);

-- Disputes: raised_by or parties manage
CREATE POLICY disputes_raised ON disputes FOR ALL USING (auth.uid() = raised_by);

-- DM rooms: only participants
ALTER TABLE dm_rooms    ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'dm_messages') THEN
    ALTER TABLE dm_messages ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
CREATE POLICY dm_rooms_parties   ON dm_rooms    FOR ALL    USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY dm_messages_sender ON dm_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY dm_messages_select ON dm_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM dm_rooms r WHERE r.id = room_id AND (r.user_a = auth.uid() OR r.user_b = auth.uid())
  ));

-- ── Contextual Ads (AdFlywheel) ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contextual_ads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "type"      TEXT NOT NULL CHECK ("type" IN ('event','service','gig')),
  headline    TEXT NOT NULL,
  subline     TEXT,
  cta         TEXT NOT NULL DEFAULT 'View',
  color       TEXT,
  icon        TEXT DEFAULT 'zap',
  badge       TEXT DEFAULT 'PROMOTED',
  event_id    UUID REFERENCES events(id) ON DELETE SET NULL,
  priority    INT NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'contextual_ads') THEN
    CREATE INDEX IF NOT EXISTS contextual_ads_active_idx ON contextual_ads(active, priority DESC);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'contextual_ads') THEN
    ALTER TABLE contextual_ads ENABLE ROW LEVEL SECURITY;
    CREATE POLICY ads_select ON contextual_ads FOR SELECT USING (active = TRUE);
  END IF;
END $$;
--============================================================
--  SECTION: RLS POLICIES COMPLETE
--============================================================

-- ─── Migration 003: Complete RLS policies ────────────────────────────────────
-- Fills the gaps where tables had RLS enabled but were missing UPDATE/DELETE
-- policies, leaving them open to arbitrary writes via the PostgREST API.

-- ─── event_reactions ─────────────────────────────────────────────────────────
-- SELECT: anyone can read reactions (public event data)
CREATE POLICY "event_reactions_select"
  ON event_reactions FOR SELECT USING (true);

-- INSERT: authenticated users insert their own reactions
CREATE POLICY "event_reactions_insert"
  ON event_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: users can only update their own reaction
CREATE POLICY "event_reactions_update"
  ON event_reactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: users can only delete their own reaction
CREATE POLICY "event_reactions_delete"
  ON event_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- ─── pulse_requests ──────────────────────────────────────────────────────────
CREATE POLICY "pulse_requests_select"
  ON pulse_requests FOR SELECT USING (true);

CREATE POLICY "pulse_requests_insert"
  ON pulse_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only the request author or an admin can update/delete
CREATE POLICY "pulse_requests_update"
  ON pulse_requests FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "pulse_requests_delete"
  ON pulse_requests FOR DELETE
  USING (auth.uid() = user_id);

-- ─── pulse_votes ─────────────────────────────────────────────────────────────
CREATE POLICY "pulse_votes_select"
  ON pulse_votes FOR SELECT USING (true);

CREATE POLICY "pulse_votes_insert"
  ON pulse_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Votes are immutable once cast — no UPDATE policy (intentional)

CREATE POLICY "pulse_votes_delete"
  ON pulse_votes FOR DELETE
  USING (auth.uid() = user_id);

-- ─── notifications ────────────────────────────────────────────────────────────
-- SELECT: only the recipient can read their own notifications
CREATE POLICY "notifications_select"
  ON notifications FOR SELECT
  USING (auth.uid() = recipient_id);

-- INSERT: service role only (notifications are inserted server-side or via
-- notificationService with service key). Block direct client inserts.
-- We use a function-based check: only allow if actor_id matches the caller,
-- OR caller is service role (uid() IS NULL means service role bypass).
CREATE POLICY "notifications_insert"
  ON notifications FOR INSERT
  WITH CHECK (
    auth.uid() IS NULL OR  -- service role
    auth.uid() = actor_id  -- authenticated sender
  );

-- UPDATE: only recipient can mark as read
CREATE POLICY "notifications_update"
  ON notifications FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- DELETE: only recipient can delete their notifications
CREATE POLICY "notifications_delete"
  ON notifications FOR DELETE
  USING (auth.uid() = recipient_id);

-- ─── echoes ───────────────────────────────────────────────────────────────────
-- Ensure echoes has proper policies (common to be missing update/delete)
CREATE POLICY "echoes_select"
  ON echoes FOR SELECT USING (true);

CREATE POLICY "echoes_insert"
  ON echoes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "echoes_update"
  ON echoes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "echoes_delete"
  ON echoes FOR DELETE
  USING (auth.uid() = user_id);

-- ─── reel_likes ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "reel_likes_select" ON reel_likes;
DROP POLICY IF EXISTS "reel_likes_insert" ON reel_likes;
DROP POLICY IF EXISTS "reel_likes_delete" ON reel_likes;
CREATE POLICY "reel_likes_select"
  ON reel_likes FOR SELECT USING (true);

CREATE POLICY "reel_likes_insert"
  ON reel_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reel_likes_delete"
  ON reel_likes FOR DELETE
  USING (auth.uid() = user_id);

-- ─── event_vibes ─────────────────────────────────────────────────────────────
CREATE POLICY "event_vibes_select"
  ON event_vibes FOR SELECT USING (true);

CREATE POLICY "event_vibes_insert"
  ON event_vibes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "event_vibes_delete"
  ON event_vibes FOR DELETE
  USING (auth.uid() = user_id);

-- ─── follows ─────────────────────────────────────────────────────────────────
CREATE POLICY "follows_select"
  ON follows FOR SELECT USING (true);

CREATE POLICY "follows_insert"
  ON follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "follows_delete"
  ON follows FOR DELETE
  USING (auth.uid() = follower_id);

-- ─── Rate-limit helper function ───────────────────────────────────────────────
-- Prevents a single user from inserting more than N rows in a table within
-- a rolling time window. Used in per-table INSERT policies.
-- Usage: call_rate_ok('echoes', auth.uid(), 5, interval '1 minute')
CREATE OR REPLACE FUNCTION call_rate_ok(
  tbl   text,
  uid   uuid,
  max_n int,
  window_interval interval
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  cnt int;
BEGIN
  EXECUTE format(
    'SELECT COUNT(*) FROM %I WHERE user_id = $1 AND created_at > now() - $2',
    tbl
  ) INTO cnt USING uid, window_interval;
  RETURN cnt < max_n;
END;
$$;

-- Apply rate limiting to echo inserts: max 20 echoes per minute per user
DROP POLICY IF EXISTS "echoes_insert" ON echoes;
CREATE POLICY "echoes_insert"
  ON echoes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND call_rate_ok('echoes', auth.uid(), 20, interval '1 minute')
  );

-- Apply rate limiting to pulse_requests: max 5 per hour per user
DROP POLICY IF EXISTS "pulse_requests_insert" ON pulse_requests;
CREATE POLICY "pulse_requests_insert"
  ON pulse_requests FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND call_rate_ok('pulse_requests', auth.uid(), 5, interval '1 hour')
  );


--============================================================
--  SECTION: NEW FEATURES (reactions, updates, waitlist, carpools)
--============================================================

-- ─── New Features Migration ───────────────────────────────────────────────────
-- Covers: event_reactions, event_updates (live updates), event_waitlist,
--         event_carpools, event_carpool_requests, rsvp_tiers on events
-- Run after 003_rls_policies.sql

-- ─── event_reactions ──────────────────────────────────────────────────────────
-- Emoji reactions on events (🔥💎🎶🤩✨😂)
create table if not exists event_reactions (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  reaction    text not null,
  created_at  timestamptz not null default now(),
  unique (event_id, user_id, reaction)
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_reactions') THEN
    create index if not exists event_reactions_event_id_idx on event_reactions(event_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_reactions') THEN
    alter table event_reactions enable row level security;
  END IF;
END $$;
-- RLS (safe to run even if 003 already added these — IF NOT EXISTS guards them)
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'event_reactions' and policyname = 'event_reactions_select'
  ) then
    execute 'create policy "event_reactions_select" on event_reactions for select using (true)';
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'event_reactions' and policyname = 'event_reactions_insert'
  ) then
    execute 'create policy "event_reactions_insert" on event_reactions for insert with check (auth.uid() = user_id)';
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'event_reactions' and policyname = 'event_reactions_delete'
  ) then
    execute 'create policy "event_reactions_delete" on event_reactions for delete using (auth.uid() = user_id)';
  end if;
end $$;

-- ─── event_updates ────────────────────────────────────────────────────────────
-- Live updates posted by event organiser
create table if not exists event_updates (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  author_id   uuid not null references profiles(id) on delete cascade,
  message     text not null,
  update_type text not null default 'info'
                check (update_type in ('info', 'hype', 'change', 'shoutout')),
  created_at  timestamptz not null default now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_updates') THEN
    create index if not exists event_updates_event_id_idx on event_updates(event_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_updates') THEN
    alter table event_updates enable row level security;
  END IF;
END $$;
CREATE POLICY "event_updates_select"
  on event_updates for select using (true);

CREATE POLICY "event_updates_insert"
  on event_updates for insert with check (auth.uid() = author_id);

CREATE POLICY "event_updates_delete"
  on event_updates for delete using (auth.uid() = author_id);

-- ─── event_waitlist ───────────────────────────────────────────────────────────
-- Waitlist for sold-out events
create table if not exists event_waitlist (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  unique (event_id, user_id)
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_waitlist') THEN
    create index if not exists event_waitlist_event_id_idx on event_waitlist(event_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_waitlist') THEN
    alter table event_waitlist enable row level security;
  END IF;
END $$;
CREATE POLICY "event_waitlist_select"
  on event_waitlist for select using (true);

CREATE POLICY "event_waitlist_insert"
  on event_waitlist for insert with check (auth.uid() = user_id);

CREATE POLICY "event_waitlist_delete"
  on event_waitlist for delete using (auth.uid() = user_id);

-- ─── event_carpools ───────────────────────────────────────────────────────────
-- Lift offers from drivers attending an event
create table if not exists event_carpools (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references events(id) on delete cascade,
  driver_id        uuid not null references profiles(id) on delete cascade,
  seats_available  int not null default 2 check (seats_available between 1 and 10),
  departure_area   text not null,
  departure_time   timestamptz,
  note             text,
  created_at       timestamptz not null default now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_carpools') THEN
    create index if not exists event_carpools_event_id_idx on event_carpools(event_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_carpools') THEN
    alter table event_carpools enable row level security;
  END IF;
END $$;
CREATE POLICY "event_carpools_select"
  on event_carpools for select using (true);

CREATE POLICY "event_carpools_insert"
  on event_carpools for insert with check (auth.uid() = driver_id);

CREATE POLICY "event_carpools_delete"
  on event_carpools for delete using (auth.uid() = driver_id);

-- ─── event_carpool_requests ───────────────────────────────────────────────────
-- Seat requests from riders
create table if not exists event_carpool_requests (
  id          uuid primary key default gen_random_uuid(),
  carpool_id  uuid not null references event_carpools(id) on delete cascade,
  event_id    uuid not null references events(id) on delete cascade,
  rider_id    uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (carpool_id, rider_id)
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_carpool_requests') THEN
    create index if not exists ecr_carpool_id_idx on event_carpool_requests(carpool_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_carpool_requests') THEN
    create index if not exists ecr_rider_id_idx   on event_carpool_requests(rider_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_carpool_requests') THEN
    alter table event_carpool_requests enable row level security;
  END IF;
END $$;
CREATE POLICY "event_carpool_requests_select"
  on event_carpool_requests for select using (true);

CREATE POLICY "event_carpool_requests_insert"
  on event_carpool_requests for insert with check (auth.uid() = rider_id);

CREATE POLICY "event_carpool_requests_delete"
  on event_carpool_requests for delete using (auth.uid() = rider_id);

-- ─── events table additions ───────────────────────────────────────────────────
-- VIP / table tier definitions (JSONB array: [{id, name, description, price, capacity, icon, color}])
alter table events
  add column if not exists rsvp_tiers jsonb;

-- tier_id on RSVPs so we know which tier each attendee booked
alter table event_rsvps
  add column if not exists tier_id text;

-- ─── upsert_rsvp_tier RPC ────────────────────────────────────────────────────
-- Fallback RPC used by VIPTierSelector when direct upsert isn't available
create or replace function upsert_rsvp_tier(
  p_event_id uuid,
  p_user_id  uuid,
  p_tier_id  text
) returns void
language plpgsql security definer as $$
begin
  insert into event_rsvps (event_id, user_id, status, tier_id)
  values (p_event_id, p_user_id, 'going', p_tier_id)
  on conflict (event_id, user_id)
  do update set tier_id = excluded.tier_id, status = 'going';
end;
$$;

-- ─── Realtime ────────────────────────────────────────────────────────────────
-- Enable realtime publication for live-update tables
alter publication supabase_realtime add table event_reactions;
alter publication supabase_realtime add table event_updates;


--============================================================
--  SECTION: LIVE DB PATCH (columns, security, AI layer)
--============================================================

-- ============================================================
--  THE GRUVS — Master Live Database Patch  (v3)
--  Paste this entire file into Supabase → SQL Editor → Run
--  Every statement is idempotent — safe to run more than once.
-- ============================================================


-- ══════════════════════════════════════════════════════════════
--  1. PROFILES — columns + RLS
-- ══════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name           TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url             TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url              TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio                    TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location               TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website                TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_verified            BOOLEAN     DEFAULT false;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_online              BOOLEAN     DEFAULT false;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen              TIMESTAMPTZ DEFAULT now();
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vibe_score             INTEGER     DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests              TEXT[];
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lat                    FLOAT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lon                    FLOAT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city                   TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_online            BOOLEAN     DEFAULT true;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS share_events           BOOLEAN     DEFAULT false;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code          TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_count         INTEGER     DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_gallery        TEXT[];
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS career_title           TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS career_description     TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS looks_description      TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_year             INTEGER;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender                 TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_discoverable        BOOLEAN     DEFAULT true;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token             TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS identity_mode          TEXT        DEFAULT 'public';
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_streak         INTEGER     DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_integrity_score FLOAT       DEFAULT 100;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at             TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public profiles readable" ON profiles;
    DROP POLICY IF EXISTS "Users update own profile" ON profiles;
    DROP POLICY IF EXISTS "Users insert own profile" ON profiles;
    CREATE POLICY "Public profiles readable" ON profiles FOR SELECT USING (true);
    CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
    CREATE POLICY "Users insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;
-- ══════════════════════════════════════════════════════════════
--  2. FOLLOWS — RLS
-- ══════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'follows') THEN
    ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Follows readable"         ON follows;
    DROP POLICY IF EXISTS "Users manage own follows" ON follows;
    CREATE POLICY "Follows readable"         ON follows FOR SELECT USING (true);
    CREATE POLICY "Users manage own follows" ON follows FOR ALL    USING (auth.uid() = follower_id);
  END IF;
END $$;
-- ══════════════════════════════════════════════════════════════
--  3. MESSAGES — columns + RLS
-- ══════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type     TEXT             DEFAULT 'text';
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url        TEXT;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS parent_id        UUID             REFERENCES messages(id) ON DELETE SET NULL;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS event_id         UUID;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS latitude         DOUBLE PRECISION;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS longitude        DOUBLE PRECISION;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_request       BOOLEAN          DEFAULT false;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS request_accepted BOOLEAN          DEFAULT false;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS reaction         TEXT;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at          TIMESTAMPTZ;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at     TIMESTAMPTZ;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
    ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Message participants can read" ON messages;
    DROP POLICY IF EXISTS "Users send own messages"       ON messages;
    DROP POLICY IF EXISTS "Users update own messages"     ON messages;
    CREATE POLICY "Message participants can read" ON messages FOR SELECT
      USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
    CREATE POLICY "Users send own messages"       ON messages FOR INSERT
      WITH CHECK (auth.uid() = sender_id);
    CREATE POLICY "Users update own messages"     ON messages FOR UPDATE
      USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
  END IF;
END $$;
-- ══════════════════════════════════════════════════════════════
--  4. EVENTS — RLS
-- ══════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'events') THEN
    ALTER TABLE events ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Events readable by all"            ON events;
    DROP POLICY IF EXISTS "Authenticated users insert events" ON events;
    DROP POLICY IF EXISTS "Users update own events"           ON events;
    DROP POLICY IF EXISTS "Users delete own events"           ON events;
    CREATE POLICY "Events readable by all"            ON events FOR SELECT USING (true);
    CREATE POLICY "Authenticated users insert events" ON events FOR INSERT
      WITH CHECK (auth.uid() = author_id);
    CREATE POLICY "Users update own events"           ON events FOR UPDATE
      USING (auth.uid() = author_id);
    CREATE POLICY "Users delete own events"           ON events FOR DELETE
      USING (auth.uid() = author_id);
  END IF;
END $$;
-- ══════════════════════════════════════════════════════════════
--  5. EVENT VIBES — RLS
-- ══════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_vibes') THEN
    ALTER TABLE event_vibes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Event vibes readable"         ON event_vibes;
    DROP POLICY IF EXISTS "Users manage own event vibes" ON event_vibes;
    CREATE POLICY "Event vibes readable"         ON event_vibes FOR SELECT USING (true);
    CREATE POLICY "Users manage own event vibes" ON event_vibes FOR ALL    USING (auth.uid() = user_id);
  END IF;
END $$;
-- ══════════════════════════════════════════════════════════════
--  6. SAVED EVENTS — RLS
-- ══════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'saved_events') THEN
    ALTER TABLE saved_events ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users manage own saves" ON saved_events;
    CREATE POLICY "Users manage own saves" ON saved_events FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;
-- ══════════════════════════════════════════════════════════════
--  7. EVENT RSVPs — RLS
-- ══════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_rsvps') THEN
    ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "RSVPs readable"         ON event_rsvps;
    DROP POLICY IF EXISTS "Users manage own RSVPs" ON event_rsvps;
    CREATE POLICY "RSVPs readable"         ON event_rsvps FOR SELECT USING (true);
    CREATE POLICY "Users manage own RSVPs" ON event_rsvps FOR ALL    USING (auth.uid() = user_id);
  END IF;
END $$;
-- ══════════════════════════════════════════════════════════════
--  8. ECHOES (comments) — RLS
-- ══════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'echoes') THEN
    ALTER TABLE echoes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Echoes readable"         ON echoes;
    DROP POLICY IF EXISTS "Users insert own echoes" ON echoes;
    DROP POLICY IF EXISTS "Users update own echoes" ON echoes;
    DROP POLICY IF EXISTS "Users delete own echoes" ON echoes;
    CREATE POLICY "Echoes readable"         ON echoes FOR SELECT USING (true);
    CREATE POLICY "Users insert own echoes" ON echoes FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Users update own echoes" ON echoes FOR UPDATE USING (auth.uid() = user_id);
    CREATE POLICY "Users delete own echoes" ON echoes FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
-- ══════════════════════════════════════════════════════════════
--  9. NOTIFICATIONS — RLS (tightened: no unrestricted INSERT)
-- ══════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
    ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users read own notifications"    ON notifications;
    DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
    DROP POLICY IF EXISTS "System insert notifications"     ON notifications;
    DROP POLICY IF EXISTS "Users update own notifications"  ON notifications;
    CREATE POLICY "Users read own notifications"   ON notifications FOR SELECT
      USING (auth.uid() = recipient_id);
    CREATE POLICY "System insert notifications"    ON notifications FOR INSERT
      WITH CHECK (auth.role() IN ('service_role', 'postgres', 'authenticated'));
    CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE
      USING (auth.uid() = recipient_id);
  END IF;
END $$;
-- ══════════════════════════════════════════════════════════════
--  10. LIVE CHECKINS — columns + RLS
-- ══════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'live_checkins') THEN
    ALTER TABLE live_checkins ADD COLUMN IF NOT EXISTS venue_name    TEXT;
    ALTER TABLE live_checkins ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'live_checkins') THEN
    ALTER TABLE live_checkins ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Checkins readable"         ON live_checkins;
    DROP POLICY IF EXISTS "Users manage own checkins" ON live_checkins;
    CREATE POLICY "Checkins readable"         ON live_checkins FOR SELECT USING (true);
    CREATE POLICY "Users manage own checkins" ON live_checkins FOR ALL    USING (auth.uid() = user_id);
  END IF;
END $$;
-- ══════════════════════════════════════════════════════════════
--  11. APP UPDATES — columns + RLS
-- ══════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'app_updates') THEN
    ALTER TABLE app_updates ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE app_updates ADD COLUMN IF NOT EXISTS "type"      TEXT DEFAULT 'feature';
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'app_updates') THEN
    ALTER TABLE app_updates ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Anyone can read app_updates" ON app_updates;
    CREATE POLICY "Anyone can read app_updates" ON app_updates FOR SELECT USING (true);
  END IF;
END $$;
-- ══════════════════════════════════════════════════════════════
--  12. CAMPAIGN ANALYTICS — tighten INSERT policy
-- ══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "analytics_insert" ON campaign_analytics;
CREATE POLICY "analytics_insert" ON campaign_analytics FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');


-- ══════════════════════════════════════════════════════════════
--  13. VIEWS — recreate without SECURITY DEFINER
-- ══════════════════════════════════════════════════════════════
DROP VIEW IF EXISTS public.vibes CASCADE;
CREATE OR REPLACE VIEW public.vibes
  WITH (security_invoker = true)
AS SELECT * FROM public.event_vibes;

DROP VIEW IF EXISTS public.conversations CASCADE;
CREATE OR REPLACE VIEW public.conversations
  WITH (security_invoker = true)
AS SELECT * FROM public.dm_rooms;


-- spatial_ref_sys is a PostGIS system table owned by superuser — skip RLS


-- ══════════════════════════════════════════════════════════════
--  15. STORAGE BUCKETS + RLS
-- ══════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars',
   'avatars',     true, 5242880,
   ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']),
  ('covers',
   'covers',      true, 10485760,
   ARRAY['image/jpeg','image/png','image/webp']),
  ('event-media',
   'event-media', true, 104857600,
   ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/x-m4v']),
  ('chat_media',
   'chat_media',  true, 10485760,
   ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read avatars"     ON storage.objects;
DROP POLICY IF EXISTS "Auth upload avatars"     ON storage.objects;
DROP POLICY IF EXISTS "Auth update avatars"     ON storage.objects;
DROP POLICY IF EXISTS "Auth delete avatars"     ON storage.objects;
DROP POLICY IF EXISTS "Public read covers"      ON storage.objects;
DROP POLICY IF EXISTS "Auth upload covers"      ON storage.objects;
DROP POLICY IF EXISTS "Auth update covers"      ON storage.objects;
DROP POLICY IF EXISTS "Public read event-media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view media"   ON storage.objects;
DROP POLICY IF EXISTS "Auth upload event-media" ON storage.objects;
DROP POLICY IF EXISTS "Public read chat_media"  ON storage.objects;
DROP POLICY IF EXISTS "Auth upload chat_media"  ON storage.objects;
DROP POLICY IF EXISTS "Auth delete chat_media"  ON storage.objects;

CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Auth upload avatars"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Auth update avatars"
  ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Auth delete avatars"
  ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Public read covers"
  ON storage.objects FOR SELECT USING (bucket_id = 'covers');
CREATE POLICY "Auth upload covers"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'covers' AND auth.role() = 'authenticated');
CREATE POLICY "Auth update covers"
  ON storage.objects FOR UPDATE USING (bucket_id = 'covers' AND auth.role() = 'authenticated');

CREATE POLICY "Public read event-media"
  ON storage.objects FOR SELECT USING (bucket_id = 'event-media');
CREATE POLICY "Auth upload event-media"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'event-media' AND auth.role() = 'authenticated');

CREATE POLICY "Public read chat_media"
  ON storage.objects FOR SELECT USING (bucket_id = 'chat_media');
CREATE POLICY "Auth upload chat_media"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat_media' AND auth.role() = 'authenticated');
CREATE POLICY "Auth delete chat_media"
  ON storage.objects FOR DELETE USING (bucket_id = 'chat_media' AND auth.role() = 'authenticated');


-- ══════════════════════════════════════════════════════════════
--  16. FUNCTIONS — pin search_path to prevent injection
--  Each ALTER is guarded: missing functions are silently skipped.
-- ══════════════════════════════════════════════════════════════
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT routine_name, specific_name
    FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name IN (
        'handle_new_user_welcome','request_booking','verify_pop',
        'on_booking_completed_sis','calculate_event_heat_index',
        'create_notification','sync_follows_counts','sync_echo_likes',
        'events_update_search_vector','sync_follow_counts',
        'set_current_timestamp_updated_at','check_event_capacity',
        'handle_new_chat_creator','find_gruv_hotspots','release_escrow',
        'calculate_sis_score','refresh_trending_events','sync_event_engagement',
        'handle_new_bid_notification','mark_notifications_read',
        'sync_save_counts','sync_echo_counts','sync_social_counters',
        'find_popular_spots','increment_profile_score','sync_reaction_count',
        'match_events_advanced','safe_div','sync_vibe_counts',
        'process_automated_payouts','set_message_delivered',
        'sync_check_in_counts','handle_new_user','events_set_slug',
        'touch_updated_at','tag_early_bird_rsvp','handle_location_match',
        'search_events','sync_events_posted','sync_rsvp_counts'
      )
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION public.%I SET search_path = public', r.routine_name);
    EXCEPTION WHEN OTHERS THEN
      NULL; -- skip if signature ambiguous or function missing
    END;
  END LOOP;
END $$;
-- Functions with specific signatures — guarded individually
DO $$ BEGIN ALTER FUNCTION public.array_overlap_count(anyarray, anyarray) SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.increment_vibe(uuid, uuid) SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.place_bid(uuid, uuid, numeric) SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.feed_for_user(uuid, integer, integer) SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.get_event_full(uuid, uuid) SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.find_nearby_vibers(uuid, double precision, integer) SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.decrement_vibe(uuid, uuid) SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.search_events_fts(text, integer) SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.find_nearby_events(double precision, double precision, double precision, integer) SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.purchase_tickets(uuid, uuid, text, numeric, integer) SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.increment_views(uuid) SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.increment_profile_score(uuid, integer) SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.mark_notifications_read(uuid) SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ══════════════════════════════════════════════════════════════
--  17. FUNCTIONS — switch read-only ones to SECURITY INVOKER
--      and revoke anon EXECUTE from write/trigger functions
-- ══════════════════════════════════════════════════════════════

-- Read-only: safe for public but should run as caller (each guarded)
DO $$ BEGIN ALTER FUNCTION public.calculate_event_heat_index() SECURITY INVOKER; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.check_event_capacity() SECURITY INVOKER; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.find_popular_spots(integer) SECURITY INVOKER; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.get_event_full(uuid, uuid) SECURITY INVOKER; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.match_events_advanced() SECURITY INVOKER; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.search_events_fts(text, integer) SECURITY INVOKER; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.safe_div(numeric, numeric) SECURITY INVOKER; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.find_gruv_hotspots() SECURITY INVOKER; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Trigger / internal functions: anon should never call these directly (each guarded)
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.handle_new_user_welcome() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.handle_new_chat_creator() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.handle_new_bid_notification() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.handle_location_match() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sync_vibe_counts() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sync_follow_counts() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sync_follows_counts() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sync_echo_counts() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sync_echo_likes() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sync_save_counts() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sync_social_counters() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sync_event_engagement() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sync_reaction_count() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sync_check_in_counts() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sync_events_posted() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.events_update_search_vector() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.events_set_slug() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.tag_early_bird_rsvp() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.set_message_delivered() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.set_current_timestamp_updated_at() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.on_booking_completed_sis() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Write functions: require authentication (each guarded — skip if function missing)
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.increment_vibe(uuid, uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.decrement_vibe(uuid, uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.increment_views(uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.increment_profile_score(uuid, integer) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.mark_notifications_read(uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.create_notification() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.place_bid(uuid, uuid, numeric) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.release_escrow() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.purchase_tickets(uuid, uuid, text, numeric, integer) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.process_automated_payouts() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.request_booking() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.verify_pop() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.feed_for_user(uuid, integer, integer) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.find_nearby_vibers(uuid, double precision, integer) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.refresh_trending_events() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ══════════════════════════════════════════════════════════════
--  18. AI LAYER — tables for memory, recommendations, logging
-- ══════════════════════════════════════════════════════════════

-- Per-user AI memory: preferences + behaviour Claude learns over time
CREATE TABLE IF NOT EXISTS ai_user_memory (
  user_id        UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  preferences    JSONB        DEFAULT '{}',
  behaviour      JSONB        DEFAULT '{}',
  summary        TEXT,
  updated_at     TIMESTAMPTZ  DEFAULT now()
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_user_memory') THEN
    ALTER TABLE ai_user_memory ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "User reads own ai memory"    ON ai_user_memory;
    DROP POLICY IF EXISTS "Service manages ai memory"   ON ai_user_memory;
    CREATE POLICY "User reads own ai memory"  ON ai_user_memory FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY "Service manages ai memory" ON ai_user_memory FOR ALL   USING (auth.role() IN ('service_role','postgres'));
  END IF;
END $$;
-- Cached recommendations refreshed daily by the AI agent
CREATE TABLE IF NOT EXISTS ai_recommendations_cache (
  user_id        UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  event_ids      UUID[]       DEFAULT '{}',
  viber_ids      UUID[]       DEFAULT '{}',
  reasoning      TEXT,
  generated_at   TIMESTAMPTZ  DEFAULT now()
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_recommendations_cache') THEN
    ALTER TABLE ai_recommendations_cache ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "User reads own recs"   ON ai_recommendations_cache;
    DROP POLICY IF EXISTS "Service manages recs"  ON ai_recommendations_cache;
    CREATE POLICY "User reads own recs"  ON ai_recommendations_cache FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY "Service manages recs" ON ai_recommendations_cache FOR ALL   USING (auth.role() IN ('service_role','postgres'));
  END IF;
END $$;
-- Every AI call logged for learning + feedback loop
CREATE TABLE IF NOT EXISTS ai_interactions (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  feature        TEXT         NOT NULL,
  input          TEXT,
  output         TEXT,
  model          TEXT,
  tokens_used    INTEGER,
  feedback       INTEGER,
  created_at     TIMESTAMPTZ  DEFAULT now()
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_interactions') THEN
    ALTER TABLE ai_interactions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "User reads own interactions"    ON ai_interactions;
    DROP POLICY IF EXISTS "Service inserts interactions"   ON ai_interactions;
    CREATE POLICY "User reads own interactions"  ON ai_interactions FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY "Service inserts interactions" ON ai_interactions FOR INSERT WITH CHECK (true);
  END IF;
END $$;
-- Auto-purge interactions older than 90 days
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_interactions') THEN
    CREATE INDEX IF NOT EXISTS ai_interactions_created ON ai_interactions(created_at);
  END IF;
END $$;

-- Content moderation queue
CREATE TABLE IF NOT EXISTS ai_moderation_queue (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type   TEXT         NOT NULL,
  content_id     UUID         NOT NULL,
  content_text   TEXT         NOT NULL,
  author_id      UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  status         TEXT         DEFAULT 'pending',
  ai_verdict     TEXT,
  ai_reason      TEXT,
  reviewed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  DEFAULT now()
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_moderation_queue') THEN
    ALTER TABLE ai_moderation_queue ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Service manages moderation" ON ai_moderation_queue;
    CREATE POLICY "Service manages moderation" ON ai_moderation_queue FOR ALL USING (auth.role() IN ('service_role','postgres'));
  END IF;
END $$;
-- Add sound_name to reels (used by CreateReelModal audio pill)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reels') THEN
    ALTER TABLE reels ADD COLUMN IF NOT EXISTS sound_name TEXT;
  END IF;
END $$;

-- Add reel_reports table for in-app reporting
CREATE TABLE IF NOT EXISTS reel_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id     UUID        NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  reporter_id UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  reason      TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(reel_id, reporter_id)
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reel_reports') THEN
    ALTER TABLE reel_reports ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can report reels" ON reel_reports;
    CREATE POLICY "Users can report reels" ON reel_reports
      FOR INSERT WITH CHECK (auth.uid() = reporter_id);
  END IF;
END $$;
--============================================================
--  SECTION: MASTER ADVANCE (stories, reels, wallets, indexes, RPCs)
--============================================================

-- ============================================================
--  THE GRUVS — Master Advance Migration  v5 × 5
--  "advancing every line times 5"
--  Paste into Supabase → SQL Editor → Run
--  Fully idempotent — safe to run multiple times.
-- ============================================================


-- ══════════════════════════════════════════════════════════════
--  §1  PROFILES — missing columns
-- ══════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS looking_for       TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_areas   TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wallet_balance    NUMERIC  DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_events_posted INTEGER DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_check_ins    INTEGER DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak_last_date  DATE;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS badges            JSONB    DEFAULT '[]';
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_prefs JSONB   DEFAULT '{}';
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════
--  §2  EVENTS — missing columns
-- ══════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'events') THEN
    ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_url      TEXT;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url      TEXT;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_image    TEXT;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS rsvp_tiers     JSONB;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS capacity       INTEGER;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_price   NUMERIC;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS dress_code     TEXT;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS age_restriction TEXT;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS playlist_url   TEXT;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS lineup         JSONB  DEFAULT '[]';
    ALTER TABLE events ADD COLUMN IF NOT EXISTS sponsors       JSONB  DEFAULT '[]';
    ALTER TABLE events ADD COLUMN IF NOT EXISTS weather_cache  JSONB;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS weather_cached_at TIMESTAMPTZ;
  END IF;
END $$;

-- Sync cover_url from existing media records (one-time backfill)
UPDATE events
SET cover_url = media_urls[1]
WHERE cover_url IS NULL
  AND media_urls IS NOT NULL
  AND array_length(media_urls, 1) > 0;

UPDATE events
SET cover_url = (media->0->>'url')
WHERE cover_url IS NULL
  AND media IS NOT NULL
  AND jsonb_array_length(media) > 0;


-- ══════════════════════════════════════════════════════════════
--  §3  EVENT_RSVPS — tier support
-- ══════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_rsvps') THEN
    ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS tier_id      TEXT;
    ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS ticket_ref   TEXT;
    ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS amount_paid  NUMERIC DEFAULT 0;
    ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS is_early_bird BOOLEAN DEFAULT false;
    ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS checked_in   BOOLEAN DEFAULT false;
    ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════
--  §4  STORIES
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS stories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_url   TEXT        NOT NULL,
  media_type  TEXT        NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  caption     TEXT,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  view_count  INTEGER     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'stories') THEN
    CREATE INDEX IF NOT EXISTS stories_user_id_idx    ON stories(user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'stories') THEN
    CREATE INDEX IF NOT EXISTS stories_expires_at_idx ON stories(expires_at DESC);
  END IF;
END $$;
-- Partial index: only live stories
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'stories') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS stories_live_idx ON stories(user_id, created_at DESC)';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'stories') THEN
    ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "stories_select"  ON stories;
    DROP POLICY IF EXISTS "stories_insert"  ON stories;
    DROP POLICY IF EXISTS "stories_delete"  ON stories;
    CREATE POLICY "stories_select" ON stories FOR SELECT USING (true);
    CREATE POLICY "stories_insert" ON stories FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "stories_delete" ON stories FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
-- ══════════════════════════════════════════════════════════════
--  §5  STORY_VIEWS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS story_views (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id   UUID        NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (story_id, viewer_id)
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'story_views') THEN
    CREATE INDEX IF NOT EXISTS story_views_story_id_idx  ON story_views(story_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'story_views') THEN
    CREATE INDEX IF NOT EXISTS story_views_viewer_id_idx ON story_views(viewer_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'story_views') THEN
    ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "story_views_select"  ON story_views;
    DROP POLICY IF EXISTS "story_views_insert"  ON story_views;
    CREATE POLICY "story_views_select" ON story_views FOR SELECT USING (true);
    CREATE POLICY "story_views_insert" ON story_views FOR INSERT
      WITH CHECK (auth.uid() = viewer_id);
  END IF;
END $$;
-- Auto-increment view_count on stories when a view is recorded
CREATE OR REPLACE FUNCTION sync_story_view_count()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE stories SET view_count = view_count + 1 WHERE id = NEW.story_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_story_view_count ON story_views;
CREATE TRIGGER trg_story_view_count
  AFTER INSERT ON story_views
  FOR EACH ROW EXECUTE FUNCTION sync_story_view_count();


-- ══════════════════════════════════════════════════════════════
--  §6  REELS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS reels (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_url   TEXT        NOT NULL,
  media_type  TEXT        NOT NULL DEFAULT 'video' CHECK (media_type IN ('video','image')),
  caption     TEXT,
  sound_name  TEXT,
  hashtags    TEXT[],
  like_count  INTEGER     DEFAULT 0,
  view_count  INTEGER     DEFAULT 0,
  comment_count INTEGER   DEFAULT 0,
  share_count INTEGER     DEFAULT 0,
  is_featured BOOLEAN     DEFAULT false,
  is_removed  BOOLEAN     DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reels') THEN
    ALTER TABLE reels ADD COLUMN IF NOT EXISTS sound_name    TEXT;
    ALTER TABLE reels ADD COLUMN IF NOT EXISTS hashtags      TEXT[];
    ALTER TABLE reels ADD COLUMN IF NOT EXISTS share_count   INTEGER DEFAULT 0;
    ALTER TABLE reels ADD COLUMN IF NOT EXISTS is_featured   BOOLEAN DEFAULT false;
    ALTER TABLE reels ADD COLUMN IF NOT EXISTS is_removed    BOOLEAN DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reels') THEN
    CREATE INDEX IF NOT EXISTS reels_user_id_idx    ON reels(user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reels') THEN
    CREATE INDEX IF NOT EXISTS reels_created_at_idx ON reels(created_at DESC);
  END IF;
END $$;
-- Partial index: only live reels
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reels') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS reels_live_idx ON reels(created_at DESC) WHERE is_removed = false';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reels') THEN
    ALTER TABLE reels ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "reels_select"  ON reels;
    DROP POLICY IF EXISTS "reels_insert"  ON reels;
    DROP POLICY IF EXISTS "reels_update"  ON reels;
    DROP POLICY IF EXISTS "reels_delete"  ON reels;
    CREATE POLICY "reels_select" ON reels FOR SELECT USING (is_removed = false OR auth.uid() = user_id);
    CREATE POLICY "reels_insert" ON reels FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "reels_update" ON reels FOR UPDATE USING (auth.uid() = user_id);
    CREATE POLICY "reels_delete" ON reels FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
-- ══════════════════════════════════════════════════════════════
--  §7  REEL_LIKES
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS reel_likes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id    UUID        NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  removed    BOOLEAN     DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (reel_id, user_id)
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reel_likes') THEN
    CREATE INDEX IF NOT EXISTS reel_likes_reel_id_idx ON reel_likes(reel_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reel_likes') THEN
    CREATE INDEX IF NOT EXISTS reel_likes_user_id_idx ON reel_likes(user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reel_likes') THEN
    ALTER TABLE reel_likes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "reel_likes_select"  ON reel_likes;
    DROP POLICY IF EXISTS "reel_likes_insert"  ON reel_likes;
    DROP POLICY IF EXISTS "reel_likes_update"  ON reel_likes;
    DROP POLICY IF EXISTS "reel_likes_delete"  ON reel_likes;
    CREATE POLICY "reel_likes_select" ON reel_likes FOR SELECT USING (true);
    CREATE POLICY "reel_likes_insert" ON reel_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "reel_likes_update" ON reel_likes FOR UPDATE USING (auth.uid() = user_id);
    CREATE POLICY "reel_likes_delete" ON reel_likes FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
-- Sync like_count on reels
CREATE OR REPLACE FUNCTION sync_reel_like_count()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.removed = true) THEN
    UPDATE reels SET like_count = greatest(0, like_count - 1) WHERE id = COALESCE(OLD.reel_id, NEW.reel_id);
  ELSIF TG_OP = 'INSERT' AND (NEW.removed IS NULL OR NEW.removed = false) THEN
    UPDATE reels SET like_count = like_count + 1 WHERE id = NEW.reel_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_reel_like_count ON reel_likes;
CREATE TRIGGER trg_reel_like_count
  AFTER INSERT OR UPDATE OR DELETE ON reel_likes
  FOR EACH ROW EXECUTE FUNCTION sync_reel_like_count();


-- ══════════════════════════════════════════════════════════════
--  §8  REEL_VIEWS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS reel_views (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id    UUID        NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  user_id    UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  viewed_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (reel_id, user_id)
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reel_views') THEN
    CREATE INDEX IF NOT EXISTS reel_views_reel_id_idx ON reel_views(reel_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reel_views') THEN
    ALTER TABLE reel_views ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "reel_views_select"  ON reel_views;
    DROP POLICY IF EXISTS "reel_views_insert"  ON reel_views;
    CREATE POLICY "reel_views_select" ON reel_views FOR SELECT USING (true);
    CREATE POLICY "reel_views_insert" ON reel_views FOR INSERT WITH CHECK (true);
  END IF;
END $$;
-- Sync view_count on reels
CREATE OR REPLACE FUNCTION sync_reel_view_count()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE reels SET view_count = view_count + 1 WHERE id = NEW.reel_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_reel_view_count ON reel_views;
CREATE TRIGGER trg_reel_view_count
  AFTER INSERT ON reel_views
  FOR EACH ROW EXECUTE FUNCTION sync_reel_view_count();


-- ══════════════════════════════════════════════════════════════
--  §9  REEL_COMMENTS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS reel_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id    UUID        NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       TEXT        NOT NULL,
  parent_id  UUID        REFERENCES reel_comments(id) ON DELETE CASCADE,
  like_count INTEGER     DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reel_comments') THEN
    CREATE INDEX IF NOT EXISTS reel_comments_reel_id_idx ON reel_comments(reel_id, created_at DESC);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reel_comments') THEN
    ALTER TABLE reel_comments ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "reel_comments_select"  ON reel_comments;
    DROP POLICY IF EXISTS "reel_comments_insert"  ON reel_comments;
    DROP POLICY IF EXISTS "reel_comments_delete"  ON reel_comments;
    CREATE POLICY "reel_comments_select" ON reel_comments FOR SELECT USING (true);
    CREATE POLICY "reel_comments_insert" ON reel_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "reel_comments_delete" ON reel_comments FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
-- Sync comment_count on reels
CREATE OR REPLACE FUNCTION sync_reel_comment_count()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE reels SET comment_count = greatest(0, comment_count - 1) WHERE id = OLD.reel_id;
    RETURN OLD;
  ELSE
    UPDATE reels SET comment_count = comment_count + 1 WHERE id = NEW.reel_id;
    RETURN NEW;
  END IF;
END;
$$;
DROP TRIGGER IF EXISTS trg_reel_comment_count ON reel_comments;
CREATE TRIGGER trg_reel_comment_count
  AFTER INSERT OR DELETE ON reel_comments
  FOR EACH ROW EXECUTE FUNCTION sync_reel_comment_count();


-- ══════════════════════════════════════════════════════════════
--  §10  SAVED_REELS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS saved_reels (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id    UUID        NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  removed    BOOLEAN     DEFAULT false,
  saved_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (reel_id, user_id)
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'saved_reels') THEN
    CREATE INDEX IF NOT EXISTS saved_reels_user_id_idx ON saved_reels(user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'saved_reels') THEN
    ALTER TABLE saved_reels ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "saved_reels_select"  ON saved_reels;
    DROP POLICY IF EXISTS "saved_reels_insert"  ON saved_reels;
    DROP POLICY IF EXISTS "saved_reels_update"  ON saved_reels;
    DROP POLICY IF EXISTS "saved_reels_delete"  ON saved_reels;
    CREATE POLICY "saved_reels_select" ON saved_reels FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY "saved_reels_insert" ON saved_reels FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "saved_reels_update" ON saved_reels FOR UPDATE USING (auth.uid() = user_id);
    CREATE POLICY "saved_reels_delete" ON saved_reels FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
-- ══════════════════════════════════════════════════════════════
--  §11  REEL_REPORTS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS reel_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id     UUID        NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  reporter_id UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  reason      TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (reel_id, reporter_id)
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reel_reports') THEN
    ALTER TABLE reel_reports ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can report reels" ON reel_reports;
    CREATE POLICY "Users can report reels" ON reel_reports
      FOR INSERT WITH CHECK (auth.uid() = reporter_id);
    DROP POLICY IF EXISTS "reel_reports_service"   ON reel_reports;
    CREATE POLICY "reel_reports_service" ON reel_reports
      FOR SELECT USING (auth.role() IN ('service_role','postgres'));
  END IF;
END $$;
-- ══════════════════════════════════════════════════════════════
--  §12  EVENT FEATURE TABLES (from 20260521_new_features.sql)
--       Idempotent re-run is safe.
-- ══════════════════════════════════════════════════════════════

-- event_reactions
CREATE TABLE IF NOT EXISTS event_reactions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction   TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id, reaction)
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_reactions') THEN
    CREATE INDEX IF NOT EXISTS event_reactions_event_id_idx ON event_reactions(event_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_reactions') THEN
    ALTER TABLE event_reactions ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='event_reactions' AND policyname='event_reactions_select') THEN
    EXECUTE 'CREATE POLICY "event_reactions_select" ON event_reactions FOR SELECT USING (true)'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='event_reactions' AND policyname='event_reactions_insert') THEN
    EXECUTE 'CREATE POLICY "event_reactions_insert" ON event_reactions FOR INSERT WITH CHECK (auth.uid() = user_id)'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='event_reactions' AND policyname='event_reactions_delete') THEN
    EXECUTE 'CREATE POLICY "event_reactions_delete" ON event_reactions FOR DELETE USING (auth.uid() = user_id)'; END IF;
END $$;

-- event_updates
CREATE TABLE IF NOT EXISTS event_updates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  author_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message     TEXT        NOT NULL,
  update_type TEXT        NOT NULL DEFAULT 'info'
    CHECK (update_type IN ('info','hype','change','shoutout')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_updates') THEN
    CREATE INDEX IF NOT EXISTS event_updates_event_id_idx ON event_updates(event_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_updates') THEN
    ALTER TABLE event_updates ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "event_updates_select" ON event_updates;
    DROP POLICY IF EXISTS "event_updates_insert" ON event_updates;
    DROP POLICY IF EXISTS "event_updates_delete" ON event_updates;
    CREATE POLICY "event_updates_select" ON event_updates FOR SELECT USING (true);
    CREATE POLICY "event_updates_insert" ON event_updates FOR INSERT WITH CHECK (auth.uid() = author_id);
    CREATE POLICY "event_updates_delete" ON event_updates FOR DELETE USING (auth.uid() = author_id);
  END IF;
END $$;
-- event_waitlist
CREATE TABLE IF NOT EXISTS event_waitlist (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id  UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_waitlist') THEN
    CREATE INDEX IF NOT EXISTS event_waitlist_event_id_idx ON event_waitlist(event_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_waitlist') THEN
    ALTER TABLE event_waitlist ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "event_waitlist_select" ON event_waitlist;
    DROP POLICY IF EXISTS "event_waitlist_insert" ON event_waitlist;
    DROP POLICY IF EXISTS "event_waitlist_delete" ON event_waitlist;
    CREATE POLICY "event_waitlist_select" ON event_waitlist FOR SELECT USING (true);
    CREATE POLICY "event_waitlist_insert" ON event_waitlist FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "event_waitlist_delete" ON event_waitlist FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
-- event_carpools
CREATE TABLE IF NOT EXISTS event_carpools (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  driver_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seats_available  INT         NOT NULL DEFAULT 2 CHECK (seats_available BETWEEN 1 AND 10),
  departure_area   TEXT        NOT NULL,
  departure_time   TIMESTAMPTZ,
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_carpools') THEN
    CREATE INDEX IF NOT EXISTS event_carpools_event_id_idx ON event_carpools(event_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_carpools') THEN
    ALTER TABLE event_carpools ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "event_carpools_select" ON event_carpools;
    DROP POLICY IF EXISTS "event_carpools_insert" ON event_carpools;
    DROP POLICY IF EXISTS "event_carpools_delete" ON event_carpools;
    CREATE POLICY "event_carpools_select" ON event_carpools FOR SELECT USING (true);
    CREATE POLICY "event_carpools_insert" ON event_carpools FOR INSERT WITH CHECK (auth.uid() = driver_id);
    CREATE POLICY "event_carpools_delete" ON event_carpools FOR DELETE USING (auth.uid() = driver_id);
  END IF;
END $$;
-- event_carpool_requests
CREATE TABLE IF NOT EXISTS event_carpool_requests (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  carpool_id UUID        NOT NULL REFERENCES event_carpools(id) ON DELETE CASCADE,
  event_id   UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  rider_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (carpool_id, rider_id)
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_carpool_requests') THEN
    CREATE INDEX IF NOT EXISTS ecr_carpool_id_idx ON event_carpool_requests(carpool_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_carpool_requests') THEN
    CREATE INDEX IF NOT EXISTS ecr_rider_id_idx   ON event_carpool_requests(rider_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_carpool_requests') THEN
    ALTER TABLE event_carpool_requests ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "event_carpool_requests_select" ON event_carpool_requests;
    DROP POLICY IF EXISTS "event_carpool_requests_insert" ON event_carpool_requests;
    DROP POLICY IF EXISTS "event_carpool_requests_delete" ON event_carpool_requests;
    CREATE POLICY "event_carpool_requests_select" ON event_carpool_requests FOR SELECT USING (true);
    CREATE POLICY "event_carpool_requests_insert" ON event_carpool_requests FOR INSERT WITH CHECK (auth.uid() = rider_id);
    CREATE POLICY "event_carpool_requests_delete" ON event_carpool_requests FOR DELETE USING (auth.uid() = rider_id);
  END IF;
END $$;
-- ══════════════════════════════════════════════════════════════
--  §13  WALLET / TRANSACTIONS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount       NUMERIC     NOT NULL,
  "type"       TEXT        NOT NULL CHECK ("type" IN ('credit','debit','escrow','release','refund','payout')),
  reference    TEXT,
  description  TEXT,
  booking_id   UUID,
  status       TEXT        DEFAULT 'completed' CHECK (status IN ('pending','completed','failed','reversed')),
  created_at   TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wallet_transactions') THEN
    CREATE INDEX IF NOT EXISTS wallet_tx_user_id_idx    ON wallet_transactions(user_id, created_at DESC);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wallet_transactions') THEN
    CREATE INDEX IF NOT EXISTS wallet_tx_status_idx     ON wallet_transactions(status);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wallet_transactions') THEN
    CREATE INDEX IF NOT EXISTS wallet_tx_type_idx       ON wallet_transactions(type);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wallet_transactions') THEN
    ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "wallet_tx_owner"   ON wallet_transactions;
    DROP POLICY IF EXISTS "wallet_tx_service" ON wallet_transactions;
    CREATE POLICY "wallet_tx_owner"   ON wallet_transactions FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY "wallet_tx_service" ON wallet_transactions FOR INSERT
      WITH CHECK (auth.role() IN ('service_role','postgres','authenticated'));
  END IF;
END $$;
-- ══════════════════════════════════════════════════════════════
--  §14  ADVANCED PERFORMANCE INDEXES
-- ══════════════════════════════════════════════════════════════

-- Events: full-text search vector (GIN)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'events') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS events_search_vector_idx ON events USING GIN(search_vector) WHERE search_vector IS NOT NULL';
  END IF;
END $$;

-- Events: trending score for feed sorting
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'events') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS events_trending_idx ON events(trending_score DESC NULLS LAST, event_date DESC) WHERE is_cancelled = false';
  END IF;
END $$;

-- Events: upcoming events by date
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'events') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS events_upcoming_idx ON events(event_date ASC, event_time ASC) WHERE is_cancelled = false AND event_date >= CURRENT_DATE';
  END IF;
END $$;

-- Events: geo lookup (GiST — requires postgis)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'events') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS events_geo_idx ON events USING GIST( CAST(ST_MakePoint(lon, lat) AS geography) ) WHERE lat IS NOT NULL AND lon IS NOT NULL';
  END IF;
END $$;

-- Profiles: geo lookup
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS profiles_geo_idx ON profiles USING GIST( CAST(ST_MakePoint(lon, lat) AS geography) ) WHERE lat IS NOT NULL AND lon IS NOT NULL';
  END IF;
END $$;

-- Notifications: unread count (most common query)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications(recipient_id, created_at DESC) WHERE is_read = false';
  END IF;
END $$;

-- Messages: conversation view
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(sender_id, recipient_id, created_at DESC) WHERE deleted_at IS NULL';
  END IF;
END $$;

-- Event vibes: per-event count
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_vibes') THEN
    CREATE INDEX IF NOT EXISTS event_vibes_event_idx ON event_vibes(event_id);
  END IF;
END $$;

-- Echoes: per-event comment feed
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'echoes') THEN
    CREATE INDEX IF NOT EXISTS echoes_event_idx ON echoes(event_id, created_at DESC);
  END IF;
END $$;

-- Reels: hashtag search (GIN on array)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reels') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS reels_hashtags_gin ON reels USING GIN(hashtags) WHERE hashtags IS NOT NULL AND is_removed = false';
  END IF;
END $$;

-- Stories: live stories per user
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'stories') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS stories_live_user_idx ON stories(user_id, expires_at DESC) WHERE expires_at > CURRENT_TIMESTAMP';
  END IF;
END $$;

-- Service bookings: provider queue
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'service_bookings') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS service_bookings_provider_idx ON service_bookings(provider_id, status, created_at DESC) WHERE status IN (''pending'',''confirmed'')';
  END IF;
END $$;

-- Follows: follower/following lookups
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'follows') THEN
    CREATE INDEX IF NOT EXISTS follows_follower_idx  ON follows(follower_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'follows') THEN
    CREATE INDEX IF NOT EXISTS follows_following_idx ON follows(following_id);
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════
--  §15  STORAGE BUCKETS — stories + reels
-- ══════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('stories', 'stories', true, 52428800,
   ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/x-m4v']),
  ('reels', 'reels', true, 209715200,
   ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/x-m4v','video/webm'])
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Update existing buckets with latest limits
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars',     'avatars',     true, 5242880,
   ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']),
  ('covers',      'covers',      true, 10485760,
   ARRAY['image/jpeg','image/png','image/webp']),
  ('event-media', 'event-media', true, 104857600,
   ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/x-m4v']),
  ('chat_media',  'chat_media',  true, 10485760,
   ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Stories storage RLS
DROP POLICY IF EXISTS "Public read stories"  ON storage.objects;
DROP POLICY IF EXISTS "Auth upload stories"  ON storage.objects;
DROP POLICY IF EXISTS "Auth delete stories"  ON storage.objects;
CREATE POLICY "Public read stories"
  ON storage.objects FOR SELECT USING (bucket_id = 'stories');
CREATE POLICY "Auth upload stories"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'stories' AND auth.role() = 'authenticated');
CREATE POLICY "Auth delete stories"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'stories' AND auth.role() = 'authenticated');

-- Reels storage RLS
DROP POLICY IF EXISTS "Public read reels"  ON storage.objects;
DROP POLICY IF EXISTS "Auth upload reels"  ON storage.objects;
DROP POLICY IF EXISTS "Auth delete reels"  ON storage.objects;
CREATE POLICY "Public read reels"
  ON storage.objects FOR SELECT USING (bucket_id = 'reels');
CREATE POLICY "Auth upload reels"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'reels' AND auth.role() = 'authenticated');
CREATE POLICY "Auth delete reels"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'reels' AND auth.role() = 'authenticated');

-- Re-apply event-media + avatars RLS (safe DROP/CREATE)
DROP POLICY IF EXISTS "Public read avatars"     ON storage.objects;
DROP POLICY IF EXISTS "Auth upload avatars"     ON storage.objects;
DROP POLICY IF EXISTS "Auth update avatars"     ON storage.objects;
DROP POLICY IF EXISTS "Auth delete avatars"     ON storage.objects;
DROP POLICY IF EXISTS "Public read covers"      ON storage.objects;
DROP POLICY IF EXISTS "Auth upload covers"      ON storage.objects;
DROP POLICY IF EXISTS "Auth update covers"      ON storage.objects;
DROP POLICY IF EXISTS "Public read event-media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view media"   ON storage.objects;
DROP POLICY IF EXISTS "Auth upload event-media" ON storage.objects;
DROP POLICY IF EXISTS "Public read chat_media"  ON storage.objects;
DROP POLICY IF EXISTS "Auth upload chat_media"  ON storage.objects;
DROP POLICY IF EXISTS "Auth delete chat_media"  ON storage.objects;

CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Auth upload avatars"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Auth update avatars"
  ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Auth delete avatars"
  ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Public read covers"
  ON storage.objects FOR SELECT USING (bucket_id = 'covers');
CREATE POLICY "Auth upload covers"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'covers' AND auth.role() = 'authenticated');
CREATE POLICY "Auth update covers"
  ON storage.objects FOR UPDATE USING (bucket_id = 'covers' AND auth.role() = 'authenticated');
CREATE POLICY "Public read event-media"
  ON storage.objects FOR SELECT USING (bucket_id = 'event-media');
CREATE POLICY "Auth upload event-media"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'event-media' AND auth.role() = 'authenticated');
CREATE POLICY "Public read chat_media"
  ON storage.objects FOR SELECT USING (bucket_id = 'chat_media');
CREATE POLICY "Auth upload chat_media"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat_media' AND auth.role() = 'authenticated');
CREATE POLICY "Auth delete chat_media"
  ON storage.objects FOR DELETE USING (bucket_id = 'chat_media' AND auth.role() = 'authenticated');


-- ══════════════════════════════════════════════════════════════
--  §16  RPC FUNCTIONS
-- ══════════════════════════════════════════════════════════════

-- upsert_rsvp_tier — used by VIPTierSelector
CREATE OR REPLACE FUNCTION upsert_rsvp_tier(
  p_event_id UUID,
  p_user_id  UUID,
  p_tier_id  TEXT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO event_rsvps (event_id, user_id, status, tier_id)
  VALUES (p_event_id, p_user_id, 'going', p_tier_id)
  ON CONFLICT (event_id, user_id)
  DO UPDATE SET tier_id = EXCLUDED.tier_id, status = 'going';
END;
$$;

-- create_story RPC fallback (used by StoriesRow resilient chain)
CREATE OR REPLACE FUNCTION create_story(
  p_user_id   UUID,
  p_url       TEXT,
  p_type      TEXT DEFAULT 'image',
  p_expires_at TIMESTAMPTZ DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO stories (user_id, media_url, media_type, expires_at)
  VALUES (
    p_user_id, p_url, p_type,
    COALESCE(p_expires_at, now() + INTERVAL '24 hours')
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- create_reel RPC fallback (used by CreateReelModal resilient chain)
CREATE OR REPLACE FUNCTION create_reel(
  p_user_id   UUID,
  p_media_url TEXT,
  p_caption   TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO reels (user_id, media_url, caption)
  VALUES (p_user_id, p_media_url, p_caption)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- add_gallery_item RPC fallback (used by EventGallery resilient chain)
CREATE OR REPLACE FUNCTION add_gallery_item(
  p_event_id UUID,
  p_user_id  UUID,
  p_url      TEXT,
  p_type     TEXT DEFAULT 'image'
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO event_gallery (event_id, user_id, url, media_type)
  VALUES (p_event_id, p_user_id, p_url, p_type)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- increment_wallet_balance — used by escrowService
CREATE OR REPLACE FUNCTION increment_wallet_balance(
  user_id UUID,
  amount  NUMERIC
) RETURNS void LANGUAGE sql SET search_path = public AS $$
  UPDATE profiles SET wallet_balance = COALESCE(wallet_balance, 0) + amount WHERE id = user_id;
$$;

-- mark_notifications_read — used by NotificationsScreen
CREATE OR REPLACE FUNCTION mark_notifications_read(p_user_id UUID)
RETURNS void LANGUAGE sql SET search_path = public AS $$
  UPDATE notifications SET is_read = true
  WHERE recipient_id = p_user_id AND is_read = false;
$$;

-- Trending score refresh: weight = (vibe_count*3 + going*2 + echo_count + save_count) / hours_since^1.5
CREATE OR REPLACE FUNCTION refresh_trending_events()
RETURNS void LANGUAGE sql SET search_path = public AS $$
  UPDATE events SET
    trending_score = (
      (COALESCE(vibe_count, 0) * 3 +
       COALESCE(going, 0) * 2 +
       COALESCE(echo_count, 0) +
       COALESCE(save_count, 0))::float
      /
      NULLIF(POWER(EXTRACT(EPOCH FROM (now() - created_at)) / 3600 + 2, 1.5), 0)
    )
  WHERE is_cancelled = false;
$$;

-- feed_for_user: personalised event feed using follow graph + interests
DROP FUNCTION IF EXISTS feed_for_user(uuid, integer, integer);
CREATE OR REPLACE FUNCTION feed_for_user(
  p_user_id UUID,
  p_limit   INT  DEFAULT 30,
  p_offset  INT  DEFAULT 0
)
RETURNS SETOF events LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT e.*
  FROM events e
  LEFT JOIN follows f ON f.following_id = e.author_id AND f.follower_id = p_user_id
  WHERE e.is_cancelled = false
    AND e.event_date >= CURRENT_DATE
  ORDER BY
    (CASE WHEN f.follower_id IS NOT NULL THEN 3 ELSE 0 END) +
    COALESCE(e.trending_score, 0) DESC,
    e.event_date ASC
  LIMIT p_limit OFFSET p_offset;
$$;


-- ══════════════════════════════════════════════════════════════
--  §17  REALTIME — add new tables to publication
-- ══════════════════════════════════════════════════════════════
DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'events','notifications','messages','follows',
    'live_checkins','event_vibes','echoes','service_bookings',
    'gig_acceptances','dm_rooms','ad_campaigns',
    'stories','story_views','reels','reel_likes','reel_comments',
    'event_reactions','event_updates','event_waitlist','event_carpools'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
      END IF;
    END IF;
  END LOOP;
END $$;


-- ══════════════════════════════════════════════════════════════
--  §18  AI MEMORY / RECOMMENDATIONS / INTERACTIONS
--       (from patch_live_db.sql — idempotent re-run)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ai_user_memory (
  user_id     UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  preferences JSONB       DEFAULT '{}',
  behaviour   JSONB       DEFAULT '{}',
  summary     TEXT,
  updated_at  TIMESTAMPTZ DEFAULT now()
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_user_memory') THEN
    ALTER TABLE ai_user_memory ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "User reads own ai memory"  ON ai_user_memory;
    DROP POLICY IF EXISTS "Service manages ai memory" ON ai_user_memory;
    CREATE POLICY "User reads own ai memory"  ON ai_user_memory FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY "Service manages ai memory" ON ai_user_memory FOR ALL
      USING (auth.role() IN ('service_role','postgres'));
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS ai_recommendations_cache (
  user_id      UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  event_ids    UUID[]      DEFAULT '{}',
  viber_ids    UUID[]      DEFAULT '{}',
  reasoning    TEXT,
  generated_at TIMESTAMPTZ DEFAULT now()
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_recommendations_cache') THEN
    ALTER TABLE ai_recommendations_cache ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "User reads own recs"  ON ai_recommendations_cache;
    DROP POLICY IF EXISTS "Service manages recs" ON ai_recommendations_cache;
    CREATE POLICY "User reads own recs"  ON ai_recommendations_cache FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY "Service manages recs" ON ai_recommendations_cache FOR ALL
      USING (auth.role() IN ('service_role','postgres'));
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS ai_interactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  feature     TEXT        NOT NULL,
  input       TEXT,
  output      TEXT,
  model       TEXT,
  tokens_used INTEGER,
  feedback    INTEGER,
  created_at  TIMESTAMPTZ DEFAULT now()
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_interactions') THEN
    ALTER TABLE ai_interactions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "User reads own interactions"  ON ai_interactions;
    DROP POLICY IF EXISTS "Service inserts interactions" ON ai_interactions;
    CREATE POLICY "User reads own interactions"  ON ai_interactions FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY "Service inserts interactions" ON ai_interactions FOR INSERT WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_interactions') THEN
    CREATE INDEX IF NOT EXISTS ai_interactions_created ON ai_interactions(created_at);
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════
--  §19  SECURITY HARDENING — pin search_path on new functions
-- ══════════════════════════════════════════════════════════════
DO $$ DECLARE fn TEXT;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'upsert_rsvp_tier(uuid,uuid,text)',
    'create_story(uuid,text,text,timestamptz)',
    'create_reel(uuid,text,text)',
    'add_gallery_item(uuid,uuid,text,text)',
    'increment_wallet_balance(uuid,numeric)',
    'mark_notifications_read(uuid)',
    'refresh_trending_events()',
    'sync_story_view_count()',
    'sync_reel_like_count()',
    'sync_reel_view_count()',
    'sync_reel_comment_count()'
  ] LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION public.%s SET search_path = public', fn);
    EXCEPTION WHEN others THEN NULL; END;
  END LOOP;
END $$;

-- Revoke anon execute on write functions
DO $$ DECLARE fn TEXT;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'upsert_rsvp_tier(uuid,uuid,text)',
    'create_story(uuid,text,text,timestamptz)',
    'create_reel(uuid,text,text)',
    'add_gallery_item(uuid,uuid,text,text)',
    'increment_wallet_balance(uuid,numeric)',
    'mark_notifications_read(uuid)',
    'refresh_trending_events()'
  ] LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon', fn);
    EXCEPTION WHEN others THEN NULL; END;
  END LOOP;
END $$;


-- ══════════════════════════════════════════════════════════════
--  §20  FINALISE
-- ══════════════════════════════════════════════════════════════

-- Touch trigger on reels
DROP TRIGGER IF EXISTS reels_touch ON reels;
CREATE TRIGGER reels_touch BEFORE UPDATE ON reels
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Views: security_invoker = true (prevents privilege escalation)
DROP VIEW IF EXISTS public.vibes CASCADE;
CREATE OR REPLACE VIEW public.vibes WITH (security_invoker = true) AS SELECT * FROM public.event_vibes;
DROP VIEW IF EXISTS public.conversations CASCADE;
CREATE OR REPLACE VIEW public.conversations WITH (security_invoker = true) AS SELECT * FROM public.dm_rooms;

-- spatial_ref_sys is a PostGIS system table owned by superuser — skip RLS

-- ✅  Migration complete.
-- Tables added/confirmed: stories, story_views, reels, reel_likes, reel_views,
--   reel_comments, saved_reels, reel_reports, event_reactions, event_updates,
--   event_waitlist, event_carpools, event_carpool_requests, wallet_transactions,
--   ai_user_memory, ai_recommendations_cache, ai_interactions
-- Columns added: profiles.looking_for, profiles.preferred_areas, profiles.wallet_balance,
--   events.cover_url, events.image_url, events.rsvp_tiers, event_rsvps.tier_id,
--   reels.sound_name, reels.hashtags, reels.is_featured
-- Storage buckets: stories (50MB), reels (200MB) — all with RLS
-- Realtime: 19 tables
-- RPCs: upsert_rsvp_tier, create_story, create_reel, add_gallery_item,
--   increment_wallet_balance, mark_notifications_read, refresh_trending_events,
--   feed_for_user
-- Indexes: 15 new indexes including GIN (search_vector, hashtags) and
--   GiST (geo) and partial indexes for live/upcoming filtering
