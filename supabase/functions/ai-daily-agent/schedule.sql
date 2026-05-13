-- ============================================================
--  Schedule the AI Daily Agent via pg_cron
--  Run this once in Supabase SQL Editor after deploying the edge function.
--  Replace {PROJECT_REF} with your Supabase project ref.
--  Replace {SERVICE_ROLE_KEY} with your service_role key.
-- ============================================================

-- Enable pg_cron if not already enabled (requires Supabase support or dashboard)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule: every day at 04:00 UTC (06:00 SAST)
SELECT cron.schedule(
  'ai-daily-agent',
  '0 4 * * *',
  $$
    SELECT net.http_post(
      url     := 'https://{PROJECT_REF}.supabase.co/functions/v1/ai-daily-agent',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer {SERVICE_ROLE_KEY}'
      ),
      body    := '{}'::jsonb
    ) AS request_id;
  $$
);

-- To verify it's scheduled:
-- SELECT * FROM cron.job;

-- To remove the schedule:
-- SELECT cron.unschedule('ai-daily-agent');
