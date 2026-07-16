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
