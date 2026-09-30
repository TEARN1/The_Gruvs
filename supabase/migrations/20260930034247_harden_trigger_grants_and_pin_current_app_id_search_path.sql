-- Security hardening from the 2026-09-30 advisor audit.
-- Two findings, both safe to fix with no functional impact.
--
-- Applied to the live project on 2026-09-30 and recorded in
-- supabase_migrations.schema_migrations as version 20260930034247.
-- This file is the version-controlled copy; the filename intentionally matches
-- that remote version so local and remote history agree.

-- 1. function_search_path_mutable: public.current_app_id() had no pinned
--    search_path. It is called inside the public_profiles view, so a mutable
--    search_path there is a real resolution-hijack surface. It only calls
--    current_setting() (pg_catalog), so pinning changes no behaviour.
ALTER FUNCTION public.current_app_id() SET search_path = public, pg_temp;

-- 2. anon/authenticated_security_definer_function_executable: EXECUTE was
--    granted to PUBLIC/anon/authenticated on trigger functions. Trigger
--    functions must never be directly callable. Revoking EXECUTE does NOT
--    affect trigger firing -- the trigger mechanism does not check EXECUTE
--    privilege on the function -- so this is pure defence in depth.
--    Extension-owned functions (PostGIS: checkauthtrigger, postgis_cache_bbox)
--    are excluded; they are not ours to alter.
DO $$
DECLARE
    r record;
    n integer := 0;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        JOIN pg_namespace ns ON ns.oid = p.pronamespace
        WHERE ns.nspname = 'public'
          AND p.prorettype = 'trigger'::regtype
          AND NOT EXISTS (
              SELECT 1 FROM pg_depend d
              WHERE d.objid = p.oid AND d.deptype = 'e'
          )
    LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
        n := n + 1;
    END LOOP;
    RAISE NOTICE 'revoked EXECUTE on % trigger functions', n;
END $$;
