-- applied_2026-11-05_pending_integrity_fixes.sql: a record of what was applied
-- to production on 5 November 2026, as migration
-- "pending_integrity_fixes_bookings_vibes_reports_reels_door_code".
-- It brings in the supabase/migrations fixes production never received, each
-- checked against the live schema first, and adapted where production differs
-- (wallet_transactions columns; disputes.raised_by is a plain NOT NULL column).
-- Written for production: it is not run by CI, whose test schema differs
-- (it has no resident_trust_tier column and no meal tables).
--
-- Held back on purpose (not in this file):
--   20261024000200 ecosystem pillars: its profiles trigger reads NEW.is_admin,
--     which production does not have, so every profile save would fail; its
--     events price check compares text with a number and aborts; it rewrites
--     The Resident's live policies; and it seeds invented "guild" courses with
--     "cryptographic" certificates.
--   20260927000500 / 000600 index files: performance only, for a separate pass.

-- ── 1. Profiles: money and trust tier are server-only (000200 §4) ──────────
CREATE OR REPLACE FUNCTION public.protect_profile_trust_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  -- SECURITY INVOKER is load-bearing: under SECURITY DEFINER current_user is
  -- the owner and the guard never engages.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  NEW.role                   := OLD.role;
  NEW.is_verified            := OLD.is_verified;
  NEW.social_integrity_score := OLD.social_integrity_score;
  NEW.wallet_balance         := OLD.wallet_balance;
  NEW.resident_trust_tier    := OLD.resident_trust_tier;
  RETURN NEW;
END;
$$;

-- ── 2. Vibes only as yourself, never on your own event (000200 §5) ─────────
CREATE OR REPLACE FUNCTION public.increment_vibe_count(p_event_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '28000';
  END IF;
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'can only vibe as yourself' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.events e WHERE e.id = p_event_id AND e.author_id = p_user_id) THEN
    RAISE EXCEPTION 'cannot vibe your own event' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.event_vibes(event_id, user_id) VALUES (p_event_id, p_user_id) ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_vibe_count(p_event_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '28000';
  END IF;
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'can only remove your own vibe' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.event_vibes WHERE event_id = p_event_id AND user_id = p_user_id;
END;
$$;

-- ── 3. Two new accounts can no longer hide anyone (000300) ─────────────────
CREATE OR REPLACE FUNCTION public.apply_report_autohide()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  wsum NUMERIC;
BEGIN
  SELECT COALESCE(SUM(w), 0) INTO wsum FROM (
    SELECT r.reporter_id,
           GREATEST(0, LEAST(1.0, COALESCE(MAX(p.social_integrity_score), 100) / 100.0))
           *
           CASE
             WHEN MAX(p.created_at) IS NULL                       THEN 0.2
             WHEN MAX(p.created_at) > now() - interval '24 hours' THEN 0.2
             WHEN MAX(p.created_at) > now() - interval '7 days'   THEN 0.5
             WHEN MAX(p.created_at) > now() - interval '30 days'  THEN 0.8
             ELSE 1.0
           END AS w
    FROM public.reports r
    LEFT JOIN public.profiles p ON p.id = r.reporter_id
    WHERE r.target_id = NEW.target_id AND r.target_type = NEW.target_type
    GROUP BY r.reporter_id
  ) s;

  IF wsum < 3.0 THEN RETURN NEW; END IF;

  IF    NEW.target_type = 'event' THEN UPDATE public.events   SET auto_hidden    = true WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'reel'  THEN UPDATE public.reels    SET auto_hidden    = true WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'echo'  THEN UPDATE public.echoes   SET auto_hidden    = true WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'user'  THEN UPDATE public.profiles SET is_auto_hidden = true WHERE id = NEW.target_id;
  END IF;
  RETURN NEW;
END;
$$;

-- reports is empty today, so one report per person per target can be enforced.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_reports_reporter_target
  ON public.reports (reporter_id, target_id, target_type);

-- ── 4. "Mutuals online" without downloading every follower (000700) ────────
DROP INDEX IF EXISTS public.idx_follows_following;
CREATE INDEX idx_follows_following ON public.follows (following_id, follower_id);
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen
  ON public.profiles (last_seen DESC) WHERE last_seen IS NOT NULL;

DROP FUNCTION IF EXISTS public.get_mutual_online(int, int);
CREATE FUNCTION public.get_mutual_online(p_minutes int DEFAULT 5, p_limit int DEFAULT 50)
RETURNS TABLE (id uuid, username text, avatar_url text, bio text, vibe_score int, last_seen timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT p.id, p.username, p.avatar_url, p.bio, COALESCE(p.vibe_score, 0)::int, p.last_seen
    FROM public.follows f1
    JOIN public.follows f2 ON f2.follower_id = f1.following_id AND f2.following_id = f1.follower_id
    JOIN public.profiles p ON p.id = f1.following_id
   WHERE f1.follower_id = auth.uid()
     AND p.last_seen >= now() - make_interval(mins => greatest(p_minutes, 1))
   ORDER BY COALESCE(p.vibe_score, 0) DESC, p.last_seen DESC
   LIMIT least(greatest(p_limit, 1), 200);
$$;

DROP FUNCTION IF EXISTS public.mutual_online_count(int);
CREATE FUNCTION public.mutual_online_count(p_minutes int DEFAULT 5)
RETURNS integer LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT count(*)::int
    FROM public.follows f1
    JOIN public.follows f2 ON f2.follower_id = f1.following_id AND f2.following_id = f1.follower_id
    JOIN public.profiles p ON p.id = f1.following_id
   WHERE f1.follower_id = auth.uid()
     AND p.last_seen >= now() - make_interval(mins => greatest(p_minutes, 1));
$$;

REVOKE ALL     ON FUNCTION public.get_mutual_online(int, int) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_mutual_online(int, int) TO authenticated;
REVOKE ALL     ON FUNCTION public.mutual_online_count(int)    FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.mutual_online_count(int)    TO authenticated;

-- ── 5. Sign-up handle check in one call (000800 §5; the rest is live) ──────
CREATE OR REPLACE FUNCTION public.check_handle_available(p_handle text)
RETURNS TABLE (available boolean, reason text, clash text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  h       text;
  found_u text;
BEGIN
  h := regexp_replace(lower(coalesce(p_handle, '')), '^@', '');
  IF h !~ '^[a-z0-9_.]{3,24}$' THEN
    RETURN QUERY SELECT false, 'invalid'::text, null::text;
    RETURN;
  END IF;
  SELECT p.username INTO found_u FROM public.profiles p WHERE lower(p.username) = h LIMIT 1;
  IF found_u IS NOT NULL THEN
    RETURN QUERY SELECT false, 'taken'::text, found_u;
    RETURN;
  END IF;
  SELECT p.username INTO found_u FROM public.profiles p
   WHERE public.username_skeleton(p.username) = public.username_skeleton(h) LIMIT 1;
  IF found_u IS NOT NULL THEN
    RETURN QUERY SELECT false, 'lookalike'::text, found_u;
    RETURN;
  END IF;
  RETURN QUERY SELECT true, null::text, null::text;
END;
$$;
REVOKE ALL     ON FUNCTION public.check_handle_available(text) FROM public;
GRANT  EXECUTE ON FUNCTION public.check_handle_available(text) TO anon, authenticated;

-- ── 6. Bookings and wallet money through the server only (000900) ──────────
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unfunded';
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS payment_ref    TEXT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_bookings_payment_status_check') THEN
    ALTER TABLE public.service_bookings ADD CONSTRAINT service_bookings_payment_status_check
      CHECK (payment_status IN ('unfunded', 'captured', 'refunded'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_bookings_amount_positive') THEN
    ALTER TABLE public.service_bookings ADD CONSTRAINT service_bookings_amount_positive
      CHECK (amount_cents IS NULL OR amount_cents > 0) NOT VALID;
  END IF;
END $$;

-- Phones keep reading their own rows; every write goes through the functions below.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.service_bookings    FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.disputes            FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.wallet_transactions FROM anon, authenticated;
REVOKE SELECT ON public.service_bookings, public.disputes, public.wallet_transactions FROM anon;

-- Write policies that no longer apply, so the policy list says what is true.
DROP POLICY IF EXISTS "service_bookings_manage"    ON public.service_bookings;
DROP POLICY IF EXISTS "Client can book"            ON public.service_bookings;
DROP POLICY IF EXISTS "Clients create bookings"    ON public.service_bookings;
DROP POLICY IF EXISTS "Participants update booking" ON public.service_bookings;
DROP POLICY IF EXISTS "Parties update bookings"    ON public.service_bookings;
DROP POLICY IF EXISTS "service_bookings_select"    ON public.service_bookings;
CREATE POLICY "service_bookings_select" ON public.service_bookings
  FOR SELECT USING (client_id = auth.uid() OR provider_id = auth.uid());

DROP POLICY IF EXISTS "disputes_manage"         ON public.disputes;
DROP POLICY IF EXISTS "Dispute parties can see" ON public.disputes;
DROP POLICY IF EXISTS "Users raise own disputes" ON public.disputes;
DROP POLICY IF EXISTS "disputes_select"         ON public.disputes;
CREATE POLICY "disputes_select" ON public.disputes
  FOR SELECT USING (
    filed_by = auth.uid() OR raised_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.service_bookings b
                WHERE b.id = disputes.booking_id
                  AND (b.client_id = auth.uid() OR b.provider_id = auth.uid()))
  );

DROP POLICY IF EXISTS "wallet_own"    ON public.wallet_transactions;
DROP POLICY IF EXISTS "wallet_select" ON public.wallet_transactions;
CREATE POLICY "wallet_select" ON public.wallet_transactions
  FOR SELECT USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.create_service_booking(
  p_service_node_id UUID,
  p_amount_cents    INTEGER,
  p_cargo_type      TEXT        DEFAULT NULL,
  p_pickup_address  TEXT        DEFAULT NULL,
  p_dropoff_address TEXT        DEFAULT NULL,
  p_scheduled_at    TIMESTAMPTZ DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_provider UUID;
  v_id       UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '28000';
  END IF;
  SELECT COALESCE(n.provider_id, n.user_id) INTO v_provider
    FROM public.service_nodes n
   WHERE n.id = p_service_node_id AND COALESCE(n.is_active, true) AND COALESCE(n.available, true);
  IF v_provider IS NULL THEN
    RAISE EXCEPTION 'service not found or unavailable' USING ERRCODE = 'P0002';
  END IF;
  IF v_provider = v_uid THEN
    RAISE EXCEPTION 'you cannot book your own service' USING ERRCODE = '42501';
  END IF;
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 OR p_amount_cents > 100000000 THEN
    RAISE EXCEPTION 'invalid amount' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.service_bookings
    (service_node_id, client_id, provider_id, cargo_type, pickup_address, dropoff_address,
     scheduled_at, amount_cents, estimated_price, status, payment_status)
  VALUES
    (p_service_node_id, v_uid, v_provider, left(p_cargo_type, 200), left(p_pickup_address, 500),
     left(p_dropoff_address, 500), p_scheduled_at, p_amount_cents, p_amount_cents / 100.0,
     'escrow_held', 'unfunded')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL     ON FUNCTION public.create_service_booking(UUID, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.create_service_booking(UUID, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;

-- Credits the provider only for money a payment provider actually captured.
-- Nothing sets 'captured' yet, so no balance is ever created from nothing.
DROP FUNCTION IF EXISTS public.release_escrow_to_provider(UUID);
CREATE FUNCTION public.release_escrow_to_provider(p_booking_id UUID)
RETURNS TABLE (booking_id UUID, provider_id UUID, amount_cents INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b public.service_bookings;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '28000';
  END IF;
  SELECT * INTO b FROM public.service_bookings sb WHERE sb.id = p_booking_id FOR UPDATE;
  IF b.id IS NULL THEN
    RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002';
  END IF;
  IF b.client_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'only the client who booked may release this booking' USING ERRCODE = '42501';
  END IF;
  IF b.status NOT IN ('escrow_held', 'in_progress') THEN
    RAISE EXCEPTION 'booking is % — it cannot be released', b.status USING ERRCODE = '22023';
  END IF;
  UPDATE public.service_bookings sb SET status = 'completed', completed_at = now() WHERE sb.id = b.id;
  IF b.payment_status = 'captured' AND COALESCE(b.amount_cents, 0) > 0 THEN
    UPDATE public.profiles p
       SET wallet_balance = COALESCE(p.wallet_balance, 0) + (b.amount_cents / 100.0)
     WHERE p.id = b.provider_id;
    INSERT INTO public.wallet_transactions (user_id, amount, direction, reason, ref_type, ref_id)
    VALUES (b.provider_id, b.amount_cents / 100.0, 'credit', 'booking released', 'service_booking', b.id);
  END IF;
  RETURN QUERY SELECT b.id, b.provider_id, b.amount_cents;
END;
$$;
REVOKE ALL     ON FUNCTION public.release_escrow_to_provider(UUID) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.release_escrow_to_provider(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.open_dispute(p_booking_id UUID, p_reason TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  b     public.service_bookings;
  v_id  UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '28000';
  END IF;
  SELECT * INTO b FROM public.service_bookings sb WHERE sb.id = p_booking_id FOR UPDATE;
  IF b.id IS NULL OR v_uid NOT IN (b.client_id, b.provider_id) THEN
    RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002';
  END IF;
  IF b.status NOT IN ('escrow_held', 'in_progress') THEN
    RAISE EXCEPTION 'booking is % — it cannot be disputed', b.status USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.disputes d WHERE d.booking_id = b.id AND d.status = 'open') THEN
    RAISE EXCEPTION 'this booking already has an open dispute' USING ERRCODE = '23505';
  END IF;
  UPDATE public.service_bookings sb SET status = 'disputed', disputed_at = now() WHERE sb.id = b.id;
  INSERT INTO public.disputes (booking_id, filed_by, raised_by, reason, status)
  VALUES (b.id, v_uid, v_uid, left(COALESCE(p_reason, ''), 2000), 'open')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL     ON FUNCTION public.open_dispute(UUID, TEXT) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.open_dispute(UUID, TEXT) TO authenticated;

-- ── 7. Unused definer functions off the public API (001000) ────────────────
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname IN ('get_unread_notification_count', 'get_event_engagement',
                         'purge_expired_checkins', 'safe_insert_chat_message')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM public, anon, authenticated', f.sig);
  END LOOP;
END $$;

-- ── 8. The Meal: boosts and view counts are server-only (001100) ───────────
CREATE OR REPLACE FUNCTION public.protect_meal_reach_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.is_boosted        := false;
    NEW.boosted_until     := NULL;
    NEW.view_count        := 0;
    NEW.unique_view_count := 0;
  ELSE
    NEW.is_boosted        := OLD.is_boosted;
    NEW.boosted_until     := OLD.boosted_until;
    NEW.view_count        := OLD.view_count;
    NEW.unique_view_count := OLD.unique_view_count;
    NEW.owner_id          := OLD.owner_id;
    NEW.business_id       := OLD.business_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_meal_reach ON public.meal_posts;
CREATE TRIGGER trg_protect_meal_reach
  BEFORE INSERT OR UPDATE ON public.meal_posts
  FOR EACH ROW EXECUTE FUNCTION public.protect_meal_reach_columns();

-- ── 9. Touch Down door code (20261007) ─────────────────────────────────────
ALTER TABLE public.live_checkins ADD COLUMN IF NOT EXISTS verify_level smallint;

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

CREATE OR REPLACE FUNCTION public.door_code_at(p_secret bytea, p_window bigint)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path = public, extensions AS $$
  SELECT lpad(
    (( (get_byte(d, 0)::bigint << 24) | (get_byte(d, 1) << 16) | (get_byte(d, 2) << 8) | get_byte(d, 3) )
      % 1000000)::text, 6, '0')
  FROM (SELECT extensions.hmac(p_window::text::bytea, p_secret, 'sha256') AS d) s;
$$;
REVOKE ALL ON FUNCTION public.door_code_at(bytea, bigint) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.can_run_door(p_event uuid, p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_user IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = p_event AND e.author_id = p_user)
    OR EXISTS (SELECT 1 FROM public.event_roles r
                WHERE r.event_id = p_event AND r.user_id = p_user AND r.role IN ('co_host', 'scanner'))
  );
$$;
REVOKE ALL ON FUNCTION public.can_run_door(uuid, uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_door_code(p_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
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
  VALUES (p_event_id, extensions.gen_random_bytes(32))
  ON CONFLICT (event_id) DO NOTHING;
  SELECT s.secret INTO v_secret FROM public.event_door_secrets s WHERE s.event_id = p_event_id;
  RETURN jsonb_build_object(
    'code', public.door_code_at(v_secret, v_window),
    'seconds_left', ceil(30 - (v_now - v_window * 30))::int,
    'period', 30
  );
END;
$$;
REVOKE ALL     ON FUNCTION public.get_door_code(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_door_code(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_down_with_code(
  p_event_id uuid,
  p_code     text,
  p_lat      double precision DEFAULT NULL,
  p_lon      double precision DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
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
  DELETE FROM public.door_code_attempts a WHERE a.at < now() - interval '1 day';
  SELECT count(*) INTO v_tries FROM public.door_code_attempts a
   WHERE a.user_id = v_uid AND a.event_id = p_event_id AND a.at > now() - interval '10 minutes';
  IF v_tries >= 10 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_many_attempts');
  END IF;
  INSERT INTO public.door_code_attempts (user_id, event_id) VALUES (v_uid, p_event_id);
  SELECT s.secret INTO v_secret FROM public.event_door_secrets s WHERE s.event_id = p_event_id;
  IF v_secret IS NULL OR length(v_code) <> 6 OR v_code NOT IN (
       public.door_code_at(v_secret, v_window),
       public.door_code_at(v_secret, v_window - 1)) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'wrong_or_expired_code');
  END IF;
  UPDATE public.live_checkins c
     SET verify_level  = greatest(coalesce(c.verify_level, 0), 2),
         verified      = true,
         checked_in_at = coalesce(c.checked_in_at, now()),
         lat = coalesce(round(p_lat::numeric, 3)::float8, c.lat),
         lon = coalesce(round(p_lon::numeric, 3)::float8, c.lon)
   WHERE c.user_id = v_uid AND c.event_id = p_event_id;
  IF NOT FOUND THEN
    INSERT INTO public.live_checkins (event_id, user_id, lat, lon, verified, verify_level)
    VALUES (p_event_id, v_uid, round(p_lat::numeric, 3)::float8, round(p_lon::numeric, 3)::float8, true, 2);
  END IF;
  DELETE FROM public.door_code_attempts a WHERE a.user_id = v_uid AND a.event_id = p_event_id;
  RETURN jsonb_build_object('ok', true, 'level', 2);
END;
$$;
REVOKE ALL     ON FUNCTION public.touch_down_with_code(uuid, text, double precision, double precision) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.touch_down_with_code(uuid, text, double precision, double precision) TO authenticated;

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
    NEW.verified := true;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS zz_pin_presence_level ON public.live_checkins;
CREATE TRIGGER zz_pin_presence_level
  BEFORE INSERT OR UPDATE ON public.live_checkins
  FOR EACH ROW EXECUTE FUNCTION public.pin_presence_level();

-- ── 10. Reels: deleted means deleted; guests see settled clips (20261020) ──
DROP POLICY IF EXISTS "Reels readable by all" ON public.reels;
DROP POLICY IF EXISTS reels_select ON public.reels;
CREATE POLICY reels_select ON public.reels
  FOR SELECT USING (COALESCE(visibility, 'public') = 'public' OR user_id = auth.uid());

DROP POLICY IF EXISTS reels_hide_deleted ON public.reels;
CREATE POLICY reels_hide_deleted ON public.reels
  AS RESTRICTIVE FOR SELECT
  USING (
    (deleted_at IS NULL AND COALESCE(is_deleted, false) = false)
    OR user_id = auth.uid()
    OR public.is_admin(auth.uid())
  );

CREATE OR REPLACE FUNCTION public.reel_author_settled(p_author uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = p_author AND p.created_at <= now() - interval '7 days'
  );
$$;
REVOKE ALL ON FUNCTION public.reel_author_settled(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.reel_author_settled(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS reels_guest_safe ON public.reels;
CREATE POLICY reels_guest_safe ON public.reels
  AS RESTRICTIVE FOR SELECT TO anon
  USING (
    public.reel_author_settled(user_id)
    AND COALESCE(report_count, 0) < 2
    AND COALESCE(auto_flagged, false) = false
    AND COALESCE(min_age, 13) < 18
  );

CREATE TABLE IF NOT EXISTS public.reel_conversions (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reel_id    uuid NOT NULL REFERENCES public.reels(id)    ON DELETE CASCADE,
  event_id   uuid NOT NULL REFERENCES public.events(id)   ON DELETE CASCADE,
  viewer_id  uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('event_open', 'rsvp')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reel_id, viewer_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_reel_conversions_event ON public.reel_conversions (event_id);
ALTER TABLE public.reel_conversions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reel_conversions FROM public, anon;
GRANT SELECT, INSERT ON public.reel_conversions TO authenticated;

DROP POLICY IF EXISTS reel_conversions_read_own ON public.reel_conversions;
CREATE POLICY reel_conversions_read_own ON public.reel_conversions
  FOR SELECT TO authenticated USING (viewer_id = auth.uid());

DROP POLICY IF EXISTS reel_conversions_insert_own ON public.reel_conversions;
CREATE POLICY reel_conversions_insert_own ON public.reel_conversions
  FOR INSERT TO authenticated
  WITH CHECK (
    reel_conversions.viewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.reels r
       WHERE r.id = reel_conversions.reel_id
         AND r.event_id = reel_conversions.event_id
         AND r.user_id IS DISTINCT FROM auth.uid()
    )
    AND (
      reel_conversions.kind = 'event_open'
      OR (
        EXISTS (
          SELECT 1 FROM public.reel_conversions c
           WHERE c.reel_id = reel_conversions.reel_id
             AND c.viewer_id = auth.uid()
             AND c.kind = 'event_open'
             AND c.created_at > now() - interval '1 day'
        )
        AND EXISTS (
          SELECT 1 FROM public.event_rsvps v
           WHERE v.event_id = reel_conversions.event_id AND v.user_id = auth.uid()
        )
      )
    )
  );

CREATE OR REPLACE FUNCTION public.my_clip_stats()
RETURNS TABLE(
  reel_id uuid, event_id uuid, event_title text, created_at timestamptz,
  thumbnail_url text, views bigint, event_opens bigint, rsvps bigint, mine boolean
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT r.id, r.event_id, e.title, r.created_at, r.thumbnail_url,
         COALESCE(r.view_count, 0)::bigint,
         COUNT(c.id) FILTER (WHERE c.kind = 'event_open'),
         COUNT(c.id) FILTER (WHERE c.kind = 'rsvp'),
         r.user_id = auth.uid()
    FROM public.reels r
    JOIN public.events e ON e.id = r.event_id
    LEFT JOIN public.reel_conversions c ON c.reel_id = r.id
   WHERE auth.uid() IS NOT NULL
     AND (r.user_id = auth.uid() OR e.author_id = auth.uid())
     AND r.deleted_at IS NULL
     AND COALESCE(r.is_deleted, false) = false
   GROUP BY r.id, e.title
   ORDER BY r.created_at DESC
   LIMIT 100;
$$;
REVOKE ALL ON FUNCTION public.my_clip_stats() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_clip_stats() TO authenticated;
