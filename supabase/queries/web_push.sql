-- ═══════════════════════════════════════════════════════════════════════════
-- web_push.sql — closed-tab Web Push for thegruvs.com / the PWA
--
-- One row per browser subscription (a user can have phone + laptop). The
-- push-notify edge function reads these with service_role and sends Web Push
-- (VAPID). Dead endpoints (404/410 from the push service) are deleted by the
-- function on delivery failure.
--
-- AFTER APPLYING: set the function secrets (once):
--   supabase secrets set VAPID_PRIVATE_KEY=<from .env> VAPID_SUBJECT=mailto:asemahlenkwali@gmail.com
-- then redeploy push-notify.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL UNIQUE,      -- the push service URL (identifies the browser)
  p256dh       TEXT NOT NULL,             -- client public key (payload encryption)
  auth         TEXT NOT NULL,             -- client auth secret
  user_agent   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_web_push_user ON public.web_push_subscriptions (user_id);

ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Owner-only in every direction; the edge function uses service_role.
DROP POLICY IF EXISTS web_push_owner_select ON public.web_push_subscriptions;
CREATE POLICY web_push_owner_select ON public.web_push_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS web_push_owner_insert ON public.web_push_subscriptions;
CREATE POLICY web_push_owner_insert ON public.web_push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS web_push_owner_update ON public.web_push_subscriptions;
CREATE POLICY web_push_owner_update ON public.web_push_subscriptions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS web_push_owner_delete ON public.web_push_subscriptions;
CREATE POLICY web_push_owner_delete ON public.web_push_subscriptions
  FOR DELETE TO authenticated USING (user_id = auth.uid());
