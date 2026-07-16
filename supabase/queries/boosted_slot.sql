-- ═══════════════════════════════════════════════════════════════════════════
-- boosted_slot.sql — Drop rule 37: the boosted-event slot
--
-- ad_tokens exist (earned vibe_coins → redeem_ad_gift → time-boxed reach) but
-- placed NOTHING: RLS is owner-read, so a viewer's feed can never learn which
-- hosts are boosted, and the paid-for reach silently never happens.
--
-- Fix: one SECURITY DEFINER RPC exposing the MINIMUM the feed needs — which
-- hosts currently hold an active token (advertising is public by nature).
-- No spend, no gift id, no history leaves the table.
--
-- Truth Protocol note: the boost is a LABELED "Promoted" slot at a fixed
-- position in the client — it never touches eventScore/heat, so paid reach
-- can never masquerade as organic heat.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_boosted_hosts()
RETURNS TABLE (user_id UUID, reach TEXT, radius_km INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (t.user_id) t.user_id, t.reach, t.radius_km
  FROM public.ad_tokens t
  WHERE t.expires_at > now()
  ORDER BY t.user_id, t.expires_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_boosted_hosts() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_boosted_hosts() TO authenticated, service_role;
