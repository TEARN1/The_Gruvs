-- fix_series_fk.sql — tours could NEVER be saved.
--
-- events.series_id was constrained as:
--     FOREIGN KEY (series_id) REFERENCES events(id)
-- ...but series_id holds an event_series.id, not an events.id. So every tour
-- stop insert was rejected by the FK. The parent event_series row was created
-- (3 orphans on live proved it), then all N stops failed, and the host got
-- "All save attempts failed".
--
-- The app was right; the constraint was wrong.
--
-- Safe: verified 0 events currently carry a series_id, so nothing depends on
-- the broken wiring.

-- event_series (the "legacy" table tour_series.sql later enriches): existed
-- live but in zero tracked SQL files — found 2026-08-20 when db-schema-ci's
-- fresh rebuild died on the FK below. Base columns only (verbatim from
-- information_schema against production); tour_series.sql's own ADD COLUMN
-- IF NOT EXISTS calls add the tour-identity fields on top of this.
create table if not exists public.event_series (
  id                 uuid primary key default gen_random_uuid(),
  creator_id         uuid not null references public.profiles(id) on delete cascade,
  recurrence_pattern text,
  metadata           jsonb default '{}'::jsonb,
  created_at         timestamptz default now()
);

alter table public.events
  drop constraint if exists events_series_id_fkey;

alter table public.events
  add constraint events_series_id_fkey
  foreign key (series_id) references public.event_series(id) on delete set null;

-- Clean up the orphaned parents left behind by the failed tour attempts:
-- an event_series with no stops is not a tour, it's debris.
delete from public.event_series s
where not exists (select 1 from public.events e where e.series_id = s.id);
