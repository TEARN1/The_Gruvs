-- Starred lineup / personal schedule (src/services/eventLifecycleManager.js).
-- NOT YET APPLIED. Until it is, starring works on-device only (in-memory Set);
-- the DB writes fail softly. Idempotent; safe to re-run.
create table if not exists public.event_schedule_bookmarks (
  event_id         uuid not null references public.events(id) on delete cascade,
  schedule_item_id text not null,
  user_id          uuid not null references auth.users(id) on delete cascade default auth.uid(),
  item_data        jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  primary key (user_id, event_id, schedule_item_id)
);

create index if not exists event_schedule_bookmarks_event_idx
  on public.event_schedule_bookmarks (event_id);

alter table public.event_schedule_bookmarks enable row level security;

-- Private to the owner: a user's starred sets are nobody else's business.
drop policy if exists esb_select_own on public.event_schedule_bookmarks;
create policy esb_select_own on public.event_schedule_bookmarks
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists esb_insert_own on public.event_schedule_bookmarks;
create policy esb_insert_own on public.event_schedule_bookmarks
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists esb_update_own on public.event_schedule_bookmarks;
create policy esb_update_own on public.event_schedule_bookmarks
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists esb_delete_own on public.event_schedule_bookmarks;
create policy esb_delete_own on public.event_schedule_bookmarks
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.event_schedule_bookmarks from anon;
grant select, insert, update, delete on public.event_schedule_bookmarks to authenticated;
