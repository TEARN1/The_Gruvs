-- ═══════════════════════════════════════════════════════════════════════════
-- event_chat_hardening.sql — moderators moderate, they don't rewrite.
--
-- Two live holes found auditing the running DB (2026-07-19), both the same
-- class as the DM issues fixed in messages_send_hardening.sql:
--
--   1. ORGANIZER CAN FORGE ATTENDEE SPEECH. Policy `chat_update_moderator`
--      grants UPDATE on any row in your event with NO column restriction, so
--      a host/co-host/moderator can silently rewrite the `message` text of
--      anything an attendee said. This is aimed squarely at the Truth
--      Protocol: the product's claim is that crowdsourced reality beats
--      organizer spin, and the organizer could edit the crowd.
--      Moderation must be delete/hide/pin — never rewrite.
--
--   2. THE CHAT BAN GATE NEVER EXISTED. dataFlow.js calls
--      rpc('can_send_chat', …) before every event-chat send, but no such
--      function is defined on this database. The call errors, `data` comes
--      back undefined, `canSend === false` is false, and the send proceeds —
--      the gate is open by construction. (Same dead-RPC pattern as the
--      `send_message` Tier 5 removed from MessageManager.send.)
--
-- Idempotent. Add to DEPLOY_SQL_RUNBOOK.md Part 1.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────
-- 1. Column-level guard. RLS can't say "which columns", so a BEFORE UPDATE
--    trigger does.
--
--    Event chat is a live-room record, not a document: once a line is
--    posted its TEXT IS IMMUTABLE for everyone, author included. There is no
--    `edited` column to carry an honest edit marker, and adding a silent
--    edit path to the one surface whose whole job is being an unspun record
--    would be the wrong trade. Moderation acts on `deleted` and `is_pinned`.
--
--    auth.uid() IS NULL => service_role / SQL console / migration: left alone.
-- ─────────────────────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────────
-- 0. Prerequisites found while probing this fix.
--
--    `banned` was not an allowed event_roles value, and `granted_by` did not
--    exist at all — even though EventRoleManager.js has always inserted it,
--    which means granting Co-Host/Moderator has NEVER once succeeded on this
--    database (same class as the `pinned` vs `is_pinned` bug in chat).
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.event_roles DROP CONSTRAINT IF EXISTS event_roles_role_check;
ALTER TABLE public.event_roles ADD CONSTRAINT event_roles_role_check
  CHECK (role = ANY (ARRAY['co_host','moderator','scanner','vip_manager','banned']));

ALTER TABLE public.event_roles
  ADD COLUMN IF NOT EXISTS granted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;


CREATE OR REPLACE FUNCTION public.guard_event_chat_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid       uuid := auth.uid();
  is_author boolean;
  is_mod    boolean;
BEGIN
  IF uid IS NULL THEN
    RETURN NEW;
  END IF;

  is_author := (uid = OLD.user_id);

  SELECT EXISTS (
    SELECT 1 FROM public.event_roles r
    WHERE r.event_id = OLD.event_id AND r.user_id = uid
      AND r.role IN ('co_host','moderator')
  ) OR EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = OLD.event_id AND e.author_id = uid
  ) INTO is_mod;

  IF NOT (is_author OR is_mod) THEN
    RAISE EXCEPTION 'not allowed to modify this message';
  END IF;

  -- Provenance is never rewritable.
  IF NEW.id         IS DISTINCT FROM OLD.id
  OR NEW.event_id   IS DISTINCT FROM OLD.event_id
  OR NEW.user_id    IS DISTINCT FROM OLD.user_id
  OR NEW.created_at IS DISTINCT FROM OLD.created_at
  OR NEW.reply_to   IS DISTINCT FROM OLD.reply_to THEN
    RAISE EXCEPTION 'message provenance is immutable';
  END IF;

  -- THE fix for hole 1: nobody rewrites what was said.
  IF NEW.message IS DISTINCT FROM OLD.message THEN
    RAISE EXCEPTION 'a chat message cannot be edited once sent';
  END IF;

  -- Pinning is a moderator act.
  IF NEW.is_pinned IS DISTINCT FROM OLD.is_pinned AND NOT is_mod THEN
    RAISE EXCEPTION 'only a host or moderator can pin a message';
  END IF;

  -- Deleting: your own line, or a moderator hiding it. One-way.
  IF NEW.deleted IS DISTINCT FROM OLD.deleted THEN
    IF NOT (is_author OR is_mod) THEN
      RAISE EXCEPTION 'not allowed to delete this message';
    END IF;
    IF COALESCE(OLD.deleted, false) = true AND COALESCE(NEW.deleted, false) = false THEN
      RAISE EXCEPTION 'a deleted message cannot be restored';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_event_chat_update_trigger ON public.event_chat_messages;
CREATE TRIGGER guard_event_chat_update_trigger
  BEFORE UPDATE ON public.event_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_event_chat_update();

REVOKE EXECUTE ON FUNCTION public.guard_event_chat_update() FROM public, anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 2. The ban gate the client already thinks it is calling.
--
--    `banned` joins co_host / moderator / scanner / vip_manager as an
--    event_roles value — the moderator role already advertises "Manage chat",
--    but there was no mechanism behind it.
--
--    Returns a plain boolean and refuses to answer for anyone but the
--    caller, so it can't be used to probe another user's standing.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_send_chat(p_user_id uuid, p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;

  -- Banned from this event's chat by a host or moderator.
  IF EXISTS (
    SELECT 1 FROM public.event_roles r
    WHERE r.event_id = p_event_id AND r.user_id = p_user_id AND r.role = 'banned'
  ) THEN
    RETURN false;
  END IF;

  -- Blocked in either direction with the event's host.
  IF EXISTS (
    SELECT 1
    FROM public.events e
    JOIN public.user_blocks b
      ON (b.blocker_id = e.author_id AND b.blocked_id = p_user_id)
      OR (b.blocker_id = p_user_id   AND b.blocked_id = e.author_id)
    WHERE e.id = p_event_id
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_send_chat(uuid, uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.can_send_chat(uuid, uuid) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 3. Enforce the ban server-side too. The RPC above is a courtesy so the UI
--    can explain itself; this is what actually stops a direct REST insert.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.gate_event_chat_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.event_roles r
    WHERE r.event_id = NEW.event_id AND r.user_id = NEW.user_id AND r.role = 'banned'
  ) THEN
    RAISE EXCEPTION 'You are not allowed to chat in this event.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gate_event_chat_insert_trigger ON public.event_chat_messages;
CREATE TRIGGER gate_event_chat_insert_trigger
  BEFORE INSERT ON public.event_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.gate_event_chat_insert();

REVOKE EXECUTE ON FUNCTION public.gate_event_chat_insert() FROM public, anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 4. Retire the now-redundant UPDATE policy predicate name. The policy stays
--    permissive (participants + moderators may attempt an update); section 1
--    is what constrains WHICH columns. Renamed so an auditor reading the
--    policy list isn't told a restriction exists where it doesn't.
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "chat_update_moderator" ON public.event_chat_messages;
DROP POLICY IF EXISTS "chat_update_author_or_mod_cols_guarded" ON public.event_chat_messages;
CREATE POLICY "chat_update_author_or_mod_cols_guarded"
  ON public.event_chat_messages FOR UPDATE
  USING (
    (user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.event_roles r
               WHERE r.event_id = event_chat_messages.event_id
                 AND r.user_id = auth.uid()
                 AND r.role IN ('co_host','moderator'))
    OR EXISTS (SELECT 1 FROM public.events e
               WHERE e.id = event_chat_messages.event_id
                 AND e.author_id = auth.uid())
  );
