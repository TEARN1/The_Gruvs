# The Gruvs — System Automation Readiness Audit (2026-06-10)

**Verdict: NOT YET — but close (~70%).** A full CI/CD pipeline already exists
(`deploy.yml`: ci-gate → db migrations → Play Store release on push to `main`).
The blocker is not "build automation" — it's that **the most dangerous automated
step (auto-applying SQL to production) is armed without a safety net, against a DB
that is drifted and not baselined.** Arming it today = an *unattended* replay of
this month's rollback chaos. Fix the 🔴s below first.

## Scorecard

| # | Gate | Status | Evidence / gap |
|---|------|--------|----------------|
| 1 | CI quality gate (types, unit/integration tests, memory-leak) | 🟢 | `deploy.yml ci-gate`: `tsc --noEmit`, `npm run test:unit`, memory-leak-check |
| 2 | Live critical-flow smoke before release | 🟢 | `scripts/pre-deploy-check.js` (live login/feed/message) in deploy job |
| 3 | Admin/security gating | 🟢 | GodView server-validated `useIsAdmin`; RLS coverage fixed this session |
| 4 | Secrets management | 🟢 | GitHub secrets; Spotify secret server-side via Edge Function |
| 5 | App-store CD | 🟢 | EAS build + Fastlane → Play **internal** track (safe staging) |
| 6 | **DB migration safety** | 🟢 | FIXED 2026-06-10 — `migration-preflight` job applies pending migrations to a throwaway Postgres; prod `db push` `needs:` it, so nothing reaches prod unless it applied to a clone first |
| 7 | **DB reconciled + baselined** | 🔴 | Drift unreconciled (audit not run); no `supabase/migrations/` baseline → auto-push has nothing safe to apply yet |
| 8 | Schema builds verified | 🟡 | `db-schema-ci.yml` added this session, but it's **advisory** — not a gate on deploy, and may currently be red |
| 9 | Reversibility (PITR/backups + rollback runbook) | 🟡 | Not confirmed enabled/documented; auto-deploy without a tested rollback is risky |
| 10 | E2E coverage as a gate | 🟡 | Playwright E2E is `continue-on-error` (advisory); deploy can pass with broken UI flows |
| 11 | Observability / alerting | 🟡 | Pipeline references alerting — verify it actually fires on failed deploy/migration |
| 12 | Constraint hygiene (money / dead code) | 🟡 | Phantom-money escrow/wallet + theatrical `neuralMesh`/`organizationalOverseer` — automating/scaling amplifies liability & dead output |

🟢 6 · 🟡 5 · 🔴 1

## The one remaining 🔴 blocker (must fix before arming full automation)
1. **Reconcile + baseline the DB** — run `supabase/queries/audit_db_state.sql`, apply
   the one reconciliation migration, then `supabase db pull` to create the baseline.
   Until this exists, the auto-migration job has nothing safe to push.

✅ **DONE 2026-06-10:** the prod migration push is now gated behind a throwaway-clone
apply (`migration-preflight` in `deploy.yml`). No migration reaches prod unless it
applied cleanly to a disposable Postgres first.

## Recommended order to reach "ready"
1. ✅ #6 ephemeral-DB migration gate before prod push — DONE 2026-06-10.
2. 🔴 #7 reconcile + baseline DB (opens everything — only remaining blocker).
3. 🟡 #9 enable PITR + write a 1-page rollback runbook.
4. 🟡 #8 make `db-schema-ci` a required check.
5. 🟡 #12 resolve money reframing + trim/realise the theatrical engines.
6. 🟡 #10/#11 promote critical E2E to blocking; verify alerting fires.

Once #7 is done and #9 is in place, the existing pipeline is safe to run unattended.

## What's already strong
The hard parts are built: a real CI gate, a live pre-deploy smoke, signed EAS builds,
Fastlane to a staging track, server-side secrets, admin-gated god view, and (post this
session) full RLS coverage + pinned `SECURITY DEFINER` search paths. You are much
closer to safe automation than the DB-drift firefighting made it feel.