-- ─────────────────────────────────────────────────────────────────────────────
-- people_interest.sql — mutual interest → chat unlock, private + mutual only.
--
-- Model (locked by the founder, deliberately not the "who liked you" pattern):
-- expressing interest is INVISIBLE unless reciprocated. Neither person ever
-- learns the other tapped it. Chat unlocks only on a match. No rejection
-- surface, no way to enumerate who's interested in whom.
--
-- The RLS is the whole safety design:
--   • A user may SELECT only their own OUTGOING rows — never anyone's incoming.
--   • Mutual detection happens ONLY inside express_interest() (SECURITY
--     DEFINER) — the client is never told a one-sided interest exists.
--   • Rows expire (30 days) so this never becomes a permanent dossier.
--   • Blocked users and under-18 pairs are refused inside the RPC.
--
-- Deliberately STRICTER than ageGate.js's fail-open-on-unknown policy: an
-- event's 18+ door is a venue's call and failing open just means "the club
-- didn't card you". This is interpersonal interest between two specific
-- people — failing open on unknown age here could pair a minor with an adult
-- with no age data on record at all. Both parties must have a determinable
-- age >= 18 or the RPC refuses, silently (see below on what "refuses" means).
--
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.people_interest (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id    UUID REFERENCES public.events(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  CONSTRAINT people_interest_not_self CHECK (from_user <> to_user),
  CONSTRAINT people_interest_unique UNIQUE (from_user, to_user)
);

CREATE INDEX IF NOT EXISTS idx_people_interest_to_user ON public.people_interest(to_user, created_at);
CREATE INDEX IF NOT EXISTS idx_people_interest_expiry  ON public.people_interest(expires_at);

ALTER TABLE public.people_interest ENABLE ROW LEVEL SECURITY;

-- The core safety property: SELECT is scoped to from_user = auth.uid() ONLY.
-- There is deliberately no policy under which a row where to_user = auth.uid()
-- is visible via a direct table read — that visibility exists NOWHERE except
-- inside the SECURITY DEFINER function below, which never returns the row
-- itself, only a status string.
DROP POLICY IF EXISTS "people_interest_own_outgoing_select" ON public.people_interest;
CREATE POLICY "people_interest_own_outgoing_select" ON public.people_interest FOR SELECT
  USING (from_user = auth.uid());

-- No direct INSERT/UPDATE/DELETE policy for anyone. Every write goes through
-- express_interest(), which is the only place the anti-abuse checks live —
-- two enforcement points (a permissive policy AND the function) is how a
-- check quietly stops covering the real path.

-- ── express_interest ─────────────────────────────────────────────────────────
-- Returns: 'matched' | 'recorded' | 'refused'. Never distinguishes WHY a
-- refusal happened (blocked, under-age, self-interest, rate limit) in a way
-- the client could use to infer anything about the other person — "refused"
-- always looks the same from the caller's side.
CREATE OR REPLACE FUNCTION public.express_interest(
  p_to_user  uuid,
  p_event_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me           uuid := auth.uid();
  v_my_age       int;
  v_their_age    int;
  v_blocked      boolean;
  v_today_count  int;
  v_reverse_id   uuid;
  v_thread_body  text := 'You are both interested -- say hi!';
BEGIN
  IF v_me IS NULL OR p_to_user IS NULL OR p_to_user = v_me THEN
    RETURN 'refused';
  END IF;

  -- Blocked either direction -- refuse silently, same shape as any other refusal.
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE (user_id = v_me AND blocked_id = p_to_user)
       OR (user_id = p_to_user AND blocked_id = v_me)
  ) INTO v_blocked;
  IF v_blocked THEN RETURN 'refused'; END IF;

  -- Both parties must have a determinable age >= 18. Deliberately fail-closed
  -- (see file header) -- unlike the event age gate, unknown age here refuses
  -- rather than allows.
  SELECT date_part('year', age(birth_date))::int INTO v_my_age
    FROM public.profiles WHERE id = v_me;
  SELECT date_part('year', age(birth_date))::int INTO v_their_age
    FROM public.profiles WHERE id = p_to_user;
  IF v_my_age IS NULL OR v_my_age < 18 OR v_their_age IS NULL OR v_their_age < 18 THEN
    RETURN 'refused';
  END IF;

  -- Per-day rate limit -- anti-spam, not a safety boundary. This is also the
  -- honest paid upgrade (more daily interests), never "see who likes you".
  SELECT count(*) INTO v_today_count
  FROM public.people_interest
  WHERE from_user = v_me AND created_at >= date_trunc('day', now());
  IF v_today_count >= 20 THEN RETURN 'refused'; END IF;

  -- Record it. ON CONFLICT DO NOTHING: re-tapping an existing interest is a
  -- no-op, not a refresh of its 30-day expiry (that would let someone keep an
  -- unrequited interest alive indefinitely by re-tapping).
  INSERT INTO public.people_interest (from_user, to_user, event_id)
  VALUES (v_me, p_to_user, p_event_id)
  ON CONFLICT (from_user, to_user) DO NOTHING;

  -- Mutual? Only place on earth this table's incoming direction is ever read.
  SELECT id INTO v_reverse_id
  FROM public.people_interest
  WHERE from_user = p_to_user AND to_user = v_me AND expires_at > now()
  LIMIT 1;

  IF v_reverse_id IS NULL THEN
    RETURN 'recorded'; -- one-sided so far; the other person is told NOTHING
  END IF;

  -- Match. Pre-accept the thread by seeding one message with
  -- request_accepted = true -- send_message_v2's own accepted-check looks for
  -- exactly this (an existing accepted row in EITHER direction), so every
  -- later message between these two is accepted from here on, with zero
  -- change needed to the DM send path itself.
  INSERT INTO public.messages (sender_id, recipient_id, body, is_request, request_accepted)
  VALUES (v_me, p_to_user, v_thread_body, false, true);

  -- Notify BOTH -- this is the only notification either party ever receives
  -- about interest. No "someone likes you" teaser exists anywhere in this
  -- design; that would leak the one-sided state the whole model hides.
  INSERT INTO public.notifications (recipient_id, actor_id, type, title, body)
  VALUES
    (v_me,      p_to_user, 'match', 'It is a match!', 'You are both interested -- say hi.'),
    (p_to_user, v_me,      'match', 'It is a match!', 'You are both interested -- say hi.');

  RETURN 'matched';
END;
$$;

REVOKE ALL ON FUNCTION public.express_interest(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.express_interest(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.express_interest IS
  'Record interest in someone; returns matched/recorded/refused. Never reveals a one-sided interest to either party -- mutual detection is entirely internal.';

-- Housekeeping: let expired interests actually disappear rather than sitting
-- forever as dead rows only the owner could ever have seen anyway.
CREATE OR REPLACE FUNCTION public.purge_expired_interests()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.people_interest WHERE expires_at < now();
$$;

REVOKE ALL ON FUNCTION public.purge_expired_interests() FROM public, anon, authenticated;
