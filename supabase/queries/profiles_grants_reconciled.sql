-- ═══════════════════════════════════════════════════════════════════════════
-- profiles_grants_reconciled.sql — the ONE authoritative profiles.SELECT grant.
--
-- Found 2026-08-18 during Phase-0 CI catch-up: lock_profile_coordinates.sql,
-- lock_authenticated_pii.sql (PART 2), and regrant_profile_columns.sql each
-- independently do "REVOKE SELECT on profiles FROM authenticated, then
-- re-GRANT a safe column list" — but the three lists don't compose. Whichever
-- ran LAST wins, and none of them is the union of what should be denied.
--
-- Confirmed on live production before this was written: coordinates were
-- correctly locked (lock_profile_coordinates/regrant_profile_columns had run
-- last), but email/push_token/phone/emergency_contacts/siblings were
-- readable by ANY signed-in user cross-profile — the exact hole
-- lock_authenticated_pii.sql was written to close, silently re-opened by a
-- later regrant that didn't know that deny-list existed. Fixed live via this
-- exact statement 2026-08-18 (see RISK_REGISTER.md), verified against
-- information_schema.column_privileges before and after.
--
-- THIS FILE SUPERSEDES the regrant logic in all three files above. Re-run
-- THIS one (not them) any time a `profiles` column is added — it rebuilds
-- the full deny-list from information_schema every time, so it can never
-- forget either half again. lock_profile_coordinates.sql and
-- lock_authenticated_pii.sql still carry the correct REASONING and the
-- other objects they create (profiles_within_radius(), get_my_profile()) —
-- only their inline revoke/regrant DO blocks are superseded by this file.
--
-- Preconditions (checked once, hold permanently): get_my_profile() exists
-- (from lock_authenticated_pii.sql PART 1); the client is RPC-first with a
-- self-only (`eq('id', user.id)`) fallback in AuthContext.js and
-- ProfilePage.js — so revoking cross-user PII never breaks reading your own
-- profile. Idempotent — safe to run any number of times, in any position
-- after profiles exists.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  safe_cols text;
  -- The UNION of every column any prior lockdown file decided was unsafe for
  -- cross-user reads. Add to this list, never remove from it without the
  -- same reasoning pass those files did.
  deny_cols text[] := array[
    'lat', 'lon', 'home_base_lat', 'home_base_lon',              -- lock_profile_coordinates.sql
    'email', 'push_token', 'phone', 'emergency_contacts', 'siblings'  -- lock_authenticated_pii.sql PART 2
  ];
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into safe_cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and column_name <> all(deny_cols);

  execute 'revoke select on public.profiles from authenticated';
  execute format('grant select (%s) on public.profiles to authenticated', safe_cols);
end $$;

-- Verify (should return 0 rows — none of these 9 columns readable cross-user):
-- select column_name from information_schema.column_privileges
-- where table_name='profiles' and grantee='authenticated'
--   and column_name in ('lat','lon','home_base_lat','home_base_lon',
--                        'email','push_token','phone','emergency_contacts','siblings');
