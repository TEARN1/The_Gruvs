-- ═══════════════════════════════════════════════════════════════════════════
-- mutual_follows_rpc.sql — stop shipping the whole social graph to the phone.
--
-- THE PROBLEM. CommunityStatsBar shows "N mutuals online right now". To get it,
-- the client did (CommunityStatsBar.js:79-86):
--
--     const [{ data: following }, { data: followers }] = await Promise.all([
--       supabase.from('follows').select('following_id').eq('follower_id', uid),
--       supabase.from('follows').select('follower_id').eq('following_id', uid),
--     ]);
--     const followingIds = new Set(following.map(r => r.following_id));
--     const ids = followers.map(r => r.follower_id).filter(id => followingIds.has(id));
--
-- Neither query has a LIMIT. The second one is every follower the account has.
-- So a popular account downloads its entire follower list over mobile data,
-- intersects it in JavaScript, and then issues a THIRD query with the result
-- in an `.in(...)` list — to render one number.
--
-- That is fine at a few hundred followers and impossible at a hundred thousand,
-- and it is on a 2-minute poll.
--
-- THE FIX. A mutual follow is a self-join on follows. Postgres does it with two
-- index lookups and returns only the handful of people actually online. The set
-- that crosses the network goes from "everyone who follows you" to "the mutuals
-- online in the last five minutes".
--
-- SECURITY INVOKER on purpose: these run as the caller, so follows/profiles RLS
-- still applies. They read auth.uid() directly and take no target-user argument,
-- so one user cannot inspect another's graph.
--
-- Idempotent. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Indexes the join needs ──────────────────────────────────────────────────
-- The forward side is served by idx_follows_follower (follower_id, following_id)
-- — pinned in index_reconciliation.sql. The reverse side only had a single-column
-- (following_id) index, so the join had to visit the heap for every candidate
-- row. Widening it makes the whole intersection index-only.
DROP INDEX IF EXISTS public.idx_follows_following;
CREATE INDEX idx_follows_following ON public.follows (following_id, follower_id);

-- The "online right now" filter had no index at all, so it scanned profiles.
-- Partial: only rows with a last_seen are ever eligible.
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen
  ON public.profiles (last_seen DESC) WHERE last_seen IS NOT NULL;

-- ── Who follows me back, and is online right now ────────────────────────────
-- Column list mirrors what CommunityStatsBar actually renders, and the ordering
-- matches the old client-side sort (vibe_score DESC), so swapping to this RPC
-- changes nothing the user sees.
-- DROP first: CREATE OR REPLACE cannot change a function's return type, so
-- re-running this file after the column list changes would otherwise fail with
-- "cannot change return type of existing function".
DROP FUNCTION IF EXISTS public.get_mutual_online(int, int);
CREATE FUNCTION public.get_mutual_online(
  p_minutes int DEFAULT 5,
  p_limit   int DEFAULT 50
)
RETURNS TABLE (
  id uuid, username text, avatar_url text, bio text,
  vibe_score int, last_seen timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT p.id, p.username, p.avatar_url, p.bio,
         COALESCE(p.vibe_score, 0)::int, p.last_seen
    FROM public.follows f1
    JOIN public.follows f2
      ON f2.follower_id  = f1.following_id
     AND f2.following_id = f1.follower_id      -- they follow me back
    JOIN public.profiles p
      ON p.id = f1.following_id
   WHERE f1.follower_id = auth.uid()
     AND p.last_seen >= now() - make_interval(mins => greatest(p_minutes, 1))
   ORDER BY COALESCE(p.vibe_score, 0) DESC, p.last_seen DESC
   LIMIT least(greatest(p_limit, 1), 200);
$$;

-- ── Just the number, when that is all the UI needs ──────────────────────────
-- Separate from the list so a count is never capped by a display limit.
DROP FUNCTION IF EXISTS public.mutual_online_count(int);
CREATE FUNCTION public.mutual_online_count(p_minutes int DEFAULT 5)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT count(*)::int
    FROM public.follows f1
    JOIN public.follows f2
      ON f2.follower_id  = f1.following_id
     AND f2.following_id = f1.follower_id
    JOIN public.profiles p
      ON p.id = f1.following_id
   WHERE f1.follower_id = auth.uid()
     AND p.last_seen >= now() - make_interval(mins => greatest(p_minutes, 1));
$$;

REVOKE ALL     ON FUNCTION public.get_mutual_online(int, int)  FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_mutual_online(int, int)  TO authenticated;
REVOKE ALL     ON FUNCTION public.mutual_online_count(int)     FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.mutual_online_count(int)     TO authenticated;
