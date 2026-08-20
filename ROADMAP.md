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
- **118** Reconcile DB drift — ✅ **DONE 2026-08-18.** Ran
  [audit_db_state.sql](supabase/queries/audit_db_state.sql) live. Findings: 31
  RLS-enabled/no-policy tables — all confirmed **dead schema** (zero client
  references) or deliberately-locked infra (`founder_alerts`,
  `maintenance_runs`) via a real `src/` grep, not assumption. Zero missing
  tables. The 3 "missing columns" on `campaign_analytics` were the audit
  script itself being stale — the live design is an event-log
  (`event_type` per row), already matched by both the writer
  (`EventContextualAds.js`) and reader (`CampaignManager.getPerformance`).
  Fixed the audit script, not the (correct) live schema. Re-ran: **zero real
  drift.**
- **119** Adopt CLI migrations + CI — ✅ **DONE 2026-08-20, actually verified green.**
  [db-schema-ci.yml](.github/workflows/db-schema-ci.yml) had been frozen at
  `schema_drift_fixes.sql` since 2026-07-13 — 49 files applied to production
  since were never validated. Batch 1: `RUN_IN_SUPABASE.sql` +
  `APPLY_LIVE_FIXES.sql` + this session's 4 new files. Batch 2 (2026-08-18):
  `map_zones.sql`, `resident_schema_v2.sql`, `res_map_bridge.sql`,
  `resident_trust_bridge.sql`, `resident_marketplace_gate.sql`,
  `resident_traffic_reports.sql`, `messages_send_hardening.sql`,
  `messages_reactions_hardening.sql`, `messages_video_type.sql`,
  `messages_block_gate.sql`, `event_chat_hardening.sql`, `event_drafts.sql`,
  `event_draft_tasks.sql`, `security_layers.sql` — 14 files, dependency order
  read from each file's own header, not guessed.

  **Real bug caught in the process**: `map_zones.ext_source`/`ext_id` (plus a
  partial unique index on them) existed live but in **zero tracked SQL
  files** — added by hand at some point, never saved back. A fresh rebuild
  from these files alone would have silently been missing them. Fixed in
  `map_zones.sql` directly, verified column-for-column against
  `information_schema.columns` first. This is exactly the failure mode Phase
  0 exists to catch, and it's very unlikely to be the only instance — the
  other 13 files in this batch were spot-checked (headers, idempotency,
  one full table diff on `event_drafts`), not exhaustively diffed
  column-by-column the way `map_zones` now has been.

  **Batch 3 (2026-08-18)**: 24 more files — `schema_drift_columns.sql`,
  `fix_series_fk.sql`, `tour_series.sql`, `fix_crew_invite_rls_recursion.sql`,
  `lock_profile_coordinates.sql`, `lock_authenticated_pii.sql`,
  `regrant_profile_columns.sql`, `profiles_grants_reconciled.sql` (new —
  see below), `home_area.sql`, `checkin_verification.sql`,
  `verification_engine.sql`, `vibe_equity_column.sql`,
  `username_skeleton.sql`, `sso_handoff.sql`, `web_push.sql`,
  `private_chat_media.sql`, `boosted_slot.sql`, `data_retention.sql`,
  `maintenance_levels.sql`, `maintenance_status.sql`,
  `pin_res_distance_m_search_path.sql`, `definer_views_audit.sql`,
  `advisor_hardening_2026-08-13.sql`, `account_deletion.sql`.

  **Critical real bug caught in this batch**: `lock_profile_coordinates.sql`,
  `lock_authenticated_pii.sql`, and `regrant_profile_columns.sql` each
  independently REVOKE+re-GRANT `profiles` SELECT with a different safe-list
  — the lists don't compose, and whichever ran last on production wins. Live
  check found `email`/`push_token`/`phone`/`emergency_contacts`/`siblings`
  readable by **any signed-in user on any other user's profile row** —
  coordinates were correctly locked, PII wasn't. Fixed live (checked
  preconditions first: `get_my_profile()` existed, client already RPC-first
  with a self-only fallback in both `AuthContext.js` and `ProfilePage.js`).
  Added `profiles_grants_reconciled.sql` as the one authoritative version
  going forward; the 3 originals now carry loud warnings against being
  replayed for their grant logic alone. Full writeup: RISK_REGISTER.md C11.

  **All 54 tracked `.sql` files are now either in CI or deliberately
  excluded.** `schema_v6_proposed.sql` / `schema_v6_idempotent.sql` are
  excluded on purpose — the proposal file says outright "NOT applied to the
  live database, do NOT run this as-is"; including them would build a schema
  that doesn't match production, the opposite of this job's purpose.
  `supabase db pull` baseline still needs `supabase login` — interactive,
  can't be done from this environment.

  **2026-08-20 — CI actually turned green, not just wired.** The batch-2/3
  claims above were premature: all 4 initial pushes failed at the very first
  file (`RUN_IN_SUPABASE.sql`), meaning every file after it had genuinely
  never been tested despite being "added to CI." Root-caused via
  `gh run view --log`, not assumption. Two distinct bug classes surfaced,
  both fixed file-by-file until the full 49-file apply + idempotency
  re-apply passed clean from an empty Postgres:
  - **Function/column/table drift** (18 fixes): things hand-added to
    production over time that were never saved back to a tracked SQL file —
    `follow_user`/`unfollow_user` and `generate_ticket_token` return-type
    conflicts (2 functions), `enforce_report_rate_limit` +
    `notify_business_invoice_paid` + `touch_business_invoice_requests` +
    `is_crew_member` (4 functions), 19 `profiles` columns
    (`avatar`/`verified`/`verification_badge`/`level`/`resident_trust_tier`/
    `lat`/`lon`/`phone`/`name`/`banner`/`career_title`/`career_description`/
    `looks_description`/`points`/`privacy`/`reputation`/`streak`/`tags`/
    `wants_email`), 6 `messages` columns, and 6 whole tables/views
    (`crews`, `crew_members`, `crew_invites`, `check_ins` +
    `checkins`/`followers`/`mutual_follows` views, `event_series`,
    `event_series_followers`). Found `event_series_followers.series_id`'s
    FK points at the wrong table live (RISK_REGISTER.md C12, not fixed —
    out of scope, needs a usage check first).
  - **Idempotency bugs** (2 fixes): `CREATE POLICY` without a matching
    `DROP POLICY IF EXISTS` for its own name — passes on a fresh DB, fails
    on the second run. Wrote a script to statically simulate this + the
    return-type check across the full build order; swept clean after.
  - Final green run:
    [32430200437](https://github.com/TEARN1/The_Gruvs/actions/runs/32430200437).
- **120** Backups/PITR on; Supabase **preview branch** for testing migrations
  before prod. ⚪ **Still open — Supabase Dashboard only, needs you.**

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