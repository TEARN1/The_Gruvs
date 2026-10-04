-- Security check 2026-10-04 (APP_AUDIT.md). Part 1 of 3. Applied to the live
-- project as version 20261004062609; this filename matches that version.
--
-- These SECURITY DEFINER functions accept a user id and never check the
-- caller, letting any signed-in user forge wallet balances, trust scores, XP,
-- escrow releases, tickets and bids, or act on another user's notifications
-- and feed. None is called by the app with working arguments and none is
-- called by an invoker-rights function; definer callers are unaffected.
SET LOCAL lock_timeout = '5s';
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN (
        'increment_wallet_balance', 'update_sis_score', 'verify_pop',
        'release_escrow', 'purchase_tickets', 'place_bid',
        'increment_vibe', 'decrement_vibe', 'mark_notifications_read',
        'get_unread_notification_count', 'feed_for_user')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;
