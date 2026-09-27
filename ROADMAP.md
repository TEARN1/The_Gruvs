# The Gruvs — Platform Roadmap: Event Depth Parity

> Goal: every event type (music, conference, market, hackathon, comedy, film, arts,
> networking, sport…) reaches **soccer-level depth** — without cloning the soccer
> schema 10×. We build ONE generic engine; each event type is a thin **adapter**.
>
> ⚠️ **Gate:** nothing in Phases 1–4 ships until the foundation is in place —
> reconcile DB drift → baseline migration → CI. See [supabase/MIGRATIONS_SETUP.md](supabase/MIGRATIONS_SETUP.md).
> Build only as tested, idempotent migrations. No more full-file replays.

---

## 1. The core insight — one engine, many adapters

Soccer feels "deep" because it has five primitives. Every event type has the same
five underneath — only the vocabulary differs. So we generalise once:

| Soccer concept            | Generic engine primitive | Music        | Conference     | Hackathon      | Market        |
|---------------------------|--------------------------|--------------|----------------|----------------|---------------|
| teams / athletes          | **participants**         | artists      | speakers       | hack-teams     | vendors       |
| matches / fixtures        | **program_slots**        | sets         | sessions       | demo slots     | stall windows |
| match events (goal/card)  | **live_timeline**        | now-playing  | session-live   | submission     | spotlight     |
| league table / standings  | **ranking_engine**       | crowd vote   | attendance     | judge scores   | sales/likes   |
| top performers / awards   | **honours**              | best act     | best talk      | winning team   | top stall     |

Build the engine; adapters are config + UI. Soccer becomes **adapter #1**, refactored
onto the engine so it stops being a special case.

### Generic engine tables (DESIGN — not yet live SQL)

```
participants          -- any competitor/contributor in an event
  id, event_id, kind ('team'|'athlete'|'artist'|'speaker'|'vendor'|'hackteam'|…)
  person_id (→ canonical identity), club_id?, display_name, photo_url, meta JSONB

program_slots         -- any scheduled unit (match/set/session/round/window)
  id, event_id, stage_id?, round, slot_number, title,
  starts_at, ends_at, venue/room, status, home_ref?, away_ref?, meta JSONB

slot_lineups          -- who's "on" for a slot (starting XI / panel / performers)
  slot_id, participant_id, role, position, is_starter, number, meta JSONB

live_timeline          -- the universal live event stream
  id, slot_id, event_id, ts, minute?, type ('goal'|'card'|'now_playing'|'session_live'|'submission'|'award'|…),
  actor_participant_id?, body, score_home?, score_away?, detail JSONB

ranking_entries        -- universal standings / leaderboard
  id, event_id, group_id?, participant_id, metric, value,
  rank, breakdown JSONB (pts/gd/votes/scores/sales), updated_at

honours                -- universal awards (already ~event_awards)
  id, event_id, category, participant_id, label, value, meta JSONB

canonical_identity     -- the ONE person record (fixes the 4-way fragmentation)
  id, profile_id?, full_name, known_as, photo_url, dob?, nationality, meta JSONB
  + identity_links (sport_athletes/players/team-roster rows all FK to this)
```

Soccer's `sport_*` tables become **adapter views/wrappers** over these (or are
migrated into them) so existing screens keep working while depth becomes universal.

---

## 2. Phased execution — all 120 points mapped

### Phase 0 — Foundation (GATE, do first)
- **118** Reconcile DB drift — run [supabase/queries/audit_db_state.sql](supabase/queries/audit_db_state.sql), apply the single reconciliation migration.
- **119** Adopt CLI migrations + CI per [supabase/MIGRATIONS_SETUP.md](supabase/MIGRATIONS_SETUP.md); add a CI job that applies migrations to an **ephemeral Postgres** so bad migrations fail the PR, never prod.
- **120** Backups/PITR on; Supabase **preview branch** for testing migrations before prod.

### Phase 1 — The generic engine
> Note (verified in code 2026-06-09): the soccer feature is deeper than first
> assumed. Already built **app-layer** in `src/services/sportsEngine.js` /
> `src/components/sports/LiveMatchLogger.js`: round-robin + knockout **fixture
> generation** (`generateRoundRobin`/`generateKnockout`), **auto-advance** on
> knockout, and **lineups + formations** (4-3-3/4-4-2/3-5-2, stored in
> `match_data.lineups`). Phase 1 is therefore **lift these into the generic
> engine**, not build from scratch.
- **28 / canonical_identity** Unify participant identity (the structural fix — still ✗).
- **16–18** Fixture/bracket generation + auto-advance — ✅ exists for soccer; generalise over `program_slots` so every type gets it.
- **56** Lineups & formations — ✅ exists for soccer; generalise to `slot_lineups`.
- **74–84** Ranking engine generalised (full tiebreakers incl. H2H/away-goals, group qualification, H2H records, streaks, clean sheets — engine has only pts/GD/GF today).
- **54–65** Live timeline generalised (events, commentary, subs, AET/pens sequence, MOTM voting).
- Soccer refactored onto the engine as adapter #1.

### Phase 2 — Event-type adapters (parity unlocks here)
Each is a thin config + UI on the engine; depth is inherited:
- Music (sets, stages, setlists, now-playing) · Conference (sessions, speakers, tracks)
- Hackathon (teams, submissions, judging) · Market (vendors, stalls, menus, spotlights)
- Comedy / Film / Arts / Networking — same engine, different vocabulary.
- **1–15** competition formats become engine-level (league/KO/groups/swiss/2-leg/promotion-relegation/playoffs) and apply to *any* type.
- **26–38** participants, squads, kits, transfers/loans, staff — generic.
- **39–50** participant careers, ratings, comparison, timeline, injuries.

### Phase 3 — Engagement layer (cross-type, free / no-money)
- **102–108** Predictor leaderboard (accuracy/streaks), scoreline predictions, **Fantasy XI (XP)**, brackets/sweepstakes (XP), collectible cards, sport badges.
- **95–101** Follow, **goal/result push notifications (wire the existing flags)**, supporters/ultras, derby tags, match chat, fan ratings, **MOTM voting**.
- Works for every event type because it rides the generic prediction/ranking tables.

### Phase 4 — Integrity, discipline & polish
- **66–73** Discipline automation (card accumulation → auto-suspension, bans, availability), officials/referee assignment, appeals, fair-play.
- **109–113** Governance (have) + **result dispute/confirm flow**, score-edit audit log, recall.
- **85–94** Honours (team of tournament, golden boot/glove, trophy cabinet, player honours), media galleries, highlights, live blog.
- **19–25** scheduling polish (reschedule, venues as entities, ICS export, clash detection, byes).

---

## 3. Why this order is non-negotiable
1. **Foundation before features** — building on the current drifted DB re-creates this
   week's whack-a-mole, and it's irreversible without migrations + backups.
2. **Engine before adapters** — 10 cloned schemas = 10× the drift for one solo dev.
   One engine = parity for free and a maintainable surface.
3. **Identity before depth** — careers/ratings/records are meaningless until a person
   is one record, not four.

## 4. Immediate next action
Run [supabase/queries/audit_db_state.sql](supabase/queries/audit_db_state.sql) (read-only) and paste the output → I produce the Phase-0 reconciliation migration. That opens the gate; then Phase 1 begins as tested migrations.