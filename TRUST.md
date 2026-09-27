# TRUST.md — The Gruvs trust architecture (F4, canonical)

The app has **three trust systems**. They used to clobber each other (three
`vibe_score` writers, three leveling formulas, a verified tick with no engine).
As of Phase 0 (F1–F4) each system has ONE job, ONE writer, and defined readers.
**Any new code that touches trust must fit this table — never add a fourth
system or a second writer.**

| System | Meaning | Column | SOLE writer | Read by |
|---|---|---|---|---|
| **Contribution** | What you've *done* (posts, Touch Downs, follows, bookings) | `profiles.vibe_score` | `ScoreEngine.computeVibeScore` — deterministic recompute from real activity counts | `getVibeLevel` status tiers (Viber→Legend), unlock ladder, profile display |
| **Behaviour** | How you *act* (reliability, real-world social proof) | `profiles.social_integrity_score` (SIS, 0–100, base 50) | `TrustLedger` (client fallback) + server RPCs (`update_sis_score`, `adjust_sis`, `res_sync_trust`) | `eventScore` trustMultiplier (0.8–1.4×), provider tiers, `SocialIntegrityBadge` |
| **Identity** | Who you *are* (reviewed, real) | `profiles.is_verified` (+ `resident_trust_tier` provenance) | **server-only**: `res_sync_trust()` (The Resident trust bridge) / admin. Zero client writes — pinned by the `protect_profile_trust_columns` trigger | verified badge sites, `verifiedBoost` (+6) in `eventScore`, marketplace sell gate (`res_can_sell` RLS) |

Adjacent (not trust, but often confused with it):

| Ledger | Column | SOLE writer | Notes |
|---|---|---|---|
| XP (gamification) | `profiles.xp` | `LevelManager.addXP` | numeric LVL via the ONE curve `getXpLevel` (`floor(sqrt(xp/50))+1`, cap 100) |
| Vibe Equity (spendable asset) | `profiles.vibe_equity` | `VibeEquityLedger` mint/burn | moved OUT of vibe_score (F2); burn can never eat earned score |
| Vibe Coins (gift/ad currency) | `profiles.vibe_coins` | gift/ad RPCs (server-side) | never mixed with equity |

## Invariants
1. **One writer per column.** A grep for `update({ vibe_score`, `update({ social_integrity_score`, `update({ is_verified`, `update({ xp`, `update({ vibe_equity` must only hit the owners above.
2. **is_verified moves upward from the client's perspective, never sideways.** Only server paths grant it; `res_sync_trust` never *revokes* a verification granted elsewhere.
3. **SIS is floored, never lowered, by trust bridges** (`GREATEST(...)` in `res_sync_trust`); only behaviour (TrustLedger / reports) lowers it.
4. **Trust never buys reach directly.** SIS enters ranking only as the bounded 0.8–1.4 multiplier; gifts/coins/equity must NEVER feed `eventScore` (Truth Protocol).
5. **Ranking reads, never writes.** `eventScore`/`heatScore` are pure.

## Where each is surfaced
- `vibe_score` → tier name/color everywhere people are listed (`getVibeLevel`).
- SIS → `SocialIntegrityBadge` (ProfilePage), host trust multiplier in the feed.
- `is_verified` → tick on organizer/suggested/reels cards; `resident_trust_tier`
  → "Via The Resident" green pill (`ResidentTrustBadge`).
