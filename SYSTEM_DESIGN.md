# The Gruvs — System Design, End to End

_Written 2026-09-28 from a direct audit of the branch `claude/app-system-design-progress-pdqrz0`
(HEAD `5f118d5`). Every number below is measured from the code, not estimated from the other
planning docs in this repo._

This document is the single map of the system: what each layer is, how a request travels
through it, what is actually finished, and what the remaining percentage is made of.

---

## 0. Measured baseline

| Metric | Value | How measured |
|---|---|---|
| Application source | 161,885 lines JS | `wc -l` over `src/`, `App.js`, `index.js` |
| Modules | 386 files — 23 screens, 170 components, 76 services, 8 hooks, 7 contexts | directory counts |
| DB surface used by the client | 145 distinct tables, 127 distinct RPCs | `.from(...)` / `.rpc(...)` unique names |
| Realtime subscriptions | 58 `.channel(...)` call sites | grep |
| Unit tests | **1002 passing / 1003** (127 suites) | `npx jest` this session |
| E2E | 9 Playwright specs, **advisory** (`continue-on-error`) | `tests/e2e/`, `deploy.yml` |
| Lint | clean (2 `no-undef` crashes fixed in this commit) | `npx eslint .` |
| Typecheck | `tsc --noEmit` clean (advisory — JS project) | this session |
| Edge Functions | 5 (`delete-account`, `og-meta`, `push-notify`, `spotify-token`, `sso-redeem`) | `supabase/functions/` |
| SQL assets | 66 files in `supabase/queries/` | `ls` |
| Versioned migrations | **0** in repo; **198 recorded in the live DB**, 13 of them hollow — see `DB_BASELINE.md` | `ls` + live audit |

The last row is the most important fact in this document. See §6 — and `DB_BASELINE.md`, which
corrects it with a live audit: the history exists remotely but is unversioned and unreplayable
at the foundation, which is a worse problem than a missing baseline.

---

## 1. Shape of the system

```
                 ┌──────────────────────────────────────────────┐
   Web (PWA)  ───┤                                              │
   Android    ───┤   ONE React Native codebase (Expo SDK 52)    │
   iOS        ───┤   react-native-web renders the same tree     │
                 └───────────────────┬──────────────────────────┘
                                     │  supabase-js (HTTPS + WSS)
                                     │  x-app-id header → app partition
                 ┌───────────────────▼──────────────────────────┐
                 │  SUPABASE                                    │
                 │   Postgres + PostGIS   ← RLS is the ONLY     │
                 │   127 RPCs (SECURITY DEFINER, pinned paths)  │   authorization
                 │   Realtime (58 channels)                     │   boundary
                 │   Storage (6 buckets)                        │
                 │   Auth (email + social)                      │
                 │   5 Edge Functions ← anything needing a       │
                 │                       server-side secret     │
                 └──────────────────────────────────────────────┘
```

**The one architectural rule:** there is no application server. The client talks to Postgres
directly, so *every* trust decision lives in RLS policies and `SECURITY DEFINER` RPCs. A secret
that cannot be shipped to a client (Spotify, push keys, account deletion) becomes an Edge
Function. Nothing else is allowed to become a backend.

### Client layering

```
index.js → App.js
   └─ Providers (order matters):
        Theme → Auth → Identity → Entitlement → Currency → Call → Tutorial → Toast
   └─ Tab shell: 6 tabs, each wrapped in ErrorBoundary + Suspense
        └─ lazyScreens.js — screens are code-split chunks, hidden tabs prewarm on idle
             └─ Screen (23)
                  └─ Components (170)
                       └─ Services (76)  ← the only layer that touches supabase.js
                            └─ Utils (80+) ← pure functions, where the tests live
```

The discipline that makes the size manageable: **screens never call Supabase directly, services
never render.** Utils are pure, which is why 1003 unit tests exist without a mocking framework
fight. That separation is real in the code today and is the main reason a 162k-line solo
codebase is still workable.

---

## 2. End-to-end: the critical paths

**Cold start → first content**
`bootGuard` → restore session from SecureStore → `AuthContext` resolves user → `x-app-id` header
set → partitioned display name loaded → LandingPage ("The Drop") issues a ranked feed RPC →
`persistentCache`/`offlineCache` paint stale content instantly → realtime channel patches deltas.

**Discovery → attendance (the core loop)**
The Drop / Explore / Map → Event Detail → RSVP → **Touch Down** (verified physical check-in,
`checkinGuard` + `nearestCheckIn` + geofence) → check-in feeds `heatScore`, `turnout`,
`peopleScore`, `trustLedger` → those re-rank the feed for everyone else. This loop is the
product thesis ("crowdsourced reality beats organiser spin") and it is fully wired.

**Host → event → talent**
PostEventModal (poster scan autofill → 3-step wizard) → event row → `EventGuestsModal` attaches
persistent talent identities → per-event performance rolls up via DB triggers into careers →
`search_top_players()` powers the Scout leaderboard. Depends on the talent migrations (§6).

**Safety path (must never degrade)**
`panicMode` / `safetyCheckIn` → dispatch + crew notification → `push-notify` Edge Function.
This path has its own tests and should stay a blocking gate in any future CI change.

**Write path resilience**
Every mutation goes through `optimisticEngine` (instant UI) → `retry`/`resilience` (backoff) →
`checkinQueue`/`offlineCache` (durable queue when offline) → `failureClassifier` →
`errorReporter`. This is unusually complete for an app this stage and is why the app survives
South African network conditions.

---

## 3. Completion by layer

Percentages are **evidence-weighted**: built + tested + provably live. Code that exists but has
never run against the production DB is capped at 70%.

| # | Layer | % | What the gap is |
|---|---|---|---|
| 1 | **Client architecture** (providers, lazy tabs, error boundaries, back-stack) | **95%** | Stable. App.js is a 1,219-line shell that should eventually split. |
| 2 | **Design system** (Liquid Glass, themes, GlassView, haptics, sound) | **95%** | Done and consistent; 7 themes tested. |
| 3 | **Core social loop** (feed, events, RSVP, vibes, echoes, reactions, DMs, reels, stories) | **90%** | Code complete. Held back by storage-bucket + RLS config (§6), which is what makes uploads/DMs flaky live. |
| 4 | **Check-in / Truth Protocol** (Touch Down, geofence, heat, turnout, trust) | **90%** | Complete and tested. Needs real density to validate the ranking signal. |
| 5 | **Map & spatial** (MapLibre, isochrones, zones, fog, door queue, routes) | **85%** | Heaviest surface; 3D layer and viewport work landed recently, lightly E2E'd. |
| 6 | **Talent / tournaments / scout** | **75%** | Engine + UI complete; blocked on migrations `27 → 28 → 30` reaching prod. Calls no-op safely until then. |
| 7 | **Offline / resilience / optimistic writes** | **90%** | Strong. Queue + classifier + reporter all tested. |
| 8 | **Auth, identity, multi-app partitioning** | **85%** | Works; password-reset redirect URLs are still a console-side config step. |
| 9 | **Security** (RLS coverage, pinned definer paths, MFA, biometric, app-lock, admin gating) | **85%** | Live advisor audit run 2026-09-30: 379 → 319 findings, mutable `search_path` cleared, `EXECUTE` revoked on 76 trigger functions. Remaining ERRORs are intentional definer views — see `DB_BASELINE.md` addendum. |
| 10 | **Moderation & safety** (report, block, ghost, trust auto-hide, panic, SOS) | **85%** | All flows exist. Play requires report+block reachable on *every* UGC surface — needs a sweep, not new code. |
| 11 | **Monetization** (entitlements, business tiers, gifts, boosts, referral, revenue engine) | **70%** | Entitlement + gift/boost loop works. Escrow/wallet is **phantom money** — modelled but not settled through a real processor. Either reframe as credits or integrate a PSP before it is user-visible. |
| 12 | **Notifications** (push Edge Function, policy, digests, birthdays) | **80%** | Pipeline live; delivery policy tuned; needs live volume verification. |
| 13 | **Calls / co-presence** (WebRTC, group call, PiP, ICE reconnect) | **75%** | Impressive and working, but the least testable surface — no automated coverage. |
| 14 | **Database schema & RPCs** | **70%** | 145 tables / 127 RPCs in use and working — but see §6: unversioned. |
| 15 | **Edge Functions** | **90%** | 5 functions, correct secret boundary. |
| 16 | **CI/CD** (ci-gate, migration-preflight on throwaway PG, EAS, Fastlane, web deploy) | **80%** | Genuinely good. E2E and schema CI are advisory, not gates. |
| 17 | **Observability** (errorReporter, productionHealth, monitor-errors, client_error_status) | **65%** | Collection exists; alerting has never been proven to fire on a failed deploy/migration. |
| 18 | **Testing** | **75%** | 1002 unit tests is excellent for utils/services. Near-zero component-render coverage, 0 `testID`s, E2E non-blocking. |
| 19 | **Store readiness** (Play policy, POPIA, data safety, deletion URL) | **70%** | Background-location wording fixed, deletion pipeline live. Remaining items are console/paperwork, not code. |
| 20 | **Docs & runbooks** | **95%** | 40+ docs. If anything, over-documented relative to shipped state. |

### Overall

Weighting each layer by its share of user-visible risk (schema, security, CI and testing carry
double weight because they gate everything else):

> ## **Overall system completion: ~82%**
>
> - **Code written: ~93%** — the features exist and are tested in isolation.
> - **Provably live: ~70%** — the delta is production configuration and schema versioning.

That gap between 93% and 70% *is* the remaining project. Almost nothing left is "build a
feature"; it is "make the thing that exists verifiable in production."

---

## 4. The five things standing between 82% and 95%

Ordered by what unblocks the most.

**1. Baseline the database into versioned migrations (worth ~6 points).**
`supabase/migrations/` is empty while 66 loose SQL files in `supabase/queries/` are the de-facto
schema. The CI pipeline already has the hard part — a `migration-preflight` job that applies
pending migrations to a throwaway Postgres before prod — but it has nothing to apply. Run
`supabase/queries/audit_db_state.sql`, apply one reconciliation migration, then `supabase db pull`
to create the baseline. Until this exists, every deploy is a manual SQL paste and layers 6, 9 and
14 cannot exceed 70%.

**2. Close the live-config checklist (worth ~4 points).**
The storage buckets + policies, auth redirect URLs, and the talent migrations `27 → 28 → 30`.
`GO_LIVE.md` documents this correctly. These are the reason uploads, DMs and reels look broken
live while their code and tests are green — a config gap masquerading as bugs.

**3. Promote the gates (worth ~2 points).**
Make `db-schema-ci` a required check and promote the 3–4 critical E2E specs (landing, explore,
check-in, profile) from `continue-on-error` to blocking. Add `testID`s while doing it — their
absence is what keeps E2E fragile and instrumentation thin.

**4. Resolve the money question (worth ~2 points).**
Escrow/wallet models balances that no payment processor settles. Pick one: reframe as
non-cash credits, or integrate a PSP with real reconciliation. Shipping an ambiguous wallet is
a compliance liability, and automating around it amplifies that.

**5. Prove observability fires (worth ~1 point).**
Deliberately fail a deploy and a migration in staging and confirm an alert actually lands.
Collected-but-unwatched errors are worth about as much as none.

Everything else — trimming the theatrical engines (`neuralMesh`, `organizationalOverseer`),
splitting `App.js`, the 12 `TODO(v6)` image-column fallbacks awaiting one migration — is
housekeeping that does not gate launch.

---

## 5. Phase map, start to finish

| Phase | Scope | State |
|---|---|---|
| 0 · Foundation | Expo + Supabase + auth + theming + navigation shell | ✅ 100% |
| 1 · Core loop | Feed, events, RSVP, social, DMs, reels, profiles | ✅ ~95% (config-gated) |
| 2 · Truth Protocol | Check-in, heat, turnout, trust, safety | ✅ ~90% |
| 3 · Spatial | Map, zones, routes, isochrones, fog | ✅ ~85% |
| 4 · Talent & tournaments | Players, careers, governance, scout, predictions | 🟡 75% — migration-gated |
| 5 · Commerce | Entitlements, gifts, boosts, business dashboards | 🟡 70% — money question open |
| 6 · Hardening | RLS, MFA, moderation, POPIA, Play policy | 🟡 80% |
| 7 · Automation | Versioned migrations, blocking gates, alerting | 🔴 55% — **the current frontier** |
| 8 · Launch | Store submission, listing, density seeding | 🔴 40% — paperwork + go-live checklist |
| 9 · Scale | Ranking honesty, cold-start quality, retention instrumentation | ⚪ not started by design |

**You are at the start of Phase 7.** Phases 0–6 are substantially built; 7 and 8 are what
"finishing" now means.

---

## 6. The structural risk, stated plainly

A 162k-line client with 145 tables and 127 RPCs is being deployed against a database whose
schema is not under version control. Every other strength in this system — the CI gate, the
throwaway-Postgres preflight, the RLS coverage, the 1002 tests — is downstream of a schema that
can silently drift between what the client expects and what production has. That is the single
highest-leverage fix in the repository, and it is roughly a day of work, not a rewrite.

Fix that, and the honest number moves from **82% to ~88%** immediately, because six other
layers stop being capped by it.

---

## 7. Health notes from this audit

- **Fixed in this commit:** `EventDetailScreen.js` was missing `useMemo` and `Linking` imports —
  two `no-undef` errors that would crash the smart-lineup render and the directions handler at
  runtime. Introduced by the recent lineup/guests work on this branch. Lint is now clean.
- **Known failing test (left as-is):** `__tests__/currency.test.js:44` expects `ZAR` as the
  default currency, but commit `bc9fba6` made the platform global with device-locale detection,
  so the default is now `USD`. The test is stale, not the code — decide whether the global
  default should be `USD` (update the test) or whether ZAR should remain the fallback for the
  launch beachhead (update `currencyForCountry`). That is a product call, so I did not pick one.
