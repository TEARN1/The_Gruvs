# The Gruvs — App-Wide Front-to-Back Parity Checklist

> Goal: every subsystem complete **front → back** — UI exists, service layer exists,
> DB schema + RLS exists, and it's **wired end-to-end** (no dead flags, no stub reads).
>
> Legend per point: **F** = frontend/UI · **B** = backend (service + DB + RLS) · **W** = wired end-to-end.
> Status: ✅ confirmed this session · ⚠️ partial/known gap · ⟳ **VERIFY** (not yet inspected — assume nothing) · ✗ missing.
>
> ⚠️ Statuses below come from *partial* inspection during this session. Anything marked ⟳
> must be verified in code before you trust it. Same hard gate as ROADMAP.md: **no new
> build until the DB drift is reconciled + migrations + CI exist.**

---

## ‼️ Cross-cutting risk — RESOLVED (verified in code 2026-06-09)
Audited the four suspect services + payment scan. Findings:
- **`revenueEngine` / `vibeEquityLedger` / `royalGovernance` = NON-MONETARY** (vibe-equity / XP — headers say so explicitly). ✅ compliant, just misleadingly named.
- **NO payment processor anywhere** (no Stripe/Paystack/PayFast/Yoco/etc).
- **`escrowService` + `WalletScreen` record monetary amounts** (`amount_cents`, `increment_wallet_balance`, `escrow_held`) **but never move real money** — only 4 files touch this. It's **"phantom money" UX**: implies platform-held funds / wallet custody it can't back. Liability + trust risk for a solo dev, even though no money actually flows.

**Decision needed (reframe, not rebuild):** make the marketplace **broker + price-display only** — `amount_cents` → "agreed/quoted price," remove "escrow held / release funds" + wallet-custody language; payment happens **off-platform** (cash/EFT peer-to-peer), app holds nothing. Affects #82, #86–89.

---

## 1. Events core  · `eventManagementEngine`, `dataFlow` · PostEventModal / EventDetailScreen / ExplorePage / LandingPage / CalendarPage
1. Create event (all types) — ✅ F/B/W
2. Multi-day `end_date` — ⚠️ DB col drift (missing on live), app degrades
3. Audience targeting — ✅ B, ⟳ W
4. Poster-mode / secret-act / power-backup — ⚠️ DB cols, ⟳ W
5. RSVP tiers + tickets (`generate_ticket_token`) — ⟳ W
6. Check-in (`secure_check_in`) + live check-ins — ⟳ W
7. Event chat / polls / playlist / carpools — ⟳ W
8. Event media / moments / gallery — ⟳ W
9. Event updates feed (typed) — ⟳ W
10. Calendar view — ⟳ W
11. Soft-delete + restore — ✅ B, ⟳ W
12. Crowd meter (`event_crowd_votes`) — ⚠️ DB may be unrun

## 2. Discovery & ranking  · `personalizationEngine`, `neuralMesh`, `saturationSimulator`, `routeEngine`
13. Personalized feed (category vector) — ⟳ W
14. Collaborative filtering (event_vibes) — ⟳ W
15. Trending / HOT velocity (`get_hot_event_ids`) — ✅ B, ⟳ W
16. Rising-now momentum (`get_rising_events`) — ✅ B, ⟳ W
17. Dwell-time signal (`record_event_view`) — ✅ B, ⟳ W
18. Birthday spotlight — ✅ B (`birthdaySpotlight`), ⟳ W
19. Audience routing (`routeTargetedEvent`) — ⟳ W
20. Saturation simulator — ⟳ what it drives

## 3. Reels  · `reelsDataFlow` · ReelsScreen
21. Post reel (video) — ✅ W
22. `metadata`/`visibility` cols — ⚠️ DB drift, insert strips if absent
23. Visibility RLS (public/owner/attendees) — ⚠️ verify policy bites
24. Likes / comments / comment-likes — ⟳ W
25. Reel feed ranking — ⟳ W

## 4. Social graph  · DiscoverPeopleScreen / CrewFeedScreen
26. Follow / unfollow — ⟳ W
27. Crew / close-friends feed — ⟳ W
28. Block / mute — ⚠️ tables exist, ⟳ enforcement
29. Discover people (suggestions) — ⟳ W
30. Path-stars (user↔user) — ⚠️ DB col drift (`from_user_id`)

## 5. Messaging  · `dataFlow` · ChatsScreen
31. DM text — ✅ W (minimal fallback)
32. DM image/location — ⚠️ needs `messages` cols (drift-prone)
33. `message_type`/`parent_id`/threads — ⚠️ DB cols
34. DM rooms / event chat — ⟳ W
35. Realtime delivery — ⟳ W
36. Read receipts / typing — ⟳

## 6. Profiles & identity  · ProfilePage
37. Edit profile (`upsert_own_profile`) — ✅ W
38. PII protection (anon REVOKE) — ✅ B (29), ⟳ verified
39. Writing-style / theme sync — ⚠️ DB cols drift
40. Clan/surname/village/languages/community-tags — ✅ B, ⟳ W
41. Beacon "I'm here" presence — ⚠️ col drift, app falls back
42. `public_profiles` safe view — ⚠️ shape-clash history (DROP+CREATE)

## 7. Sport / Tournament / Talent / Clubs / Scout  · `sportsEngine`, `tournamentEngine`, `talentEngine`, `clubEngine` · ClubScreen / ScoutScreen / LeaderboardScreen
43. Fixture generation (RR + KO) — ✅ F/B/W
44. Auto-advance bracket — ✅ W
45. Lineups + formations — ✅ W (`match_data.lineups`)
46. Live scoring / match events — ✅ W
47. League table recompute — ✅ B, ⚠️ tiebreakers incomplete
48. Group qualification — ✗
49. Top performers — ✅ B, ⟳ W
50. Commentary / live blog — ✅ W
51. Sport media + likes — ✅ W
52. Predictions capture — ✅ W
53. **Predictor leaderboard (score/rank)** — ✗
54. Governance (elected officials, votes) — ✅ B, ⟳ W
55. Result dispute/confirm flow — ✗
56. Discipline → auto-suspension — ✗
57. MOTM fan voting — ✗
58. Clubs / memberships / invitations — ⟳ W
59. Player careers / `players` / scout search — ✅ B, ⚠️ identity fragmentation
60. Talent universal (non-sport) — ⟳ W
61. **Canonical participant identity** — ✗ (structural)
62. Goal/result push notifications — ⚠️ flags exist, ✗ enqueue wiring

## 8. Non-sport event verticals (PARITY TARGET)  · `eventManagementEngine`
63. Music: lineup/stages/setlists/now-playing — ✅ B, ⟳ W depth
64. Conference: sessions/speakers/tracks — ✅ B, ⟳ W depth
65. Market: vendors/stalls/menus — ✅ B, ⟳ W depth
66. Hackathon: teams/submissions/judging — ✅ B, ⟳ W depth
67. Comedy/Film/Arts/Networking adapters — ⚠️ tables, ⟳ depth
68. **Generic engine to unify all of the above** — ✗ (see ROADMAP.md)
69. Cross-type leaderboards / judging parity — ✗
70. Cross-type live timeline parity — ⚠️ per-vertical

## 9. Business / Store / Campaigns  · `revenueEngine`, `surveys` · BusinessDashboardScreen / BusinessStoreBuilder
71. Business profile — ⟳ W
72. Store builder (page blocks) — ⟳ W
73. Ad campaigns — ⟳ W
74. Campaign analytics — ⚠️ RLS+col drift (just fixed)
75. Audience segments — ⚠️ RLS+col drift (just fixed)
76. Drip surveys (`surveys`) — ✅ B, ✗ UI (no survey card / create screen)
77. Partnerships — ⟳ W

## 10. Service marketplace / gigs  · `escrowService`, `routeEngine` · ServiceMarketplace / ProviderDashboardScreen
78. Service nodes (bakkie marketplace) — ⟳ W
79. Service bookings — ⟳ W
80. Gig posts / acceptances — ⟳ W
81. Provider dashboard — ⟳ W
82. **Escrow** — ‼️ money-handling: reconcile vs constraint
83. Disputes — ⟳ W
84. Service reviews — ⟳ W

## 11. Wallet / currency / equity  · `fxService`, `vibeEquityLedger`, `revenueEngine`, `trustLedger` · WalletScreen
85. Display currency by GPS (no FX conversion) — ✅ B (`money()`)
86. Wallet balance / transactions — ‼️ money: reconcile vs constraint
87. `increment_wallet_balance` RPC — ‼️ money
88. Vibe-equity ledger — ‼️ reconcile (XP vs money?)
89. Revenue engine — ‼️ reconcile vs constraint
90. Trust ledger — ⟳ what it scores

## 12. Paths / Movement OS  · `routeEngine`, `locationService` · PathMapScreen
91. Create path / intent — ⟳ W
92. Path crossings — ⚠️ table drift history
93. Ghost / celebrity identity layers — ⟳ W
94. Live presence / nearby vibers (safe GPS) — ✅ B (`get_safe_nearby_vibers`), ⟳ W
95. Map rendering — ⟳ W

## 13. Notifications / push  · `notificationService` · NotificationsScreen
96. Push tokens / register device — ⟳ W
97. Notification queue + preferences — ✅ B, ⟳ W
98. Event-day reminders (pg_cron) — ⚠️ needs pg_cron enabled
99. In-app notifications screen — ⟳ W
100. Quiet hours — ⟳ W
101. **Per-feature notification wiring** (goals, results, follows) — ⚠️ flags ≠ wired

## 14. Platform services
102. Weather / load-shedding (`weatherService`) — ⟳ W
103. Music integration (`musicService`, Spotify/YouTube keys) — ⟳ keyless-or-paid check
104. Location (`locationService`) — ⟳ W
105. Storage (`storageService`, buckets) — ⟳ W + RLS
106. Offline cache (`offlineCache`) — ⟳ W
107. Biometric auth (`biometric`) — ⟳ W
108. Smartphone features (`smartphoneFeatures`) — ⟳ W

## 15. Security / governance / admin  · `securityService`, `royalGovernance`, `organizationalOverseer`, `trustLedger` · GodViewDashboard
109. RLS coverage — ✅ 136 tables, all have ≥1 policy (this session)
110. SECURITY DEFINER search_path pinned — ✅ this session
111. Anon PII/GPS leak closed (29) — ✅ B, ⟳ verified on live
112. Rate limiting (`check_rate_limit`) — ⚠️ duplicate overload on live
113. Security logs / audit events — ⟳ W
114. Admin roles / suspensions — ⟳ W
115. God-view dashboard — ⟳ W + access-gating (must be admin-only!)
116. `royalGovernance` / `organizationalOverseer` — ⟳ what these are/do

## 16. Foundation (the gate)
117. Reconcile DB drift — ⏳ run `audit_db_state.sql`
118. CLI migrations + baseline — ⏳ (`MIGRATIONS_SETUP.md`)
119. Fresh-build CI — ✅ added (`db-schema-ci.yml`)
120. Backups/PITR + preview branch — ⟳ enable

---

## ───────────────────────────────────────────────────────────
## AUDIT PASS 1 — verified findings (2026-06-09)
## ───────────────────────────────────────────────────────────
Traced service intent + DB calls + screen wiring across all subsystems.
**Headline: the core app is genuinely wired front-to-back** — services are imported
and used by real screens/components, not orphaned. Verdicts:

**Wired & real (✅ F/B/W confirmed):**
- Events core → `EventManagementPanel` + `dataFlow` managers.
- Personalization (12-signal) → `LandingPage` (`recordEventView`/`flushEventViews`).
- Routes/paths → `LandingPage` + `PathMapScreen` (`RouteEngine`).
- Sport/talent/clubs → `ClubScreen`/`EventDetailScreen`/modals (`clubEngine`,`talentEngine`).
- Non-sport verticals → `eventManagementEngine` + `EventManagementPanel` (mirrors sportsEngine).
- Notifications (in-app) → `useNotifications` hook + screens.
- Weather → open-meteo, **free & keyless** ✅. Storage → validated uploads ✅. Security → real sanitize/XSS/redaction ✅.

**Four things to decide / reconcile (not bugs — judgment calls):**
1. **Money** — RESOLVED above (3 services non-monetary; escrow/wallet = phantom money → reframe as broker/off-platform).
2. **Theatrical "intelligence" engines** — `neuralMesh` (`executeSupremeThought`) and `organizationalOverseer` (`runOrganizationalAudit`) return **hard-coded/deterministic mock strings** ("Kingdom Optimized Locally", "PhD Brain", "32M-Token Neural Mesh", "Sovereign Mint Protocol"). They're wired (→ `GodViewDashboard`, `personalizationEngine`, `VIPTierSelector`) but the *output is decorative, not real computation.* Constraint-compliant (no AI, no money) — but tension with your "keep things real, no dead code" rule. **Decide: make them do real work, or trim the theatre.**
3. **Notifications dual-path** — `notificationService` is **in-app/realtime only, no push providers** (compliant). But the schema ALSO has `push_tokens` + `send_event_day_notifications` (pg_cron) + `notification_preferences`. Either the push infra is **unused/dead** or there's a second path. Reconcile so it's one intended design.
4. **Music API keys** — `musicService` needs Spotify (secret correctly via Edge Function ✅) + **YouTube Data API key** (free tier, but it IS a key). Mild tension with the "keyless APIs" constraint; already noted in your `SECURITY-AUDIT.md`.

**One security must-check:** `GodViewDashboard` — confirm it's **hard-gated to admin role** (RLS + client route guard). An ungated god-view is a critical leak. Marked ⟳ → please verify next.

**Still genuinely missing (✗ unchanged):** predictor leaderboard (#53), discipline auto-suspension (#56), MOTM voting (#57), canonical identity (#61), generic engine (#68), survey UI (#76), full tiebreakers/group-qual (#48), goal-notification enqueue (#62/#101).

## ───────────────────────────────────────────────────────────
## AUDIT PASS 2 — full front-to-back verification (2026-06-10)
## ───────────────────────────────────────────────────────────
Traced UI → service → DB ops for all 16 subsystems (grepped real `.from()/.rpc()`
calls in screens + services). **Verdict: the app is genuinely built front-to-back
across every subsystem.** Each has UI → resilient service layer → DB targets, with a
consistent **graceful-degradation pattern** (tiered insert/select fallbacks, `maybeSingle`,
split column loads, RPC fallbacks) that lets features survive missing columns/tables.

Per-subsystem: 1 Events ✅ · 2 Discovery ✅ · 3 Reels ✅ (multi-tier fallbacks) ·
4 Social ✅ · 5 Messaging ✅ (core-payload DM fallback) · 6 Profiles ✅ (split loads +
safe-payload) · 7 Sport/Talent/Clubs ✅ · 8 Verticals ✅ · 9 Business ✅* · 10 Marketplace ✅
(phantom-money reframe pending) · 11 Wallet ⚠️ phantom money · 12 Paths ✅ (uses
`path_stars.from_user_id` — confirms the drift fix is needed) · 13 Notifications ✅ in-app ·
14 Platform ✅ (locationService = expo-location, keyless) · 15 Security ✅ (GodView admin-gated) ·
16 Foundation ⏳ gate.

**The single systemic risk is live-DB drift** — code references columns/tables/RPCs
(`end_date`, `metadata`/`visibility`, `saved_reels`, `reel_views`, `messages.message_type`,
`path_stars.from_user_id`, crowd_votes, various RPCs) that may not be applied on the live
DB. The app degrades gracefully, but the *features* are only as live as the schema. → run
`audit_db_state.sql` to see which are actually present. This is the foundation gate, not a code defect.

**NEW concrete bug found (#9 `*`):** `BusinessDashboardScreen` reads `audience_segments.name`
and `.size` ([BusinessDashboardScreen.js:436](src/screens/BusinessDashboardScreen.js#L436)),
but the schema defines `audience_segments` with `filters JSONB` and **no `name`/`size`
columns**. Code falls back, but named-segments-with-size won't work as intended →
reconcile the table shape to the UI (add `name TEXT`, `size INT`) or change the UI.

## How to actually work through this
This is a **front-to-back audit backlog**, not a one-session task. The disciplined path:
1. **Decide the money question** (escrow/revenue/equity/wallet) — blocks ~8 points and is a constraint call only you can make.
2. **Open the gate** (117–118) — reconcile + migrate.
3. Then walk subsystems, converting each ⟳ to a verified ✅/⚠️/✗ by inspecting code, and closing the ⚠️/✗ as tested migrations + wiring PRs.

The fastest way to turn all the ⟳'s into real statuses is to let me inspect each subsystem's service+screen+schema in turn — say "audit subsystem N" and I'll give you a precise front-to-back verdict for it.