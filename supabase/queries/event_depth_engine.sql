-- ═══════════════════════════════════════════════════════════════════════════
-- event_depth_engine.sql — Phase 1 step 1: the generic engine tables.
--
-- Per ROADMAP.md §1: every event type (music, conference, market, hackathon,
-- comedy, film, arts, networking, sport…) reaches soccer-level depth via ONE
-- generic engine instead of 10 cloned schemas. This file stands up the six
-- primitive tables the whole engine is built on:
--
--   participants     — any competitor/contributor in an event (artist, team,
--                       speaker, vendor, hack-team, athlete, ...)
--   program_slots    — any scheduled unit (set, session, match, round, window)
--   slot_lineups     — who's "on" for a slot (starting XI / panel / performers)
--   live_timeline    — the universal live event stream (goal, now-playing,
--                       submission, award, ...)
--   ranking_entries  — universal standings / leaderboard
--   honours          — universal awards
--
-- Purely additive: does NOT touch sport_teams/sport_athletes/sport_matches or
-- any other existing table. Soccer stays on its current tables for now — the
-- adapter refactor (soccer onto this engine) is a separate, later step once
-- these tables exist and are proven, per "engine before adapters" in
-- ROADMAP.md §3.
--
-- RLS follows the existing sport_* convention (schema_part_3.sql): SELECT is
-- open (public event content), writes are restricted to the event's host or
-- a co_host/moderator via event_roles — same pattern event_chat_hardening.sql
-- uses.
--
-- Idempotent. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── participants ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.participants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN
                  ('team','athlete','artist','speaker','vendor','hackteam','performer','other')),
  person_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  club_id       uuid,
  display_name  text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 200),
  photo_url     text,
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_participants_event ON public.participants (event_id);
CREATE INDEX IF NOT EXISTS idx_participants_person ON public.participants (person_id) WHERE person_id IS NOT NULL;

ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "participants_read" ON public.participants;
CREATE POLICY "participants_read" ON public.participants FOR SELECT USING (true);
DROP POLICY IF EXISTS "participants_write" ON public.participants;
CREATE POLICY "participants_write" ON public.participants FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.event_roles r
               WHERE r.event_id = participants.event_id AND r.user_id = auth.uid()
                 AND r.role IN ('co_host','moderator'))
  );


-- ── program_slots ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.program_slots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  stage_id      uuid,
  round         text,
  slot_number   integer DEFAULT 1,
  title         text CHECK (title IS NULL OR length(title) <= 200),
  starts_at     timestamptz,
  ends_at       timestamptz,
  venue         text,
  status        text NOT NULL DEFAULT 'scheduled'
                CHECK (status IN ('scheduled','live','completed','postponed','cancelled')),
  home_ref      uuid REFERENCES public.participants(id) ON DELETE SET NULL,
  away_ref      uuid REFERENCES public.participants(id) ON DELETE SET NULL,
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_program_slots_event ON public.program_slots (event_id);
CREATE INDEX IF NOT EXISTS idx_program_slots_starts ON public.program_slots (starts_at);

ALTER TABLE public.program_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "program_slots_read" ON public.program_slots;
CREATE POLICY "program_slots_read" ON public.program_slots FOR SELECT USING (true);
DROP POLICY IF EXISTS "program_slots_write" ON public.program_slots;
CREATE POLICY "program_slots_write" ON public.program_slots FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.event_roles r
               WHERE r.event_id = program_slots.event_id AND r.user_id = auth.uid()
                 AND r.role IN ('co_host','moderator'))
  );

DROP TRIGGER IF EXISTS touch_program_slots_updated_at ON public.program_slots;
CREATE TRIGGER touch_program_slots_updated_at
  BEFORE UPDATE ON public.program_slots
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();


-- ── slot_lineups ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.slot_lineups (
  slot_id         uuid NOT NULL REFERENCES public.program_slots(id) ON DELETE CASCADE,
  participant_id  uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  role            text,
  position        text,
  is_starter      boolean DEFAULT true,
  number          text,
  meta            jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (slot_id, participant_id)
);

ALTER TABLE public.slot_lineups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "slot_lineups_read" ON public.slot_lineups;
CREATE POLICY "slot_lineups_read" ON public.slot_lineups FOR SELECT USING (true);
DROP POLICY IF EXISTS "slot_lineups_write" ON public.slot_lineups;
CREATE POLICY "slot_lineups_write" ON public.slot_lineups FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.program_slots s
            JOIN public.events e ON e.id = s.event_id
            WHERE s.id = slot_id AND e.author_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.program_slots s
               JOIN public.event_roles r ON r.event_id = s.event_id
               WHERE s.id = slot_id AND r.user_id = auth.uid()
                 AND r.role IN ('co_host','moderator'))
  );


-- ── live_timeline ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_timeline (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id             uuid REFERENCES public.program_slots(id) ON DELETE CASCADE,
  event_id            uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  ts                  timestamptz NOT NULL DEFAULT now(),
  minute              integer,
  type                text NOT NULL,
  actor_participant_id uuid REFERENCES public.participants(id) ON DELETE SET NULL,
  body                text CHECK (body IS NULL OR length(body) <= 2000),
  score_home          integer,
  score_away          integer,
  detail              jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_live_timeline_slot ON public.live_timeline (slot_id, ts);
CREATE INDEX IF NOT EXISTS idx_live_timeline_event ON public.live_timeline (event_id, ts DESC);

ALTER TABLE public.live_timeline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "live_timeline_read" ON public.live_timeline;
CREATE POLICY "live_timeline_read" ON public.live_timeline FOR SELECT USING (true);
DROP POLICY IF EXISTS "live_timeline_write" ON public.live_timeline;
CREATE POLICY "live_timeline_write" ON public.live_timeline FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.event_roles r
               WHERE r.event_id = live_timeline.event_id AND r.user_id = auth.uid()
                 AND r.role IN ('co_host','moderator'))
  );


-- ── ranking_entries ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ranking_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  group_id        uuid,
  participant_id  uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  metric          text NOT NULL,
  value           numeric NOT NULL DEFAULT 0,
  rank            integer,
  breakdown       jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, group_id, participant_id, metric)
);
CREATE INDEX IF NOT EXISTS idx_ranking_entries_event ON public.ranking_entries (event_id, metric, rank);

ALTER TABLE public.ranking_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ranking_entries_read" ON public.ranking_entries;
CREATE POLICY "ranking_entries_read" ON public.ranking_entries FOR SELECT USING (true);
DROP POLICY IF EXISTS "ranking_entries_write" ON public.ranking_entries;
CREATE POLICY "ranking_entries_write" ON public.ranking_entries FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.event_roles r
               WHERE r.event_id = ranking_entries.event_id AND r.user_id = auth.uid()
                 AND r.role IN ('co_host','moderator'))
  );


-- ── honours ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.honours (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  category        text NOT NULL CHECK (length(category) <= 100),
  participant_id  uuid REFERENCES public.participants(id) ON DELETE SET NULL,
  label           text CHECK (label IS NULL OR length(label) <= 200),
  value           text,
  meta            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_honours_event ON public.honours (event_id);

ALTER TABLE public.honours ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "honours_read" ON public.honours;
CREATE POLICY "honours_read" ON public.honours FOR SELECT USING (true);
DROP POLICY IF EXISTS "honours_write" ON public.honours;
CREATE POLICY "honours_write" ON public.honours FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.event_roles r
               WHERE r.event_id = honours.event_id AND r.user_id = auth.uid()
                 AND r.role IN ('co_host','moderator'))
  );
