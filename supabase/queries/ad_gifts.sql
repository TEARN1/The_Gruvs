-- ══════════════════════════════════════════════════════════════════════════════
--  THE GRUVS — TIERED GIFT SYSTEM (advertising access by virtual gift)
-- ══════════════════════════════════════════════════════════════════════════════
--  Virtual gifts unlock temporary advertising reach. Cost + scope are stored
--  SERVER-SIDE (ad_gift_tiers) so a client can never claim a big reach cheaply.
--  redeem_ad_gift() checks/deducts profiles.vibe_coins (earned currency — no real
--  money) and mints a time-boxed ad_tokens grant. Fully idempotent.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. The tier catalogue (mirrors src/constants/giftTiers.js) ────────────────
CREATE TABLE IF NOT EXISTS public.ad_gift_tiers (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  tier           INTEGER NOT NULL,
  coin_cost      INTEGER NOT NULL,
  reach          TEXT NOT NULL CHECK (reach IN ('venue','city','region','national')),
  radius_km      INTEGER NOT NULL,
  duration_hours INTEGER NOT NULL,
  audience_cap   INTEGER NOT NULL
);

INSERT INTO public.ad_gift_tiers (id, name, tier, coin_cost, reach, radius_km, duration_hours, audience_cap) VALUES
  ('spark',   'Spark',   1, 50,    'venue',    5,      6,   200),
  ('blaze',   'Blaze',   2, 200,   'city',     30,     24,  2000),
  ('diamond', 'Diamond', 3, 750,   'region',   150,    72,  20000),
  ('crown',   'Crown',   4, 2500,  'national', 100000, 168, 1000000)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, tier = EXCLUDED.tier, coin_cost = EXCLUDED.coin_cost,
  reach = EXCLUDED.reach, radius_km = EXCLUDED.radius_km,
  duration_hours = EXCLUDED.duration_hours, audience_cap = EXCLUDED.audience_cap;

ALTER TABLE public.ad_gift_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ad_gift_tiers_read" ON public.ad_gift_tiers;
CREATE POLICY "ad_gift_tiers_read" ON public.ad_gift_tiers FOR SELECT USING (true);

-- ── 2. Redeemed access tokens — a time-boxed advertising grant ────────────────
CREATE TABLE IF NOT EXISTS public.ad_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gift_id      TEXT NOT NULL REFERENCES public.ad_gift_tiers(id),
  reach        TEXT NOT NULL,
  radius_km    INTEGER NOT NULL,
  audience_cap INTEGER NOT NULL,
  issued_at    TIMESTAMPTZ DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  consumed     BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_ad_tokens_user_active
  ON public.ad_tokens (user_id, expires_at DESC);

ALTER TABLE public.ad_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ad_tokens_owner_read" ON public.ad_tokens;
CREATE POLICY "ad_tokens_owner_read" ON public.ad_tokens FOR SELECT USING (user_id = auth.uid());
-- No direct INSERT policy: tokens are minted ONLY by redeem_ad_gift() below.

-- ── 3. Redeem: check + deduct coins + mint token, all server-side & atomic ────
CREATE OR REPLACE FUNCTION public.redeem_ad_gift(p_gift_id TEXT)
RETURNS public.ad_tokens
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_tier  public.ad_gift_tiers;
  v_coins INTEGER;
  v_token public.ad_tokens;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT * INTO v_tier FROM public.ad_gift_tiers WHERE id = p_gift_id;
  IF v_tier.id IS NULL THEN RAISE EXCEPTION 'UNKNOWN_GIFT'; END IF;

  SELECT COALESCE(vibe_coins, 0) INTO v_coins FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF v_coins < v_tier.coin_cost THEN
    RAISE EXCEPTION 'INSUFFICIENT_COINS: have %, need %', v_coins, v_tier.coin_cost;
  END IF;

  UPDATE public.profiles SET vibe_coins = v_coins - v_tier.coin_cost WHERE id = v_uid;

  INSERT INTO public.ad_tokens (user_id, gift_id, reach, radius_km, audience_cap, expires_at)
  VALUES (v_uid, v_tier.id, v_tier.reach, v_tier.radius_km, v_tier.audience_cap,
          now() + (v_tier.duration_hours || ' hours')::interval)
  RETURNING * INTO v_token;

  RETURN v_token;
END;
$$;
GRANT EXECUTE ON FUNCTION public.redeem_ad_gift(TEXT) TO authenticated;

-- ✅ Done. Gifts priced server-side; redeeming deducts vibe_coins and grants
--    a time-boxed advertising token the app reads via getActiveAdTokens().
