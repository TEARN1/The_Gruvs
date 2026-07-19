-- regrant_profile_columns.sql — RE-RUN AFTER ADDING ANY `profiles` COLUMN.
--
-- lock_profile_coordinates.sql revoked the table-level SELECT grant on
-- `profiles` and re-granted an explicit safe column list (everything except
-- lat / lon / home_base_lat / home_base_lon). That has a sharp edge documented
-- there: **a column added afterwards is NOT readable until this is re-run.**
--
-- `wants_email` was added after that lockdown (POPIA s.11(2) withdrawable
-- marketing consent), so it is currently unreadable by `authenticated` — the
-- Settings toggle can't reflect the user's real choice. This regrants the safe
-- list including it.
--
-- Idempotent: rebuilds the list from information_schema every run, so it also
-- picks up any other column added since. Coordinates stay revoked.

do $$
declare safe_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into safe_cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and column_name not in ('lat', 'lon', 'home_base_lat', 'home_base_lon');

  execute 'revoke select on public.profiles from authenticated';
  execute format('grant select (%s) on public.profiles to authenticated', safe_cols);
end $$;

-- Verify: should return 0 rows (no coordinate column is readable).
-- select column_name from information_schema.column_privileges
-- where table_name='profiles' and grantee='authenticated'
--   and column_name in ('lat','lon','home_base_lat','home_base_lon');

-- AFTER running this, `wants_email` can safely be added to
-- AuthContext.PROFILE_FIELDS so the Settings toggle reads the stored value
-- directly (the guarded per-screen query in SettingsScreen can then be dropped).
