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

CREATE INDEX IF NOT EXISTS paths_user_id_idx  ON paths(user_id);
CREATE INDEX IF NOT EXISTS paths_event_id_idx ON paths(event_id);
CREATE INDEX IF NOT EXISTS paths_dest_lat_idx ON paths(dest_lat);
CREATE INDEX IF NOT EXISTS paths_dest_lon_idx ON paths(dest_lon);

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

CREATE INDEX IF NOT EXISTS live_checkins_event_idx   ON live_checkins(event_id);
CREATE INDEX IF NOT EXISTS live_checkins_expires_idx ON live_checkins(expires_at);

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

CREATE INDEX IF NOT EXISTS service_nodes_provider_idx ON service_nodes(provider_id);
CREATE INDEX IF NOT EXISTS service_nodes_type_idx     ON service_nodes(service_type);
CREATE INDEX IF NOT EXISTS service_nodes_lat_idx      ON service_nodes(lat);
CREATE INDEX IF NOT EXISTS service_nodes_lon_idx      ON service_nodes(lon);

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

CREATE INDEX IF NOT EXISTS bookings_client_idx   ON service_bookings(client_id);
CREATE INDEX IF NOT EXISTS bookings_provider_idx ON service_bookings(provider_id);
CREATE INDEX IF NOT EXISTS bookings_status_idx   ON service_bookings(status);

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

CREATE INDEX IF NOT EXISTS gig_posts_event_idx    ON gig_posts(event_id);
CREATE INDEX IF NOT EXISTS gig_posts_active_idx   ON gig_posts(active);

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

CREATE INDEX IF NOT EXISTS dm_rooms_user_a_idx ON dm_rooms(user_a);
CREATE INDEX IF NOT EXISTS dm_rooms_user_b_idx ON dm_rooms(user_b);
CREATE INDEX IF NOT EXISTS dm_messages_room_idx ON dm_messages(room_id);

-- ── User Paths (alias for paths, referenced by PathMapScreen) ─────────────────
-- user_paths is a view over the paths table for convenience
CREATE OR REPLACE VIEW user_paths AS
  SELECT * FROM paths;

-- ── Trust Ledger RPC ──────────────────────────────────────────────────────────

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
ALTER TABLE service_bookings ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE dm_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY dm_rooms_parties   ON dm_rooms    FOR ALL    USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY dm_messages_sender ON dm_messages FOR INSERT USING (auth.uid() = sender_id);
CREATE POLICY dm_messages_select ON dm_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM dm_rooms r WHERE r.id = room_id AND (r.user_a = auth.uid() OR r.user_b = auth.uid())
  ));
