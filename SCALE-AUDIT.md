# The Gruvs — Five-Year Load Audit

**Question asked:** can this app still run under stress five years from now?

**Short answer:** the server-side foundations are in better shape than most apps
this age — retention, maintenance and monitoring are genuinely well built. The
real exposure is in two places: **one index the build silently gets wrong**, and
**how much data the client pulls to the phone**. The first is fixed here and
measured. The second is mapped, with the largest items fixed and the rest listed.

Everything below was measured or derived from the code, not estimated.

---

## What is already right

Worth stating plainly so it does not get re-audited or "fixed":

| Area | State |
|---|---|
| **Data retention** | `maintenance_levels.sql` L1/L2 purge location history, dead QR tokens, dead push subscriptions, notifications (30d read / 90d all), security logs (180d), analytics snapshots (1y), and the maintenance log itself. Windows live in one place (`data_retention.sql`). |
| **Retention monitoring** | `maintenance_status.sql` is a PII-free sensor RPC; `scripts/audit-maintenance.mjs` polls it 6-hourly and alarms when the platform stops cleaning up. Someone genuinely thought about "who maintains the maintainers". |
| **Query shape** | Of 171 reads without an explicit `.limit()`, **65 are scoped to a single event/match** and bounded by nature. Only **4** have no scope at all, and two of those are `insert().select()` returning what was just written. |
| **Storage** | Bucket policies pin every write to the caller's own folder. |
| **Render resilience** | `audit-resilience.mjs` enforces an ErrorBoundary/Suspense contract in CI. |

The gap is not a missing plan. It is a small number of places where the plan and
the code disagree.

---

## 🔴 Finding 1 — the build creates the wrong index on the hottest read path

`idx_messages_recipient` is defined **twice, differently**:

```
schema_part_4.sql:1288   ON public.messages (recipient_id)
schema_part_1.sql:2845   ON public.messages (recipient_id, created_at DESC)
```

Every index here uses `CREATE INDEX IF NOT EXISTS`. Fresh-build order is
**2 → 3 → 4 → 1**, so part_4 runs first, the narrow index wins, and part_1's
composite silently does nothing. No error, no warning.

But every inbox read is
`.eq('recipient_id', uid).order('created_at', { ascending: false })`
(`dataFlow.js:2648-2651`) — so Postgres sorts the user's entire message history
on every inbox open.

**Measured on 400,000 messages across 2,000 recipients:**

| per-user history | `(recipient_id)` | `(recipient_id, created_at DESC)` | gap |
|---|---|---|---|
| ~200 messages | 0.814 ms | 0.166 ms | **5×** |
| 50,000 messages | **9.068 ms** | **0.156 ms** | **58×** |

The narrow index degrades to a parallel `Gather Merge` — Postgres throwing
workers at sorting the whole history. The composite reads 30 rows in order and
stops, so it is **flat**: identical time at 200 messages and at 50,000.

That is the whole five-year question in one row. The cost of the wrong index
grows with every message a user ever receives; the right one does not move.

**Fixed** in `supabase/queries/index_reconciliation.sql`.

## 🟠 Finding 2 — 12 index names mean different things in different files

The same silent-overwrite mechanism appears 12 times. Which index production
actually has depends on the order files were applied in — which, for a database
built up over time by hand, nobody can now reconstruct.

Seven are live (two build-order files disagree) and are pinned by the
reconciliation file. Five are latent: they only involve `schema_v6_proposed.sql`
and `schema_v6_idempotent.sql`, which the build does not apply.

## 🟠 Finding 3 — 12 duplicate indexes, worst on the highest-write tables

Same table, same columns, different name. Zero read benefit; paid for on **every
insert and update** in WAL, disk, vacuum work and bloat.

`reels` — the feed, the highest-write table — carried:
- **4** plain `(created_at DESC)` indexes: `idx_reels_created`, `idx_reels_created_at`, `idx_reels_created_at_idx`, `idx_reels_feed`
- **3** `(user_id)` indexes, all redundant with `(user_id, created_at DESC)`
- **3** copies of the same `WHERE is_deleted = false` partial

Also `idx_event_rsvps_id ON event_rsvps(id)` — the primary key already indexes
`id`, so that index has never served a single query.

**Fixed.** Partial indexes are deliberately **kept**: they are narrower and
cheaper, not duplicates.

---

## Fixes applied

| | |
|---|---|
| `supabase/queries/index_reconciliation.sql` | Declarative DROP-then-CREATE for every name it owns, so the end state is identical regardless of what the database has now or what ran in what order. Guarded per table, idempotent, verified by applying twice. |
| `scripts/audit-indexes.mjs` | Static check, wired into CI and `npm run preflight`. **Fails** when two build-order files define one name differently; **warns** on latent collisions and duplicates. Negative-tested: introducing a conflicting definition exits 1; removing it exits 0. |

Dropping an index never loses data. Every index dropped is either an exact
duplicate of one kept, or a strict prefix of one kept (a composite serves prefix
lookups, so `(user_id)` is redundant once `(user_id, created_at DESC)` exists).

**To apply:** paste `index_reconciliation.sql` into the Supabase SQL editor.
Re-run it after any `schema_part_*` replay — those files will recreate the
ambiguous names.

---

## Still open — client-side data volume

The largest remaining exposure, and the one that needs product judgement rather
than a migration.

**102 reads are scoped to a user but have no `.limit()`.** They are correct
today and get slower every year, because they pull a whole result set to the
phone:

| table | sites | grows with |
|---|---|---|
| `profiles` | 10 | discovery result size |
| `event_rsvps` | 9 | every RSVP a user has ever made |
| `follows` | 9 | a popular account's entire follower list, in one response |
| `user_blocks` | 4 | lifetime blocks |
| `event_stamps`, `saved_events`, `paths`, `event_checkins` | 9 | lifetime, per user |

`follows` is the one to look at first: an account with 50,000 followers returns
50,000 rows to a phone on mobile data.

**Also:** 109 reads use `select('*')`. Beyond bandwidth, `*` silently picks up
every column added later — which is how a private column reaches a client
nobody intended. `AuthContext` already avoids this with an explicit
`PROFILE_FIELDS` list; that pattern should spread.

Neither is fixed here. Both change what the UI receives, so they want pagination
decisions per screen rather than a blind `.limit()` — that is a product call,
not a mechanical one.

## Depends on a setting nobody can see from the code

The retention machinery is conditional:

```sql
if exists (select 1 from pg_extension where extname = 'pg_cron') then
  perform cron.schedule('gruvs-maintenance-l1', ...);
else
  raise notice 'pg_cron not enabled — schedules skipped.';
end if;
```

If **pg_cron is not enabled** on the project, none of the retention in this repo
has ever run, and every table named above has been growing since day one. The
watchdog exists to catch exactly this. **Confirm it is on**, in
Supabase → Database → Extensions, and confirm `audit-maintenance.mjs` is
actually reporting green.
