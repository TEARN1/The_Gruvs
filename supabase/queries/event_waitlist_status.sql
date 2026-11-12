-- Waitlist status columns read by src/components/WaitlistButton.js.
-- APPLIED to live (feevvddvrjmfbhffccbf) 2026-11-12.
-- Subset of supabase/migrations/20261107000100_payfast_payments_integration.sql
-- (which is NOT applied live), plus a guard that migration lacks:
-- the live policy waitlist_manage (FOR ALL, user_id = auth.uid()) lets a user
-- edit their own row, so without the trigger anyone could mark themselves
-- 'offered' with a far-future hold. Only service_role / postgres may set
-- status, reserved_until or payment_ref. Idempotent; safe to re-run.
alter table public.event_waitlist add column if not exists status text not null default 'queued';
alter table public.event_waitlist add column if not exists reserved_until timestamptz;
alter table public.event_waitlist add column if not exists payment_ref text;

do $$ begin
  alter table public.event_waitlist add constraint event_waitlist_status_check
    check (status in ('queued','offered','claimed','expired','cancelled'));
exception when duplicate_object then null; end $$;

create index if not exists idx_waitlist_reserved
  on public.event_waitlist (event_id, status, reserved_until);

create or replace function public.event_waitlist_guard()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('service_role','postgres','supabase_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'queued';
    new.reserved_until := null;
    new.payment_ref := null;
  else
    new.status := old.status;
    new.reserved_until := old.reserved_until;
    new.payment_ref := old.payment_ref;
  end if;
  return new;
end $$;

drop trigger if exists event_waitlist_guard on public.event_waitlist;
create trigger event_waitlist_guard
  before insert or update on public.event_waitlist
  for each row execute function public.event_waitlist_guard();

revoke execute on function public.event_waitlist_guard() from public, anon, authenticated;
