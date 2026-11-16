-- ══════════════════════════════════════════════════════════════════════════════
--  touch_down_v2_test.sql — rotating door code proves presence; nobody else can
--  claim it. See supabase/migrations/20261007000100_touch_down_v2_door_code.sql.
--  Runs as the real `authenticated` role inside a rolled-back transaction.
-- ══════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
BEGIN;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;

-- Fixture: host H, guest G, outsider O, event E by H.
SET LOCAL session_replication_role = replica;
INSERT INTO auth.users (id) VALUES
  ('11111111-0000-0000-0000-00000000000a'), ('22222222-0000-0000-0000-00000000000b'), ('33333333-0000-0000-0000-00000000000c');
INSERT INTO public.profiles (id, username) VALUES
  ('11111111-0000-0000-0000-00000000000a', 't_host'), ('22222222-0000-0000-0000-00000000000b', 't_guest'), ('33333333-0000-0000-0000-00000000000c', 't_out');
INSERT INTO public.events (id, author_id, title)
VALUES ('eeeeeeee-0000-0000-0000-00000000000e', '11111111-0000-0000-0000-00000000000a', 'Door test');
SET LOCAL session_replication_role = origin;
GRANT ALL ON public.live_checkins TO authenticated;   -- Supabase default

SET LOCAL ROLE authenticated;

-- 1. An outsider can't fetch the door code ────────────────────────────────────
SET LOCAL test.uid = '33333333-0000-0000-0000-00000000000c';
DO $$ BEGIN
  BEGIN
    PERFORM public.get_door_code('eeeeeeee-0000-0000-0000-00000000000e');
    RAISE EXCEPTION 'FAIL outsider got the door code';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  outsider refused the door code';
  END;
END $$;

-- 2. Clients can't read the secret or call the derivation directly ──────────
DO $$ BEGIN
  BEGIN
    PERFORM 1 FROM public.event_door_secrets LIMIT 1;
    RAISE EXCEPTION 'FAIL client read event_door_secrets';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  secrets table closed to clients';
  END;
  BEGIN
    PERFORM public.door_code_at('\x00'::bytea, 1);
    RAISE EXCEPTION 'FAIL client called door_code_at';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  code derivation closed to clients';
  END;
END $$;

-- 3. The host gets a 6-digit code ─────────────────────────────────────────────
SET LOCAL test.uid = '11111111-0000-0000-0000-00000000000a';
DO $$
DECLARE r jsonb;
BEGIN
  r := public.get_door_code('eeeeeeee-0000-0000-0000-00000000000e');
  IF (r->>'code') !~ '^\d{6}$' OR (r->>'seconds_left')::int NOT BETWEEN 1 AND 30 THEN
    RAISE EXCEPTION 'FAIL bad door code payload %', r;
  END IF;
  PERFORM set_config('test.code', r->>'code', true);
  RAISE NOTICE 'OK  host gets a rotating 6-digit code';
END $$;

-- 4. Guest: wrong code refused, right code verifies at level 2 ───────────────
SET LOCAL test.uid = '22222222-0000-0000-0000-00000000000b';
DO $$
DECLARE r jsonb; wrong text;
BEGIN
  wrong := lpad(((current_setting('test.code')::int + 1) % 1000000)::text, 6, '0');
  r := public.touch_down_with_code('eeeeeeee-0000-0000-0000-00000000000e', wrong);
  IF (r->>'ok')::boolean THEN RAISE EXCEPTION 'FAIL wrong code accepted'; END IF;
  RAISE NOTICE 'OK  wrong code refused';

  r := public.touch_down_with_code('eeeeeeee-0000-0000-0000-00000000000e', current_setting('test.code'), -26.19312, 28.03455);
  IF NOT (r->>'ok')::boolean THEN RAISE EXCEPTION 'FAIL right code refused: %', r; END IF;
  IF (SELECT verify_level FROM public.live_checkins
       WHERE user_id = '22222222-0000-0000-0000-00000000000b' AND event_id = 'eeeeeeee-0000-0000-0000-00000000000e') <> 2 THEN
    RAISE EXCEPTION 'FAIL check-in not at level 2';
  END IF;
  IF (SELECT lat FROM public.live_checkins WHERE user_id = '22222222-0000-0000-0000-00000000000b') <> -26.193 THEN
    RAISE EXCEPTION 'FAIL coordinates not rounded';
  END IF;
  RAISE NOTICE 'OK  right code verifies at level 2 (coordinates rounded to ~100 m)';
END $$;

-- 5. A phone can't claim a level itself ───────────────────────────────────────
SET LOCAL test.uid = '33333333-0000-0000-0000-00000000000c';
DO $$
BEGIN
  INSERT INTO public.live_checkins (event_id, user_id, verify_level, verified)
  VALUES ('eeeeeeee-0000-0000-0000-00000000000e', '33333333-0000-0000-0000-00000000000c', 3, true);
  IF (SELECT verify_level FROM public.live_checkins WHERE user_id = '33333333-0000-0000-0000-00000000000c') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL client set its own verify_level';
  END IF;
  UPDATE public.live_checkins SET verify_level = 2 WHERE user_id = '33333333-0000-0000-0000-00000000000c';
  IF (SELECT verify_level FROM public.live_checkins WHERE user_id = '33333333-0000-0000-0000-00000000000c') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL client upgraded its own verify_level';
  END IF;
  RAISE NOTICE 'OK  phones cannot set verify_level';
END $$;

-- 6. Guessing is capped at 10 tries per 10 minutes ────────────────────────────
DO $$
DECLARE r jsonb; i int;
BEGIN
  FOR i IN 1..10 LOOP
    PERFORM public.touch_down_with_code('eeeeeeee-0000-0000-0000-00000000000e', '000000');
  END LOOP;
  -- Even the right code is now refused for this person.
  r := public.touch_down_with_code('eeeeeeee-0000-0000-0000-00000000000e', current_setting('test.code'));
  IF r->>'reason' <> 'too_many_attempts' THEN RAISE EXCEPTION 'FAIL no rate limit: %', r; END IF;
  RAISE NOTICE 'OK  guessing capped at 10 attempts';
END $$;

RESET ROLE;
ROLLBACK;
