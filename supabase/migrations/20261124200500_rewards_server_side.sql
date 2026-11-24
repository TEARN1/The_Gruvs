-- Rewards decided by the database, not the browser (penetration test,
-- 24 November 2026: TEARNs-Excellence docs/pentest-2026-11.md).
--
-- Score, badges, streak, XP, coins, reputation and equity were worked out in
-- the app and written straight to the user's own profile row, so anyone could
-- write any number. Now:
--   * rewards for real actions are given by triggers when the row is written
--     (event posted, check-in, vibe, gallery photo, booking completed), with
--     daily caps, so they cannot be asked for;
--   * vibe score and badges are recomputed from the user's real records by
--     recompute_vibe_score() and recompute_badges();
--   * the daily streak is kept by touch_my_streak();
--   * the columns are added to protect_profile_trust_columns, so a direct
--     write from the app keeps the old value.

-- ── Daily caps ───────────────────────────────────────────────────────────────
create schema if not exists private;

create table if not exists private.reward_ledger (
  user_id uuid not null,
  day     date not null default current_date,
  kind    text not null,
  amount  numeric not null default 0,
  primary key (user_id, day, kind)
);
revoke all on private.reward_ledger from public, anon, authenticated;

-- How much of p_amount may still be given today under p_cap; records it.
create or replace function private.take_reward(p_user uuid, p_kind text, p_amount numeric, p_cap numeric)
returns numeric
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_used numeric;
  v_give numeric;
begin
  if p_user is null or coalesce(p_amount, 0) <= 0 then return 0; end if;
  insert into private.reward_ledger (user_id, day, kind) values (p_user, current_date, p_kind)
    on conflict do nothing;
  select amount into v_used from private.reward_ledger
   where user_id = p_user and day = current_date and kind = p_kind for update;
  v_give := greatest(0, least(p_amount, p_cap - v_used));
  if v_give > 0 then
    update private.reward_ledger set amount = amount + v_give
     where user_id = p_user and day = current_date and kind = p_kind;
  end if;
  return v_give;
end;
$$;
revoke all on function private.take_reward(uuid, text, numeric, numeric) from public, anon, authenticated;

-- ── Equity (was VibeEquityLedger.mintEquity in the app) ─────────────────────
-- Same formula: weight × social integrity / 100, halved every 2,100,000
-- profiles, nothing past 21,000,000. At most 100 a day per person.
create or replace function private.mint_equity(p_user uuid, p_weight numeric)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_sis    numeric;
  v_supply bigint;
  v_amount numeric;
begin
  if p_user is null then return; end if;
  select count(*) into v_supply from public.profiles;
  if v_supply >= 21000000 then return; end if;
  select coalesce(social_integrity_score, 50) into v_sis from public.profiles where id = p_user;
  if not found then return; end if;
  v_amount := p_weight * (v_sis / 100.0) / power(2, floor(v_supply / 2100000.0));
  v_amount := private.take_reward(p_user, 'equity', round(v_amount, 8), 100);
  if v_amount > 0 then
    update public.profiles
       set vibe_equity = coalesce(vibe_equity, 0) + v_amount, last_mint_at = now()
     where id = p_user;
  end if;
end;
$$;
revoke all on function private.mint_equity(uuid, numeric) from public, anon, authenticated;

create or replace function private.reward_on_insert()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_coins numeric;
begin
  if tg_table_name = 'events' then
    perform private.mint_equity(new.author_id, 25);          -- EVENT_HOSTING
  elsif tg_table_name = 'live_checkins' then
    perform private.mint_equity(new.user_id, 10);            -- PHYSICAL_CHECKIN
  elsif tg_table_name = 'event_vibes' then
    perform private.mint_equity(new.user_id, 5);             -- SOCIAL_RESONANCE
  elsif tg_table_name = 'event_gallery' then
    v_coins := private.take_reward(new.user_id, 'coins', 50, 300);  -- gallery_post
    if v_coins > 0 then
      update public.profiles
         set vibe_coins = coalesce(vibe_coins, 0) + v_coins::int,
             reputation_status = case
               when coalesce(vibe_coins, 0) + v_coins < 100 then 'Novice Viber'
               when coalesce(vibe_coins, 0) + v_coins < 500 then 'Local Regular'
               else 'Neighborhood Legend' end
       where id = new.user_id;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists reward_on_insert on public.events;
create trigger reward_on_insert after insert on public.events
  for each row execute function private.reward_on_insert();
drop trigger if exists reward_on_insert on public.live_checkins;
create trigger reward_on_insert after insert on public.live_checkins
  for each row execute function private.reward_on_insert();
drop trigger if exists reward_on_insert on public.event_vibes;
create trigger reward_on_insert after insert on public.event_vibes
  for each row execute function private.reward_on_insert();
drop trigger if exists reward_on_insert on public.event_gallery;
create trigger reward_on_insert after insert on public.event_gallery
  for each row execute function private.reward_on_insert();

-- XP for a completed booking (was LevelManager.addXP from the customer's app,
-- which wrote XP onto the provider's row). Once per booking.
create or replace function private.reward_booking_completed()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' and new.provider_id is not null then
    perform public.award_xp(new.provider_id, 200, 'booking_complete');
  end if;
  return null;
end;
$$;
drop trigger if exists reward_booking_completed on public.service_bookings;
create trigger reward_booking_completed after update of status on public.service_bookings
  for each row execute function private.reward_booking_completed();

-- ── Vibe score: the same formula as ScoreEngine.computeVibeScore ───────────
-- Deterministic from the user's records, so anyone may ask for anyone's.
create or replace function public.recompute_vibe_score(p_user uuid default auth.uid())
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_score integer;
begin
  if p_user is null or auth.uid() is null then return null; end if;
  select round(
      12 * ln(1 + (select count(*) from public.events where author_id = p_user)) * 15
    + 10 * ln(1 + (select count(*) from public.event_vibes where user_id = p_user)) * 2
    + 10 * ln(1 + (select count(*) from public.event_rsvps where user_id = p_user)) * 5
    + 12 * ln(1 + (select count(*) from public.live_checkins where user_id = p_user)) * 25
    + 14 * ln(1 + (select count(*) from public.follows where following_id = p_user)) * 20
    + 16 * ln(1 + (select count(*) from public.service_bookings where provider_id = p_user and status = 'completed')) * 50
  )::int into v_score;
  update public.profiles set vibe_score = v_score where id = p_user;
  return v_score;
end;
$$;
revoke all on function public.recompute_vibe_score(uuid) from public, anon;
grant execute on function public.recompute_vibe_score(uuid) to authenticated;

-- ── Badges: the rules from AchievementBadges.js and RewardEngine ────────────
-- Recomputed from real records. Badges outside these rules (given by an
-- admin through award_badge) are kept. Returns the newly earned ones.
create or replace function public.recompute_badges(p_user uuid default auth.uid())
returns text[]
language plpgsql
security definer
set search_path to ''
as $$
declare
  known text[] := array['first_gruv','100_vibes','500_vibes','1000_vibes','social_butterfly','night_owl','explorer',
    'echo_chamber','gruv_master','popular_host','connector','verified_citizen','early_adopter','super_saver','rsvp_king',
    'vibe_scout','event_machine','impresario','headliner','vibe_legend','vibe_deity','networker','influencer','first_voice',
    'town_crier','collector','recruiter','kingmaker','touched_down','local_legend','committed','always_out','globetrotter',
    'early_bird','loyal_viber','social_elite','vibe_starter'];
  p record;
  n_events int; n_follows int; n_echoes int; n_saved int; n_checkins int; n_rsvps int;
  n_night int; n_morning int; n_cities int; max_vibes int; n_given int; rank_no bigint;
  earned text[] := '{}';
  before text[];
  after text[];
begin
  if p_user is null or auth.uid() is null then return '{}'; end if;
  select id, badges, vibe_score, username, bio, avatar_url, city, referral_count, current_streak, social_integrity_score
    into p from public.profiles where id = p_user;
  if not found then return '{}'; end if;

  select count(*), coalesce(max(vibe_count), 0) into n_events, max_vibes from public.events where author_id = p_user;
  select count(*) into n_follows from public.follows where follower_id = p_user;
  select count(*) into n_echoes from public.echoes where user_id = p_user;
  select count(*) into n_saved from public.saved_events where user_id = p_user;
  select count(*) into n_checkins from public.event_checkins where user_id = p_user;
  select count(*) into n_given from public.event_vibes where user_id = p_user;
  -- event_time is free text: only a leading "HH:" counts, anything else is no hour.
  select count(*),
         count(*) filter (where h >= 22 or h < 4),
         count(*) filter (where h < 12),
         count(distinct lower(trim(city))) filter (where coalesce(trim(city), '') <> '')
    into n_rsvps, n_night, n_morning, n_cities
    from (select e.city,
                 case when e.event_time ~ '^\d{1,2}:' then split_part(e.event_time, ':', 1)::int end as h
            from public.event_rsvps r left join public.events e on e.id = r.event_id
           where r.user_id = p_user) t;
  select rn into rank_no from (select id, row_number() over (order by created_at, id) rn from public.profiles) x where x.id = p_user;

  if n_events >= 1  then earned := array_append(earned, 'first_gruv'); end if;
  if n_events >= 5  then earned := array_append(earned, 'gruv_master'); end if;
  if n_events >= 10 then earned := array_append(earned, 'event_machine'); end if;
  if n_events >= 25 then earned := array_append(earned, 'impresario'); end if;
  if coalesce(p.vibe_score, 0) >= 100  then earned := array_append(earned, '100_vibes'); end if;
  if coalesce(p.vibe_score, 0) >= 500  then earned := array_append(earned, '500_vibes'); end if;
  if coalesce(p.vibe_score, 0) >= 1000 then earned := array_append(earned, '1000_vibes'); end if;
  if coalesce(p.vibe_score, 0) >= 2500 then earned := array_append(earned, 'vibe_legend'); end if;
  if coalesce(p.vibe_score, 0) >= 5000 then earned := array_append(earned, 'vibe_deity'); end if;
  if n_follows >= 10  then earned := array_append(earned, 'networker'); end if;
  if n_follows >= 50  then earned := array_append(earned, 'social_butterfly'); end if;
  if n_follows >= 100 then earned := array_append(earned, 'influencer'); end if;
  if n_echoes >= 1   then earned := array_append(earned, 'first_voice'); end if;
  if n_echoes >= 20  then earned := array_append(earned, 'echo_chamber'); end if;
  if n_echoes >= 100 then earned := array_append(earned, 'town_crier'); end if;
  if n_saved >= 5  then earned := array_append(earned, 'collector'); end if;
  if n_saved >= 20 then earned := array_append(earned, 'super_saver'); end if;
  if coalesce(p.referral_count, 0) >= 1  then earned := array_append(earned, 'recruiter'); end if;
  if coalesce(p.referral_count, 0) >= 3  then earned := array_append(earned, 'connector'); end if;
  if coalesce(p.referral_count, 0) >= 10 then earned := array_append(earned, 'kingmaker'); end if;
  if n_checkins >= 1  then earned := array_append(earned, 'touched_down'); end if;
  if n_checkins >= 5  then earned := array_append(earned, 'vibe_scout'); end if;
  if n_checkins >= 25 then earned := array_append(earned, 'local_legend'); end if;
  if coalesce(p.username, '') <> '' and coalesce(p.bio, '') <> '' and coalesce(p.avatar_url, '') <> '' and coalesce(p.city, '') <> '' then
    earned := array_append(earned, 'verified_citizen');
  end if;
  if max_vibes >= 50  then earned := array_append(earned, 'popular_host'); end if;
  if max_vibes >= 100 then earned := array_append(earned, 'headliner'); end if;
  if n_rsvps >= 1  then earned := array_append(earned, 'committed'); end if;
  if n_rsvps >= 10 then earned := array_append(earned, 'rsvp_king'); end if;
  if n_rsvps >= 25 then earned := array_append(earned, 'always_out'); end if;
  if n_night >= 5   then earned := array_append(earned, 'night_owl'); end if;
  if n_morning >= 5 then earned := array_append(earned, 'early_bird'); end if;
  if n_cities >= 3  then earned := array_append(earned, 'explorer'); end if;
  if n_cities >= 5  then earned := array_append(earned, 'globetrotter'); end if;
  if rank_no <= 500 then earned := array_append(earned, 'early_adopter'); end if;
  if n_given >= 5 then earned := array_append(earned, 'vibe_starter'); end if;
  if coalesce(p.current_streak, 0) >= 7 then earned := array_append(earned, 'loyal_viber'); end if;
  if coalesce(p.social_integrity_score, 0) >= 100 then earned := array_append(earned, 'social_elite'); end if;

  before := coalesce(p.badges, '{}');
  -- Keep badges outside the rules (admin-given); replace the rule-based ones.
  select coalesce(array_agg(distinct b), '{}') into after
    from unnest(array(select x from unnest(before) x where not (x = any(known))) || earned) b;
  update public.profiles set badges = after where id = p_user and badges is distinct from after;
  return array(select x from unnest(earned) x where not (x = any(before)));
end;
$$;
revoke all on function public.recompute_badges(uuid) from public, anon;
grant execute on function public.recompute_badges(uuid) to authenticated;

-- ── Daily streak (was StreakBadge and RetentionManager.logSession) ──────────
create or replace function public.touch_my_streak()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_last   date;
  v_streak integer;
begin
  if auth.uid() is null then return 0; end if;
  select last_seen::date, coalesce(current_streak, 0) into v_last, v_streak
    from public.profiles where id = auth.uid();
  if not found then return 0; end if;
  if v_last = current_date and v_streak > 0 then return v_streak; end if;
  v_streak := case when v_last = current_date - 1 then v_streak + 1 else 1 end;
  update public.profiles
     set current_streak = v_streak, last_seen = now(), last_active = now()
   where id = auth.uid();
  return v_streak;
end;
$$;
revoke all on function public.touch_my_streak() from public, anon;
grant execute on function public.touch_my_streak() to authenticated;

-- ── Lock the columns ─────────────────────────────────────────────────────────
-- protect_profile_trust_columns (20261124150000) gains score, badges, streak,
-- XP, coins, reputation and equity: a direct write from the app keeps the old
-- value. The functions above run as their owner and are not affected.
create or replace function public.protect_profile_trust_columns()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  -- SECURITY INVOKER is load-bearing: under SECURITY DEFINER current_user is
  -- the owner and the guard never engages.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.role := 'user';
    new.is_verified := false;
    new.verified := false;
    new.verification_badge := false;
    new.provider_verified := false;
    new.is_premium := false;
    new.subscription_tier := 'free';
    new.premium_expiry_date := null;
    new.account_status := 'active';
    new.is_auto_hidden := false;
    new.followers_count := 0;
    new.following_count := 0;
    new.referral_count := 0;
    new.streak := 0;
    new.wallet_balance := 0;
    new.vibe_score := 0;
    new.badges := '{}';
    new.current_streak := 0;
    new.xp := 0;
    new.vibe_coins := 0;
    new.reputation_status := 'Novice Viber';
    new.vibe_equity := 0;
    return new;
  end if;
  new.role                   := old.role;
  new.is_verified            := old.is_verified;
  new.social_integrity_score := old.social_integrity_score;
  new.wallet_balance         := old.wallet_balance;
  new.resident_trust_tier    := old.resident_trust_tier;
  new.verified               := old.verified;
  new.verification_badge     := old.verification_badge;
  new.provider_verified      := old.provider_verified;
  new.is_premium             := old.is_premium;
  new.subscription_tier      := old.subscription_tier;
  new.premium_expiry_date    := old.premium_expiry_date;
  new.account_status         := old.account_status;
  new.is_auto_hidden         := old.is_auto_hidden;
  new.followers_count        := old.followers_count;
  new.following_count        := old.following_count;
  new.referral_count         := old.referral_count;
  new.streak                 := old.streak;
  new.vibe_score             := old.vibe_score;
  new.badges                 := old.badges;
  new.current_streak         := old.current_streak;
  new.xp                     := old.xp;
  new.vibe_coins             := old.vibe_coins;
  new.reputation_status      := old.reputation_status;
  new.vibe_equity            := old.vibe_equity;
  return new;
end;
$function$;

-- Spending equity (was VibeEquityLedger.burnEquity writing the new balance
-- from the app). Uses debit_vibe_equity, which checks the balance and keeps
-- the wallet ledger; only ever for the caller.
create or replace function public.burn_my_equity(p_amount numeric, p_reason text default 'burn')
returns numeric
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_ok boolean;
  v_balance numeric;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000 then
    raise exception 'invalid amount' using errcode = '22023';
  end if;
  v_ok := public.debit_vibe_equity(auth.uid(), p_amount, left(coalesce(p_reason, 'burn'), 60), null, 'burn');
  if not v_ok then raise exception 'Insufficient Vibe Equity.' using errcode = 'P0001'; end if;
  select vibe_equity into v_balance from public.profiles where id = auth.uid();
  return v_balance;
end;
$$;
revoke all on function public.burn_my_equity(numeric, text) from public, anon;
grant execute on function public.burn_my_equity(numeric, text) to authenticated;
