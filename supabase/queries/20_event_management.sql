-- ============================================================
--  THE GRUVS — EVENT MANAGEMENT PLATFORM v1
--  Universal management tables for all non-sport event types:
--  music, conference, food/market, festival, workshop,
--  hackathon, networking, film, arts, comedy, etc.
--  Run in: Supabase → SQL Editor → Run
-- ============================================================

-- ── EVENT LINEUP (Music / Festival / Conference) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_lineup (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,           -- Artist / Speaker / Performer name
  role          TEXT,                           -- Headliner / Support / Keynote / Panelist / MC / DJ
  stage         TEXT,                           -- Main Stage / Side Stage / Room A / Tent B
  photo_url     TEXT,
  bio           TEXT,
  genre         TEXT,                           -- Music genre or talk topic
  set_start     TEXT,                           -- HH:MM set start time
  set_end       TEXT,                           -- HH:MM set end time
  set_date      DATE,                           -- For multi-day events
  social_handle TEXT,                           -- @handle
  booking_status TEXT DEFAULT 'confirmed' CHECK (booking_status IN ('confirmed','tentative','cancelled')),
  position      INTEGER DEFAULT 0,
  extra_data    JSONB DEFAULT '{}',             -- tech rider, hospitality, etc.
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lineup_event ON public.event_lineup(event_id, set_date, set_start);
ALTER TABLE public.event_lineup ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lineup_read" ON public.event_lineup;
CREATE POLICY "lineup_read" ON public.event_lineup FOR SELECT USING (true);
DROP POLICY IF EXISTS "lineup_host" ON public.event_lineup;
CREATE POLICY "lineup_host" ON public.event_lineup FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()));

-- ── EVENT STAGES (Multi-stage festivals) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_stages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  color       TEXT        DEFAULT '#00f2ff',
  capacity    INTEGER,
  description TEXT,
  position    INTEGER     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.event_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stages_read" ON public.event_stages;
CREATE POLICY "stages_read" ON public.event_stages FOR SELECT USING (true);
DROP POLICY IF EXISTS "stages_host" ON public.event_stages;
CREATE POLICY "stages_host" ON public.event_stages FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()));

-- ── EVENT SETLISTS (Music) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_setlists (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  lineup_id     UUID        REFERENCES public.event_lineup(id) ON DELETE CASCADE,
  artist_name   TEXT        NOT NULL,
  track_number  INTEGER     DEFAULT 1,
  song_title    TEXT        NOT NULL,
  duration_sec  INTEGER,
  is_played     BOOLEAN     DEFAULT false,
  played_at     TIMESTAMPTZ,
  notes         TEXT,                           -- "Extended mix", "With guest", etc.
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_setlists_event ON public.event_setlists(event_id, lineup_id);
ALTER TABLE public.event_setlists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "setlists_read" ON public.event_setlists;
CREATE POLICY "setlists_read" ON public.event_setlists FOR SELECT USING (true);
DROP POLICY IF EXISTS "setlists_host" ON public.event_setlists;
CREATE POLICY "setlists_host" ON public.event_setlists FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()));

-- ── EVENT VENDORS / STALLS (Food Markets, Expos, Craft Fairs) ────────────────
CREATE TABLE IF NOT EXISTS public.event_vendors (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  owner_id      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  name          TEXT        NOT NULL,           -- Vendor / stall name
  category      TEXT,                           -- Food / Drinks / Crafts / Fashion / Tech / Art / Services
  description   TEXT,
  logo_url      TEXT,
  stall_number  TEXT,                           -- A12, Stall 5, etc.
  contact       TEXT,                           -- Phone / email combined
  website       TEXT,
  social_handle TEXT,
  menu_items    JSONB DEFAULT '[]',             -- [{name, price, description, available}]
  is_confirmed  BOOLEAN DEFAULT true,
  is_active     BOOLEAN DEFAULT true,
  extra_data    JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendors_event ON public.event_vendors(event_id);
ALTER TABLE public.event_vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vendors_read" ON public.event_vendors;
CREATE POLICY "vendors_read" ON public.event_vendors FOR SELECT USING (true);
DROP POLICY IF EXISTS "vendors_host" ON public.event_vendors;
CREATE POLICY "vendors_host" ON public.event_vendors FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()));

-- ── EVENT SESSIONS (Conference / Workshop / Seminar) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.event_sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  type          TEXT        DEFAULT 'talk',     -- talk / panel / workshop / keynote / breakout / q_and_a / demo / award / break
  room          TEXT,                           -- Conference Room B, Auditorium, etc.
  speaker       TEXT,                           -- Speaker / facilitator name
  description   TEXT,
  start_time    TEXT,                           -- HH:MM
  end_time      TEXT,
  session_date  DATE,
  capacity      INTEGER,
  attendee_count INTEGER DEFAULT 0,
  is_live       BOOLEAN DEFAULT false,
  recording_url TEXT,
  slides_url    TEXT,
  position      INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_event ON public.event_sessions(event_id, session_date, start_time);
ALTER TABLE public.event_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sessions_read" ON public.event_sessions;
CREATE POLICY "sessions_read" ON public.event_sessions FOR SELECT USING (true);
DROP POLICY IF EXISTS "sessions_host" ON public.event_sessions;
CREATE POLICY "sessions_host" ON public.event_sessions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()));

-- ── EVENT SPEAKERS / FACILITATORS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_speakers (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  title         TEXT,                           -- "CEO at XYZ", "Award-Winning Author"
  company       TEXT,
  photo_url     TEXT,
  bio           TEXT,
  topic         TEXT,
  social_handle TEXT,
  website       TEXT,
  is_keynote    BOOLEAN DEFAULT false,
  position      INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_speakers_event ON public.event_speakers(event_id);
ALTER TABLE public.event_speakers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "speakers_read" ON public.event_speakers;
CREATE POLICY "speakers_read" ON public.event_speakers FOR SELECT USING (true);
DROP POLICY IF EXISTS "speakers_host" ON public.event_speakers;
CREATE POLICY "speakers_host" ON public.event_speakers FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()));

-- ── EVENT TEAMS (Hackathon / Competition / Networking) ────────────────────────
CREATE TABLE IF NOT EXISTS public.event_teams (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  leader_id     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  members       JSONB DEFAULT '[]',             -- [{user_id, name, role}]
  project_title TEXT,
  project_desc  TEXT,
  project_url   TEXT,
  demo_url      TEXT,
  tech_stack    TEXT[],
  submitted     BOOLEAN DEFAULT false,
  submitted_at  TIMESTAMPTZ,
  score         FLOAT,
  judge_notes   TEXT,
  position      INTEGER,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_teams_event ON public.event_teams(event_id);
ALTER TABLE public.event_teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_teams_read" ON public.event_teams;
CREATE POLICY "event_teams_read" ON public.event_teams FOR SELECT USING (true);
DROP POLICY IF EXISTS "event_teams_host" ON public.event_teams;
CREATE POLICY "event_teams_host" ON public.event_teams FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()));

-- ── EVENT JUDGE SCORES (Hackathon / Talent Shows / Competitions) ─────────────
CREATE TABLE IF NOT EXISTS public.event_judge_scores (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  judge_id      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  judge_name    TEXT        NOT NULL,
  participant_id UUID,                          -- team_id or lineup_id
  participant_name TEXT,
  category      TEXT,                           -- Criteria name
  score         FLOAT       NOT NULL,
  max_score     FLOAT       DEFAULT 10,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_judge_scores_event ON public.event_judge_scores(event_id);
ALTER TABLE public.event_judge_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "judge_scores_read" ON public.event_judge_scores;
CREATE POLICY "judge_scores_read" ON public.event_judge_scores FOR SELECT USING (true);
DROP POLICY IF EXISTS "judge_scores_host" ON public.event_judge_scores;
CREATE POLICY "judge_scores_host" ON public.event_judge_scores FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()));

-- ── EVENT LIVE UPDATES (catch-all real-time updates for any event) ────────────
-- (Extends existing event_updates table — this adds structured types)
ALTER TABLE public.event_updates ADD COLUMN IF NOT EXISTS update_type TEXT DEFAULT 'general'
  CHECK (update_type IN ('general','artist_change','delay','cancellation','set_now_playing','vendor_spotlight','session_starting','result','award','announcement','safety','weather'));
ALTER TABLE public.event_updates ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
ALTER TABLE public.event_updates ADD COLUMN IF NOT EXISTS reactions_count INTEGER DEFAULT 0;

-- Enable realtime on management tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_lineup;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_updates;
