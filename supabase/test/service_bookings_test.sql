-- ══════════════════════════════════════════════════════════════════════════════
--  service_bookings_test.sql — proves money cannot be created from nothing and
--  bookings/disputes/ledger rows cannot be written directly by clients.
--  See supabase/migrations/20260927000900_service_bookings_integrity.sql for the why.
--
--  Runs as the real `authenticated` role with auth.uid() pointed at a session
--  setting, inside a transaction that is rolled back. Leaves nothing behind.
-- ══════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
BEGIN;

-- auth.uid() from a session setting, like Supabase does from the JWT.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;

-- Fixture: client C, provider P, P's listing N.
-- replica mode: skip signup triggers/FKs while planting the fixture only.
SET LOCAL session_replication_role = replica;
INSERT INTO auth.users (id) VALUES ('c0000000-0000-0000-0000-00000000000c'), ('b0000000-0000-0000-0000-00000000000b');
DO $$
DECLARE cols text; vals text;
BEGIN
  -- profiles may carry NOT NULL columns this test doesn't know about; fill them.
  SELECT string_agg(quote_ident(column_name), ','), string_agg(
           CASE WHEN data_type IN ('text','character varying') THEN quote_literal('x')
                WHEN data_type IN ('integer','bigint','numeric','smallint','double precision','real') THEN '0'
                WHEN data_type = 'boolean' THEN 'false'
                WHEN data_type LIKE 'timestamp%' THEN 'now()'
                ELSE 'NULL' END, ',')
    INTO cols, vals
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='profiles' AND is_nullable='NO'
     AND column_default IS NULL AND column_name NOT IN ('id','username');
  EXECUTE format('INSERT INTO public.profiles (id, username%s) VALUES (%L, %L%s), (%L, %L%s)',
    COALESCE(','||cols,''), 'c0000000-0000-0000-0000-00000000000c','t_client', COALESCE(','||vals,''),
                            'b0000000-0000-0000-0000-00000000000b','t_prov',   COALESCE(','||vals,''));
END $$;
INSERT INTO public.service_nodes (id, user_id, title, is_active)
VALUES ('a0000000-0000-0000-0000-00000000000a','b0000000-0000-0000-0000-00000000000b','Test van', true);
SET LOCAL session_replication_role = origin;

-- Supabase grants ALL on public tables to anon/authenticated by default. Model
-- that, then re-apply the migration (idempotent), so every refusal below is
-- proven to come from the migration and not from a bare local database.
GRANT ALL ON public.service_bookings, public.disputes, public.wallet_transactions TO anon, authenticated;
\i supabase/migrations/20260927000900_service_bookings_integrity.sql

SET LOCAL ROLE authenticated;

-- 1. A client cannot insert a booking directly (old path) ─────────────────────
SET LOCAL test.uid = 'c0000000-0000-0000-0000-00000000000c';
DO $$
BEGIN
  BEGIN
    INSERT INTO public.service_bookings (service_node_id, client_id, provider_id, status, amount_cents)
    VALUES ('a0000000-0000-0000-0000-00000000000a','c0000000-0000-0000-0000-00000000000c',
            'b0000000-0000-0000-0000-00000000000b','escrow_held', 99999999);
    RAISE EXCEPTION 'FAIL direct INSERT into service_bookings was allowed';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  direct booking insert refused';
  END;
END $$;

-- 2. A client cannot forge ledger rows ────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    INSERT INTO public.wallet_transactions (user_id, amount, type)
    VALUES ('c0000000-0000-0000-0000-00000000000c', 1000, 'credit');
    RAISE EXCEPTION 'FAIL client inserted a wallet_transactions row';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  ledger insert refused';
  END;
END $$;

-- 3. The provider cannot book their own listing ───────────────────────────────
SET LOCAL test.uid = 'b0000000-0000-0000-0000-00000000000b';
DO $$
BEGIN
  BEGIN
    PERFORM public.create_service_booking('a0000000-0000-0000-0000-00000000000a', 5000);
    RAISE EXCEPTION 'FAIL provider booked own service';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  self-booking refused';
  END;
END $$;

-- 4. Unfunded booking → release completes but mints NO balance ────────────────
SET LOCAL test.uid = 'c0000000-0000-0000-0000-00000000000c';
DO $$
DECLARE v_id uuid; v_bal numeric; v_prov uuid;
BEGIN
  v_id := public.create_service_booking('a0000000-0000-0000-0000-00000000000a', 99999999);
  SELECT provider_id INTO v_prov FROM public.service_bookings WHERE id = v_id;
  IF v_prov <> 'b0000000-0000-0000-0000-00000000000b' THEN
    RAISE EXCEPTION 'FAIL provider not taken from listing';
  END IF;
  PERFORM public.release_escrow_to_provider(v_id);
  PERFORM set_config('test.booking', v_id::text, true);
END $$;
RESET ROLE;
DO $$
DECLARE v_bal numeric; v_status text; n int;
BEGIN
  SELECT COALESCE(wallet_balance,0) INTO v_bal FROM public.profiles WHERE id='b0000000-0000-0000-0000-00000000000b';
  SELECT status INTO v_status FROM public.service_bookings WHERE id = current_setting('test.booking')::uuid;
  SELECT count(*) INTO n FROM public.wallet_transactions WHERE user_id='b0000000-0000-0000-0000-00000000000b';
  IF v_bal <> 0 OR n <> 0 THEN RAISE EXCEPTION 'FAIL unfunded release minted balance (%, % rows)', v_bal, n; END IF;
  IF v_status <> 'completed' THEN RAISE EXCEPTION 'FAIL booking not completed (%)', v_status; END IF;
  RAISE NOTICE 'OK  unfunded release completes without minting balance';
END $$;

-- 5. Captured booking → release credits provider once, with a ledger row ─────
SET LOCAL ROLE authenticated;
SET LOCAL test.uid = 'c0000000-0000-0000-0000-00000000000c';
DO $$
BEGIN
  PERFORM set_config('test.booking2',
    public.create_service_booking('a0000000-0000-0000-0000-00000000000a', 25000)::text, true);
END $$;
RESET ROLE;
-- Only service_role (payment webhook) marks captured.
UPDATE public.service_bookings SET payment_status = 'captured'
 WHERE id = current_setting('test.booking2')::uuid;
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM public.release_escrow_to_provider(current_setting('test.booking2')::uuid);
  BEGIN
    PERFORM public.release_escrow_to_provider(current_setting('test.booking2')::uuid);
    RAISE EXCEPTION 'FAIL second release allowed';
  EXCEPTION WHEN invalid_parameter_value THEN RAISE NOTICE 'OK  double release refused';
  END;
END $$;
RESET ROLE;
DO $$
DECLARE v_bal numeric; n int;
BEGIN
  SELECT COALESCE(wallet_balance,0) INTO v_bal FROM public.profiles WHERE id='b0000000-0000-0000-0000-00000000000b';
  SELECT count(*) INTO n FROM public.wallet_transactions WHERE user_id='b0000000-0000-0000-0000-00000000000b' AND type='release';
  IF v_bal <> 250 OR n <> 1 THEN RAISE EXCEPTION 'FAIL captured release: balance %, ledger rows %', v_bal, n; END IF;
  RAISE NOTICE 'OK  captured release credits once with a ledger row';
END $$;

-- 6. Disputes: parties only, via RPC ──────────────────────────────────────────
SET LOCAL ROLE authenticated;
SET LOCAL test.uid = 'c0000000-0000-0000-0000-00000000000c';
DO $$
DECLARE v_id uuid;
BEGIN
  v_id := public.create_service_booking('a0000000-0000-0000-0000-00000000000a', 1000);
  PERFORM set_config('test.uid', 'd0000000-0000-0000-0000-00000000000d', true);  -- outsider
  BEGIN
    PERFORM public.open_dispute(v_id, 'not mine');
    RAISE EXCEPTION 'FAIL outsider opened a dispute';
  EXCEPTION WHEN no_data_found THEN RAISE NOTICE 'OK  outsider dispute refused';
  END;
  PERFORM set_config('test.uid', 'b0000000-0000-0000-0000-00000000000b', true);  -- provider
  PERFORM public.open_dispute(v_id, 'client no-show');
  IF (SELECT status FROM public.service_bookings WHERE id = v_id) <> 'disputed' THEN
    RAISE EXCEPTION 'FAIL dispute did not mark booking disputed';
  END IF;
  RAISE NOTICE 'OK  party can open a dispute';
END $$;

RESET ROLE;
ROLLBACK;
