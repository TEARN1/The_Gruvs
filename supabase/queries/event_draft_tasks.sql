-- ═══════════════════════════════════════════════════════════════════════════
-- event_draft_tasks.sql — shared prep checklist for a co-created plan
-- (feature 51: "bring the speaker", "print wristbands" — assignable, checkable).
--
-- Same posture as event_drafts.sql: RPC-only writes, zero write policies,
-- attribution stamped from auth.uid(). Tasks stay attached to the draft, so
-- after launch the crew still sees (and works) the same list.
--
-- Idempotent. Add to DEPLOY_SQL_RUNBOOK.md (depends on event_drafts.sql).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.event_draft_tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id    uuid NOT NULL REFERENCES public.event_drafts(id) ON DELETE CASCADE,
  title       text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  created_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  done_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  done_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_draft_tasks_draft_idx
  ON public.event_draft_tasks (draft_id, created_at);

ALTER TABLE public.event_draft_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS draft_tasks_select ON public.event_draft_tasks;
CREATE POLICY draft_tasks_select ON public.event_draft_tasks
  FOR SELECT USING (public.is_draft_member(draft_id));

-- ─────────────────────────────────────────────────────────────────────────
-- RPCs. Members only; 100-task cap per draft; done/undone always records
-- WHO flipped it (attribution is the honesty layer, not a lock).
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.draft_task_add(p_draft uuid, p_title text, p_assign uuid DEFAULT NULL)
RETURNS public.event_draft_tasks
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  t   public.event_draft_tasks;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF NOT public.is_draft_member(p_draft) THEN RAISE EXCEPTION 'not a member of this draft'; END IF;
  IF (SELECT count(*) FROM public.event_draft_tasks WHERE draft_id = p_draft) >= 100 THEN
    RAISE EXCEPTION 'task list is full';
  END IF;
  IF p_assign IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.event_draft_members WHERE draft_id = p_draft AND user_id = p_assign
  ) THEN
    RAISE EXCEPTION 'can only assign tasks to plan members';
  END IF;

  INSERT INTO public.event_draft_tasks (draft_id, title, created_by, assigned_to)
  VALUES (p_draft, btrim(p_title), uid, p_assign)
  RETURNING * INTO t;
  RETURN t;
END;
$$;

CREATE OR REPLACE FUNCTION public.draft_task_toggle(p_task uuid, p_done boolean)
RETURNS public.event_draft_tasks
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  t   public.event_draft_tasks;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT * INTO t FROM public.event_draft_tasks WHERE id = p_task;
  IF NOT FOUND OR NOT public.is_draft_member(t.draft_id) THEN
    RAISE EXCEPTION 'not a member of this draft';
  END IF;

  UPDATE public.event_draft_tasks
  SET done_by = CASE WHEN p_done THEN uid ELSE NULL END,
      done_at = CASE WHEN p_done THEN now() ELSE NULL END
  WHERE id = p_task
  RETURNING * INTO t;
  RETURN t;
END;
$$;

CREATE OR REPLACE FUNCTION public.draft_task_assign(p_task uuid, p_user uuid)
RETURNS public.event_draft_tasks
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  t   public.event_draft_tasks;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT * INTO t FROM public.event_draft_tasks WHERE id = p_task;
  IF NOT FOUND OR NOT public.is_draft_member(t.draft_id) THEN
    RAISE EXCEPTION 'not a member of this draft';
  END IF;
  IF p_user IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.event_draft_members WHERE draft_id = t.draft_id AND user_id = p_user
  ) THEN
    RAISE EXCEPTION 'can only assign tasks to plan members';
  END IF;

  UPDATE public.event_draft_tasks SET assigned_to = p_user
  WHERE id = p_task RETURNING * INTO t;
  RETURN t;
END;
$$;

-- Delete: the task's creator or the plan owner.
CREATE OR REPLACE FUNCTION public.draft_task_delete(p_task uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  t   public.event_draft_tasks;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT * INTO t FROM public.event_draft_tasks WHERE id = p_task;
  IF NOT FOUND THEN RETURN; END IF;
  IF t.created_by <> uid AND NOT EXISTS (
    SELECT 1 FROM public.event_draft_members
    WHERE draft_id = t.draft_id AND user_id = uid AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'only the task creator or plan owner can remove it';
  END IF;
  DELETE FROM public.event_draft_tasks WHERE id = p_task;
END;
$$;

REVOKE ALL ON public.event_draft_tasks FROM public, anon;
GRANT SELECT ON public.event_draft_tasks TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.event_draft_tasks FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.draft_task_add(uuid,text,uuid)   FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.draft_task_toggle(uuid,boolean)  FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.draft_task_assign(uuid,uuid)     FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.draft_task_delete(uuid)          FROM public, anon;
GRANT EXECUTE ON FUNCTION public.draft_task_add(uuid,text,uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.draft_task_toggle(uuid,boolean)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.draft_task_assign(uuid,uuid)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.draft_task_delete(uuid)           TO authenticated;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_draft_tasks;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
