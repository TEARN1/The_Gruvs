# The Gruvs — Complete User Flow

> The end-to-end journey through the app, grounded in the real navigation + features.
> Tabs (bottom bar / sidebar): **The Drop · Reels · Explore · Lineup · Linked Up · Pings · Vibe Card**.
> ⛳ = gated on a pending DB migration (see FIX_LIVE_ISSUES.sql / FIX_COMPETITION_ENGINE.sql).

---

## 0. Entry & Auth
1. **Guest landing** — a visitor can browse The Drop and open events (read-only proof: counts, who's going) before signing up. Participation (Vibe / Locked In / Touch Down / DM) walls to auth.
2. **Sign up (2-step, AuthModal)** — Step 1: username + email + password (handle uniqueness checked live). Step 2 (skippable): city, gender, birth year, interests. → profile row created.
3. **Sign in** — email + password. **Forgot password** → reset email → recovery link → set new password (AuthContext catches the recovery token, ResetPasswordModal). ⛳ needs Supabase Site URL = thegruvs.com.
4. First run drops you into **The Drop**, located to your city.

---

## 1. The core verb ladder (the spine of the whole app)
A user's relationship to an event escalates through 4 verbs:
1. **Save** (private) — bookmark for later; lands in Lineup; reminder 24h before.
2. **Vibe** (hype) — public interest signal; pushes the event up other feeds.
3. **Locked In** (intent / RSVP) — "I'm coming"; counts toward capacity.
4. **Touch Down** (verified presence) — GPS check-in at the venue; the unfakeable signal. Unlocks Crossed Paths, ratings, gallery, streak, passport stamp.

**Truth Protocol:** every surface shows the gap between hype (Vibe), intent (Locked In) and reality (here-now Touch Downs). Verified presence always wins.

---

## 2. THE DROP (feed) — discover
- Personalised live feed: ranked by **hot × near × your scene × timing** (never engagement-farming).
- Each card: cover image, title, date/venue chips, price, **"N people you follow are going"** crew badge, and an honest **heat pill** ("🔥 N here now" / "Filling fast").
- **Why you're seeing it** is always shown (crew / rising / near).
- Category filter pills + **Refresh** button (web) / pull-to-refresh (native).
- Header rails: Stories, Community stats, **"Your crew is out right now"** digest, Friend activity.
- Tap a card → **Event Detail**.

## 3. EXPLORE (Scout) — search the whole city
- Full catalogue + smart search (relevance-ranked: title > venue/city > category > host).
- Filters (category, time, free, distance). Past events dimmed.
- The "raw reality" browse for skeptics — near-me-by-time, no algorithm.

## 4. EVENT DETAIL — decide & act
- Media, description, schedule, map, realness badge (Vibe/Locked-In/Here breakdown).
- Actions: **Save · Vibe · Locked In (RSVP, tiered) · Touch Down** (when near), Reminder, Add to calendar, **Share** (rich link via og-meta ⛳), Get tickets.
- Social proof: who's going (avatars), live "here now" count, Echoes (comments), reactions.
- **Crossed Paths** reveal after Touch Down — people you keep running into (ghosts/incognito excluded).
- **After the event:** post-event **Recap** (show-rate: who locked in vs who actually showed), gallery, ratings.
- **Organiser/co-host only → "Manage" tab:** EventManagementPanel (lineup, roles, updates) — or **SportManagementPanel** for sport events (see §8).

## 5. LINEUP — plan & rank
- Your saved/locked-in events as a schedule (calendar + week strip).
- **The Lineup heat board** — events ranked by verified heat (presence > buzz > soon), distinct from the personalised feed.
- Toggle to **Crew** view (your squad).

---

## 6. SOCIAL GRAPH
- **Follow** (one-way) / **Crew** (mutual squad) — invite, crest, group plans.
- **Crossed Paths** — deliberate co-presence, ranked most→least; "make it official" → add to Crew.
- **Linked Up (DMs)** — **mutual-only** (no cold messages); first message from a non-mutual = a **request**. Block = silent + bidirectional. ⛳ messages columns.
- **Pings (notifications)** — RSVPs, messages, follows, event reminders, "your crew is out", now-playing, results. Realtime + (web) browser notifications via the toggle.

## 7. REELS & CONTENT
- Short-form video feed (Gruv-anchored Moments + lasting Gallery).
- Like, comment, share, save; reels can attach to an event.
- Create Reel (camera/upload), "now playing" tagging.

---

## 8. COMPETITION / SPORTS FLOW (the "FIFA" depth) ⛳ FIX_COMPETITION_ENGINE.sql
1. Create a **sport event** (PostEventModal, sport category).
2. Open it → **Manage tab → SportManagementPanel**:
   - **Teams** — add teams, link **Clubs**.
   - **Fixtures** — schedule matches, enter live scores → **standings auto-recompute**.
   - **Scoreboard** — live league table.
3. **Tag players** (EventGuestsModal) → appearances roll up into **player career stats** (FIFA cards: ratings, goals, spells, seasons).
4. Viewers: **match predictions**, **tournament governance voting** (vote for officials who control the data), player profiles.

## 9. BUSINESS / GIG FLOW
- Any user toggles **Business** (one identity) → Business dashboard, **Store builder** (publish a page), **Campaigns** (targeted contextual ads to verified attendees — targeting now applied at delivery).
- Two roles per event: **sell to attendees** (offers per pre/during/post phase) + **find gigs** (services, verified-event portfolios).
- Platform = connection, payment off-platform (no money-handling yet).

## 10. IDENTITY & GAMIFICATION (Vibe Card)
- **Vibe Card** = reputation/player card (not an IG profile): level, footprint, streaks, scene DNA, verified-regular badges.
- **Identity modes:** Public / **Ghost** (anonymous, still counts, uncrossable) / **Incognito** (hidden unless you Drop a Beacon).
- **Levels:** Viber → Elite → Royal → Gruv Master → Legend (earned by Touch Downs). Trust powers earned-only; cosmetics earn-or-buy.
- Profile cards: **Vibe Passport** (venue/city/scene stamps), **Memories** ("on this day"), **Unlock Menu** (powers + next unlock), **Touch Down streak**, **Nightlife Wrapped** (shareable year-in-review), **"You leveled the scene up"**.
- Settings: privacy toggles (discoverable / show-online / share-events — all enforced), notifications, currency, app lock, **Career & Looks** (drives invite-by-profession targeting), **Disappear now** (panic → Ghost + clear presence), Emergency contacts (per-contact **SOS**).

## 11. SAFETY (woven through, the growth lever)
- Mutual-only DMs · silent bidirectional block · Ghost/Incognito · one-tap report (trust-weighted) · 18+ gate · safe-ride (ReturnPath) · panic disappear · SOS to emergency contacts · "Your Safety, Your Rules" Academy lesson.

---

## The loop, in one line
**Discover (Drop/Explore) → Decide (Event Detail: realness) → Commit (Save→Vibe→Locked In) → Show up (Touch Down) → Connect (Crossed Paths/Crew/DMs) → Reckon (Recap/ratings) → Flex (Wrapped/Passport/Card) → Spread (honest shares).**

## ⛳ Currently gated on DB migrations (run in Supabase)
- `FIX_LIVE_ISSUES.sql` → check-in, DMs, reels, profile fields
- `FIX_COMPETITION_ENGINE.sql` → standings, careers, votes, predictions
- Long-tail RPCs (polls, crew, surveys, moderation, gifting) → schema_part_2→3→4→1

---

## ✨ Improved journeys (upgrade roadmap)
Refinements that remove friction / add delight. ✅ shipped · ◻️ queued.

1. **Entry/Auth** — land on the magic moment (a popping event near you, no empty
   state) → browse free → ◻️ **signup only when you act** (contextual wall) →
   30-sec Step 1 (or magic-link) → ◻️ Step 2 = visual chips, skippable → feed
   already personalised. *Kills the #1 signup drop-off.*
2. **Event lifecycle** — ◻️ one **escalating primary CTA** (Save→Vibe→Locked In) →
   ◻️ **proximity Touch-Down nudge** ("You're near Taboo — Touch Down?") → ◻️
   optimistic/offline-queued check-in → ✅ recap (show-rate) → ◻️ morning-after
   recap push → ◻️ waitlist "spot opened".
3. **Social** — ◻️ "Rally the Crew" one-tap invite + group Touch Down → ◻️
   Crossed Paths auto-suggests Crew at 3+ → 48h match rooms → ✅ "your crew is
   out" digest → ✅ **Pings quiet-hours + priority** (no 4am vanity pings).
4. **Competition** — ◻️ lineups pre-kickoff → ✅ score → **standings auto-recompute**
   → ◻️ goal/result pings → ◻️ **claim-your-card** → ◻️ bracket view. (RPCs ⛳)
5. **Business** — ✅ targeting applied at delivery → ◻️ verified-foot-traffic
   analytics hook → ◻️ phase-triggered offers → ◻️ verified-only reviews.
6. **Identity** — ✅ Passport/Wrapped/Streak/Scene-level-up · ✅ shareable Wrapped →
   ◻️ holographic card → ✅ "next unlock" progress.
7. **Safety** — ✅ **Safety Center** (legible protections + Disappear now) · ✅
   mutual DMs / block / Ghost / Incognito (enforced) · ✅ SOS · ✅ panic →
   ◻️ "share my trip with Crew" → ◻️ women-only event option for hosts.
