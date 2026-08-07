-- ═══════════════════════════════════════════════════════════════════════════
-- sso_handoff.sql — Cross-app one-click SSO: one-time handoff codes.  APPLIED LIVE.
--
-- A logged-in user on one app (The Gruvs) mints a short-lived, single-use,
-- audience-bound code; the other app (The Resident) exchanges it for a session
-- via the `sso-redeem` Edge Function (service_role). Clients can NEVER read/write
-- this table directly — issue is a caller-only RPC, redeem is server-side only.
--
-- Pairs with: supabase/functions/sso-redeem/index.ts
-- Deploy the function:  supabase functions deploy sso-redeem --no-verify-jwt
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.sso_handoff_codes (
  code       text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audience   text NOT NULL CHECK (audience IN ('resident','gruvs')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at    timestamptz
);
CREATE INDEX IF NOT EXISTS sso_handoff_expiry_idx ON public.sso_handoff_codes (expires_at);

ALTER TABLE public.sso_handoff_codes ENABLE ROW LEVEL SECURITY;
-- No policies at all → default-deny for anon/authenticated. Only the SECURITY
-- DEFINER RPC + service_role (Edge Function) touch it.
REVOKE ALL ON public.sso_handoff_codes FROM public, anon, authenticated;

-- Issue a code for the CALLER (auth.uid()) — one-click SSO to the other app.
CREATE OR REPLACE FUNCTION public.sso_issue_code(p_audience text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid  uuid := auth.uid();
  code text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF p_audience NOT IN ('resident','gruvs') THEN RAISE EXCEPTION 'invalid audience'; END IF;

  -- Anti-abuse: cap live (unused, unexpired) codes per user.
  IF (SELECT count(*) FROM public.sso_handoff_codes
      WHERE user_id = uid AND used_at IS NULL AND expires_at > now()) >= 5 THEN
    RAISE EXCEPTION 'too many pending sign-in codes — try again in a minute';
  END IF;

  -- Opportunistic GC so the table never grows unbounded.
  DELETE FROM public.sso_handoff_codes WHERE expires_at < now() - interval '1 hour';

  code := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  INSERT INTO public.sso_handoff_codes (code, user_id, audience, expires_at)
  VALUES (code, uid, p_audience, now() + interval '60 seconds');
  RETURN code;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sso_issue_code(text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.sso_issue_code(text) TO authenticated;
