-- meal_reach_test.sql — a client can't boost itself or reset its view counts;
-- boost_meal() (server) still can. Skips if The Meal isn't installed.
-- See supabase/migrations/20260927001100_meal_reach_integrity.sql.
\set ON_ERROR_STOP on
BEGIN;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;

DO $t$
DECLARE v_meal uuid; r record;
BEGIN
  IF to_regclass('public.meal_posts') IS NULL THEN
    RAISE NOTICE 'SKIP meal_posts not installed'; RETURN;
  END IF;

  SET LOCAL session_replication_role = replica;
  INSERT INTO auth.users (id) VALUES ('e0000000-0000-0000-0000-00000000000e');
  INSERT INTO public.profiles (id, username) VALUES ('e0000000-0000-0000-0000-00000000000e', 't_chef');
  INSERT INTO public.business_profiles (id, user_id, business_name)
    VALUES ('f0000000-0000-0000-0000-00000000000f', 'e0000000-0000-0000-0000-00000000000e', 'Test Kitchen');
  SET LOCAL session_replication_role = origin;
  GRANT ALL ON public.meal_posts TO authenticated;   -- Supabase default

  PERFORM set_config('test.uid', 'e0000000-0000-0000-0000-00000000000e', true);
  SET LOCAL ROLE authenticated;

  INSERT INTO public.meal_posts (business_id, owner_id, title, is_boosted, boosted_until, unique_view_count)
  VALUES ('f0000000-0000-0000-0000-00000000000f', 'e0000000-0000-0000-0000-00000000000e',
          'Bunny chow', true, '2099-01-01', -500)
  RETURNING id INTO v_meal;
  SELECT * INTO r FROM public.meal_posts WHERE id = v_meal;
  IF r.is_boosted OR r.boosted_until IS NOT NULL OR r.unique_view_count <> 0 THEN
    RAISE EXCEPTION 'FAIL insert kept client-set reach columns';
  END IF;
  RAISE NOTICE 'OK  insert cannot start boosted';

  UPDATE public.meal_posts SET is_boosted = true, boosted_until = '2099-01-01',
         unique_view_count = 0, title = 'Bunny chow (new)' WHERE id = v_meal;
  SELECT * INTO r FROM public.meal_posts WHERE id = v_meal;
  IF r.is_boosted OR r.title <> 'Bunny chow (new)' THEN
    RAISE EXCEPTION 'FAIL update: boosted=% title=%', r.is_boosted, r.title;
  END IF;
  RAISE NOTICE 'OK  direct self-boost ignored, normal edits still work';

  PERFORM public.boost_meal(v_meal, 24);
  SELECT * INTO r FROM public.meal_posts WHERE id = v_meal;
  IF NOT r.is_boosted THEN RAISE EXCEPTION 'FAIL boost_meal could not boost'; END IF;
  RAISE NOTICE 'OK  boost_meal() still boosts (within the tier cap)';
  RESET ROLE;
END
$t$;
ROLLBACK;
