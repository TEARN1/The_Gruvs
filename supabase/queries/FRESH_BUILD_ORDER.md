# Fresh-build run order — `schema_part_*.sql`

## The problem
The four `schema_part_*.sql` files are a **byte-faithful concatenation of the original
numbered migrations (01 → 33), in NUMBER order — which is NOT dependency order.**

The authoritative base schema (`profiles`, `events`, `event_rsvps`, `follows`,
`security_logs`, …) is **`13_schema_v5.sql`**, which sits at the **start of
`schema_part_2.sql`** (lines ~14–1884). It is self-contained and idempotent:

> "Single authoritative file. Replaces all previous patches. Fully idempotent —
>  safe to run on a fresh OR existing project."

But `schema_part_1.sql` (the original blocks `01_security_hardening` … `11_…`,
plus the `12_gruvs_social` base tail) references those base tables/functions
**before** they exist when run first. A top-down run of part_1 on an EMPTY db
fails almost immediately, e.g.:

- `schema_part_1.sql:116` — `CREATE INDEX … ON public.blocked_users` (table not created until L2404)
- `schema_part_1.sql:157` — `GRANT EXECUTE … secure_check_in` (function not defined until L1576)
- `schema_part_1.sql:327` — `ticket_tokens … REFERENCES public.events` (events not created until L2420)

## The remedy — run order for a FRESH database

Run the files in this order in the Supabase SQL editor:

1. **`schema_part_2.sql`** — starts with the authoritative base (`13_schema_v5`),
   then the v5 patches (14–18). This stands up the whole core schema.
2. **`schema_part_3.sql`** — sports / clubs / talent platform (19–28).
3. **`schema_part_4.sql`** — tournaments, governance, `events.end_date`,
   `profiles.writing_style`, plus the idempotent 01–20 patch tail.
4. **`schema_part_1.sql`** — run **LAST**. Its base tables (`12_gruvs_social`) are
   now `IF NOT EXISTS` no-ops; its 01–11 extras (push tokens, AI cache, business,
   realtime, analytics) reference base objects that already exist.

> ⚠️ This order is **reasoned from the file contents, not yet validated against a
> live Postgres** (no DB / Supabase CLI was available when it was written). Run it
> against a throwaway Supabase branch/project first and watch for any remaining
> forward reference before trusting it on a real fresh build.

## For an EXISTING (already-built) database
Just re-run whichever `schema_part_*.sql` you need — the `IF NOT EXISTS` /
`CREATE OR REPLACE` / `DROP … IF EXISTS` guards make them effectively idempotent
on a populated DB regardless of order. The pending feature migrations
(tournaments, `end_date`, `writing_style`, reels columns, …) live in the
idempotent **01–20 tail of `schema_part_4.sql`** and are safe to run as-is.

## Going forward
Append new SQL to the latest `schema_part_*` file (≤4000 lines/file), in number
order, idempotent. Originals are preserved in `supabase/queries/archive/`.