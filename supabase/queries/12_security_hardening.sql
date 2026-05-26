-- ============================================================
--  THE GRUVS — 12: SECURITY HARDENING
--  public_profiles view, schema access controls,
--  security grants, audit helpers, rate-limit functions
-- ============================================================

-- ── Restrict schema creation ──────────────────────────────────
-- Prevents anon/authenticated roles from creating objects in public schema
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM anon;
REVOKE CREATE ON SCHEMA public FROM authenticated;

-- ── public_profiles view (safe projection) ───────────────────
-- Exposes only what anonymous visitors should see
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  p.id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.bio,
  p.location,
  p.role,
  p.vibe_score,
  p.followers_count,
  p.following_count,
  p.xp,
  p.badges,
  p.verified,
  p.show_online,
  CASE WHEN p.show_online THEN p.last_seen ELSE NULL END AS last_seen,
  p.created_at
FROM public.profiles p;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- ── Security definer wrapper for profile upsert ───────────────
-- Prevents users from escalating their own role/sis_score
CREATE OR REPLACE FUNCTION public.upsert_own_profile(
  p_display_name TEXT DEFAULT NULL,
  p_username     TEXT DEFAULT NULL,
  p_bio          TEXT DEFAULT NULL,
  p_location     TEXT DEFAULT NULL,
  p_avatar_url   TEXT DEFAULT NULL,
  p_cover_url    TEXT DEFAULT NULL,
  p_show_online  BOOLEAN DEFAULT NULL,
  p_share_events BOOLEAN DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET
    display_name = COALESCE(p_display_name, display_name),
    username     = COALESCE(p_username,     username),
    bio          = COALESCE(p_bio,          bio),
    location     = COALESCE(p_location,     location),
    avatar_url   = COALESCE(p_avatar_url,   avatar_url),
    cover_url    = COALESCE(p_cover_url,    cover_url),
    show_online  = COALESCE(p_show_online,  show_online),
    share_events = COALESCE(p_share_events, share_events),
    updated_at   = now()
  WHERE id = auth.uid();
END;
$$;

-- ── Rate limiter helper ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_action TEXT,
  p_window_seconds INTEGER DEFAULT 60,
  p_max_calls INTEGER DEFAULT 30
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Uses security_logs table from 07_gruvs_social.sql
  SELECT COUNT(*) INTO v_count
  FROM public.security_logs
  WHERE user_id = auth.uid()
    AND action = p_action
    AND created_at > now() - (p_window_seconds || ' seconds')::interval;
  RETURN v_count < p_max_calls;
END;
$$;

-- ── Log security event ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_action  TEXT,
  p_details JSONB DEFAULT '{}'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.security_logs (user_id, action, details)
  VALUES (auth.uid(), p_action, p_details);
END;
$$;

-- ── Blocked / muted users (tables defined in 01_gruvs_social.sql) ──
-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_blocked_users_user    ON public.blocked_users(user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON public.blocked_users(blocked_id);
CREATE INDEX IF NOT EXISTS idx_muted_users_user      ON public.muted_users(user_id);
CREATE INDEX IF NOT EXISTS idx_muted_users_muted     ON public.muted_users(muted_id);

-- ── Verify admin helper (used by admin-only RPCs) ─────────────
CREATE OR REPLACE FUNCTION public.assert_admin()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;
END;
$$;

-- ── Admin: promote/demote user ────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_user_role(p_user_id UUID, p_role TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin();
  IF p_role NOT IN ('user','host','vendor','moderator','admin') THEN
    RAISE EXCEPTION 'INVALID_ROLE';
  END IF;
  UPDATE public.profiles SET role = p_role WHERE id = p_user_id;
END;
$$;

-- ── Admin: suspend user ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_suspensions (
  user_id    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason     TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  suspended_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.user_suspensions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "suspensions_admin" ON public.user_suspensions;
CREATE POLICY "suspensions_admin" ON public.user_suspensions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── Grant execute on safe RPCs ────────────────────────────────
GRANT EXECUTE ON FUNCTION public.upsert_own_profile       TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit          TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_security_event        TO authenticated;
GRANT EXECUTE ON FUNCTION public.secure_check_in           TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_rsvp_tier          TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_ticket_token     TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_wallet_balance  TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_sis_score          TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_trending_events   TO authenticated;
