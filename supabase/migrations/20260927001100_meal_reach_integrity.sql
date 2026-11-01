-- ═══════════════════════════════════════════════════════════════════════════
--  The Meal: the reach economy could be skipped with one direct update.
--
--  meal_posts_update lets an owner update their own row, every column. The
--  whole reach model lives in four of those columns:
--    is_boosted / boosted_until       → boost_meal() enforces the tier's cap
--                                        (starter 1, pro 5, royal 20)
--    view_count / unique_view_count   → feed_meals() drops a non-boosted meal
--                                        after the tier's free views
--  So `update meal_posts set is_boosted=true, boosted_until='2099-01-01'` or
--  `set unique_view_count=0` from the app bypassed both, and the INSERT policy
--  let a new post start boosted. That's the product the upgrade tiers sell.
--
--  Fix: a SECURITY INVOKER trigger. When the caller is a client role, those
--  columns keep their server values (defaults on insert). boost_meal() and
--  bump_meal_view() are SECURITY DEFINER, so inside them current_user is the
--  owner, not a client role, and they still write these columns. Same pattern
--  as protect_profile_trust_columns (definer_rpc_hardening §4).
--
--  Also pins owner_id/business_id on update, so a post can't be moved onto
--  another business's tier.
--
--  Idempotent. No-op if The Meal isn't installed.
-- ═══════════════════════════════════════════════════════════════════════════
DO $mig$
BEGIN
  IF to_regclass('public.meal_posts') IS NULL THEN
    RAISE NOTICE 'meal_posts not present — skipping';
    RETURN;
  END IF;

  CREATE OR REPLACE FUNCTION public.protect_meal_reach_columns()
  RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $fn$
  BEGIN
    IF current_user NOT IN ('anon', 'authenticated') THEN
      RETURN NEW;   -- server-side (definer functions, service_role, SQL editor)
    END IF;
    IF TG_OP = 'INSERT' THEN
      NEW.is_boosted        := false;
      NEW.boosted_until     := NULL;
      NEW.view_count        := 0;
      NEW.unique_view_count := 0;
    ELSE
      NEW.is_boosted        := OLD.is_boosted;
      NEW.boosted_until     := OLD.boosted_until;
      NEW.view_count        := OLD.view_count;
      NEW.unique_view_count := OLD.unique_view_count;
      NEW.owner_id          := OLD.owner_id;
      NEW.business_id       := OLD.business_id;
    END IF;
    RETURN NEW;
  END;
  $fn$;

  DROP TRIGGER IF EXISTS trg_protect_meal_reach ON public.meal_posts;
  CREATE TRIGGER trg_protect_meal_reach
    BEFORE INSERT OR UPDATE ON public.meal_posts
    FOR EACH ROW EXECUTE FUNCTION public.protect_meal_reach_columns();
END
$mig$;
