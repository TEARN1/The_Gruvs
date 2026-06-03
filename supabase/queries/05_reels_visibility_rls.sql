-- ============================================================================
-- 05_reels_visibility_rls.sql
-- ----------------------------------------------------------------------------
-- Enforce reel visibility on the SERVER, not just in the client filter:
--   public      → anyone (also the default / NULL)
--   private     → only the author
--   attendees   → the author + anyone who RSVP'd the reel's event
--
-- Run AFTER 02_reels_metadata_visibility.sql (needs reels.visibility).
--
-- IMPORTANT: Postgres combines PERMISSIVE policies with OR, so this policy only
-- bites if there is no other permissive SELECT policy on public.reels that
-- allows everything. This script drops the visibility policy first (idempotent)
-- and the common permissive names; if you have a custom "select all" policy
-- under a different name, drop it too or this restriction won't apply.
-- ============================================================================

ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;

-- Remove blanket "everyone can read reels" policies if present.
DROP POLICY IF EXISTS "reels_select_all"        ON public.reels;
DROP POLICY IF EXISTS "reels are viewable"       ON public.reels;
DROP POLICY IF EXISTS "reels_public_read"        ON public.reels;
DROP POLICY IF EXISTS "Reels are viewable by everyone" ON public.reels;

DROP POLICY IF EXISTS "reels_select_visibility" ON public.reels;
CREATE POLICY "reels_select_visibility" ON public.reels FOR SELECT
USING (
  coalesce(visibility, 'public') = 'public'
  OR user_id = auth.uid()
  OR (
    visibility = 'attendees'
    AND event_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.event_rsvps r
      WHERE r.event_id = reels.event_id
        AND r.user_id = auth.uid()
    )
  )
);

-- Writes stay owner-only (kept idempotent in case they already exist).
DROP POLICY IF EXISTS "reels_insert_own" ON public.reels;
CREATE POLICY "reels_insert_own" ON public.reels FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "reels_update_own" ON public.reels;
CREATE POLICY "reels_update_own" ON public.reels FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "reels_delete_own" ON public.reels;
CREATE POLICY "reels_delete_own" ON public.reels FOR DELETE
  USING (user_id = auth.uid());