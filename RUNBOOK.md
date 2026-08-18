# Runbook — solo-dev operations

Written for future-you-in-a-panic. If something is on fire, start here instead
of reconstructing this from memory. Covers RISK_REGISTER.md items C1 and C9.

## Where things live

- **Live app**: thegruvs.com — served by nginx from `/var/www/thegruvs` on the
  DigitalOcean droplet `144.126.236.75` (root via `id_ed25519`).
- **Database**: Supabase project `feevvddvrjmfbhffccbf` — Postgres + RLS +
  Edge Functions (Deno). Dashboard is the source of truth for anything the
  safety classifier here won't apply automatically (privilege-changing SQL —
  `REVOKE`, `ENABLE ROW LEVEL SECURITY`, role grants).
- **SQL history**: `supabase/queries/*.sql`, one file per change, applied via
  MCP `apply_migration` where possible, manually pasted into the Supabase SQL
  Editor when the safety classifier blocks it (privilege changes).
- **Deploy**: build local → tar-over-ssh to the droplet → nginx serves the
  static build. Never Vercel — see feedback memory on that. Native builds
  (Expo/EAS) are separate and not yet in a real device pipeline.
- **Secrets**: `.env` locally (Supabase URL/anon key, VAPID keys). No
  service-role key or paid-API key is ever bundled client-side.

## If the app is down (web)

1. SSH to the droplet: `ssh -i ~/.ssh/id_ed25519 root@144.126.236.75`
2. Check nginx: `systemctl status nginx` — restart if needed:
   `systemctl restart nginx`
3. Check the build actually exists: `ls -la /var/www/thegruvs`
4. Check Supabase project status via the dashboard (paused/rate-limited
   projects look like a dead app from the client side, not a droplet issue —
   rule this out first, it's the more common cause on a free tier).
5. If a bad deploy is the cause: redeploy the last known-good local build
   (rebuild from the last commit you know worked, retar, re-upload).

## If there's a live security disclosure or breach

1. **Don't panic-revoke everything** — a wrong REVOKE can break RLS-gated
   reads for every user, which is its own outage. Confirm the actual blast
   radius first: check `scripts/sec-probe.js` output (anon-key-only, safe to
   run any time — `node scripts/sec-probe.js`) to see what's actually exposed
   right now.
2. Rotate the specific secret involved (Supabase anon key can be rotated from
   the dashboard; this breaks all installed clients until they update — only
   do this for an active exploit, not a theoretical one).
3. Patch the actual hole (RLS policy, function grant, Edge Function bug) via
   `apply_migration` or the SQL Editor, following the existing pattern in
   `supabase/queries/`.
4. Write down what happened in a new dated file under `supabase/queries/` or
   as an addendum to RISK_REGISTER.md — future audits (and future you) need
   the "why," not just the fix.
5. Under POPIA, a breach involving personal data may need notifying affected
   users/the regulator — this is a real legal obligation, not optional. If
   this ever actually happens, get it right rather than fast; consult a
   lawyer before public statements.

## If you (the founder) are unavailable for a while

- Nothing in this app auto-heals a blocked privilege-changing migration —
  those need a human in the Supabase SQL Editor. If you know you'll be
  offline, check RISK_REGISTER.md's 🔴 Critical section isn't hiding
  something time-sensitive first.
- There is no on-call, no second engineer, no support inbox coverage. This is
  a known, accepted risk (C1) — not something this runbook fixes, only
  documents so it isn't a surprise later.

## Recurring manual chores (nothing auto-notifies you for these)

- **New business invoice requests**: query `founder_alerts` in the Supabase
  dashboard (Table Editor or SQL Editor — `select * from founder_alerts where
  acknowledged = false order by created_at`). This table is RLS-locked to
  service-role only by design, so it won't show up in the app; it's a
  founder-only to-do list. Mark a row acknowledged once you've invoiced it.
- **`spatial_ref_sys` RLS is still disabled** (Supabase advisor flags this
  every scan) — it's owned by `supabase_admin`, so the SQL Editor role can't
  `ALTER` it; the migration that tries this skips silently by design. Fix it
  from the Dashboard directly: **Database → Tables → find `spatial_ref_sys`
  → toggle "Enable RLS"**, then add a public-read policy (`USING (true)`) so
  PostGIS geometry lookups keep working. It's non-sensitive SRID reference
  data (~8500 rows), so a public-read policy is the correct fix, not a
  restrictive one.
- **`sec-probe.js` is manual** — `node scripts/sec-probe.js` from repo root.
  Nothing runs it automatically; re-run it after any migration that touches
  RLS, and periodically anyway since it can only prove a real leak on tables
  that currently have rows (an empty table with an open policy looks
  identical to a properly-guarded empty table in its output).

## Common "it looks broken but isn't"

- **"No internet connection" banner while online** — known possible false
  positive, flagged in PLAY_STORE_READINESS.md, root cause not yet confirmed.
- **A feature silently doing nothing** — check if it's one of the 42 dead RPC
  fallback tiers (RISK_REGISTER.md C5) before assuming new breakage.
