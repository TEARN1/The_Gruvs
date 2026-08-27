-- ═══════════════════════════════════════════════════════════════════════════
-- definer_rpc_hardening.sql — close four SECURITY DEFINER RPCs that were
-- granted to every signed-in user with NO caller authorization check.
--
-- SECURITY DEFINER runs as the function owner and BYPASSES RLS. Granting such a
-- function to `authenticated` while it takes a target-user / target-row argument
-- and never consults auth.uid() hands every signed-in user the owner's
-- privileges over any row they can name. Row ids are visible all over the app.
--
--   increment_wallet_balance(p_user_id, p_amount)
--       → mint yourself money: rpc(p_user_id: me, p_amount: 1000000)
--       → or drain someone else's wallet with a negative amount
--   update_sis_score(p_user_id, p_delta)
--       → move anyone's trust score; also defeats the
--         protect_profile_trust_columns trigger, which pins that exact column
--         against direct client writes
--   soft_delete(p_table, p_id)
--       → UPDATE public.<any table> SET deleted_at = now() WHERE id = <any row>
--       → delete anyone's event, reel, booking, message…
--   restore_deleted(p_table, p_id)
--       → un-delete anything, including content its owner deleted on purpose
--
-- (The dynamic SQL in soft_delete/restore_deleted uses format('%I'), so the
-- table name is correctly quoted — there is no SQL injection. The problem is
-- purely the missing authorization.)
--
-- Client-caller survey before writing this (see SECURITY-AUDIT.md #22):
--   soft_delete             — 0 client callers
--   restore_deleted         — 0 callers anywhere
--   update_sis_score        — 1 caller, already broken (arg-name mismatch)
--   increment_wallet_balance— 1 caller, already broken (arg-name mismatch)
-- So revoking these from `authenticated` breaks nothing that currently works.
--
-- Idempotent. Safe to re-run.
-- Deploy: paste into the Supabase SQL editor, or psql -f against the project.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Revoke the four from client roles ────────────────────────────────────
-- They keep working for service_role and for other SECURITY DEFINER functions
-- (which execute as their owner, not as the caller), so server-side use is
-- unaffected. Guarded so this runs cleanly on a DB missing any of them.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid)) AS sig,
           p.proname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('increment_wallet_balance','update_sis_score',
                         'soft_delete','restore_deleted')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public, anon, authenticated', r.sig);
    RAISE NOTICE 'revoked client access to %', r.sig;
  END LOOP;
END $$;

-- ── 2. A real escrow release, server-adjudicated ────────────────────────────
-- Replaces the client-side dance in EscrowService.releaseToProvider, which:
--   • called increment_wallet_balance with the wrong argument names, so tier 1
--     never resolved (PGRST202), and
--   • fell back to profiles.update({wallet_balance}) on the PROVIDER's row —
--     blocked by profiles_update_own (id = auth.uid()), because the payer is the
--     one releasing.
-- Net effect today: the booking flips to 'completed' and the provider is never
-- actually paid. This makes the whole thing one authorized, atomic statement.
--
-- Authorization: only the CLIENT (payer) may release — that is what the UI does
-- ("I received it → release the funds"). The provider must not be able to pay
-- themselves out of escrow.
CREATE OR REPLACE FUNCTION public.release_escrow_to_provider(p_booking_id UUID)
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

  -- Lock the row so two concurrent releases cannot both pay out.
  SELECT * INTO b
    FROM public.service_bookings
   WHERE id = p_booking_id
   FOR UPDATE;

  IF b.id IS NULL THEN
    RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002';
  END IF;

  -- The payer releases. Not the provider, not a third party.
  IF b.client_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'only the client who paid may release this escrow'
      USING ERRCODE = '42501';
  END IF;

  -- Single-use: only funds still held can be released.
  IF b.status IS DISTINCT FROM 'escrow_held' THEN
    RAISE EXCEPTION 'booking is % — only escrow_held funds can be released', b.status
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.service_bookings
     SET status = 'completed', completed_at = now()
   WHERE id = b.id;

  UPDATE public.profiles
     SET wallet_balance = COALESCE(wallet_balance, 0) + (COALESCE(b.amount_cents, 0) / 100.0)
   WHERE id = b.provider_id;

  RETURN QUERY SELECT b.id, b.provider_id, b.amount_cents;
END;
$$;

REVOKE ALL     ON FUNCTION public.release_escrow_to_provider(UUID) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.release_escrow_to_provider(UUID) TO authenticated;

-- ── 3. Verify ───────────────────────────────────────────────────────────────
-- Should return zero rows. Any row here is a SECURITY DEFINER function still
-- executable by a client role without checking the caller.
--
--   SELECT p.proname,
--          pg_get_function_identity_arguments(p.oid) AS args
--     FROM pg_proc p
--     JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public'
--      AND p.prosecdef
--      AND p.prosrc !~ 'auth\.uid'
--      AND (has_function_privilege('authenticated', p.oid, 'EXECUTE')
--        OR has_function_privilege('anon',          p.oid, 'EXECUTE'))
--      AND p.proname IN ('increment_wallet_balance','update_sis_score',
--                        'soft_delete','restore_deleted');



-- ═══════════════════════════════════════════════════════════════════════════
-- 4. 🔴 CRITICAL — protect_profile_trust_columns() never fired. Fix + extend.
--
-- schema_part_4.sql added this BEFORE UPDATE trigger on profiles specifically to
-- stop "a signed-in user could update({ role:'admin', is_verified:true }) on
-- their OWN row and become an admin". Its guard is:
--
--     IF current_user NOT IN ('authenticated', 'anon') THEN
--       RETURN NEW;   -- trusted server path — allow
--     END IF;
--
-- but the function is declared SECURITY DEFINER, and inside a SECURITY DEFINER
-- function `current_user` is the function OWNER, not the caller. It returns
-- `postgres`. So the condition is ALWAYS true, the function always returns NEW
-- unmodified, and the trigger has never pinned a single column.
--
-- Verified on a local Postgres against the trigger exactly as shipped — an
-- ordinary `authenticated` session ran:
--
--     UPDATE profiles SET role='admin', is_verified=true,
--                         social_integrity_score=100
--      WHERE id = <their own id>;
--
--   → username | role  | is_verified | social_integrity_score
--     attacker | admin | t           | 100
--
-- profiles_update_own allows a user to update their own row, is_admin() reads
-- profiles.role = 'admin', and the admin RLS policies across schema_part_1/3/4
-- plus the God View gate all key off it. So this is full admin takeover from any
-- account, plus a self-granted verified badge and a maxed trust score.
--
-- FIX: declare the function SECURITY INVOKER so `current_user` is the actual
-- caller. This needs no privileges — the body only reassigns fields on NEW and
-- touches no tables. A SECURITY DEFINER RPC still passes through, because inside
-- one `current_user` is that RPC's owner, which is not 'authenticated'/'anon'.
--
-- Also extends the pinned set with wallet_balance. schema_part_4's own comment
-- said that was the next step "but first route their few remaining direct client
-- updates through the existing SECURITY DEFINER RPCs" — for wallet_balance that
-- prerequisite is now met: the one direct client write
-- (EscrowService.releaseToProvider's fallback) is gone, replaced by
-- release_escrow_to_provider() above.
--
-- Deliberately NOT pinned yet: vibe_score, vibe_coins, vibe_equity. Those still
-- have live direct client writers (dataFlow.js LevelManager, vibeEquityLedger.js).
-- Pinning them before those are routed through RPCs would make every mint and
-- recompute silently no-op — the exact failure the original comment warns about.
-- Route them first, then add them here.
--
-- Verified after the fix: the escalation above is fully reverted; the escrow RPC
-- still credits the provider; ordinary profile edits (username, bio…) still work.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.protect_profile_trust_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  -- SECURITY INVOKER is load-bearing: under SECURITY DEFINER this reads
  -- `postgres` and the guard never engages. Do not add SECURITY DEFINER here.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW; -- trusted server path (definer RPCs / admin) — allow
  END IF;
  -- Direct update by the signed-in user: pin trust columns to their old values.
  NEW.role                   := OLD.role;
  NEW.is_verified            := OLD.is_verified;
  NEW.social_integrity_score := OLD.social_integrity_score;
  NEW.wallet_balance         := OLD.wallet_balance;   -- money is server-adjudicated
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_trust_columns_trigger ON public.profiles;
CREATE TRIGGER protect_profile_trust_columns_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_trust_columns();
