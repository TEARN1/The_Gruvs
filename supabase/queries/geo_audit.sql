-- geo_audit.sql — health of the events geo/address pipeline (read-only audit).
--
-- Findings (2026-07-28, 68 live events):
--   • 55/68 have lat/lon.
--   • latitude/longitude columns hold 0 rows — a DEAD duplicate of lat/lon.
--     The client already reads (lat ?? latitude), so these can be dropped in a
--     future migration once nothing references them. Not dropped yet (caution).
--   • 13 events have a real address but no coords → invisible on the map.
--     Fix: scripts/backfill-geocodes.mjs (geocodes address → lat/lon).
--   • New events geocode on post via services/geocoding.js, so the backlog is
--     one-time.
--
-- Ride-hailing readiness note: Nominatim (free, ~1 req/s) is fine for posting
-- and occasional lookups, NOT for live pickup/dropoff at scale — swap the
-- provider in services/geocoding.js (the single seam) when that app lands.

-- Coverage summary
select
  count(*) as total,
  count(*) filter (where lat is not null and lon is not null) as has_latlon,
  count(*) filter (where latitude is not null and longitude is not null) as has_latitude_dead_col,
  count(*) filter (where (lat is null or lon is null) and address is not null and length(trim(address)) > 3) as backfillable,
  count(*) filter (where lat is null and lon is null and (address is null or length(trim(address)) <= 3)) as unfixable_no_address
from public.events
where deleted_at is null;

-- The exact events needing a backfill (what the script targets)
select id, title, address, city
from public.events
where deleted_at is null and (lat is null or lon is null)
  and address is not null and length(trim(address)) > 3
order by created_at desc;

-- Null-island / out-of-range sanity check (should return 0)
select id, title, lat, lon
from public.events
where deleted_at is null and lat is not null and lon is not null
  and (lat < -90 or lat > 90 or lon < -180 or lon > 180
       or (abs(lat) < 0.01 and abs(lon) < 0.01));
