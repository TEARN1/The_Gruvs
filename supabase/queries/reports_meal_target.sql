-- ═══════════════════════════════════════════════════════════════════════════
-- reports_meal_target.sql — let a meal post actually be reported.
--
-- `MealDetailModal`'s Report button has never worked. Three separate faults:
--   1. it inserted `kind`, which is not a column on `reports` (it is target_type)
--   2. it omitted `reporter_id`, which is NOT NULL
--   3. 'meal' is not in the target_type CHECK constraint
--
-- (1) and (2) are fixed in the client. (3) can only be fixed here: the CHECK
-- currently allows ('event','user','reel','echo','message') only, so even a
-- correct insert would be rejected.
--
-- The client's catch reported success regardless, so every meal report has
-- silently vanished while telling the reporter "Thanks — we'll take a look."
-- A moderation path that lies is worse than one that is visibly missing.
--
-- Idempotent. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Widen the allowed report targets ────────────────────────────────────────
-- Constraint names differ between schema_part_1 and schema_part_2 lineages, so
-- drop whatever is actually attached rather than guessing a name.
DO $$
DECLARE
  v_name text;
BEGIN
  SELECT con.conname INTO v_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'reports'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%target_type%'
  LIMIT 1;

  IF v_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.reports DROP CONSTRAINT %I', v_name);
  END IF;
END $$;

ALTER TABLE public.reports
  ADD CONSTRAINT reports_target_type_check
  CHECK (target_type IN ('event','user','reel','echo','message','meal','business','story'));

-- ── Let a signed-in user file their own report ───────────────────────────────
-- Insert-only, and only as themselves: reporter_id is forced to auth.uid() by
-- the policy, so nobody can file a report in someone else's name.
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reports_insert_own ON public.reports;
CREATE POLICY reports_insert_own ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- Reporters may read back only their OWN reports (so the UI can show status).
-- Moderators read through the God View queue, which runs with elevated rights.
DROP POLICY IF EXISTS reports_read_own ON public.reports;
CREATE POLICY reports_read_own ON public.reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

-- Deliberately NO update/delete policy: a report is append-only from the
-- client. Resolution happens server-side via the moderation path.

-- ── Index the moderation queue's access pattern ─────────────────────────────
CREATE INDEX IF NOT EXISTS reports_pending_idx
  ON public.reports (target_type, created_at DESC)
  WHERE status = 'pending';
