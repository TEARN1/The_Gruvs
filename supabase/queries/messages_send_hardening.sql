-- ═══════════════════════════════════════════════════════════════════════════
-- messages_send_hardening.sql — one validated send path for DMs.
--
-- Closes four live holes found by auditing the running DB (2026-07-19):
--
--   1. SELF-ACCEPT / VIBE FARMING (critical). Policy `messages_update` lets
--      EITHER party update a message row, with no column restriction. A sender
--      could insert a request then UPDATE their own row to
--      request_accepted = true. That (a) bypasses the request gate outright and
--      (b) fires on_dm_accepted -> handle_message_acceptance, which mints
--      +5 vibe_score to the sender and +10 to the recipient. Repeat = an
--      unbounded vibe_score printer, and the recipient never consented.
--
--   2. MESSAGE FORGERY. Same policy: the RECIPIENT can rewrite the sender's
--      `body`. Words can be put in someone's mouth in their own thread — fatal
--      for a product whose pitch is that the record is trustworthy.
--
--   3. COLD-OPEN LIMIT IS BROKEN. enforce_message_limits reads
--        WHERE (A AND B) OR (C AND D AND request_accepted = true)
--      AND binds tighter than OR, so the first branch matches regardless of
--      request_accepted. is_accepted takes whatever the first row happens to
--      hold, so the 3-message gate both under- and over-fires.
--
--   4. NO LENGTH CAP + NO IDEMPOTENCY. `body` is unbounded (cheap DoS on a free
--      tier), and a retried send double-posts.
--
-- Everything here is idempotent and safe to re-run.
-- Add to DEPLOY_SQL_RUNBOOK.md Part 1 (independent).
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────
-- 1. Idempotency key. Partial unique index so a retry can't double-post,
--    scoped per sender so nobody can squat another user's key.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS client_key text;

-- messages.text and 5 siblings: existed live but in zero tracked SQL files
-- (hand-added at some point, never saved back) — found 2026-08-20 when
-- db-schema-ci.yml's fresh rebuild died on the CHECK constraint below, then
-- confirmed via a full live-vs-tracked diff which of the gaps are actually
-- referenced by later files in this batch (messages_reactions_hardening.sql,
-- messages_video_type.sql, event_chat_hardening.sql) so they'd break CI too.
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS text text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media jsonb;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_type text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reaction text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited boolean DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS room_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS messages_sender_client_key_uniq
  ON public.messages (sender_id, client_key)
  WHERE client_key IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────
-- 2. Length caps. NOT VALID so pre-existing rows are left alone; new and
--    updated rows are checked.
-- ─────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_body_len') THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_body_len
      CHECK (body IS NULL OR length(body) <= 4000) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_text_len') THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_text_len
      CHECK (text IS NULL OR length(text) <= 4000) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_client_key_len') THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_client_key_len
      CHECK (client_key IS NULL OR length(client_key) <= 64) NOT VALID;
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────
-- 3. Fix the cold-open gate: correct the OR/AND precedence, and add a
--    per-sender flood limit. Both run BEFORE INSERT, so they apply to the
--    RPC and to any direct REST insert alike.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_message_limits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_accepted boolean;
  msg_count   integer;
  recent      integer;
BEGIN
  -- Flood limit: 30 messages / 60s per sender, regardless of recipient.
  SELECT count(*) INTO recent
  FROM public.messages
  WHERE sender_id = NEW.sender_id
    AND created_at > now() - interval '60 seconds';
  IF recent >= 30 THEN
    RAISE EXCEPTION 'Slow down — too many messages sent just now.';
  END IF;

  -- Is this pair already an accepted conversation? (Parenthesised correctly.)
  SELECT true INTO is_accepted
  FROM public.messages
  WHERE ((sender_id = NEW.sender_id    AND recipient_id = NEW.recipient_id)
      OR (sender_id = NEW.recipient_id AND recipient_id = NEW.sender_id))
    AND request_accepted = true
  LIMIT 1;

  IF is_accepted IS NOT TRUE THEN
    SELECT count(*) INTO msg_count
    FROM public.messages
    WHERE sender_id = NEW.sender_id
      AND recipient_id = NEW.recipient_id
      AND COALESCE(request_accepted, false) = false;

    IF msg_count >= 3 THEN
      RAISE EXCEPTION 'Message limit reached. Wait for the recipient to accept your request.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_message_limits() FROM public, anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 4. Column-level immutability. RLS can't express "which columns", so this
--    BEFORE UPDATE trigger does. It is what actually closes holes 1 and 2.
--
--    - request_accepted / is_request : RECIPIENT only, and only false -> true.
--    - read_at                       : recipient only.
--    - deleted_at                    : sender only.
--    - body / text / media           : sender only, within a 5-minute edit
--                                      window, and the row is flagged edited.
--    - identity + timestamps         : never.
--
--    auth.uid() IS NULL means service_role / SQL console / a trigger running
--    outside a user session — left alone on purpose so admin tooling and
--    migrations still work.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_message_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid          uuid := auth.uid();
  is_sender    boolean;
  is_recipient boolean;
BEGIN
  IF uid IS NULL THEN
    RETURN NEW;  -- service_role / internal
  END IF;

  is_sender    := (uid = OLD.sender_id);
  is_recipient := (uid = OLD.recipient_id);

  IF NOT (is_sender OR is_recipient) THEN
    RAISE EXCEPTION 'not a participant in this conversation';
  END IF;

  -- Identity and provenance are never rewritable by anyone.
  IF NEW.sender_id    IS DISTINCT FROM OLD.sender_id
  OR NEW.recipient_id IS DISTINCT FROM OLD.recipient_id
  OR NEW.created_at   IS DISTINCT FROM OLD.created_at
  OR NEW.client_key   IS DISTINCT FROM OLD.client_key THEN
    RAISE EXCEPTION 'message identity is immutable';
  END IF;

  -- The handshake: only the RECIPIENT accepts, and only forwards.
  IF NEW.request_accepted IS DISTINCT FROM OLD.request_accepted THEN
    IF NOT is_recipient THEN
      RAISE EXCEPTION 'only the recipient can accept a request';
    END IF;
    IF COALESCE(OLD.request_accepted, false) = true
       AND COALESCE(NEW.request_accepted, false) = false THEN
      RAISE EXCEPTION 'a request cannot be un-accepted';
    END IF;
  END IF;

  IF NEW.is_request IS DISTINCT FROM OLD.is_request AND NOT is_recipient THEN
    RAISE EXCEPTION 'only the recipient can clear the request flag';
  END IF;

  -- Read receipts belong to the recipient.
  IF NEW.read_at IS DISTINCT FROM OLD.read_at AND NOT is_recipient THEN
    RAISE EXCEPTION 'only the recipient can mark a message read';
  END IF;

  -- Deleting is the sender's call.
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND NOT is_sender THEN
    RAISE EXCEPTION 'only the sender can delete a message';
  END IF;

  -- Content: sender-only, 5-minute window, always leaves a trace.
  IF NEW.body IS DISTINCT FROM OLD.body
  OR NEW.text IS DISTINCT FROM OLD.text
  OR NEW.media_url IS DISTINCT FROM OLD.media_url
  OR NEW.message_type IS DISTINCT FROM OLD.message_type
  OR NEW.event_id IS DISTINCT FROM OLD.event_id
  OR NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
    IF NOT is_sender THEN
      RAISE EXCEPTION 'only the sender can edit a message';
    END IF;
    IF OLD.created_at < now() - interval '5 minutes' THEN
      RAISE EXCEPTION 'the edit window for this message has closed';
    END IF;
    NEW.edited    := true;
    NEW.edited_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_message_update_trigger ON public.messages;
CREATE TRIGGER guard_message_update_trigger
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_message_update();

REVOKE EXECUTE ON FUNCTION public.guard_message_update() FROM public, anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 5. The one validated send path.
--
--    Sender is taken from auth.uid(), NEVER from a parameter — the old
--    client called an RPC with p_sender, which would have let any caller
--    send as anyone. (That RPC never existed on this database, so the
--    client's Tier-5 fallback was dead code; this replaces it.)
--
--    SECURITY INVOKER on purpose: RLS and the BEFORE INSERT triggers
--    (block gate, limits, delivered_at) all still apply. This function is
--    about validation and idempotency, not privilege.
-- ─────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.send_message_v2(uuid,text,text,text,uuid,uuid,text);

CREATE OR REPLACE FUNCTION public.send_message_v2(
  p_recipient  uuid,
  p_body       text             DEFAULT NULL,
  p_type       text             DEFAULT 'text',
  p_media_url  text             DEFAULT NULL,
  p_event_id   uuid             DEFAULT NULL,
  p_parent_id  uuid             DEFAULT NULL,
  p_client_key text             DEFAULT NULL,
  p_lat        double precision DEFAULT NULL,
  p_lng        double precision DEFAULT NULL
)
RETURNS public.messages
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  uid      uuid := auth.uid();
  clean    text;
  accepted boolean := false;
  out_row  public.messages;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;
  IF p_recipient IS NULL OR p_recipient = uid THEN
    RAISE EXCEPTION 'invalid recipient';
  END IF;
  IF p_type NOT IN ('text','image','location','vibe_card','event','voice') THEN
    RAISE EXCEPTION 'invalid message type';
  END IF;
  IF (p_lat IS NULL) <> (p_lng IS NULL) THEN
    RAISE EXCEPTION 'incomplete coordinates';
  END IF;
  IF p_lat IS NOT NULL AND (p_lat < -90 OR p_lat > 90 OR p_lng < -180 OR p_lng > 180) THEN
    RAISE EXCEPTION 'coordinates out of range';
  END IF;
  -- Coordinates are a deliberate share, only ever on a location message —
  -- they can never ride along on an ordinary text message.
  IF p_lat IS NOT NULL AND p_type <> 'location' THEN
    RAISE EXCEPTION 'coordinates are only valid on a location message';
  END IF;

  -- Idempotency: a retry returns the original row instead of double-posting.
  IF p_client_key IS NOT NULL THEN
    SELECT * INTO out_row FROM public.messages
    WHERE sender_id = uid AND client_key = p_client_key LIMIT 1;
    IF FOUND THEN RETURN out_row; END IF;
  END IF;

  clean := NULLIF(btrim(COALESCE(p_body, '')), '');
  IF clean IS NULL AND p_media_url IS NULL AND p_event_id IS NULL AND p_lat IS NULL THEN
    RAISE EXCEPTION 'message is empty';
  END IF;
  IF length(clean) > 4000 THEN
    RAISE EXCEPTION 'message is too long';
  END IF;
  -- Belt and braces alongside the client-side sanitiser.
  clean := regexp_replace(clean, '<script[^>]*>.*?</script>', '', 'gi');

  -- Has this pair already connected? Verified co-presence counts as an
  -- accepted intro, so a proven real-world meeting skips the request gate.
  SELECT true INTO accepted
  FROM public.messages
  WHERE ((sender_id = uid AND recipient_id = p_recipient)
      OR (sender_id = p_recipient AND recipient_id = uid))
    AND request_accepted = true
  LIMIT 1;
  accepted := COALESCE(accepted, false);

  INSERT INTO public.messages
    (sender_id, recipient_id, body, message_type, media_url,
     event_id, parent_id, client_key, latitude, longitude,
     is_request, request_accepted)
  VALUES
    (uid, p_recipient, clean, p_type, p_media_url,
     p_event_id, p_parent_id, p_client_key, p_lat, p_lng,
     NOT accepted, accepted)
  RETURNING * INTO out_row;

  RETURN out_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_message_v2(uuid,text,text,text,uuid,uuid,text,double precision,double precision) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.send_message_v2(uuid,text,text,text,uuid,uuid,text,double precision,double precision) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 6. Policy cleanup. Six duplicate SELECT/INSERT policies had accumulated,
--    all with identical predicates — noise that makes the real posture hard
--    to read during an audit. Collapse to one per command. Behaviour is
--    unchanged; the UPDATE policy stays permissive because the trigger in
--    section 4 is what constrains it.
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "DM participants can read messages" ON public.messages;
DROP POLICY IF EXISTS "Message participants can read"     ON public.messages;
DROP POLICY IF EXISTS "messages_select_own"               ON public.messages;
DROP POLICY IF EXISTS "messages_select_parts"             ON public.messages;
DROP POLICY IF EXISTS "Users send own messages"           ON public.messages;
DROP POLICY IF EXISTS "messages_insert_own"               ON public.messages;
DROP POLICY IF EXISTS "messages_update_parts"             ON public.messages;

-- Surviving: messages_select, messages_insert, messages_update,
--            "Users delete own messages".
--
-- NOTE on soft-deletes: one of the dropped policies carried
-- `AND deleted_at IS NULL`, but permissive policies OR together, so it never
-- actually hid anything — soft-deleted rows are visible today and the client
-- reads deleted_at to draw a tombstone. Deliberately NOT tightening that here;
-- it is a product decision (tombstone vs. vanish), not a security fix, and
-- folding it into this migration would change thread rendering silently.
