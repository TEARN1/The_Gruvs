-- ═══════════════════════════════════════════════════════════════════════════
--  20260927000900_service_bookings_integrity.sql — bookings and wallet money go through the
--  server only, and money can no longer be created from nothing.
--
--  WHAT WAS WRONG
--
--  1. "Escrow" never took money from anyone. EscrowService.lockFunds inserted a
--     service_bookings row with status 'escrow_held' straight from the phone,
--     with an amount the phone chose. release_escrow_to_provider then ADDED that
--     amount to the provider's wallet_balance. Nothing was ever debited. With
--     two accounts: list a service on one, book it from the other for any
--     amount, release — balance appears from nothing. Harmless only while
--     cash-out is switched off (launchConfig: cashout:false).
--
--  2. Policy "service_bookings_manage" was FOR ALL for both parties, so either
--     side could rewrite status, amount or the other party's id directly.
--
--  3. Policy "wallet_own" on wallet_transactions was FOR ALL: a user could
--     insert, edit or delete their own transaction history. A ledger that its
--     subject can edit is not a ledger.
--
--  4. Disputes could not be filed on this schema: the app writes `raised_by`,
--     which is a GENERATED column (from filed_by), so every insert failed.
--
--  WHAT THIS DOES
--
--  • payment_status on service_bookings: 'unfunded' (default) | 'captured' |
--    'refunded'. Only service_role (a future payment-provider webhook) can set
--    'captured'. release_escrow_to_provider credits the provider wallet ONLY
--    when the booking is captured, and writes a ledger row when it does.
--    Unfunded bookings still complete — they just don't mint balance.
--  • create_service_booking(): the one way to create a booking. Provider is read
--    from the service listing (not trusted from the phone), you cannot book
--    yourself, amount must be positive and bounded.
--  • open_dispute(): the one way to dispute. Party-only, one open dispute per
--    booking, only while the booking is live.
--  • Clients lose direct INSERT/UPDATE/DELETE on service_bookings, disputes and
--    wallet_transactions. They keep SELECT on their own rows.
--
--  WHAT THIS DOES NOT DO: hold real money. Real escrow needs a payment provider
--  (Paystack / PayFast / Stripe) whose webhook sets payment_status='captured'.
--  Until then the app must not tell users funds are "locked".
--
--  Idempotent. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Columns ──────────────────────────────────────────────────────────────
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS amount_cents   INTEGER;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unfunded';
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS payment_ref    TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_bookings_payment_status_check') THEN
    ALTER TABLE public.service_bookings
      ADD CONSTRAINT service_bookings_payment_status_check
      CHECK (payment_status IN ('unfunded','captured','refunded'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_bookings_amount_positive') THEN
    ALTER TABLE public.service_bookings
      ADD CONSTRAINT service_bookings_amount_positive
      CHECK (amount_cents IS NULL OR amount_cents > 0) NOT VALID;
  END IF;
END $$;

-- ── 2. Lock down direct writes ──────────────────────────────────────────────
DROP POLICY IF EXISTS "service_bookings_manage" ON public.service_bookings;
DROP POLICY IF EXISTS "service_bookings_select" ON public.service_bookings;
CREATE POLICY "service_bookings_select" ON public.service_bookings
  FOR SELECT USING (client_id = auth.uid() OR provider_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.service_bookings FROM anon, authenticated;

DROP POLICY IF EXISTS "disputes_manage" ON public.disputes;
DROP POLICY IF EXISTS "disputes_select" ON public.disputes;
CREATE POLICY "disputes_select" ON public.disputes
  FOR SELECT USING (
    filed_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.service_bookings b
                WHERE b.id = disputes.booking_id
                  AND (b.client_id = auth.uid() OR b.provider_id = auth.uid()))
  );
REVOKE INSERT, UPDATE, DELETE ON public.disputes FROM anon, authenticated;

DROP POLICY IF EXISTS "wallet_own"    ON public.wallet_transactions;
DROP POLICY IF EXISTS "wallet_select" ON public.wallet_transactions;
CREATE POLICY "wallet_select" ON public.wallet_transactions
  FOR SELECT USING (user_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.wallet_transactions FROM anon, authenticated;

-- ── 3. create_service_booking ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_service_booking(
  p_service_node_id UUID,
  p_amount_cents    INTEGER,
  p_cargo_type      TEXT        DEFAULT NULL,
  p_pickup_address  TEXT        DEFAULT NULL,
  p_dropoff_address TEXT        DEFAULT NULL,
  p_scheduled_at    TIMESTAMPTZ DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_provider UUID;
  v_id       UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '28000';
  END IF;

  -- The provider is whoever owns the listing. Never trusted from the client.
  SELECT COALESCE(n.provider_id, n.user_id) INTO v_provider
    FROM public.service_nodes n
   WHERE n.id = p_service_node_id
     AND COALESCE(n.is_active, true)
     AND COALESCE(n.available, true);
  IF v_provider IS NULL THEN
    RAISE EXCEPTION 'service not found or unavailable' USING ERRCODE = 'P0002';
  END IF;
  IF v_provider = v_uid THEN
    RAISE EXCEPTION 'you cannot book your own service' USING ERRCODE = '42501';
  END IF;

  -- R 0.01 … R 1,000,000. Bounds a typo or a forged request.
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 OR p_amount_cents > 100000000 THEN
    RAISE EXCEPTION 'invalid amount' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.service_bookings
    (service_node_id, client_id, provider_id, cargo_type,
     pickup_address, dropoff_address, scheduled_at,
     amount_cents, estimated_price, status, payment_status)
  VALUES
    (p_service_node_id, v_uid, v_provider, left(p_cargo_type, 200),
     left(p_pickup_address, 500), left(p_dropoff_address, 500), p_scheduled_at,
     p_amount_cents, p_amount_cents / 100.0, 'escrow_held', 'unfunded')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
REVOKE ALL     ON FUNCTION public.create_service_booking(UUID, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.create_service_booking(UUID, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;

-- ── 4. release_escrow_to_provider — credits only captured money ─────────────
DROP FUNCTION IF EXISTS public.release_escrow_to_provider(UUID);
CREATE FUNCTION public.release_escrow_to_provider(p_booking_id UUID)
RETURNS TABLE (booking_id UUID, provider_id UUID, amount_cents INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.service_bookings;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO b FROM public.service_bookings WHERE id = p_booking_id FOR UPDATE;
  IF b.id IS NULL THEN
    RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002';
  END IF;
  IF b.client_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'only the client who paid may release this escrow' USING ERRCODE = '42501';
  END IF;
  IF b.status NOT IN ('escrow_held', 'in_progress') THEN
    RAISE EXCEPTION 'booking is % — it cannot be released', b.status USING ERRCODE = '22023';
  END IF;

  UPDATE public.service_bookings SET status = 'completed', completed_at = now() WHERE id = b.id;

  -- Only money a payment provider actually captured becomes wallet balance.
  IF b.payment_status = 'captured' AND COALESCE(b.amount_cents, 0) > 0 THEN
    UPDATE public.profiles
       SET wallet_balance = COALESCE(wallet_balance, 0) + (b.amount_cents / 100.0)
     WHERE id = b.provider_id;
    INSERT INTO public.wallet_transactions (user_id, amount, type, reference, meta)
    VALUES (b.provider_id, b.amount_cents / 100.0, 'release', b.id::text,
            jsonb_build_object('booking_id', b.id, 'client_id', b.client_id));
  END IF;

  RETURN QUERY SELECT b.id, b.provider_id, b.amount_cents;
END;
$$;
REVOKE ALL     ON FUNCTION public.release_escrow_to_provider(UUID) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.release_escrow_to_provider(UUID) TO authenticated;

-- ── 5. open_dispute ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.open_dispute(p_booking_id UUID, p_reason TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  b     public.service_bookings;
  v_id  UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO b FROM public.service_bookings WHERE id = p_booking_id FOR UPDATE;
  IF b.id IS NULL OR v_uid NOT IN (b.client_id, b.provider_id) THEN
    -- Same error for "missing" and "not yours": don't confirm a booking exists.
    RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002';
  END IF;
  IF b.status NOT IN ('escrow_held', 'in_progress') THEN
    RAISE EXCEPTION 'booking is % — it cannot be disputed', b.status USING ERRCODE = '22023';
  END IF;

  UPDATE public.service_bookings SET status = 'disputed', disputed_at = now() WHERE id = b.id;
  INSERT INTO public.disputes (booking_id, filed_by, reason, status)
  VALUES (b.id, v_uid, left(COALESCE(p_reason, ''), 2000), 'open')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL     ON FUNCTION public.open_dispute(UUID, TEXT) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.open_dispute(UUID, TEXT) TO authenticated;
