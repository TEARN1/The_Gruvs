-- ============================================================
--  THE GRUVS — 07: GRUVS SOCIAL (Extended — Event Management)
--  event_rsvps, event_roles, event_checkins, event_chat,
--  event_polls, event_playlists, event_schedule, event_moments,
--  event_carpools, event_ratings, activity_feed, stories,
--  security_logs, tickets (QR), capacity enforcement
-- ============================================================

-- ── EVENT RSVPs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status     TEXT DEFAULT 'going' CHECK (status IN ('going','maybe','not_going')),
  tier       TEXT,
  tier_id    TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);
ALTER TABLE public.event_rsvps ADD COLUMN IF NOT EXISTS user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.event_rsvps ADD COLUMN IF NOT EXISTS tier       TEXT;
ALTER TABLE public.event_rsvps ADD COLUMN IF NOT EXISTS tier_id    TEXT;
ALTER TABLE public.event_rsvps ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_rsvps_event ON public.event_rsvps(event_id, status);
CREATE INDEX IF NOT EXISTS idx_rsvps_user  ON public.event_rsvps(user_id);

-- ── EVENT ROLES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('co_host','moderator','scanner','vip_manager')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- ── EVENT REMINDERS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_reminders (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  remind_at  TIMESTAMPTZ NOT NULL,
  sent       BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- ── EVENT CHAT ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message    TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 500),
  reply_to   UUID REFERENCES public.event_chat_messages(id) ON DELETE SET NULL,
  is_pinned  BOOLEAN DEFAULT false,
  deleted    BOOLEAN DEFAULT false,
  reactions  JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_event ON public.event_chat_messages(event_id, created_at DESC);

-- ── EVENT POLLS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_polls (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  question   TEXT NOT NULL,
  options    JSONB DEFAULT '[]',
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ends_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.event_polls ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.event_polls ADD COLUMN IF NOT EXISTS options    JSONB DEFAULT '[]';
ALTER TABLE public.event_polls ADD COLUMN IF NOT EXISTS ends_at    TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS public.event_poll_votes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id      UUID NOT NULL REFERENCES public.event_polls(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

-- ── EVENT PLAYLISTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_playlists (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name       TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.event_playlist_tracks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES public.event_playlists(id) ON DELETE CASCADE,
  track_id    TEXT NOT NULL,
  track_name  TEXT,
  artist      TEXT,
  album_art   TEXT,
  source      TEXT DEFAULT 'spotify',
  added_by    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  votes       INTEGER DEFAULT 0,
  position    INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.event_track_votes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id   UUID NOT NULL REFERENCES public.event_playlist_tracks(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(track_id, user_id)
);

-- ── EVENT SCHEDULE ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_schedule (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  start_time TEXT,
  title      TEXT NOT NULL,
  performer  TEXT,
  notes      TEXT,
  position   INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── EVENT MOMENTS (24hr stories) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_moments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url  TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image','video')),
  caption    TEXT,
  view_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_moments_event ON public.event_moments(event_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS public.event_moment_views (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moment_id  UUID NOT NULL REFERENCES public.event_moments(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(moment_id, user_id)
);
CREATE TABLE IF NOT EXISTS public.event_moment_reactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moment_id  UUID NOT NULL REFERENCES public.event_moments(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(moment_id, user_id)
);

-- ── STORIES (profile-level) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url  TEXT NOT NULL,
  media_type TEXT DEFAULT 'image' CHECK (media_type IN ('image','video')),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.story_views (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id   UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(story_id, user_id)
);

-- ── ACTIVITY FEED ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_feed (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL,
  event_id      UUID REFERENCES public.events(id) ON DELETE SET NULL,
  body          TEXT,
  title         TEXT,
  is_read       BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.activity_feed ADD COLUMN IF NOT EXISTS actor_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.activity_feed ADD COLUMN IF NOT EXISTS activity_type TEXT;
ALTER TABLE public.activity_feed ADD COLUMN IF NOT EXISTS event_id      UUID REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE public.activity_feed ADD COLUMN IF NOT EXISTS body          TEXT;
ALTER TABLE public.activity_feed ADD COLUMN IF NOT EXISTS title         TEXT;
ALTER TABLE public.activity_feed ADD COLUMN IF NOT EXISTS is_read       BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_activity_recipient ON public.activity_feed(recipient_id, created_at DESC);

-- ── SECURITY LOGS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.security_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type    TEXT NOT NULL,
  action        TEXT,
  resource_type TEXT,
  event_id      UUID REFERENCES public.events(id) ON DELETE SET NULL,
  rsvp_id       UUID,
  reason        TEXT,
  ip_hash       TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.security_logs ADD COLUMN IF NOT EXISTS user_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.security_logs ADD COLUMN IF NOT EXISTS event_type    TEXT;
ALTER TABLE public.security_logs ADD COLUMN IF NOT EXISTS action        TEXT;
ALTER TABLE public.security_logs ADD COLUMN IF NOT EXISTS resource_type TEXT;
ALTER TABLE public.security_logs ADD COLUMN IF NOT EXISTS event_id      UUID REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE public.security_logs ADD COLUMN IF NOT EXISTS rsvp_id       UUID;
ALTER TABLE public.security_logs ADD COLUMN IF NOT EXISTS reason        TEXT;
ALTER TABLE public.security_logs ADD COLUMN IF NOT EXISTS ip_hash       TEXT;
CREATE INDEX IF NOT EXISTS idx_security_logs_user ON public.security_logs(user_id, created_at DESC);

-- ── CAPACITY ENFORCEMENT TRIGGER ─────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_event_capacity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_capacity INTEGER;
  v_going    INTEGER;
BEGIN
  IF NEW.status != 'going' THEN RETURN NEW; END IF;
  SELECT COALESCE(capacity, max_attendees) INTO v_capacity FROM public.events WHERE id = NEW.event_id;
  IF v_capacity IS NULL OR v_capacity = 0 THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO v_going FROM public.event_rsvps WHERE event_id = NEW.event_id AND status = 'going';
  IF v_going >= v_capacity THEN
    RAISE EXCEPTION 'Event is at capacity (% / %)', v_going, v_capacity;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enforce_event_capacity_trigger ON public.event_rsvps;
CREATE TRIGGER enforce_event_capacity_trigger BEFORE INSERT OR UPDATE ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.enforce_event_capacity();

-- ── MOMENT VIEW COUNT SYNC ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_moment_view_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.event_moments SET view_count = COALESCE(view_count,0)+1 WHERE id = NEW.moment_id;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS sync_moment_view_count_trigger ON public.event_moment_views;
CREATE TRIGGER sync_moment_view_count_trigger AFTER INSERT ON public.event_moment_views
  FOR EACH ROW EXECUTE FUNCTION public.sync_moment_view_count();

-- ── CHAT MESSAGE VALIDATION ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_chat_message()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF length(trim(NEW.message)) < 1 OR length(NEW.message) > 500 THEN
    RAISE EXCEPTION 'Chat message must be 1–500 characters.';
  END IF;
  NEW.message = regexp_replace(NEW.message, '<script[^>]*>.*?</script>', '', 'gi');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS chat_message_validate ON public.event_chat_messages;
CREATE TRIGGER chat_message_validate BEFORE INSERT OR UPDATE ON public.event_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.validate_chat_message();

-- ── SECURE CHECK-IN RPC ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.secure_check_in(p_event_id uuid, p_rsvp_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rsvp  public.event_rsvps%ROWTYPE;
  v_event public.events%ROWTYPE;
BEGIN
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF auth.uid() != v_event.author_id THEN
    IF NOT EXISTS (SELECT 1 FROM public.event_roles
      WHERE event_id = p_event_id AND user_id = auth.uid() AND role IN ('co_host','moderator','scanner'))
    THEN RAISE EXCEPTION 'Unauthorized: not an event organiser or team member'; END IF;
  END IF;
  SELECT * INTO v_rsvp FROM public.event_rsvps WHERE id = p_rsvp_id AND event_id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket not found in guest list'; END IF;
  IF v_rsvp.status != 'going' THEN RAISE EXCEPTION 'RSVP status is "%" — not confirmed going', v_rsvp.status; END IF;
  IF v_rsvp.user_id != p_user_id THEN RAISE EXCEPTION 'Ticket user mismatch — possible forgery attempt'; END IF;
  INSERT INTO public.event_checkins(event_id, rsvp_id, user_id)
  VALUES (p_event_id, p_rsvp_id, p_user_id)
  ON CONFLICT (rsvp_id) DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'rsvp_id', p_rsvp_id, 'user_id', p_user_id);
END;
$$;

-- ── UPSERT RSVP TIER RPC ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_rsvp_tier(p_event_id UUID, p_user_id UUID, p_tier_id TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  INSERT INTO public.event_rsvps(event_id, user_id, status, tier_id)
  VALUES (p_event_id, p_user_id, 'going', p_tier_id)
  ON CONFLICT (event_id, user_id) DO UPDATE SET tier_id = EXCLUDED.tier_id, status = 'going';
END;
$$;

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.event_rsvps           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_roles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_reminders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_chat_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_polls           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_poll_votes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_playlists       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_playlist_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_track_votes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_schedule        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_moments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_moment_views    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_moment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_views           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_logs         ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rsvps_select"       ON public.event_rsvps;
DROP POLICY IF EXISTS "no_self_rsvp"       ON public.event_rsvps;
DROP POLICY IF EXISTS "no_self_rsvp_update" ON public.event_rsvps;
DROP POLICY IF EXISTS "rsvps_delete"       ON public.event_rsvps;
CREATE POLICY "rsvps_select"        ON public.event_rsvps FOR SELECT USING (true);
CREATE POLICY "no_self_rsvp"        ON public.event_rsvps FOR INSERT
  WITH CHECK (user_id = auth.uid() AND user_id != (SELECT author_id FROM public.events WHERE id = event_id));
CREATE POLICY "no_self_rsvp_update" ON public.event_rsvps FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id != (SELECT author_id FROM public.events WHERE id = event_id));
CREATE POLICY "rsvps_delete"        ON public.event_rsvps FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "roles_select_member"    ON public.event_roles;
DROP POLICY IF EXISTS "roles_insert_organiser" ON public.event_roles;
DROP POLICY IF EXISTS "roles_delete_organiser" ON public.event_roles;
CREATE POLICY "roles_select_member"    ON public.event_roles FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid()));
CREATE POLICY "roles_insert_organiser" ON public.event_roles FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid()));
CREATE POLICY "roles_delete_organiser" ON public.event_roles FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid()));

DROP POLICY IF EXISTS "reminders_manage" ON public.event_reminders;
CREATE POLICY "reminders_manage" ON public.event_reminders FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "chat_select_event_member" ON public.event_chat_messages;
DROP POLICY IF EXISTS "chat_insert_own"          ON public.event_chat_messages;
DROP POLICY IF EXISTS "chat_update_moderator"    ON public.event_chat_messages;
CREATE POLICY "chat_select_event_member" ON public.event_chat_messages FOR SELECT
  USING (deleted = false);
CREATE POLICY "chat_insert_own"          ON public.event_chat_messages FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "chat_update_moderator"    ON public.event_chat_messages FOR UPDATE
  USING (user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.event_roles r WHERE r.event_id = event_chat_messages.event_id AND r.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_chat_messages.event_id AND e.author_id = auth.uid()));

DROP POLICY IF EXISTS "polls_select_public" ON public.event_polls;
DROP POLICY IF EXISTS "polls_insert_host"   ON public.event_polls;
CREATE POLICY "polls_select_public" ON public.event_polls FOR SELECT USING (true);
CREATE POLICY "polls_insert_host"   ON public.event_polls FOR INSERT
  WITH CHECK (created_by = auth.uid() AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid()));

DROP POLICY IF EXISTS "votes_select_own"  ON public.event_poll_votes;
DROP POLICY IF EXISTS "votes_insert_once" ON public.event_poll_votes;
CREATE POLICY "votes_select_own"  ON public.event_poll_votes FOR SELECT USING (true);
CREATE POLICY "votes_insert_once" ON public.event_poll_votes FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "playlists_select"      ON public.event_playlists;
DROP POLICY IF EXISTS "playlists_manage_host" ON public.event_playlists;
CREATE POLICY "playlists_select"      ON public.event_playlists FOR SELECT USING (true);
CREATE POLICY "playlists_manage_host" ON public.event_playlists FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid()));

DROP POLICY IF EXISTS "playlist_tracks_select" ON public.event_playlist_tracks;
DROP POLICY IF EXISTS "playlist_tracks_insert" ON public.event_playlist_tracks;
CREATE POLICY "playlist_tracks_select" ON public.event_playlist_tracks FOR SELECT USING (true);
CREATE POLICY "playlist_tracks_insert" ON public.event_playlist_tracks FOR INSERT WITH CHECK (added_by = auth.uid());

DROP POLICY IF EXISTS "track_votes_select"     ON public.event_track_votes;
DROP POLICY IF EXISTS "track_votes_insert_own" ON public.event_track_votes;
CREATE POLICY "track_votes_select"     ON public.event_track_votes FOR SELECT USING (true);
CREATE POLICY "track_votes_insert_own" ON public.event_track_votes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "track_votes_delete"     ON public.event_track_votes FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "schedule_select" ON public.event_schedule;
DROP POLICY IF EXISTS "schedule_manage" ON public.event_schedule;
CREATE POLICY "schedule_select" ON public.event_schedule FOR SELECT USING (true);
CREATE POLICY "schedule_manage" ON public.event_schedule FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid()));

DROP POLICY IF EXISTS "moments_select" ON public.event_moments;
DROP POLICY IF EXISTS "moments_insert" ON public.event_moments;
DROP POLICY IF EXISTS "moments_delete" ON public.event_moments;
CREATE POLICY "moments_select" ON public.event_moments FOR SELECT USING (true);
CREATE POLICY "moments_insert" ON public.event_moments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "moments_delete" ON public.event_moments FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "moment_views_insert" ON public.event_moment_views;
CREATE POLICY "moment_views_insert" ON public.event_moment_views FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "moment_views_select" ON public.event_moment_views FOR SELECT USING (true);

DROP POLICY IF EXISTS "no_self_moment_reaction" ON public.event_moment_reactions;
CREATE POLICY "no_self_moment_reaction" ON public.event_moment_reactions FOR INSERT
  WITH CHECK (user_id = auth.uid() AND user_id != (SELECT user_id FROM public.event_moments WHERE id = moment_id));

DROP POLICY IF EXISTS "stories_select" ON public.stories;
DROP POLICY IF EXISTS "stories_manage" ON public.stories;
CREATE POLICY "stories_select" ON public.stories FOR SELECT USING (true);
CREATE POLICY "stories_manage" ON public.stories FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "story_views_manage" ON public.story_views;
CREATE POLICY "story_views_manage" ON public.story_views FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "activity_feed_select_own" ON public.activity_feed;
DROP POLICY IF EXISTS "activity_feed_insert_sys" ON public.activity_feed;
CREATE POLICY "activity_feed_select_own" ON public.activity_feed FOR SELECT USING (recipient_id = auth.uid());
CREATE POLICY "activity_feed_insert_sys" ON public.activity_feed FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR actor_id = auth.uid());

DROP POLICY IF EXISTS "security_logs_select" ON public.security_logs;
DROP POLICY IF EXISTS "security_logs_insert" ON public.security_logs;
CREATE POLICY "security_logs_select" ON public.security_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "security_logs_insert" ON public.security_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR user_id = auth.uid());
