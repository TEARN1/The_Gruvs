-- ═══════════════════════════════════════════════════════════════════════════
-- messages_block_gate.sql — block is ABSOLUTE for DMs, enforced in Postgres
--
-- The client refuses to send across a block, but a direct REST POST could
-- still insert a message row. This BEFORE INSERT trigger raises when a block
-- exists in EITHER direction — no DM crosses a block, not even as a request.
-- Trigger (not a policy rewrite) so it stacks safely on whatever INSERT
-- policies already exist. Idempotent.
--
-- Add to DEPLOY_SQL_RUNBOOK.md Part 1 (independent).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.block_gate_messages()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_blocks b
    WHERE (b.blocker_id = NEW.sender_id    AND b.blocked_id = NEW.recipient_id)
       OR (b.blocker_id = NEW.recipient_id AND b.blocked_id = NEW.sender_id)
  ) THEN
    RAISE EXCEPTION 'blocked';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.messages') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS block_gate_messages_trigger ON public.messages;
    CREATE TRIGGER block_gate_messages_trigger
      BEFORE INSERT ON public.messages
      FOR EACH ROW EXECUTE FUNCTION public.block_gate_messages();
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.block_gate_messages() FROM public, anon, authenticated;
