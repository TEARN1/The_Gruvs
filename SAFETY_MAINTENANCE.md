# Safety Maintenance — the leveled plan

**Principle: cadence tracks consequence.** Data that can hurt a user purges
daily and pages loudly; data that only wastes space cleans weekly and whispers;
anything needing judgment stays human and scheduled.

Maintenance makes the app safe in ONE dimension — what the database can be
made to reveal. The other walls (RLS, enforcement RPCs, moderation, drills)
are listed here too so this file is the whole safety-upkeep picture, not a
comforting slice of it.

## The levels

| Level | Cadence | What | Watchdog |
|---|---|---|---|
| **L0** | continuous | Self-cleaning semantics (`expires_at`, read-filters). Prefer L0 over any job — a table that can't accumulate garbage beats a job that cleans it. | none needed |
| **L1** | daily 02:10 | **Legal/safety layer**: location purges (checkins 90d / crossings 30d), dead ticket credentials, dead push subscriptions, overdue account-deletion detection | **strict**: red at +3d, or ANY overdue deletion |
| **L2** | weekly Sun 02:40 | **Hygiene layer**: notifications (30/90d), security_logs (180d), analytics snapshots (365d), the maintenance log itself, leaderboard matview refresh | lenient: warn at +14d |
| **L3** | monthly | **Deep sweep**: orphaned Storage objects (chat media w/o message, images w/o event), denormalised-count drift | advisory only — *not built yet; needs an edge function* |
| **L4** | quarterly | **Human-only** (below) | checklist, never automated |

Machinery: `supabase/queries/maintenance_levels.sql` (runners + `maintenance_runs`
paper trail + pg_cron schedules) · `maintenance_status()` RPC (aggregates only,
anon-safe) · `scripts/audit-maintenance.mjs` in Guardian's 6-hourly schedule.

The watchdog double-checks **outcomes**, not just the log: even if a runner
logs "ok", oldest-row ages beyond window+slack still go red. A runner with a
window bug must not be able to report itself healthy.

## L4 — the quarterly human checklist

Do these as a real user on production, ~15 minutes. Enforcement must be
*exercised*, not assumed — a safety feature you've never pressed is a hope.

- [ ] **Panic mode**: trigger it from a test account. Did everything it
      promises actually happen?
- [ ] **Block**: block a test account, then try to DM/see the blocker from it.
      Both directions, client AND direct REST.
- [ ] **Report**: file a report; confirm it lands in the moderation queue AND
      that you actually look at that queue (an unread queue = wallpaper alarm).
- [ ] **Account deletion**: request on a test account; confirm the pipeline
      completes and the data is gone.
- [ ] **Restore drill**: restore the latest Supabase backup to a scratch
      project. A backup never restored is a hope, not a backup.
- [ ] **Advisor re-run**: Supabase security/performance advisors; triage new.
- [ ] **Dependency review**: Dependabot PRs + `npm audit` triage.
- [ ] Re-read `KNOWN-REMAINING` in the latest security audit memory/doc — has
      anything sat "known" for two quarters? Fix or accept it explicitly.

## New geo/location feature checklist (RISK_REGISTER.md C4)

Every location leak this app has ever had came from a new geo feature
shipping without this. Run through it before merging anything that stores or
displays a user's coordinates (Home-area, Path Map, or anything after them):

- [ ] Precise lat/lon is written via a server-side RPC, never a direct
      client `.insert()`/`.update()` on a table holding raw coordinates.
- [ ] RLS on the table: can a signed-in user who is NOT the owner (and not an
      explicit consenting party, e.g. a crossed-path match) SELECT the row?
      Test it — don't assume the policy does what the comment says.
- [ ] Run `node scripts/sec-probe.js` after the migration lands — it now
      covers `live_checkins`/`path_crossings`; add any new geo table to
      `PRIVATE_READ` in that script before shipping.
- [ ] Aggregation (heatmaps, "how busy is it") uses counts/buckets, never
      raw per-user points, at any zoom level a client can reach.
- [ ] A minor's location follows the same age-gate the rest of the app uses
      (`filterByViewerAge`/`canView`) — don't assume a new table inherits it.
- [ ] Cached location on-device (`LocationService._cachedCoords`-style state)
      has a clear invalidation point — don't let stale coordinates outlive
      the session that captured them.

## What this plan does NOT cover (the other walls)

- **RLS/enforcement drift** — 48/99 RPCs currently missing on live DB. Every
  enforcement function in an undeployed SQL file is a control that does not
  exist. Owner: the SQL runbook.
- **Live moderation** — a queue only works if someone reads it.
- **Dashboard toggles** — leaked-password protection etc.; user-only clicks.

## Deploy state (be honest with yourself)

Nothing in L1/L2 runs until: `data_retention.sql` + `maintenance_levels.sql`
are applied (runbook) **and** the pg_cron extension is enabled in the
dashboard (then re-run maintenance_levels.sql to register the schedules).
Until then Guardian's maintenance job reports "not deployed" and stays green —
advisory, not tripwire, so the alarm stays meaningful.
