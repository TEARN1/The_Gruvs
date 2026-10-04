-- Security check 2026-10-04 (APP_AUDIT.md). Part 2 of 3 — NOT YET APPLIED.
--
-- Parts 1 and 3 are live. This part replaces existing functions, which the
-- Supabase MCP connection treats as destructive and holds for a confirmation
-- that cannot be given from a cloud session, so it timed out (nothing applied,
-- verified). Apply it from the Supabase SQL Editor, or rename it into
-- supabase/migrations/ and run `npx supabase db push` from a linked machine.
--
-- Binds the user-id parameter to the caller for the four user-id functions the
-- app does call. Every app call site passes the signed-in user's own id
-- (dataFlow.js:1406, :1431, :2013, :3335), so this breaks nothing.

SET LOCAL lock_timeout = '5s';

-- Co-location history: only your own; returns no rows for anyone else.
CREATE OR REPLACE FUNCTION public.get_crossed_paths(p_user_id uuid, p_limit integer DEFAULT 50)
 RETURNS TABLE(user_id uuid, username text, display_name text, avatar_url text, vibe_score integer, is_online boolean, last_seen timestamp with time zone, is_verified boolean, identity_mode text, crossings bigint, venues text[], last_crossed_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH my_events AS (
    SELECT lc.event_id
    FROM public.live_checkins lc
    WHERE lc.user_id = p_user_id
      AND p_user_id = (SELECT auth.uid())   -- caller may only query themselves
    GROUP BY lc.event_id
    ORDER BY max(lc.checked_in_at) DESC NULLS LAST
    LIMIT 200
  ),
  cp AS (
    SELECT
      lc.user_id,
      count(DISTINCT lc.event_id)                                              AS crossings,
      max(lc.checked_in_at)                                                    AS last_crossed_at,
      array_remove(array_agg(DISTINCT COALESCE(e.venue_name, e.title)), NULL)  AS venues
    FROM public.live_checkins lc
    JOIN my_events me         ON me.event_id = lc.event_id
    LEFT JOIN public.events e ON e.id = lc.event_id
    WHERE lc.user_id <> p_user_id
    GROUP BY lc.user_id
  )
  SELECT
    cp.user_id, p.username, p.display_name, p.avatar_url, p.vibe_score,
    p.is_online, p.last_seen, p.is_verified, p.identity_mode,
    cp.crossings, cp.venues[1:4] AS venues, cp.last_crossed_at
  FROM cp
  JOIN public.profiles p ON p.id = cp.user_id
  WHERE COALESCE(p.identity_mode, 'public') <> 'ghost'
    AND NOT (COALESCE(p.identity_mode, 'public') = 'celebrity'
             AND COALESCE(p.is_beacon_active, false) = false)
    -- Block is absolute, BOTH directions.
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = p_user_id AND b.blocked_id = cp.user_id)
         OR (b.blocker_id = cp.user_id AND b.blocked_id = p_user_id)
    )
  ORDER BY cp.crossings DESC, cp.last_crossed_at DESC NULLS LAST
  LIMIT GREATEST(1, p_limit);
$function$;

CREATE OR REPLACE FUNCTION public.increment_vibe_count(p_event_id uuid, p_user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.event_vibes(event_id, user_id) VALUES (p_event_id, p_user_id) ON CONFLICT DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrement_vibe_count(p_event_id uuid, p_user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.event_vibes WHERE event_id = p_event_id AND user_id = p_user_id;
END;
$function$;

-- Also called by the check_streak_badges trigger with NEW.user_id, which need
-- not be the requester, so only direct calls (trigger depth 0) are guarded.
CREATE OR REPLACE FUNCTION public.record_daily_activity(p_user uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_streak INT := 0;
  v_day    DATE;
  v_prev   DATE;
BEGIN
  IF pg_trigger_depth() = 0 AND p_user IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO daily_activity(user_id, day)
  VALUES (p_user, CURRENT_DATE)
  ON CONFLICT (user_id, day)
  DO UPDATE SET action_count = daily_activity.action_count + 1;

  FOR v_day IN
    SELECT day FROM daily_activity WHERE user_id = p_user ORDER BY day DESC
  LOOP
    IF v_streak = 0 THEN
      IF v_day = CURRENT_DATE OR v_day = CURRENT_DATE - 1 THEN
        v_streak := 1; v_prev := v_day;
      ELSE EXIT;
      END IF;
    ELSE
      IF v_day = v_prev - 1 THEN v_streak := v_streak + 1; v_prev := v_day;
      ELSE EXIT;
      END IF;
    END IF;
  END LOOP;
  RETURN v_streak;
END;
$function$;

-- User-facing only; anon never needs these.
REVOKE EXECUTE ON FUNCTION public.get_crossed_paths(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.increment_vibe_count(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.decrement_vibe_count(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_daily_activity(uuid)      FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_crossed_paths(uuid, integer) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.increment_vibe_count(uuid, uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.decrement_vibe_count(uuid, uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.record_daily_activity(uuid)      TO authenticated;
