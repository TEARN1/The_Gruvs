-- Penetration test, 24 November 2026 (TEARNs-Excellence docs/pentest-2026-11.md):
-- any signed-in user could send any user a notification with any type, title
-- and text (tried: a "system" notice "Your account is suspended"), and every
-- notification is pushed to the phone. The app sends about 35 kinds from the
-- browser, so they are not moved to the server; instead, a notification for
-- someone else:
--   * is always from the sender (actor_id is the caller);
--   * cannot use a type that looks official (system, admin, security, payment,
--     verification, ...): the app sends none of these from the browser;
--   * has its title cut to 120 characters and its text to 500;
--   * keeps an action_url only if it is a path inside the app;
--   * counts towards 500 an hour per sender.
-- Counted as the owner: the sender cannot read the notifications they sent.
create or replace function private.notifications_sent_last_hour(p_actor uuid)
returns integer
language sql
stable
security definer
set search_path to ''
as $$
  select count(*)::int from public.notifications
   where actor_id = p_actor
     and recipient_id is distinct from p_actor
     and created_at > now() - interval '1 hour';
$$;
revoke all on function private.notifications_sent_last_hour(uuid) from public;
grant execute on function private.notifications_sent_last_hour(uuid) to authenticated, anon;

-- SECURITY INVOKER is load-bearing: under SECURITY DEFINER current_user is
-- the owner and the guard never engages.
create or replace function private.guard_notification()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_sent integer;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.recipient_id is not distinct from auth.uid() then
    return new; -- a note to yourself
  end if;
  new.actor_id := auth.uid();
  if coalesce(new.type, '') ~* '^(system|admin|security|account|payment|billing|payout_admin|verif|official|moderat|support|warning|suspen|ban|legal|policy)' then
    raise exception 'That kind of notification can only come from The Gruvs.' using errcode = '42501';
  end if;
  new.title   := left(new.title, 120);
  new.body    := left(new.body, 500);
  new.message := left(new.message, 500);
  if new.action_url is not null and not (new.action_url ~ '^/[^/\\]') then
    new.action_url := null;
  end if;
  if pg_column_size(new.data) > 4000 then
    raise exception 'Notification data too large.' using errcode = '22023';
  end if;
  v_sent := private.notifications_sent_last_hour(auth.uid());
  if v_sent >= 500 then
    raise exception 'rate_limited: too many notifications sent this hour' using errcode = '54000';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_notification on public.notifications;
create trigger guard_notification before insert on public.notifications
  for each row execute function private.guard_notification();

create index if not exists notifications_actor_created_idx on public.notifications (actor_id, created_at);
