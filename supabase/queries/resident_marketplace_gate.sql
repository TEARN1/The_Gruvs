-- ═══════════════════════════════════════════════════════════════════════════
-- resident_marketplace_gate.sql — Feature C: trust-gated marketplace writes
--
-- TRUSTED-MEMBERS-ONLY marketplace. Only Resident-trusted users may SELL *or
-- even SEE it* — untrusted users get zero rows. Trust = either:
--   • a Resident trust tier ('trusted' or 'verified' — earned via
--     res_sync_trust(), see resident_trust_bridge.sql), OR
--   • profiles.is_verified (verification granted through any other path).
--
-- Reads AND writes are gated by res_can_sell(); a member always keeps sight of
-- their OWN rows (a lapsed tier never hides their listings). Contact stays
-- DM-only — broker, no payments.
--
-- ORDER: run AFTER resident_schema_v2.sql AND resident_trust_bridge.sql.
-- Everything is to_regclass-guarded, so running early is a safe no-op.
-- ═══════════════════════════════════════════════════════════════════════════

-- Single source of truth for "may this user sell?" — used by every market
-- write policy (and reusable by future surfaces, e.g. event vendor stalls).
CREATE OR REPLACE FUNCTION public.res_can_sell(p_user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_user
      AND (p.resident_trust_tier IN ('trusted', 'verified') OR p.is_verified = true)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.res_can_sell(UUID) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.res_can_sell(UUID) TO authenticated, service_role;

-- ── res_market_items: trusted-only READ + write; own rows always visible ────
DO $$
BEGIN
  IF to_regclass('public.res_market_items') IS NOT NULL THEN
    DROP POLICY IF EXISTS res_market_select ON public.res_market_items;
    CREATE POLICY res_market_select ON public.res_market_items
      FOR SELECT TO authenticated
      USING (public.res_can_sell(auth.uid()) OR user_id = auth.uid());

    DROP POLICY IF EXISTS res_market_insert ON public.res_market_items;
    CREATE POLICY res_market_insert ON public.res_market_items
      FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid() AND public.res_can_sell(auth.uid()));

    DROP POLICY IF EXISTS res_market_update ON public.res_market_items;
    CREATE POLICY res_market_update ON public.res_market_items
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid() AND public.res_can_sell(auth.uid()));
  END IF;
END $$;

-- ── res_vendors: a vendor listing is a selling surface — same trusted gate ────
DO $$
BEGIN
  IF to_regclass('public.res_vendors') IS NOT NULL THEN
    DROP POLICY IF EXISTS res_vendors_select ON public.res_vendors;
    CREATE POLICY res_vendors_select ON public.res_vendors
      FOR SELECT TO authenticated
      USING (public.res_can_sell(auth.uid()) OR user_id = auth.uid());

    DROP POLICY IF EXISTS res_vendors_insert ON public.res_vendors;
    CREATE POLICY res_vendors_insert ON public.res_vendors
      FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid() AND public.res_can_sell(auth.uid()));

    DROP POLICY IF EXISTS res_vendors_update ON public.res_vendors;
    CREATE POLICY res_vendors_update ON public.res_vendors
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid() AND public.res_can_sell(auth.uid()));
  END IF;
END $$;

-- ── Verification probes (run manually after apply) ────────────────────────────
-- As a NON-trusted authed user:
--   insert into res_market_items (user_id, title, category) values (auth.uid(), 'x', 'misc');
--   → must FAIL with an RLS violation.
-- Then: select res_sync_trust();  (with a complete res_profiles row)
--   → same insert must SUCCEED.
