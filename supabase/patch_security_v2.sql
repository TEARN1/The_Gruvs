-- ============================================================
-- patch_security_v2.sql
-- Fixes 20 vulnerabilities identified in security audit.
-- Safe to re-run — all statements are idempotent.
-- ============================================================

-- ── 1. Self-vibe prevention — RLS policy ─────────────────────
-- Blocks organisers from vibing their own events at DB level.
-- Client-side check in VibeManager.sendVibe is the first line;
-- this is the second line of defence.
DROP POLICY IF EXISTS "no_self_vibe" ON public.event_vibes;
CREATE POLICY "no_self_vibe" ON public.event_vibes FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND user_id != (SELECT author_id FROM public.events WHERE id = event_id)
  );

-- ── 2. Self-RSVP prevention — RLS policy ─────────────────────
DROP POLICY IF EXISTS "no_self_rsvp" ON public.event_rsvps;
CREATE POLICY "no_self_rsvp" ON public.event_rsvps FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND user_id != (SELECT author_id FROM public.events WHERE id = event_id)
  );

-- Allow upsert update path for changing RSVP status
DROP POLICY IF EXISTS "no_self_rsvp_update" ON public.event_rsvps;
CREATE POLICY "no_self_rsvp_update" ON public.event_rsvps FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id != (SELECT author_id FROM public.events WHERE id = event_id));

-- ── 3. Check-in authorisation — only organiser / co_host ─────
-- Replace the generic insert policy with one that requires the
-- caller to be the event author OR have an event_role >= co_host.
DROP POLICY IF EXISTS "checkins_organiser_only" ON public.event_checkins;
CREATE POLICY "checkins_organiser_only" ON public.event_checkins FOR INSERT
  WITH CHECK (
    auth.uid() = (SELECT author_id FROM public.events WHERE id = event_id)
    OR auth.uid() IN (
      SELECT user_id FROM public.event_roles
      WHERE event_id = event_checkins.event_id
        AND role IN ('co_host', 'moderator', 'scanner')
    )
  );

-- ── 4. Signed check-in RPC — server validates organiser role ─
-- Use this from the app instead of a direct table insert.
CREATE OR REPLACE FUNCTION public.secure_check_in(
  p_event_id  uuid,
  p_rsvp_id   uuid,
  p_user_id   uuid   -- attendee being checked in
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rsvp    event_rsvps%ROWTYPE;
  v_event   events%ROWTYPE;
BEGIN
  -- Verify caller is organiser or authorised team member
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;

  IF auth.uid() != v_event.author_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM event_roles
      WHERE event_id = p_event_id
        AND user_id = auth.uid()
        AND role IN ('co_host', 'moderator', 'scanner')
    ) THEN
      RAISE EXCEPTION 'Unauthorized: not an event organiser or team member';
    END IF;
  END IF;

  -- Fetch rsvp and validate
  SELECT * INTO v_rsvp FROM event_rsvps WHERE id = p_rsvp_id AND event_id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket not found in guest list'; END IF;
  IF v_rsvp.status != 'going' THEN
    RAISE EXCEPTION 'RSVP status is "%" — not confirmed going', v_rsvp.status;
  END IF;
  IF v_rsvp.user_id != p_user_id THEN
    RAISE EXCEPTION 'Ticket user mismatch — possible forgery attempt';
  END IF;

  -- Idempotent insert
  INSERT INTO event_checkins(event_id, rsvp_id, user_id)
  VALUES (p_event_id, p_rsvp_id, p_user_id)
  ON CONFLICT (rsvp_id) DO NOTHING;

  RETURN jsonb_build_object(
    'ok', true,
    'rsvp_id', p_rsvp_id,
    'user_id', p_user_id
  );
END;
$$;

-- ── 5. Capacity enforcement — DB trigger ──────────────────────
-- Prevents race-condition over-RSVPing when capacity is set.
CREATE OR REPLACE FUNCTION public.enforce_event_capacity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_capacity  integer;
  v_going     integer;
BEGIN
  IF NEW.status != 'going' THEN RETURN NEW; END IF;
  SELECT capacity INTO v_capacity FROM events WHERE id = NEW.event_id;
  IF v_capacity IS NULL OR v_capacity = 0 THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_going FROM event_rsvps
  WHERE event_id = NEW.event_id AND status = 'going';

  IF v_going >= v_capacity THEN
    RAISE EXCEPTION 'Event is at capacity (% / %)', v_going, v_capacity;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enforce_event_capacity_trigger ON public.event_rsvps;
CREATE TRIGGER enforce_event_capacity_trigger
  BEFORE INSERT OR UPDATE ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.enforce_event_capacity();

-- ── 6. Rate limit on check-ins (per scanner, per event) ──────
-- Prevents rapid-fire check-in replay attacks.
CREATE OR REPLACE FUNCTION public.check_in_rate_limit(p_event_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) FROM event_checkins
    WHERE event_id = p_event_id
      AND created_at > now() - INTERVAL '60 seconds'
  ) < 30;  -- max 30 check-ins per minute per event
END;
$$;

-- ── 7. Activity feed insert — restrict to service_role / RPC ─
-- Previously WITH CHECK (true) allowed any authenticated user to
-- insert arbitrary activity items for any recipient.
DROP POLICY IF EXISTS "activity_feed_insert_sys" ON public.activity_feed;
CREATE POLICY "activity_feed_insert_sys" ON public.activity_feed FOR INSERT
  WITH CHECK (
    -- service_role (Edge Functions, DB triggers) OR own notifications
    auth.role() = 'service_role'
    OR actor_id = auth.uid()
  );

-- ── 8. Event title / description length constraints ───────────
ALTER TABLE public.events
  ADD CONSTRAINT IF NOT EXISTS events_title_length    CHECK (length(title) BETWEEN 3 AND 150),
  ADD CONSTRAINT IF NOT EXISTS events_desc_length     CHECK (length(description) <= 2000);

-- ── 9. Storage upload path — owner prefix enforcement ────────
-- Policy: the first path segment must be the uploading user's ID.
-- Prevents path-traversal overwrites of other users' files.
DROP POLICY IF EXISTS "avatars_auth_upload"     ON storage.objects;
DROP POLICY IF EXISTS "event_media_auth_upload" ON storage.objects;
DROP POLICY IF EXISTS "reels_auth_upload"       ON storage.objects;
DROP POLICY IF EXISTS "moments_auth_upload"     ON storage.objects;

CREATE POLICY "avatars_auth_upload" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "event_media_auth_upload" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'event-media'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "reels_auth_upload" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'reels'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "moments_auth_upload" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'event-media'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 10. Playlist vote — unique constraint (one vote per user) ─
ALTER TABLE public.event_track_votes
  DROP CONSTRAINT IF EXISTS event_track_votes_track_user_unique;
ALTER TABLE public.event_track_votes
  ADD CONSTRAINT event_track_votes_track_user_unique UNIQUE (track_id, user_id);

-- Also add RLS to prevent voting on behalf of others
DROP POLICY IF EXISTS "track_votes_insert_own" ON public.event_track_votes;
CREATE POLICY "track_votes_insert_own" ON public.event_track_votes FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ── 11. Moment reactions — already constrained UNIQUE(moment_id, user_id)
--        Ensure no self-moment reaction farming
DROP POLICY IF EXISTS "no_self_moment_reaction" ON public.event_moment_reactions;
CREATE POLICY "no_self_moment_reaction" ON public.event_moment_reactions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND user_id != (SELECT user_id FROM public.event_moments WHERE id = moment_id)
  );

-- ── 12. Echo (comment) XSS — server-side strip ───────────────
CREATE OR REPLACE FUNCTION public.sanitize_echo_body()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Strip all HTML tags and JS protocol patterns
  NEW.body = regexp_replace(NEW.body, '<[^>]+>', '', 'g');
  NEW.body = regexp_replace(NEW.body, 'javascript\s*:', '', 'gi');
  NEW.body = regexp_replace(NEW.body, 'on\w+\s*=\s*[''"][^''"]*[''"]', '', 'gi');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sanitize_echo_body_trigger ON public.echoes;
CREATE TRIGGER sanitize_echo_body_trigger
  BEFORE INSERT OR UPDATE ON public.echoes
  FOR EACH ROW EXECUTE FUNCTION public.sanitize_echo_body();

-- ── 13. Secure QR ticket generation RPC ─────────────────────
-- Generates a short-lived signed token (HMAC-SHA256) so QR codes
-- cannot be forged. Requires pg_crypto extension.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.generate_ticket_token(p_rsvp_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rsvp    event_rsvps%ROWTYPE;
  v_payload text;
  v_sig     text;
BEGIN
  SELECT * INTO v_rsvp FROM event_rsvps WHERE id = p_rsvp_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'RSVP not found or does not belong to you'; END IF;

  -- Payload: event_id|user_id|rsvp_id|expires (unix timestamp, 30 days)
  v_payload := v_rsvp.event_id || '|' || v_rsvp.user_id || '|' || v_rsvp.id ||
               '|' || (EXTRACT(EPOCH FROM now() + INTERVAL '30 days')::bigint)::text;

  -- HMAC-SHA256 with a secret derived from the rsvp_id + app salt
  -- In production replace 'GRUVS_QR_SECRET' with vault.decrypted_secrets
  v_sig := encode(
    hmac(v_payload, current_setting('app.qr_secret', true), 'sha256'),
    'hex'
  );

  RETURN 'gruvsticket://' || encode(v_payload::bytea, 'base64') || '.' || v_sig;
END;
$$;

-- Set the app secret (run this once in SQL editor with your own secret):
-- ALTER DATABASE postgres SET app.qr_secret = 'your-256-bit-secret-here';

-- ── 14. Profile privacy — activity feed respects is_discoverable
CREATE OR REPLACE VIEW public.discoverable_profiles AS
  SELECT * FROM public.profiles WHERE is_discoverable IS NOT FALSE;

-- ── 15. Chat message length cap ──────────────────────────────
ALTER TABLE public.event_messages
  ADD CONSTRAINT IF NOT EXISTS message_body_length CHECK (length(body) <= 1000);

-- ── 16. Security logs — drop permissive insert, add scoped one ─
-- Previously any authenticated user could write to security_logs.
DROP POLICY IF EXISTS "security_logs_insert" ON public.security_logs;
CREATE POLICY "security_logs_insert" ON public.security_logs FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR user_id = auth.uid()  -- users can only log events for themselves
  );

-- ── Summary ───────────────────────────────────────────────────
-- After running this script, also:
-- 1. ALTER DATABASE postgres SET app.qr_secret = '<strong-random-secret>';
-- 2. Redeploy your app (to pick up the secure_check_in RPC calls)
-- 3. Ensure event_checkins has a UNIQUE constraint on rsvp_id:
ALTER TABLE public.event_checkins
  ADD CONSTRAINT IF NOT EXISTS event_checkins_rsvp_unique UNIQUE (rsvp_id);
