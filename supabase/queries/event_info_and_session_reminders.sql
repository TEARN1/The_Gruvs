-- Host <-> attendee event communication: pinned info panel, per-session
-- agenda selection, and a REAL reminder dispatcher.
--
-- ReminderManager (dataFlow.js) has been writing rows to event_reminders for
-- a while, but nothing ever read that table — no cron, no edge function. The
-- "remind me" toggle in the app has been lying to users. This closes that gap
-- and extends the same dispatcher to per-session reminders.

-- 1) Pinned host notice on the event itself. Reuses the events table's
--    existing RLS (a host can already UPDATE their own event row) — no new
--    policy needed.
ALTER TABLE events ADD COLUMN IF NOT EXISTS host_notice TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS host_notice_updated_at TIMESTAMPTZ;

-- 2) Per-session "My Agenda" selection. session_idx keys into events.schedule[]
--    (array index) -- the same identity EventScheduleSection.js already uses
--    to attach polls to a slot. session_time is a resolved absolute timestamp
--    computed client-side (event_date + (day-1) + slot.time) so the dispatcher
--    never has to parse the schedule JSON.
CREATE TABLE IF NOT EXISTS event_session_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  session_idx INT NOT NULL,
  session_time TIMESTAMPTZ NOT NULL,
  reminded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id, session_idx)
);
CREATE INDEX IF NOT EXISTS idx_session_selections_dispatch
  ON event_session_selections (session_time) WHERE reminded = false;
CREATE INDEX IF NOT EXISTS idx_session_selections_user ON event_session_selections(user_id);

ALTER TABLE event_session_selections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS session_selections_select_own ON event_session_selections;
CREATE POLICY session_selections_select_own ON event_session_selections
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS session_selections_insert_own ON event_session_selections;
CREATE POLICY session_selections_insert_own ON event_session_selections
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS session_selections_delete_own ON event_session_selections;
CREATE POLICY session_selections_delete_own ON event_session_selections
  FOR DELETE USING (user_id = auth.uid());

-- No UPDATE policy -- a selection is toggled by insert/delete, never edited in
-- place by the client. `reminded` is flipped only by dispatch_reminders()
-- (SECURITY DEFINER, below), matching the no-client-UPDATE posture used
-- elsewhere this session (business_invoice_requests).

-- 3) The dispatcher. Fixes BOTH the pre-existing broken event_reminders AND
--    adds the new session-level reminders. Idempotent to re-run (only touches
--    rows that are actually due and not yet sent/reminded).
CREATE OR REPLACE FUNCTION dispatch_reminders()
RETURNS TABLE(event_reminders_sent INT, session_reminders_sent INT) AS $$
DECLARE
  n_event INT := 0;
  n_session INT := 0;
BEGIN
  WITH due AS (
    SELECT er.id, er.user_id, er.event_id, e.title
    FROM event_reminders er
    JOIN events e ON e.id = er.event_id
    WHERE er.sent = false AND er.remind_at <= now()
  ),
  ins AS (
    INSERT INTO notifications (recipient_id, actor_id, event_id, type, title, body, read)
    SELECT user_id, user_id, event_id, 'event_reminder',
           'Starting soon', COALESCE(title, 'Your event') || ' is coming up.', false
    FROM due
    RETURNING 1
  )
  SELECT count(*) INTO n_event FROM ins;

  UPDATE event_reminders SET sent = true
  WHERE sent = false AND remind_at <= now();

  WITH due AS (
    SELECT ess.id, ess.user_id, ess.event_id, ess.session_idx, e.title,
           (e.schedule -> ess.session_idx ->> 'title') AS session_title
    FROM event_session_selections ess
    JOIN events e ON e.id = ess.event_id
    WHERE ess.reminded = false
      AND ess.session_time > now()
      AND ess.session_time - interval '15 minutes' <= now()
  ),
  ins AS (
    INSERT INTO notifications (recipient_id, actor_id, event_id, type, title, body, read)
    SELECT user_id, user_id, event_id, 'session_reminder',
           COALESCE(session_title, 'Your session') || ' starts in 15 min',
           COALESCE(title, 'Your event'), false
    FROM due
    RETURNING 1
  )
  SELECT count(*) INTO n_session FROM ins;

  UPDATE event_session_selections SET reminded = true
  WHERE reminded = false
    AND session_time > now()
    AND session_time - interval '15 minutes' <= now();

  RETURN QUERY SELECT n_event, n_session;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE EXECUTE ON FUNCTION dispatch_reminders() FROM anon, authenticated;

-- Best-effort: pg_cron isn't installed on every Postgres (notably the throwaway
-- CI database in db-schema-ci.yml, which proves this file replays cleanly but
-- has no cron extension). Skip with a NOTICE instead of failing the whole
-- script — same pattern as the spatial_ref_sys RLS attempt in
-- advisor_hardening_2026-08-13.sql.
DO $$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gruvs-session-reminders') THEN
      PERFORM cron.schedule('gruvs-session-reminders', '*/5 * * * *', $sql$SELECT dispatch_reminders();$sql$);
    END IF;
  ELSE
    RAISE NOTICE 'pg_cron not installed — skipping gruvs-session-reminders schedule (expected on CI/local Postgres, fix from the Supabase Dashboard on real projects)';
  END IF;
END $$;

-- 4) Check-in auto-welcome. Server-side trigger (not client code) so it fires
--    regardless of which check-in path was used (QR scanner, door check-in,
--    CheckInManager.touchDown, etc.) -- catches all of them at once instead of
--    auditing every call site. live_checkins already has
--    UNIQUE(user_id,event_id), so this can only ever fire once per person per
--    event -- no extra guard needed.
CREATE OR REPLACE FUNCTION notify_checkin_welcome()
RETURNS TRIGGER AS $$
DECLARE
  ev RECORD;
BEGIN
  SELECT title, author_id, host_notice INTO ev FROM events WHERE id = NEW.event_id;
  IF ev.title IS NULL THEN RETURN NEW; END IF;

  INSERT INTO notifications (recipient_id, actor_id, event_id, type, title, body, read)
  VALUES (
    NEW.user_id,
    ev.author_id,
    NEW.event_id,
    'checkin_welcome',
    'Welcome to ' || ev.title,
    COALESCE(NULLIF(trim(ev.host_notice), ''), 'Check the schedule to see what''s happening.'),
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE EXECUTE ON FUNCTION notify_checkin_welcome() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_checkin_welcome ON live_checkins;
CREATE TRIGGER trg_notify_checkin_welcome
  AFTER INSERT ON live_checkins
  FOR EACH ROW
  EXECUTE FUNCTION notify_checkin_welcome();
