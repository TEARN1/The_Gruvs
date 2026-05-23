-- ============================================================
--  THE GRUVS SIMPLE — REELS SECURITY & LOGIC PATCH
--  Apply once in the Supabase SQL Editor.
--  Resolves security holes and missing RPCs for Reels.
-- ============================================================

-- 1. REELS TABLE POLICIES
-- Drop existing policies
DROP POLICY IF EXISTS "Reels readable by all"           ON public.reels;
DROP POLICY IF EXISTS "Authenticated users insert reels" ON public.reels;
DROP POLICY IF EXISTS "Users update own reels"           ON public.reels;
DROP POLICY IF EXISTS "Users delete own reels"           ON public.reels;

-- Create secure policies
-- Only allow selecting reels that are not deleted AND are either not hidden or owned by the caller, and filter by user blocks
CREATE POLICY "Reels readable by all" ON public.reels
  FOR SELECT USING (
    is_deleted = false 
    AND (is_hidden = false OR auth.uid() = user_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks
      WHERE (blocker_id = auth.uid() AND blocked_id = user_id)
         OR (blocker_id = user_id AND blocked_id = auth.uid())
    )
  );

CREATE POLICY "Authenticated users insert reels" ON public.reels
  FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.role() = 'authenticated');

CREATE POLICY "Users update own reels" ON public.reels
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own reels" ON public.reels
  FOR DELETE USING (auth.uid() = user_id);


-- 2. REEL LIKES TABLE POLICIES
DROP POLICY IF EXISTS "Reel likes readable by all" ON public.reel_likes;
DROP POLICY IF EXISTS "Users manage own likes"     ON public.reel_likes;
DROP POLICY IF EXISTS "Users insert own likes"     ON public.reel_likes;
DROP POLICY IF EXISTS "Users delete own likes"     ON public.reel_likes;

CREATE POLICY "Reel likes readable by all" ON public.reel_likes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reels
      WHERE id = reel_id
    )
  );

CREATE POLICY "Users insert own likes" ON public.reel_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.role() = 'authenticated');

CREATE POLICY "Users delete own likes" ON public.reel_likes
  FOR DELETE USING (auth.uid() = user_id);


-- 3. REEL COMMENTS TABLE POLICIES
DROP POLICY IF EXISTS "Reel comments readable by all" ON public.reel_comments;
DROP POLICY IF EXISTS "Users insert own comments"     ON public.reel_comments;
DROP POLICY IF EXISTS "Users update own comments"     ON public.reel_comments;
DROP POLICY IF EXISTS "Users delete own comments"     ON public.reel_comments;

CREATE POLICY "Reel comments readable by all" ON public.reel_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reels
      WHERE id = reel_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks
      WHERE (blocker_id = auth.uid() AND blocked_id = user_id)
         OR (blocker_id = user_id AND blocked_id = auth.uid())
    )
  );

CREATE POLICY "Users insert own comments" ON public.reel_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.role() = 'authenticated');

CREATE POLICY "Users update own comments" ON public.reel_comments
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own comments" ON public.reel_comments
  FOR DELETE USING (auth.uid() = user_id);


-- 4. REEL VIEWS TABLE POLICIES
DROP POLICY IF EXISTS "Users log own views"   ON public.reel_views;
DROP POLICY IF EXISTS "Reel views readable by all" ON public.reel_views;
DROP POLICY IF EXISTS "Users insert own views"     ON public.reel_views;
DROP POLICY IF EXISTS "Users update own views"     ON public.reel_views;

CREATE POLICY "Reel views readable by all" ON public.reel_views
  FOR SELECT USING (true);

CREATE POLICY "Users insert own views" ON public.reel_views
  FOR INSERT WITH CHECK (auth.uid() = viewer_id AND auth.role() = 'authenticated');

CREATE POLICY "Users update own views" ON public.reel_views
  FOR UPDATE USING (auth.uid() = viewer_id);


-- 5. SAVED REELS TABLE POLICIES
DROP POLICY IF EXISTS "Users manage own saved reels" ON public.saved_reels;
DROP POLICY IF EXISTS "Users select own saved reels" ON public.saved_reels;
DROP POLICY IF EXISTS "Users insert own saved reels" ON public.saved_reels;
DROP POLICY IF EXISTS "Users delete own saved reels" ON public.saved_reels;

-- Restrict saved reels SELECT to the saving user (private bookmarking)
CREATE POLICY "Users select own saved reels" ON public.saved_reels
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own saved reels" ON public.saved_reels
  FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.role() = 'authenticated');

CREATE POLICY "Users delete own saved reels" ON public.saved_reels
  FOR DELETE USING (auth.uid() = user_id);


-- 6. REEL REPORTS TABLE POLICIES
DROP POLICY IF EXISTS "Users can report reels" ON public.reel_reports;
DROP POLICY IF EXISTS "Reel reports select"    ON public.reel_reports;
DROP POLICY IF EXISTS "Reel reports insert"    ON public.reel_reports;
DROP POLICY IF EXISTS "Reel reports update"    ON public.reel_reports;

CREATE POLICY "Reel reports select" ON public.reel_reports
  FOR SELECT USING (auth.uid() = reporter_id);

CREATE POLICY "Reel reports insert" ON public.reel_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id AND auth.role() = 'authenticated');

CREATE POLICY "Reel reports update" ON public.reel_reports
  FOR UPDATE USING (auth.uid() = reporter_id);


-- 7. TRENDING REELS VIEW
DROP VIEW IF EXISTS trending_reels CASCADE;
CREATE OR REPLACE VIEW trending_reels WITH (security_invoker = true) AS
SELECT
  r.*,
  reel_discovery_score(r.like_count, r.comment_count, r.view_count, r.created_at) AS score
FROM reels r
WHERE r.is_deleted = false AND r.is_hidden = false
ORDER BY score DESC
LIMIT 50;


-- 8. REELS MISSING RPC FUNCTIONS

-- create_reel
CREATE OR REPLACE FUNCTION public.create_reel(
  p_user_id UUID,
  p_media_url TEXT,
  p_caption TEXT,
  p_sound_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reel_id UUID;
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.reels (user_id, media_url, caption, sound_name)
  VALUES (p_user_id, p_media_url, p_caption, p_sound_name)
  RETURNING id INTO v_reel_id;

  RETURN v_reel_id;
END;
$$;

-- add_reel_comment
CREATE OR REPLACE FUNCTION public.add_reel_comment(
  p_reel_id UUID,
  p_user_id UUID,
  p_body TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comment_id UUID;
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.reel_comments (reel_id, user_id, body)
  VALUES (p_reel_id, p_user_id, p_body)
  RETURNING id INTO v_comment_id;

  RETURN v_comment_id;
END;
$$;

-- increment_reel_like
CREATE OR REPLACE FUNCTION public.increment_reel_like(
  p_reel_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.reel_likes (reel_id, user_id)
  VALUES (p_reel_id, p_user_id)
  ON CONFLICT (reel_id, user_id) DO NOTHING;

  RETURN TRUE;
END;
$$;

-- decrement_reel_like
CREATE OR REPLACE FUNCTION public.decrement_reel_like(
  p_reel_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM public.reel_likes
  WHERE reel_id = p_reel_id AND user_id = p_user_id;

  RETURN TRUE;
END;
$$;

-- save_reel
CREATE OR REPLACE FUNCTION public.save_reel(
  p_reel_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.saved_reels (reel_id, user_id)
  VALUES (p_reel_id, p_user_id)
  ON CONFLICT (reel_id, user_id) DO NOTHING;

  RETURN TRUE;
END;
$$;

-- unsave_reel
CREATE OR REPLACE FUNCTION public.unsave_reel(
  p_reel_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM public.saved_reels
  WHERE reel_id = p_reel_id AND user_id = p_user_id;

  RETURN TRUE;
END;
$$;

-- Pin search_path for safety on routines
DO $$
DECLARE
  f RECORD;
BEGIN
  FOR f IN
    SELECT routine_name FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
      AND routine_name IN (
        'create_reel', 'add_reel_comment',
        'increment_reel_like', 'decrement_reel_like',
        'save_reel', 'unsave_reel'
      )
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION public.%I SET search_path = public', f.routine_name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;
