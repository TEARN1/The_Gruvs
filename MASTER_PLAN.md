# THE GRUVS — MASTER PLAN (the complete, honest picture)

> Companion to [GOLDEN_PLAN.md](GOLDEN_PLAN.md) (strategy spine),
> [ROADMAP.md](ROADMAP.md) (event-depth engine), [FAN_RECIPROCITY.md](FAN_RECIPROCITY.md),
> [MONETIZATION.md](MONETIZATION.md).
> This doc answers one question: **are we planned correctly?** It starts with
> where we ACTUALLY are, because a plan that isn't grounded in reality is fiction.

---

## PART 0 — THE MIRROR (live DB snapshot, 2026-08-18)

| Metric | 2026-07-06 | 2026-08-18 | What it means |
|---|---|---|---|
| Registered users | 29 | **39** | +10 in 6 weeks. Still pre-launch. |
| Events (upcoming) | 33 | **143** | Grew 4×. Supply of *listings* is not the bottleneck. |
| **Distinct hosts** | 2 | **2** | **Unchanged.** Still just you. No supply liquidity, 6 weeks later. |
| **Distinct people who ever Touched Down** | **1** | **1** | **Unchanged.** The moat still has ~zero real data. |
| Total check-ins (all time) | 2 | 4 | +2, from the same 1 person. |
| Reels / follows / messages | 9 / 48 / 23 | 10 / 63 / 71 | Modest organic growth in low-stakes actions (follow, message) — none in the one action that matters (Touch Down). |
| Businesses on platform | — | 1 | New surface, first real user. |

### The one insight that must drive everything — STILL TRUE, MORE URGENT
Six weeks of substantial engineering happened since the last version of this
doc: a full map overhaul (viewport search, clustering, real controls), a
host-attendee communication system with a real reminder dispatcher, security
hardening across a dozen RLS gaps, monetization plumbing, SEO structured data.
**All of it shipped. None of it moved the number that matters.** Distinct
Touch-Down users: 1, then, and 1, now.

> **The bottleneck was never features. It still isn't.** Every week spent
> building instead of getting a second real host and a second real attendee
> widens the gap between what this app can technically do and what anyone has
> actually experienced.

This is not a criticism of the engineering — the work was real, verified, and
needed (see [RISK_REGISTER.md](RISK_REGISTER.md) for what was actually broken
and got fixed). It's a calibration check, and it says the same thing it said
six weeks ago, louder: **stop expanding surface; go get a second host.**

---

## PART 1 — WHAT THE APP IS (thesis)

- **The operating system for the event economy:** PLAN → STAFF → RUN → REMEMBER.
  No competitor owns the whole lifecycle.
- **Structure is the product.** Every serious event has latent structure (roles,
  schedule, teams, standings) trapped in WhatsApp + spreadsheets. We model it
  natively — and structure makes planning easy, turns each slot into a gig,
  creates engagement depth, and yields structured data (the moat).
- **We sell truth in a market that sells hype.** Verified attendance is the one
  asset Meta can't fake and a competitor can't import. "Be Google, not TikTok":
  monetize verified intent + attendance, never attention.
- **Lock-in = own the night, not the screen.** The "3 hours" is the real-world
  arc of a night out (Before / En route / During / After), with the app as
  connective tissue — not doomscroll minutes.

---

## PART 2 — COMPLETE PRODUCT ARCHITECTURE (with honest status)

Status key: 🟢 live & working · 🟡 built but cold (works, ~no usage) ·
🔴 built but broken/drifted · ⚪ planned/not built.

### The 7 tabs
| Surface | What it does | Status | Notes |
|---|---|---|---|
| **The Drop** (feed) | discover tonight/upcoming; masonry or list; reels rail; stories | 🟢 | Fixed: 5-cap, images, venue overlap. Core is solid. |
| **Reels** | vertical video; double-tap like; comments | 🟢 | Fixed tap/like/comment bugs. 9 reels — cold. |
| **Explore / Scout** | search, nearby, people discovery | 🟡 | Works; thin without density. |
| **Lineup / Calendar** | your saved/RSVP'd plan, Path Map | 🟡 | Meaningful once you have plans. |
| **Linked Up** (chats/DMs) | 1:1 + event chat | 🟢 | DM 400 fixed on live; verified sending works. |
| **Pings** (notifications) | activity, follows, reactions | 🟡 | Works; sparse. Native push not wired. |
| **Vibe Card** (profile) | identity, stats, followers/following, Business hub | 🟢 | Followers/following now visible; Business dash reachable. |

### Event detail — the deep "RUN" surface (host + attendee)
Live event chat 🟡 · polls 🟡 · **song requests** 🟢(new) · playlist voting 🟢 ·
moments/gallery 🟡 · **Touch Down** 🟢(just fixed) · Who-Was-There 🟡 ·
reactions 🟢 · **Poster Insights** (host) 🟢 · **Event Management** (host) 🟡 ·
Sport/Competition panel 🟡 · Continue-the-Night 🟡 · weather 🟡.

### The fan/loyalty layer (REMEMBER)
Fidelity engine 🟢(tested) · Superfans panel 🟢 · Poster Insights 🟢 ·
reciprocity math 🟢(tested) · loyalty tiers 🟢 · Wrapped/Vibe Card share 🟡.
**All correct — but starving for check-in data.**

### Business / B2B
Business dashboard 🟡 · store builder 🟡 · campaign builder 🟡 ·
attendance analytics 🟢 · Superfans 🟢. **Planning co-pilot ⚪ · Freelancer
marketplace ⚪** (the two biggest B2B bets — not built yet).

### Competition engine (FIFA-level)
Soccer: teams/fixtures/standings/careers/live-logging/predictions 🟢 (4 RPCs
now live). Other verticals (netball, combat, **voting competitions**) ⚪.

### Identity & safety
Public/Ghost/Incognito 🟢 · age gate (DB trigger) 🟢(just fixed) ·
Safety Center 🟢 · trust trees 🟡 · targeting-never-filters 🟢.

**Verdict on architecture:** breadth is enormous and mostly *works*. The gaps
that matter are exactly the two future B2B bets (planning, freelancers) and the
untested verticals — everything else exists. **The problem is not missing
features; it's missing users.**

---

## PART 3 — WHERE WE ARE ON THE PLAN

**We are at STAGE 0, pre-gate.** (0→100 users, 1 scene. See GOLDEN_PLAN §2.)

The Stage-0 gate — *"the full loop completes on a real phone, twice, by a
non-founder"* — has **not** been met. We can't even measure it: 2 check-ins, no
native app. Everything past Stage 0 is correctly sequenced but **irrelevant
until the loop is proven.**

The staged timeline (density-gated) is sound. The only planning error would be
to act as if we're further along than Stage 0. **We are not. That's fine — but
it must drive the next 8 weeks.**

---

## PART 4 — TECHNICAL FOUNDATION

- **Stack:** React Native / Expo (web via react-native-web, SPA), Supabase
  (Postgres 17, RLS, RPCs, realtime). Solo dev. Free tier only. No AI, no
  paid APIs, no money-handling — by design.
- **Hosting:** web live at thegruvs.com on a DigitalOcean droplet (nginx,
  Let's Encrypt); atomic deploys. Native: **not built** (parked on EXPO_TOKEN).
- **The drift story (de-risked, not solved):** the "paste this SQL manually" era
  is over — Supabase MCP applies tested migrations directly. But drift itself
  still recurs: as recently as 2026-08-18, `accommodation.js` was silently
  400ing on a nonexistent column and a maintenance cron had been failing every
  night for 5+ days on a wrong column name, both caught only because someone
  actually read the GitHub Guardian / Supabase advisor emails, not because a
  process guarantees it. The CI schema-drift check (`scripts/audit-schema.mjs`,
  runs in the Guardian workflow) is the real fix; it needs to be *read*, not
  just running.
- **Surface-area risk:** 216 tables / 1,071 functions is a maintenance liability
  for a solo dev. Not urgent, but: freeze new schema; consolidate opportunistically
  (e.g., the 3 date-of-birth columns); every new feature must justify its tables.
- **Blind-spot risk:** ~100 empty `catch{}` blocks. First Stage-0 task is
  `client_errors` + `logError()` so failures surface. (Check-in failing silently
  for weeks is exactly this risk realized.) — **partially closed**: `setDriftReporter`
  is now wired (`App.js`) so schema-drift and degraded-path events land in
  `client_errors` instead of a console nobody reads; the ~100 empty catches
  elsewhere are unaudited.
- **Operational memory now exists outside chat**: [RUNBOOK.md](RUNBOOK.md)
  (outage/incident playbook, where secrets live, manual chores nothing
  auto-notifies you for) and [RISK_REGISTER.md](RISK_REGISTER.md) (living,
  prioritized risk tracking — replaces one-off chat lists that used to
  evaporate). Both created 2026-08-18; check them before assuming something
  here is still accurate.

---

## PART 5 — BUSINESS MODEL (how it makes money — later)

Layered, in order of when they turn on:
1. **B2B host/brand tier (Stage 3):** the OS — planning + staffing + verified
   attendance analytics. *This is the real business* (sell proof, not attention).
2. **Consumer premium (Stage 3):** cosmetics, advanced identity, via RevenueCat.
3. **Freelancer marketplace (Stage 3–4):** take-rate or subscription once gig
   volume exists.
4. **Gifting / creator economy (Stage 4):** regulated fintech — dead last.
Never before attendance value is proven. Merchant-of-record = store/RevenueCat,
so we never touch money directly at v1.

---

## PART 6 — THE CRITICAL PATH (what unblocks what)

```
error logging ─┐
               ├─► NATIVE build (EXPO_TOKEN) ─► real Touch Downs ─► [STAGE 0 GATE]
poster-post ───┘                                     │
                                                     ▼
           founder BD: 10–20 hosts ──► liquidity ──► weekly Touch Downs ─► [STAGE 1 GATE]
                                                     │
                    planning co-pilot (supply wedge)─┤ (pulls hosts in)
                    Reward-My-Top-Fans ──────────────┘ (gives fans reason to show)
                                                     ▼
                              density ──► Crossed Paths / leaderboards / voting comps
                                                     ▼
                                        B2B monetization ──► second scene
```

**The single critical path is: native app → real check-ins → proven loop.**
Nothing else matters until that link is forged. The planning co-pilot and
Reward-My-Top-Fans are the two accelerants that make the loop *spin faster* once
native exists — they're the right "next builds," but native + BD come first.

---

## PART 7 — RISKS & GAPS (the honest holes)

> This section is a snapshot from 2026-07-06, kept for history. The living,
> continuously-updated version is [RISK_REGISTER.md](RISK_REGISTER.md) — check
> there first; it has status tracking (open/mitigated/accepted) this static
> list never will.

**Quantified risks:**
1. **Build/usage inversion (LIVE NOW):** 1,071 functions, 2 check-ins. The plan
   is right; the discipline to stop building is the actual battle.
2. **Cold start, one side solved-ish:** 2 hosts. The planning co-pilot is the
   designed fix (single-player value) but isn't built.
3. **No native = no moat data:** Touch Down needs GPS + push. Web starves it.
4. **Solo-dev surface area:** 216 tables to maintain alone.

**Gaps NOT yet in any plan (worth naming so they're not surprises):**
- **The BD playbook.** "Get 10–20 hosts" is stated, not designed. *This is the
  highest-leverage unwritten doc.* How exactly do you recruit host #1?
- **Moderation & trust at scale** (reports exist; ops process doesn't).
- **Legal:** age-gating, user-generated content, the reciprocity/accountability
  layer, POPIA (SA privacy law) once you hold real attendance/location data.
- **Support / community management** when real users arrive.
- **Payments reality** for the freelancer marketplace (off-platform is fine at
  v1, but there's a ceiling).
- **Retention proof:** we have never observed a non-founder returning. Unknown.

**None of these are planning *errors* — but the BD playbook and the "prove the
loop" instrumentation are the two missing pieces that matter most right now.**

---

## PART 8 — HOW TO KNOW IT'S WORKING (the instrument)

Watch ONE number per stage; ignore vanity metrics.
- **Stage 0:** loop completion on a real device (target: any non-founder does
  Save→go→Touch Down). Today: **0.**
- **Stage 1:** Weekly non-founder Touch Downs (target: >0, then growing weekly);
  week-2 retention >25%.
- **Stage 2:** venue-session length (in-app time DURING an event you Touched
  Down at — the real "3 hours"); Crossed-Paths density; D30 retention.
- **Stage 3:** paying hosts; ARPU; second-scene liquidity.
- **Never optimize:** raw DAU, feed-scroll minutes.

---

## THE VERDICT

**Direction: still planned correctly.** The lifecycle framing, the structure-is-
the-product moat, the density-gated sequencing, the lock-in doctrine, the
honey-not-shame reciprocity, the monetization order — all still coherent.

**Calibration: the same two corrections, now six weeks overdue.**
1. **We are still at Stage 0 with an unproven loop.** 1 distinct Touch-Down
   user in July, 1 today. The next work is *proof* (native + BD +
   instrumentation), not new surface — and six weeks of new surface got built
   anyway. That's the actual finding of this update: **the discipline this doc
   asked for in July did not hold.** Naming that plainly is more useful than
   pretending otherwise.
2. **The BD playbook still doesn't exist.** Still the single highest-leverage
   undocumented piece. Every week without it is a week the "getting a second
   host" problem stays unsolved by default, not by decision.

**Everything is planned correctly except the part that was never a coding
problem: getting the first real humans to show up. That was the whole game in
July. It is still the whole game now — and it's the one thing more
engineering, however well-verified, cannot solve.**

*Last honest reconciliation: 2026-08-18. If you're reading this later and the
numbers above haven't been refreshed, that's itself a signal — pull a fresh
snapshot (see the query pattern in Part 0) before trusting anything on this
page.*
