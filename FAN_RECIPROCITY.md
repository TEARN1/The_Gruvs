# Fan Reciprocity & Accountability Engine — the real build plan

**The thesis:** fans hold the data and attention that keeps artists/brands rich.
The Gruvs makes that loyalty *visible, verified and portable* — so recognition
flows back to the people who actually show up. A brand ignoring the platform is
ignoring a public leaderboard of its own most loyal supporters.

**Stack reality:** this is an Expo/React-Native + Supabase app run by a solo dev
(no NestJS/Prisma, no paid infra, no money-handling). Every pillar below is
mapped onto that stack — pure tested utils + existing tables now, small SQL
additions next, heavier pieces last.

---

## Pillar 1 — Fan Fidelity Ledger  ✅ SHIPPED (core math)
`src/utils/fanFidelity.js` (11 tests):

```
F = Σ  W(type) · e^(−λ·ageDays)        λ = ln2 / 180 days
```

- **Weights:** Touch Down 10 · RSVP 4 · share 3 · comment 2 · reaction 1.5 · like 1.
  Physical presence is the gold signal — 100 likes never beat one real attendance.
- **Time decay (half-life 180d):** two years of quiet support keeps real value;
  a fresh burst must persist to matter. No flash-manufactured loyalty.
- **Burst guard:** >30 same-type actions in an hour → the excess scores ZERO
  (bot/spam stripped, not dampened).
- **Data sources already live:** `live_checkins`, `event_rsvps`, `echoes`,
  `event_reactions`, `media_likes`, `follows` — per (fan → host) pairs.
- **Already surfaced:** SuperfansPanel (host dashboard) + PosterInsightsPanel
  (per-event) rank real fans today; wiring `fidelityScore` in as the ranking
  key is a drop-in upgrade.
- **Fan-side benefit:** each fan gets a *loyalty tier* per host (Day One 🏆 /
  Real One 💎 / Supporter ⭐ / New Energy ✨) — a badge earned by showing up,
  on-thesis with the vibe_score ladder.

## Pillar 2 — Reciprocity Score (the community stick)  ✅ core math · ◻️ data
`reciprocityScore()` — give-back vs extraction, 0–100, from real actions only:
- **Give:** free events hosted (×3), rewards issued to fans (×5), host engaging
  back on fans' content (×0.25, capped).
- **Take:** paid events (×2), promo posts (×0.5). Zero history = neutral 50 —
  unknown, never condemned.
- **Brackets:** 🤝 Community Partner (75+) · 🌱 Gives Back (50+) ·
  ⚖️ Mostly Takes (25+) · 🍽️ Eats Alone (<25).
- **Needs (SQL, one table):** `host_rewards` (host_id, fan_id, event_id, kind,
  created_at) — records comps/VIP/shoutouts so give-back is verifiable, and it
  feeds Pillar 4 directly.
- **Where it shows:** host profile header + event cards ("hosted by a 🤝
  Community Partner") — social proof that rewards generous hosts with reach.

## Pillar 3 — Fan-led campaigns ("claim your profile")  ◻️ NEXT
- Unclaimed brand/artist pages already half-exist (any profile can be viewed).
  Add `claimed boolean` + a "🔔 X fans want @brand here" counter (one table:
  `profile_demands(profile_ref, fan_id)`).
- The **share weapon** (no crypto needed at v1): a share-card image/text —
  "The top 50 @brand fans in Joburg are on The Gruvs. Reciprocity: 🍽️ Eats
  Alone (12%). Claim your profile." Fans post it *themselves* — the platform
  just makes the receipt. Signed JSON exports (Supabase edge function + HMAC)
  come later if verification demand appears.
- **Anti-abuse:** demands only count from accounts with fidelity > threshold
  toward that brand — you can't brigade a leaderboard you were never part of.

## Pillar 4 — Merit-based VIP matching  ◻️ LATER (needs Pillar 2's table)
- Host lists an event → toggles "reward my top fans" → engine takes the top
  N% by `fidelityScore`, writes `host_rewards` rows, notifies winners, and the
  existing check-in flow verifies redemption at the door (a Touch Down IS the
  redemption proof — no ticketing/money needed, we broker recognition).
- "Local kids out of the crowd and into the suites, purely on verified merit."

## Guardrails (non-negotiable, from the product's own safety stance)
- Ghost/anonymous check-ins NEVER appear on leaderboards (already enforced in
  superfans/posterInsights).
- Fidelity ranks and rewards — it never hard-gates entry (visibility = safety).
- No fabricated metrics: signals we don't record (external reposts etc.) are
  omitted, not faked. Truth Protocol.
- Gifts/money must never buy fidelity — it's earned by presence only
  (consistent with the gift-economy verdict).

## Build order
1. ✅ fanFidelity core (this commit)
2. Wire fidelityScore as the ranking key in SuperfansPanel + PosterInsights,
   show fan loyalty tiers
3. SQL: `host_rewards` + `profile_demands` tables → reciprocity data + demand counter
4. Reciprocity badge on host profiles/cards
5. Share-card generator for fan-led campaigns
6. VIP matching flow on event creation
