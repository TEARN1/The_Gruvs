-- username_skeleton.sql — server-side impersonation prevention.
--
-- The client (utils/handleGuard) blocks a signup whose handle READS the same as
-- an existing one (k0nka / kon.ka / konkaa impersonating konka). But that check
-- is a bounded client fetch and is bypassable via the API. This enforces it in
-- the database: a handle's "skeleton" must be unique.
--
-- The skeleton function MUST match handleGuard.handleSkeleton exactly:
--   lowercase, strip @, drop separators (. _ - space), map digit/symbol
--   lookalikes to letters, fold rn→m, collapse runs of the same letter.
--
-- Enforcement is trigger-based (not a plain UNIQUE index) so it can't fail to
-- install on any pre-existing collisions in live data — new/changed handles are
-- checked; historical rows are left as-is.
--
-- Idempotent. Safe to run.

-- 1. The canonical "how it reads" form. Order mirrors handleGuard.handleSkeleton.
create or replace function public.username_skeleton(handle text)
returns text
language plpgsql immutable parallel safe
as $$
declare s text;
begin
  s := lower(coalesce(handle, ''));
  s := regexp_replace(s, '^@', '');            -- strip leading @
  s := regexp_replace(s, '[._\-\s]', '', 'g'); -- separators are invisible noise
  -- digit/symbol lookalikes → letters (same map as CONFUSABLES in JS)
  s := replace(s, '0', 'o');
  s := replace(s, '1', 'l');
  s := replace(s, '!', 'l');
  s := replace(s, '|', 'l');
  s := replace(s, '3', 'e');
  s := replace(s, '4', 'a');
  s := replace(s, '5', 's');
  s := replace(s, '7', 't');
  s := replace(s, '8', 'b');
  s := replace(s, '9', 'g');
  s := replace(s, '$', 's');
  s := replace(s, '@', 'a');
  s := replace(s, 'rn', 'm');                  -- 'rn' reads as 'm'
  s := regexp_replace(s, '(.)\1+', '\1', 'g'); -- konkaa → konka
  return s;
end;
$$;

-- 2. Fast lookup index on the computed skeleton.
create index if not exists idx_profiles_username_skeleton
  on public.profiles (public.username_skeleton(username));

-- 3. Reject a new/changed handle whose skeleton collides with a DIFFERENT user.
create or replace function public.enforce_username_distinct()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare clash text;
begin
  if new.username is null then return new; end if;
  if tg_op = 'UPDATE' and new.username is not distinct from old.username then
    return new;                                -- handle unchanged
  end if;
  select p.username into clash
  from public.profiles p
  where p.id <> new.id
    and public.username_skeleton(p.username) = public.username_skeleton(new.username)
  limit 1;
  if clash is not null then
    raise exception 'username too similar to an existing one (@%)', clash
      using errcode = '23505';                 -- unique_violation
  end if;
  return new;
end;
$$;

drop trigger if exists trg_username_distinct on public.profiles;
create trigger trg_username_distinct
  before insert or update of username on public.profiles
  for each row execute function public.enforce_username_distinct();
