-- ══════════════════════════════════════════════════════════════
--  THE GRUVS — CONSOLIDATED SCHEMA · PART 1 of 4
-- ══════════════════════════════════════════════════════════════
--  Byte-faithful concatenation of the original numbered migrations — the
--  originals are preserved in supabase/queries/archive/ (nothing deleted).
--  Covers: 01_security_hardening.sql … 12_gruvs_social.sql
--
--  ⚠️ NOT TOPOLOGICALLY SORTED — does NOT run clean on an EMPTY database.
--  The blocks are concatenated in original NUMBER order, but the foundational
--  base schema (profiles, events, event_rsvps, blocked_users, …) lives in the
--  LAST source block of this file (12_gruvs_social.sql, ~L2228+) and in part_2's
--  13_schema_v5.sql — yet the earlier 01–11 blocks already reference those
--  tables/functions. A top-down run on a fresh DB fails on the first forward
--  reference (e.g. the index on blocked_users near L116, or the GRANTs near
--  L157 on functions not defined until L1576+).
--
--  USE THESE FILES TO RE-APPLY AGAINST AN EXISTING, FULLY-BUILT DATABASE, where
--  every referenced object already exists and the IF-NOT-EXISTS / DROP-IF-EXISTS
--  guards make them effectively idempotent. For a brand-new database the base
--  schema (12_gruvs_social + 13_schema_v5) must be created FIRST.
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
--  SOURCE: 01_security_hardening.sql
-- ══════════════════════════════════════════════════════════════

-- ============================================================
--  THE GRUVS — 12: SECURITY HARDENING
--  public_profiles view, schema access controls,
--  security grants, audit helpers, rate-limit functions
-- ============================================================

-- ── Restrict schema creation ──────────────────────────────────
-- Prevents anon/authenticated roles from creating objects in public schema
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM anon;
REVOKE CREATE ON SCHEMA public FROM authenticated;

-- ── public_profiles view (safe projection) ───────────────────
-- Exposes only what anonymous visitors should see
DROP VIEW IF EXISTS public.public_profiles;
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  p.id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.bio,
  p.location,
  p.role,
  p.vibe_score,
  p.followers_count,
  p.following_count,
  p.xp,
  p.badges,
  p.is_verified AS verified,
  p.show_online,
  CASE WHEN p.show_online THEN p.last_seen ELSE NULL END AS last_seen,
  p.updated_at
FROM public.profiles p;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- ── Security definer wrapper for profile upsert ───────────────
-- Prevents users from escalating their own role/sis_score
CREATE OR REPLACE FUNCTION public.upsert_own_profile(
  p_display_name TEXT DEFAULT NULL,
  p_username     TEXT DEFAULT NULL,
  p_bio          TEXT DEFAULT NULL,
  p_location     TEXT DEFAULT NULL,
  p_avatar_url   TEXT DEFAULT NULL,
  p_cover_url    TEXT DEFAULT NULL,
  p_show_online  BOOLEAN DEFAULT NULL,
  p_share_events BOOLEAN DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET
    display_name = COALESCE(p_display_name, display_name),
    username     = COALESCE(p_username,     username),
    bio          = COALESCE(p_bio,          bio),
    location     = COALESCE(p_location,     location),
    avatar_url   = COALESCE(p_avatar_url,   avatar_url),
    cover_url    = COALESCE(p_cover_url,    cover_url),
    show_online  = COALESCE(p_show_online,  show_online),
    share_events = COALESCE(p_share_events, share_events),
    updated_at   = now()
  WHERE id = auth.uid();
END;
$$;

-- ── Rate limiter helper ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_action TEXT,
  p_window_seconds INTEGER DEFAULT 60,
  p_max_calls INTEGER DEFAULT 30
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Uses security_logs table from 07_gruvs_social.sql
  SELECT COUNT(*) INTO v_count
  FROM public.security_logs
  WHERE user_id = auth.uid()
    AND action = p_action
    AND created_at > now() - (p_window_seconds || ' seconds')::interval;
  RETURN v_count < p_max_calls;
END;
$$;

-- ── Log security event ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_action  TEXT,
  p_details JSONB DEFAULT '{}'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.security_logs (user_id, action, details)
  VALUES (auth.uid(), p_action, p_details);
END;
$$;

-- ── Blocked / muted users (tables defined in 01_gruvs_social.sql) ──
-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_blocked_users_user    ON public.blocked_users(user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON public.blocked_users(blocked_id);
CREATE INDEX IF NOT EXISTS idx_muted_users_user      ON public.muted_users(user_id);
CREATE INDEX IF NOT EXISTS idx_muted_users_muted     ON public.muted_users(muted_id);

-- ── Verify admin helper (used by admin-only RPCs) ─────────────
CREATE OR REPLACE FUNCTION public.assert_admin()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;
END;
$$;

-- ── Admin: promote/demote user ────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_user_role(p_user_id UUID, p_role TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin();
  IF p_role NOT IN ('user','host','vendor','moderator','admin') THEN
    RAISE EXCEPTION 'INVALID_ROLE';
  END IF;
  UPDATE public.profiles SET role = p_role WHERE id = p_user_id;
END;
$$;

-- ── Admin: suspend user ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_suspensions (
  user_id    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason     TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  suspended_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.user_suspensions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "suspensions_admin" ON public.user_suspensions;
CREATE POLICY "suspensions_admin" ON public.user_suspensions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── Grant execute on safe RPCs ────────────────────────────────
-- Guarded: grant only functions that already exist, by full signature (every
-- overload), so a fresh build never errors on a not-yet-created/forward-
-- referenced RPC and a multi-arg name never trips 42725. (Same loop as parts 3/4.)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'upsert_own_profile','check_rate_limit','log_security_event','secure_check_in',
        'upsert_rsvp_tier','generate_ticket_token','increment_wallet_balance',
        'update_sis_score','refresh_trending_events'
      )
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
  END LOOP;
END $$;


-- ══════════════════════════════════════════════════════════════
--  SOURCE: 02_realtime.sql
-- ══════════════════════════════════════════════════════════════

-- ============================================================
--  THE GRUVS — 11: REALTIME PUBLICATIONS
--  Enable Supabase Realtime for all tables that need live updates
-- ============================================================

-- ── Enable Realtime for all key tables ───────────────────────
DO $$ BEGIN
  -- Social core
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='profiles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='follows') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.follows; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; END IF;

  -- Events
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='events') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.events; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='event_vibes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_vibes; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='event_rsvps') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_rsvps; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='event_checkins') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_checkins; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='live_checkins') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_checkins; END IF;

  -- Pulse (live voting)
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='pulse_requests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pulse_requests; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='pulse_votes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pulse_votes; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='pulse_schedules') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pulse_schedules; END IF;

  -- Chat & DMs
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='dm_rooms') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_rooms; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='dm_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_messages; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='event_chat_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_chat_messages; END IF;

  -- Reels
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='reels') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reels; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='reel_likes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reel_likes; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='reel_comments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reel_comments; END IF;

  -- Moments & stories
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='event_moments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_moments; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='stories') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stories; END IF;

  -- Echoes & reactions
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='echoes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.echoes; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='echo_likes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.echo_likes; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='event_reactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_reactions; END IF;

  -- Movement OS
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='paths') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.paths; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='path_crossings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.path_crossings; END IF;

  -- Services & gigs
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='service_nodes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_nodes; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='service_bookings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_bookings; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='gig_posts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.gig_posts; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='gig_acceptances') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.gig_acceptances; END IF;

  -- Activity & polls
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='activity_feed') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_feed; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='event_polls') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_polls; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='event_poll_votes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_poll_votes; END IF;

  -- Wallet
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='wallet_transactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_transactions; END IF;

  -- Trending (table may not exist on a fresh build — guard with to_regclass)
  IF to_regclass('public.trending_events') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='trending_events') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trending_events; END IF;

  -- Notification queue (created later in this file — guard so a single-pass
  -- fresh build doesn't error; a re-run picks it up once it exists)
  IF to_regclass('public.notification_queue') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='notification_queue') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_queue; END IF;
END $$;


-- ══════════════════════════════════════════════════════════════
--  SOURCE: 03_push_notifications.sql
-- ══════════════════════════════════════════════════════════════

-- ============================================================
--  THE GRUVS — 10: PUSH NOTIFICATIONS & TICKET TOKENS
--  push_tokens, notification_queue, ticket_tokens,
--  send_event_day_notifications (pg_cron), generate_ticket_token RPC
-- ============================================================

-- ── PUSH TOKENS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  platform   TEXT NOT NULL CHECK (platform IN ('ios','android','web')),
  active     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, token)
);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user   ON public.push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON public.push_tokens(active) WHERE active = true;

-- ── NOTIFICATION QUEUE ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  data         JSONB DEFAULT '{}',
  category     TEXT DEFAULT 'general' CHECK (category IN (
                  'general','event_reminder','event_update','new_follower',
                  'rsvp_confirmed','pulse_update','chat_message','wallet','system')),
  priority     TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  scheduled_at TIMESTAMPTZ DEFAULT now(),
  sent_at      TIMESTAMPTZ,
  failed_at    TIMESTAMPTZ,
  error_msg    TEXT,
  attempts     INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_queue_user      ON public.notification_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_queue_scheduled ON public.notification_queue(scheduled_at) WHERE sent_at IS NULL AND failed_at IS NULL;

-- ── TICKET TOKENS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ticket_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rsvp_id     UUID NOT NULL, -- FK to event_rsvps(id) omitted: table may pre-exist without id PK
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  qr_payload  TEXT,
  used_at     TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ DEFAULT now() + interval '24 hours',
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_tokens_user  ON public.ticket_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_tokens_event ON public.ticket_tokens(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_tokens_token ON public.ticket_tokens(token);

-- ── NOTIFICATION PREFERENCES ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id               UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_reminders       BOOLEAN DEFAULT true,
  event_updates         BOOLEAN DEFAULT true,
  new_followers         BOOLEAN DEFAULT true,
  rsvp_confirmations    BOOLEAN DEFAULT true,
  pulse_updates         BOOLEAN DEFAULT true,
  chat_messages         BOOLEAN DEFAULT true,
  wallet_activity       BOOLEAN DEFAULT true,
  marketing             BOOLEAN DEFAULT false,
  quiet_hours_start     TIME DEFAULT '23:00',
  quiet_hours_end       TIME DEFAULT '07:00',
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- ── generate_ticket_token RPC ─────────────────────────────────
DROP FUNCTION IF EXISTS public.generate_ticket_token(uuid);
CREATE OR REPLACE FUNCTION public.generate_ticket_token(p_rsvp_id UUID)
RETURNS TABLE(token TEXT, qr_payload TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rsvp    public.event_rsvps%ROWTYPE;
  v_token   TEXT;
  v_payload TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_rsvp FROM public.event_rsvps WHERE id = p_rsvp_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'RSVP not found'; END IF;
  IF v_rsvp.user_id <> auth.uid() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  IF v_rsvp.status NOT IN ('confirmed','going') THEN RAISE EXCEPTION 'RSVP not confirmed'; END IF;

  -- Return existing valid token
  SELECT tt.token, tt.qr_payload, tt.expires_at
  INTO token, qr_payload, expires_at
  FROM public.ticket_tokens tt
  WHERE tt.rsvp_id = p_rsvp_id AND tt.expires_at > now() AND tt.used_at IS NULL
  LIMIT 1;

  IF FOUND THEN RETURN NEXT; RETURN; END IF;

  v_token   := encode(gen_random_bytes(32), 'hex');
  v_expires := now() + interval '48 hours';
  v_payload := json_build_object(
    'token',    v_token,
    'event_id', v_rsvp.event_id,
    'user_id',  v_rsvp.user_id,
    'rsvp_id',  p_rsvp_id,
    'exp',      extract(epoch from v_expires)::bigint
  )::text;

  INSERT INTO public.ticket_tokens (rsvp_id, user_id, event_id, token, qr_payload, expires_at)
  VALUES (p_rsvp_id, v_rsvp.user_id, v_rsvp.event_id, v_token, v_payload, v_expires);

  token      := v_token;
  qr_payload := v_payload;
  expires_at := v_expires;
  RETURN NEXT;
END;
$$;

-- ── send_event_day_notifications RPC (called by pg_cron) ──────
CREATE OR REPLACE FUNCTION public.send_event_day_notifications()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notification_queue (user_id, title, body, data, category, priority, scheduled_at)
  SELECT
    r.user_id,
    'Tonight: ' || e.title,
    'Doors open at ' || to_char(e.starts_at AT TIME ZONE 'Africa/Johannesburg', 'HH12:MI AM') || '. Your ticket is ready.',
    json_build_object('event_id', e.id, 'type', 'event_reminder')::jsonb,
    'event_reminder',
    'high',
    now()
  FROM public.event_rsvps r
  JOIN public.events e ON e.id = r.event_id
  JOIN public.notification_preferences np ON np.user_id = r.user_id
  WHERE r.status IN ('confirmed','going')
    AND np.event_reminders = true
    AND e.starts_at BETWEEN now() AND now() + interval '12 hours'
    AND NOT EXISTS (
      SELECT 1 FROM public.notification_queue nq
      WHERE nq.user_id = r.user_id
        AND nq.data->>'event_id' = e.id::text
        AND nq.category = 'event_reminder'
        AND nq.created_at > now() - interval '12 hours'
    );
END;
$$;

-- ── pg_cron: run every hour ───────────────────────────────────
-- Requires pg_cron extension enabled in Supabase dashboard
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'send-event-day-notifications',
      '0 * * * *',
      'SELECT public.send_event_day_notifications()'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.push_tokens               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_tokens             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_tokens_own" ON public.push_tokens;
CREATE POLICY "push_tokens_own" ON public.push_tokens FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notif_queue_own" ON public.notification_queue;
CREATE POLICY "notif_queue_own" ON public.notification_queue FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "ticket_tokens_own" ON public.ticket_tokens;
CREATE POLICY "ticket_tokens_own" ON public.ticket_tokens FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notif_prefs_own" ON public.notification_preferences;
CREATE POLICY "notif_prefs_own" ON public.notification_preferences FOR ALL USING (user_id = auth.uid());


-- ══════════════════════════════════════════════════════════════
--  SOURCE: 04_ai_and_analytics.sql
-- ══════════════════════════════════════════════════════════════

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
ALTER TABLE public.ai_interactions ADD COLUMN IF NOT EXISTS session_id  TEXT;
ALTER TABLE public.ai_interactions ADD COLUMN IF NOT EXISTS role        TEXT DEFAULT 'user';
ALTER TABLE public.ai_interactions ADD COLUMN IF NOT EXISTS content     TEXT;
ALTER TABLE public.ai_interactions ADD COLUMN IF NOT EXISTS tokens_used INTEGER DEFAULT 0;
ALTER TABLE public.ai_interactions ADD COLUMN IF NOT EXISTS model       TEXT DEFAULT 'claude-sonnet-4-6';
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
-- An earlier minimal ai_predictions (part_2: id/user_id/type/prediction/
-- created_at) may already exist, making the CREATE above a no-op. Ensure the
-- richer columns this feature + the indexes below need are present either way.
ALTER TABLE public.ai_predictions ADD COLUMN IF NOT EXISTS event_id        UUID REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE public.ai_predictions ADD COLUMN IF NOT EXISTS prediction_type TEXT;
ALTER TABLE public.ai_predictions ADD COLUMN IF NOT EXISTS predicted_value JSONB DEFAULT '{}';
ALTER TABLE public.ai_predictions ADD COLUMN IF NOT EXISTS confidence      NUMERIC(3,2) DEFAULT 0.5;
ALTER TABLE public.ai_predictions ADD COLUMN IF NOT EXISTS resolved        BOOLEAN DEFAULT false;
ALTER TABLE public.ai_predictions ADD COLUMN IF NOT EXISTS actual_value    JSONB;
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
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'trending_events' AND c.relkind = 'v') THEN
    DROP VIEW public.trending_events CASCADE;
  END IF;
END $$;
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


-- ══════════════════════════════════════════════════════════════
--  SOURCE: 05_business_and_ads.sql
-- ══════════════════════════════════════════════════════════════

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
ALTER TABLE public.governance_proposals ADD COLUMN IF NOT EXISTS created_by  UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.governance_proposals ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.governance_proposals ADD COLUMN IF NOT EXISTS status      TEXT DEFAULT 'open';
ALTER TABLE public.governance_proposals ADD COLUMN IF NOT EXISTS ends_at     TIMESTAMPTZ;
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

-- campaign_analytics / audience_segments had RLS enabled but NO policy, which
-- locks the owner out of their own campaign data. Scope both to the campaign owner.
-- Guard: an older/stub table may exist WITHOUT campaign_id (CREATE TABLE IF NOT
-- EXISTS above is a no-op then), so ensure the column exists before the policy
-- references it — otherwise the policy errors with 42703 column does not exist.
ALTER TABLE public.campaign_analytics ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.ad_campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.audience_segments  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.ad_campaigns(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "campaign_analytics_owner" ON public.campaign_analytics;
CREATE POLICY "campaign_analytics_owner" ON public.campaign_analytics FOR ALL
  USING (EXISTS (SELECT 1 FROM public.ad_campaigns c WHERE c.id = campaign_analytics.campaign_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "audience_segments_owner" ON public.audience_segments;
CREATE POLICY "audience_segments_owner" ON public.audience_segments FOR ALL
  USING (EXISTS (SELECT 1 FROM public.ad_campaigns c WHERE c.id = audience_segments.campaign_id AND c.user_id = auth.uid()));

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


-- ══════════════════════════════════════════════════════════════
--  SOURCE: 06_part_2.sql
-- ══════════════════════════════════════════════════════════════

-- ============================================================
--  THE GRUVS — 02: PART 2 (Movement OS)
--  paths, live presence TTL, path crossings, path stars,
--  service nodes (bakkie marketplace), service bookings,
--  disputes, gig posts, gig acceptances, dm rooms/messages,
--  contextual ads, new event features, live DB patch
-- ============================================================

-- ── PATHS (Movement OS) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.paths (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id       UUID REFERENCES public.events(id) ON DELETE SET NULL,
  origin_lat     FLOAT,
  origin_lon     FLOAT,
  origin_label   TEXT,
  dest_lat       FLOAT,
  dest_lon       FLOAT,
  dest_label     TEXT,
  intent_tag     TEXT DEFAULT 'attending'
    CHECK (intent_tag IN ('attending','going_home','service_run','exploring','scouting')),
  identity_layer TEXT DEFAULT 'public'
    CHECK (identity_layer IN ('public','ghost','celebrity')),
  ghost_alias    TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.paths ADD COLUMN IF NOT EXISTS event_id       UUID REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE public.paths ADD COLUMN IF NOT EXISTS origin_lat     FLOAT;
ALTER TABLE public.paths ADD COLUMN IF NOT EXISTS origin_lon     FLOAT;
ALTER TABLE public.paths ADD COLUMN IF NOT EXISTS origin_label   TEXT;
ALTER TABLE public.paths ADD COLUMN IF NOT EXISTS dest_lat       FLOAT;
ALTER TABLE public.paths ADD COLUMN IF NOT EXISTS dest_lon       FLOAT;
ALTER TABLE public.paths ADD COLUMN IF NOT EXISTS dest_label     TEXT;
ALTER TABLE public.paths ADD COLUMN IF NOT EXISTS intent_tag     TEXT DEFAULT 'attending';
ALTER TABLE public.paths ADD COLUMN IF NOT EXISTS identity_layer TEXT DEFAULT 'public';
ALTER TABLE public.paths ADD COLUMN IF NOT EXISTS ghost_alias    TEXT;

CREATE INDEX IF NOT EXISTS idx_paths_user    ON public.paths(user_id);
CREATE INDEX IF NOT EXISTS idx_paths_event   ON public.paths(event_id);
CREATE INDEX IF NOT EXISTS idx_paths_dest    ON public.paths(dest_lat, dest_lon);

-- ── PATH CROSSINGS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.path_crossings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id_a     UUID NOT NULL REFERENCES public.paths(id) ON DELETE CASCADE,
  path_id_b     UUID NOT NULL REFERENCES public.paths(id) ON DELETE CASCADE,
  overlap_score FLOAT DEFAULT 0,
  crossed_at    TIMESTAMPTZ DEFAULT now()
);

-- ── PATH STARS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.path_stars (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  path_id    UUID REFERENCES public.paths(id) ON DELETE CASCADE,
  place_name TEXT,
  lat        FLOAT,
  lon        FLOAT,
  starred_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, path_id)
);

-- user_paths view for PathMapScreen
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'user_paths' AND c.relkind = 'r') THEN
    DROP TABLE public.user_paths CASCADE;
  END IF;
END $$;
CREATE OR REPLACE VIEW public.user_paths AS SELECT * FROM public.paths;

-- ── SERVICE NODES (Bakkie Marketplace) ───────────────────────
CREATE TABLE IF NOT EXISTS public.service_nodes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title        TEXT,
  name         TEXT,
  description  TEXT,
  service_type TEXT CHECK (service_type IN ('moving','delivery','event_logistics','rides')),
  vehicle_type TEXT,
  capacity_kg  INTEGER,
  price        NUMERIC(10,2),
  price_per_km NUMERIC(8,2),
  base_price   NUMERIC(8,2),
  price_min    NUMERIC,
  price_max    NUMERIC,
  location     TEXT,
  lat          DOUBLE PRECISION,
  lon          DOUBLE PRECISION,
  is_active    BOOLEAN DEFAULT true,
  available    BOOLEAN DEFAULT true,
  event_id     UUID REFERENCES public.events(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS event_id     UUID REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS provider_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS title        TEXT;
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS name         TEXT;
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS vehicle_type TEXT;
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS capacity_kg  INTEGER;
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS price        NUMERIC(10,2);
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS price_per_km NUMERIC(8,2);
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS base_price   NUMERIC(8,2);
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS price_min    NUMERIC;
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS price_max    NUMERIC;
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS is_active    BOOLEAN DEFAULT true;
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS available    BOOLEAN DEFAULT true;
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS lat          DOUBLE PRECISION;
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS lon          DOUBLE PRECISION;
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS location     TEXT;
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS description  TEXT;
ALTER TABLE public.service_nodes ADD COLUMN IF NOT EXISTS service_type TEXT;

CREATE INDEX IF NOT EXISTS idx_service_nodes_user     ON public.service_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_service_nodes_type     ON public.service_nodes(service_type);
CREATE INDEX IF NOT EXISTS idx_service_nodes_location ON public.service_nodes(lat, lon);

-- ── SERVICE BOOKINGS (Escrow) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.service_bookings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_node_id  UUID NOT NULL REFERENCES public.service_nodes(id) ON DELETE CASCADE,
  client_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cargo_type       TEXT,
  pickup_address   TEXT,
  dropoff_address  TEXT,
  scheduled_at     TIMESTAMPTZ,
  estimated_price  NUMERIC(10,2),
  amount_cents     INTEGER,
  status           TEXT NOT NULL DEFAULT 'escrow_held'
    CHECK (status IN ('escrow_held','in_progress','completed','disputed','cancelled')),
  escrow_held_at   TIMESTAMPTZ DEFAULT now(),
  completed_at     TIMESTAMPTZ,
  disputed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bookings_client   ON public.service_bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_provider ON public.service_bookings(provider_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status   ON public.service_bookings(status);

CREATE TABLE IF NOT EXISTS public.service_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES public.service_bookings(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── DISPUTES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.disputes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.service_bookings(id) ON DELETE CASCADE,
  filed_by   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason     TEXT,
  status     TEXT DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS filed_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ── GIG POSTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gig_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  poster_id   UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id    UUID REFERENCES public.events(id) ON DELETE SET NULL,
  title       TEXT,
  description TEXT,
  category    TEXT CHECK (category IN ('moving','assembly','packing','crew','other')),
  pay         NUMERIC,
  pay_rands   NUMERIC,
  pay_amount  NUMERIC(8,2),
  time_window TEXT DEFAULT 'Flexible',
  lat         FLOAT,
  lon         FLOAT,
  slots       INTEGER DEFAULT 1,
  filled      INTEGER DEFAULT 0,
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.gig_posts ADD COLUMN IF NOT EXISTS poster_id   UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.gig_posts ADD COLUMN IF NOT EXISTS event_id    UUID REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE public.gig_posts ADD COLUMN IF NOT EXISTS title       TEXT;
ALTER TABLE public.gig_posts ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.gig_posts ADD COLUMN IF NOT EXISTS category    TEXT;
ALTER TABLE public.gig_posts ADD COLUMN IF NOT EXISTS pay         NUMERIC;
ALTER TABLE public.gig_posts ADD COLUMN IF NOT EXISTS pay_rands   NUMERIC;
ALTER TABLE public.gig_posts ADD COLUMN IF NOT EXISTS pay_amount  NUMERIC(8,2);
ALTER TABLE public.gig_posts ADD COLUMN IF NOT EXISTS time_window TEXT DEFAULT 'Flexible';
ALTER TABLE public.gig_posts ADD COLUMN IF NOT EXISTS lat         FLOAT;
ALTER TABLE public.gig_posts ADD COLUMN IF NOT EXISTS lon         FLOAT;
ALTER TABLE public.gig_posts ADD COLUMN IF NOT EXISTS slots       INTEGER DEFAULT 1;
ALTER TABLE public.gig_posts ADD COLUMN IF NOT EXISTS filled      INTEGER DEFAULT 0;
ALTER TABLE public.gig_posts ADD COLUMN IF NOT EXISTS active      BOOLEAN DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_gig_posts_event  ON public.gig_posts(event_id);
CREATE INDEX IF NOT EXISTS idx_gig_posts_active ON public.gig_posts(active);

CREATE TABLE IF NOT EXISTS public.gig_acceptances (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id     UUID NOT NULL REFERENCES public.gig_posts(id) ON DELETE CASCADE,
  worker_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ DEFAULT now(),
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.gig_acceptances ADD COLUMN IF NOT EXISTS worker_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.gig_acceptances ADD COLUMN IF NOT EXISTS user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.gig_acceptances ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS idx_gig_acceptances_worker
  ON public.gig_acceptances(gig_id, worker_id) WHERE worker_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_gig_acceptances_user
  ON public.gig_acceptances(gig_id, user_id) WHERE user_id IS NOT NULL AND worker_id IS NULL;

-- ── DM ROOMS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dm_rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES public.events(id) ON DELETE SET NULL,
  participant_ids UUID[],
  last_message    TEXT,
  last_message_at TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_a, user_b, event_id)
);
ALTER TABLE public.dm_rooms ADD COLUMN IF NOT EXISTS user_a          UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.dm_rooms ADD COLUMN IF NOT EXISTS user_b          UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.dm_rooms ADD COLUMN IF NOT EXISTS event_id        UUID REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE public.dm_rooms ADD COLUMN IF NOT EXISTS participant_ids UUID[];
ALTER TABLE public.dm_rooms ADD COLUMN IF NOT EXISTS last_message    TEXT;
ALTER TABLE public.dm_rooms ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;
ALTER TABLE public.dm_rooms ADD COLUMN IF NOT EXISTS expires_at      TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_dm_rooms_user_a ON public.dm_rooms(user_a);
CREATE INDEX IF NOT EXISTS idx_dm_rooms_user_b ON public.dm_rooms(user_b);

CREATE TABLE IF NOT EXISTS public.dm_messages (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id   UUID NOT NULL REFERENCES public.dm_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body      TEXT NOT NULL,
  sent_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dm_messages_room ON public.dm_messages(room_id, sent_at DESC);

-- ── CONTEXTUAL ADS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contextual_ads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT DEFAULT 'event' CHECK (type IN ('event','service','gig')),
  headline    TEXT,
  subline     TEXT,
  cta         TEXT DEFAULT 'View',
  color       TEXT,
  icon        TEXT DEFAULT 'zap',
  badge       TEXT DEFAULT 'PROMOTED',
  event_id    UUID REFERENCES public.events(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.ad_campaigns(id) ON DELETE SET NULL,
  priority    INTEGER DEFAULT 0,
  position    TEXT,
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contextual_ads_active ON public.contextual_ads(active, priority DESC);

-- ── WALLET TRANSACTIONS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount     NUMERIC(10,2) NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('credit','debit','escrow','release','refund')),
  reference  TEXT,
  meta       JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── EVENT UPDATES (organiser live posts) ─────────────────────
CREATE TABLE IF NOT EXISTS public.event_updates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  update_type TEXT DEFAULT 'info' CHECK (update_type IN ('info','hype','change','shoutout')),
  media_url   TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── EVENT WAITLIST ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_waitlist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- ── EVENT CARPOOLS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_carpools (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  driver_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seats_available  INTEGER DEFAULT 3 CHECK (seats_available BETWEEN 1 AND 10),
  departure_area   TEXT,
  pickup_address   TEXT,
  pickup_lat       DOUBLE PRECISION,
  pickup_lon       DOUBLE PRECISION,
  departure_time   TIMESTAMPTZ,
  note             TEXT,
  return_trip      BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_carpool_requests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carpool_id UUID NOT NULL REFERENCES public.event_carpools(id) ON DELETE CASCADE,
  event_id   UUID REFERENCES public.events(id) ON DELETE CASCADE,
  rider_id   UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status     TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at TIMESTAMPTZ DEFAULT now()
);
-- An earlier event_carpool_requests (part_2: carpool_id/user_id only) may have
-- won the CREATE, so ensure rider_id/event_id exist before the policy below
-- references rider_id.
ALTER TABLE public.event_carpool_requests ADD COLUMN IF NOT EXISTS rider_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.event_carpool_requests ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id)   ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ecr_carpool ON public.event_carpool_requests(carpool_id);

-- ── RPCs ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_sis_score(p_user_id UUID, p_delta INT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles
  SET social_integrity_score = GREATEST(0, LEAST(100, COALESCE(social_integrity_score,50) + p_delta))
  WHERE id = p_user_id;
END;
$$;

DROP FUNCTION IF EXISTS public.increment_wallet_balance(uuid, numeric);
CREATE OR REPLACE FUNCTION public.increment_wallet_balance(p_user_id UUID, p_amount NUMERIC)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance,0) + p_amount WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_expired_checkins()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.live_checkins WHERE expires_at IS NOT NULL AND expires_at < NOW();
$$;

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.paths              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.path_crossings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.path_stars         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_nodes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_bookings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_reviews    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_posts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_acceptances    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_rooms           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contextual_ads     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_updates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_waitlist     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_carpools     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_carpool_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "paths_owner"  ON public.paths;
DROP POLICY IF EXISTS "paths_public" ON public.paths;
CREATE POLICY "paths_owner"  ON public.paths FOR ALL    USING (auth.uid() = user_id);
CREATE POLICY "paths_public" ON public.paths FOR SELECT USING (identity_layer = 'public');

DROP POLICY IF EXISTS "path_stars_own"     ON public.path_stars;
CREATE POLICY "path_stars_own"     ON public.path_stars    FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "path_crossings_own" ON public.path_crossings;
CREATE POLICY "path_crossings_own" ON public.path_crossings FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "service_nodes_select" ON public.service_nodes;
DROP POLICY IF EXISTS "service_nodes_manage" ON public.service_nodes;
CREATE POLICY "service_nodes_select" ON public.service_nodes FOR SELECT USING (available = true OR is_active = true);
CREATE POLICY "service_nodes_manage" ON public.service_nodes FOR ALL
  USING (user_id = auth.uid() OR provider_id = auth.uid());

DROP POLICY IF EXISTS "service_bookings_manage" ON public.service_bookings;
CREATE POLICY "service_bookings_manage" ON public.service_bookings FOR ALL
  USING (client_id = auth.uid() OR provider_id = auth.uid());

DROP POLICY IF EXISTS "service_reviews_select" ON public.service_reviews;
DROP POLICY IF EXISTS "service_reviews_manage" ON public.service_reviews;
CREATE POLICY "service_reviews_select" ON public.service_reviews FOR SELECT USING (true);
CREATE POLICY "service_reviews_manage" ON public.service_reviews FOR ALL USING (reviewer_id = auth.uid());

DROP POLICY IF EXISTS "disputes_manage" ON public.disputes;
CREATE POLICY "disputes_manage" ON public.disputes FOR ALL USING (filed_by = auth.uid());

DROP POLICY IF EXISTS "gigs_readable"   ON public.gig_posts;
DROP POLICY IF EXISTS "gigs_manage_own" ON public.gig_posts;
CREATE POLICY "gigs_readable"   ON public.gig_posts FOR SELECT USING (active = true);
CREATE POLICY "gigs_manage_own" ON public.gig_posts FOR ALL
  USING (user_id = auth.uid() OR poster_id = auth.uid());

DROP POLICY IF EXISTS "gig_acceptances_manage" ON public.gig_acceptances;
CREATE POLICY "gig_acceptances_manage" ON public.gig_acceptances FOR ALL
  USING (user_id = auth.uid() OR worker_id = auth.uid());

DROP POLICY IF EXISTS "dm_rooms_manage"   ON public.dm_rooms;
CREATE POLICY "dm_rooms_manage" ON public.dm_rooms FOR ALL
  USING (user_a = auth.uid() OR user_b = auth.uid() OR participant_ids @> ARRAY[auth.uid()]);

DROP POLICY IF EXISTS "dm_messages_insert" ON public.dm_messages;
DROP POLICY IF EXISTS "dm_messages_select" ON public.dm_messages;
CREATE POLICY "dm_messages_insert" ON public.dm_messages FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY "dm_messages_select" ON public.dm_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.dm_rooms r WHERE r.id = room_id
    AND (r.user_a = auth.uid() OR r.user_b = auth.uid()
      OR r.participant_ids @> ARRAY[auth.uid()])));

DROP POLICY IF EXISTS "contextual_ads_select" ON public.contextual_ads;
CREATE POLICY "contextual_ads_select" ON public.contextual_ads FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "wallet_own" ON public.wallet_transactions;
CREATE POLICY "wallet_own" ON public.wallet_transactions FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "updates_select" ON public.event_updates;
DROP POLICY IF EXISTS "updates_insert" ON public.event_updates;
CREATE POLICY "updates_select" ON public.event_updates FOR SELECT USING (true);
CREATE POLICY "updates_insert" ON public.event_updates FOR INSERT
  WITH CHECK (author_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid()
  ));

DROP POLICY IF EXISTS "waitlist_select" ON public.event_waitlist;
DROP POLICY IF EXISTS "waitlist_manage" ON public.event_waitlist;
CREATE POLICY "waitlist_select" ON public.event_waitlist FOR SELECT USING (true);
CREATE POLICY "waitlist_manage" ON public.event_waitlist FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "carpools_select" ON public.event_carpools;
DROP POLICY IF EXISTS "carpools_manage" ON public.event_carpools;
CREATE POLICY "carpools_select" ON public.event_carpools FOR SELECT USING (true);
CREATE POLICY "carpools_manage" ON public.event_carpools FOR ALL USING (driver_id = auth.uid());

DROP POLICY IF EXISTS "carpool_requests_select" ON public.event_carpool_requests;
DROP POLICY IF EXISTS "carpool_requests_manage" ON public.event_carpool_requests;
CREATE POLICY "carpool_requests_select" ON public.event_carpool_requests FOR SELECT USING (true);
CREATE POLICY "carpool_requests_manage" ON public.event_carpool_requests FOR ALL
  USING (rider_id = auth.uid() OR user_id = auth.uid());


-- ══════════════════════════════════════════════════════════════
--  SOURCE: 07_gruvs_social_extended.sql
-- ══════════════════════════════════════════════════════════════

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
ALTER TABLE public.event_roles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.event_roles ADD COLUMN IF NOT EXISTS role    TEXT;

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
ALTER TABLE public.event_reminders ADD COLUMN IF NOT EXISTS user_id   UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.event_reminders ADD COLUMN IF NOT EXISTS remind_at TIMESTAMPTZ;
ALTER TABLE public.event_reminders ADD COLUMN IF NOT EXISTS sent      BOOLEAN DEFAULT false;

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
ALTER TABLE public.event_chat_messages ADD COLUMN IF NOT EXISTS user_id   UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.event_chat_messages ADD COLUMN IF NOT EXISTS reply_to  UUID REFERENCES public.event_chat_messages(id) ON DELETE SET NULL;
ALTER TABLE public.event_chat_messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
ALTER TABLE public.event_chat_messages ADD COLUMN IF NOT EXISTS deleted   BOOLEAN DEFAULT false;
ALTER TABLE public.event_chat_messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}';
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
ALTER TABLE public.event_track_votes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

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
ALTER TABLE public.event_moments ADD COLUMN IF NOT EXISTS user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.event_moments ADD COLUMN IF NOT EXISTS media_url  TEXT;
ALTER TABLE public.event_moments ADD COLUMN IF NOT EXISTS media_type TEXT;
ALTER TABLE public.event_moments ADD COLUMN IF NOT EXISTS caption    TEXT;
ALTER TABLE public.event_moments ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE public.event_moments ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours');
CREATE INDEX IF NOT EXISTS idx_moments_event ON public.event_moments(event_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS public.event_moment_views (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moment_id  UUID NOT NULL REFERENCES public.event_moments(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(moment_id, user_id)
);
ALTER TABLE public.event_moment_views ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
CREATE TABLE IF NOT EXISTS public.event_moment_reactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moment_id  UUID NOT NULL REFERENCES public.event_moments(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(moment_id, user_id)
);
ALTER TABLE public.event_moment_reactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.event_moment_reactions ADD COLUMN IF NOT EXISTS emoji   TEXT;

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
ALTER TABLE public.stories     ADD COLUMN IF NOT EXISTS user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.stories     ADD COLUMN IF NOT EXISTS media_url  TEXT;
ALTER TABLE public.stories     ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'image';
ALTER TABLE public.stories     ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours');
ALTER TABLE public.story_views ADD COLUMN IF NOT EXISTS user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

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
  USING (deleted = false AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.is_published = true));
CREATE POLICY "chat_insert_own"          ON public.event_chat_messages FOR INSERT
  WITH CHECK (user_id = auth.uid() AND length(trim(message)) BETWEEN 1 AND 500);
CREATE POLICY "chat_update_moderator"    ON public.event_chat_messages FOR UPDATE
  USING (user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.event_roles r WHERE r.event_id = event_chat_messages.event_id AND r.user_id = auth.uid() AND r.role IN ('co_host','moderator'))
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
DROP POLICY IF EXISTS "track_votes_delete"     ON public.event_track_votes;
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
DROP POLICY IF EXISTS "moment_views_select" ON public.event_moment_views;
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


-- ══════════════════════════════════════════════════════════════
--  SOURCE: 08_untitled_reels_full.sql
-- ══════════════════════════════════════════════════════════════

-- ============================================================
--  THE GRUVS — 03: UNTITLED (Reels — Full)
--  reels, reel_likes, reel_comments, reel_views,
--  saved_reels, reel_reports + count triggers + RLS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id      UUID REFERENCES public.events(id) ON DELETE SET NULL,
  event_title   TEXT,
  media_url     TEXT NOT NULL,
  media_type    TEXT DEFAULT 'video' CHECK (media_type IN ('video','image')),
  caption       TEXT CHECK (length(caption) <= 500),
  sound_name    TEXT,
  hashtags      TEXT[],
  like_count    INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  view_count    INTEGER DEFAULT 0,
  likes_count   INTEGER DEFAULT 0,
  views_count   INTEGER DEFAULT 0,
  is_deleted    BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
-- Reel composer extras: creator metadata (filters/stickers/trim/aura) + visibility.
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS metadata   JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS visibility TEXT  DEFAULT 'public'
  CHECK (visibility IN ('public','private','attendees'));
CREATE INDEX IF NOT EXISTS idx_reels_user       ON public.reels(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reels_event      ON public.reels(event_id);
CREATE INDEX IF NOT EXISTS idx_reels_feed       ON public.reels(created_at DESC) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_reels_likes      ON public.reels(like_count DESC) WHERE is_deleted = false;

CREATE TABLE IF NOT EXISTS public.reel_likes (
  reel_id    UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY(reel_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reel_likes_user ON public.reel_likes(user_id);

CREATE TABLE IF NOT EXISTS public.reel_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id    UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reel_comments_reel ON public.reel_comments(reel_id);

CREATE TABLE IF NOT EXISTS public.reel_views (
  reel_id    UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  viewer_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY(reel_id, viewer_id)
);
-- part_2 defines reel_views as reel_id/user_id only; the app (ViewsBatchQueue)
-- writes viewer_id and the policy below reads it. Ensure both columns exist
-- regardless of which CREATE won.
ALTER TABLE public.reel_views ADD COLUMN IF NOT EXISTS viewer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.reel_views ADD COLUMN IF NOT EXISTS user_id   UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.saved_reels (
  reel_id    UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY(reel_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_reels_user ON public.saved_reels(user_id);

CREATE TABLE IF NOT EXISTS public.reel_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id     UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.reel_reports ADD COLUMN IF NOT EXISTS reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.reel_reports ADD COLUMN IF NOT EXISTS user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_reel_reports_reporter
  ON public.reel_reports(reel_id, reporter_id) WHERE reporter_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_reel_reports_user
  ON public.reel_reports(reel_id, user_id) WHERE user_id IS NOT NULL AND reporter_id IS NULL;

-- ── Count sync triggers ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_reel_like_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels SET like_count = COALESCE(like_count,0)+1, likes_count = COALESCE(likes_count,0)+1 WHERE id = NEW.reel_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels SET like_count = GREATEST(0,COALESCE(like_count,0)-1), likes_count = GREATEST(0,COALESCE(likes_count,0)-1) WHERE id = OLD.reel_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS reel_like_count_trigger ON public.reel_likes;
CREATE TRIGGER reel_like_count_trigger AFTER INSERT OR DELETE ON public.reel_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_reel_like_count();

CREATE OR REPLACE FUNCTION public.sync_reel_comment_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels SET comment_count = COALESCE(comment_count,0)+1 WHERE id = NEW.reel_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels SET comment_count = GREATEST(0,COALESCE(comment_count,0)-1) WHERE id = OLD.reel_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS reel_comment_count_trigger ON public.reel_comments;
CREATE TRIGGER reel_comment_count_trigger AFTER INSERT OR DELETE ON public.reel_comments
  FOR EACH ROW EXECUTE FUNCTION public.sync_reel_comment_count();

CREATE OR REPLACE FUNCTION public.sync_reel_view_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.reels SET view_count = COALESCE(view_count,0)+1, views_count = COALESCE(views_count,0)+1 WHERE id = NEW.reel_id;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS reel_view_count_trigger ON public.reel_views;
CREATE TRIGGER reel_view_count_trigger AFTER INSERT ON public.reel_views
  FOR EACH ROW EXECUTE FUNCTION public.sync_reel_view_count();

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.reels        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_likes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_views   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_reels  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reels_select"     ON public.reels;
DROP POLICY IF EXISTS "reels_insert"     ON public.reels;
DROP POLICY IF EXISTS "reels_update_own" ON public.reels;
DROP POLICY IF EXISTS "reels_delete_own" ON public.reels;
CREATE POLICY "reels_select"     ON public.reels FOR SELECT USING (is_deleted = false);
CREATE POLICY "reels_insert"     ON public.reels FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "reels_update_own" ON public.reels FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "reels_delete_own" ON public.reels FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "reel_likes_select" ON public.reel_likes;
DROP POLICY IF EXISTS "reel_likes_manage" ON public.reel_likes;
CREATE POLICY "reel_likes_select" ON public.reel_likes FOR SELECT USING (true);
CREATE POLICY "reel_likes_manage" ON public.reel_likes FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "reel_comments_select" ON public.reel_comments;
DROP POLICY IF EXISTS "reel_comments_manage" ON public.reel_comments;
CREATE POLICY "reel_comments_select" ON public.reel_comments FOR SELECT USING (true);
CREATE POLICY "reel_comments_manage" ON public.reel_comments FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "reel_views_manage" ON public.reel_views;
CREATE POLICY "reel_views_manage" ON public.reel_views FOR ALL
  USING (viewer_id = auth.uid() OR user_id = auth.uid());

DROP POLICY IF EXISTS "saved_reels_manage" ON public.saved_reels;
CREATE POLICY "saved_reels_manage" ON public.saved_reels FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "reel_reports_insert" ON public.reel_reports;
CREATE POLICY "reel_reports_insert" ON public.reel_reports FOR INSERT
  WITH CHECK (reporter_id = auth.uid() OR user_id = auth.uid());


-- ══════════════════════════════════════════════════════════════
--  SOURCE: 09_reels_likes_comments.sql
-- ══════════════════════════════════════════════════════════════

-- ============================================================
--  THE GRUVS — 05: REELS, LIKES AND COMMENTS
--  Lightweight reels patch — safe to run after 03_untitled.
--  Adds any missing columns, fixes policies, re-creates triggers.
-- ============================================================

-- Ensure all columns exist (idempotent on top of 03)
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS like_count    INTEGER DEFAULT 0;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS view_count    INTEGER DEFAULT 0;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS is_deleted    BOOLEAN DEFAULT false;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS caption       TEXT;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS event_id      UUID REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS event_title   TEXT;

-- Ensure indexes
CREATE INDEX IF NOT EXISTS idx_reels_user_id    ON public.reels(user_id);
CREATE INDEX IF NOT EXISTS idx_reels_created_at ON public.reels(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reel_comments_reel_idx ON public.reel_comments(reel_id);

-- ── RLS (clean slate, idempotent) ────────────────────────────
ALTER TABLE public.reels         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_likes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reels_select"  ON public.reels;
DROP POLICY IF EXISTS "reels_insert"  ON public.reels;
DROP POLICY IF EXISTS "reels_update"  ON public.reels;
DROP POLICY IF EXISTS "reels_delete"  ON public.reels;
CREATE POLICY "reels_select" ON public.reels FOR SELECT USING (is_deleted = false);
CREATE POLICY "reels_insert" ON public.reels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reels_update" ON public.reels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "reels_delete" ON public.reels FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reel_likes_select" ON public.reel_likes;
DROP POLICY IF EXISTS "reel_likes_insert" ON public.reel_likes;
DROP POLICY IF EXISTS "reel_likes_delete" ON public.reel_likes;
CREATE POLICY "reel_likes_select" ON public.reel_likes FOR SELECT USING (true);
CREATE POLICY "reel_likes_insert" ON public.reel_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reel_likes_delete" ON public.reel_likes FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reel_comments_select" ON public.reel_comments;
DROP POLICY IF EXISTS "reel_comments_insert" ON public.reel_comments;
DROP POLICY IF EXISTS "reel_comments_delete" ON public.reel_comments;
CREATE POLICY "reel_comments_select" ON public.reel_comments FOR SELECT USING (true);
CREATE POLICY "reel_comments_insert" ON public.reel_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reel_comments_delete" ON public.reel_comments FOR DELETE USING (auth.uid() = user_id);

-- ── Triggers (re-create, idempotent) ─────────────────────────
CREATE OR REPLACE FUNCTION public.sync_reel_like_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels SET like_count = COALESCE(like_count,0)+1 WHERE id = NEW.reel_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels SET like_count = GREATEST(0,COALESCE(like_count,0)-1) WHERE id = OLD.reel_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS reel_like_count_trigger ON public.reel_likes;
CREATE TRIGGER reel_like_count_trigger AFTER INSERT OR DELETE ON public.reel_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_reel_like_count();

CREATE OR REPLACE FUNCTION public.sync_reel_comment_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels SET comment_count = COALESCE(comment_count,0)+1 WHERE id = NEW.reel_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels SET comment_count = GREATEST(0,COALESCE(comment_count,0)-1) WHERE id = OLD.reel_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS reel_comment_count_trigger ON public.reel_comments;
CREATE TRIGGER reel_comment_count_trigger AFTER INSERT OR DELETE ON public.reel_comments
  FOR EACH ROW EXECUTE FUNCTION public.sync_reel_comment_count();


-- ══════════════════════════════════════════════════════════════
--  SOURCE: 10_untitled_pulse.sql
-- ══════════════════════════════════════════════════════════════

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


-- ══════════════════════════════════════════════════════════════
--  SOURCE: 11_reels_and_storage.sql
-- ══════════════════════════════════════════════════════════════

-- ============================================================
--  THE GRUVS — 06: REELS AND STORAGE
--  Profile column patches, follows fix, reels table,
--  all storage buckets + RLS policies
-- ============================================================

-- ── Profile column patches ────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_gallery TEXT[]  DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges          TEXT[]  DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp              INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen       TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_online     BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS share_events    BOOLEAN DEFAULT false;

-- ── Fix follows RLS so Follow button works ───────────────────
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Follows readable"         ON public.follows;
DROP POLICY IF EXISTS "Users manage own follows" ON public.follows;
CREATE POLICY "Follows readable"         ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users manage own follows" ON public.follows FOR ALL USING (auth.uid() = follower_id);

-- ── Reels table (idempotent) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url     TEXT NOT NULL,
  media_type    TEXT DEFAULT 'video' CHECK (media_type IN ('video','image')),
  caption       TEXT DEFAULT '',
  event_id      UUID REFERENCES public.events(id) ON DELETE SET NULL,
  event_title   TEXT,
  like_count    INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  view_count    INTEGER DEFAULT 0,
  is_deleted    BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reel_likes (
  reel_id    UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY(reel_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.reel_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id    UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reels_user_id_idx      ON public.reels(user_id);
CREATE INDEX IF NOT EXISTS idx_reels_created_at_idx   ON public.reels(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reel_comments_reel_idx ON public.reel_comments(reel_id);

-- ── Reels RLS ─────────────────────────────────────────────────
ALTER TABLE public.reels         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_likes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reels_select"  ON public.reels;
DROP POLICY IF EXISTS "reels_insert"  ON public.reels;
DROP POLICY IF EXISTS "reels_update"  ON public.reels;
DROP POLICY IF EXISTS "reels_delete"  ON public.reels;
CREATE POLICY "reels_select" ON public.reels FOR SELECT USING (is_deleted = false);
CREATE POLICY "reels_insert" ON public.reels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reels_update" ON public.reels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "reels_delete" ON public.reels FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reel_likes_select" ON public.reel_likes;
DROP POLICY IF EXISTS "reel_likes_insert" ON public.reel_likes;
DROP POLICY IF EXISTS "reel_likes_delete" ON public.reel_likes;
CREATE POLICY "reel_likes_select" ON public.reel_likes FOR SELECT USING (true);
CREATE POLICY "reel_likes_insert" ON public.reel_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reel_likes_delete" ON public.reel_likes FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reel_comments_select" ON public.reel_comments;
DROP POLICY IF EXISTS "reel_comments_insert" ON public.reel_comments;
DROP POLICY IF EXISTS "reel_comments_delete" ON public.reel_comments;
CREATE POLICY "reel_comments_select" ON public.reel_comments FOR SELECT USING (true);
CREATE POLICY "reel_comments_insert" ON public.reel_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reel_comments_delete" ON public.reel_comments FOR DELETE USING (auth.uid() = user_id);

-- ── Count sync triggers ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_reel_like_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels SET like_count = COALESCE(like_count,0)+1 WHERE id = NEW.reel_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels SET like_count = GREATEST(0,COALESCE(like_count,0)-1) WHERE id = OLD.reel_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS reel_like_count_trigger ON public.reel_likes;
CREATE TRIGGER reel_like_count_trigger AFTER INSERT OR DELETE ON public.reel_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_reel_like_count();

CREATE OR REPLACE FUNCTION public.sync_reel_comment_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels SET comment_count = COALESCE(comment_count,0)+1 WHERE id = NEW.reel_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels SET comment_count = GREATEST(0,COALESCE(comment_count,0)-1) WHERE id = OLD.reel_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS reel_comment_count_trigger ON public.reel_comments;
CREATE TRIGGER reel_comment_count_trigger AFTER INSERT OR DELETE ON public.reel_comments
  FOR EACH ROW EXECUTE FUNCTION public.sync_reel_comment_count();

-- ── Storage buckets ───────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars',     'avatars',     true, 5242880,   ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']),
  ('covers',      'covers',      true, 10485760,  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']),
  ('event-media', 'event-media', true, 104857600, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','video/mp4','video/quicktime','video/x-m4v','video/webm']),
  ('reels',       'reels',       true, 104857600, ARRAY['video/mp4','video/quicktime','video/x-m4v','video/webm','image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('moments',     'moments',     true, 52428800,  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4','video/quicktime','video/x-m4v','video/webm']),
  ('chat_media',  'chat_media',  true, 10485760,  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'])
ON CONFLICT (id) DO UPDATE SET
  public            = EXCLUDED.public,
  file_size_limit   = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── Storage RLS ───────────────────────────────────────────────
-- Wrapped so the Supabase SQL Editor (whose role is NOT the owner of
-- storage.objects) SKIPS this with a NOTICE instead of aborting with
-- "42501: must be owner of table objects". If skipped, create the same
-- policies via Dashboard → Storage → Policies (that UI runs as storage admin).
DO $$ DECLARE pol TEXT;
BEGIN
  -- Drop all old policies first
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol);
  END LOOP;

  -- Public read for all buckets
  CREATE POLICY "avatars_public_read"     ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
  CREATE POLICY "covers_public_read"      ON storage.objects FOR SELECT USING (bucket_id = 'covers');
  CREATE POLICY "event_media_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'event-media');
  CREATE POLICY "reels_public_read"       ON storage.objects FOR SELECT USING (bucket_id = 'reels');
  CREATE POLICY "moments_public_read"     ON storage.objects FOR SELECT USING (bucket_id = 'moments');
  CREATE POLICY "chat_media_public_read"  ON storage.objects FOR SELECT USING (bucket_id = 'chat_media');

  -- Authenticated upload — first path segment = caller's user ID
  CREATE POLICY "avatars_auth_upload"     ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'avatars'     AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);
  CREATE POLICY "covers_auth_upload"      ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'covers'      AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);
  CREATE POLICY "event_media_auth_upload" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'event-media' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);
  CREATE POLICY "reels_auth_upload"       ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'reels'       AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);
  CREATE POLICY "moments_auth_upload"     ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'moments'     AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);
  CREATE POLICY "chat_media_auth_upload"  ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'chat_media'  AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);

  -- Owner delete / update
  CREATE POLICY "storage_owner_delete" ON storage.objects FOR DELETE USING (auth.uid()::text = (storage.foldername(name))[1]);
  CREATE POLICY "storage_owner_update" ON storage.objects FOR UPDATE USING (auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'storage.objects policies skipped (%): create them in Dashboard → Storage → Policies', SQLERRM;
END $$;


-- ══════════════════════════════════════════════════════════════
--  SOURCE: 12_gruvs_social.sql
-- ══════════════════════════════════════════════════════════════

-- ============================================================
--  THE GRUVS — 01: GRUVS SOCIAL (Core Social Graph)
--  profiles, follows, events, vibes, saves, reactions,
--  echoes, ratings, check-ins, gallery, notifications,
--  routes, pulse, messages
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN new.updated_at = now(); RETURN new; END;
$$;

-- ── PROFILES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                     UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username               TEXT UNIQUE,
  display_name           TEXT,
  avatar_url             TEXT,
  cover_url              TEXT,
  bio                    TEXT,
  location               TEXT,
  city                   TEXT,
  website                TEXT,
  gender                 TEXT,
  birth_year             INTEGER,
  birth_date             DATE,
  clan_name              TEXT,
  interests              TEXT[],
  is_verified            BOOLEAN     DEFAULT false,
  is_online              BOOLEAN     DEFAULT false,
  show_online            BOOLEAN     DEFAULT true,
  last_seen              TIMESTAMPTZ,
  last_seen_at           TIMESTAMPTZ DEFAULT now(),
  vibe_score             INTEGER     DEFAULT 0,
  vibe_equity            NUMERIC     DEFAULT 0,
  social_integrity_score INTEGER     DEFAULT 100,
  followers_count        INTEGER     DEFAULT 0,
  following_count        INTEGER     DEFAULT 0,
  events_posted          INTEGER     DEFAULT 0,
  saved_count            INTEGER     DEFAULT 0,
  current_streak         INTEGER     DEFAULT 0,
  xp                     INTEGER     DEFAULT 0,
  badges                 TEXT[]      DEFAULT '{}',
  profile_gallery        TEXT[]      DEFAULT '{}',
  share_events           BOOLEAN     DEFAULT false,
  push_token             TEXT,
  identity_mode          TEXT        DEFAULT 'public' CHECK (identity_mode IN ('public','ghost','celebrity')),
  is_beacon_active       BOOLEAN     DEFAULT false,
  is_discoverable        BOOLEAN     DEFAULT true,
  wallet_balance         NUMERIC(10,2) DEFAULT 0.00,
  home_base_lat          FLOAT,
  home_base_lon          FLOAT,
  coords                 geography(Point, 4326),
  referral_code          TEXT UNIQUE,
  referral_count         INTEGER     DEFAULT 0,
  referred_by            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  role                   TEXT        DEFAULT 'user',
  provider_type          TEXT,
  provider_rate          TEXT,
  provider_bio           TEXT,
  provider_verified      BOOLEAN     DEFAULT false,
  privacy_settings       JSONB       DEFAULT '{}',
  career_title           TEXT,
  career_description     TEXT,
  looks_description      TEXT,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username      ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_city          ON public.profiles(city);
CREATE INDEX IF NOT EXISTS idx_profiles_vibe_score    ON public.profiles(vibe_score DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_push_token    ON public.profiles(push_token) WHERE push_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_coords        ON public.profiles USING gist(coords);
CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm ON public.profiles USING gin(username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_interests     ON public.profiles USING gin(interests) WHERE interests IS NOT NULL;

DROP TRIGGER IF EXISTS touch_profiles_updated_at ON public.profiles;
CREATE TRIGGER touch_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_uname TEXT;
BEGIN
  base_uname := lower(regexp_replace(
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    '[^a-z0-9_]', '', 'g'
  ));
  IF base_uname IS NULL OR base_uname = '' THEN
    base_uname := 'user' || left(new.id::text, 6);
  END IF;
  BEGIN
    INSERT INTO public.profiles (id, username, display_name, avatar_url)
    VALUES (
      new.id, base_uname,
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      new.raw_user_meta_data->>'avatar_url'
    );
  EXCEPTION
    WHEN unique_violation THEN
      INSERT INTO public.profiles (id, username, display_name, avatar_url)
      VALUES (new.id, 'user_' || left(new.id::text, 8),
        coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        new.raw_user_meta_data->>'avatar_url')
      ON CONFLICT (id) DO NOTHING;
    WHEN others THEN NULL;
  END;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── FOLLOWS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.follows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK(follower_id <> following_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_follower  ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);

CREATE OR REPLACE FUNCTION public.sync_follow_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET followers_count = COALESCE(followers_count,0)+1 WHERE id = NEW.following_id;
    UPDATE public.profiles SET following_count = COALESCE(following_count,0)+1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET followers_count = GREATEST(0,COALESCE(followers_count,0)-1) WHERE id = OLD.following_id;
    UPDATE public.profiles SET following_count = GREATEST(0,COALESCE(following_count,0)-1) WHERE id = OLD.follower_id;
  END IF;
  RETURN null;
END;
$$;
DROP TRIGGER IF EXISTS follows_sync_counts ON public.follows;
CREATE TRIGGER follows_sync_counts AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.sync_follow_counts();

-- ── BLOCKED / MUTED ──────────────────────────────────────────
DO $$ BEGIN
  -- Drop blocked_users if it's a view OR has wrong column name (blocker_id instead of user_id)
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'blocked_users' AND c.relkind = 'v') THEN
    DROP VIEW public.blocked_users CASCADE;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'blocked_users' AND column_name = 'blocker_id') THEN
    DROP TABLE public.blocked_users CASCADE;
  END IF;
  -- Drop muted_users if it's a view OR has wrong column name (muter_id instead of user_id)
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'muted_users' AND c.relkind = 'v') THEN
    DROP VIEW public.muted_users CASCADE;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'muted_users' AND column_name = 'muter_id') THEN
    DROP TABLE public.muted_users CASCADE;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, blocked_id)
);
CREATE TABLE IF NOT EXISTS public.muted_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  muted_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, muted_id)
);

-- ── EVENTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 150),
  description     TEXT CHECK (length(description) <= 2000),
  event_date      DATE,
  event_time      TIME,
  end_time        TIME,
  end_date        DATE,
  match_card      JSONB,
  venue_name      TEXT,
  venue_address   TEXT,
  address         TEXT,
  city            TEXT,
  country         TEXT DEFAULT 'ZA',
  lat             DOUBLE PRECISION,
  lon             DOUBLE PRECISION,
  coords          geography(Point, 4326),
  price           TEXT DEFAULT 'FREE',
  price_min       NUMERIC,
  price_max       NUMERIC,
  capacity        INTEGER,
  max_attendees   INTEGER,
  ticket_url      TEXT,
  event_type      TEXT,
  category        TEXT,
  category_color  TEXT,
  categories      TEXT[],
  tags            TEXT[],
  age_restriction INTEGER DEFAULT 0,
  age_min         INTEGER DEFAULT 0,
  age_max         INTEGER DEFAULT 99,
  media           JSONB,
  media_urls      TEXT[],
  cover_url       TEXT,
  cover_image     TEXT,
  rsvp_tiers      JSONB,
  vibe_count      INTEGER DEFAULT 0,
  echo_count      INTEGER DEFAULT 0,
  reaction_count  INTEGER DEFAULT 0,
  save_count      INTEGER DEFAULT 0,
  going           INTEGER DEFAULT 0,
  is_featured     BOOLEAN DEFAULT false,
  is_cancelled    BOOLEAN DEFAULT false,
  is_published    BOOLEAN DEFAULT true,
  search_vector   TSVECTOR,
  slug            TEXT UNIQUE,
  date_time       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
-- Patch missing columns on pre-existing events table (must run before indexes)
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_published   BOOLEAN DEFAULT true;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_featured    BOOLEAN DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_cancelled   BOOLEAN DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS slug           TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS search_vector  TSVECTOR;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS date_time      TIMESTAMPTZ;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS vibe_count     INTEGER DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS echo_count     INTEGER DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS reaction_count INTEGER DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS save_count     INTEGER DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS going          INTEGER DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS rsvp_tiers     JSONB;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS categories     TEXT[];
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS media_urls     TEXT[];
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS cover_image    TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS coords         geography(Point, 4326);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS age_min        INTEGER DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS age_max        INTEGER DEFAULT 99;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS price_min      NUMERIC;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS price_max      NUMERIC;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS max_attendees  INTEGER;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS starts_at      TIMESTAMPTZ;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS ends_at        TIMESTAMPTZ;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS poster_mode    BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_events_author     ON public.events(author_id);
CREATE INDEX IF NOT EXISTS idx_events_date       ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_city       ON public.events(city);
CREATE INDEX IF NOT EXISTS idx_events_published  ON public.events(is_published, event_date);
CREATE INDEX IF NOT EXISTS idx_events_search     ON public.events USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_events_tags       ON public.events USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_events_title_trgm ON public.events USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_events_coords     ON public.events USING gist(coords);

DROP TRIGGER IF EXISTS touch_events_updated_at ON public.events;
CREATE TRIGGER touch_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE OR REPLACE FUNCTION public.events_update_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(unaccent(NEW.title),       '')), 'A') ||
    setweight(to_tsvector('english', coalesce(unaccent(NEW.venue_name),  '')), 'B') ||
    setweight(to_tsvector('english', coalesce(unaccent(NEW.city),        '')), 'B') ||
    setweight(to_tsvector('english', coalesce(unaccent(NEW.description), '')), 'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'B');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS events_search_vector_update ON public.events;
CREATE TRIGGER events_search_vector_update BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.events_update_search_vector();

CREATE OR REPLACE FUNCTION public.events_set_slug()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.slug IS NOT NULL THEN RETURN NEW; END IF;
  NEW.slug := left(regexp_replace(lower(unaccent(NEW.title)), '[^a-z0-9]+', '-', 'g'), 60)
              || '-' || left(gen_random_uuid()::text, 8);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS events_slug_gen ON public.events;
CREATE TRIGGER events_slug_gen BEFORE INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.events_set_slug();

CREATE OR REPLACE FUNCTION public.sync_events_posted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET events_posted = COALESCE(events_posted,0)+1 WHERE id = NEW.author_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET events_posted = GREATEST(0,COALESCE(events_posted,0)-1) WHERE id = OLD.author_id;
  END IF;
  RETURN null;
END;
$$;
DROP TRIGGER IF EXISTS events_posted_sync ON public.events;
CREATE TRIGGER events_posted_sync AFTER INSERT OR DELETE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.sync_events_posted();

-- ── EVENT VIBES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_vibes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_vibes_event ON public.event_vibes(event_id);
CREATE INDEX IF NOT EXISTS idx_event_vibes_user  ON public.event_vibes(user_id);

CREATE OR REPLACE FUNCTION public.sync_vibe_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.events SET vibe_count = COALESCE(vibe_count,0)+1 WHERE id = NEW.event_id;
    UPDATE public.profiles SET vibe_score = COALESCE(vibe_score,0)+2
      WHERE id = (SELECT author_id FROM public.events WHERE id = NEW.event_id);
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.events SET vibe_count = GREATEST(0,COALESCE(vibe_count,0)-1) WHERE id = OLD.event_id;
  END IF;
  RETURN null;
END;
$$;
DROP TRIGGER IF EXISTS sync_vibe_count_trigger ON public.event_vibes;
CREATE TRIGGER sync_vibe_count_trigger AFTER INSERT OR DELETE ON public.event_vibes
  FOR EACH ROW EXECUTE FUNCTION public.sync_vibe_count();

-- ── SAVED EVENTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.saved_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, event_id)
);

CREATE OR REPLACE FUNCTION public.sync_save_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.events   SET save_count  = COALESCE(save_count,0)+1  WHERE id = NEW.event_id;
    UPDATE public.profiles SET saved_count = COALESCE(saved_count,0)+1 WHERE id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.events   SET save_count  = GREATEST(0,COALESCE(save_count,0)-1)  WHERE id = OLD.event_id;
    UPDATE public.profiles SET saved_count = GREATEST(0,COALESCE(saved_count,0)-1) WHERE id = OLD.user_id;
  END IF;
  RETURN null;
END;
$$;
DROP TRIGGER IF EXISTS saved_events_sync ON public.saved_events;
CREATE TRIGGER saved_events_sync AFTER INSERT OR DELETE ON public.saved_events
  FOR EACH ROW EXECUTE FUNCTION public.sync_save_counts();

-- ── EVENT REACTIONS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction     TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id, reaction)
);
CREATE INDEX IF NOT EXISTS idx_event_reactions_event ON public.event_reactions(event_id);

-- ── ECHOES (comments) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.echoes (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id  UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.echoes(id) ON DELETE CASCADE,
  body      TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  likes     INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- part_2 defines echoes without parent_id/likes; the app uses both (one-layer
-- reply threads + like counts). Ensure they exist before the index below and
-- so threading/likes work on any DB that got the simpler shape.
ALTER TABLE public.echoes ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.echoes(id) ON DELETE CASCADE;
ALTER TABLE public.echoes ADD COLUMN IF NOT EXISTS likes     INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_echoes_event  ON public.echoes(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_echoes_parent ON public.echoes(parent_id) WHERE parent_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.echo_likes (
  echo_id UUID NOT NULL REFERENCES public.echoes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY(echo_id, user_id)
);

CREATE OR REPLACE FUNCTION public.sync_echo_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.events SET echo_count = COALESCE(echo_count,0)+1 WHERE id = NEW.event_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.events SET echo_count = GREATEST(0,COALESCE(echo_count,0)-1) WHERE id = OLD.event_id;
  END IF;
  RETURN null;
END;
$$;
DROP TRIGGER IF EXISTS echoes_sync ON public.echoes;
CREATE TRIGGER echoes_sync AFTER INSERT OR DELETE ON public.echoes
  FOR EACH ROW EXECUTE FUNCTION public.sync_echo_counts();

CREATE OR REPLACE FUNCTION public.sanitize_echo_body()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.body = regexp_replace(NEW.body, '<[^>]+>', '', 'g');
  NEW.body = regexp_replace(NEW.body, 'javascript\s*:', '', 'gi');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sanitize_echo_body_trigger ON public.echoes;
CREATE TRIGGER sanitize_echo_body_trigger BEFORE INSERT OR UPDATE ON public.echoes
  FOR EACH ROW EXECUTE FUNCTION public.sanitize_echo_body();

-- ── EVENT RATINGS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating   SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review   TEXT CHECK (length(review) <= 500),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- ── CHECK-INS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_checkins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rsvp_id       UUID, -- FK to event_rsvps added in 07_gruvs_social.sql
  lat           DOUBLE PRECISION,
  lon           DOUBLE PRECISION,
  checked_in_at TIMESTAMPTZ DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT event_checkins_rsvp_unique UNIQUE(rsvp_id)
);
CREATE INDEX IF NOT EXISTS idx_checkins_event ON public.event_checkins(event_id, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkins_user  ON public.event_checkins(user_id);

-- ── LIVE CHECK-INS (presence layer) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.live_checkins (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lat            DOUBLE PRECISION,
  lon            DOUBLE PRECISION,
  identity_layer TEXT DEFAULT 'public',
  ghost_alias    TEXT,
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, event_id)
);
CREATE INDEX IF NOT EXISTS idx_live_checkins_event   ON public.live_checkins(event_id);
CREATE INDEX IF NOT EXISTS idx_live_checkins_expires ON public.live_checkins(expires_at) WHERE expires_at IS NOT NULL;

-- ── EVENT GALLERY ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_gallery (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url  TEXT NOT NULL,
  media_type TEXT DEFAULT 'image' CHECK (media_type IN ('image','video')),
  caption    TEXT CHECK (length(caption) <= 200),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gallery_event ON public.event_gallery(event_id);

-- ── NOTIFICATIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_id     UUID REFERENCES public.events(id) ON DELETE SET NULL,
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT,
  data         JSONB DEFAULT '{}',
  read         BOOLEAN DEFAULT false,
  push_error   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread    ON public.notifications(recipient_id) WHERE read = false;

-- ── MESSAGES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body             TEXT,
  media_url        TEXT,
  read_at          TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  is_request       BOOLEAN DEFAULT false,
  request_accepted BOOLEAN,
  deleted_at       TIMESTAMPTZ,
  reactions        JSONB DEFAULT '{}',
  reply_to         UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);
-- Columns the chat UI reads/writes (text/image/location/reply). See 14_messages_missing_columns.sql
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS parent_id    UUID REFERENCES public.messages(id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS event_id     UUID;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS latitude     DOUBLE PRECISION;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS longitude    DOUBLE PRECISION;
CREATE INDEX IF NOT EXISTS idx_messages_sender    ON public.messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON public.messages(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_parent    ON public.messages(parent_id);

-- ── ROUTES ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.routes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name       TEXT,
  color      TEXT DEFAULT '#00f2ff',
  icon       TEXT,
  join_count INTEGER DEFAULT 0,
  is_public  BOOLEAN DEFAULT false,
  active     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS is_public  BOOLEAN DEFAULT false;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS active     BOOLEAN DEFAULT true;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS color      TEXT DEFAULT '#00f2ff';
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS icon       TEXT;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS join_count INTEGER DEFAULT 0;
CREATE TABLE IF NOT EXISTS public.route_steps (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id   UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  event_id   UUID REFERENCES public.events(id) ON DELETE SET NULL,
  step_order INTEGER DEFAULT 0,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.route_joins (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id   UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(route_id, user_id)
);

-- ── PULSE REQUESTS & VOTES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pulse_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content      TEXT CHECK (length(content) <= 200),
  body         TEXT,
  request_type TEXT DEFAULT 'media',
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','completed')),
  vote_count   INTEGER DEFAULT 1,
  is_live      BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pulse_event_votes ON public.pulse_requests(event_id, vote_count DESC);

CREATE TABLE IF NOT EXISTS public.pulse_votes (
  request_id UUID NOT NULL REFERENCES public.pulse_requests(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY(request_id, user_id)
);

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

-- ── HASHTAGS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag      TEXT NOT NULL,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tag, event_id)
);

-- ── REPORTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id   UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('event','user','reel','echo','message')),
  reason      TEXT,
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.muted_users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_vibes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.echoes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.echo_likes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_ratings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_checkins  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_checkins   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_gallery   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_steps     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_joins     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_votes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hashtags        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports         ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_select"     ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert"     ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "follows_select" ON public.follows;
DROP POLICY IF EXISTS "follows_insert" ON public.follows;
DROP POLICY IF EXISTS "follows_delete" ON public.follows;
CREATE POLICY "follows_select" ON public.follows FOR SELECT USING (true);
CREATE POLICY "follows_insert" ON public.follows FOR INSERT WITH CHECK (follower_id = auth.uid());
CREATE POLICY "follows_delete" ON public.follows FOR DELETE USING (follower_id = auth.uid());

DROP POLICY IF EXISTS "blocked_manage" ON public.blocked_users;
CREATE POLICY "blocked_manage" ON public.blocked_users FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "muted_manage"   ON public.muted_users;
CREATE POLICY "muted_manage"   ON public.muted_users  FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "events_select"     ON public.events;
DROP POLICY IF EXISTS "events_insert"     ON public.events;
DROP POLICY IF EXISTS "events_update_own" ON public.events;
DROP POLICY IF EXISTS "events_delete_own" ON public.events;
CREATE POLICY "events_select"     ON public.events FOR SELECT USING (deleted_at IS NULL AND (is_published = true OR author_id = auth.uid()));
CREATE POLICY "events_insert"     ON public.events FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "events_update_own" ON public.events FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "events_delete_own" ON public.events FOR DELETE USING (author_id = auth.uid());

DROP POLICY IF EXISTS "no_self_vibe"       ON public.event_vibes;
DROP POLICY IF EXISTS "event_vibes_select" ON public.event_vibes;
DROP POLICY IF EXISTS "event_vibes_delete" ON public.event_vibes;
CREATE POLICY "event_vibes_select" ON public.event_vibes FOR SELECT USING (true);
CREATE POLICY "no_self_vibe"       ON public.event_vibes FOR INSERT WITH CHECK (
  user_id = auth.uid() AND user_id != (SELECT author_id FROM public.events WHERE id = event_id));
CREATE POLICY "event_vibes_delete" ON public.event_vibes FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "saved_events_manage" ON public.saved_events;
CREATE POLICY "saved_events_manage" ON public.saved_events FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "reactions_select" ON public.event_reactions;
DROP POLICY IF EXISTS "reactions_manage" ON public.event_reactions;
CREATE POLICY "reactions_select" ON public.event_reactions FOR SELECT USING (true);
CREATE POLICY "reactions_manage" ON public.event_reactions FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "echoes_select" ON public.echoes;
DROP POLICY IF EXISTS "echoes_insert" ON public.echoes;
DROP POLICY IF EXISTS "echoes_update" ON public.echoes;
DROP POLICY IF EXISTS "echoes_delete" ON public.echoes;
CREATE POLICY "echoes_select" ON public.echoes FOR SELECT USING (true);
CREATE POLICY "echoes_insert" ON public.echoes FOR INSERT
  WITH CHECK (user_id = auth.uid() AND (SELECT COUNT(*) FROM public.echoes
    WHERE user_id = auth.uid() AND created_at > now() - interval '1 minute') < 20);
CREATE POLICY "echoes_update" ON public.echoes FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "echoes_delete" ON public.echoes FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "echo_likes_manage" ON public.echo_likes;
CREATE POLICY "echo_likes_manage" ON public.echo_likes FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "ratings_select" ON public.event_ratings;
DROP POLICY IF EXISTS "ratings_manage" ON public.event_ratings;
CREATE POLICY "ratings_select" ON public.event_ratings FOR SELECT USING (true);
CREATE POLICY "ratings_manage" ON public.event_ratings FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "live_checkins_select" ON public.live_checkins;
DROP POLICY IF EXISTS "live_checkins_insert" ON public.live_checkins;
CREATE POLICY "live_checkins_select" ON public.live_checkins FOR SELECT USING (true);
CREATE POLICY "live_checkins_insert" ON public.live_checkins FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "gallery_select" ON public.event_gallery;
DROP POLICY IF EXISTS "gallery_manage" ON public.event_gallery;
CREATE POLICY "gallery_select" ON public.event_gallery FOR SELECT USING (true);
CREATE POLICY "gallery_manage" ON public.event_gallery FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifs_select" ON public.notifications;
DROP POLICY IF EXISTS "notifs_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifs_update" ON public.notifications;
CREATE POLICY "notifs_select" ON public.notifications FOR SELECT USING (recipient_id = auth.uid());
CREATE POLICY "notifs_insert" ON public.notifications FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR actor_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "notifs_update" ON public.notifications FOR UPDATE USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
DROP POLICY IF EXISTS "messages_update" ON public.messages;
CREATE POLICY "messages_select" ON public.messages FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY "messages_update" ON public.messages FOR UPDATE
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

DROP POLICY IF EXISTS "routes_select" ON public.routes;
DROP POLICY IF EXISTS "routes_manage" ON public.routes;
CREATE POLICY "routes_select" ON public.routes FOR SELECT USING (is_public = true OR user_id = auth.uid());
CREATE POLICY "routes_manage" ON public.routes FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "route_steps_select" ON public.route_steps;
CREATE POLICY "route_steps_select" ON public.route_steps FOR SELECT USING (true);
DROP POLICY IF EXISTS "route_joins_manage" ON public.route_joins;
CREATE POLICY "route_joins_manage" ON public.route_joins FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "pulse_select" ON public.pulse_requests;
DROP POLICY IF EXISTS "pulse_insert" ON public.pulse_requests;
CREATE POLICY "pulse_select" ON public.pulse_requests FOR SELECT USING (true);
CREATE POLICY "pulse_insert" ON public.pulse_requests FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "pulse_votes_manage" ON public.pulse_votes;
CREATE POLICY "pulse_votes_manage" ON public.pulse_votes FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "hashtags_select" ON public.hashtags;
DROP POLICY IF EXISTS "hashtags_insert" ON public.hashtags;
CREATE POLICY "hashtags_select" ON public.hashtags FOR SELECT USING (true);
CREATE POLICY "hashtags_insert" ON public.hashtags FOR INSERT WITH CHECK (auth.role() IN ('authenticated','service_role'));

DROP POLICY IF EXISTS "reports_manage" ON public.reports;
CREATE POLICY "reports_manage" ON public.reports FOR ALL USING (reporter_id = auth.uid());

