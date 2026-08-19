-- ═══════════════════════════════════════════════════════════════════════════
-- lock_pii_regrant_combined.sql — close the cross-user PII hole FOR GOOD.
--
-- FOUND 2026-08-14 by a deep live-DB audit (has_column_privilege, not guesswork):
-- ANY signed-in user can currently read EVERY other user's
--     email, push_token, phone, emergency_contacts, siblings
-- on public.profiles. This is exactly the hole lock_authenticated_pii.sql
-- calls "the #1 remaining security hole" — its PART 1 (get_my_profile) IS live,
-- but its PART 2 (the revoke) is NOT in effect.
--
-- ── WHY IT ISN'T IN EFFECT, AND WHY A BARE "PART 2" WOULD NOT HOLD ──────────
-- Three files regrant SELECT on profiles, and TWO of them rebuild the grant as
-- "every column EXCEPT the 4 coordinate ones":
--     lock_profile_coordinates.sql   (excludes coords only)
--     home_area.sql                  (excludes coords only)
--     regrant_profile_columns.sql    (excludes coords only)
-- Postgres cannot revoke a column subset from a table-level grant, so each of
-- these does `REVOKE SELECT ON profiles` then re-GRANTs an explicit list. Any
-- one of them therefore silently UNDOES lock_authenticated_pii PART 2.
--
-- profiles.wants_email is readable today, which proves regrant_profile_columns
-- .sql has been run — so PART 2 was either never applied, or applied and then
-- clobbered. Re-running PART 2 alone would just re-arm the same trap.
--
-- THE FIX: one regrant that excludes BOTH lists, rebuilt from
-- information_schema so newly added columns are picked up on every run. The two
-- trap files have been updated in the same commit to share this exclusion set,
-- so re-running any of them can no longer re-expose PII.
--
-- ── WHY THESE 5 COLUMNS, AND NOT MORE ───────────────────────────────────────
-- Deliberately a DENY-list, not an allow-list. Several "personal" columns ARE
-- legitimately read cross-user by real features and must stay readable:
--     first_name / surname / clan_name -> family-tree + invite-by-name search
--     birth_date                       -> birthday spotlight + badge
--     city                             -> proximity / nearby
-- Revoking those would break the product. Only columns never legitimately read
-- for ANOTHER user are denied.
--
-- ── VERIFIED SAFE AGAINST THE LIVE CLIENT BEFORE WRITING THIS ───────────────
-- Every client read of a denied column was enumerated. There are exactly three,
-- and none of them is a cross-user SELECT:
--   * AuthContext.js:35     -> rpc('get_my_profile') first; the PROFILE_FIELDS
--                              select is an own-row fallback (.eq('id', userId))
--   * ProfilePage.js:327    -> same RPC-first pattern; own-row fallback only
--   * SettingsScreen.js:221 -> UPDATE push_token (not a SELECT)
--   * notificationService.js:171 -> UPDATE push_token (not a SELECT)
-- Only SELECT is revoked, so both UPDATE paths keep working, and the RPC keeps
-- returning the caller their own complete row. Server-side push delivery uses
-- service_role, which column grants do not gate.
--
-- Idempotent. Safe to re-run. Coordinates stay revoked throughout.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  safe_cols text;
  -- Never client-readable, not even for your own row: the RPC serves those.
  coord_cols text[] := ARRAY['lat', 'lon', 'home_base_lat', 'home_base_lon'];
  -- Never legitimately read for ANOTHER user; a stranger reading these is the
  -- actual harm. Own-row access goes through get_my_profile().
  pii_cols   text[] := ARRAY['email', 'push_token', 'phone',
                             'emergency_contacts', 'siblings'];
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO safe_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'profiles'
    AND NOT (column_name = ANY(coord_cols))
    AND NOT (column_name = ANY(pii_cols));

  -- A table-wide grant supersedes column grants, so it must go first.
  EXECUTE 'revoke select on public.profiles from authenticated';
  EXECUTE format('grant select (%s) on public.profiles to authenticated', safe_cols);
END $$;

-- ── Verify (want: all false for authenticated) ──────────────────────────────
-- select c as column_name,
--        has_column_privilege('authenticated','public.profiles',c,'SELECT') as readable
-- from unnest(ARRAY['email','push_token','phone','emergency_contacts','siblings',
--                   'lat','lon','home_base_lat','home_base_lon']) as c;
--
-- And these must stay TRUE (the features that need them):
-- select c, has_column_privilege('authenticated','public.profiles',c,'SELECT')
-- from unnest(ARRAY['username','first_name','surname','clan_name','birth_date','city']) as c;
