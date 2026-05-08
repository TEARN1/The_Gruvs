-- ============================================================
-- The Gruvs: Business Profile & Ad Engine Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Business profiles
CREATE TABLE IF NOT EXISTS business_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  business_name   TEXT NOT NULL,
  business_type   TEXT,
  tagline         TEXT,
  description     TEXT,
  logo_url        TEXT,
  cover_url       TEXT,
  primary_color   TEXT DEFAULT '#00f2ff',
  accent_color    TEXT DEFAULT '#8b5cf6',
  verified        BOOLEAN DEFAULT false,
  tier            TEXT DEFAULT 'starter',  -- starter | pro | royal | enterprise
  store_enabled   BOOLEAN DEFAULT false,
  store_slug      TEXT UNIQUE,
  store_config    JSONB DEFAULT '{}',
  website         TEXT,
  phone           TEXT,
  email           TEXT,
  location        TEXT,
  total_revenue   NUMERIC DEFAULT 0,
  follower_count  INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Business storefront page blocks
CREATE TABLE IF NOT EXISTS business_page_blocks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
  block_type    TEXT NOT NULL,
  position      INTEGER DEFAULT 0,
  config        JSONB DEFAULT '{}',
  visible       BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Ad campaigns
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id          UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  status               TEXT DEFAULT 'draft',  -- draft | active | paused | ended
  campaign_type        TEXT,
  event_id             UUID REFERENCES events(id),
  budget_total         NUMERIC DEFAULT 0,
  budget_spent         NUMERIC DEFAULT 0,
  daily_limit          NUMERIC,
  start_date           TIMESTAMPTZ,
  end_date             TIMESTAMPTZ,
  headline             TEXT,
  subline              TEXT,
  cta_text             TEXT DEFAULT 'Learn More',
  cta_url              TEXT,
  media_url            TEXT,
  targeting            JSONB DEFAULT '{}',
  impressions          INTEGER DEFAULT 0,
  clicks               INTEGER DEFAULT 0,
  conversions          INTEGER DEFAULT 0,
  revenue_attributed   NUMERIC DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Audience segments
CREATE TABLE IF NOT EXISTS audience_segments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  criteria        JSONB DEFAULT '{}',
  estimated_reach INTEGER DEFAULT 0,
  saved           BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign analytics events (impressions, clicks, conversions)
CREATE TABLE IF NOT EXISTS campaign_analytics (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  business_id  UUID REFERENCES business_profiles(id),
  event_type   TEXT,  -- impression | click | conversion | rsvp | purchase
  user_id      UUID REFERENCES profiles(id),
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Business partnerships & ecosystem
CREATE TABLE IF NOT EXISTS business_partnerships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
  partner_type    TEXT,  -- sponsor | api_partner | affiliate | co_host | transport | creative
  partner_name    TEXT,
  partner_logo    TEXT,
  terms           JSONB DEFAULT '{}',
  status          TEXT DEFAULT 'pending',  -- pending | active | ended
  revenue_share   NUMERIC DEFAULT 0,
  revenue_earned  NUMERIC DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Business notifications (money opportunities, event alerts, etc.)
CREATE TABLE IF NOT EXISTS business_notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  body         TEXT,
  type         TEXT,  -- opportunity | alert | report | system
  read         BOOLEAN DEFAULT false,
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Contextual ads table (replaces the old contextual_ads table)
CREATE TABLE IF NOT EXISTS contextual_ads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  event_id    UUID REFERENCES events(id),
  phase       TEXT,  -- pre_event | during_event | post_event
  priority    INTEGER DEFAULT 0,
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE business_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_page_blocks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_campaigns            ENABLE ROW LEVEL SECURITY;
ALTER TABLE audience_segments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_analytics      ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_partnerships   ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_notifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE contextual_ads          ENABLE ROW LEVEL SECURITY;

-- Business profiles: owner full access, public read
CREATE POLICY "business_profiles_owner" ON business_profiles FOR ALL USING (user_id = auth.uid());
CREATE POLICY "business_profiles_public_read" ON business_profiles FOR SELECT USING (true);

-- Page blocks: owner full access
CREATE POLICY "page_blocks_owner" ON business_page_blocks FOR ALL
  USING (business_id IN (SELECT id FROM business_profiles WHERE user_id = auth.uid()));

-- Campaigns: owner full access
CREATE POLICY "campaigns_owner" ON ad_campaigns FOR ALL
  USING (business_id IN (SELECT id FROM business_profiles WHERE user_id = auth.uid()));

-- Analytics: anyone can insert (impressions/clicks), owner reads
CREATE POLICY "analytics_insert" ON campaign_analytics FOR INSERT WITH CHECK (true);
CREATE POLICY "analytics_read_owner" ON campaign_analytics FOR SELECT
  USING (business_id IN (SELECT id FROM business_profiles WHERE user_id = auth.uid()));

-- Segments: owner only
CREATE POLICY "segments_owner" ON audience_segments FOR ALL
  USING (business_id IN (SELECT id FROM business_profiles WHERE user_id = auth.uid()));

-- Partnerships: owner only
CREATE POLICY "partnerships_owner" ON business_partnerships FOR ALL
  USING (business_id IN (SELECT id FROM business_profiles WHERE user_id = auth.uid()));

-- Notifications: owner only
CREATE POLICY "biz_notifications_owner" ON business_notifications FOR ALL
  USING (business_id IN (SELECT id FROM business_profiles WHERE user_id = auth.uid()));

-- Contextual ads: public read (shown to users), owner write
CREATE POLICY "contextual_ads_read" ON contextual_ads FOR SELECT USING (active = true);
CREATE POLICY "contextual_ads_write" ON contextual_ads FOR ALL
  USING (campaign_id IN (SELECT id FROM ad_campaigns WHERE business_id IN (SELECT id FROM business_profiles WHERE user_id = auth.uid())));

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_business   ON ad_campaigns(business_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status     ON ad_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_analytics_camp ON campaign_analytics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_analytics_biz  ON campaign_analytics(business_id);
CREATE INDEX IF NOT EXISTS idx_page_blocks_business    ON business_page_blocks(business_id, position);
CREATE INDEX IF NOT EXISTS idx_biz_notifs_unread       ON business_notifications(business_id, read);

-- ── Active campaigns must contain event_phases for contextual matching ────────
-- The ad_campaigns.targeting JSONB must have a key: event_phases (array)
-- Example: { "event_phases": ["pre_event", "during_event"], "demographics": { ... } }
-- The EventContextualAds component queries: .contains('targeting->event_phases', [phase])
