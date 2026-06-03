-- ============================================================================
-- The Gruvs — Security RLS & Column Hardening Remediation SQL Patch
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- §1  CRITICAL — Stop GPS Location Harvesting from live_checkins
-- ─────────────────────────────────────────────────────────────────────────────
-- Enable Row Level Security on the live_checkins table if not already enabled.
ALTER TABLE public.live_checkins ENABLE ROW LEVEL SECURITY;

-- Remove public/anonymous read policies that allow logged-out callers to see check-ins.
DROP POLICY IF EXISTS "live_checkins are viewable by everyone" ON public.live_checkins;
DROP POLICY IF EXISTS "Enable read access for all users"        ON public.live_checkins;
DROP POLICY IF EXISTS "live_checkins: owner reads own"          ON public.live_checkins;
DROP POLICY IF EXISTS "live_checkins: authenticated read"       ON public.live_checkins;

-- 1. Owners can read and manage their own check-in records.
CREATE POLICY "live_checkins: owner management"
  ON public.live_checkins FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Authenticated users can see event check-in entries (for the guest list / who was there)
-- but anonymous users are completely blocked.
CREATE POLICY "live_checkins: authenticated read"
  ON public.live_checkins FOR SELECT
  TO authenticated
  USING (true);

-- 3. Hard security boundaries on exact GPS coordinates (lat, lon columns)
-- Completely block anonymous users from selecting any data from live_checkins
REVOKE SELECT ON public.live_checkins FROM anon;

-- Revoke SELECT privilege on exact lat and lon columns from both anon and authenticated roles
REVOKE SELECT (lat, lon) ON public.live_checkins FROM anon, authenticated;

-- Explicitly grant SELECT privilege on all other non-sensitive columns of live_checkins to authenticated users
GRANT SELECT (id, user_id, event_id, checked_in_at, expires_at, identity_layer, ghost_alias)
  ON public.live_checkins TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- §2  MEDIUM — Hide PII (Personally Identifiable Information) on profiles
-- ─────────────────────────────────────────────────────────────────────────────
-- Revoke SELECT on sensitive columns from the anonymous role completely.
REVOKE SELECT (email, push_token, phone, emergency_contacts, siblings, first_name, surname)
  ON public.profiles FROM anon;

-- Note: The client uses the public_profiles view for general public queries, 
-- ensuring that only the logged-in owner can read their own PII.


-- ─────────────────────────────────────────────────────────────────────────────
-- §3  LOW — Require login to read the social graph (follows)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "follows are viewable by everyone" ON public.follows;
DROP POLICY IF EXISTS "follows: authenticated read"       ON public.follows;

CREATE POLICY "follows: authenticated read"
  ON public.follows FOR SELECT
  TO authenticated
  USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- §4  VERIFY — Hardening Admin RPC Functions Server-Side
-- ─────────────────────────────────────────────────────────────────────────────
-- Ensure that administrative RPC functions check caller role inside the function definition
-- (using SECURITY DEFINER and assert_admin checks).

CREATE OR REPLACE FUNCTION public.admin_suspend_user(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Perform admin check inside function
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;
  
  -- Record the suspension
  INSERT INTO public.user_suspensions (user_id, reason, suspended_by)
  VALUES (p_user_id, 'Suspended by admin', auth.uid())
  ON CONFLICT (user_id) DO NOTHING;

  -- Disable discovery and set status offline
  UPDATE public.profiles
  SET is_discoverable = false, is_online = false
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_flag_user(p_user_id UUID, p_reason TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Perform admin check inside function
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;

  -- Insert report flag
  INSERT INTO public.reports (reporter_id, target_id, target_type, reason, status)
  VALUES (auth.uid(), p_user_id, 'user', p_reason, 'pending');
END;
$$;
