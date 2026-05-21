--============================================================

-- ─── Migration 003: Complete RLS policies ────────────────────────────────────
-- Fills the gaps where tables had RLS enabled but were missing UPDATE/DELETE
-- policies, leaving them open to arbitrary writes via the PostgREST API.

-- ─── event_reactions ─────────────────────────────────────────────────────────
-- SELECT: anyone can read reactions (public event data)
CREATE POLICY "event_reactions_select"
  ON event_reactions FOR SELECT USING (true);

-- INSERT: authenticated users insert their own reactions
CREATE POLICY "event_reactions_insert"
  ON event_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: users can only update their own reaction
CREATE POLICY "event_reactions_update"
  ON event_reactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: users can only delete their own reaction
CREATE POLICY "event_reactions_delete"
  ON event_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- ─── pulse_requests ──────────────────────────────────────────────────────────
CREATE POLICY "pulse_requests_select"
  ON pulse_requests FOR SELECT USING (true);

CREATE POLICY "pulse_requests_insert"
  ON pulse_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only the request author or an admin can update/delete
CREATE POLICY "pulse_requests_update"
  ON pulse_requests FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "pulse_requests_delete"
  ON pulse_requests FOR DELETE
  USING (auth.uid() = user_id);

-- ─── pulse_votes ─────────────────────────────────────────────────────────────
CREATE POLICY "pulse_votes_select"
  ON pulse_votes FOR SELECT USING (true);

CREATE POLICY "pulse_votes_insert"
  ON pulse_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Votes are immutable once cast — no UPDATE policy (intentional)

CREATE POLICY "pulse_votes_delete"
  ON pulse_votes FOR DELETE
  USING (auth.uid() = user_id);

-- ─── notifications ────────────────────────────────────────────────────────────
-- SELECT: only the recipient can read their own notifications
CREATE POLICY "notifications_select"
  ON notifications FOR SELECT
  USING (auth.uid() = recipient_id);

-- INSERT: service role only (notifications are inserted server-side or via
-- notificationService with service key). Block direct client inserts.
-- We use a function-based check: only allow if actor_id matches the caller,
-- OR caller is service role (uid() IS NULL means service role bypass).
CREATE POLICY "notifications_insert"
  ON notifications FOR INSERT
  WITH CHECK (
    auth.uid() IS NULL OR  -- service role
    auth.uid() = actor_id  -- authenticated sender
  );

-- UPDATE: only recipient can mark as read
CREATE POLICY "notifications_update"
  ON notifications FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- DELETE: only recipient can delete their notifications
CREATE POLICY "notifications_delete"
  ON notifications FOR DELETE
  USING (auth.uid() = recipient_id);

-- ─── echoes ───────────────────────────────────────────────────────────────────
-- Ensure echoes has proper policies (common to be missing update/delete)
CREATE POLICY "echoes_select"
  ON echoes FOR SELECT USING (true);

CREATE POLICY "echoes_insert"
  ON echoes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "echoes_update"
  ON echoes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "echoes_delete"
  ON echoes FOR DELETE
  USING (auth.uid() = user_id);

-- ─── reel_likes ──────────────────────────────────────────────────────────────
CREATE POLICY "reel_likes_select"
  ON reel_likes FOR SELECT USING (true);

CREATE POLICY "reel_likes_insert"
  ON reel_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reel_likes_delete"
  ON reel_likes FOR DELETE
  USING (auth.uid() = user_id);

-- ─── event_vibes ─────────────────────────────────────────────────────────────
CREATE POLICY "event_vibes_select"
  ON event_vibes FOR SELECT USING (true);

CREATE POLICY "event_vibes_insert"
  ON event_vibes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "event_vibes_delete"
  ON event_vibes FOR DELETE
  USING (auth.uid() = user_id);

-- ─── follows ─────────────────────────────────────────────────────────────────
CREATE POLICY "follows_select"
  ON follows FOR SELECT USING (true);

CREATE POLICY "follows_insert"
  ON follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "follows_delete"
  ON follows FOR DELETE
  USING (auth.uid() = follower_id);

-- ─── Rate-limit helper function ───────────────────────────────────────────────
-- Prevents a single user from inserting more than N rows in a table within
-- a rolling time window. Used in per-table INSERT policies.
-- Usage: call_rate_ok('echoes', auth.uid(), 5, interval '1 minute')
CREATE OR REPLACE FUNCTION call_rate_ok(
  tbl   text,
  uid   uuid,
  max_n int,
  window_interval interval
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  cnt int;
BEGIN
  EXECUTE format(
    'SELECT COUNT(*) FROM %I WHERE user_id = $1 AND created_at > now() - $2',
    tbl
  ) INTO cnt USING uid, window_interval;
  RETURN cnt < max_n;
END;
$$;

-- Apply rate limiting to echo inserts: max 20 echoes per minute per user
DROP POLICY IF EXISTS "echoes_insert" ON echoes;
CREATE POLICY "echoes_insert"
  ON echoes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND call_rate_ok('echoes', auth.uid(), 20, interval '1 minute')
  );

-- Apply rate limiting to pulse_requests: max 5 per hour per user
DROP POLICY IF EXISTS "pulse_requests_insert" ON pulse_requests;
CREATE POLICY "pulse_requests_insert"
  ON pulse_requests FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND call_rate_ok('pulse_requests', auth.uid(), 5, interval '1 hour')
  );


--============================================================
--  SECTION: NEW FEATURES (reactions, updates, waitlist, carpools)
