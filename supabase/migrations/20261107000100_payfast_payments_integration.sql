-- ═══════════════════════════════════════════════════════════════════════════
-- 20261107000100_payfast_payments_integration.sql
-- PayFast Gateway integration for tickets, bookings, subscriptions & splits.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. PayFast Transactions Audit Log Table
CREATE TABLE IF NOT EXISTS public.payfast_transactions (
  m_payment_id   TEXT PRIMARY KEY,
  pf_payment_id  TEXT,
  payment_status TEXT NOT NULL,
  item_name      TEXT,
  amount_gross   NUMERIC(10,2),
  amount_fee     NUMERIC(10,2),
  amount_net     NUMERIC(10,2),
  user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  app            TEXT DEFAULT 'thegruvs',
  item_type      TEXT DEFAULT 'ticket',
  raw_payload    JSONB,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- The order payfast-checkout records before the buyer goes to PayFast; the
-- notification must match it (payfast-itn). Only the service role writes here.
ALTER TABLE public.payfast_transactions ALTER COLUMN payment_status SET DEFAULT 'PENDING';
ALTER TABLE public.payfast_transactions ADD COLUMN IF NOT EXISTS item_id TEXT;
ALTER TABLE public.payfast_transactions ADD COLUMN IF NOT EXISTS expected_amount_cents INTEGER
  CHECK (expected_amount_cents IS NULL OR expected_amount_cents > 0);
ALTER TABLE public.payfast_transactions ADD COLUMN IF NOT EXISTS order_details JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.payfast_transactions ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.payfast_transactions FROM anon, authenticated;

-- Enable RLS
ALTER TABLE public.payfast_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payfast_transactions' AND policyname = 'payfast_transactions_read_own'
  ) THEN
    CREATE POLICY payfast_transactions_read_own
      ON public.payfast_transactions
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 2. Ensure payment columns on event_rsvps
ALTER TABLE public.event_rsvps ADD COLUMN IF NOT EXISTS tier_id TEXT;
ALTER TABLE public.event_rsvps ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'free';
ALTER TABLE public.event_rsvps ADD COLUMN IF NOT EXISTS payment_ref TEXT;

-- People write their own RSVP rows, so the payment columns and paid tiers are
-- guarded: only the server (payfast-itn, as service_role) marks a ticket paid
-- or books a paid tier. Invoker on purpose, so current_user is the caller.
CREATE OR REPLACE FUNCTION public.guard_rsvp_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $
DECLARE
  v_price text;
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.payment_status := 'free';
      NEW.payment_ref := NULL;
    ELSE
      NEW.payment_status := OLD.payment_status;
      NEW.payment_ref := OLD.payment_ref;
    END IF;
    IF NEW.tier_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.tier_id IS DISTINCT FROM OLD.tier_id) THEN
      SELECT t->>'price' INTO v_price
        FROM public.events e, jsonb_array_elements(COALESCE(e.rsvp_tiers, '[]'::jsonb)) t
       WHERE e.id = NEW.event_id AND t->>'id' = NEW.tier_id::text
       LIMIT 1;
      IF v_price IS NOT NULL AND v_price !~* '^\s*(0+(\.0+)?|free)?\s*

-- 3. Ensure columns on ticket_tokens
ALTER TABLE public.ticket_tokens ADD COLUMN IF NOT EXISTS tier_id TEXT;
ALTER TABLE public.ticket_tokens ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 4. Event waitlist columns for 10-minute automated hold window
ALTER TABLE public.event_waitlist ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'queued';
ALTER TABLE public.event_waitlist ADD COLUMN IF NOT EXISTS reserved_until TIMESTAMPTZ;
ALTER TABLE public.event_waitlist ADD COLUMN IF NOT EXISTS payment_ref TEXT;

-- The waitlist policy lets people write their own row; only the server makes
-- an offer, so a person cannot mark themselves offered.
CREATE OR REPLACE FUNCTION public.guard_waitlist_offer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.status := 'queued';
      NEW.reserved_until := NULL;
      NEW.payment_ref := NULL;
    ELSE
      NEW.status := OLD.status;
      NEW.reserved_until := OLD.reserved_until;
      NEW.payment_ref := OLD.payment_ref;
    END IF;
  END IF;
  RETURN NEW;
END;
$;

DROP TRIGGER IF EXISTS guard_waitlist_offer ON public.event_waitlist;
CREATE TRIGGER guard_waitlist_offer
  BEFORE INSERT OR UPDATE ON public.event_waitlist
  FOR EACH ROW EXECUTE FUNCTION public.guard_waitlist_offer();

-- Index for speedy queries
CREATE INDEX IF NOT EXISTS idx_payfast_tx_user ON public.payfast_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_pay ON public.event_rsvps(event_id, user_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_waitlist_reserved ON public.event_waitlist(event_id, status, reserved_until);
 THEN
        RAISE EXCEPTION 'A paid tier is booked by paying for it.' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$;

DROP TRIGGER IF EXISTS guard_rsvp_payment ON public.event_rsvps;
CREATE TRIGGER guard_rsvp_payment
  BEFORE INSERT OR UPDATE ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.guard_rsvp_payment();

-- 3. Ensure columns on ticket_tokens
ALTER TABLE public.ticket_tokens ADD COLUMN IF NOT EXISTS tier_id TEXT;
ALTER TABLE public.ticket_tokens ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 4. Event waitlist columns for 10-minute automated hold window
ALTER TABLE public.event_waitlist ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'queued';
ALTER TABLE public.event_waitlist ADD COLUMN IF NOT EXISTS reserved_until TIMESTAMPTZ;
ALTER TABLE public.event_waitlist ADD COLUMN IF NOT EXISTS payment_ref TEXT;

-- Index for speedy queries
CREATE INDEX IF NOT EXISTS idx_payfast_tx_user ON public.payfast_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_pay ON public.event_rsvps(event_id, user_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_waitlist_reserved ON public.event_waitlist(event_id, status, reserved_until);
