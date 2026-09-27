-- ═══════════════════════════════════════════════════════════════════════════
-- tour_series.sql — Tours (multi-stop event series)
--
-- A Tour is one identity (name, poster, host) that spawns N real event rows,
-- each with its OWN date/time/venue/coords, threaded by events.series_id.
--
-- Adapts the pre-existing legacy tables rather than replacing them:
--   • public.event_series           (id, creator_id, recurrence_pattern, metadata, created_at)
--   • public.event_series_followers (id, series_id, user_id, notify_before_hours, created_at)
-- creator_id is the tour host. Idempotent — safe to run repeatedly.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Parent: enrich the legacy event_series with tour identity/route fields ───
alter table public.event_series add column if not exists name        text;
alter table public.event_series add column if not exists description text;
alter table public.event_series add column if not exists cover_url   text;
alter table public.event_series add column if not exists category    text;
alter table public.event_series add column if not exists stop_count  int  default 0;   -- number of stops (events)
alter table public.event_series add column if not exists city_count  int  default 0;   -- distinct cities on the route
alter table public.event_series add column if not exists starts_on   date;             -- first stop's date
alter table public.event_series add column if not exists ends_on     date;             -- last stop's date
alter table public.event_series add column if not exists updated_at  timestamptz default now();

comment on table public.event_series is 'A tour: one identity that owns many dated/located event stops via events.series_id.';

-- ── Followers: "Follow Tour" → every future stop auto-routes to them ─────────
-- Table already exists; guarantee the unique pair the followSeries upsert needs.
create unique index if not exists uq_series_followers
  on public.event_series_followers (series_id, user_id);

-- ── events: link + stop ordering ────────────────────────────────────────────
-- series_id already exists in prod. tour_stop_index orders the route (1 = first).
alter table public.events add column if not exists series_id       uuid;
alter table public.events add column if not exists tour_stop_index int;

create index if not exists idx_events_series_id on public.events (series_id) where series_id is not null;
create index if not exists idx_series_followers_series on public.event_series_followers (series_id);
create index if not exists idx_series_followers_user   on public.event_series_followers (user_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.event_series           enable row level security;
alter table public.event_series_followers enable row level security;

-- event_series: anyone can view a tour; only the host (creator_id) can write it.
drop policy if exists event_series_select on public.event_series;
create policy event_series_select on public.event_series
  for select using (true);

drop policy if exists event_series_insert on public.event_series;
create policy event_series_insert on public.event_series
  for insert with check (creator_id = auth.uid());

drop policy if exists event_series_update on public.event_series;
create policy event_series_update on public.event_series
  for update using (creator_id = auth.uid()) with check (creator_id = auth.uid());

drop policy if exists event_series_delete on public.event_series;
create policy event_series_delete on public.event_series
  for delete using (creator_id = auth.uid());

-- followers: you manage your own follow; the tour host can see who follows.
drop policy if exists series_followers_select on public.event_series_followers;
create policy series_followers_select on public.event_series_followers
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.event_series s where s.id = series_id and s.creator_id = auth.uid())
  );

drop policy if exists series_followers_insert on public.event_series_followers;
create policy series_followers_insert on public.event_series_followers
  for insert with check (user_id = auth.uid());

drop policy if exists series_followers_delete on public.event_series_followers;
create policy series_followers_delete on public.event_series_followers
  for delete using (user_id = auth.uid());
