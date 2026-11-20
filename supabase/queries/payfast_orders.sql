-- ─────────────────────────────────────────────────────────────────────────────
-- PayFast orders + ticket lockdown (2026-11-12)
--
-- Why:
--   • payfast-itn wrote to `payfast_transactions`, which never existed, and
--     trusted the client's price — a R1 payment could buy a R500 ticket.
--   • ticket_tokens had one FOR ALL policy (auth.uid() = user_id): any signed-in
--     user could INSERT a valid door ticket for any event (paid or not) straight
--     through the REST API, and UPDATE used_at back to NULL to re-use it.
--   • Door check-in updated someone else's ticket from the host's session, which
--     that same policy blocked — so hosts could never validate a guest's ticket.
--
-- After this file:
--   • payfast_orders is written ONLY by the payfast-checkout / payfast-itn edge
--     functions (service role). Users can read their own orders.
--   • ticket_tokens is read-only to users (own rows). Tickets are minted by the
--     ITN (service role) and validated at the door by validate_ticket(), which
--     only the event's host can call. Idempotent: safe to run more than once.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Orders ------------------------------------------------------------------
create table if not exists public.payfast_orders (
  id             uuid primary key default gen_random_uuid(),
  m_payment_id   text not null unique,
  user_id        uuid not null references auth.users(id) on delete cascade,
  event_id       uuid not null references public.events(id) on delete cascade,
  tier_id        text not null,
  tier_name      text,
  amount_cents   integer not null check (amount_cents > 0),
  sandbox        boolean not null,
  status         text not null default 'pending'
                 check (status in ('pending','complete','failed','cancelled','rejected')),
  status_reason  text,
  pf_payment_id  text,
  ticket_id      uuid,
  itn_payload    jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists payfast_orders_user_idx  on public.payfast_orders (user_id, created_at desc);
create index if not exists payfast_orders_event_idx on public.payfast_orders (event_id);

alter table public.payfast_orders enable row level security;
revoke all on public.payfast_orders from anon, authenticated;
grant select on public.payfast_orders to authenticated;
grant all on public.payfast_orders to service_role;

drop policy if exists payfast_orders_select_own on public.payfast_orders;
create policy payfast_orders_select_own on public.payfast_orders
  for select to authenticated using (user_id = auth.uid());

-- 2. Tickets: link to the order that paid for them --------------------------
alter table public.ticket_tokens add column if not exists tier_id  text;
alter table public.ticket_tokens add column if not exists order_id uuid;
create unique index if not exists ticket_tokens_order_id_key
  on public.ticket_tokens (order_id) where order_id is not null;

-- Read-only for users. No client INSERT/UPDATE/DELETE: minting is server-side,
-- check-in goes through validate_ticket().
drop policy if exists ticket_tokens_own on public.ticket_tokens;
drop policy if exists ticket_tokens_select_own on public.ticket_tokens;
create policy ticket_tokens_select_own on public.ticket_tokens
  for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.ticket_tokens from anon, authenticated;
grant select on public.ticket_tokens to authenticated;

-- 3. Door check-in: host-only, atomic, replay-safe ---------------------------
create or replace function public.validate_ticket(p_token text, p_event uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.ticket_tokens;
  v_host   uuid;
  v_name   text;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;
  if coalesce(trim(p_token), '') = '' then
    return jsonb_build_object('valid', false, 'reason', 'empty');
  end if;

  select * into v_ticket from public.ticket_tokens where token = trim(p_token);
  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;

  select author_id into v_host from public.events where id = v_ticket.event_id;
  if v_host is distinct from auth.uid() then
    -- Same answer as "not found": don't confirm a token exists to non-hosts.
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;
  if p_event is not null and v_ticket.event_id <> p_event then
    return jsonb_build_object('valid', false, 'reason', 'wrong_event');
  end if;

  update public.ticket_tokens set used_at = now()
   where id = v_ticket.id and used_at is null
   returning * into v_ticket;
  if not found then
    return jsonb_build_object('valid', false, 'reason', 'already_used');
  end if;

  select username into v_name from public.profiles where id = v_ticket.user_id;
  return jsonb_build_object(
    'valid', true, 'reason', 'ok',
    'ticket', jsonb_build_object(
      'id', v_ticket.id, 'event_id', v_ticket.event_id, 'user_id', v_ticket.user_id,
      'tier_id', v_ticket.tier_id, 'used_at', v_ticket.used_at, 'username', v_name));
end;
$$;

revoke all on function public.validate_ticket(text, uuid) from public, anon;
grant execute on function public.validate_ticket(text, uuid) to authenticated;
