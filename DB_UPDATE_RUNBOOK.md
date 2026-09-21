# What to run on Supabase, and in what order

Written from the 14 snippets visible in your SQL editor
(`schema_part_1…4`, `FIX_LIVE_ISSUES`, `security_hardening`, `audit_db_state`,
`fix core writer`, `schema_v6_`, and the five `resident_*` files).

**One caveat first, and it matters:** a saved snippet is not proof something ran,
and running something does not require saving it as a snippet. So the list below
is a strong hint, not a diagnosis. **Step 0 replaces the guesswork.**

---

## Step 0 — find out what you actually have (2 minutes)

Open the SQL editor → new query → paste
[`supabase/queries/APP_DB_CONTRACT_CHECK.sql`](supabase/queries/APP_DB_CONTRACT_CHECK.sql)
→ Run.

It is read-only: it selects from system catalogs only, touches no user data,
writes nothing, returns no PII. Safe on production at any time.

It prints six sections:

1. **Missing RPCs** — of the 118 functions the app calls, which this database
   does not have
2. **Missing tables** — of the 141 tables the app reads or writes
3. **Security posture** — each finding from the audit, red or green
4. **Retention** — whether anything is cleaning up, and whether `pg_cron` is on
5. **Performance** — the one index the schema build silently gets wrong
6. **Table sizes** — what is actually growing

Sections 1 and 2 are generated from the client source, so they cannot drift from
what the app really needs. Regenerate with `npm run audit:contract`.

**Send me the output and I will tell you exactly which files to run.** Everything
below is the likely answer; section 3 of the report is the definitive one.

### Why this is worth two minutes

Every RPC call in the app — 134 call sites — is wrapped in a `resilient()` chain
or a try/catch. **Not one is unguarded.** That is good engineering, and it is
precisely why a missing function never shows up as a crash. It shows up as a
feature that quietly stops working.

`scripts/audit-writes.mjs` records what that already cost once:

> the 2026-07-19 audit found 48 RPCs and 14 write-columns that do not exist on
> the live database — vibe_equity minting, live event updates, crowd votes and
> event role grants had all silently done nothing for months.

---

## Step 1 — 🔴 security, exploitable right now

Run these two first. Nothing else on this page matters as much.

| # | File | What it closes |
|---|---|---|
| 1 | `supabase/queries/definer_rpc_hardening.sql` | **Any signed-in account can make itself an admin** and mint unlimited currency |
| 2 | `scripts/security-rls-fixes.sql` | Exact GPS coordinates of your users readable by anyone with the public key |

**File 1 closes four things**, all reproduced on a local Postgres:

- `protect_profile_trust_columns` was declared `SECURITY DEFINER`, where
  `current_user` is the function *owner*, not the caller. The guard could never
  fire. `UPDATE profiles SET role='admin' WHERE id=<my own id>` succeeded.
- `increment_wallet_balance`, `update_sis_score`, `soft_delete` and
  `restore_deleted` are `SECURITY DEFINER`, granted to every signed-in user, and
  never check `auth.uid()`. One API call mints money, moves anyone's trust score,
  or soft-deletes any row in any table.
- Escrow release was broken in both tiers, so bookings were marked completed and
  **providers were never paid**. Replaced with an authorized, atomic RPC.

> **Do not hand-fix this with a partial revoke.** `REVOKE … FROM authenticated`
> alone leaves the function executable, because Postgres grants EXECUTE to
> `PUBLIC` by default. Verified: after revoking from `authenticated` only,
> `has_function_privilege('authenticated', …)` still returns true. The migration
> revokes `FROM public, anon, authenticated`. Section 3 of the report checks the
> real privilege, so it catches a partial fix.

**After running it**, check whether anyone already used the hole:

```sql
select username, role, is_verified, wallet_balance, social_integrity_score
  from public.profiles
 where role = 'admin' or is_verified = true or wallet_balance > 0
 order by wallet_balance desc;
```

Any admin or verified account you did not grant, or a balance you cannot trace
to a booking, predates the fix.

---

## Step 2 — whatever section 1 of the report lists as missing

The app calls 118 RPCs. These repo files define the ones most likely absent:

| File | Covers |
|---|---|
| `FIX_SOCIAL_RPCS.sql` | follow/unfollow, social graph writes |
| `APPLY_LIVE_FIXES.sql` | the consolidated live-issue fixes |
| `RUN_IN_SUPABASE.sql` | the broad catch-up file |
| `schema_drift_fixes.sql` | `event_rsvps.id` and the ticket/QR check-in path |
| `FIX_COMPETITION_ENGINE.sql` | sports/competition RPCs |
| `verification_engine.sql` | check-in verification |

Run only what the report actually flags. Running all of them blind is how the
schema got ambiguous in the first place.

---

## Step 3 — five-year durability

| File | Why |
|---|---|
| `maintenance_levels.sql` | L1/L2 purges: location history, dead QR tokens, dead push subscriptions, notifications (30d read / 90d all), security logs (180d) |
| `data_retention.sql` | POPIA s.14 location windows, in one place |
| `maintenance_status.sql` | the sensor that alarms when maintenance stops |
| `account_deletion.sql` | `purge_user_data` — **the `delete-account` Edge Function calls this.** Without it, account deletion is incomplete, which is an Apple 5.1.1(v) / Play Store requirement |
| `index_reconciliation.sql` | the inbox index (below) + 22 redundant indexes |

**`pg_cron` must be enabled** (Database → Extensions). Every schedule in
`maintenance_levels.sql` is wrapped in `if exists (select 1 from pg_extension
where extname = 'pg_cron')`. If it is off, none of this has ever run and every
table has grown since day one. Section 4 of the report tells you.

### The index one is worth its own line

`idx_messages_recipient` is defined twice — `(recipient_id)` in `schema_part_4`
and `(recipient_id, created_at DESC)` in `schema_part_1`. With
`CREATE INDEX IF NOT EXISTS` and build order 2→3→4→1, part_4 wins and the
composite is **never created**. But every inbox read orders by `created_at`.

Measured on 400,000 messages:

| per-user history | what you have | what you want |
|---|---|---|
| ~200 messages | 0.814 ms | 0.166 ms |
| 50,000 messages | **9.068 ms** | **0.156 ms** |

The narrow index degrades to a parallel sort of the user's entire history. The
composite is flat. Section 5 of the report tells you which one you have.

---

## Step 4 — features the app now expects

| File | What breaks without it | Severity |
|---|---|---|
| `username_skeleton.sql` | Signup step 1 falls back to downloading up to 200 usernames to the phone instead of one indexed lookup. Also the impersonation guard (`k0nka` for `konka`) is client-only and bypassable | works, slower |
| `mutual_follows_rpc.sql` | "Mutuals online" falls back to pulling both full follow lists — for a 40k-follower account that is ~40,800 rows to the phone every 2 minutes | works, expensive |
| `lock_authenticated_pii.sql` | Any signed-in user can read any other user's `email`, `push_token`, `phone`, `emergency_contacts` | privacy |

All three are written so the app works before **and** after — the client tries
the RPC and falls back, the same pattern `AuthContext` uses for
`get_my_profile`. Nothing breaks by running them late.

---

## Order, in one block

```
 0.  APP_DB_CONTRACT_CHECK.sql        ← read-only, tells you what you need
 1.  definer_rpc_hardening.sql        ← 🔴 admin escalation + currency minting
 2.  scripts/security-rls-fixes.sql   ← 🔴 GPS exposure
 3.  <whatever section 1 flagged>
 4.  account_deletion.sql             ← store compliance
 5.  maintenance_levels.sql + data_retention.sql + maintenance_status.sql
     (enable pg_cron first)
 6.  index_reconciliation.sql
 7.  username_skeleton.sql, mutual_follows_rpc.sql, lock_authenticated_pii.sql
 8.  APP_DB_CONTRACT_CHECK.sql again  ← confirm it all went green
```

Every file is idempotent and safe to re-run. `index_reconciliation.sql` should be
re-run after any `schema_part_*` replay, because those files recreate the
ambiguous index names.

---

## On the `resident_*` snippets

Five of your snippets belong to The Resident, the companion app:
`resident_schema`, `theresident_db_hardening`, `theresident_security_log_schema`,
`theresident_org_broadcast_schema`, `theresident_undocumented_tables_schema`.

The repo has `resident_schema_v2.sql`, `resident_trust_bridge.sql`,
`res_map_bridge.sql` and `resident_marketplace_gate.sql`, and the two apps share
one database via the SSO handoff in `sso_handoff.sql`. If The Resident is live,
`sso_handoff.sql` needs to be applied for one-click sign-in between them to work
at all — the `sso-redeem` Edge Function depends on the
`sso_handoff_codes` table and the `sso_issue_code` RPC.

I have not audited The Resident's schema. Say the word and I will.
