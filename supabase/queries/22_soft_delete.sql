-- ============================================================
--  THE GRUVS — SOFT DELETE
--  Adds deleted_at to events, sport_teams, sport_media,
--  event_lineup, event_vendors so nothing is permanently gone.
--  Existing RLS SELECT policies are replaced to exclude
--  soft-deleted rows automatically.
--  Run in: Supabase → SQL Editor → Run
--  Idempotent — safe to re-run.
-- ============================================================

-- ── ADD deleted_at COLUMNS ────────────────────────────────────────────────────
ALTER TABLE public.events        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.sport_teams   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.sport_media   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.event_lineup  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.event_vendors ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ── PARTIAL INDEXES — fast lookup of live rows ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_events_not_deleted
  ON public.events(event_date DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sport_teams_not_deleted
  ON public.sport_teams(event_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sport_media_not_deleted
  ON public.sport_media(event_id, created_at DESC) WHERE deleted_at IS NULL;

-- ── UPDATE RLS POLICIES TO EXCLUDE SOFT-DELETED ROWS ─────────────────────────

-- events
DROP POLICY IF EXISTS "events_select" ON public.events;
CREATE POLICY "events_select" ON public.events FOR SELECT
  USING (deleted_at IS NULL AND (is_published = true OR author_id = auth.uid()));

-- sport_teams
DROP POLICY IF EXISTS "sport_teams_read" ON public.sport_teams;
CREATE POLICY "sport_teams_read" ON public.sport_teams FOR SELECT
  USING (deleted_at IS NULL);

-- sport_media
DROP POLICY IF EXISTS "sport_media_read" ON public.sport_media;
CREATE POLICY "sport_media_read" ON public.sport_media FOR SELECT
  USING (deleted_at IS NULL);

-- event_lineup
DROP POLICY IF EXISTS "lineup_read" ON public.event_lineup;
CREATE POLICY "lineup_read" ON public.event_lineup FOR SELECT
  USING (deleted_at IS NULL);

-- event_vendors
DROP POLICY IF EXISTS "vendors_read" ON public.event_vendors;
CREATE POLICY "vendors_read" ON public.event_vendors FOR SELECT
  USING (deleted_at IS NULL);

-- ── SOFT-DELETE HELPER FUNCTION ───────────────────────────────────────────────
-- Usage: SELECT soft_delete('events', '<uuid>');
CREATE OR REPLACE FUNCTION public.soft_delete(p_table TEXT, p_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  EXECUTE format('UPDATE public.%I SET deleted_at = now() WHERE id = $1', p_table)
    USING p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete(TEXT, UUID) TO authenticated;

-- ── RESTORE HELPER ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.restore_deleted(p_table TEXT, p_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  EXECUTE format('UPDATE public.%I SET deleted_at = NULL WHERE id = $1', p_table)
    USING p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_deleted(TEXT, UUID) TO authenticated;
