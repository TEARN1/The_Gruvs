# 🚀 SQL Deploy Runbook — everything waiting on the database

**How to run:** Supabase Dashboard → your project → **SQL Editor** → New query →
paste ONE file's full contents (from `supabase/queries/`) → **Run** → check the
✅ before moving to the next. Every file is idempotent — re-running is safe.
Total time: ~15 minutes.

> Alternative: reconnect the Supabase MCP in Claude and say "apply the runbook" —
> I'll run these in order and verify each.

---

## Part 1 — Independent (any order, run all)

| # | File | What switches on | ✅ Check after |
|---|---|---|---|
| 1 | `checkin_verification.sql` | Server-verified Touch Downs (GPS-spoof defence) | insert a test check-in with far coords → `verified=false` |
| 2 | `data_retention.sql` | Retention cleanup (POPIA) | runs clean |
| 3 | `username_skeleton.sql` | Username impersonation defence | runs clean |
| 4 | `vibe_equity_column.sql` | Equity gets its own column — mint/burn stop touching `vibe_score` | `select vibe_equity from profiles limit 1;` |
| 5 | `boosted_slot.sql` | Paid boosts actually place a labeled "Promoted" card | `select * from get_boosted_hosts();` (empty is fine) |
| 6 | `web_push.sql` | Closed-tab web push storage | `select count(*) from web_push_subscriptions;` → 0 |
| 7 | `verification_engine.sql` | In-app Verified applications (criteria checked server-side) | `select request_verification();` as a NEW user → should REJECT with "account too new" |
| 8 | `messages_block_gate.sql` | No DM crosses a block, even via direct REST | insert a message across a test block → raises `blocked` |
| 11 | `schema_drift_columns.sql` | **✅ ALREADY APPLIED LIVE 2026-07-19.** Adds 7 columns the client has always written to but which never existed (revives vibe_equity minting, sports match_card, route ETAs, partnership requests, deletion fallback) | `select last_mint_at from profiles limit 1;` |
| 10 | `event_chat_hardening.sql` | **✅ ALREADY APPLIED LIVE 2026-07-19.** Hosts/mods can no longer rewrite attendee messages; the `can_send_chat` ban gate now exists (it never did); `banned` role + `granted_by` column added | as a host, `update event_chat_messages set message='x'` on an attendee's row → raises `a chat message cannot be edited once sent` |
| 9 | `messages_send_hardening.sql` | **✅ ALREADY APPLIED LIVE 2026-07-19.** One validated DM send path (`send_message_v2`), column-level update guard, fixed cold-open gate, idempotency, length caps | as user A, `update messages set request_accepted=true` on your OWN sent row → raises `only the recipient can accept a request` |
| 12 | `event_drafts.sql` | **✅ ALREADY APPLIED LIVE 2026-07-19.** Co-created events: a group fills a shared draft together (per-field attribution + claims stamped server-side), confirms, and `draft_launch` promotes it to `events` + grants co_host roles; `draft_fork_event` = "run it back" (host-only fork, date never copied). RPC-only writes; see MESSAGING_FEATURES_SECURITY.md | `insert into event_drafts …` as authenticated → RLS denies (writes are RPC-only) |
| 13 | `event_draft_tasks.sql` | **✅ ALREADY APPLIED LIVE 2026-07-19.** Shared prep checklist on a plan (add/toggle/assign/delete via RPCs, done_by attribution, members-only, 100-task cap). Depends on #12 | `select draft_task_add('00000000-0000-0000-0000-000000000000','x');` → raises `not a member of this draft` |
| 14 | `maintenance_status.sql` | Maintenance sensor: PII-free `maintenance_status()` RPC that Guardian's 6-hourly watchdog calls (until then the watchdog reports "not deployed" and stays green) | `select maintenance_status();` → jsonb; then `node scripts/audit-maintenance.mjs` locally → "✅" or explicit warnings |
| 15 | `maintenance_levels.sql` | Leveled self-maintenance: L1 daily (location purges, dead ticket credentials, dead push subs, overdue-deletion detection) + L2 weekly (notifications, security_logs, snapshots, client_errors) + `maintenance_runs` paper trail. Run AFTER #2, #14, and #16 (defensive either way — every step guards on `to_regclass`). Schedules only register if pg_cron is already on (Part 4), so do Part 4 first or re-run this file after the toggle | as service role: `select run_maintenance_l1();` → jsonb of purge counts; `select maintenance_status();` → `levels.L1.last_run_days_ago` ≈ 0 |
| 16 | `client_errors_anon_write.sql` | **Found 2026-07-20 diagnosing a landing-page crash report.** `client_errors` (the crash-telemetry table `logError.js` writes to) silently REJECTS every insert from a signed-out session — RLS `42501`, swallowed by the fire-and-forget insert. Every guest-mode crash has been invisible. Write-only policy for anon+authenticated; no SELECT | as anon (no session): `POST .../rest/v1/client_errors {"label":"x","message":"y"}` → `201`, not `401` |

## Part 2 — The Resident chain (STRICT order)

| # | File | What switches on |
|---|---|---|
| 8 | `resident_schema_v2.sql` | All 25 `res_*` tables (rooms, lifts, market, safety…) |
| 9 | `resident_trust_bridge.sql` | Resident completeness → Gruvs trust (`res_sync_trust`, `resident_trust_tier`) |
| 10 | `resident_marketplace_gate.sql` | Only trusted users can sell (`res_can_sell` RLS) |

✅ Check: `select res_sync_trust();` as a user with no res_profile → returns NULL (not an error).

## Part 3 — PII lock (two-step, deliberately careful)

11. `lock_authenticated_pii.sql` — run **PART 1 only** (the `get_my_profile()` RPC),
    then log into thegruvs.com and confirm your own profile + edit screen load.
    Only then run **PART 2** (the column revoke). If anything breaks, PART 2 is
    what to revert — PART 1 is harmless.

---

## Part 4 — Dashboard clicks (not SQL)

1. **Function secrets** (Settings → Edge Functions → Secrets):
   - `VAPID_PRIVATE_KEY` = value in your local `.env` (never in git)
   - `VAPID_SUBJECT` = `mailto:asemahlenkwali@gmail.com`
2. **Redeploy `push-notify`** (its code changed: web push + beacon priority):
   `supabase functions deploy push-notify --no-verify-jwt` (or via MCP when connected).
3. **Auth → leaked-password protection** — the long-standing toggle.
4. **Database → Extensions → enable `pg_cron`**, then re-run
   `maintenance_levels.sql` (its final block registers the L1 daily / L2 weekly
   schedules only when the extension exists). Verify: `select jobname from
   cron.job;` → `gruvs-maintenance-l1`, `gruvs-maintenance-l2`. From then on
   Guardian's maintenance job enforces retention instead of assuming it.

## Part 5 — Flip the flags + ship the web build (after Parts 1–4)

In `src/constants/launchConfig.js`:
- `residentAlerts: true` and `accommodation: true` (Stays lights up once a few
  `res_listings` are seeded — do that from The Resident or the SQL editor).

Then push/deploy the web build (ships the v3 service worker for closed-tab push).

## The 60-second proof it all worked
1. Phone browser → thegruvs.com → Settings → push ON → close every tab →
   DM yourself from another account → **it pops on the lock screen**.
2. Open an event in a city with a seeded listing → **"Stays" section shows**.
3. Profile → Powers & Standing → **"Get Verified" checklist renders**.
4. As an unverified test user: `insert into res_market_items …` → **RLS rejects**.
5. Next morning: `select level, ok, detail from maintenance_runs order by
   started_at desc limit 3;` → **an L1 row with ok=true** — the platform has
   started cleaning up after itself, and Guardian will notice if it ever stops.
