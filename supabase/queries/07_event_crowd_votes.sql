-- ============================================================================
-- 07_event_crowd_votes.sql
-- ----------------------------------------------------------------------------
-- Live Crowd Meter — anonymous "how's the vibe right now" votes on an event.
-- Zero cost (Supabase only). One vote per user per event (upsert to change);
-- the app aggregates the last ~45 min to show the current crowd level.
--   level: 1 = Chilled · 2 = Busy · 3 = Packed
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_crowd_votes (
  event_id   UUID NOT NULL REFERENCES public.events(id)   ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  level      SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 3),
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_crowd_votes_event
  ON public.event_crowd_votes (event_id, created_at DESC);

ALTER TABLE public.event_crowd_votes ENABLE ROW LEVEL SECURITY;

-- Aggregate is public (counts only, no identity shown in UI); writes are own-row.
DROP POLICY IF EXISTS "crowd_select"     ON public.event_crowd_votes;
CREATE POLICY "crowd_select"     ON public.event_crowd_votes FOR SELECT USING (true);
DROP POLICY IF EXISTS "crowd_insert_own" ON public.event_crowd_votes;
CREATE POLICY "crowd_insert_own" ON public.event_crowd_votes FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "crowd_update_own" ON public.event_crowd_votes;
CREATE POLICY "crowd_update_own" ON public.event_crowd_votes FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "crowd_delete_own" ON public.event_crowd_votes;
CREATE POLICY "crowd_delete_own" ON public.event_crowd_votes FOR DELETE USING (user_id = auth.uid());