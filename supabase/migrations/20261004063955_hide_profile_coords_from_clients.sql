-- Security check 2026-10-04 (APP_AUDIT.md). Part 3 of 3. Applied to the live
-- project as version 20261004063955; this filename matches that version.
--
-- profiles.coords is a geography at millimetre precision. SELECT was granted to
-- every signed-in user despite the earlier lock_profile_coordinates migration.
-- The client never selects it; definer functions that use it are unaffected.
SET LOCAL lock_timeout = '5s';
REVOKE SELECT (coords) ON public.profiles FROM anon, authenticated;
