# Messaging Feature Set (120) — Security Review

Reviewed 2026-07-19 against the live hardening baseline (`messages_send_hardening.sql`,
`event_chat_hardening.sql`, `messages_block_gate.sql`, the 2026-07 default-deny layers).
Verdict per feature group, with the rule that must hold before that group ships.
Features are numbered as in the planning conversation (1–40 core, 41–80 group/co-create, 81–120 business).

## The four attack classes that cover almost everything

Every one of the 120 features falls under at least one of these. Get these four
invariants right in the schema and most features inherit safety for free.

### A. Impersonation / provenance forgery
Applies to: 7, 12, 15, 30, 47–48, 62, 73–74, 82–84, 90, 101, 103, 110.
- **Invariant:** actor identity ALWAYS comes from `auth.uid()`, never a parameter
  (already the rule in `send_message_v2`). Anything rendered as "said by X" or
  "agreed by X" must be a row X's session inserted, and provenance columns must be
  immutable (guard-trigger pattern already in place on both message tables).
- Hot spots:
  - **30 (anonymous event-chat mode):** display-anonymity only — `user_id` stays real
    in the row, RLS must hide it from SELECT for non-moderators via a view, NOT by
    nulling the column. Rate-limit harder than named posts. Reports must still resolve
    the author server-side.
  - **101 (shared business inbox):** staff act as the business — every message row must
    carry BOTH `business_id` and the real `staff_user_id`; only `business_id` is exposed
    to the counterparty. Never let staff-attribution be client-supplied.
  - **110 (verified badge):** badge must join live from the businesses table at read
    time, never be a copied boolean on the message row (goes stale / spoofable).

### B. State-machine cheating (the vibe-farming class)
Applies to: 44, 47, 53, 67, 82–84, 89–90, 72, 74, 115.
This is the exact class of the self-accept hole just closed in DMs: any row whose
state transition mints trust, score, or capability.
- **Invariant:** every accept/confirm/launch transition is enforced by a BEFORE UPDATE
  trigger that checks (a) WHO may flip it, (b) direction is one-way, (c) both-party
  actions require both parties' sessions (two rows or two timestamped columns each
  guarded to its owner — never one row a single caller flips).
- Hot spots:
  - **47 (launch ceremony, N confirmations):** each confirmation is its own row inserted
    by that member's session; the launch RPC counts rows, the client never submits
    "confirmed_count".
  - **89–90 (fulfillment confirms → track record):** a business must not be able to
    confirm its own milestones to farm its completed-deal count. Organizer-side
    confirmation is the one that scores.
  - **72/74 (crew streaks / crew vouching):** derive from verified attendance +
    launched-event records server-side; never a writable counter. Vouching transfers
    trust — cap how much a crew's record boosts an event, and make it decay.

### C. Broadcast / fan-out abuse (spam & phishing amplification)
Applies to: 7, 62, 75, 85, 96, 100, 113, plus any "system message" feature (8, 63, 68).
- **Invariant:** anything that sends to >1 recipient goes through a SECURITY DEFINER
  RPC that (a) verifies the sender's role for THAT audience, (b) rate-limits per
  sender AND per audience, (c) renders as a distinct "broadcast" message type the UI
  styles differently from peer messages (the notifications-phishing lesson from the
  2026-07-06 audit: system-looking messages users can author are a phishing kit).
- Hot spots:
  - **75 (invite waves):** cap per wave and per day; recipients must be within the
    senders' own friend graphs — never arbitrary IDs. Dedup server-side.
  - **96/100 (business broadcast / follow-up):** audience computed server-side from
    confirmed reservations/serves only; 100 is hard-capped at ONE message by a unique
    index, not client politeness.
  - **113 (gig-lead alerts):** RFQ visibility is the product being sold — meter it
    server-side (quota table), or the free tier is a scraping API.

### D. Privacy / location / membership leakage
Applies to: 2, 5, 9, 16, 28, 52, 61, 76, 79, 87, 103, 107, 115, 119.
- **Invariant:** the location-privacy lockdown rule holds everywhere — no precise
  coordinates readable cross-user; venue-relative pins (5) are text labels, never
  lat/lng. Presence ("touched down", "is here", availability) is opt-in and scoped
  to the thread/crew that needs it.
- Hot spots:
  - **16 (panic-share):** the ONE place live location crosses users. Server-side RPC
    to explicitly chosen contacts, time-boxed, revocable, audit-logged. Build it as
    its own reviewed surface, not on generic messages.
  - **28 (auto status from Touch Down):** off by default; broadcasting "I am at X
    right now" is a stalking primitive if defaulted on.
  - **52 (availability matcher):** answers visible only inside that thread; do not
    persist a queryable "when is this user out" table.
  - **103 (internal notes):** RLS row-level split — notes live in a separate table
    keyed to the thread, readable by inbox members only. Never same-table with a
    flag column (one policy bug leaks them to the customer). Also a POPIA/GDPR
    subject-access consideration: notes about a person are personal data — keep them
    factual, exportable, deletable.
  - **79 (ghost protocol):** quiet exit must ALSO revoke read access, not just hide
    the announcement.

## Features that are fine as described (standard RLS + existing patterns)
1, 3, 4, 6, 8, 10, 21, 23–27, 29, 31–39, 41–43, 45–46, 49–51, 55–57, 60, 63, 65–66,
68–71, 77, 86–88, 91–95, 97–99, 102, 104–108, 112, 114, 117–118, 120.
Rules that still apply to all of them: length caps + idempotency keys on every new
writable table (the `messages_send_hardening` pattern), storage paths under
`{user_id}/` with owner-only RLS for any new media (21, 27, 37, 71), and link/embed
cards (25, 35, 112) rendered from allowlisted URL patterns only — no arbitrary
iframe/embed of user URLs.

## Features needing a design change before build
- **13 (trust-gated media blur)** — client-side blur is cosmetic; the real control is
  that request-tray media URLs aren't fetchable until accept (signed URLs minted only
  post-accept). Chat media privacy already has history (`private_chat_media.sql`) —
  extend that, don't parallel it.
- **15 (report evidence bundle)** — snapshot the messages server-side at report time
  into a mod-only table; do NOT give reporters an export of the thread (that's a
  leak tool aimed at the other party).
- **18/19 (disappearing + watermark)** — be honest in-product: server deletes on
  schedule (retention job exists — extend `data_retention.sql`), but screenshots
  can't be prevented. The watermark is deterrence, not protection; never market it
  as protection.
- **17 (age lanes)** — already your one hard legal gate. Enforce at chat-membership
  RLS from `events.age_restriction` + profile birthday, server-side only. This must
  be a DB constraint, not a UI filter.
- **34 (read receipts)** — reciprocity must be computed server-side or a modified
  client reads receipts while hiding its own.
- **54/59 (rides / budget splitter)** — pure coordination is fine, but these are
  grooming surfaces for off-platform money scams. Keep ZERO payment references in
  structured fields (no bank-detail field, ever) and put a scam-warning banner on
  first use. 59 stores claims of debt — display-only, no enforcement semantics.
- **64 (incident flag pierces mute)** — role-holders only, per-event, rate-limited,
  or it's a harassment bullhorn.
- **78 (condition-triggered baton messages)** — triggers evaluated server-side (cron/
  pg_cron) with the condition re-checked at fire time; sender identity frozen at
  schedule time; cancel-on-block.
- **116 (dispute threads)** — you are record-keeper, not judge: append-only thread,
  no "resolved against X" state the platform asserts. Anything more is a legal
  liability trap for a solo dev.
- **82–84 (offer cards with stated prices)** — prices are reference text inside a
  card, never a field the platform computes on, sums, or escrows. The moment the
  platform "holds" or "totals" money-like state, the no-money-handling line is
  crossed (see project_money_services_verdict).

## Defer / build last (risk outweighs current value)
- **14 (vibe-gated DM initiation):** good anti-spam, but gate on Touch Down only —
  never on purchasable anything, or DM access becomes pay-to-contact.
- **20 keyword mute:** fine; but **auto-moderation beyond mute** would need AI — out
  per constraints.
- **30 (anonymous mode):** highest abuse-per-line-of-code in the whole list. Ship
  named crowd Q&A (3) first; add anonymity only with the view-based design above
  plus per-event kill switch for organizers is NOT enough — kill switch must be
  yours (platform-level), since organizers benefit from silencing honest reports.
- **111 (sponsored presence):** safe only because it requires a completed deal memo —
  ship after 82–84 are proven.

## Build-order consequence
The safe foundation order is: **event_drafts spine (41–48)** → task/decision objects
(51–57) → live control (61–63, 67) → deal cards (82–84, 90) → shared inbox (101–103).
Each later layer reuses the guard-trigger + one-RPC-write-path pattern the first
layer establishes. Everything in this file assumes new tables ship with: RLS default-
deny, `SECURITY DEFINER` functions pinned to `search_path = public`, EXECUTE revoked
from `public, anon` and granted to `authenticated` only, length caps, and client_key
idempotency on user-writable inserts.
