-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: signup deleted every CAPITAL letter from usernames (2026-11-12)
--
-- handle_new_user() did   lower(regexp_replace(name, '[^a-z0-9_]', '', 'g'))
-- i.e. it stripped everything that wasn't already lowercase BEFORE lowercasing,
-- so capitals vanished: "Sample" → "ample", "JaneDoe" → "aneoe",
-- "Mary Smith" → "arymith". Users reported the app "cutting the first
-- letters" of their names.
--
-- 1. The trigger now lowercases FIRST, then strips.
-- 2. A one-off repair restores the affected accounts — only where the stored
--    username is still exactly what the bug produced (so nobody's own later
--    edit is undone), the restored handle is 3+ chars and not already taken,
--    and the original wasn't an email address (that would publish the email
--    as a public handle).
-- Idempotent: re-running changes nothing once repaired.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  base_uname text;
begin
  -- lower() FIRST, then strip — the reverse order deleted every capital.
  base_uname := regexp_replace(
    lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))),
    '[^a-z0-9_]', '', 'g'
  );
  if base_uname is null or base_uname = '' then
    base_uname := 'user' || left(new.id::text, 6);
  end if;
  begin
    insert into public.profiles (id, username, display_name, avatar_url)
    values (
      new.id,
      base_uname,
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      new.raw_user_meta_data->>'avatar_url'
    );
  exception
    when unique_violation then
      insert into public.profiles (id, username, display_name, avatar_url)
      values (
        new.id,
        'user_' || left(new.id::text, 8),
        coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        new.raw_user_meta_data->>'avatar_url'
      )
      on conflict (id) do nothing;
    when others then null;
  end;
  return new;
end;
$function$;

-- Repair accounts damaged by the old trigger.
with c as (
  select p.id,
         p.username as old_u,
         lower(regexp_replace(u.raw_user_meta_data->>'username', '[^a-z0-9_]', '', 'g')) as buggy,
         regexp_replace(lower(u.raw_user_meta_data->>'username'), '[^a-z0-9_]', '', 'g') as fixed
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.raw_user_meta_data ? 'username'
    -- skip real email addresses ("x@y"), but not a leading "@handle"
    and (u.raw_user_meta_data->>'username') !~ '.@'
)
update public.profiles p
set username = c.fixed
from c
where p.id = c.id
  and c.old_u = c.buggy
  and c.fixed <> c.buggy
  and length(c.fixed) >= 3
  and not exists (
    select 1 from public.profiles x
    where lower(x.username) = c.fixed and x.id <> c.id
  );
