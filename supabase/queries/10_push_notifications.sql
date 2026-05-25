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
  rsvp_id     UUID NOT NULL REFERENCES public.event_rsvps(id) ON DELETE CASCADE,
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
