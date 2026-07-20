-- ═══════════════════════════════════════════════════════════════════════════
-- client_errors_anon_write.sql — let guests actually report crashes.
--
-- Found 2026-07-20 while investigating a landing-page ErrorBoundary report:
-- src/utils/logError.js inserts into client_errors for EVERY crash, signed in
-- or not (`user_id: uid || null`). Direct test against the live REST API:
--
--   POST .../rest/v1/client_errors  (anon key, no session)
--   -> 401 { "code": "42501", "message": "new row violates row-level
--      security policy for table \"client_errors\"" }
--
-- So every crash on a signed-out session — including cold landing-page loads,
-- which is exactly where most first impressions happen — has been silently
-- dropped. The insert call is fire-and-forget by design (telemetry must never
-- surface an error), so this failure was invisible even to the developer.
-- This is the same "swallowed catch hides real breakage" pattern the rest of
-- today's work has been closing, just one layer further in: the tool built
-- to catch that pattern was itself caught by it.
--
-- Idempotent. Write-only for clients: anon/authenticated may INSERT their own
-- crash reports, but may NOT SELECT — error messages can accidentally contain
-- fragments of app state, so read access stays service-role-only (readable
-- via the Supabase dashboard or MCP, same as the rest of this table's design
-- intent per logError.js's own comment: "our x-ray vision").
-- ═══════════════════════════════════════════════════════════════════════════

-- Defensive: create if this environment never got the table at all. Matches
-- exactly the columns src/utils/logError.js writes.
create table if not exists public.client_errors (
  id          bigint generated always as identity primary key,
  user_id     uuid references public.profiles(id) on delete set null,
  label       text not null,
  message     text,
  context     jsonb not null default '{}'::jsonb,
  platform    text,
  app_version text,
  created_at  timestamptz not null default now()
);

alter table public.client_errors enable row level security;

drop policy if exists "client_errors_insert_anon"          on public.client_errors;
drop policy if exists "client_errors_insert_authenticated"  on public.client_errors;

-- Anyone — signed in or not — may report a crash. No SELECT granted to either
-- role: this is a write-only mailbox, not a feature.
create policy "client_errors_insert_anon" on public.client_errors
  for insert to anon
  with check (user_id is null);   -- an anon session cannot claim a user_id

create policy "client_errors_insert_authenticated" on public.client_errors
  for insert to authenticated
  with check (user_id is null or user_id = auth.uid());

-- Table grows forever otherwise — same self-maintenance principle as
-- maintenance_levels.sql. 90 days is ample for triaging any real incident.
create or replace function public.purge_stale_client_errors()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  delete from public.client_errors where created_at < now() - interval '90 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ✅ Check after running (as anon, no Authorization beyond the anon key):
--   curl -X POST "$SUPABASE_URL/rest/v1/client_errors" \
--     -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
--     -d '{"label":"deploy-check","message":"anon write test"}'
--   -> 201, not 401/42501.
