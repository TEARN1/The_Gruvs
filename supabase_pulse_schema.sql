-- Migration: Pulse Schedule & Live Voting (Democratic Interaction Engine)

-- 1. Pulse Schedules (The timeline blocks for Events/Places)
CREATE TABLE IF NOT EXISTS public.pulse_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    title TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT false, -- Used to highlight "Live Now"
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by event
CREATE INDEX IF NOT EXISTS idx_pulse_schedules_event ON public.pulse_schedules(event_id);

-- 2. Pulse Requests (The items users vote on: Songs, Menu specials, Drill topics, Zones)
CREATE TABLE IF NOT EXISTS public.pulse_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES public.pulse_schedules(id) ON DELETE CASCADE, -- Nullable if it's a general request for the whole event
    requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    content TEXT NOT NULL, -- e.g. "Play Amapiano Anthem X", "Yoga at North Fountain"
    request_type TEXT NOT NULL, -- 'media', 'priority', 'inventory', 'spatial'
    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'completed'
    vote_count INTEGER DEFAULT 1, -- Denormalized for rapid sorting and Realtime broadcast
    is_live BOOLEAN DEFAULT false, -- If this is the currently active/playing request
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pulse_requests_event ON public.pulse_requests(event_id);

-- 3. Pulse Votes (Tracks who voted for what to prevent double-voting)
CREATE TABLE IF NOT EXISTS public.pulse_votes (
    request_id UUID REFERENCES public.pulse_requests(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (request_id, user_id)
);

-- Trigger to auto-update vote_count on pulse_requests
CREATE OR REPLACE FUNCTION update_pulse_vote_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.pulse_requests SET vote_count = vote_count + 1 WHERE id = NEW.request_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.pulse_requests SET vote_count = vote_count - 1 WHERE id = OLD.request_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_pulse_vote_count ON public.pulse_votes;
CREATE TRIGGER trg_update_pulse_vote_count
AFTER INSERT OR DELETE ON public.pulse_votes
FOR EACH ROW EXECUTE FUNCTION update_pulse_vote_count();

-- RLS Policies
ALTER TABLE public.pulse_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pulse schedules" ON public.pulse_schedules FOR SELECT USING (true);
CREATE POLICY "Hosts can manage pulse schedules" ON public.pulse_schedules FOR ALL USING (
  auth.uid() IN (SELECT author_id FROM public.events WHERE id = event_id)
);

CREATE POLICY "Anyone can view pulse requests" ON public.pulse_requests FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert requests" ON public.pulse_requests FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Hosts can update requests" ON public.pulse_requests FOR UPDATE USING (
  auth.uid() IN (SELECT author_id FROM public.events WHERE id = event_id)
);

CREATE POLICY "Anyone can view votes" ON public.pulse_votes FOR SELECT USING (true);
CREATE POLICY "Users can manage their own votes" ON public.pulse_votes FOR ALL USING (auth.uid() = user_id);

-- Enable Realtime for the voting engine
-- Note: You will need to explicitly enable these tables in the Supabase Dashboard -> Database -> Replication
ALTER PUBLICATION supabase_realtime ADD TABLE public.pulse_requests;
