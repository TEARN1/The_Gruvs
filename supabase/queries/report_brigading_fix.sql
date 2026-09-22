-- ═══════════════════════════════════════════════════════════════════════════
--  report_brigading_fix.sql — two fresh accounts could hide anyone.
--
--  THE BUG. apply_report_autohide() weights each distinct reporter by:
--
--      GREATEST(0, LEAST(2.0, COALESCE(MAX(p.social_integrity_score), 50) / 50.0))
--
--  and auto-hides the target once the weights sum to 3.0. The divisor of 50 says
--  the formula was written for a baseline score of 50 — and every other place in
--  the codebase agrees: trustLedger.js uses `|| 50` twice, update_sis_score uses
--  COALESCE(social_integrity_score, 50), and this very function COALESCEs NULL
--  to 50.
--
--  But the column is declared `social_integrity_score INTEGER DEFAULT 100`.
--
--  So every real account computes 100/50.0 = 2.0 and is clamped at the 2.0 cap.
--  Two consequences, both bad:
--
--    1. TWO brand-new accounts sum to 4.0 and clear the 3.0 threshold. Signup
--       logs you straight in without email confirmation, so that is two minutes
--       of work to hide any user, event, reel or echo.
--
--    2. The trust gradient does not exist. A three-year-old account in perfect
--       standing and a sock puppet created thirty seconds ago both weigh 2.0.
--       The weighting the design depends on is inert.
--
--  Reproduced on a local Postgres against the trigger exactly as shipped: two
--  accounts created seconds earlier set is_auto_hidden on a 3-year-old profile.
--
--  THE FIX. Two changes to the weight, and a constraint.
--
--    • Rebase the divisor to the real default, so a normal account weighs 1.0
--      and three of them are needed — which is what "~3 trusted reports" meant.
--      Score now only ever REDUCES weight: 100 -> 1.0, 50 -> 0.5, 0 -> 0.0.
--      (update_sis_score clamps the score to 100, so 1.0 is the natural ceiling.)
--
--    • Multiply by an establishment factor. A report is worth what the account
--      behind it is worth, and an account minutes old has earned nothing. This
--      is the part that actually stops brigading: age cannot be farmed quickly,
--      unlike account count.
--
--    • UNIQUE (reporter_id, target_id, target_type). The trigger already
--      GROUPs BY reporter_id so duplicates never double-count, but nothing stops
--      the rows accumulating. Added NOT VALID so it cannot fail on existing
--      duplicates; clean those up, then VALIDATE.
--
--  Effect on the attack: day-old accounts weigh 0.2, so brigading needs 15 of
--  them instead of 2. Genuine reports from established users are unchanged —
--  still three.
--
--  Idempotent. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.apply_report_autohide()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  wsum NUMERIC;
BEGIN
  -- Sum weight across DISTINCT reporters of this target.
  SELECT COALESCE(SUM(w), 0) INTO wsum FROM (
    SELECT r.reporter_id,
           -- Standing: 100 (the column default) is a normal account at 1.0.
           -- A reduced score reduces the weight; it can never inflate it.
           GREATEST(0, LEAST(1.0, COALESCE(MAX(p.social_integrity_score), 100) / 100.0))
           *
           -- Establishment: how much has this account actually earned? Account
           -- age is the one input a brigade cannot manufacture on demand.
           CASE
             WHEN MAX(p.created_at) IS NULL                          THEN 0.2
             WHEN MAX(p.created_at) > now() - interval '24 hours'    THEN 0.2
             WHEN MAX(p.created_at) > now() - interval '7 days'      THEN 0.5
             WHEN MAX(p.created_at) > now() - interval '30 days'     THEN 0.8
             ELSE 1.0
           END AS w
    FROM public.reports r
    LEFT JOIN public.profiles p ON p.id = r.reporter_id
    WHERE r.target_id = NEW.target_id AND r.target_type = NEW.target_type
    GROUP BY r.reporter_id
  ) s;

  IF wsum < 3.0 THEN RETURN NEW; END IF;   -- ~3 established reporters

  IF    NEW.target_type = 'event' THEN UPDATE public.events   SET auto_hidden    = true WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'reel'  THEN UPDATE public.reels    SET auto_hidden    = true WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'echo'  THEN UPDATE public.echoes   SET auto_hidden    = true WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'user'  THEN UPDATE public.profiles SET is_auto_hidden = true WHERE id = NEW.target_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_report_autohide_trigger ON public.reports;
CREATE TRIGGER apply_report_autohide_trigger
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.apply_report_autohide();

-- One report per person per target. The trigger already GROUPs BY reporter_id,
-- so duplicates never double-count; this stops them accumulating as rows.
-- Created as a unique INDEX (not a constraint) so it can be built without
-- rewriting the table, and only when the existing data actually allows it.
DO $$
DECLARE dupes bigint;
BEGIN
  IF to_regclass('public.reports') IS NULL THEN
    RAISE NOTICE 'reports table absent — skipping';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'uniq_reports_reporter_target') THEN
    RAISE NOTICE 'uniq_reports_reporter_target already present';
    RETURN;
  END IF;

  SELECT count(*) INTO dupes FROM (
    SELECT reporter_id, target_id, target_type
      FROM public.reports
     GROUP BY reporter_id, target_id, target_type
    HAVING count(*) > 1
  ) d;

  IF dupes > 0 THEN
    RAISE WARNING
      '% duplicate (reporter,target) group(s) exist — unique index NOT created. '
      'De-duplicate first, then re-run this file. Nothing else here is affected.', dupes;
    RETURN;
  END IF;

  CREATE UNIQUE INDEX uniq_reports_reporter_target
    ON public.reports (reporter_id, target_id, target_type);
  RAISE NOTICE 'created uniq_reports_reporter_target';
END $$;
