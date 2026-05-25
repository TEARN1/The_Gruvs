-- ============================================================
--  THE GRUVS — 08: BUSINESS AND ADS
--  business_profiles, business_page_blocks, partnerships,
--  ad_campaigns, campaign_analytics, audience_segments,
--  governance, app_updates, global_economy_params
-- ============================================================

-- ── BUSINESS PROFILES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.business_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  business_name TEXT NOT NULL,
  category      TEXT,
  tagline       TEXT,
  logo_url      TEXT,
  website       TEXT,
  location      TEXT,
  verified      BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.business_page_blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  block_type  TEXT NOT NULL,
  content     JSONB DEFAULT '{}',
  position    INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.business_partnerships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  partner_id  UUID NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  status      TEXT DEFAULT 'pending',
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id, partner_id)
);

-- ── AD CAMPAIGNS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ad_campaigns (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  budget     NUMERIC(10,2) DEFAULT 0,
  spent      NUMERIC(10,2) DEFAULT 0,
  status     TEXT DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed')),
  targeting  JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.campaign_analytics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  impressions INTEGER DEFAULT 0,
  clicks      INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  date        DATE DEFAULT CURRENT_DATE
);
CREATE TABLE IF NOT EXISTS public.audience_segments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  filters     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── GOVERNANCE ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.governance_proposals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  created_by  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status      TEXT DEFAULT 'open' CHECK (status IN ('open','passed','rejected','cancelled')),
  ends_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.governance_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.governance_proposals(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vote        TEXT NOT NULL CHECK (vote IN ('yes','no','abstain')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(proposal_id, user_id)
);

-- ── APP UPDATES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_updates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version    TEXT NOT NULL,
  notes      TEXT,
  is_forced  BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.global_economy_params (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT NOT NULL UNIQUE,
  value      JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.business_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_page_blocks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_partnerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_campaigns          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_analytics    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audience_segments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_proposals  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_votes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_updates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_economy_params ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "biz_select" ON public.business_profiles;
DROP POLICY IF EXISTS "biz_manage" ON public.business_profiles;
CREATE POLICY "biz_select" ON public.business_profiles FOR SELECT USING (true);
CREATE POLICY "biz_manage" ON public.business_profiles FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "biz_blocks_manage" ON public.business_page_blocks;
CREATE POLICY "biz_blocks_manage" ON public.business_page_blocks FOR ALL
  USING (EXISTS (SELECT 1 FROM public.business_profiles bp WHERE bp.id = business_id AND bp.user_id = auth.uid()));

DROP POLICY IF EXISTS "biz_partnerships_manage" ON public.business_partnerships;
CREATE POLICY "biz_partnerships_manage" ON public.business_partnerships FOR ALL
  USING (EXISTS (SELECT 1 FROM public.business_profiles bp WHERE bp.id = business_id AND bp.user_id = auth.uid()));

DROP POLICY IF EXISTS "campaigns_select" ON public.ad_campaigns;
DROP POLICY IF EXISTS "campaigns_manage" ON public.ad_campaigns;
CREATE POLICY "campaigns_select" ON public.ad_campaigns FOR SELECT USING (true);
CREATE POLICY "campaigns_manage" ON public.ad_campaigns FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "proposals_select" ON public.governance_proposals;
DROP POLICY IF EXISTS "proposals_manage" ON public.governance_proposals;
CREATE POLICY "proposals_select" ON public.governance_proposals FOR SELECT USING (true);
CREATE POLICY "proposals_manage" ON public.governance_proposals FOR INSERT WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "gov_votes_select" ON public.governance_votes;
DROP POLICY IF EXISTS "gov_votes_manage" ON public.governance_votes;
CREATE POLICY "gov_votes_select" ON public.governance_votes FOR SELECT USING (true);
CREATE POLICY "gov_votes_manage" ON public.governance_votes FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "app_updates_select" ON public.app_updates;
CREATE POLICY "app_updates_select" ON public.app_updates FOR SELECT USING (true);

DROP POLICY IF EXISTS "global_economy_select" ON public.global_economy_params;
CREATE POLICY "global_economy_select" ON public.global_economy_params FOR SELECT USING (true);
