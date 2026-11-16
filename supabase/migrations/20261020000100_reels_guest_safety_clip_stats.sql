-- ═════════════════════════════════════════════════════════════════════════════
--  20261020000100_reels_guest_safety_clip_stats.sql — who may see a reel, and
--  whether a clip ever sent anyone to its event.
--
--  1. "Reels readable by all" (SELECT USING is_deleted = false) is PERMISSIVE,
--     and permissive policies are OR'd: it let anyone read every reel, including
--     attendees-only and private ones, whatever reels_select said.
--  2. Deleted reels stayed readable. The app's delete button sets is_deleted,
--     reels_select_visibility checks neither that nor deleted_at, and so The
--     Drop's clips row kept showing all 10 reels their owner had deleted.
--  3. A logged-out visitor's first sight of the app should not be a clip from an
--     account made an hour ago, a reported clip, or a mature one. Guests now see
--     only "settled" clips; signed-in users, who can report, see the rest.
--  4. reel_conversions + my_clip_stats(): clip → event opened → RSVP, so the
--     people posting clips can see which ones fill their events.
--
--  Idempotent: runs twice cleanly, on production and on the CI schema.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 0. Columns production already has; the CI schema files never caught up ───
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS deleted_at    timestamptz;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS report_count  integer DEFAULT 0;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS thumbnail_url text;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS metadata      jsonb DEFAULT '{}'::jsonb;

-- ── 1. Close the read-everything hole ────────────────────────────────────────
-- reels_select_visibility grants what should be readable (public, your own, and
-- attendees-only to people who RSVP'd). Two policies widened that:
--   • "Reels readable by all" (production) — USING (is_deleted = false);
--   • reels_select in the schema files — USING (is_deleted = false), where
--     production had already narrowed it to public-or-own.
-- Drop the first and pin the second to production's meaning everywhere.
DROP POLICY IF EXISTS "Reels readable by all" ON public.reels;
DROP POLICY IF EXISTS reels_select ON public.reels;
CREATE POLICY reels_select ON public.reels
  FOR SELECT
  USING (COALESCE(visibility, 'public') = 'public' OR user_id = auth.uid());

-- ── 2. Deleted means deleted (owners and admins can still see their own) ─────
DROP POLICY IF EXISTS reels_hide_deleted ON public.reels;
CREATE POLICY reels_hide_deleted ON public.reels
  AS RESTRICTIVE FOR SELECT
  USING (
    (deleted_at IS NULL AND COALESCE(is_deleted, false) = false)
    OR user_id = auth.uid()
    OR public.is_admin(auth.uid())
  );

-- ── 3. What a logged-out visitor may see ─────────────────────────────────────
-- Account age lives on profiles, which anon cannot read column-by-column, so a
-- narrow definer answers the one yes/no question and nothing else.
CREATE OR REPLACE FUNCTION public.reel_author_settled(p_author uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = p_author
       AND p.created_at <= now() - interval '7 days'
  );
$$;
REVOKE ALL ON FUNCTION public.reel_author_settled(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.reel_author_settled(uuid) TO anon, authenticated;

-- Guests only: an account at least a week old, fewer than two reports, not
-- auto-flagged, and not rated 18+. Two reports rather than one so a single
-- grudge cannot take a clip off the guest feed.
DROP POLICY IF EXISTS reels_guest_safe ON public.reels;
CREATE POLICY reels_guest_safe ON public.reels
  AS RESTRICTIVE FOR SELECT TO anon
  USING (
    public.reel_author_settled(user_id)
    AND COALESCE(report_count, 0) < 2
    AND COALESCE(auto_flagged, false) = false
    AND COALESCE(min_age, 13) < 18
  );

-- ── 4. Did the clip send anyone to the event? ────────────────────────────────
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

-- A viewer sees only their own rows. Creators get totals from my_clip_stats(),
-- never the list of who tapped.
DROP POLICY IF EXISTS reel_conversions_read_own ON public.reel_conversions;
CREATE POLICY reel_conversions_read_own ON public.reel_conversions
  FOR SELECT TO authenticated
  USING (viewer_id = auth.uid());

-- Rows can only describe something that happened: a reel the viewer can see,
-- tagged to that event, posted by someone else; and an "rsvp" only after an
-- "event_open" from the same clip in the last day, with a real RSVP behind it.
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
           WHERE v.event_id = reel_conversions.event_id
             AND v.user_id = auth.uid()
        )
      )
    )
  );

-- Totals for the clips you posted and the clips tagged to events you host.
CREATE OR REPLACE FUNCTION public.my_clip_stats()
RETURNS TABLE(
  reel_id uuid, event_id uuid, event_title text, created_at timestamptz,
  thumbnail_url text, views bigint, event_opens bigint, rsvps bigint, mine boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
