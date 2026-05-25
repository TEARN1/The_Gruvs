-- ============================================================
--  THE GRUVS — 02: PART 2 (Movement OS)
--  paths, live presence TTL, path crossings, path stars,
--  service nodes (bakkie marketplace), service bookings,
--  disputes, gig posts, gig acceptances, dm rooms/messages,
--  contextual ads, new event features, live DB patch
-- ============================================================

-- ── PATHS (Movement OS) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.paths (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id       UUID REFERENCES public.events(id) ON DELETE SET NULL,
  origin_lat     FLOAT,
  origin_lon     FLOAT,
  origin_label   TEXT,
  dest_lat       FLOAT,
  dest_lon       FLOAT,
  dest_label     TEXT,
  intent_tag     TEXT DEFAULT 'attending'
    CHECK (intent_tag IN ('attending','going_home','service_run','exploring','scouting')),
  identity_layer TEXT DEFAULT 'public'
    CHECK (identity_layer IN ('public','ghost','celebrity')),
  ghost_alias    TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.paths ADD COLUMN IF NOT EXISTS event_id       UUID REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE public.paths ADD COLUMN IF NOT EXISTS origin_lat     FLOAT;
ALTER TABLE public.paths ADD COLUMN IF NOT EXISTS origin_lon     FLOAT;
ALTER TABLE public.paths ADD COLUMN IF NOT EXISTS origin_label   TEXT;
ALTER TABLE public.paths ADD COLUMN IF NOT EXISTS dest_lat       FLOAT;
ALTER TABLE public.paths ADD COLUMN IF NOT EXISTS dest_lon       FLOAT;
ALTER TABLE public.paths ADD COLUMN IF NOT EXISTS dest_label     TEXT;
ALTER TABLE public.paths ADD COLUMN IF NOT EXISTS intent_tag     TEXT DEFAULT 'attending';
ALTER TABLE public.paths ADD COLUMN IF NOT EXISTS identity_layer TEXT DEFAULT 'public';
ALTER TABLE public.paths ADD COLUMN IF NOT EXISTS ghost_alias    TEXT;

CREATE INDEX IF NOT EXISTS idx_paths_user    ON public.paths(user_id);
CREATE INDEX IF NOT EXISTS idx_paths_event   ON public.paths(event_id);
CREATE INDEX IF NOT EXISTS idx_paths_dest    ON public.paths(dest_lat, dest_lon);

-- ── PATH CROSSINGS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.path_crossings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id_a     UUID NOT NULL REFERENCES public.paths(id) ON DELETE CASCADE,
  path_id_b     UUID NOT NULL REFERENCES public.paths(id) ON DELETE CASCADE,
  overlap_score FLOAT DEFAULT 0,
  crossed_at    TIMESTAMPTZ DEFAULT now()
);

-- ── PATH STARS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.path_stars (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  path_id    UUID REFERENCES public.paths(id) ON DELETE CASCADE,
  place_name TEXT,
  lat        FLOAT,
  lon        FLOAT,
  starred_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, path_id)
);

-- user_paths view for PathMapScreen
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'user_paths' AND c.relkind = 'r') THEN
    DROP TABLE public.user_paths CASCADE;
  END IF;
END $$;
CREATE OR REPLACE VIEW public.user_paths AS SELECT * FROM public.paths;

-- ── SERVICE NODES (Bakkie Marketplace) ───────────────────────
CREATE TABLE IF NOT EXISTS public.service_nodes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title        TEXT,
  name         TEXT,
  description  TEXT,
  service_type TEXT CHECK (service_type IN ('moving','delivery','event_logistics','rides')),
  vehicle_type TEXT,
  capacity_kg  INTEGER,
  price        NUMERIC(10,2),
  price_per_km NUMERIC(8,2),
  base_price   NUMERIC(8,2),
  price_min    NUMERIC,
  price_max    NUMERIC,
  location     TEXT,
  lat          DOUBLE PRECISION,
  lon          DOUBLE PRECISION,
  is_active    BOOLEAN DEFAULT true,
  available    BOOLEAN DEFAULT true,
  event_id     UUID REFERENCES public.events(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS event_id     UUID REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS provider_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS title        TEXT;
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS name         TEXT;
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS vehicle_type TEXT;
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS capacity_kg  INTEGER;
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS price        NUMERIC(10,2);
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS price_per_km NUMERIC(8,2);
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS base_price   NUMERIC(8,2);
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS price_min    NUMERIC;
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS price_max    NUMERIC;
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS is_active    BOOLEAN DEFAULT true;
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS available    BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_service_nodes_user     ON public.service_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_service_nodes_type     ON public.service_nodes(service_type);
CREATE INDEX IF NOT EXISTS idx_service_nodes_location ON public.service_nodes(lat, lon);

-- ── SERVICE BOOKINGS (Escrow) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.service_bookings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_node_id  UUID NOT NULL REFERENCES public.service_nodes(id) ON DELETE CASCADE,
  client_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cargo_type       TEXT,
  pickup_address   TEXT,
  dropoff_address  TEXT,
  scheduled_at     TIMESTAMPTZ,
  estimated_price  NUMERIC(10,2),
  amount_cents     INTEGER,
  status           TEXT NOT NULL DEFAULT 'escrow_held'
    CHECK (status IN ('escrow_held','in_progress','completed','disputed','cancelled')),
  escrow_held_at   TIMESTAMPTZ DEFAULT now(),
  completed_at     TIMESTAMPTZ,
  disputed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bookings_client   ON public.service_bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_provider ON public.service_bookings(provider_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status   ON public.service_bookings(status);

CREATE TABLE IF NOT EXISTS public.service_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES public.service_bookings(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── DISPUTES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.disputes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.service_bookings(id) ON DELETE CASCADE,
  filed_by   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason     TEXT,
  status     TEXT DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── GIG POSTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gig_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  poster_id   UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id    UUID REFERENCES public.events(id) ON DELETE SET NULL,
  title       TEXT,
  description TEXT,
  category    TEXT CHECK (category IN ('moving','assembly','packing','crew','other')),
  pay         NUMERIC,
  pay_rands   NUMERIC,
  pay_amount  NUMERIC(8,2),
  time_window TEXT DEFAULT 'Flexible',
  lat         FLOAT,
  lon         FLOAT,
  slots       INTEGER DEFAULT 1,
  filled      INTEGER DEFAULT 0,
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gig_posts_event  ON public.gig_posts(event_id);
CREATE INDEX IF NOT EXISTS idx_gig_posts_active ON public.gig_posts(active);

CREATE TABLE IF NOT EXISTS public.gig_acceptances (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id     UUID NOT NULL REFERENCES public.gig_posts(id) ON DELETE CASCADE,
  worker_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ DEFAULT now(),
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gig_acceptances_worker
  ON public.gig_acceptances(gig_id, worker_id) WHERE worker_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_gig_acceptances_user
  ON public.gig_acceptances(gig_id, user_id) WHERE user_id IS NOT NULL AND worker_id IS NULL;

-- ── DM ROOMS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dm_rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES public.events(id) ON DELETE SET NULL,
  participant_ids UUID[],
  last_message    TEXT,
  last_message_at TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_a, user_b, event_id)
);
ALTER TABLE public.dm_rooms ADD COLUMN IF NOT EXISTS event_id        UUID REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE public.dm_rooms ADD COLUMN IF NOT EXISTS participant_ids UUID[];
ALTER TABLE public.dm_rooms ADD COLUMN IF NOT EXISTS last_message    TEXT;
ALTER TABLE public.dm_rooms ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;
ALTER TABLE public.dm_rooms ADD COLUMN IF NOT EXISTS expires_at      TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_dm_rooms_user_a ON public.dm_rooms(user_a);
CREATE INDEX IF NOT EXISTS idx_dm_rooms_user_b ON public.dm_rooms(user_b);

CREATE TABLE IF NOT EXISTS public.dm_messages (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id   UUID NOT NULL REFERENCES public.dm_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body      TEXT NOT NULL,
  sent_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dm_messages_room ON public.dm_messages(room_id, sent_at DESC);

-- ── CONTEXTUAL ADS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contextual_ads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT DEFAULT 'event' CHECK (type IN ('event','service','gig')),
  headline    TEXT,
  subline     TEXT,
  cta         TEXT DEFAULT 'View',
  color       TEXT,
  icon        TEXT DEFAULT 'zap',
  badge       TEXT DEFAULT 'PROMOTED',
  event_id    UUID REFERENCES public.events(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.ad_campaigns(id) ON DELETE SET NULL,
  priority    INTEGER DEFAULT 0,
  position    TEXT,
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contextual_ads_active ON public.contextual_ads(active, priority DESC);

-- ── WALLET TRANSACTIONS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount     NUMERIC(10,2) NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('credit','debit','escrow','release','refund')),
  reference  TEXT,
  meta       JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── EVENT UPDATES (organiser live posts) ─────────────────────
CREATE TABLE IF NOT EXISTS public.event_updates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  update_type TEXT DEFAULT 'info' CHECK (update_type IN ('info','hype','change','shoutout')),
  media_url   TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── EVENT WAITLIST ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_waitlist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- ── EVENT CARPOOLS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_carpools (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  driver_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seats_available  INTEGER DEFAULT 3 CHECK (seats_available BETWEEN 1 AND 10),
  departure_area   TEXT,
  pickup_address   TEXT,
  pickup_lat       DOUBLE PRECISION,
  pickup_lon       DOUBLE PRECISION,
  departure_time   TIMESTAMPTZ,
  note             TEXT,
  return_trip      BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_carpool_requests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carpool_id UUID NOT NULL REFERENCES public.event_carpools(id) ON DELETE CASCADE,
  event_id   UUID REFERENCES public.events(id) ON DELETE CASCADE,
  rider_id   UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status     TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ecr_carpool ON public.event_carpool_requests(carpool_id);

-- ── RPCs ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_sis_score(p_user_id UUID, p_delta INT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles
  SET social_integrity_score = GREATEST(0, LEAST(100, COALESCE(social_integrity_score,50) + p_delta))
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_wallet_balance(p_user_id UUID, p_amount NUMERIC)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance,0) + p_amount WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_expired_checkins()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  DELETE FROM public.live_checkins WHERE expires_at IS NOT NULL AND expires_at < NOW();
$$;

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.paths              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.path_crossings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.path_stars         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_nodes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_bookings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_reviews    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_posts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_acceptances    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_rooms           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contextual_ads     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_updates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_waitlist     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_carpools     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_carpool_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "paths_owner"  ON public.paths;
DROP POLICY IF EXISTS "paths_public" ON public.paths;
CREATE POLICY "paths_owner"  ON public.paths FOR ALL    USING (auth.uid() = user_id);
CREATE POLICY "paths_public" ON public.paths FOR SELECT USING (identity_layer = 'public');

DROP POLICY IF EXISTS "path_stars_own"     ON public.path_stars;
CREATE POLICY "path_stars_own"     ON public.path_stars    FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "path_crossings_own" ON public.path_crossings;
CREATE POLICY "path_crossings_own" ON public.path_crossings FOR SELECT USING (true);

DROP POLICY IF EXISTS "service_nodes_select" ON public.service_nodes;
DROP POLICY IF EXISTS "service_nodes_manage" ON public.service_nodes;
CREATE POLICY "service_nodes_select" ON public.service_nodes FOR SELECT USING (available = true OR is_active = true);
CREATE POLICY "service_nodes_manage" ON public.service_nodes FOR ALL
  USING (user_id = auth.uid() OR provider_id = auth.uid());

DROP POLICY IF EXISTS "service_bookings_manage" ON public.service_bookings;
CREATE POLICY "service_bookings_manage" ON public.service_bookings FOR ALL
  USING (client_id = auth.uid() OR provider_id = auth.uid());

DROP POLICY IF EXISTS "service_reviews_select" ON public.service_reviews;
DROP POLICY IF EXISTS "service_reviews_manage" ON public.service_reviews;
CREATE POLICY "service_reviews_select" ON public.service_reviews FOR SELECT USING (true);
CREATE POLICY "service_reviews_manage" ON public.service_reviews FOR ALL USING (reviewer_id = auth.uid());

DROP POLICY IF EXISTS "disputes_manage" ON public.disputes;
CREATE POLICY "disputes_manage" ON public.disputes FOR ALL USING (filed_by = auth.uid());

DROP POLICY IF EXISTS "gigs_readable"   ON public.gig_posts;
DROP POLICY IF EXISTS "gigs_manage_own" ON public.gig_posts;
CREATE POLICY "gigs_readable"   ON public.gig_posts FOR SELECT USING (active = true);
CREATE POLICY "gigs_manage_own" ON public.gig_posts FOR ALL
  USING (user_id = auth.uid() OR poster_id = auth.uid());

DROP POLICY IF EXISTS "gig_acceptances_manage" ON public.gig_acceptances;
CREATE POLICY "gig_acceptances_manage" ON public.gig_acceptances FOR ALL
  USING (user_id = auth.uid() OR worker_id = auth.uid());

DROP POLICY IF EXISTS "dm_rooms_manage"   ON public.dm_rooms;
CREATE POLICY "dm_rooms_manage" ON public.dm_rooms FOR ALL
  USING (user_a = auth.uid() OR user_b = auth.uid() OR participant_ids @> ARRAY[auth.uid()]);

DROP POLICY IF EXISTS "dm_messages_insert" ON public.dm_messages;
DROP POLICY IF EXISTS "dm_messages_select" ON public.dm_messages;
CREATE POLICY "dm_messages_insert" ON public.dm_messages FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY "dm_messages_select" ON public.dm_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.dm_rooms r WHERE r.id = room_id
    AND (r.user_a = auth.uid() OR r.user_b = auth.uid()
      OR r.participant_ids @> ARRAY[auth.uid()])));

DROP POLICY IF EXISTS "contextual_ads_select" ON public.contextual_ads;
CREATE POLICY "contextual_ads_select" ON public.contextual_ads FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "wallet_own" ON public.wallet_transactions;
CREATE POLICY "wallet_own" ON public.wallet_transactions FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "updates_select" ON public.event_updates;
DROP POLICY IF EXISTS "updates_insert" ON public.event_updates;
CREATE POLICY "updates_select" ON public.event_updates FOR SELECT USING (true);
CREATE POLICY "updates_insert" ON public.event_updates FOR INSERT
  WITH CHECK (author_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid()
  ));

DROP POLICY IF EXISTS "waitlist_select" ON public.event_waitlist;
DROP POLICY IF EXISTS "waitlist_manage" ON public.event_waitlist;
CREATE POLICY "waitlist_select" ON public.event_waitlist FOR SELECT USING (true);
CREATE POLICY "waitlist_manage" ON public.event_waitlist FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "carpools_select" ON public.event_carpools;
DROP POLICY IF EXISTS "carpools_manage" ON public.event_carpools;
CREATE POLICY "carpools_select" ON public.event_carpools FOR SELECT USING (true);
CREATE POLICY "carpools_manage" ON public.event_carpools FOR ALL USING (driver_id = auth.uid());

DROP POLICY IF EXISTS "carpool_requests_select" ON public.event_carpool_requests;
DROP POLICY IF EXISTS "carpool_requests_manage" ON public.event_carpool_requests;
CREATE POLICY "carpool_requests_select" ON public.event_carpool_requests FOR SELECT USING (true);
CREATE POLICY "carpool_requests_manage" ON public.event_carpool_requests FOR ALL
  USING (rider_id = auth.uid() OR user_id = auth.uid());
