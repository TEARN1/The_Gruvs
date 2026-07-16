-- checkin_verification.sql — server-side Touch Down verification.
--
-- The client already rejects a check-in that's verifiably far from the venue
-- (utils/checkinGuard). But a client is bypassable: anyone can POST to the REST
-- API directly and set whatever they like. Touch Down is the metric the whole
-- Truth Protocol rests on, so the SERVER must decide whether a check-in counts
-- as VERIFIED presence — the client can't be trusted to.
--
-- Design (mirrors the client + the app's safety principles):
--   • `verified` is computed server-side from the check-in coords vs the event's
--     location. A client-supplied `verified` is ignored (overwritten).
--   • Within ~2km of the venue  → verified = true.
--   • Coords missing (permission denied, bad indoor GPS) → verified = false, but
--     STILL ALLOWED — visibility is a safety property; we never hard-block.
--   • Positively far from the venue → verified = false (a direct-API spoof).
-- Downstream heat / vibe_score can then trust `verified` check-ins and weight
-- unverified ones lower, without ever hiding a legitimate one.
--
-- Idempotent. Safe to run on the live DB.

-- 1. The flag. Existing rows default to NULL (unknown) — not retroactively judged.
alter table public.live_checkins
  add column if not exists verified boolean;

-- 2. Haversine metres between two lat/lon points. IMMUTABLE + no I/O.
create or replace function public.gruvs_distance_m(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
) returns double precision
language sql immutable parallel safe
as $$
  select case
    when lat1 is null or lon1 is null or lat2 is null or lon2 is null then null
    else 2 * 6371000 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) *
      power(sin(radians(lon2 - lon1) / 2), 2)
    ))
  end;
$$;

-- 3. Compute `verified` on every insert, from the venue's coords. The client
--    NEVER gets to assert it.
create or replace function public.verify_checkin_presence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lat double precision;
  v_lon double precision;
  dist  double precision;
begin
  select e.lat, e.lon into v_lat, v_lon
  from public.events e where e.id = new.event_id;

  dist := public.gruvs_distance_m(new.lat, new.lon, v_lat, v_lon);

  -- Missing coords on either side → unverifiable (allowed, not verified).
  -- Within 2km → verified presence. Beyond → not verified (likely spoof/remote).
  new.verified := (dist is not null and dist <= 2000);
  return new;
end;
$$;

drop trigger if exists trg_verify_checkin on public.live_checkins;
create trigger trg_verify_checkin
  before insert on public.live_checkins
  for each row execute function public.verify_checkin_presence();

-- 4. Backfill existing rows honestly (where we have both coords).
update public.live_checkins lc
set verified = (public.gruvs_distance_m(lc.lat, lc.lon, e.lat, e.lon) <= 2000)
from public.events e
where lc.event_id = e.id
  and lc.verified is null
  and lc.lat is not null and e.lat is not null;
