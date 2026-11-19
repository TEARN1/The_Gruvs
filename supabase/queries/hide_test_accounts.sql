-- Test accounts (CI health check + seed runs) showed up to real users in
-- Find Vibers, Suggested for you and following lists. Put them in the app's
-- existing "celebrity" privacy mode with no beacon — applyProfilePrivacy
-- drops those from every people list — and make them undiscoverable. Their
-- logins keep working, so the health checks are unaffected. Then remove
-- real users' follows of them. Idempotent; re-run after a new test account.

WITH test_accounts AS (
  SELECT id FROM public.profiles
  WHERE username ~* '(^test_seed_|e2e)' OR display_name ~* '(^test_seed_|\.e2e\.)'
)
UPDATE public.profiles p
SET identity_mode = 'celebrity', is_beacon_active = false, is_discoverable = false
FROM test_accounts t
WHERE p.id = t.id;

DELETE FROM public.follows f
WHERE f.following_id IN (
  SELECT id FROM public.profiles
  WHERE username ~* '(^test_seed_|e2e)' OR display_name ~* '(^test_seed_|\.e2e\.)'
);
