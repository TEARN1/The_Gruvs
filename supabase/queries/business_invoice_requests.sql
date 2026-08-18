-- business_invoice_requests
-- First real (manual, off-platform) money-process table. A business requests a
-- paid tier upgrade; the founder invoices them directly (EFT/PayPal) outside
-- the app, then marks the row `paid` and sets business_profiles.tier by hand.
-- No PSP, no card data, no KYC — see RISK_REGISTER.md "Monetization vs.
-- philosophy drift" section and MonetizationRegistry.js's `brand_invoice` rail.

CREATE TABLE IF NOT EXISTS business_invoice_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_tier TEXT NOT NULL CHECK (requested_tier IN ('pro', 'royal', 'enterprise')),
  amount NUMERIC(12, 2),
  currency TEXT NOT NULL DEFAULT 'ZAR',
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'invoiced', 'paid', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_biz_invoice_requests_business ON business_invoice_requests(business_id);

ALTER TABLE business_invoice_requests ENABLE ROW LEVEL SECURITY;

-- A business owner can see and create requests for their own business only.
DROP POLICY IF EXISTS biz_invoice_requests_select_own ON business_invoice_requests;
CREATE POLICY biz_invoice_requests_select_own ON business_invoice_requests
  FOR SELECT USING (
    business_id IN (SELECT id FROM business_profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS biz_invoice_requests_insert_own ON business_invoice_requests;
CREATE POLICY biz_invoice_requests_insert_own ON business_invoice_requests
  FOR INSERT WITH CHECK (
    requested_by = auth.uid()
    AND business_id IN (SELECT id FROM business_profiles WHERE user_id = auth.uid())
  );

-- Status updates (invoiced/paid/cancelled) are founder-only via the Supabase
-- dashboard (service role bypasses RLS) — no client-side UPDATE policy on
-- purpose, so a business can never mark its own request "paid".
