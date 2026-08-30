-- ─────────────────────────────────────────────────────────────────────────────
-- client_error_status() — make the drift reporter's output visible to Guardian.
--
-- resilience.js fires reportDegraded() the moment a FALLBACK tier wins, because
-- "a fallback tier succeeding is not success — it means the intended path is
-- dead and nobody noticed." That signal is written to client_errors… and until
-- now nothing on earth read that table. The alarm designed to catch silent
-- breakage was itself silent.
--
-- This is the read side, shaped exactly like maintenance_status(): SECURITY
-- DEFINER, aggregates only, granted to anon so the Guardian workflow can call
-- it with the anon key.
--
-- PRIVACY: returns COUNTS and LABELS only. Labels are code paths
-- ('CheckIn.touchDown', 'drift:map:events_in_bbox') — not user data. No user
-- ids, no messages, no context blobs, ever. Keep it that way: the moment this
-- returns a message body it becomes a PII exfiltration endpoint open to anon.
--
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

create index if not exists client_errors_created_at_idx
  on public.client_errors (created_at desc);

create or replace function public.client_error_status(p_hours integer default 24)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with win as (
    select label, created_at
    from public.client_errors
    where created_at >= now() - make_interval(hours => greatest(1, least(p_hours, 168)))
  ),
  by_label as (
    select label, count(*) as n
    from win
    group by label
    order by count(*) desc
    limit 20
  )
  select jsonb_build_object(
    'window_hours', greatest(1, least(p_hours, 168)),
    'total', (select count(*) from win),
    -- A degraded tier means the PRIMARY path is broken and a fallback is
    -- carrying it. These are the ones worth waking someone for.
    -- Prefixes come from App.js's drift reporter: logError(`${kind}:${label}`)
    -- where kind is one of SCHEMA_DRIFT / DEGRADED_PATH / CIRCUIT_OPEN
    -- (resilience.js). If those strings ever change, this goes quietly to zero —
    -- which is why the sensor also asserts on `total`, not just these three.
    'degraded',     (select count(*) from win where label like 'DEGRADED_PATH:%'),
    'drift',        (select count(*) from win where label like 'SCHEMA_DRIFT:%'),
    'circuit_open', (select count(*) from win where label like 'CIRCUIT_OPEN:%'),
    'top_labels', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'count', n)) from by_label), '[]'::jsonb),
    'checked_at', now()
  );
$$;

grant execute on function public.client_error_status(integer) to anon, authenticated;

comment on function public.client_error_status(integer) is
  'Aggregate counts of client_errors for the Guardian sensor. Labels + counts only — never messages, user ids or context.';
