-- 2026-08-18. Two things:
--
-- 1) founder_alerts — the business already got notified when a founder marks
--    an invoice request 'paid' (notify_business_invoice_paid, applied
--    earlier today), but there was no signal at all the other direction: the
--    founder learned about a NEW request only by checking the table or
--    hoping the client-side mailto fired. This is the honest fix given there
--    is no admin-auth system yet to push a real notification through — a
--    default-deny table (RLS on, zero policies, so only the service role can
--    ever read/write it) that the founder can query from the Supabase
--    dashboard. Not a push notification; a queryable to-do list.
--
-- 2) Lockdown of today's earlier trigger functions — Supabase's advisor
--    flagged enforce_report_rate_limit(), notify_business_invoice_paid(), and
--    touch_business_invoice_requests() as anon/authenticated-executable
--    SECURITY DEFINER functions (auto-exposed via PostgREST). None are meant
--    to be called directly — they only make sense fired by their triggers.
--    Revoked EXECUTE from anon/authenticated; verified the triggers
--    themselves still fire correctly afterward (trigger execution doesn't go
--    through the PostgREST RPC grant path).

CREATE TABLE IF NOT EXISTS founder_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE founder_alerts ENABLE ROW LEVEL SECURITY;
-- No policies = default-deny for every role except service_role.

CREATE OR REPLACE FUNCTION notify_founder_new_invoice_request()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'requested' THEN
    INSERT INTO founder_alerts (kind, message, data)
    VALUES (
      'business_invoice_request',
      'New ' || NEW.requested_tier || ' invoice request from business ' || NEW.business_id,
      jsonb_build_object('invoice_request_id', NEW.id, 'business_id', NEW.business_id, 'requested_tier', NEW.requested_tier, 'amount', NEW.amount)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE EXECUTE ON FUNCTION notify_founder_new_invoice_request() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_founder_new_invoice ON business_invoice_requests;
CREATE TRIGGER trg_notify_founder_new_invoice
  AFTER INSERT ON business_invoice_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_founder_new_invoice_request();

-- enforce_report_rate_limit() + its trigger: existed live but in ZERO
-- tracked SQL files (hand-pasted at some point, never saved back) — found
-- 2026-08-20 when db-schema-ci.yml's fresh rebuild died here with "function
-- ... does not exist" on the REVOKE below. Added verbatim from
-- pg_get_functiondef/pg_get_triggerdef against production.
CREATE OR REPLACE FUNCTION public.enforce_report_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  recent_same_target INT;
  recent_total INT;
BEGIN
  SELECT count(*) INTO recent_same_target
  FROM reports
  WHERE reporter_id = NEW.reporter_id
    AND target_id = NEW.target_id
    AND created_at > now() - interval '1 hour';
  IF recent_same_target > 0 THEN
    RAISE EXCEPTION 'You already reported this recently. Please wait before reporting it again.'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO recent_total
  FROM reports
  WHERE reporter_id = NEW.reporter_id
    AND created_at > now() - interval '24 hours';
  IF recent_total >= 20 THEN
    RAISE EXCEPTION 'You have submitted too many reports recently. Please try again later.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reports_rate_limit ON public.reports;
CREATE TRIGGER trg_reports_rate_limit
  BEFORE INSERT ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_report_rate_limit();

REVOKE EXECUTE ON FUNCTION public.enforce_report_rate_limit() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_business_invoice_paid() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_business_invoice_requests() FROM anon, authenticated;
