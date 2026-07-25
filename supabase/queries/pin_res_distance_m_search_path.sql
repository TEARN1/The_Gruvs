-- ═══════════════════════════════════════════════════════════════════════════
-- pin_res_distance_m_search_path.sql — clear the last search_path advisor.
--
-- Supabase's security advisor flagged public.res_distance_m as having a
-- role-mutable search_path (function_search_path_mutable). The function is
-- SECURITY INVOKER pure-math haversine (no table access, only pg_catalog math),
-- so the practical risk is low — but a pinned search_path is the correct
-- hardening and removes the warning. `SET search_path = ''` is safe here:
-- pg_catalog stays implicitly resolvable for radians/sin/cos/etc.
--
-- Applied live 2026-07-25. Idempotent CREATE OR REPLACE.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.res_distance_m(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $function$
  select 6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)
  ));
$function$;
