-- ============================================================
--  THE GRUVS — CLUBS, MEMBERSHIPS & UNIVERSAL AWARDS
--
--  Architecture:
--    clubs              — club/team account (owned by a user profile)
--    club_memberships   — players/staff linked to a club with full history
--    sport_teams        — gets club_id FK (team is a club's entry in an event)
--    event_awards       — universal awards for any event type
--    player_career_stats — cached aggregate stats per player per sport
--
--  A "club" can be:
--    - A football club (players, fixtures, trophies)
--    - A music group / band (performers)
--    - A debate / esports team (participants)
--    - Any organised group that enters events repeatedly
--
--  Run in: Supabase → SQL Editor → Run
--  Idempotent — safe to re-run.
-- ============================================================

-- ── CLUBS ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clubs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  short_name      TEXT,                           -- e.g. "AMA" for Amazulu FC
  sport_type      TEXT,                           -- soccer|rugby|basketball|music|esports|debate|other
  category        TEXT        DEFAULT 'sport',    -- sport|music|esports|arts|education|other
  logo_url        TEXT,
  banner_url      TEXT,
  bio             TEXT,
  city            TEXT,
  country         TEXT        DEFAULT 'ZA',
  founded_year    INTEGER,
  home_ground     TEXT,
  colors          TEXT[]      DEFAULT '{}',       -- ['#00f2ff','#ffffff']
  contact_email   TEXT,
  contact_phone   TEXT,
  website         TEXT,
  social_handle   TEXT,
  -- Stats (cached)
  members_count   INTEGER     DEFAULT 0,
  events_count    INTEGER     DEFAULT 0,
  trophies_count  INTEGER     DEFAULT 0,
  -- Verification
  is_verified     BOOLEAN     DEFAULT false,
  is_active       BOOLEAN     DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clubs_owner    ON public.clubs(owner_id);
CREATE INDEX IF NOT EXISTS idx_clubs_sport    ON public.clubs(sport_type);
CREATE INDEX IF NOT EXISTS idx_clubs_city     ON public.clubs(city);

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clubs_read"  ON public.clubs;
CREATE POLICY "clubs_read"  ON public.clubs FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "clubs_own"   ON public.clubs;
CREATE POLICY "clubs_own"   ON public.clubs FOR ALL
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- ── CLUB MEMBERSHIPS ──────────────────────────────────────────────────────────
-- Full history: a player can have multiple rows (different seasons/clubs)
CREATE TABLE IF NOT EXISTS public.club_memberships (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Role within the club
  role            TEXT        NOT NULL DEFAULT 'player'
                  CHECK (role IN ('player','captain','vice_captain','coach','manager','assistant_coach','physio','analyst','admin','performer','speaker','member')),
  -- Sport/team-specific
  position        TEXT,                           -- striker|midfielder|goalkeeper|vocalist|etc.
  jersey_number   TEXT,
  -- Status
  is_active       BOOLEAN     DEFAULT true,
  joined_at       DATE        DEFAULT CURRENT_DATE,
  left_at         DATE,                           -- NULL = current member
  season          TEXT,                           -- "2024", "2024/25", etc.
  -- Profile snapshot (denormalised for display without join)
  display_name    TEXT,
  photo_url       TEXT,
  -- Notes
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_club_memberships_club   ON public.club_memberships(club_id, is_active);
CREATE INDEX IF NOT EXISTS idx_club_memberships_user   ON public.club_memberships(user_id);

ALTER TABLE public.club_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "memberships_read"       ON public.club_memberships;
CREATE POLICY "memberships_read"       ON public.club_memberships FOR SELECT USING (true);
DROP POLICY IF EXISTS "memberships_self"       ON public.club_memberships;
CREATE POLICY "memberships_self"       ON public.club_memberships FOR ALL
  USING (user_id = auth.uid() OR
         EXISTS (SELECT 1 FROM public.clubs WHERE id = club_id AND owner_id = auth.uid()))
  WITH CHECK (user_id = auth.uid() OR
              EXISTS (SELECT 1 FROM public.clubs WHERE id = club_id AND owner_id = auth.uid()));

-- ── LINK sport_teams TO clubs ─────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sport_teams') THEN
    EXECUTE 'ALTER TABLE public.sport_teams ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sport_teams_club ON public.sport_teams(club_id)';
  END IF;
END;
$$;

-- ── EVENT AWARDS — universal for all event types ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_awards (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  -- Who gets it
  recipient_user_id UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_club_id UUID        REFERENCES public.clubs(id) ON DELETE SET NULL,
  recipient_name    TEXT        NOT NULL,          -- denormalised display name
  recipient_photo   TEXT,
  recipient_club_name TEXT,
  -- Award details
  category          TEXT        NOT NULL,
  -- Sport: player_of_tournament|top_scorer|top_assists|golden_glove|best_xi|mvp|fair_play
  -- Music: best_performance|headline_act|crowd_favourite|best_newcomer
  -- Hackathon: best_project|most_innovative|best_design|best_pitch|people_choice
  -- Conference: best_speaker|best_workshop|best_panel
  -- Universal: participant_of_year|most_valuable|best_in_show
  award_label       TEXT        NOT NULL,          -- human display, e.g. "Golden Boot"
  award_icon        TEXT        DEFAULT '🏆',
  -- Stats attached to the award (optional)
  stat_value        FLOAT,                         -- e.g. 12 (goals), 9.4 (score)
  stat_label        TEXT,                          -- e.g. "goals", "avg score"
  -- Season / context
  season            TEXT,                          -- "2024", "2024/25"
  notes             TEXT,
  -- Visibility
  is_published      BOOLEAN     DEFAULT false,
  created_by        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_awards_event     ON public.event_awards(event_id);
CREATE INDEX IF NOT EXISTS idx_event_awards_user      ON public.event_awards(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_event_awards_club      ON public.event_awards(recipient_club_id);

ALTER TABLE public.event_awards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "awards_read"   ON public.event_awards;
CREATE POLICY "awards_read"   ON public.event_awards FOR SELECT USING (is_published = true);
DROP POLICY IF EXISTS "awards_host"   ON public.event_awards;
CREATE POLICY "awards_host"   ON public.event_awards FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND author_id = auth.uid()));

-- ── PLAYER / PERFORMER CAREER STATS (cached aggregate) ────────────────────────
-- One row per user per sport/category — recomputed by trigger or on-demand
CREATE TABLE IF NOT EXISTS public.player_career_stats (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sport_type          TEXT        NOT NULL,
  -- Appearances
  events_count        INTEGER     DEFAULT 0,
  matches_count       INTEGER     DEFAULT 0,
  -- Offensive
  goals               INTEGER     DEFAULT 0,
  assists             INTEGER     DEFAULT 0,
  tries               INTEGER     DEFAULT 0,
  points_scored       INTEGER     DEFAULT 0,
  -- Defensive
  clean_sheets        INTEGER     DEFAULT 0,
  tackles             INTEGER     DEFAULT 0,
  -- Disciplinary
  yellow_cards        INTEGER     DEFAULT 0,
  red_cards           INTEGER     DEFAULT 0,
  -- Individual sports
  best_time           TEXT,
  best_distance       FLOAT,
  best_score          FLOAT,
  personal_bests      JSONB       DEFAULT '{}',
  -- Awards
  awards_count        INTEGER     DEFAULT 0,
  mvp_count           INTEGER     DEFAULT 0,
  -- Meta
  last_updated        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, sport_type)
);
CREATE INDEX IF NOT EXISTS idx_career_stats_user  ON public.player_career_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_career_stats_sport ON public.player_career_stats(sport_type);

ALTER TABLE public.player_career_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "career_stats_read"  ON public.player_career_stats;
CREATE POLICY "career_stats_read"  ON public.player_career_stats FOR SELECT USING (true);
DROP POLICY IF EXISTS "career_stats_own"   ON public.player_career_stats;
CREATE POLICY "career_stats_own"   ON public.player_career_stats FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── CLUB INVITATIONS ──────────────────────────────────────────────────────────
-- Club admin invites a player by user_id or email; player accepts to join
CREATE TABLE IF NOT EXISTS public.club_invitations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  inviter_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id  UUID        REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_email TEXT,
  role        TEXT        DEFAULT 'player',
  position    TEXT,
  message     TEXT,
  status      TEXT        DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','expired')),
  expires_at  TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_club_invitations_club    ON public.club_invitations(club_id);
CREATE INDEX IF NOT EXISTS idx_club_invitations_invitee ON public.club_invitations(invitee_id);

ALTER TABLE public.club_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invitations_own"   ON public.club_invitations;
CREATE POLICY "invitations_own"   ON public.club_invitations FOR ALL
  USING (invitee_id = auth.uid() OR inviter_id = auth.uid() OR
         EXISTS (SELECT 1 FROM public.clubs WHERE id = club_id AND owner_id = auth.uid()))
  WITH CHECK (inviter_id = auth.uid() OR
              EXISTS (SELECT 1 FROM public.clubs WHERE id = club_id AND owner_id = auth.uid()));

-- ── TRIGGER: sync members_count on clubs ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_club_members_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.clubs
  SET members_count = (
    SELECT COUNT(*) FROM public.club_memberships
    WHERE club_id = COALESCE(NEW.club_id, OLD.club_id) AND is_active = true
  )
  WHERE id = COALESCE(NEW.club_id, OLD.club_id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_club_members_count ON public.club_memberships;
CREATE TRIGGER trg_club_members_count
  AFTER INSERT OR UPDATE OR DELETE ON public.club_memberships
  FOR EACH ROW EXECUTE FUNCTION public.sync_club_members_count();

-- ── TRIGGER: increment awards_count on player_career_stats ───────────────────
CREATE OR REPLACE FUNCTION public.on_award_published()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_published = true AND NEW.recipient_user_id IS NOT NULL THEN
    INSERT INTO public.player_career_stats (user_id, sport_type, awards_count)
    VALUES (NEW.recipient_user_id, 'general', 1)
    ON CONFLICT (user_id, sport_type) DO UPDATE
      SET awards_count = player_career_stats.awards_count + 1,
          last_updated = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_published ON public.event_awards;
CREATE TRIGGER trg_award_published
  AFTER INSERT OR UPDATE OF is_published ON public.event_awards
  FOR EACH ROW WHEN (NEW.is_published = true)
  EXECUTE FUNCTION public.on_award_published();

-- ── REALTIME ──────────────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['clubs','club_memberships','event_awards','club_invitations'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END;
$$;
