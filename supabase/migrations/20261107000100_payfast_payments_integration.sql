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
ALTER TABLE public.event_rsvps ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'free';
ALTER TABLE public.event_rsvps ADD COLUMN IF NOT EXISTS payment_ref TEXT;

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
