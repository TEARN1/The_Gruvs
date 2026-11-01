-- ═══════════════════════════════════════════════════════════════════════════
--  Touch Down v2: proof of presence with a rotating door code.
--  (Master spec v2.5 §7.2, level L2.)
--
--  WHY. Touch Down is the app's core promise ("real nights, verified"). Today a
--  check-in is a row the phone writes itself, with coordinates the phone
--  reports, so it can be faked from home. Distance is evidence, not proof.
--
--  HOW. Each event gets a secret that never leaves the database. From it the
--  server derives a 6-digit code that changes every 30 seconds. Hosts, co-hosts
--  and scanners show it on a screen at the door (get_door_code). A guest types
--  it in (touch_down_with_code); the server checks it and records the check-in
--  as verify_level 2, "verified at the door". You can't get the code without
--  being in front of that screen in the last minute.
--
--  verify_level:  NULL = unverified / self-reported
--                 1    = GPS near the venue (existing checkin_verification.sql)
--                 2    = rotating door code (this file)
--                 3    = scanned by door staff (secure_check_in; future)
--  Phones can't set it: a SECURITY INVOKER trigger pins it for client roles.
--
--  Brute force: 2 valid codes out of 1,000,000 at any moment, and at most 10
--  attempts per person per event per 10 minutes.
--
--  Idempotent. Needs pgcrypto (enabled by default on Supabase, in `extensions`).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1. Columns ──────────────────────────────────────────────────────────────
ALTER TABLE public.live_checkins ADD COLUMN IF NOT EXISTS verified     boolean;
ALTER TABLE public.live_checkins ADD COLUMN IF NOT EXISTS verify_level smallint;

-- ── 2. Secrets and attempts (no client access at all) ───────────────────────
CREATE TABLE IF NOT EXISTS public.event_door_secrets (
  event_id   uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  secret     bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.event_door_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_door_secrets FROM public, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.door_code_attempts (
  user_id  uuid NOT NULL,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_door_code_attempts_recent ON public.door_code_attempts (user_id, event_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_door_code_attempts_event_id_fk ON public.door_code_attempts (event_id);
ALTER TABLE public.door_code_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.door_code_attempts FROM public, anon, authenticated;

-- ── 3. Code derivation (internal only) ──────────────────────────────────────
-- HMAC-SHA256(secret, window) → first 4 bytes → mod 1,000,000 → 6 digits.
CREATE OR REPLACE FUNCTION public.door_code_at(p_secret bytea, p_window bigint)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT
SET search_path = public, extensions
AS $$
  SELECT lpad(
    (( (get_byte(d, 0)::bigint << 24) | (get_byte(d, 1) << 16) | (get_byte(d, 2) << 8) | get_byte(d, 3) )
      % 1000000)::text, 6, '0')
  FROM (SELECT hmac(p_window::text::bytea, p_secret, 'sha256') AS d) s;
$$;
REVOKE ALL ON FUNCTION public.door_code_at(bytea, bigint) FROM public, anon, authenticated;

-- Can this user run the door for this event? Organiser, co-host or scanner.
CREATE OR REPLACE FUNCTION public.can_run_door(p_event uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = p_event AND e.author_id = p_user)
    OR (to_regclass('public.event_roles') IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.event_roles r
       WHERE r.event_id = p_event AND r.user_id = p_user AND r.role IN ('co_host', 'scanner')))
  );
$$;
REVOKE ALL ON FUNCTION public.can_run_door(uuid, uuid) FROM public, anon, authenticated;

-- ── 4. get_door_code: for the screen at the door ────────────────────────────
CREATE OR REPLACE FUNCTION public.get_door_code(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_secret bytea;
  v_now    double precision := extract(epoch FROM clock_timestamp());
  v_window bigint := floor(v_now / 30)::bigint;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '28000';
  END IF;
  IF NOT public.can_run_door(p_event_id, v_uid) THEN
    RAISE EXCEPTION 'only the host or door staff can show the door code' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.event_door_secrets (event_id, secret)
  VALUES (p_event_id, gen_random_bytes(32))
  ON CONFLICT (event_id) DO NOTHING;
  SELECT secret INTO v_secret FROM public.event_door_secrets WHERE event_id = p_event_id;

  RETURN jsonb_build_object(
    'code', public.door_code_at(v_secret, v_window),
    'seconds_left', ceil(30 - (v_now - v_window * 30))::int,
    'period', 30
  );
END;
$$;
REVOKE ALL     ON FUNCTION public.get_door_code(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_door_code(uuid) TO authenticated;

-- ── 5. touch_down_with_code: the guest's check-in ───────────────────────────
CREATE OR REPLACE FUNCTION public.touch_down_with_code(
  p_event_id uuid,
  p_code     text,
  p_lat      double precision DEFAULT NULL,
  p_lon      double precision DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_secret bytea;
  v_window bigint := floor(extract(epoch FROM clock_timestamp()) / 30)::bigint;
  v_code   text := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
  v_tries  int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '28000';
  END IF;

  -- Rate limit first, so wrong guesses are counted even when they fail.
  DELETE FROM public.door_code_attempts WHERE at < now() - interval '1 day';
  SELECT count(*) INTO v_tries FROM public.door_code_attempts
   WHERE user_id = v_uid AND event_id = p_event_id AND at > now() - interval '10 minutes';
  IF v_tries >= 10 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_many_attempts');
  END IF;
  INSERT INTO public.door_code_attempts (user_id, event_id) VALUES (v_uid, p_event_id);

  SELECT secret INTO v_secret FROM public.event_door_secrets WHERE event_id = p_event_id;
  -- Accept this 30-second window and the one before (typing time, clock drift).
  IF v_secret IS NULL OR length(v_code) <> 6 OR v_code NOT IN (
       public.door_code_at(v_secret, v_window),
       public.door_code_at(v_secret, v_window - 1)) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'wrong_or_expired_code');
  END IF;

  -- Upsert by hand: not every database has UNIQUE(user_id, event_id).
  UPDATE public.live_checkins
     SET verify_level = greatest(coalesce(verify_level, 0), 2),
         verified = true,
         checked_in_at = coalesce(checked_in_at, now()),
         lat = coalesce(round(p_lat::numeric, 3)::float8, lat),
         lon = coalesce(round(p_lon::numeric, 3)::float8, lon)
   WHERE user_id = v_uid AND event_id = p_event_id;
  IF NOT FOUND THEN
    INSERT INTO public.live_checkins (event_id, user_id, lat, lon, verified, verify_level)
    VALUES (p_event_id, v_uid, round(p_lat::numeric, 3)::float8, round(p_lon::numeric, 3)::float8, true, 2);
  END IF;

  -- A success clears this person's failed attempts for the event.
  DELETE FROM public.door_code_attempts WHERE user_id = v_uid AND event_id = p_event_id;
  RETURN jsonb_build_object('ok', true, 'level', 2);
END;
$$;
REVOKE ALL     ON FUNCTION public.touch_down_with_code(uuid, text, double precision, double precision) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.touch_down_with_code(uuid, text, double precision, double precision) TO authenticated;

-- ── 6. Phones can't claim a verify level ────────────────────────────────────
-- Inside the SECURITY DEFINER functions above, current_user is the owner, so
-- they pass through. Named zz_ so it runs after any other BEFORE trigger
-- (e.g. checkin_verification.sql's distance check), and has the last word.
CREATE OR REPLACE FUNCTION public.pin_presence_level()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.verify_level := NULL;
    ELSE
      NEW.verify_level := OLD.verify_level;
    END IF;
  END IF;
  IF coalesce(NEW.verify_level, 0) >= 2 THEN
    NEW.verified := true;   -- a door-verified check-in stays verified
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS zz_pin_presence_level ON public.live_checkins;
CREATE TRIGGER zz_pin_presence_level
  BEFORE INSERT OR UPDATE ON public.live_checkins
  FOR EACH ROW EXECUTE FUNCTION public.pin_presence_level();
