-- ═══════════════════════════════════════════════════════════════════════════
-- vibe_equity_column.sql — F2: ONE vibe_score writer
--
-- vibe_score had THREE writers clobbering each other (computeVibeScore's
-- deterministic recompute, VibeEquityLedger.mintEquity's 8-decimal float,
-- CheckInManager.touchDown's direct +8). The split:
--   • vibe_score  = EARNED contribution, written ONLY by computeVibeScore
--                   (recomputed from real activity counts — can't inflate).
--   • vibe_equity = the spendable social asset (mint/burn), written ONLY by
--                   VibeEquityLedger. Starts at 0 — the old equity was
--                   entangled inside vibe_score and is not recoverable.
--
-- The client ships schema-tolerant: before this column exists, mint/burn
-- no-op gracefully. Apply via MCP when connected.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vibe_equity NUMERIC NOT NULL DEFAULT 0;

-- Equity is server-adjudicated like the other trust columns: pin it against
-- direct client updates by extending the existing trust-column guard.
-- SECURITY INVOKER, not DEFINER: inside a SECURITY DEFINER function `current_user`
-- is the owner (postgres), so the guard below would never engage and the trigger
-- would pin nothing. See definer_rpc_hardening.sql §4.
CREATE OR REPLACE FUNCTION public.protect_profile_trust_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW; -- trusted server path (definer RPCs / admin) — allow
  END IF;
  -- Direct update by the signed-in user: pin trust columns to their old values.
  NEW.role                   := OLD.role;
  NEW.is_verified            := OLD.is_verified;
  NEW.social_integrity_score := OLD.social_integrity_score;
  RETURN NEW;
END;
$$;
-- NOTE: vibe_equity / vibe_score are NOT pinned yet — the client still writes
-- them directly (VibeEquityLedger / computeVibeScore run client-side). Pinning
-- them requires routing those writers through SECURITY DEFINER RPCs first
-- (tracked as the Phase-4 "verification engine" work); do not pin prematurely
-- or every mint/recompute silently no-ops.

-- The old atomic +8 RPC is no longer called by the app (touchDown now routes
-- through computeVibeScore). Revoke client access so it can't be used to
-- inflate scores by hand; keep it for service-side use only.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'increment_profile_score') THEN
    REVOKE EXECUTE ON FUNCTION public.increment_profile_score(uuid, integer) FROM public, anon, authenticated;
  END IF;
END $$;
