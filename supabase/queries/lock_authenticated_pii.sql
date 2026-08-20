-- ═══════════════════════════════════════════════════════════════════════════
-- lock_authenticated_pii.sql — close the #1 remaining security hole.
--
-- ⚠️  2026-08-18: PART 2's REVOKE/re-GRANT block is SUPERSEDED by
-- ⚠️  profiles_grants_reconciled.sql — this file's regrant doesn't exclude
-- ⚠️  coordinates, so running it alone after lock_profile_coordinates.sql
-- ⚠️  RE-EXPOSES lat/lon. This exact composition bug caused a real live PII
-- ⚠️  leak (email/push_token/phone/emergency_contacts/siblings readable
-- ⚠️  cross-user) found and fixed 2026-08-18 — see RISK_REGISTER.md. PART 1
-- ⚠️  (get_my_profile) is still current and required; run
-- ⚠️  profiles_grants_reconciled.sql for the grant, not PART 2 below.
--
-- Today: anon is fully walled off from profiles (2026-06 column allowlist), BUT
-- any SIGNED-IN user can still `select email, push_token, phone, first_name,
-- surname ...` on ANY other user's profile row. The between-users wall is down.
--
-- Why it was left: the app reads a FEW sensitive columns for the CURRENT user
-- (AuthContext reads `push_token`; dataFlow reads `first_name, surname,
-- clan_name`). A blanket revoke would break the user reading their OWN profile.
-- The fix is a self-only RPC + a narrowed column grant.
--
-- ┌─ ORDER OF OPERATIONS (do NOT reorder — each step is safe on its own) ─────┐
-- │ 1. Run PART 1 (get_my_profile). Safe immediately — adds a function.       │
-- │ 2. Ship the client that reads its own profile via get_my_profile          │
-- │    (RPC-first, falls back to the direct select — so it works before OR    │
-- │    after this runs).                                                       │
-- │ 3. THEN run PART 2 (the revoke). Now cross-user PII is dead, and the       │
-- │    current user still gets everything through the RPC.                     │
-- │ 4. Verify (PART 3).                                                        │
-- └───────────────────────────────────────────────────────────────────────────┘
-- ═══════════════════════════════════════════════════════════════════════════


-- ── PART 1 — self-only profile read (safe to run now) ───────────────────────
-- Returns the caller's OWN full row and nothing else. SECURITY DEFINER so it
-- can read columns that `authenticated` will soon be revoked from, but the
-- WHERE id = auth.uid() makes it impossible to read anyone else.
create or replace function public.get_my_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles where id = auth.uid();
$$;

revoke execute on function public.get_my_profile() from public, anon;
grant  execute on function public.get_my_profile() to authenticated;


-- ── PART 2 — lock the hard-PII columns from cross-user reads ────────────────
-- Run ONLY after the client (step 2 above) is live. This is a precise DENY-LIST,
-- not a blanket allow-list, on purpose: several "personal" columns are read
-- cross-user by REAL features and must NOT be revoked —
--   • first_name / surname / clan_name  -> the family-tree / invite-by-name search
--   • birth_date                        -> birthday spotlight + "birthday today" badge
--   • lat / lon / city                  -> proximity / nearby
-- Revoking those would break the product. So we revoke ONLY the columns that are
-- pure PII and NEVER legitimately read for another user. Idempotent.
do $$
declare
  c text;
  -- Never needed cross-user; a stranger reading these is the real harm.
  deny_cols text[] := array[
    'email', 'push_token', 'phone', 'emergency_contacts', 'siblings'
  ];
begin
  -- A table-wide grant supersedes column grants, so drop it, then grant back
  -- every column EXCEPT the deny-list.
  execute 'revoke select on public.profiles from authenticated';
  for c in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name <> all(deny_cols)
  loop
    execute format('grant select (%I) on public.profiles to authenticated', c);
  end loop;
end $$;

-- FOLLOW-UP (separate, considered pass — NOT here): birth_date leaks the birth
-- YEAR cross-user even though signup promises "your year stays private", and raw
-- lat/lon cross-user is a location/stalking vector. Closing those properly needs
-- product changes (expose only day/month; a count_nearby RPC instead of raw
-- coordinates), so they are deliberately left readable for now rather than
-- silently breaking birthday/proximity.


-- ── PART 3 — verify ─────────────────────────────────────────────────────────
-- As an AUTHENTICATED user (not the owner), these must now FAIL / return nothing:
--   select email, push_token, first_name from profiles where id <> auth.uid();
-- And the current user must still get everything:
--   select * from get_my_profile();
--
--   -- which sensitive columns remain readable by `authenticated`? (want: none)
--   select column_name
--   from information_schema.role_column_grants
--   where table_name='profiles' and grantee='authenticated'
--     and column_name in ('email','push_token','phone','first_name','surname',
--                          'clan_name','emergency_contacts','birth_date','birth_year');
