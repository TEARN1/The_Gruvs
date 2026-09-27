-- ═══════════════════════════════════════════════════════════════════════════
-- messages_reactions_hardening.sql — reactions can't be forged or bloated.
--
-- DM reactions live in messages.reactions as a { user_id: emoji } JSONB map,
-- written by the client with a plain UPDATE. The guard_message_update trigger
-- (messages_send_hardening.sql) constrained every OTHER column but left
-- `reactions` wide open, so a DM participant issuing a raw REST update could:
--
--   1. FORGE another user's reaction — set reactions = {someoneElseId: '😍'},
--      putting a reaction in someone's name. Same provenance-forgery class
--      (attack class A) as the message-body forgery already closed.
--   2. BLOAT the row — write an arbitrary-length string or a huge map (cheap
--      DoS / storage abuse on a free tier), since nothing capped it.
--
-- This extends the guard: on any reactions change, only the caller's OWN key
-- may differ, the emoji is length-capped, and the map size is bounded.
-- Everything else in guard_message_update is reproduced verbatim so this file
-- is a safe, idempotent CREATE OR REPLACE.
--
-- Add to DEPLOY_SQL_RUNBOOK.md Part 1 (independent; depends on
-- messages_send_hardening.sql already being applied).
-- ═══════════════════════════════════════════════════════════════════════════

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

  -- Reactions: a participant may only add/remove/change THEIR OWN key in the
  -- { user_id: emoji } map. Closes reaction forgery (writing someone else's
  -- key) and caps emoji length + map size (blob-bloat / cheap DoS).
  IF NEW.reactions IS DISTINCT FROM OLD.reactions THEN
    IF EXISTS (
      SELECT 1
      FROM (
        SELECT key FROM jsonb_object_keys(COALESCE(OLD.reactions, '{}'::jsonb)) AS t(key)
        UNION
        SELECT key FROM jsonb_object_keys(COALESCE(NEW.reactions, '{}'::jsonb)) AS t(key)
      ) k
      WHERE COALESCE(OLD.reactions ->> k.key, '') IS DISTINCT FROM COALESCE(NEW.reactions ->> k.key, '')
        AND k.key <> uid::text
    ) THEN
      RAISE EXCEPTION 'you can only change your own reaction';
    END IF;
    IF length(COALESCE(NEW.reactions ->> uid::text, '')) > 16 THEN
      RAISE EXCEPTION 'invalid reaction';
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(COALESCE(NEW.reactions, '{}'::jsonb))) > 200 THEN
      RAISE EXCEPTION 'too many reactions';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_message_update_trigger ON public.messages;
CREATE TRIGGER guard_message_update_trigger
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_message_update();

REVOKE EXECUTE ON FUNCTION public.guard_message_update() FROM public, anon, authenticated;
