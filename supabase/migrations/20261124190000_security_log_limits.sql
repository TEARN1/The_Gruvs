-- Penetration test, 24 November 2026 (TEARNs-Excellence docs/pentest-2026-11.md):
-- anyone could add 300 anonymous rows a minute to res_security_logs, each with
-- unlimited text, and so fill the database. The Resident writes this log from
-- the browser on purpose (best-effort telemetry), so instead of closing it:
-- every text field is cut to a sensible length, and anonymous entries share a
-- limit of 60 a minute (signed-in users keep 60 each). event_type was already
-- limited to a fixed list by a check constraint.
create or replace function public.res_check_security_log_rate_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count integer;
begin
  new.action     := left(new.action, 200);
  new.details    := left(new.details, 2000);
  new.ip_address := left(new.ip_address, 64);
  new.user_agent := left(new.user_agent, 500);
  if new.user_id is not null then
    select count(*) into v_count
      from res_security_logs
     where user_id = new.user_id
       and created_at > now() - interval '1 minute';
    if v_count >= 60 then
      raise exception 'rate_limited: too many security log entries for this user';
    end if;
  else
    select count(*) into v_count
      from res_security_logs
     where user_id is null
       and created_at > now() - interval '1 minute';
    if v_count >= 60 then
      raise exception 'rate_limited: too many anonymous security log entries';
    end if;
  end if;
  return new;
end;
$function$;
