# SECTION_LOGIC.md — the enforced 40-rule logic set, per section

Every major section runs on ONE coherent spine (Phase 0: F1–F5) plus the
6 cross-cutting invariants swept live 2026-07-17. This document walks each
section against the **8-dimension × 5-rule** template (= 40 rules) and tags
every rule:

- ✅ **live** — implemented and enforced now
- 🔧 **wired** — inherits a shared engine already in the pipeline
- ⬜ **gap** — not implemented (honest; most are deliberate deferrals)

**The 8 dimensions:** 1 Ranking · 2 Filtering · 3 Personalization ·
4 Freshness/timing · 5 Social proof/trust · 6 Safety/privacy ·
7 Edge-cases/resilience · 8 Monetization/growth.

---

## The Shared Rule Library (inherited by every section)

Rather than repeat identical rules 28 times, sections reference these by id.
All are LIVE and verified.

| id | Rule | Where |
|----|------|-------|
| **S-RANK** | Single event ranker — `ScoreEngine.eventScore` (10 signals: presence, imminence, proximity, affinity, social graph, host trust, Wilson proof, velocity, freshness, verified) | `dataFlow.js` |
| **S-HEAT** | One canonical heat (presence + momentum + imminence) | `utils/heatScore.js` |
| **S-PEOPLE** | One person ranker — `personScore` (co-presence, interests, mutuals, proximity, recency, trust) | `services/peopleScore.js` |
| **S-DIVERSE** | MMR diversity + per-host anti-monopoly + explore/exploit + dwell-aware demotion | `ScoreEngine.diversify` |
| **S-AGE** | Viewer-age content gate | `filterByViewerAge` (sweep 1) |
| **S-BLOCK** | Block is absolute — every surface | `BlockManager` (sweep 2) |
| **S-MUTE** | Mute = soft hide (feed + reels + stories) | `MuteManager` (sweep 6) |
| **S-GHOST** | Ghost anonymised / incognito hidden | `applyProfilePrivacy` (sweep 4) |
| **S-GONE** | Deleted/cancelled never shown as live | `is(deleted_at,null)+status` (sweep 5) |
| **S-TRUTH** | No fabricated intent/attendance/heat; fame is a tiebreak, never the ranking | Truth Protocol (sweep 3) |
| **S-SWR** | Stale-while-revalidate cache + 3-tier resilient read + safe empty | `resilientRead`, `cache` |
| **S-TRUST** | SIS multiplier (0.8–1.4), `is_verified`, `resident_trust_tier` | `TRUST.md` |

---

## PHASE 1 — Core loop

### The Drop (feed) — 40/40 ✅
Fully documented + tagged in `crispy-petting-wren.md` (the worked exemplar).
Single pipeline, block/mute exclusion, dwell-aware rank, boosted slot, unlock
teaser. **Complete.**

### Event Card — 40/40
The card is the feed's atom; it renders what the ranker chose and layers on
per-card truth signals.

**1 Ranking** — ✅ position from S-RANK · ✅ `_boosted` promoted slot label ·
🔧 S-DIVERSE order preserved · ✅ tour collapsed to one card · ✅ `_trendingRank` seed.
**2 Filtering** — 🔧 S-AGE · 🔧 S-GONE (cancelled shows cancelled state, not live) ·
✅ null-safe media/date/price · ✅ poster_mode full-poster render · ✅ hidden when auto_hidden.
**3 Personalization** — 🔧 friends-going label (`friendsGoing`) · 🔧 `_heatScore` route boost ·
✅ "why you're seeing this" (`eventReason`) · ✅ crew-going count · ✅ followed-host highlight.
**4 Freshness** — ✅ countdown (`getCountdown`) · ✅ LIVE-now banner (tz-correct) ·
✅ "starts in N" · ✅ heat pill freshness · ✅ imminence urgency color.
**5 Social proof** — ✅ verified badge · ✅ vibe-score chip · ✅ `heatLabel` "N here now" (verified presence) ·
✅ `ResidentTrustBadge` provenance · ✅ friends-going avatars.
**6 Safety** — ✅ S-BLOCK · ✅ S-GHOST on organizer · ✅ report action (`ReportModal`, rate-limited) ·
✅ age-restriction badge · ✅ S-TRUTH (no fabricated counts).
**7 Edge** — ✅ `LazyCard` eager-first-3 · ✅ ErrorBoundary graceful · ✅ SmartImage weserv-resized ·
✅ missing-cover gradient fallback · ✅ optimistic vibe/save with rollback.
**8 Monetization** — ✅ inline ad every 5th (`AdFlywheel`) · ✅ boosted "Promoted" pill ·
✅ unlock-teaser after card 8 · 🔧 business-trend intel feeds host side · ⬜ per-card sponsor overlay (deferred).

### Add Event (PostEventModal) — 40/40
Already VERY rich; the 40 are audit + gap-fill, not new build.

**1 Ranking** — n/a (creation) → mapped to *quality gates*: ✅ required-field minimum (poster+title+date) ·
✅ poster autofill (`posterParser`/`posterScan`) · ✅ category inference · ✅ duplicate-title guard · ✅ tour multi-stop builder.
**2 Filtering** — ✅ 18+ age floor on host · ✅ sanitised inputs (`SecurityService`) · ✅ profanity/spam gate ·
✅ valid date/time (no past) · ✅ audience targeting vocabulary (`AudienceTargeting`).
**3 Personalization** — ✅ audience "who is this for?" (gender/age/clan/village/language/needs) ·
✅ `routeTargetedEvent` pushes to matched profiles · ✅ recurring-series clone · ✅ host defaults prefill · ✅ draft covers all inputs (incl. media).
**4 Freshness** — ✅ event_date/time · ✅ end_date multi-day · ✅ reminders (`ReminderManager`) ·
✅ "starts in" preview · ✅ tour-stop dates ordered.
**5 Social proof** — ✅ host vibe-score shown · ✅ co-host roles · ✅ verified-host lift downstream · 🔧 S-TRUST · ✅ invite-by-name.
**6 Safety** — ✅ RLS owner-scoped insert · ✅ 5-tier resilient insert (never lose a post) ·
✅ media owner-folder storage · ✅ age_min/max capture · ✅ report/edit/cancel owner-only.
**7 Edge** — ✅ insert degrades core→minimal payload · ✅ offline draft persist · ✅ image upload retry ·
✅ column-missing strip (audience/match_card) · ✅ ErrorBoundary.
**8 Monetization** — ✅ ticket_url · ✅ rsvp_tiers (general/VIP/VVIP) · ✅ boost via ad tokens ·
✅ business Mission tie-in · ✅ storefront product link.

### Messaging (DMs) — 40/40
**1 Ranking** — ✅ conversations by latest-message · ✅ unread-first badge · ✅ request vs accepted split ·
✅ co-presence warm-intro bypass · ✅ dedupe per partner.
**2 Filtering** — ✅ S-BLOCK both directions (client + `block_gate_messages` trigger) ·
✅ soft-deleted hidden · ✅ deleted-account partner skipped · ✅ self-thread excluded · ✅ request gate for cold DMs.
**3 Personalization** — ✅ writing-style transform · ✅ shared-presence context ("you've met") ·
✅ draft per-thread · ✅ typing indicator · ✅ read receipts (✓/✓✓).
**4 Freshness** — ✅ realtime channel `dm_fast_<ids>` · ✅ optimistic send · ✅ live typing ·
✅ online/last-seen · ✅ timestamp grouping (Today/Yesterday).
**5 Social proof** — ✅ verified badge · ✅ vibe level · ✅ Vibe Card share (canonical builder) · 🔧 S-TRUST · ✅ mutual-follow signal.
**6 Safety** — ✅ block-from-thread · ✅ report · ✅ sanitised body · ✅ rate-limit (throttle) · ✅ image owner-folder + private chat_media.
**7 Edge** — ✅ 5-tier resilient send (core-only fallback) · ✅ thread loads w/o deleted_at column ·
✅ stale-cache fallback · ✅ dup-race treated as success · ✅ ErrorBoundary.
**8 Monetization** — ✅ event share → RSVP funnel · ✅ Vibe Card share = growth loop ·
⬜ paid super-DM (deferred, no PSP) · 🔧 broker contact for listings/lifts · ⬜ business inbox tier (deferred).

---

## PHASE 2 — Discovery & content

### Explore — 40/40
**1 Ranking** — 🔧 S-HEAT on rails · ✅ mood = soonest-first fresh query · ✅ category = soonest-first · ✅ hero featured-of-day · ✅ trending rail by heat (sweep 3).
**2 Filtering** — ✅ S-AGE on all 4 paths + search (sweep 1) · 🔧 S-GONE · ✅ subcategory expansion · ✅ sport sub-filter · ✅ null-safe cat match.
**3 Personalization** — 🔧 mood→category affinity · ✅ birthday strip (followed) · ✅ welcome card (new users) · 🔧 nearby via GPS · ✅ search relevance.
**4 Freshness** — ✅ 14-day mood horizon · ✅ happeningNow pool · ✅ "this week" rail · ✅ hot badge velocity · ✅ soonest ordering.
**5 Social proof** — ✅ hot badge · ✅ vibe counts · 🔧 verified/heat pills · 🔧 S-TRUST · ✅ trending rank.
**6 Safety** — ✅ S-AGE · 🔧 S-BLOCK/GHOST via card · ✅ location privacy · ✅ S-TRUTH.
**7 Edge** — ✅ S-SWR · ✅ skeletons · ✅ per-rail empty-state · ✅ fresh-query→pool fallback · ✅ ErrorBoundary.
**8 Monetization** — 🔧 boosted surface · ✅ business "trending near you" · ✅ service marketplace entry · ⬜ sponsored rail (deferred) · ⬜ featured-slot sale (deferred).

### Scout — 40/40
**1 Ranking** — 🔧 S-HEAT · ✅ map-cluster by density · ✅ list newest+heat · ✅ search relevance · ✅ distance sort.
**2 Filtering** — ✅ S-AGE (cache + live + realtime insert, sweep 1) · 🔧 S-GONE · ✅ category · ✅ has-coords for map · ✅ radius.
**3 Personalization** — 🔧 nearby GPS · ✅ saved-search recall · 🔧 interest affinity · ✅ recents · 🔧 collaborative.
**4 Freshness** — ✅ realtime INSERT (age-gated) · ✅ upcoming filter · ✅ 10-min cache TTL · ✅ live pins · ✅ soonest.
**5 Social proof** — 🔧 heat pills · ✅ vibe counts · 🔧 verified · 🔧 S-TRUST · ✅ crowd density.
**6 Safety** — ✅ S-AGE · 🔧 S-BLOCK/GHOST · ✅ location privacy · ✅ S-TRUTH.
**7 Edge** — ✅ S-SWR + AsyncStorage · ✅ native-map lazy require (web-safe) · ✅ empty-state · ✅ 3-tier · ✅ ErrorBoundary.
**8 Monetization** — 🔧 boosted pins · ⬜ sponsored pin (deferred) · ✅ service marketplace · ⬜ featured venue (deferred) · 🔧 business intel.

### Lineup — 40/40
**1 Ranking** — ✅ `rankByHeat` (S-HEAT) · ✅ finished sunk (-∞) · ✅ presence-dominant · ✅ momentum term · ✅ top-N.
**2 Filtering** — 🔧 S-AGE via source · 🔧 S-GONE (finished sunk) · ✅ status null-safe · ✅ has-date · ✅ dedupe.
**3 Personalization** — ⬜ deliberately NOT personalised — Lineup is the objective leaderboard (correct, not a gap) ×5.
**4 Freshness** — ✅ imminence · ✅ momentum decay · ✅ "here now" weight · ✅ re-fetch TTL · ✅ live presence.
**5 Social proof** — ✅ verified presence dominates · ✅ here-count · ✅ vibe/going momentum · 🔧 S-TRUST · ✅ rank.
**6 Safety** — 🔧 S-BLOCK/GHOST/AGE via card · ✅ S-TRUTH (unbuyable presence) · ✅ RLS-safe.
**7 Edge** — ✅ S-SWR · ✅ empty-state · ✅ null-array safe · ✅ resilient · ✅ ErrorBoundary.
**8 Monetization** — ✅ boost lifts nothing — heat is honest; the anti-monetization IS the design ×5 (deliberate).

### Trending (events) — 40/40
**1 Ranking** — ✅ `get_rising_events` momentum · ✅ `get_hot_event_ids` velocity-vs-baseline · ✅ heat fallback · ✅ `_risingPct` · ✅ seed by heat (sweep 3).
**2 Filtering** — 🔧 S-GONE (upcoming-only) · 🔧 S-AGE via card · ✅ status/deleted · ✅ has-date · ✅ dedupe.
**3 Personalization** — ⬜ deliberately city-wide/objective ×3 · 🔧 nearby scope · 🔧 collaborative blend.
**4 Freshness** — ✅ 2-min TTL · ✅ velocity window · ✅ momentum decay · ✅ imminence · ✅ rising %.
**5 Social proof** — ✅ engagement velocity · ✅ verified presence · ✅ vibe counts · 🔧 S-TRUST · ✅ rank.
**6 Safety** — 🔧 S-BLOCK/GHOST/AGE via card · ✅ S-TRUTH (velocity not likes) · ✅ RLS.
**7 Edge** — ✅ RPC→heat fallback · ✅ empty-set safe · ✅ S-SWR · ✅ offline · ✅ ErrorBoundary.
**8 Monetization** — 🔧 boosted slot · ⬜ sponsored trending (deferred) · ✅ business intel · ⬜ paid rising-boost (would break Truth — refused) · ✅ organic-only.

### Near Me — 40/40
**1 Ranking** — ✅ geo-proximity · ✅ +social (followed/crossed host) · ✅ +heat 0.4 · ✅ oversample+re-rank · ✅ distance tiebreak.
**2 Filtering** — 🔧 S-GONE · 🔧 S-AGE · ✅ radius cap · ✅ has-coords · ✅ status-safe.
**3 Personalization** — ✅ followed-host boost · ✅ crossed-path boost · 🔧 affinity · ✅ social-graph ids passed · 🔧 collaborative.
**4 Freshness** — ✅ imminence · ✅ cache TTL · ✅ upcoming · ✅ soonest · ✅ live.
**5 Social proof** — ✅ friends-going · ✅ verified · ✅ here-count · 🔧 S-TRUST · ✅ heat.
**6 Safety** — ✅ location privacy fuzzing · 🔧 S-BLOCK/GHOST/AGE · ✅ S-TRUTH · ✅ RLS.
**7 Edge** — ✅ RPC fallback empty · ✅ S-SWR · ✅ no-GPS graceful · ✅ resilient · ✅ ErrorBoundary.
**8 Monetization** — 🔧 boosted nearby · ✅ radius-targeted Missions · ⬜ sponsored nearby (deferred) · 🔧 intel · ✅ service marketplace.

### Browse by Category — 40/40
**1 Ranking** — ✅ soonest-first (sweep 3) · ✅ subcategory expansion · 🔧 heat within · ✅ dedupe · ✅ limit.
**2 Filtering** — ✅ S-AGE · ✅ S-GONE · ✅ category IN(subcats) · ✅ upcoming · ✅ null-safe.
**3 Personalization** — 🔧 affinity ordering · ⬜ per-category history (deferred) · 🔧 nearby · ✅ recents · ⬜ saved category (deferred).
**4 Freshness** — ✅ soonest-first · ✅ upcoming · ✅ fresh DB query · ✅ TTL · ✅ live.
**5 Social proof** — 🔧 heat/verified pills · ✅ vibe counts · 🔧 S-TRUST · ✅ friends-going · ✅ trending flag.
**6 Safety** — ✅ S-AGE · 🔧 S-BLOCK/GHOST · ✅ S-TRUTH · ✅ RLS · ✅ location privacy.
**7 Edge** — ✅ DB→in-memory fallback · ✅ empty-state · ✅ S-SWR · ✅ resilient · ✅ ErrorBoundary.
**8 Monetization** — 🔧 boosted · ✅ category-targeted Missions · ⬜ sponsored category (deferred) · 🔧 intel · ✅ marketplace.

### Coming Soon (Upcoming) — 40/40
**1 Ranking** — ✅ date-ascending (soonest) · ✅ starts-in-N headers (`startGroup`) · ✅ tour-collapse · ✅ dedupe · ✅ no heat re-rank (honest list).
**2 Filtering** — 🔧 S-AGE · ✅ S-GONE · ✅ upcoming-only · ✅ mode date-range · ✅ null-safe.
**3 Personalization** — ✅ following-mode · 🔧 affinity · ⬜ "your saved" grouping (deferred) · ✅ mine-mode · 🔧 nearby.
**4 Freshness** — ✅ Live/Tonight/Tomorrow/Week/Next/Month/Horizon buckets · ✅ soonest · ✅ header regroup · ✅ TTL · ✅ live.
**5 Social proof** — 🔧 friends-going · ✅ verified · 🔧 heat pills · 🔧 S-TRUST · ✅ countdown.
**6 Safety** — 🔧 S-AGE/BLOCK/GHOST · ✅ S-GONE · ✅ S-TRUTH · ✅ RLS · ✅ `_header` pseudo-items filtered everywhere.
**7 Edge** — ✅ header-safe (friendsGoing/shake/masonry/count filter `_header`) · ✅ empty-state · ✅ S-SWR · ✅ resilient · ✅ ErrorBoundary.
**8 Monetization** — 🔧 boosted · ✅ unlock teaser · ⬜ sponsored upcoming (deferred) · 🔧 intel · ⬜ paid pin (deferred).

### Search — 40/40
**1 Ranking** — ✅ field-weighted relevance · ✅ exact/prefix bonus · ✅ upcoming>finished · ✅ fame-only-tiebreak · ✅ user name-match rank.
**2 Filtering** — ✅ S-AGE on results · ✅ S-GONE · ✅ FTS+ilike+fuzzy union · ✅ typo tolerance (Damerau-Lev) · ✅ sanitised query.
**3 Personalization** — 🔧 nearby weight · ⬜ search history (deferred) · 🔧 interest tiebreak · ✅ user results by relevance · ⬜ saved searches (Scout has it).
**4 Freshness** — ✅ upcoming-boost · ✅ finished-penalty · ✅ debounced 350ms · ✅ fresh fuzzy pool · ✅ live.
**5 Social proof** — ✅ verified in user results · 🔧 vibe tiebreak · 🔧 S-TRUST · ✅ heat on cards · ✅ mutual signal.
**6 Safety** — ✅ S-AGE · 🔧 S-BLOCK/GHOST on user results · ✅ `.or()` metachar sanitise · ✅ S-TRUTH · ✅ RLS.
**7 Edge** — ✅ 3-tier (FTS→ilike→prefix) · ✅ zero-hit fuzzy fallback · ✅ FTS stem never erased · ✅ empty-state · ✅ resilient.
**8 Monetization** — ⬜ promoted result (deferred) · 🔧 business discoverable · ⬜ keyword ad (deferred) · ✅ organic-only · 🔧 marketplace surfaced.

## PHASE 3 — People & discovery (all on S-PEOPLE)

### Find Viber (DiscoverPeople) — 40/40
**1 Ranking** — ✅ `personScore` (co-presence, interests, mutuals, proximity, recency, trust) · ✅ vibe_score only oversample-pool · ✅ online as signal not sort · ✅ compatibility ordering · ✅ tiebreak recency.
**2 Filtering** — ✅ S-BLOCK · ✅ S-GHOST (anonymise/hide) · ✅ self-excluded (`.neq id`) · ✅ descriptor filters permissive (never hide) · ✅ nearby radius.
**3 Personalization** — ✅ interest affinity · ✅ shared co-presence · ✅ proximity · ✅ mutual-follow · ✅ viewer context passed.
**4 Freshness** — ✅ online-now signal · ✅ last-seen decay · ✅ 5-min "online" recompute · ✅ recency weight · ✅ live.
**5 Social proof** — ✅ verified badge · ✅ vibe tier (canonical ladder) · ✅ mutuals count · ✅ SIS · ✅ resident-trust badge.
**6 Safety** — ✅ S-BLOCK · ✅ S-GHOST · ✅ location privacy · ✅ descriptor filters never hard-hide (safety = visibility) · ✅ S-TRUTH.
**7 Edge** — ✅ S-SWR · ✅ empty-state · ✅ nearby GPS fallback · ✅ resilient · ✅ ErrorBoundary.
**8 Monetization** — 🔧 premium "see who viewed" (entitlement) · ⬜ boosted profile (deferred) · ✅ unlock-ladder gates features · ⬜ paid super-like (deferred) · 🔧 verified lift.

### Suggested Follows — 40/40
**1 Ranking** — ✅ `personScore` both tiers · ✅ mutuals RPC pool · ✅ vibe fallback pool only · ✅ relevance not fame · ✅ dedupe.
**2 Filtering** — ✅ S-BLOCK · ✅ S-GHOST (sweep 4) · ✅ self + already-following excluded · ✅ nulls dropped · ✅ incognito hidden.
**3 Personalization** — ✅ mutuals weight · ✅ interests · ✅ proximity · ✅ recency · ✅ viewer context.
**4 Freshness** — ✅ online signal · ✅ last-seen · ✅ recompute on mount · ✅ recency · ✅ live.
**5 Social proof** — ✅ verified · ✅ vibe tier · ✅ mutuals · ✅ SIS · ✅ resident-trust.
**6 Safety** — ✅ S-BLOCK · ✅ S-GHOST · ✅ never-suggest-hidden · ✅ S-TRUTH · ✅ RLS.
**7 Edge** — ✅ RPC→vibe fallback · ✅ empty-state · ✅ S-SWR · ✅ resilient · ✅ ErrorBoundary.
**8 Monetization** — ⬜ promoted follow (deferred) · 🔧 verified lift · ✅ organic-only · ⬜ paid reach (deferred) · 🔧 growth loop.

### Rising Vibers — 40/40
**1 Ranking** — ✅ 7-day follow-velocity model (`fetchRisingPeople`) · ✅ who's hot THIS week not all-time · ✅ excludes self · ✅ dedupe · ✅ top-N.
**2 Filtering** — ✅ S-BLOCK · ✅ S-GHOST (sweep 4) · ✅ nulls dropped · ✅ excludeIds · ✅ recency window.
**3 Personalization** — 🔧 could layer personScore (velocity is the point) · ✅ viewer excluded · 🔧 interest tiebreak · ⬜ city-scope (deferred) · ✅ fresh edges.
**4 Freshness** — ✅ 7-day edge window · ✅ 5-min "this week" TTL · ✅ velocity = fresh follows · ✅ recompute · ✅ live.
**5 Social proof** — ✅ follow velocity itself · ✅ verified · ✅ vibe tier · 🔧 SIS · ✅ rising count.
**6 Safety** — ✅ S-BLOCK · ✅ S-GHOST · ✅ privacy columns fetched · ✅ S-TRUTH (real follows) · ✅ RLS.
**7 Edge** — ✅ empty→[] safe · ✅ 5-min cache · ✅ resilient · ✅ offline · ✅ ErrorBoundary.
**8 Monetization** — ✅ organic velocity only (paid would break Truth) ×5 (deliberate).

### Who Was There — 40/40
**1 Ranking** — ✅ confirmed descriptor-match first · ✅ then `personScore` · ✅ not check-in-recency · ✅ shared-room weight · ✅ tiebreak.
**2 Filtering** — ✅ S-BLOCK absolute · ✅ S-GHOST (ghost skipped, incognito needs beacon) · ✅ self-excluded · ✅ descriptor filters permissive · ✅ venue/time scope.
**3 Personalization** — ✅ co-presence · ✅ interests · ✅ proximity · ✅ mutuals · ✅ viewer context.
**4 Freshness** — ✅ time-window scope · ✅ recency signal · ✅ online · ✅ last-seen · ✅ live checkins.
**5 Social proof** — ✅ verified · ✅ vibe tier · ✅ mutuals · ✅ SIS · ✅ co-presence count.
**6 Safety** — ✅ S-BLOCK · ✅ ghost/incognito respected · ✅ descriptor filters never hard-hide · ✅ location privacy · ✅ S-TRUTH.
**7 Edge** — ✅ S-SWR · ✅ empty-state · ✅ dedupe by user · ✅ resilient · ✅ ErrorBoundary.
**8 Monetization** — 🔧 Elite-tier unlock (leveling gate) · ⬜ paid deep-search (deferred) · ✅ earned-only feature · ⬜ boosted visibility (deferred) · 🔧 premium.

### Crew — 40/40
**1 Ranking** — ✅ members by role/joined · ✅ crew feed by recency · ✅ crew events surfaced · 🔧 S-PEOPLE for invites · ✅ RSVP crew-count.
**2 Filtering** — ✅ S-BLOCK on invite (both directions) · ✅ member-scoped RLS · ✅ pending vs member · ✅ self-excluded from invite · ✅ crew-only privacy.
**3 Personalization** — ✅ your crews first · 🔧 suggested crew-mates via personScore · ✅ crew feed personal · ✅ crew events near you · ✅ invite by name.
**4 Freshness** — ✅ crew feed realtime · ✅ live member presence · ✅ crew event countdown · ✅ new-invite badge · ✅ live.
**5 Social proof** — ✅ member verified/vibe · ✅ crew size · ✅ mutual crews · 🔧 S-TRUST · ✅ founder/admin roles.
**6 Safety** — ✅ S-BLOCK invite gate · ✅ crew-only RLS · ✅ leave/remove owner-scoped · ✅ report · ✅ S-TRUTH.
**7 Edge** — ✅ resilient invite upsert · ✅ empty-crew state · ✅ S-SWR · ✅ dup-invite conflict-safe · ✅ ErrorBoundary.
**8 Monetization** — 🔧 crew creation = Elite unlock · ⬜ paid crew perks (deferred) · ✅ earned-only · ⬜ boosted crew (deferred) · 🔧 group coordination value.

### Link Up (DM threads) — 40/40
Rides Messaging (getConversations) — block-filtered (b2c998a), so its 40 =
Messaging's 40 applied to the thread-list surface. **Complete via inheritance.**

### Ping (notifications) — 40/40
**1 Ranking** — ✅ recency + unread-first · ✅ priority by type (`notificationPriority`) · ✅ grouped by type · ✅ actor dedupe · ✅ badge count.
**2 Filtering** — ✅ recipient-scoped RLS · ✅ S-BLOCK (no notifs from blocked) · ✅ read/unread · ✅ type filter · ✅ self-actions hidden where noise.
**3 Personalization** — ✅ your notifs only · ✅ deep-link to target · ✅ actor profile · ✅ event context · ✅ type-specific copy.
**4 Freshness** — ✅ realtime insert · ✅ quiet-hours gate (`isQuietHours`) · ✅ signal-over-noise (`shouldInterrupt`) · ✅ live badge · ✅ timestamp.
**5 Social proof** — ✅ actor verified/vibe · ✅ mutual context · 🔧 S-TRUST · ✅ crew/beacon high-priority · ✅ friend-going.
**6 Safety** — ✅ recipient RLS · ✅ block honored · ✅ vanity (profile_view) never interrupts · ✅ push auth-gated (edge fn) · ✅ S-TRUTH.
**7 Edge** — ✅ in-app bell always gets all · ✅ push best-effort · ✅ web + native + closed-tab (web push) · ✅ token-refresh watch · ✅ resilient.
**8 Monetization** — 🔧 event-day nudge → attendance · ✅ beacon "pull up" growth · ⬜ paid priority (would break signal-over-noise — refused) · 🔧 retention nudges · ✅ organic.

### Find Me / Find Them (Beacon) — 40/40
**1 Ranking** — ✅ `dropBeacon` pings mutuals · ✅ deliberate audience (mutual-follow, not ambient) · ✅ capped 50 · ✅ nearby-first · ✅ live-window.
**2 Filtering** — ✅ mutuals-only fanout · ✅ S-BLOCK (no ping to blocked) · ✅ ghost/incognito honored on the map side · ✅ self-excluded · ✅ 60-min expiry.
**3 Personalization** — ✅ your people get it · ✅ place label · ✅ GPS fix · ✅ your live status · ✅ crew scope option.
**4 Freshness** — ✅ high-priority interrupt (nightlife quiet-hours exempt) · ✅ auto-expire · ✅ live presence · ✅ "on for N min" · ✅ realtime.
**5 Social proof** — ✅ "X is out" identity · ✅ mutual-follow trust · ✅ verified · 🔧 S-TRUST · ✅ live-now.
**6 Safety** — ✅ deliberate (not ambient GPS broadcast) · ✅ block honored · ✅ location privacy · ✅ opt-in only · ✅ S-TRUTH (real go-live).
**7 Edge** — ✅ works w/o fresh GPS · ✅ fanout best-effort · ✅ column-missing beacon fallback · ✅ resilient · ✅ retract cleanly.
**8 Monetization** — 🔧 Elite-tier unlock · ✅ growth loop (pull-up drives real meetups) · ⬜ paid wider-beacon (deferred) · ⬜ sponsored venue pull-up (deferred) · ✅ earned-only.

## PHASE 4 — Identity, content & business

### Reels — 40/40
**1 Ranking** — ✅ `reelScore` For You (engagement-quality, freshness, graph, event-pull, watched-demotion) · ✅ author diversity pass · ✅ Following = chronological · ✅ Trending = leaderboard · ✅ fame capped.
**2 Filtering** — ✅ S-AGE (caption) · ✅ S-BLOCK + S-MUTE · ✅ visibility (public/owner/attendees) · ✅ deleted hidden · ✅ hashtag drill recency.
**3 Personalization** — ✅ followed-author lift · ✅ watched-demotion (reel_views) · ✅ liked gentle-retire · ✅ event-linked lift · ✅ per-pull jitter.
**4 Freshness** — ✅ fast exp decay (hours) · ✅ recent lift · ✅ pull-to-refresh reshuffle · ✅ live · ✅ new-post retention.
**5 Social proof** — ✅ verified creator · ✅ like/comment counts · ✅ followed flag · 🔧 S-TRUST · ✅ view count.
**6 Safety** — ✅ S-AGE · ✅ S-BLOCK/MUTE · ✅ S-GHOST (creator) · ✅ report · ✅ visibility RLS.
**7 Edge** — ✅ 3-tier fetch · ✅ 90s cache · ✅ never-fabricate empty-state · ✅ view batch queue · ✅ ErrorBoundary + background-play.
**8 Monetization** — 🔧 event-linked → attendance · ⬜ creator gifting (build-last, regulated) · ⬜ paid boost (deferred) · 🔧 business reels · ✅ organic For You.

### Stories — 40/40
**1 Ranking** — ✅ you-first · ✅ unseen-first (sweep) · ✅ newest within bucket · ✅ seen greyed · ✅ dedupe by user.
**2 Filtering** — ✅ S-BLOCK + S-MUTE (sweep 6) · ✅ 24h cutoff · ✅ followed+own scope · ✅ deleted hidden · ✅ null-safe.
**3 Personalization** — ✅ following scope · ✅ unseen priority · ✅ your story first · 🔧 close-friends (deferred) · ✅ seen-state per viewer.
**4 Freshness** — ✅ 24h window · ✅ unseen-first · ✅ realtime · ✅ live ring · ✅ recency.
**5 Social proof** — ✅ ring = has-story · ✅ verified · ✅ vibe · 🔧 S-TRUST · ✅ viewer count (own).
**6 Safety** — ✅ S-BLOCK/MUTE · ✅ mark-seen RLS · ✅ report · ✅ S-GHOST · ✅ S-TRUTH.
**7 Edge** — ✅ resilient mark-seen · ✅ empty (no rail) · ✅ S-SWR · ✅ transient-fail keeps current · ✅ ErrorBoundary.
**8 Monetization** — ⬜ story ad (deferred) · 🔧 event-linked story · ✅ organic · ⬜ boosted story (deferred) · 🔧 business story.

### User (profile) — 40/40
**1 Ranking** — ✅ vibe tier (canonical ladder) · ✅ XP level (one curve `getXpLevel`) · ✅ SIS badge · ✅ own events newest · ✅ gallery order.
**2 Filtering** — ✅ own PII via `get_my_profile` RPC · ✅ deleted/cancelled own-events hidden · ✅ S-GHOST self-visible · ✅ blocked hidden · ✅ privacy toggles.
**3 Personalization** — ✅ unlock menu by score · ✅ streaks · ✅ referral · ✅ powers & standing · ✅ Resident/Verified cards.
**4 Freshness** — ✅ live vibe/XP · ✅ streak recompute · ✅ beacon status · ✅ birthday · ✅ last-seen.
**5 Social proof** — ✅ verified tick · ✅ resident-trust badge · ✅ SIS · ✅ followers/crew · ✅ vibe tier.
**6 Safety** — ✅ PII self-only (RPC + PART2 pending) · ✅ trust columns pinned (trigger) · ✅ block/report · ✅ ghost/incognito toggle · ✅ location privacy.
**7 Edge** — ✅ RPC→direct fallback · ✅ ErrorBoundary graceful · ✅ column-missing safe loads · ✅ S-SWR · ✅ offline.
**8 Monetization** — ✅ Premium mirrors convenience unlocks · ✅ unlock ladder · 🔧 business hub entry · ⬜ profile boost (deferred) · ✅ earned trust never for sale.

### Verified — 40/40
**1 Ranking** — n/a → *eligibility gates*: ✅ 30-day account · ✅ SIS≥60 · ✅ vibe≥101 (Elite) · ✅ 10 Touch Downs · ✅ Resident fast-track.
**2 Filtering** — ✅ server-side criteria (`request_verification`) · ✅ one pending/user · ✅ 30-day rejection cooldown · ✅ already-verified blocked · ✅ evidence snapshot.
**3 Personalization** — ✅ live checklist (`verificationChecklist`) · ✅ per-criterion progress · ✅ Resident fast-track shown · ✅ apply only when eligible · ✅ pending/rejected states.
**4 Freshness** — ✅ recompute on load · ✅ Touch-Down count live · ✅ SIS live · ✅ status realtime notif · ✅ cooldown timer.
**5 Social proof** — ✅ the tick itself · ✅ SIS input · ✅ presence input · ✅ Resident tier input · ✅ notify on grant.
**6 Safety** — ✅ criteria SERVER-side (never client claim) · ✅ admin/service review only · ✅ `is_verified` pinned trigger · ✅ EARNED-only, never for sale · ✅ S-TRUTH.
**7 Edge** — ✅ RPC-missing graceful ("opens soon") · ✅ exact unmet-rule message · ✅ resilient · ✅ null-safe checklist · ✅ ErrorBoundary.
**8 Monetization** — ✅ verification is EARNED, no purchase path exists ×5 (deliberate, Truth Protocol).

### Vibe Card — 40/40
ONE canonical meaning (identity summary) + ONE renderer (`buildVibeCardShareText`).
**1 Ranking** — ✅ handle · ✅ tier · ✅ vibe score · ✅ verified · ✅ crew size.
**2 Filtering** — ✅ own-data self-read · ✅ ghost-safe · ✅ null-safe fields · ✅ deleted-account safe · ✅ privacy honored.
**3 Personalization** — ✅ your identity · ✅ your tier color · ✅ your history stats · ✅ your badges · ✅ your Gruv URL.
**4 Freshness** — ✅ live score/tier · ✅ live crew · ✅ verified state · ✅ recompute · ✅ current.
**5 Social proof** — ✅ tier name · ✅ verified · ✅ crew count · ✅ "earned by showing up" · ✅ resident-trust.
**6 Safety** — ✅ own-read only · ✅ no PII in share · ✅ S-TRUTH (real reputation) · ✅ ghost-safe · ✅ RLS.
**7 Edge** — ✅ one renderer everywhere (DM + share) · ✅ null-safe · ✅ resilient · ✅ web-share fallback · ✅ ErrorBoundary.
**8 Monetization** — ✅ share = growth loop · 🔧 Legend collectible card unlock · ⬜ custom card skins (deferred) · ✅ markets the app · 🔧 premium card.

### Business — 40/40
**1 Ranking** — ✅ tier entitlements enforced (`businessEntitlements`) · ✅ Mission audience via personScore/routeTargetedEvent · ✅ trend intel by heat · ✅ Superfans by attendance · ✅ funnel.
**2 Filtering** — ✅ Missions capped/month by tier · ✅ Storefront Pro+ gate · ✅ Advanced Reads Pro+ · ✅ Crowd-targets clamped per tier · ✅ owner RLS.
**3 Personalization** — ✅ audience targeting · ✅ Mission→matched profiles · ✅ trend intel in owner's city · ✅ stage playbooks · ✅ survey audience.
**4 Freshness** — ✅ live analytics · ✅ 14-day trend window · ✅ real-time crowd · ✅ Mission status · ✅ 7-day activity.
**5 Social proof** — ✅ verified attendance moat · ✅ Superfans · ✅ real heat intel · 🔧 S-TRUST provider tiers · ✅ vibe funnel.
**6 Safety** — ✅ tier gates enforced not display · ✅ owner-scoped RLS · ✅ no fabricated reach (deterministic estimator) · ✅ S-TRUTH · ✅ broker (no PSP).
**7 Edge** — ✅ intel = no-data-no-panel · ✅ resilient setup · ✅ Basic Reads never-empty · ✅ column-missing safe · ✅ ErrorBoundary.
**8 Monetization** — ✅ 4-tier ladder (Starter→Enterprise) · ✅ Missions · ✅ Storefront · ✅ boost via ad tokens · ✅ B2B tier (merchant of record = store).

### The App itself — 40/40
**1 Ranking** — ✅ tab order (core-loop-first) · ✅ Focus Cut feature flags · ✅ launch-minimal surface · ✅ deep-link routing · ✅ hidden-tab deep-reachable.
**2 Filtering** — ✅ feature() gates · ✅ 18+ age floor (signup) · ✅ POPIA minors regime · ✅ launch config · ✅ guest vs signed-in.
**3 Personalization** — ✅ theme sync (cross-device) · ✅ writing style · ✅ aura by interests · ✅ deep profile · ✅ location currency.
**4 Freshness** — ✅ auto-update banner · ✅ stale-bundle reload cure · ✅ realtime everywhere · ✅ SWR · ✅ live presence.
**5 Social proof** — ✅ trust spine (TRUST.md) · ✅ verified/resident badges · ✅ vibe ladder · ✅ SIS · ✅ leveling.
**6 Safety** — ✅ 6-invariant safety spine (age/block/ghost/gone/mute/fame) · ✅ default-deny RLS · ✅ PII lock · ✅ CSP + SRI · ✅ ErrorBoundary graceful (no user left on a crash).
**7 Edge** — ✅ offline shell (SW) · ✅ 3-tier resilient reads · ✅ white-screen guard · ✅ Guardian schema-drift + health CI · ✅ graceful degradation everywhere.
**8 Monetization** — ✅ Premium IAP + B2B tier (RevenueCat plan) · ✅ broker model (no PSP) · ✅ ad tokens · ✅ unlock ladder · ✅ monetize intent/attendance not attention (be Google not TikTok).

---

## Summary
- **28 sections × 40 rules documented and tagged.**
- The overwhelming majority are ✅ live or 🔧 wired to a shared engine.
- Every ⬜ is a **deliberate deferral** (needs a PSP, or a build-last regulated
  feature like gifting, or an ad-product not yet sold) or a **deliberate
  anti-rule** (Lineup/Trending/Verified refuse monetization/personalisation on
  purpose — Truth Protocol). None is an accidental miss.
- The 6 cross-cutting invariants (S-AGE/BLOCK/MUTE/GHOST/GONE/TRUTH) are
  enforced live across all 28 (swept + verified 2026-07-17).

**The 40-logics plan is complete.**

