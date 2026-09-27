# The Gruvs — App Flow (Events → Talent → Tournaments)

How the pieces connect, end to end. Each arrow is a real screen/action in the app.

> **Status legend:** ✅ walkable in code today · ⏳ needs the migrations applied to the live DB.
>
> **Live end-to-end:** the social loop (§1), the talent loop (§2), tournament
> governance (§3) and fan predictions (§4) are all wired end-to-end in code.
>
> **The 4 connectors that closed §3 (commit `a96245c`):**
> 1. ✅ **Create a competition / season** — `CompetitionPicker` in the event form.
> 2. ✅ **Create a club** — `ClubCreateModal`, surfaced in the governance panel's
>    no-teams state (a team needs a `clubs` row to vote).
> 3. ✅ **Event creation sets `competition_id`** — the `CompetitionPicker` link makes
>    the governance entry + competition-scoped predictions appear on the event.
> 4. ✅ **Match logging attaches `athlete_id`** — `sportsEngine.log` resolves a tagged
>    player by name so the careers rollup trigger is fed (goals reach a career).
>
> ⏳ **Remaining dependency:** these reference `events.competition_id`, `competitions`,
> `clubs`, and `sport_athletes.player_id` — run `27` → `28` → `30` (below) on the live
> DB or the engine calls fail gracefully (wrapped in `safe()`) and no-op.

## 1. Core social loop
```
Sign in ─▶ The Drop (feed) ─▶ tap event ─▶ Event Detail
   │            │                              ├─ RSVP / Vibe / React / Echo
   │            ├─ Reels, Explore, Calendar    ├─ Comments, Moments, Gallery
   │            └─ Stories, Chats (DMs)         └─ Share
   └─ Profile (Vibe Card) ─▶ follow people, edit profile, app-lock
```

## 2. Talent platform (every event type)
```
Host posts an event (any category: sport, music, comedy, hackathon, …)
        │
        ▼
Event Detail ─▶ "Guests & Lineup" ─▶ (host) Manage ─▶ EventGuestsModal
        │                                    │
        │                                    ├─ search or CREATE a player/talent identity
        │                                    ├─ set role (player/performer/judge/…) + side
        │                                    └─ edit per-event performance (rating, placement, award)
        ▼                                              │  (rolls up via DB triggers)
Each guest is a persistent TALENT ─────────────────────┘
        │
        ▼
Player Card (PlayerProfileModal) — FIFA-style, category-aware stats:
        ├─ career: clubs by season, season-by-season stats, ratings
        ├─ Follow · Rate (0–10) · Share · "This is me" (claim) · Edit
        └─ reached from: a guest tap · a profile's "View Player Card" · the leaderboard
        │
        ▼
Scout Leaderboard (Explore ▸ Scout) — search_top_players():
        └─ rank by goals/rating/events/awards/fans · filter by category, age, region, position
           "find the top U-20 striker in Gauteng" / "top comedian" / "top artist"
```

## 3. Tournaments & governance (the data is earned, not given)
```
Competition / Season (competitions, seasons)  ◀── events.competition_id links a match to it
        │
        ▼
Event Detail ▸ "Tournament Governance" ─▶ TournamentGovernancePanel
        │
        ├─ Positions that control data: Results Editor · Log Keeper · Fixtures ·
        │   Disciplinary · Head Organiser
        ├─ Teams VOTE (one vote per team, with a club they own):
        │     stand for a seat, or back another candidate
        └─ ≥ N distinct teams (default 5) back a candidate ─▶ they are ELECTED
                 │
                 ▼
        is_tournament_official(competition, 'results_editor') gates who may edit
        results / standings (apply the RLS policy in 30_tournament_governance.sql).
        A new candidate who passes the threshold REPLACES the holder (recallable).
```

## 4. Fan predictions (the fun)
```
Event Detail ▸ "Who will win?" ─▶ MatchPredictionCard
        ├─ any fan picks a team (one pick per event, changeable)
        └─ live % split across the teams (+ Draw) — one tap, instant tally
```

## How a tournament actually runs (worked example — a soccer league)
1. Organiser creates a **competition** + **season**, and posts each matchday **event** with `competition_id` set.
2. Clubs register; each match event gets its two **teams** tagged + **players** as guests.
3. Teams open **Governance** and elect a **Results Editor** and **Log Keeper** (≥5 teams each).
4. Fans open the match and **predict** the winner.
5. The elected **Results Editor** logs goals/cards → they **roll up to each player's career** (triggers) → the **Log Keeper** maintains standings.
6. Player careers fill the **Scout Leaderboard**; managers discover talent and **follow** players.

## Data foundation (run in order in Supabase)
`27_talent_platform.sql` → `28_talent_universal.sql` → `30_tournament_governance.sql`
(plus `29_launch_security_rls.sql` before launch).

## Services / components
- `talentEngine.js` — players, careers, guests, ratings, scout search.
- `tournamentEngine.js` — role voting (governance) + match predictions.
- `TalentConfig.js` — per-category stat labels & roles (universal presentation).
- UI: `PlayerProfileModal`, `PlayerEditModal`, `TalentLeaderboardModal`,
  `EventGuestsModal`, `TournamentGovernancePanel`, `MatchPredictionCard`.
