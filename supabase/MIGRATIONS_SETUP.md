# Supabase migrations — one-time setup (READ BEFORE deploy.yml runs `db push`)

> **Status (2026-09-27):** `supabase/migrations/` now exists and holds the pending
> fixes as idempotent migrations (see DB_UPDATE_RUNBOOK.md). They are written to
> be safe on the EXISTING production database, so `db push` can apply them without
> a pulled baseline. A `supabase db pull` baseline is still worth taking once the
> project is restored: it is the only way to capture what the live DB has that
> the repo does not (the contract check found ~59 RPCs the app calls that no repo
> file defines). If you add one, mark it applied rather than running it:
> `supabase migration repair --status applied <baseline_version>`.

The CD pipeline (`.github/workflows/deploy.yml`) runs `supabase db push`, which applies
files in `supabase/migrations/*.sql` that haven't been applied yet.

⚠️ **Do NOT copy the `schema_part_*.sql` files into `migrations/` and push them to
production.** Those are the *build-from-scratch* schema (some statements aren't
idempotent) and your production DB already exists — pushing them would error on
duplicate policies/columns.

## Correct adoption on an EXISTING production database (do this once)

```bash
# 1. Link the CLI to your project
supabase login
supabase link --project-ref <your-project-ref>

# 2. BASELINE: snapshot the live schema as the first migration so the CLI knows
#    the current state and won't try to recreate everything.
supabase db pull            # writes supabase/migrations/<ts>_remote_schema.sql
git add supabase/migrations && git commit -m "chore: baseline supabase schema"

# 3. From now on, make schema changes as NEW migrations:
supabase migration new add_my_feature      # creates an empty timestamped file
#   …write your idempotent ALTER/CREATE in it…
supabase db push                            # applies only the new migration
```

After the baseline exists, the `database-migrations` job in `deploy.yml` becomes
safe: each push only applies migrations created since the last deploy.

## Where the schema lives now
- `supabase/queries/schema_part_1..4.sql` — the canonical full schema (fresh-DB
  install, in order). Patches `01–19` are folded in; next patch number is **20**.
- New ongoing changes → a timestamped file via `supabase migration new …` (above),
  kept idempotent (`IF NOT EXISTS` / `OR REPLACE` / `DROP POLICY IF EXISTS`).

## Pre-deploy DB readiness
Run `scripts/db-preflight-audit.sql` in the SQL Editor before a release — it flags
tables missing RLS, FKs without indexes, and anon-readable PII (read-only, no changes).