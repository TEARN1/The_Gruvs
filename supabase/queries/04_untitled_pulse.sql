-- ============================================================
--  THE GRUVS — 04: UNTITLED (Pulse Schedule & Live Voting)
--  pulse_schedules, enhanced pulse_requests, pulse_votes
--  Democratic interaction engine for live events
-- ============================================================

-- ── PULSE SCHEDULES (live timeline blocks) ───────────────────
CREATE TABLE IF NOT EXISTS public.pulse_schedules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  start_time  TIMESTAMPTZ,
  end_time    TIMESTAMPTZ,
  title       TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pulse_schedules_event ON public.pulse_schedules(event_id);

-- ── PULSE REQUESTS (voting items) ────────────────────────────
-- Add schedule_id and enhanced columns to existing pulse_requests
ALTER TABLE public.pulse_requests ADD COLUMN IF NOT EXISTS schedule_id  UUID REFERENCES public.pulse_schedules(id) ON DELETE CASCADE;
ALTER TABLE public.pulse_requests ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT 'media'
  CHECK (request_type IN ('media','priority','inventory','spatial'));
ALTER TABLE public.pulse_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'
  CHECK (status IN ('pending','accepted','rejected','completed'));

-- ── PULSE VOTES trigger ───────────────────────────────────────
-- (pulse_votes table already created in 01_gruvs_social.sql)
CREATE OR REPLACE FUNCTION public.sync_pulse_vote_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.pulse_requests SET vote_count = COALESCE(vote_count,0)+1 WHERE id = NEW.request_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.pulse_requests SET vote_count = GREATEST(0,COALESCE(vote_count,1)-1) WHERE id = OLD.request_id;
  END IF;
  RETURN null;
END;
$$;
DROP TRIGGER IF EXISTS pulse_vote_count_trigger ON public.pulse_votes;
CREATE TRIGGER pulse_vote_count_trigger AFTER INSERT OR DELETE ON public.pulse_votes
  FOR EACH ROW EXECUTE FUNCTION public.sync_pulse_vote_count();

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.pulse_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pulse_schedules_select" ON public.pulse_schedules;
DROP POLICY IF EXISTS "pulse_schedules_manage" ON public.pulse_schedules;
CREATE POLICY "pulse_schedules_select" ON public.pulse_schedules FOR SELECT USING (true);
CREATE POLICY "pulse_schedules_manage" ON public.pulse_schedules FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid()));

-- ── Realtime ──────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='pulse_requests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pulse_requests;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='pulse_schedules') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pulse_schedules;
  END IF;
END $$;
