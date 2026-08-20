-- ════════════════════════════════════════════════════════════════════════════
--  THE GRUVS — SOCIAL RPCs (follow, unfollow, stories)
--  Paste into Supabase → SQL Editor → Run. Idempotent · safe to re-run · no drops.
--
--  Why: the app's follow button, story posting and story reshare each try a
--  SECURITY DEFINER RPC first, then fall back to a direct table write. These RPCs
--  are missing on the live DB, so every action wasted retries before the fallback
--  (felt broken / sluggish). Creating them makes the primary path work instantly
--  AND sidesteps any RLS gap on the underlying tables.
--
--  Each RPC is SECURITY DEFINER but GUARDS that the caller can only act as
--  themselves (auth.uid() must match the actor) — so definer rights can't be
--  abused to follow/post on behalf of someone else.
-- ════════════════════════════════════════════════════════════════════════════

-- follow_user / unfollow_user REMOVED 2026-08-20: found during Event Depth
-- Engine Phase 0 CI wiring that these conflicted with schema_part_4.sql's
-- versions (RETURNS jsonb, richer body) on a hard Postgres error — "cannot
-- change return type of existing function" — meaning this pair had already
-- been superseded on production and this file was stale. Confirmed live
-- (pg_get_functiondef) that prod runs schema_part_4's jsonb version, and
-- confirmed the client (dataFlow.js) only checks `{ error }` and never reads
-- the return value either way, so nothing depended on this file's shape.
-- create_story / mark_stories_seen below are NOT superseded anywhere else
-- and are still current.

-- ── create_story ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_story(
  p_user_id uuid, p_url text, p_type text, p_expires_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'not authorized to post a story as another user';
  END IF;
  INSERT INTO public.stories (user_id, media_url, media_type, caption, expires_at)
  VALUES (p_user_id, p_url, COALESCE(p_type, 'image'), '', COALESCE(p_expires_at, now() + interval '24 hours'))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ── mark_stories_seen ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_stories_seen(p_story_ids uuid[], p_viewer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_viewer_id THEN
    RAISE EXCEPTION 'not authorized to mark seen as another viewer';
  END IF;
  INSERT INTO public.story_views (story_id, viewer_id)
  SELECT sid, p_viewer_id FROM unnest(p_story_ids) AS sid
  ON CONFLICT (story_id, viewer_id) DO NOTHING;
END;
$$;

-- Let signed-in users call these (definer body enforces per-user authorization).
GRANT EXECUTE ON FUNCTION public.create_story(uuid, text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_stories_seen(uuid[], uuid) TO authenticated;
