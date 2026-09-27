-- ═══════════════════════════════════════════════════════════════════════════
--  Revoke client access to SECURITY DEFINER functions the app never calls.
--
--  Found by scripts/audit-unused-functions.mjs. Each was executable by anon
--  AND authenticated (Postgres grants EXECUTE to PUBLIC by default):
--
--    get_unread_notification_count(p_user_id)  any user's unread count, by id,
--                                              even logged out
--    get_event_engagement(p_event_id)          RSVP/vibe counts for any event,
--                                              private ones included
--    purge_expired_checkins()                  a logged-out caller can trigger
--                                              deletes (expired rows only)
--    safe_insert_chat_message(...)             guarded on auth.uid(), but a
--                                              second, unused write path into
--                                              event chat that skips whatever
--                                              the app's real path enforces
--
--  REVOKE, not DROP: nothing is lost, and pg_cron / the service role (which
--  own or bypass these grants) keep working. If the app ever needs one,
--  GRANT it back in a new migration together with the caller check it needs.
--
--  set_user_role is also unused by the app but is left alone: it is guarded by
--  assert_admin() and is the admin path for role changes.
--
--  Idempotent. Skips functions this database doesn't have.
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('get_unread_notification_count', 'get_event_engagement',
                         'purge_expired_checkins', 'safe_insert_chat_message')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM public, anon, authenticated', f.sig);
    RAISE NOTICE 'revoked client EXECUTE on %', f.sig;
  END LOOP;
END $$;
