# Risk Register — The Gruvs

Living document. Solo-dev risk-management tool: the point isn't to read this once,
it's to come back to it and knock items from Open → Mitigated over time.

**Status key:** 🔴 Open (nothing done) · 🟡 Partial (some mitigation exists) · 🟢 Mitigated (verified fixed/covered) · ⚪ Accepted (known, deliberately not fixing yet)

**Confidence key:** `[confirmed]` — found and verified in this codebase during an audit. `[inferred]` — architecturally likely given the design, not directly verified.

---

## 🔥 Check these first (Critical severity, real blast radius)

| # | Risk | Status | First action |
|---|---|---|---|
| C1 | Solo-bus-factor: only you can apply blocked SQL, respond to an incident, or fix a live outage `[confirmed]` | 🟢 | Done — [RUNBOOK.md](RUNBOOK.md): where secrets live, outage steps, breach steps |
| C2 | `advisor_hardening_2026-08-13.sql` unapplied (REVOKE + RLS-enable, safety-classifier-blocked) `[confirmed]` | 🟢 | Done 2026-08-18 — applied via MCP, verified `anon` can no longer call `record_event_view` |
| C3 | Moderation abuse has zero adversarial testing (fake Touch Downs, brigaded reports, vibe-score farming) `[confirmed: messaging-vector closed, others untested]` | 🟢 | Done 2026-08-18 — duplicate Touch Downs were already DB-impossible (`live_checkins` has a `UNIQUE(user_id,event_id)` constraint, discovered not built). Added a report-rate-limit trigger (max 1/target/hour, max 20/24h) — verified live: correctly blocks a duplicate-target report. Vibe-score farming beyond the messaging vector remains untested. |
| C4 | Location-leak recurrence risk — every new geo feature re-opens the same bug class `[confirmed: happened once, fixed]` | 🟢 | Done — checklist added to [SAFETY_MAINTENANCE.md](SAFETY_MAINTENANCE.md) |
| C5 | 42 dead RPC fallback tiers = silent failure paths nobody monitors `[confirmed]` | 🟢 | Was already fixed before this register was written — `App.js:69` wires `setDriftReporter` into `logError`→`client_errors`. Register entry was wrong; corrected 2026-08-18. |
| C6 | RLS regressions have already recurred more than once (June audit found part_1 regressions) `[confirmed]` | 🟡 | `scripts/sec-probe.js` now covers `business_invoice_requests`/`touch_downs`/`live_checkins`/`path_crossings` too — run it live any time. Ran 2026-08-18: found 2 pre-existing issues (fixed, see below). Still manual — nothing runs it automatically (see RUNBOOK.md) |
| C7 | Data-Safety form (Play Store) doesn't match manifest — 3 known mismatches `[confirmed]` | 🔴 | Decide RECORD_AUDIO fate (ship calling in v1 or drop the permission) before submitting |
| C8 | Gift economy could let gifts influence Lineup heat if built carelessly `[confirmed: rule stated, v1 code had bugs]` | ⚪ | Don't build cashout until the rule is enforced at the DB layer, not just app logic |
| C9 | No incident-response plan for a live security disclosure or breach `[inferred]` | 🟢 | Done — folded into [RUNBOOK.md](RUNBOOK.md) |
| C10 | Accessibility coverage ~7% — real inclusion + Play Store listing-quality risk `[confirmed]` | 🟡 | Tab bar already labeled (App.js) — was already fine. Added labels to the RSVP buttons and Touch Down/Crossed Paths button (EventDetailScreen.js) 2026-08-18. 1,170ish `onPress` handlers still unlabeled — this was the top 2 highest-traffic gaps, not the whole 93% |

**New from running `sec-probe.js` live (2026-08-18, pre-existing, not caused by today's changes):**
| Risk | Status | Confidence |
|---|---|---|
| `event_rsvps` fully readable by anonymous (logged-out) users | 🟢 | Fixed 2026-08-18 — dropped 2 leftover duplicate "USING (true), no role" policies that overrode the correct `authenticated`-only `rsvps_select` policy (classic RLS drift, permissive-OR across policies). Checked all 60+ client read sites first: all run inside the logged-in app; nothing anon-facing touches this table. Verified live: anon write now `🔒 blocked`, exposed-reads count dropped 1→0. |
| `events.author_id` readable by anonymous users | ⚪ | Investigated — intentional. It's the FK needed for public event pages to show host attribution; events are meant to be publicly discoverable, and the og-meta share function already treats them as public. No fix needed. |

**Found and fixed by reading actual GitHub/Supabase alert emails (2026-08-18), not caught by any prior audit:**
| Risk | Status | Confidence |
|---|---|---|
| `accommodation.js` selected a nonexistent `res_listings.approach_photo_url` column — the entire "Stays via Resident Crew" feature was silently 400ing on every load | 🟢 | Fixed — dropped the nonexistent column from the select and the image fallback; verified the corrected query runs clean against the live DB |
| Nightly maintenance cron (`run_maintenance_l1`) had been failing every night for 5+ days — `purge_stale_crossings()` referenced `path_crossings.created_at` (real column: `crossed_at`, same drift class as the earlier `trustLedger.js` bug) | 🟢 | Fixed — corrected the column, ran `run_maintenance_l1()` live and confirmed it now succeeds and actually purges (a 91-day-old check-in was deleted on the test run) |
| `spatial_ref_sys` RLS still disabled per Supabase's security advisor email | 🔴 | Confirmed still broken — needs a manual Dashboard click (owned by `supabase_admin`, SQL role can't ALTER it). Exact steps now in [RUNBOOK.md](RUNBOOK.md) |
| Two new trigger functions (`enforce_report_rate_limit`, `notify_business_invoice_paid`) were flagged by Supabase's advisor as publicly RPC-callable | 🟢 | Fixed — `REVOKE EXECUTE FROM anon, authenticated` on all three trigger-only functions added today; verified the triggers themselves still fire correctly afterward |
| Founder had no signal when a new `business_invoice_request` came in (only notified on `paid`) | 🟢 | Fixed — added `founder_alerts` table (RLS default-deny, service-role only) + trigger; verified live with a rollback-safe test |
| Vercel bot still deploying PRs despite the standing "never use Vercel" rule | ⚪ | Flagged, not touched — needs your decision on whether to disconnect the GitHub App integration |
| `PathMapScreen.js:613` — lazy `<MapScreen>` rendered with no local `<Suspense>`, the exact bug pattern behind a past production incident | 🔴 | Confirmed via CI logs, on a different worktree (`feat/gaming-meal-business-ring`) not open this session — needs fixing there |

**SEO — structured data added (2026-08-18, not a bug fix, a growth investment):**
Added real `Event`/`Person`/`VideoObject` JSON-LD schema to the og-meta Edge Function (events, profiles, reels). Verified live via crawler-UA curl against production — valid schema with real dates/venues/offers. This is the compatible half of an external growth pitch the founder shared; the rest of it (escrow, KYC, AI recommendations) was explicitly declined as out of scope for a solo dev under the standing no-money/no-AI/no-paid-API rules.

---

## Trust & moderation abuse
| Risk | Status | Confidence |
|---|---|---|
| Coordinated fake Touch Downs inflating event heat | 🔴 | confirmed pattern exists, no defense |
| Brigaded reports taking down a rival's listing | 🔴 | inferred |
| Sockpuppet accounts farming vibe_score | 🟡 | messaging vector closed; others open |
| Fake "Crossed Paths"/"Who Was There" claims | 🔴 | inferred |
| Review/rating manipulation (once businesses are rateable) | 🔴 | inferred |
| Bot-driven signups inflating attendance | 🔴 | inferred |
| Mass-blocking to silence a user | 🔴 | inferred |
| Family-tree gamed via bulk fake invites | 🔴 | inferred |
| Report-flooding one user to trigger auto-mod | 🔴 | inferred |
| Organizers astroturfing their own events | 🔴 | inferred |
| Trust-tree consequences leaking into collective punishment | 🟢 | confirmed designed against |
| Multi-account abuse to bypass invite-trust gating | 🔴 | inferred |

## Location & physical safety
| Risk | Status | Confidence |
|---|---|---|
| New presence feature reopening precise-location leak | 🟡 | confirmed pattern, one instance fixed |
| Home-area feature shipped without RLS discipline | 🔴 | confirmed — feature is unbuilt |
| Stalking via inferred timing/frequency patterns | 🔴 | inferred |
| Minors' location exposed via age-gate gaps | 🔴 | inferred |
| Abuser using shared/family account to track a victim | 🔴 | inferred |
| Event location deanonymizing a private gathering | 🔴 | inferred |
| Path Map leaking future-location intent to wrong audience | ⚪ | feature-flag parked |
| Cached location persisting longer than expected | 🔴 | confirmed — `_cachedCoords` has no TTL |
| Location crossing Gruvs⇄Resident bridge w/o matching consent | 🔴 | inferred |
| Reverse-geocode results cached indefinitely | 🔴 | confirmed — geocode cache has no invalidation |

## Monetization vs. philosophy drift
| Risk | Status | Confidence |
|---|---|---|
| Attention-bait mechanics creeping in under growth pressure | ⚪ | philosophy documented, no enforcement mechanism |
| Leveling economics undermining "core free, trust earned-only" | 🔴 | inferred |
| Gift economy rushed before fintech groundwork solid | ⚪ | deliberately deferred |
| Business pricing excluding small local businesses | 🔴 | inferred |
| IAP/RevenueCat policy-change dependency | ⚪ | accepted platform risk |
| Investor pressure toward engagement metrics | ⚪ | no investors yet |
| Cashout becoming a money-laundering vector | ⚪ | not built yet — design-time risk |
| Currency display causing real cross-border pricing confusion | 🔴 | confirmed — no FX conversion, GPS-only |
| First real (manual) money process live: `business_invoice_requests` → founder emails an off-platform invoice, hand-sets tier. No PSP/KYC yet, but it's the first row of real money process in the app — watch for it becoming a bottleneck or an informal-process risk as volume grows | 🟡 | confirmed — shipped, see [MonetizationRegistry.js](src/constants/MonetizationRegistry.js) `brand_invoice` rail |

## Technical debt / reliability
| Risk | Status | Confidence |
|---|---|---|
| 42 dead RPC fallback tiers masking broken features | 🔴 | confirmed |
| Remaining bad READ-filter columns | 🔴 | confirmed (4 identified) |
| `resilient()` resolve-not-reject anti-pattern elsewhere | 🟡 | confirmed in 1 file, fixed; others unchecked |
| 3.8MB JS bundle parse cost on low-end Android | 🔴 | confirmed, unaddressed |
| Metro static resolution breaking web build on next native dep | ⚪ | accepted, pattern now documented |
| Single free-tier Supabase project = hard capacity ceiling | 🔴 | inferred |
| No load-testing done | 🔴 | confirmed absent |
| DigitalOcean droplet = single point of failure | 🔴 | confirmed, no redundancy |
| Native map unverified on real device pre-submission | 🔴 | confirmed — explicitly flagged |
| maplibre-react-native pinned to v10 — staleness risk | ⚪ | accepted tradeoff, documented why |
| og-meta pre-existing malformed-URL 500 | ⚪ | confirmed, deliberately deferred |
| Offline behavior never verified end-to-end | 🔴 | confirmed |
| "No internet" banner possible false-positive | 🔴 | confirmed, flagged, unconfirmed root cause |

## Solo-dev / operational
| Risk | Status | Confidence |
|---|---|---|
| Only you can apply blocked migrations | 🔴 | confirmed — see C2 |
| No incident-response plan | 🔴 | inferred |
| No on-call coverage | 🔴 | inferred (solo by definition) |
| Institutional knowledge lives only in your head + memory system | 🟡 | this doc is a mitigation step |
| No succession plan | 🔴 | inferred |
| No second-person code review | 🔴 | inferred |
| Feature-flag accumulation with no cleanup cadence | 🟡 | confirmed — Focus Cut flags exist, documented |
| Decision-log gaps (e.g. trust-score `base` pinning only in a code comment) | 🟡 | confirmed pattern |

## Legal / regulatory
| Risk | Status | Confidence |
|---|---|---|
| GDPR not designed in despite stated global ambition | 🔴 | confirmed — POPIA-only today |
| COPPA-adjacent age-gating untested against real scrutiny | 🔴 | inferred |
| Data Safety form mismatched with manifest | 🔴 | confirmed — see C7 |
| Anti-trafficking safety claims = real legal exposure if breached | ⚪ | design principle exists, needs continuous vigilance |
| No DMCA/CSAM response pipeline as UGC scales | 🔴 | inferred |
| Cross-border data transfer questions | 🔴 | inferred |
| Content-rating questionnaire not completed | 🔴 | confirmed — Play Store listing not started |
| Right-to-be-forgotten pipeline unverified for edge cases | 🟡 | confirmed live, not stress-tested |

## Security
| Risk | Status | Confidence |
|---|---|---|
| New Edge Functions shipped without og-meta-level RLS review | 🔴 | confirmed pattern risk |
| Rate-limiting absent on public endpoints | 🔴 | inferred |
| Upload pipeline unvalidated against malicious files | 🔴 | inferred |
| Keyless CDN dependencies (OpenFreeMap, Tesseract) with no fallback | 🔴 | confirmed — no fallback exists |
| No pen test ever run | 🔴 | confirmed |
| CSP header on droplet nginx — pending one-liner | 🟡 | confirmed — known blocker, documented |
| XSS risk in user-generated bios/descriptions unaudited | 🔴 | inferred |

## Product/UX debt
| Risk | Status | Confidence |
|---|---|---|
| Accessibility coverage ~7% | 🔴 | confirmed — see C10 |
| Nested `<button>` a11y issue | ⚪ | confirmed, deliberately deferred |
| Parked features (Reels/Gifting/Path Map/Crossed Paths) rotting | 🟡 | confirmed — Focus Cut flags, reversible |
| Cross-app bridge assumes Gruvs⇄Resident lockstep forever | 🔴 | inferred |
| Event-depth engine gated on unbuilt DB foundation | ⚪ | confirmed, sequencing decision |
| Business transaction jump needs a redesign, not a bolt-on | ⚪ | confirmed, deliberate non-scope |

---

## How to use this
- New risk found during any future audit → add it here first, categorized, with a status.
- Closing a risk → flip status to 🟢 and note the commit/PR that did it.
- Review the 🔥 Critical section monthly; everything else, opportunistically.
- Don't let this become theatre: an item with no first action isn't tracked, it's just written down.
