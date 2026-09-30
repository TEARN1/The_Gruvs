# Database Baseline — findings and the 5-minute fix

_Audited 2026-09-30 directly against the live project `feevvddvrjmfbhffccbf` ("The Gruvs",
Postgres 17.6, eu-west-1) via read-only queries on `supabase_migrations.schema_migrations`._

This supersedes the "0 versioned migrations" line in `SYSTEM_DESIGN.md` §0, which was measured
from the repo only and was wrong about the system as a whole.

---

## 1. What is actually true

| Fact | Value |
|---|---|
| Migrations recorded in the live DB | **198** (`20260414173800` → `20260928170003`) |
| Migrations in `supabase/migrations/` in this repo | **0** |
| Recorded migrations whose stored SQL is real DDL | **174** |
| Recorded migrations whose stored SQL is **a comment, not DDL** | **13** |
| Recorded migrations with trivially small SQL (<200 B, mostly single `ALTER`/`REVOKE`) | **11** |
| Total stored SQL | 647 kB |

So the history is **not missing** — it is **unversioned and partly hollow**.

## 2. The real problem: 13 hollow foundation records

Thirteen records contain no schema at all. Their entire stored "SQL" is a note, e.g.:

```sql
-- Pre-applied via SQL Editor: Core social graph, profiles, follows, events,
-- vibes, saves, reactions, echoes, ratings, check-ins, gallery, notifications,
-- routes, pulse, messages
```

They are, in order:

```
20260525202000  01_gruvs_social          20260526080000  08_business_and_ads
20260525202001  02_part_2                20260526080500  09_ai_and_analytics
20260525202002  03_untitled_reels_full   20260526080700  10_push_notifications
20260525202003  04_untitled_pulse        20260526080900  11_realtime
20260525202004  05_reels_likes_comments  20260526081200  12_security_hardening
20260525202005  06_reels_and_storage     20260526095000  13_reel_comment_likes
20260526075800  07_gruvs_social
```

These are precisely the **foundational** migrations — the core social graph, events, messages,
reels and the first security pass. Every later migration builds on the tables they created.

**Consequence:** the recorded history cannot rebuild the database. Replaying all 198 records
against an empty Postgres fails, because migration 14 onward `ALTER`s and `REFERENCES` tables
that no recorded statement ever `CREATE`s.

**Why this matters more than a missing baseline:** `deploy.yml`'s `migration-preflight` job
applies pending migrations to a throwaway Postgres and gates the production `db push` on it.
That gate is only as good as the history it replays. Armed against this history it would give
**false confidence** — a green preflight that proves nothing about prod. This is the single
highest-leverage fix in the repo.

A further 11 records hold real but trivial SQL (a single `ALTER TABLE … ADD COLUMN`, a `REVOKE`).
Those are legitimate; they are listed only so the 174/13/11 split reconciles.

## 3. Why this could not be finished from the cloud session

A correct baseline is a **schema dump of the live database** (`supabase db pull`, i.e. `pg_dump`
of the target). That needs a direct Postgres connection with the database password. The session
had read-only SQL access through the Supabase MCP tools — enough to *diagnose* precisely, not
enough to *dump*. The password is deliberately not in the repo, the environment, or this session.

Two alternatives were considered and rejected:

- **Reconstruct the 174 real migrations verbatim** (the SQL is recoverable from
  `schema_migrations.statements`, and was verified byte-exact over a base64 + MD5 round-trip).
  Rejected as the primary fix: it version-controls the history but still cannot rebuild from
  scratch, because the 13 foundation records stay empty. It is a record, not a baseline.
- **Hand-reconstruct DDL from the system catalogs** for 145 tables, 127 functions, RLS policies
  and triggers. Rejected: hand-rolled DDL risks silent divergence from the real schema, which is
  the exact failure mode a baseline exists to prevent.

## 4. The fix — run this locally (~5 minutes)

Requires the Supabase dashboard login and the project's database password
(Dashboard → Project Settings → Database → Connection string / Reset password).

```bash
cd /path/to/The_Gruvs

# 1. Authenticate the CLI (opens a browser for a personal access token).
npx supabase login

# 2. Link this repo to the live project. Prompts for the DB password.
#    config.toml already pins the project ref, so no --project-ref is needed.
npx supabase link

# 3. Confirm the CLI agrees with what this audit found:
#    Remote should list 198 migrations, Local none.
npx supabase migration list

# 4. THE BASELINE. Dumps the live schema into one migration file and marks the
#    remote history as already-applied, so it will never re-run against prod.
npx supabase db pull

# 5. Verify: a new file appeared, and there is nothing pending either way.
ls -la supabase/migrations/
npx supabase db diff          # expect: "No schema changes found"
```

Step 4 is the whole job. It writes something like
`supabase/migrations/20260930######_remote_schema.sql` — that file is the baseline.

### Safety notes

- `db pull` **reads** from production. It does not alter your schema or data.
- It may also write `supabase/.temp/` — that is local scratch, safe to gitignore.
- If step 4 reports the local/remote histories disagree, do **not** reach for
  `supabase db push` (it would try to apply SQL to prod). Use
  `npx supabase migration repair --status applied <version>` to record a version as
  already-applied, then re-run `db pull`.
- Commit the generated baseline file as-is. Do not hand-edit it.

## 5. After the baseline exists

In order, each step now unblocked:

1. **Commit the baseline.** From here every schema change is
   `supabase migration new <name>` → edit → `db push`. No more dashboard SQL Editor pastes,
   which is what created the 13 hollow records in the first place.
2. **Arm `migration-preflight` for real.** It finally replays a history that can build the DB
   from zero, so the gate means something.
3. **Make `db-schema-ci` a required check** rather than advisory.
4. **Retire `supabase/queries/`.** Its 66 loose `.sql` files are the de-facto schema today. Once
   the baseline lands they become historical reference — move them to
   `supabase/queries/archive/` so nobody pastes one into the dashboard again.
5. **Enable PITR** and write the one-page rollback runbook (`AUTOMATION_READINESS.md` #9).

## 6. Effect on the completion estimate

`SYSTEM_DESIGN.md` scored layer 14 (Database schema & RPCs) at 70% and the system at ~82%,
capped by "no versioned migrations". With the true picture — history exists, is unversioned,
and is unreplayable at the foundation — the layer score is unchanged at **70%**, but the reason
is sharper and the fix is smaller: one command, not a reconstruction project.

Once the baseline is committed and preflight is armed, layer 14 reaches ~90% and the system
moves to **~88%**.

---

# Addendum — live database audit, 2026-09-30

The `db pull` baseline is still outstanding (this cloud container is a separate checkout
with no access token or database password, so `supabase db pull` returns
`ProjectRefNotLinkedError` regardless of the link on your machine). Everything below was
done instead, over the MCP connection to the live project.

## Advisor results

| Finding | Level | Before | After |
|---|---|---:|---:|
| `authenticated_security_definer_function_executable` | WARN | 303 | 250 |
| `rls_enabled_no_policy` | INFO | 33 | 33 |
| `anon_security_definer_function_executable` | WARN | 32 | 26 |
| `extension_in_public` | WARN | 4 | 4 |
| `security_definer_view` | ERROR | 3 | 3 |
| `function_search_path_mutable` | WARN | 1 | **0** |
| `rls_disabled_in_public` | ERROR | 1 | 1 |
| `materialized_view_in_api` | WARN | 1 | 1 |
| `auth_leaked_password_protection` | WARN | 1 | 1 |
| **Total** | | **379** | **319** |

## Fixed (migration `20260930034247`)

1. **`public.current_app_id()` had no pinned `search_path`.** It is called inside the
   `public_profiles` view, so a mutable `search_path` there is a genuine
   resolution-hijack surface. Pinned to `public, pg_temp`. No behaviour change — the
   function only calls `current_setting()`. It arrived with the recent `x-app-id` work,
   so it was a fresh regression.
2. **`EXECUTE` was granted to `PUBLIC`/`anon`/`authenticated` on 76 trigger functions.**
   Trigger functions must never be directly callable. Revoked. Verified safe two ways:
   no trigger function is called via `.rpc()` anywhere in the client, and trigger firing
   does not consult `EXECUTE` privilege. Post-change: **155 triggers enabled, 0 disabled.**
   The 2 still granted are PostGIS-owned (`checkauthtrigger`, `postgis_cache_bbox`) and
   deliberately excluded.

Applied with `apply_migration`, so its SQL **is** stored in `schema_migrations` — unlike
the 13 hollow records in §2. That is the discipline going forward, and this repo now holds
the matching file under `supabase/migrations/`.

## Deliberately NOT changed, with reasons

**The 3 `security_definer_view` ERRORs are intentional design, not defects.** Flipping them
to `security_invoker = true` — the naive way to clear the linter — would cause an outage:

- `res_public_services` → `SELECT <safe columns> FROM res_handyman_services WHERE show_publicly`
- `res_public_vendors` → `SELECT <safe columns> FROM res_vendors WHERE show_publicly`
- `public_profiles` → a curated projection of `profiles`, joined to `app_user_profiles`

Each is guarded twice: an explicit column allow-list and a `WHERE show_publicly` predicate.
They run as definer precisely *because* the base tables have PII column grants revoked
(`lock_authenticated_pii`, `lock_profile_coordinates`). Under `security_invoker` the
caller's RLS and column grants would apply and `anon` would get empty results — breaking
the public directory and profile display app-wide.

To satisfy the linter properly the fix is not a view flag: add explicit `anon` SELECT
policies on the base tables scoped to `show_publicly`, move enforcement into RLS, *then*
flip to invoker. That has real blast radius and wants its own migration plus a staging
test — not a drive-by.

**The 33 `rls_enabled_no_policy` tables are correctly fail-closed, not broken features.**
All 33 were cross-referenced against every `.from()` call in the client: **zero overlap**.
They are dormant/legacy (`ai_predictions`, `vip_bids`, `vibe_tuning_sessions`,
`social_relations`, `groups`, `blocks`, `comments`, …). RLS on with no policy means
deny-all, the right posture for a table nothing reads. Worth a cleanup pass to drop what is
truly dead, but not a live defect.

**`rls_disabled_in_public: spatial_ref_sys`** is a PostGIS system table you do not own and
cannot enable RLS on. Writes were already revoked by `revoke_spatial_ref_sys_public_writes`.
Accepted.

**`extension_in_public`** (postgis, vector, pg_trgm, unaccent): relocating extensions on a
live database rewrites every dependent reference. Risk exceeds benefit. Revisit only in a
planned maintenance window.

**`materialized_view_in_api: leaderboard_snapshot`** has no SELECT grant to `anon` or
`authenticated`, so it is not actually reachable through the API despite the warning.

**`auth_leaked_password_protection`** is a dashboard toggle, not SQL: Authentication →
Providers → Password → enable "Prevent use of leaked passwords". One click, user-only.

## Still yours to run

`npx supabase db pull` on your linked machine remains the one step that produces a
rebuildable baseline, which is what unblocks arming `migration-preflight`. The hollow
foundation records in §2 are unaffected by today's work.
