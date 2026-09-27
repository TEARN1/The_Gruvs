# The Gruvs — Recurring Maintenance Prompt

A single prompt to paste into Claude Code every **1–6 months** to audit, test,
fix and modernise the app.

**How to use it:** copy everything inside the fenced block below, set `DEPTH` on
the first line, paste. That's it.

| DEPTH | Time | When |
|---|---|---|
| `PULSE` | ~30 min | Monthly. Is anything broken or newly vulnerable? |
| `SERVICE` | ~2–3 h | Quarterly. Pulse + drift, dependencies, dead surfaces. |
| `OVERHAUL` | a full session | Every 6 months, or before a launch/store push. Everything, including modernisation and architecture. |

This file is the canonical copy — it lives next to the scripts it names, so it
stays honest when those change. Update it when a check is added or retired.

---

## The prompt

```text
DEPTH: SERVICE          # PULSE | SERVICE | OVERHAUL

You are doing scheduled maintenance on The Gruvs (React Native / Expo web+native,
Supabase backend, self-hosted web on a DigitalOcean droplet, ~95K lines, solo dev).

Work through the phases below up to the DEPTH set above. PULSE = phase 1-2.
SERVICE = phases 1-5. OVERHAUL = all phases.

═══════════════════════════════════════════════════════════════════════
RULE 0 — HOW TO WORK. Read this before anything else.
═══════════════════════════════════════════════════════════════════════

1. MEASURE, DON'T ASSUME. Every claim in your report must be backed by a command
   you actually ran and output you actually saw. If you did not verify it, say
   "not verified" — never imply otherwise.

2. APPLYING A FIX IS NOT THE SAME AS THE FIX WORKING. This codebase has a
   history of silent no-ops:
     - `REVOKE UPDATE (tier)` looked correct, changed nothing (table and column
       ACLs are independent in Postgres).
     - Adding `font/ttf` to nginx gzip_types would have saved zero bytes,
       because that server's mime.types has no .ttf mapping so fonts are served
       as application/octet-stream.
   After every change, prove the EFFECT independently — query the live state,
   curl the live header, re-run the failing case. Not "I ran the migration."

3. A TOOL THAT FAILS TO CONNECT IS NOT A CLEAN RESULT. Several audit scripts
   need live DB credentials; without them they hang (exit 124) or exit 1. That
   is NOT "no findings". If a check could not run, report it as BLOCKED, never
   as passing.

4. FINISH WHAT YOU START, AND SAY WHAT YOU DIDN'T. If something is blocked
   (needs a dashboard toggle, a permission you lack, a credential), complete
   every other part and list the blocked items with the exact command or click
   needed. Do not silently narrow scope.

5. DON'T BREAK WORKING THINGS TO CHASE A METRIC. Prefer a smaller verified win
   over a large speculative refactor. If a change is risky, say so and let me
   decide rather than deciding for me.

═══════════════════════════════════════════════════════════════════════
RULE 1 — HARD CONSTRAINTS. Violating any of these is a failed run.
═══════════════════════════════════════════════════════════════════════

- NO money handling. No PSP, no card data, no custody of funds, no wallet that
  holds real value. Marketplace = broker + off-platform payment.
- NO paid or recurring-cost APIs or services. Free tiers only (Supabase, Expo,
  keyless/free endpoints). If a fix needs a paid service, propose it, don't do it.
- NEVER use Vercel, or its MCP. Web deploys go to the DigitalOcean droplet only.
- NEVER lower the k-anonymity floor of 3 in venue_flows_in_bbox or any
  presence/location aggregate.
- Mutual interest stays PRIVATE + MUTUAL-ONLY. Never build "see who liked you".
- The 18+ age gate is deliberately FAIL-CLOSED. Unknown age = restricted.
- Location precision is a SAFETY property, not a preference. Never persist or
  expose precise coordinates beyond what the current design already does.
- NO fake or sample data, ever. NO dead code. If a surface has no real data,
  hide it — don't fill it with placeholders.
- NEVER auto-retry money-adjacent or deletion operations.
- Do not push, deploy, or run destructive DB operations without telling me
  what you're about to do.

═══════════════════════════════════════════════════════════════════════
PHASE 1 — IS THE BUILD HONEST? (always)
═══════════════════════════════════════════════════════════════════════

Run these and report real numbers:
  npm run lint                              # no-undef. MUST be zero.
  npx jest --roots=./__tests__              # expect ~1000+ passing
  npx expo export --platform web
  npx expo export --platform android
  node scripts/audit-resilience.mjs
  node scripts/health-check.mjs
  node scripts/audit-maintenance.mjs

Then check the live site actually matches the last deploy:
  - fetch https://thegruvs.com, extract the AppEntry-<hash>.js filename
  - confirm it corresponds to the current main branch build
  - gh run list --limit 5    (any red workflows?)

`npm run lint` exists specifically because there was no linter for a long time
and Metro compiles undeclared identifiers happily — they throw a ReferenceError
only when that line runs. One sweep found 11 in live code, including a signup
that threw before writing the profile row, and a photo path that fell back to
uploading images with GPS EXIF intact. If lint is non-zero, fix it FIRST and
treat each one as a probable live crash, not a style nit.

═══════════════════════════════════════════════════════════════════════
PHASE 2 — SECURITY (always)
═══════════════════════════════════════════════════════════════════════

If the Supabase MCP is connected:
  - get_advisors(type: "security") and get_advisors(type: "performance")
  - Triage EVERY finding. For each: real risk, or noise from dead schema? Say
    which, and why. Fix the real ones.

Then, by direct query / inspection:
  a) RLS: any table with RLS disabled, or with a USING(true) policy that isn't
     deliberately public? Pay special attention to anything holding location,
     messages, notifications, or profile PII.
  b) Column-level grants: verify privileged columns (e.g. business_profiles.tier,
     vibe_score, any role/permission column) cannot be self-updated by a normal
     user. VERIFY BY ATTEMPTING IT as an ordinary user, not by reading the SQL.
  c) SECURITY DEFINER functions: each one must set search_path and must not
     accept a caller-supplied user id where it should use auth.uid().
  d) Storage buckets: can an authenticated user list or read another user's
     objects? Test it.
  e) Anything in EXPO_PUBLIC_* is PUBLIC — it ships in the bundle. Confirm no
     secret is there. Secrets belong in Edge Functions.
  f) npm audit --omit=dev — report real, reachable CVEs (not transitive noise).
  g) Live headers: curl -I https://thegruvs.com — CSP, HSTS, X-Frame-Options,
     Permissions-Policy all present and sane?

Cross-check against SECURITY-CHECKLIST.md and SECURITY-AUDIT.md. If a control
listed there is no longer true, that is a finding.

═══════════════════════════════════════════════════════════════════════
PHASE 3 — DRIFT: app ↔ database ↔ live server  (SERVICE and up)
═══════════════════════════════════════════════════════════════════════

This app's most expensive bugs have all been drift. Check all three pairs:

  npm run preflight            # pre-deploy-check + audit-schema + audit-writes + rpc-audit
  node scripts/audit-client-errors.mjs

(These need live DB credentials. If they hang or exit 1, that is BLOCKED, not
clean — see Rule 0.3.)

  a) APP → DB writes: does every key in every write payload exist on the table?
     PostgREST rejects the WHOLE row if one column is unknown. That exact bug
     silently discarded every user's city, DOB and interests for 35 signups.
  b) APP → DB reads: filters referencing columns that don't exist.
  c) Missing RPCs: which are real gaps vs deliberate fallback tiers?
  d) REPO → LIVE SERVER: infra/nginx-thegruvs.conf is NOT deployed by anything.
     web-deploy.yml only ships dist/ and sed-patches the live file. Diff the repo
     copy against /etc/nginx/sites-available/thegruvs on the droplet and report
     any drift in EITHER direction.
  e) Feature flags: compare launchConfig.FEATURES against what's actually
     reachable in the UI. A parked feature that still renders, or a live feature
     still gated off, are both findings.

═══════════════════════════════════════════════════════════════════════
PHASE 4 — DOES IT ACTUALLY WORK? (SERVICE and up)
═══════════════════════════════════════════════════════════════════════

  a) Dead controls: use BUTTON_MAP.md (regeneration recipe is inside). Any
     control that renders but does nothing is a finding. Fix or remove it.
  b) Fallback tiers that aren't fallbacks: in resilient() cascades, a tier must
     differ in KIND, not just in verb. Tier 1 `upsert` and tier 2 `insert` with
     the SAME payload is not a fallback — tier 2 can only fail identically.
     Audit against FALLBACK_STRATEGY.md.
  c) Unbounded waits: any await that can hang without a ceiling. resilient()
     had a ~153s worst case before a read deadline was added. Writes deliberately
     have NO deadline (abandoning a write doesn't cancel it) — don't "fix" that.
  d) Error surfacing: does a total failure actually reach logError / client_errors,
     or is it swallowed by a bare catch? Silent failure is how the signup bug
     survived 35 users.
  e) Empty states: every list/feed should have a real empty state, not a spinner
     that never resolves.

═══════════════════════════════════════════════════════════════════════
PHASE 5 — PERFORMANCE (SERVICE and up)
═══════════════════════════════════════════════════════════════════════

Measure, then compare against the last recorded numbers:
  - Bundle: npx expo export --platform web, then stat the AppEntry .js
  - Wire size: curl -s -H 'Accept-Encoding: gzip' -o /dev/null -w '%{size_download}'
    on the live bundle AND on each font/asset over ~100KB
  - An asset served with NO content-encoding is the first thing to fix
  - Cold-start round trips: count Supabase requests on first paint
  - Worst offenders in the bundle: attribute bytes per npm package via source maps
    (npx expo export --source-maps, then sum sourcesContent per package)

Known context: icons are deep-imported (the @expo/vector-icons barrel pulls all
15 families despite being named IconsLazy); maplibre-gl loads from a pinned
jsdelivr <script> on map mount, NOT bundled and NOT via Metro chunks (its chunk
runtime caused a "Requiring unknown module N" outage). Don't undo either.

═══════════════════════════════════════════════════════════════════════
PHASE 6 — MODERNISE (OVERHAUL only)
═══════════════════════════════════════════════════════════════════════

  a) Expo SDK / React Native: how far behind are we? What breaks on upgrade?
     Give a real migration cost estimate, don't just say "upgrade available".
  b) Supabase JS client, and any Postgres version notice on the project.
  c) Dependencies: what's deprecated, unmaintained, or has a better standard
     replacement now? Flag anything that has quietly become a paid product.
  d) Platform requirements: Google Play target-API deadlines, data-safety form
     accuracy, privacy-policy currency, iOS equivalents. Check
     PLAY_STORE_READINESS.md and STORE_SUBMISSION.md against what the consoles
     require TODAY — these deadlines move and are hard blocks.
  e) POPIA / privacy: does POPIA_COMPLIANCE.md still match what the app does?
     Data retention, deletion pipeline, export rights.
  f) NEW CAPABILITIES: the tooling landscape moves fast. What can now be done
     cheaply/free that couldn't before — on-device inference, better free tiles,
     new free APIs, new Expo modules? Propose only what fits the constraints in
     RULE 1 (free, no money handling). Say plainly if the honest answer is
     "nothing worth adopting this cycle" — do not invent work.
  g) Re-read the newest entries in the roadmap docs and ask whether anything
     shipped since has made a planned item obsolete.

═══════════════════════════════════════════════════════════════════════
PHASE 7 — ARCHITECTURE REVIEW (OVERHAUL only)
═══════════════════════════════════════════════════════════════════════

Use the CEO_REVIEW.md lens: review the app's current state as several platform
leaders would. The DISAGREEMENT between them is the deliverable — don't
synthesise it away into bland consensus. The privacy veto is real: if the
privacy-minded reviewer objects on a safety/location/PII ground, that objection
wins by default and must be answered, not outvoted.

Then answer directly:
  - What is the single biggest risk to this app right now?
  - What is the highest-leverage thing to build next, and why that over the
    alternatives?
  - What should be DELETED? (Unused features carry real maintenance cost.)

═══════════════════════════════════════════════════════════════════════
REPORT
═══════════════════════════════════════════════════════════════════════

End with a report in exactly this shape:

  1. RAN — every command executed, with its real result.
  2. FIXED — each fix, with the evidence that it actually took effect
     (the independent verification, not "I applied it").
  3. FOUND, NOT FIXED — with severity and why not (too risky, needs a decision,
     out of scope).
  4. BLOCKED ON YOU — exact command to run or button to click, and what it's
     worth. Include anything needing a dashboard toggle, a credential, or a
     permission I don't have.
  5. NUMBERS — bundle size, wire size, test count, lint count, round trips.
     Compare to the previous run's numbers where available.
  6. NEXT CYCLE — what to watch, and what deadline is approaching.

Be blunt about severity. If something is genuinely fine, say so briefly and move
on — don't pad the report. If you found nothing serious, that is a good outcome
and a short report is the correct output.
```

---

## Why each phase exists

Institutional memory, so the checks don't get dropped as "probably fine":

| Check | The bug that earned it |
|---|---|
| `npm run lint` (no-undef) | 11 live `ReferenceError`s, incl. **every signup throwing before the profile row was written**, and photo uploads falling back to **GPS EXIF intact** |
| Verify the *effect*, not the change | `REVOKE UPDATE (tier)` was a total no-op; a font gzip fix would have saved 0 bytes without a mime mapping |
| A failed tool ≠ a clean result | DB audit scripts hang (exit 124) without credentials |
| Write-payload drift | One stale column silently discarded **every** signup's city/DOB/interests for 35 users |
| Repo ↔ live config drift | `infra/nginx-thegruvs.conf` is deployed by nothing; it had silently fallen behind production |
| Fallback tiers differing in *kind* | Tier 1 `upsert` / tier 2 `insert` with the same payload — tier 2 could only fail identically |
| Unbounded waits | `resilient()` could spin ~153 s before showing an empty state |
| Silent catches | A bare `catch` is how the signup failure survived 35 users unnoticed |

## Keeping this file useful

After each run, append one line to the table below. The trend matters more than
any single number.

| Date | Depth | Bundle (raw) | Wire (gzip) | Tests | Lint | Notes |
|---|---|---|---|---|---|---|
| 2026-09-04 | — | 4,098,149 | 1,330,747 | 1003 | 0 | Baseline after perf work. nginx gzip fix still unapplied (worth ~893 KB). |
