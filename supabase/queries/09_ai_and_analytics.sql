-- ============================================================
--  THE GRUVS — 09: AI AND ANALYTICS
--  ai_recommendations_cache, ai_interactions, ai_user_memory,
--  ai_predictions, user_analytics, event_analytics_snapshots,
--  trending_events, search_history
-- ============================================================

-- ── AI RECOMMENDATIONS CACHE ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_recommendations_cache (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rec_type     TEXT NOT NULL CHECK (rec_type IN ('events','users','services','reels','paths')),
  payload      JSONB NOT NULL DEFAULT '[]',
  model_ver    TEXT DEFAULT 'v1',
  expires_at   TIMESTAMPTZ DEFAULT now() + interval '6 hours',
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, rec_type)
);
ALTER TABLE public.ai_recommendations_cache ADD COLUMN IF NOT EXISTS rec_type   TEXT DEFAULT 'events';
ALTER TABLE public.ai_recommendations_cache ADD COLUMN IF NOT EXISTS payload    JSONB DEFAULT '[]';
ALTER TABLE public.ai_recommendations_cache ADD COLUMN IF NOT EXISTS model_ver  TEXT DEFAULT 'v1';
ALTER TABLE public.ai_recommendations_cache ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT now() + interval '6 hours';
CREATE INDEX IF NOT EXISTS idx_ai_recs_user   ON public.ai_recommendations_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_recs_expiry ON public.ai_recommendations_cache(expires_at);

-- ── AI INTERACTIONS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_interactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id   TEXT,
  role         TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content      TEXT NOT NULL,
  tokens_used  INTEGER DEFAULT 0,
  model        TEXT DEFAULT 'claude-sonnet-4-6',
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_user    ON public.ai_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_session ON public.ai_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_time    ON public.ai_interactions(created_at DESC);

-- ── AI USER MEMORY ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_user_memory (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('preference','habit','relationship','location','interest','aversion')),
  key         TEXT NOT NULL,
  value       JSONB NOT NULL DEFAULT '{}',
  confidence  NUMERIC(3,2) DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
  source      TEXT DEFAULT 'inferred',
  updated_at  TIMESTAMPTZ DEFAULT now(),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, memory_type, key)
);
CREATE INDEX IF NOT EXISTS idx_ai_memory_user ON public.ai_user_memory(user_id);

-- ── AI PREDICTIONS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_predictions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id      UUID REFERENCES public.events(id) ON DELETE CASCADE,
  prediction_type TEXT NOT NULL CHECK (prediction_type IN ('attendance','vibe','crowd_size','peak_time','safety_score')),
  predicted_value JSONB NOT NULL DEFAULT '{}',
  confidence    NUMERIC(3,2) DEFAULT 0.5,
  resolved      BOOLEAN DEFAULT false,
  actual_value  JSONB,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_event ON public.ai_predictions(event_id);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_user  ON public.ai_predictions(user_id);

-- ── USER ANALYTICS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_analytics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  events_attended   INTEGER DEFAULT 0,
  reels_posted      INTEGER DEFAULT 0,
  echoes_posted     INTEGER DEFAULT 0,
  paths_created     INTEGER DEFAULT 0,
  wallet_spent      NUMERIC(10,2) DEFAULT 0,
  wallet_earned     NUMERIC(10,2) DEFAULT 0,
  new_connections   INTEGER DEFAULT 0,
  app_opens         INTEGER DEFAULT 0,
  session_minutes   INTEGER DEFAULT 0,
  UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_user_analytics_user ON public.user_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_analytics_date ON public.user_analytics(date DESC);

-- ── EVENT ANALYTICS SNAPSHOTS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_analytics_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  snapshot_time TIMESTAMPTZ DEFAULT now(),
  rsvp_count    INTEGER DEFAULT 0,
  checkin_count INTEGER DEFAULT 0,
  vibe_count    INTEGER DEFAULT 0,
  echo_count    INTEGER DEFAULT 0,
  view_count    INTEGER DEFAULT 0,
  revenue       NUMERIC(10,2) DEFAULT 0,
  gender_split  JSONB DEFAULT '{}',
  age_split     JSONB DEFAULT '{}',
  location_split JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_event_analytics_event ON public.event_analytics_snapshots(event_id);
CREATE INDEX IF NOT EXISTS idx_event_analytics_time  ON public.event_analytics_snapshots(snapshot_time DESC);

-- ── TRENDING EVENTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trending_events (
  event_id      UUID PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  score         NUMERIC(10,4) DEFAULT 0,
  rsvp_velocity NUMERIC(8,4) DEFAULT 0,
  vibe_velocity NUMERIC(8,4) DEFAULT 0,
  echo_velocity NUMERIC(8,4) DEFAULT 0,
  rank          INTEGER,
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trending_score ON public.trending_events(score DESC);

-- ── SEARCH HISTORY ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.search_history (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  query      TEXT NOT NULL,
  category   TEXT DEFAULT 'events' CHECK (category IN ('events','users','services','reels','all')),
  result_count INTEGER DEFAULT 0,
  clicked_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_search_history_user ON public.search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_time ON public.search_history(created_at DESC);

-- ── TRENDING SCORE UPDATE RPC ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_trending_events()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.trending_events (event_id, score, rsvp_velocity, vibe_velocity, echo_velocity, rank, updated_at)
  SELECT
    e.id,
    (
      COALESCE(rsvp_cnt, 0) * 3 +
      COALESCE(vibe_cnt, 0) * 2 +
      COALESCE(echo_cnt, 0) * 1
    ) / GREATEST(1, EXTRACT(EPOCH FROM (now() - e.created_at)) / 3600) AS score,
    COALESCE(rsvp_cnt, 0)  / GREATEST(1, EXTRACT(EPOCH FROM (now() - e.created_at)) / 3600),
    COALESCE(vibe_cnt, 0)  / GREATEST(1, EXTRACT(EPOCH FROM (now() - e.created_at)) / 3600),
    COALESCE(echo_cnt, 0)  / GREATEST(1, EXTRACT(EPOCH FROM (now() - e.created_at)) / 3600),
    ROW_NUMBER() OVER (ORDER BY (
      COALESCE(rsvp_cnt, 0) * 3 + COALESCE(vibe_cnt, 0) * 2 + COALESCE(echo_cnt, 0)
    ) / GREATEST(1, EXTRACT(EPOCH FROM (now() - e.created_at)) / 3600) DESC),
    now()
  FROM public.events e
  LEFT JOIN (SELECT event_id, COUNT(*) AS rsvp_cnt FROM public.event_rsvps GROUP BY event_id) r ON r.event_id = e.id
  LEFT JOIN (SELECT event_id, COUNT(*) AS vibe_cnt FROM public.event_vibes GROUP BY event_id) v ON v.event_id = e.id
  LEFT JOIN (SELECT event_id, COUNT(*) AS echo_cnt FROM public.echoes WHERE event_id IS NOT NULL GROUP BY event_id) ec ON ec.event_id = e.id
  WHERE e.starts_at > now() - interval '7 days'
    AND e.is_published = true
  ON CONFLICT (event_id) DO UPDATE SET
    score         = EXCLUDED.score,
    rsvp_velocity = EXCLUDED.rsvp_velocity,
    vibe_velocity = EXCLUDED.vibe_velocity,
    echo_velocity = EXCLUDED.echo_velocity,
    rank          = EXCLUDED.rank,
    updated_at    = now();
END;
$$;

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.ai_recommendations_cache   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_interactions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_user_memory             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_predictions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_analytics             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_analytics_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trending_events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_history             ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_recs_own"      ON public.ai_recommendations_cache;
CREATE POLICY "ai_recs_own" ON public.ai_recommendations_cache FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "ai_interactions_own" ON public.ai_interactions;
CREATE POLICY "ai_interactions_own" ON public.ai_interactions FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "ai_memory_own" ON public.ai_user_memory;
CREATE POLICY "ai_memory_own" ON public.ai_user_memory FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "ai_predictions_own"   ON public.ai_predictions;
DROP POLICY IF EXISTS "ai_predictions_select" ON public.ai_predictions;
CREATE POLICY "ai_predictions_own"    ON public.ai_predictions FOR ALL    USING (user_id = auth.uid());
CREATE POLICY "ai_predictions_select" ON public.ai_predictions FOR SELECT USING (event_id IS NOT NULL);

DROP POLICY IF EXISTS "user_analytics_own" ON public.user_analytics;
CREATE POLICY "user_analytics_own" ON public.user_analytics FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "event_analytics_organiser" ON public.event_analytics_snapshots;
CREATE POLICY "event_analytics_organiser" ON public.event_analytics_snapshots FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid()));

DROP POLICY IF EXISTS "trending_select" ON public.trending_events;
CREATE POLICY "trending_select" ON public.trending_events FOR SELECT USING (true);

DROP POLICY IF EXISTS "search_history_own" ON public.search_history;
CREATE POLICY "search_history_own" ON public.search_history FOR ALL USING (user_id = auth.uid());
