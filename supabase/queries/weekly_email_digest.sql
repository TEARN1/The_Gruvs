-- ═══════════════════════════════════════════════════════════════════════════
-- weekly_email_digest.sql
--
-- Infrastructure for automated weekly email digests:
--   * Delivers personalized 2-week event horizons to users.
--   * Prioritizes events closest to the user's home area or coordinates.
--   * Strictly honors POPIA/CAN-SPAM consent: default true, one-click unsubscribe,
--     and an unguessable UUID unsubscribe token.
--   * Rate-limited: users only receive at most one digest per 6 days.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Profile preference columns ───────────────────────────────────────────
alter table public.profiles
  add column if not exists email_digest_enabled boolean not null default true,
  add column if not exists last_digest_sent_at timestamptz,
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

comment on column public.profiles.email_digest_enabled is
  'Whether the user is subscribed to the weekly upcoming events email digest. Defaults to true.';
comment on column public.profiles.last_digest_sent_at is
  'Timestamp of the most recently dispatched weekly digest. Used to ensure <= 1 email per week.';
comment on column public.profiles.unsubscribe_token is
  'Opaque token enabling 1-click unauthenticated unsubscribe from email links.';

create index if not exists idx_profiles_digest_delivery
  on public.profiles (email_digest_enabled, last_digest_sent_at)
  where email_digest_enabled = true;

create index if not exists idx_profiles_unsubscribe_token
  on public.profiles (unsubscribe_token);

-- ── 2. Service-role recipient query ─────────────────────────────────────────
-- Returns active recipients who haven't received a digest in the past 6 days.
-- Strictly limited to the service_role / cron runner to protect user emails & coordinates.
create or replace function public.get_weekly_digest_recipients(p_limit integer default 1000)
returns table (
  id uuid,
  email text,
  username text,
  display_name text,
  home_area text,
  home_base_lat double precision,
  home_base_lon double precision,
  unsubscribe_token uuid
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.id,
    p.email,
    p.username,
    p.display_name,
    p.home_area,
    p.home_base_lat,
    p.home_base_lon,
    p.unsubscribe_token
  from public.profiles p
  where p.email_digest_enabled = true
    and p.email is not null
    and btrim(p.email) != ''
    and (p.last_digest_sent_at is null or p.last_digest_sent_at < (now() - interval '6 days'))
  order by coalesce(p.last_digest_sent_at, '1970-01-01'::timestamptz) asc
  limit greatest(1, least(coalesce(p_limit, 1000), 5000));
$$;

revoke all on function public.get_weekly_digest_recipients(integer) from public, anon, authenticated;
grant execute on function public.get_weekly_digest_recipients(integer) to service_role;

-- ── 3. Record delivery stamp ────────────────────────────────────────────────
-- Updates last_digest_sent_at for all successfully delivered recipients.
create or replace function public.record_digest_sent(p_user_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated integer;
begin
  if p_user_ids is null or array_length(p_user_ids, 1) = 0 then
    return 0;
  end if;

  update public.profiles
     set last_digest_sent_at = now()
   where id = any(p_user_ids);

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.record_digest_sent(uuid[]) from public, anon, authenticated;
grant execute on function public.record_digest_sent(uuid[]) to service_role;

-- ── 4. One-click unsubscribe by token ───────────────────────────────────────
-- Allows unauthenticated one-click unsubscribe from email footer links.
create or replace function public.unsubscribe_digest_by_token(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_found boolean := false;
begin
  if p_token is null then
    return false;
  end if;

  update public.profiles
     set email_digest_enabled = false
   where unsubscribe_token = p_token;

  return found;
end;
$$;

-- Allow anon and authenticated to call unsubscribe_digest_by_token (for web unsubscribe links)
grant execute on function public.unsubscribe_digest_by_token(uuid) to anon, authenticated, service_role;

commit;
