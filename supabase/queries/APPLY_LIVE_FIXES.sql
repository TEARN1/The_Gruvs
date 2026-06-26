-- ════════════════════════════════════════════════════════════════════════════
--  THE GRUVS — APPLY LIVE FIXES  (paste this whole file into Supabase → SQL Editor → Run)
--
--  Safe to run, and safe to run again — every statement checks before it acts.
--  This switches ON, for your live app:
--    • the FOLLOW button fix (follow_user / unfollow_user)
--    • the gifting + cash-out fixes (process_gift, request_cashout, support_score)
--    • the 5 security policy fixes from the audit
--
--  It only touches tables that already exist (profiles, events, follows) and
--  creates the gifting tables if they're missing. Nothing is deleted.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 34: CREATOR MONETIZATION & VIRTUAL WALLET (TikTok-style Gifting) ──
-- ══════════════════════════════════════════════════════════════════════════════
--  THE GRUVS — CREATOR MONETIZATION (virtual wallet, gifting ledger, and cash-outs)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.coin_ledger (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount       INTEGER NOT NULL,
  tx_type      TEXT NOT NULL CHECK (tx_type IN ('purchase', 'gift_spent', 'admin_adjustment', 'refund')),
  reference_id UUID,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.diamond_ledger (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount       NUMERIC(12, 4) NOT NULL,
  tx_type      TEXT NOT NULL CHECK (tx_type IN ('gift_received', 'withdrawal', 'admin_adjustment', 'withdrawal_reversal')),
  reference_id UUID,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gift_registry (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,
  coin_cost   INTEGER NOT NULL CHECK (coin_cost > 0),
  host_cut    NUMERIC(3, 2) NOT NULL DEFAULT 0.50,
  lottie_url  TEXT NOT NULL,
  tier        TEXT NOT NULL CHECK (tier IN ('spark', 'heat', 'legend')),
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gift_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  host_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_id        UUID REFERENCES public.events(id) ON DELETE SET NULL,
  gift_id         UUID REFERENCES public.gift_registry(id) ON DELETE RESTRICT,
  coin_cost       INTEGER NOT NULL,
  diamonds_minted NUMERIC(12, 4) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cashout_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  diamond_amount  NUMERIC(12, 4) NOT NULL,
  fiat_amount     NUMERIC(12, 2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'ZAR',
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  gateway_ref     TEXT,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coin_ledger_user ON public.coin_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_diamond_ledger_user ON public.diamond_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_gift_logs_host ON public.gift_logs(host_id);
CREATE INDEX IF NOT EXISTS idx_gift_logs_sender ON public.gift_logs(sender_id);
CREATE INDEX IF NOT EXISTS idx_gift_logs_event ON public.gift_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_cashout_requests_user ON public.cashout_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_cashout_requests_status ON public.cashout_requests(status);

-- cashout_requests.updated_at is never advanced without a trigger (it would stay
-- frozen at the insert time as the gateway moves it pending→processing→completed).
DROP TRIGGER IF EXISTS touch_cashout_requests_updated_at ON public.cashout_requests;
CREATE TRIGGER touch_cashout_requests_updated_at
  BEFORE UPDATE ON public.cashout_requests
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Gift SUPPORT signal — SEPARATE from vibe_count (heat). Gifts accrue here only,
-- so they can never buy Lineup/heat. (events is created in schema_part_2.)
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS support_score INTEGER DEFAULT 0;

-- Enable RLS
ALTER TABLE public.coin_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diamond_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashout_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "coin_ledger_read_own" ON public.coin_ledger;
CREATE POLICY "coin_ledger_read_own" ON public.coin_ledger FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "diamond_ledger_read_own" ON public.diamond_ledger;
CREATE POLICY "diamond_ledger_read_own" ON public.diamond_ledger FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "gift_registry_read_all" ON public.gift_registry;
CREATE POLICY "gift_registry_read_all" ON public.gift_registry FOR SELECT USING (true);

DROP POLICY IF EXISTS "gift_logs_read_involved" ON public.gift_logs;
CREATE POLICY "gift_logs_read_involved" ON public.gift_logs FOR SELECT 
  USING (sender_id = auth.uid() OR host_id = auth.uid());

DROP POLICY IF EXISTS "cashout_requests_read_own" ON public.cashout_requests;
CREATE POLICY "cashout_requests_read_own" ON public.cashout_requests FOR SELECT USING (user_id = auth.uid());

-- Insert default gifts if empty
INSERT INTO public.gift_registry (name, coin_cost, host_cut, lottie_url, tier) VALUES
  ('Flame Spark', 10, 0.50, 'https://assets.thegruvs.app/gifts/flame.json', 'spark'),
  ('Neon Laser', 50, 0.50, 'https://assets.thegruvs.app/gifts/laser.json', 'heat'),
  ('Royal Crown', 500, 0.60, 'https://assets.thegruvs.app/gifts/crown.json', 'legend')
ON CONFLICT (name) DO NOTHING;

-- Gifting Transaction Function
CREATE OR REPLACE FUNCTION public.process_gift(
  p_sender_id UUID,
  p_host_id UUID,
  p_event_id UUID,
  p_gift_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coin_cost INT;
  v_host_cut NUMERIC(3,2);
  v_diamonds_minted NUMERIC(12,4);
  v_sender_balance INT;
  v_gift_log_id UUID;
  v_host_id UUID;   -- the VERIFIED event host (never the client-supplied p_host_id)
BEGIN
  -- Validate authenticated caller matches sender
  IF auth.uid() IS NULL OR auth.uid() <> p_sender_id THEN
    RAISE EXCEPTION 'Not authorized to send this gift.';
  END IF;

  -- Serialize concurrent gifts from the SAME sender for the duration of this
  -- transaction. Without this, two in-flight gifts can both read the same
  -- balance, both pass the check below, and both debit — overdrawing the wallet
  -- (classic double-spend). The lock is released automatically at commit/rollback.
  PERFORM pg_advisory_xact_lock(hashtext('process_gift:' || p_sender_id::text));

  -- 1. Resolve the REAL host from the event. NEVER trust the client-supplied
  --    p_host_id: a caller could otherwise mint diamonds into any account.
  SELECT author_id INTO v_host_id FROM public.events WHERE id = p_event_id;
  IF v_host_id IS NULL THEN
    RAISE EXCEPTION 'Event not found.';
  END IF;
  IF v_host_id = p_sender_id THEN
    RAISE EXCEPTION 'Cannot send a gift to your own event.';
  END IF;

  -- 2. Get gift details (gift_registry is static config; no row lock needed)
  SELECT coin_cost, host_cut INTO v_coin_cost, v_host_cut
  FROM public.gift_registry
  WHERE id = p_gift_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gift not found or inactive.';
  END IF;

  -- 3. Compute current coin balance (safe under the per-sender lock above)
  SELECT COALESCE(SUM(amount), 0) INTO v_sender_balance
  FROM public.coin_ledger
  WHERE user_id = p_sender_id;

  -- 4. Check balance
  IF v_sender_balance < v_coin_cost THEN
    RAISE EXCEPTION 'INSUFFICIENT_COINS';
  END IF;

  v_diamonds_minted := v_coin_cost * v_host_cut;
  v_gift_log_id := gen_random_uuid();

  -- 5. Log the transaction (host_id = the verified event host)
  INSERT INTO public.gift_logs (id, sender_id, host_id, event_id, gift_id, coin_cost, diamonds_minted)
  VALUES (v_gift_log_id, p_sender_id, v_host_id, p_event_id, p_gift_id, v_coin_cost, v_diamonds_minted);

  -- 6. Debit sender
  INSERT INTO public.coin_ledger (user_id, amount, tx_type, reference_id)
  VALUES (p_sender_id, -v_coin_cost, 'gift_spent', v_gift_log_id);

  -- 7. Credit the VERIFIED host
  INSERT INTO public.diamond_ledger (user_id, amount, tx_type, reference_id)
  VALUES (v_host_id, v_diamonds_minted, 'gift_received', v_gift_log_id);

  -- 8. Accrue gift SUPPORT into a signal kept deliberately SEPARATE from
  --    vibe_count (organic heat). Product rule: gifts must NEVER buy Lineup/heat —
  --    support is its own thing, measured in coins gifted.
  UPDATE public.events
  SET support_score = COALESCE(support_score, 0) + v_coin_cost
  WHERE id = p_event_id;

  RETURN jsonb_build_object(
    'success', true,
    'gift_log_id', v_gift_log_id,
    'coins_spent', v_coin_cost,
    'diamonds_earned', v_diamonds_minted
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_gift(UUID, UUID, UUID, UUID) TO authenticated;


-- ══════════════════════════════════════════════════════════════════════════════
-- ── 35: AUDIT FIXES — 2026-06-24 (idempotent; runnable on a live DB) ──
-- ══════════════════════════════════════════════════════════════════════════════
--  SQL audit pass. Most of the schema was already sound (search_path pinned on
--  every SECURITY DEFINER fn, RLS on 145/147 tables, storage policies wrapped in a
--  dynamic drop-all DO block, messages columns guarded by information_schema checks).
--  The real defects found, and where they are fixed:
--
--   • process_gift wrote events.vibe_score (no such column) → RUNTIME FAILURE on
--     every gift. Fixed in §34: gifts now accrue events.support_score, a signal
--     kept SEPARATE from vibe_count/heat (gifts must never buy Lineup heat).
--   • process_gift had a per-sender double-spend race, trusted the client-supplied
--     host_id (mint diamonds into ANY account), and allowed self-gifting → fixed
--     in place in §34 (advisory lock + host derived from events.author_id).
--   • The cashout path did client-side INSERTs into cashout_requests / diamond_ledger,
--     but those tables only have SELECT policies — so RLS DENIED the inserts (broken
--     feature). Adding an INSERT policy would have let anyone mint diamonds. The
--     correct fix is the SECURITY DEFINER RPC below; the rate is server-controlled
--     (the old client passed ZARPerDiamond, which set its own payout). Point the
--     client at supabase.rpc('request_cashout', { p_diamond_amount }).
--   • Five RLS policies were redefined more weakly in schema_part_1 (which runs LAST
--     in the documented order, so its definition wins on a fresh build): event chat
--     readable without the published-event gate; any event role could moderate;
--     chat message length check dropped; soft-deleted events still visible;
--     path_crossings readable by anon. Fixed in place in schema_part_1 AND
--     re-asserted below so an already-built DB can be patched by running just §35.
--
--  For a pre-audit LIVE database: re-run schema_part_4.sql (idempotent — this brings
--  process_gift, the gift_logs indexes and the cashout trigger up to date) and then
--  run this §35 block. For a FRESH build, the in-place fixes already cover everything.

-- ── Secure cashout RPC (replaces the RLS-blocked client-side inserts) ──
CREATE OR REPLACE FUNCTION public.request_cashout(p_diamond_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID := auth.uid();
  v_balance    NUMERIC(12,4);
  v_rate       CONSTANT NUMERIC := 0.18;   -- ZAR per diamond; SERVER-controlled, never client-supplied
  v_fiat       NUMERIC(12,2);
  v_cashout_id UUID := gen_random_uuid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;
  IF p_diamond_amount IS NULL OR p_diamond_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid diamond amount.';
  END IF;

  -- Serialize concurrent cashouts for this user (prevents a double-withdraw race
  -- that could drive the diamond balance negative).
  PERFORM pg_advisory_xact_lock(hashtext('request_cashout:' || v_user_id::text));

  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM public.diamond_ledger
  WHERE user_id = v_user_id;

  IF v_balance < p_diamond_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_DIAMONDS';
  END IF;

  v_fiat := ROUND(p_diamond_amount * v_rate, 2);

  INSERT INTO public.cashout_requests (id, user_id, diamond_amount, fiat_amount, currency, status)
  VALUES (v_cashout_id, v_user_id, p_diamond_amount, v_fiat, 'ZAR', 'pending');

  INSERT INTO public.diamond_ledger (user_id, amount, tx_type, reference_id)
  VALUES (v_user_id, -p_diamond_amount, 'withdrawal', v_cashout_id);

  RETURN jsonb_build_object(
    'success',        true,
    'cashout_id',     v_cashout_id,
    'diamond_amount', p_diamond_amount,
    'fiat_amount',    v_fiat,
    'currency',       'ZAR'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_cashout(NUMERIC) TO authenticated;

-- ── Separate gift-support signal (so gifts never touch vibe_count/heat) ──
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS support_score INTEGER DEFAULT 0;

-- ── Live-DB re-assert of the 5 corrected RLS policies (no-op on a fresh build) ──
DROP POLICY IF EXISTS "chat_select_event_member" ON public.event_chat_messages;
CREATE POLICY "chat_select_event_member" ON public.event_chat_messages FOR SELECT
  USING (deleted = false AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.is_published = true));

DROP POLICY IF EXISTS "chat_insert_own" ON public.event_chat_messages;
CREATE POLICY "chat_insert_own" ON public.event_chat_messages FOR INSERT
  WITH CHECK (user_id = auth.uid() AND length(trim(message)) BETWEEN 1 AND 500);

DROP POLICY IF EXISTS "chat_update_moderator" ON public.event_chat_messages;
CREATE POLICY "chat_update_moderator" ON public.event_chat_messages FOR UPDATE
  USING (user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.event_roles r WHERE r.event_id = event_chat_messages.event_id AND r.user_id = auth.uid() AND r.role IN ('co_host','moderator'))
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_chat_messages.event_id AND e.author_id = auth.uid()));

DROP POLICY IF EXISTS "events_select" ON public.events;
CREATE POLICY "events_select" ON public.events FOR SELECT
  USING (deleted_at IS NULL AND (is_published = true OR author_id = auth.uid()));

DROP POLICY IF EXISTS "path_crossings_own" ON public.path_crossings;
CREATE POLICY "path_crossings_own" ON public.path_crossings FOR SELECT
  USING (auth.role() = 'authenticated');

-- ✅ §35 done.


-- ══════════════════════════════════════════════════════════════════════════════
-- ── 36: RELIABLE FOLLOW / UNFOLLOW RPCs — 2026-06-25 ──
-- ══════════════════════════════════════════════════════════════════════════════
--  The app already references follow_user / unfollow_user as resilience fallbacks
--  (LandingPage, DiscoverPeople, UserManager) but they were NEVER created — so when
--  a direct INSERT into follows failed (an RLS/edge case) there was no working
--  fallback, and the client swallowed the error, leaving the button stuck on
--  "Following" until a reload reverted it ("follow button doesn't work").
--
--  These SECURITY DEFINER RPCs are the reliable PRIMARY path: they validate the
--  caller (== auth.uid()), block self-follow, and write through RLS cleanly.
--  unfollow is a HARD delete because the follows readers (isFollowing /
--  getFollowedIds) do not filter any soft-deleted flag — a soft "unfollowed_at"
--  would still read as following, which is why that approach was dropped.

CREATE OR REPLACE FUNCTION public.follow_user(p_follower_id UUID, p_following_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_follower_id THEN
    RAISE EXCEPTION 'Not authorized.';
  END IF;
  IF p_follower_id = p_following_id THEN
    RAISE EXCEPTION 'Cannot follow yourself.';
  END IF;

  INSERT INTO public.follows (follower_id, following_id)
  VALUES (p_follower_id, p_following_id)
  ON CONFLICT (follower_id, following_id) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'following', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.unfollow_user(p_follower_id UUID, p_following_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_follower_id THEN
    RAISE EXCEPTION 'Not authorized.';
  END IF;

  DELETE FROM public.follows
  WHERE follower_id = p_follower_id AND following_id = p_following_id;

  RETURN jsonb_build_object('success', true, 'following', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.follow_user(UUID, UUID)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.unfollow_user(UUID, UUID) TO authenticated;

-- ✅ §36 done.
