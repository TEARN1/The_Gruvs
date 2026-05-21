      USING (EXISTS (SELECT 1 FROM business_profiles bp WHERE bp.id = business_id AND bp.user_id = auth.uid()));
  END IF;
END $$;
-- ============================================================
--  AD CAMPAIGNS  (app uses "ad_campaigns")
-- ============================================================
-- Rename campaigns → ad_campaigns if needed
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='campaigns')
  AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ad_campaigns') THEN
    ALTER TABLE campaigns RENAME TO ad_campaigns;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ad_campaigns (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID        REFERENCES business_profiles(id) ON DELETE CASCADE,
  user_id      UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  type         TEXT        DEFAULT 'awareness',
  status       TEXT        DEFAULT 'draft' CHECK (status IN ('draft','active','paused','ended')),
  budget       NUMERIC     DEFAULT 0,
  spent        NUMERIC     DEFAULT 0,
  reach        INTEGER     DEFAULT 0,
  clicks       INTEGER     DEFAULT 0,
  conversions  INTEGER     DEFAULT 0,
  target       JSONB       DEFAULT '{}',
  creative     JSONB       DEFAULT '{}',
  starts_at    TIMESTAMPTZ,
  ends_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ad_campaigns') THEN
    ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS business_id  UUID REFERENCES business_profiles(id) ON DELETE CASCADE;
    ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS title        TEXT;
    ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS type         TEXT DEFAULT 'awareness';
    ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS status       TEXT DEFAULT 'draft';
    ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS budget       NUMERIC DEFAULT 0;
    ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS spent        NUMERIC DEFAULT 0;
    ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS reach        INTEGER DEFAULT 0;
    ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS clicks       INTEGER DEFAULT 0;
    ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS conversions  INTEGER DEFAULT 0;
    ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS target       JSONB DEFAULT '{}';
    ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS creative     JSONB DEFAULT '{}';
    ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS starts_at    TIMESTAMPTZ;
    ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS ends_at      TIMESTAMPTZ;
    ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ad_campaigns') THEN
    CREATE INDEX IF NOT EXISTS ad_campaigns_business_id ON ad_campaigns(business_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ad_campaigns') THEN
    CREATE INDEX IF NOT EXISTS ad_campaigns_status      ON ad_campaigns(status);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ad_campaigns') THEN
    ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Campaigns owner only" ON ad_campaigns;
    CREATE POLICY "Campaigns owner only" ON ad_campaigns FOR ALL
      USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM business_profiles bp WHERE bp.id = business_id AND bp.user_id = auth.uid()
      ));
  END IF;
END $$;
DROP TRIGGER IF EXISTS ad_campaigns_touch ON ad_campaigns;
CREATE TRIGGER ad_campaigns_touch BEFORE UPDATE ON ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Compat alias
DROP VIEW IF EXISTS campaigns;
CREATE OR REPLACE VIEW campaigns AS SELECT * FROM ad_campaigns;

-- Campaign analytics
CREATE TABLE IF NOT EXISTS campaign_analytics (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID        NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL CHECK (event_type IN ('impression','click','conversion','skip')),
  user_id     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  metadata    JSONB       DEFAULT '{}',
  recorded_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'campaign_analytics') THEN
    ALTER TABLE campaign_analytics ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE CASCADE;
    ALTER TABLE campaign_analytics ADD COLUMN IF NOT EXISTS event_type  TEXT;
    ALTER TABLE campaign_analytics ADD COLUMN IF NOT EXISTS user_id     UUID REFERENCES profiles(id) ON DELETE SET NULL;
    ALTER TABLE campaign_analytics ADD COLUMN IF NOT EXISTS metadata    JSONB DEFAULT '{}';
    ALTER TABLE campaign_analytics ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'campaign_analytics') THEN
    CREATE INDEX IF NOT EXISTS campaign_analytics_campaign ON campaign_analytics(campaign_id, recorded_at DESC);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'campaign_analytics') THEN
    CREATE INDEX IF NOT EXISTS campaign_analytics_type     ON campaign_analytics(event_type);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'campaign_analytics') THEN
    ALTER TABLE campaign_analytics ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Campaign analytics owner only" ON campaign_analytics;
    CREATE POLICY "Campaign analytics owner only" ON campaign_analytics FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM ad_campaigns c
        JOIN business_profiles bp ON bp.id = c.business_id
        WHERE c.id = campaign_id AND bp.user_id = auth.uid()
      ));
    DROP POLICY IF EXISTS "System inserts campaign analytics" ON campaign_analytics;
    CREATE POLICY "System inserts campaign analytics" ON campaign_analytics FOR INSERT WITH CHECK (true);
  END IF;
END $$;
-- Audience segments
CREATE TABLE IF NOT EXISTS audience_segments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID        NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  criteria    JSONB       DEFAULT '{}',
  size        INTEGER     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audience_segments') THEN
    ALTER TABLE audience_segments ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE;
    ALTER TABLE audience_segments ADD COLUMN IF NOT EXISTS name        TEXT;
    ALTER TABLE audience_segments ADD COLUMN IF NOT EXISTS criteria    JSONB DEFAULT '{}';
    ALTER TABLE audience_segments ADD COLUMN IF NOT EXISTS size        INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audience_segments') THEN
    ALTER TABLE audience_segments ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Segments owner only" ON audience_segments;
    CREATE POLICY "Segments owner only" ON audience_segments FOR ALL
      USING (EXISTS (SELECT 1 FROM business_profiles bp WHERE bp.id = business_id AND bp.user_id = auth.uid()));
  END IF;
END $$;
-- ============================================================
--  CONTEXTUAL ADS  (AdFlywheel)
-- ============================================================
CREATE TABLE IF NOT EXISTS contextual_ads (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT        NOT NULL CHECK (type IN ('event','service','gig')),
  headline   TEXT        NOT NULL,
  subline    TEXT,
  cta        TEXT        DEFAULT 'View',
  badge      TEXT        DEFAULT 'PROMOTED',
  icon       TEXT        DEFAULT 'zap',
  color      TEXT        DEFAULT '#00f2ff',
  event_id   UUID        REFERENCES events(id) ON DELETE SET NULL,
  priority   INTEGER     DEFAULT 0,
  active     BOOLEAN     DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'contextual_ads') THEN
    ALTER TABLE contextual_ads ADD COLUMN IF NOT EXISTS type     TEXT DEFAULT 'event';
    ALTER TABLE contextual_ads ADD COLUMN IF NOT EXISTS headline TEXT;
    ALTER TABLE contextual_ads ADD COLUMN IF NOT EXISTS subline  TEXT;
    ALTER TABLE contextual_ads ADD COLUMN IF NOT EXISTS cta      TEXT DEFAULT 'View';
    ALTER TABLE contextual_ads ADD COLUMN IF NOT EXISTS badge    TEXT DEFAULT 'PROMOTED';
    ALTER TABLE contextual_ads ADD COLUMN IF NOT EXISTS icon     TEXT DEFAULT 'zap';
    ALTER TABLE contextual_ads ADD COLUMN IF NOT EXISTS color    TEXT DEFAULT '#00f2ff';
    ALTER TABLE contextual_ads ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;
    ALTER TABLE contextual_ads ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;
    ALTER TABLE contextual_ads ADD COLUMN IF NOT EXISTS active   BOOLEAN DEFAULT true;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'contextual_ads') THEN
    CREATE INDEX IF NOT EXISTS contextual_ads_active ON contextual_ads(active, priority DESC);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'contextual_ads') THEN
    ALTER TABLE contextual_ads ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Ads readable" ON contextual_ads;
    CREATE POLICY "Ads readable" ON contextual_ads FOR SELECT USING (active = true);
  END IF;
END $$;
-- ============================================================
--  RPC FUNCTIONS
-- ============================================================

-- Full-text event search
CREATE OR REPLACE FUNCTION search_events_fts(search_query TEXT, limit_count INT DEFAULT 20)
RETURNS SETOF events LANGUAGE sql STABLE AS $$
  SELECT * FROM events
  WHERE search_vector @@ plainto_tsquery('english', search_query)
    AND is_cancelled = false
  ORDER BY ts_rank(search_vector, plainto_tsquery('english', search_query)) DESC,
           trending_score DESC NULLS LAST
  LIMIT limit_count;
$$;

-- Find nearby events by lat/lon
CREATE OR REPLACE FUNCTION find_nearby_events(lat FLOAT, lon FLOAT, radius_km FLOAT DEFAULT 25, limit_count INT DEFAULT 20)
RETURNS TABLE (
  id UUID, title TEXT, category TEXT, category_color TEXT,
  event_date DATE, event_time TEXT, venue_name TEXT,
  vibe_count INT, going INT, media JSONB, media_urls TEXT[],
  author_id UUID, is_cancelled BOOLEAN, lat FLOAT, lon FLOAT,
  distance_km FLOAT
) LANGUAGE sql STABLE AS $$
  SELECT
    e.id, e.title, e.category, e.category_color,
    e.event_date, e.event_time, e.venue_name,
    e.vibe_count, e.going, e.media, e.media_urls,
    e.author_id, e.is_cancelled, e.lat, e.lon,
    ST_DistanceSphere(
      ST_MakePoint(e.lon, e.lat),
      ST_MakePoint(lon, lat)
    ) / 1000 AS distance_km
  FROM events e
  WHERE e.lat IS NOT NULL AND e.lon IS NOT NULL
    AND e.is_cancelled = false
    AND ST_DistanceSphere(ST_MakePoint(e.lon, e.lat), ST_MakePoint(lon, lat)) <= radius_km * 1000
  ORDER BY distance_km ASC, e.trending_score DESC NULLS LAST
  LIMIT limit_count;
$$;

-- Find nearby vibers
CREATE OR REPLACE FUNCTION find_nearby_vibers(uid UUID, max_dist_km FLOAT DEFAULT 10, limit_count INT DEFAULT 20)
RETURNS TABLE (
  id UUID, username TEXT, avatar_url TEXT, vibe_score INT,
  is_online BOOLEAN, interests TEXT[], lat FLOAT, lon FLOAT,
  distance_km FLOAT
) LANGUAGE sql STABLE AS $$
  SELECT
    p.id, p.username, p.avatar_url, p.vibe_score,
    p.is_online, p.interests, p.lat, p.lon,
    ST_DistanceSphere(
      ST_MakePoint(p.lon, p.lat),
      ST_MakePoint(me.lon, me.lat)
    ) / 1000 AS distance_km
  FROM profiles p
  JOIN profiles me ON me.id = uid
  WHERE p.id <> uid
    AND p.lat IS NOT NULL AND p.lon IS NOT NULL
    AND me.lat IS NOT NULL AND me.lon IS NOT NULL
    AND ST_DistanceSphere(ST_MakePoint(p.lon, p.lat), ST_MakePoint(me.lon, me.lat)) <= max_dist_km * 1000
  ORDER BY distance_km ASC
  LIMIT limit_count;
$$;

-- Find popular spots (trending event venues/locations)
CREATE OR REPLACE FUNCTION find_popular_spots(limit_count INT DEFAULT 10)
RETURNS TABLE (
  event_id UUID, title TEXT, description TEXT, image TEXT,
  vibe_count INT, rsvp_count INT, going INT, category TEXT
) LANGUAGE sql STABLE AS $$
  SELECT
    e.id AS event_id, e.title,
    e.description,
    COALESCE(e.media_urls[1], (e.media->0->>'url')::text) AS image,
    e.vibe_count, e.going AS rsvp_count, e.going, e.category
  FROM events e
  WHERE e.is_cancelled = false
  ORDER BY e.trending_score DESC NULLS LAST, e.vibe_count DESC
  LIMIT limit_count;
$$;

-- Find Gruv hotspots (clusters of events near a point)
CREATE OR REPLACE FUNCTION find_gruv_hotspots(lat FLOAT, lon FLOAT, radius_km FLOAT DEFAULT 5, limit_count INT DEFAULT 10)
RETURNS TABLE (
  id UUID, title TEXT, vibe_count INT, going INT,
  lat FLOAT, lon FLOAT, category TEXT, distance_km FLOAT
) LANGUAGE sql STABLE AS $$
  SELECT
    e.id, e.title, e.vibe_count, e.going,
    e.lat, e.lon, e.category,
    ST_DistanceSphere(ST_MakePoint(e.lon, e.lat), ST_MakePoint(lon, lat)) / 1000 AS distance_km
  FROM events e
  WHERE e.lat IS NOT NULL AND e.lon IS NOT NULL
    AND e.is_cancelled = false
    AND ST_DistanceSphere(ST_MakePoint(e.lon, e.lat), ST_MakePoint(lon, lat)) <= radius_km * 1000
  ORDER BY e.vibe_count DESC, distance_km ASC
  LIMIT limit_count;
$$;

-- Increment / decrement vibe_count (used by VibeManager to avoid race conditions)
CREATE OR REPLACE FUNCTION increment_vibe_count(eid UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE events SET vibe_count = vibe_count + 1 WHERE id = eid;
$$;

CREATE OR REPLACE FUNCTION decrement_vibe_count(eid UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE events SET vibe_count = greatest(0, vibe_count - 1) WHERE id = eid;
$$;

-- Increment profile vibe score
CREATE OR REPLACE FUNCTION increment_profile_score(uid UUID, amount INT DEFAULT 1)
RETURNS void LANGUAGE sql AS $$
  UPDATE profiles SET vibe_score = vibe_score + amount WHERE id = uid;
$$;

-- Increment wallet balance (used by EscrowService after release)
CREATE OR REPLACE FUNCTION increment_wallet_balance(user_id UUID, amount NUMERIC)
RETURNS void LANGUAGE sql AS $$
  UPDATE profiles SET wallet_balance = COALESCE(wallet_balance, 0) + amount WHERE id = user_id;
$$;


-- ============================================================
--  APP UPDATES (changelog — admin inserts, all users can read)
-- ============================================================
CREATE TABLE IF NOT EXISTS app_updates (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version      TEXT        NOT NULL,
  title        TEXT        NOT NULL,
  description  TEXT,
  type         TEXT        NOT NULL DEFAULT 'feature' CHECK (type IN ('feature','fix','improvement','security')),
  released_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'app_updates') THEN
    ALTER TABLE app_updates ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Anyone can read app_updates" ON app_updates;
  END IF;
END $$;
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
