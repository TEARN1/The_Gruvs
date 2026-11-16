# The Gruvs — Self-Management System Plan

<!-- doc-contract
status:   live
verified: 2026-11-16
expires:  2027-02-16
owner:    scripts/audit-docs.mjs
-->

> **status:** live · **last verified:** 2026-11-16 · **expires:** 2027-02-16
> Past the expiry date this document goes red in Guardian until re-verified. §8.
> Re-verified 2026-11-16: all four embedded checks still pass, and the §1.4 live
> bug is **still unfixed** seven weeks on.

**Goal: the app runs, settles and defends itself, and only wakes the human for
things a human must actually decide.**

---

## 1. The two findings that reframe the whole problem

I went looking for what to automate and found the reason nothing *can* be.

### 1.1 — The core object has no lifecycle

| Measured 2026-09-28 | |
|---|---|
| `event_*` satellite tables | **41** |
| Services in `src/services` | **77** |
| Lifecycle columns in the `events` CREATE block | **0** |
| `ended_at` / `settled_at` anywhere | **0** |

<!-- verify: test "$(grep -rc 'ALTER TABLE public.events ADD COLUMN IF NOT EXISTS ended_at' supabase/queries/*.sql | grep -v ':0' | wc -l)" = "0" -->

> **Correction, found while verifying this section.** An earlier draft said
> "0 lifecycle columns" and backed it with a check that only read the
> `CREATE TABLE` block. A `status TEXT DEFAULT 'published'` column **is** added
> by `schema_v6_idempotent.sql:350` — an alternate schema file, so whether it
> exists on the live DB is unverified (the Supabase MCP is down). The check
> passed while the claim was wrong: **precisely the "sensor silently checking
> the wrong thing" failure described in §8.** The substance survives — there is
> no state machine, no `ended_at`, no `settled_at`, and nothing anywhere
> advances `status` — but the headline was overstated and the check was scoped
> too narrowly. Both are fixed above.

`events` carries `is_cancelled`, `is_published`, `is_featured`, date/time
columns, and a `status` of unverified provenance that nothing ever transitions.
Whether an event is *over* is still computed in JavaScript at read time —
`hostStats.js:58` sets `is_past: true` — re-derived by every client, on every
read, forever.

**So there is no moment when an event ends.** Not a row, not a timestamp, not an
event. It is simply a record whose date quietly drifts into the past.

Follow the consequence:

- Nothing can fire on "the event ended", because that instant does not exist
- No recap prompt. No rating window. No lineup slot release. No attendance
  settlement. No superfan update. No host-score write. No trust accrual.
- **The entire post-event half of the product has nothing to hang on**

### 1.2 — The app has queues, and no workers

The same shape, one layer down. Every "this item was handled" column in the
schema is **write-never**:

| Completion column | Declared in schema | Writers anywhere (app or SQL) |
|---|---|---|
| `sent_at` | 7 | **0** |
| `delivered_at` | 6 | **0** |
| `failed_at` | 2 | **0** |

The clearest case is `notification_queue`. It is a properly designed outbox —
`scheduled_at`, `sent_at`, `failed_at`, `error_msg`, `attempts`, priority and
category constraints — with a partial index built precisely for a drainer:

```sql
idx_notif_queue_scheduled ON notification_queue(scheduled_at)
  WHERE sent_at IS NULL AND failed_at IS NULL
```

Somebody knew exactly what they were building. **The consumer was never
written.** Nothing selects from that table. Nothing sets `sent_at`. The
`push-notify` edge function does not reference it.

### 1.3 — What this means for the app's most important retention loop

"Tonight: <event> — doors open at 9pm." That notification is the single
highest-value automated message a nightlife app sends. It is broken **three
independent ways**, each sufficient on its own:

1. **It never runs.** The pg_cron job is registered inside
   `IF EXISTS (pg_extension)` wrapped in `EXCEPTION WHEN OTHERS THEN NULL`, and
   the extension is not enabled.
2. **It would match zero rows if it did.** The query filters
   `e.starts_at BETWEEN now() AND now() + interval '12 hours'`, but
   `events.starts_at` is a nullable column that **nothing ever populates** — no
   app write, no trigger, no backfill. The only sync statements that exist are
   commented out in `schema_v6_proposed.sql`. `NULL BETWEEN …` is never true.
3. **Nothing would deliver it anyway.** It `INSERT`s into `notification_queue`,
   which has no consumer (§1.2).

*(Corroborating drift: it also filters `r.status IN ('confirmed','going')`, but
the `event_rsvps` CHECK constraint only permits `('going','maybe','not_going')`.
`'confirmed'` can never match — harmless, but it dates the function to a schema
that no longer exists.)*

### 1.4 — A live bug, caught by the one strategy that IS in place

Guardian is **red on `main` right now**. Two scheduled runs failed today
(05:23 and 13:53 UTC) and issue **#47** has been open since 13:55. The failing
sensor is `client-errors`, and it is not a credential or plumbing failure — it
is a genuine detection:

```
SCHEMA_DRIFT:ProfilePage.loadTab:gruvs:primary  ×1
DEGRADED_PATH:ProfilePage.loadTab:gruvs         ×1
```

The "My Gruvs" tab on every user's profile is running on a fallback tier in
production. The cause, at `ProfilePage.js:2269`:

```js
.or(`author_id.eq.${user.id},user_id.eq.${user.id}`)
```

**`events` has no `user_id` column** — not in the CREATE block, not added by any
`ALTER` in any file. PostgREST rejects the whole filter, the primary throws, and
tier 2 (which correctly drops `user_id` and uses `author_id` alone) wins. The
fallback ladder did its job and the user saw their events — which is exactly why
this went unnoticed. *(`rsvp_count`, selected by tier 3, does not exist either.)*

**This is the whole thesis in one live example.** The sensor worked. The alarm
fired. The fallback protected the user. And the loop still did not close,
because the last step is a human reading issue #47 — and nothing consumes that
queue either.

### The diagnosis

**The house failure mode is the unterminated pipeline.** This codebase
repeatedly builds the *producing* half of a mechanism — the table, the schema,
the index, the enqueue — and never the *consuming* half. The full design gets
written down; the first half ships.

And because the missing half is always a consumer, **the failure renders as
silence**: an empty table, a feature that "just doesn't seem to do anything."
That is the same disease as the 2026-07 incident (24 broken queries rendering as
empty feeds) and the signup bug (35 users' data discarded quietly).

This is why the app cannot manage itself, stated precisely:
**self-management *is* consumption.** Every self-managing behaviour is a
consumer — something that drains a queue, reacts to a state change, settles a
record, closes a loop. The Gruvs has spent two years building producers.

**This app has senses but no pulse.** Guardian is a genuinely good nervous
system — it watches for damage every six hours. But nothing in The Gruvs
*advances the product through time*. There are only states re-derived on demand,
and you cannot automate a system that has no moments to subscribe to.

That is also why my first draft of this plan kept collapsing into cron jobs and
rollback scripts: **the janitorial layer is the only layer that can be automated
when there is no lifecycle to hook into.** Those things matter, but they are the
supporting cast (§6). This section is the lead.

---

## 2. The architecture: give the product a heartbeat

Three parts. Each is small. The ordering *is* the design.

```
  1. LIFECYCLE          2. MOMENTS              3. WORKERS
  core objects carry    transitions write a     consumers drain the
  explicit state,  ──▶  row to the outbox  ──▶  queue, do the work,
  advanced by one       (notification_queue      and MARK IT DONE
  scheduled function     already exists)         (sent_at / failed_at)
```

> **Correction to an earlier draft of this plan.** I proposed building an outbox
> table. One already exists and is better specified than what I would have
> written — `notification_queue` has retry semantics, priority, categories and
> the right partial index (§1.2). **Do not build an outbox. Drain the one you
> have.** The missing piece in this architecture was never the queue. It is, and
> always has been, the worker.

**Why an outbox rather than triggers firing everything inline.** A trigger that
sends notifications inside the transaction that ends an event couples the
event's correctness to the notifier's availability. The outbox decouples them,
is replayable after an outage, and is auditable — you can ask *"what did the
system decide, and did the reaction actually run?"* That is exactly the
`maintenance_runs` paper-trail principle from `SAFETY_MAINTENANCE.md`, applied
to the product instead of the janitor.

It also means every reaction is independently testable, independently
retryable, and independently *deletable* — which matters in a codebase with 77
services and a standing rule against dead code.

---

## 3. The event state machine

```
  draft ──▶ scheduled ──▶ live ──▶ ended ──▶ settled ──▶ archived
              │             │
              └─────────────┴──▶ cancelled        (terminal, pre-ended only)
```

| State | Entered when | Emits |
|---|---|---|
| `draft` | created, unpublished | — |
| `scheduled` | published, start in the future | `event.scheduled` |
| `live` | start time reached | `event.live` |
| `ended` | end time reached (or start + default duration) | `event.ended` |
| `settled` | **a fixed delay after `ended`** | `event.settled` |
| `archived` | retention window passed | `event.archived` |
| `cancelled` | host cancels | `event.cancelled` |

### Why `ended` and `settled` are two states

This is the part that is usually skipped, and it is the part that matters most
for this product.

`ended` means *the clock passed*. `settled` means *the truth is recorded* —
attendance final, host score written once, trust accrued, counters frozen.

They must be separate because **reality arrives late.** Check-ins, gallery
uploads and ratings trickle in for hours after the music stops. Settle on a
delay, exactly once, and the numbers never move again.

That is what makes historical data trustworthy — and this product's entire
thesis is that crowdsourced reality beats organiser spin. A reputation number
that silently recomputes on every client read is not a record of reality. It is
an opinion that changes when you refresh.

### The migration is additive

Add `status`, `ended_at`, `settled_at`. Backfill `status` from
`event_date`/`end_time`. Leave `is_cancelled` / `is_published` working exactly
as they do today — nothing that currently reads the table breaks. One scheduled
function advances states; one trigger writes the outbox row.

---

## 4. What hangs off the heartbeat

| Moment | Reactions | Surface it finally switches on |
|---|---|---|
| `event.scheduled` | reminder scheduling, follower notify | `event_reminders`, `event_followers` |
| `event.live` | event-day notifications (**written, dormant**), now-playing, live chat opens | `schema_part_1.sql:456`, `event_now_playing` |
| `event.ended` | rating window opens, gallery prompt, lineup slots released, event chat goes read-only | `event_ratings`, `event_gallery`, `event_lineup`, `event_chat_messages` |
| `event.settled` | host score written **once**, attendance history, superfans updated, trust/vibe accrual, recap digest | `hostScore.js`, `attendanceAnalytics`, `superfans`, `trustLedger` |
| `event.stale` | never published after N days → drop from feed | feed quality |
| `event.abandoned` | published, zero RSVPs, date passed → quiet archive, **no recap spam** | feed quality |

### The honest point about scope

Almost every consumer in that right-hand column **already exists.**
`event_ratings`, `event_gallery`, `event_lineup`, `superfans`, `hostScore.js`,
`attendanceAnalytics` are built. They are sitting there waiting for a trigger
that was never created.

**This is not 41 new features. It is one column, one scheduled function and one
outbox table — unlocking work you have already done.** That is the highest
leverage available anywhere in this repo, and it is why it now leads this plan
instead of the rollback script.

---

## 5. The Autonomy Budget

Every automated actor — a lifecycle advancer, a reaction consumer, a Guardian
reflex — is assigned exactly one tier before it is built.

**Tier A — act freely, log it.** Reversible, bounded, no user-visible data loss.
Advance an event's state. Re-register a missing cron job. Roll a bad deploy back
to the previous build. Retry a failed notification batch (3 attempts, then stop
loudly). Purge inside an already-declared retention window.

**Tier B — act, then shout.** User-visible but reversible. Auto-hide reported
content. Throttle an account tripping abuse heuristics. Disable a feature flag
whose error rate crosses a threshold.

**Tier C — propose only, never act.** Execute an account deletion. Permanently
remove content or ban a user. Apply a migration to production. Anything touching
money, tier/entitlement, or the 18+ gate. Lowering any k-anonymity floor.

### Three rules binding all tiers

1. **Every actor proves its own effect.** Not "I rolled back" — re-fetch the live
   site and assert it boots. Not "I settled the event" — read back `settled_at`
   and the written host score. `MAINTENANCE.md` Rule 0.2, promoted from human
   discipline to machine requirement.
2. **Idempotent and bounded.** Settling an already-settled event is a no-op, not
   a double-write. A reaction may retry N times, then it must stop and escalate.
   An unbounded reflex is an outage generator.
3. **One kill switch** halts all Tier A/B action and reverts to
   sense-and-escalate. Tested quarterly with the L4 checklist.

---

## 6. Supporting layers — the nervous system

The heartbeat (§2–4) is the product running itself. These layers keep it alive.

| Layer | What | State |
|---|---|---|
| **L0** | Self-cleaning semantics (`expires_at`, read-filters) — beats any job | 🟢 principle |
| **L1** | Guardian's five sensors + the stand-down rule | 🟢 running |
| **L2** | **Reflexes** — bounded auto-remediation | 🔴 **do not exist** |
| **L3** | Housekeeping — pg_cron L1/L2 purges + paper trail | 🟡 written, **dormant** |
| **L5** | Defense — report → auto-hide → review ladder | 🟡 half built |
| **L7** | Human floor (§7) | 🟢 defined |

Guardian is strong at *Sense* and *Escalate*, and has no *Act* at all. Four
verified gaps:

**🔴 Gap 1 — a bad deploy is live for up to 6 hours.** `web-deploy.yml` ships,
swaps, reloads nginx and never checks the site works; the health sensor only
runs on the 6-hourly schedule.
<!-- verify: ! grep -q "health-check" .github/workflows/web-deploy.yml -->
The previous release is already kept at `/var/www/thegruvs_old`, so rollback is
three renames and a reload — worst case drops from 6 hours to ~90 seconds. Tier A.
<!-- verify: grep -q "thegruvs_old" .github/workflows/web-deploy.yml -->

> **Updated 2026-11-16 after merging main.** Main has since built
> `web-rollback.yml`, and it is better than what this section proposed —
> versioned release ids rather than a single `_old` directory, plus a
> `web-deploy-production` concurrency group so a rollback cannot race a deploy.
> **But it is `workflow_dispatch:` only.** The hand exists; nothing pulls it.
> `web-deploy.yml` still contains zero health checks, so the 6-hour exposure
> window is unchanged — a human still has to notice and click.
>
> This makes Gap 1 much cheaper than first estimated: the remaining work is a
> post-deploy verify step that calls the rollback workflow on failure, not a
> rollback mechanism. *(Minor inconsistency worth tidying: `web-deploy.yml`
> still stages via `thegruvs_old` while `web-rollback.yml` uses release ids.)*

**🔴 Gap 1b — the drift sensor is blind to filter columns.** Found 2026-11-16.
`audit-schema.mjs` extracts every `.from('table').select('cols')` and runs the
**select** against the live DB. It never parses `.or()`, `.eq()`, `.is()` or
`.neq()` arguments, so a filter naming a nonexistent column is invisible to it.

That is the exact shape of this repo's most expensive bugs — the signup write
that discarded 35 users' data, the "4 bad READ-filter columns" already on
record, and §1.4's `ProfilePage` `.or()`. The sensor built to catch silent
drift cannot see the half of the query where drift has actually hurt.

**This settles nothing about `events.user_id`, and that is the point.** Guardian
has never flagged it, and that silence is not evidence of the column existing —
the sensor was never looking. The §1.4 question still needs:

```sql
select column_name from information_schema.columns
 where table_name = 'events' and column_name in ('user_id','rsvp_count');
```

Fix: extend the extractor to filter arguments. Same script, same live query, one
more regex — and it closes the category that has cost the most.

**🔴 Gap 2 — a cron job that was never registered can never be reported.** The
watchdog flags jobs that *fail*; it cannot see a job that isn't there.
`send_event_day_notifications` registers inside `EXCEPTION WHEN OTHERS THEN
NULL`. Declare the jobs that must exist; go red on *missing*.

**🟡 Gap 3 — "not deployed yet" advisories never expire.** Guardian can be green
*because the maintenance layer does not exist*. An advisory that never becomes
an alarm is not a signal. Give every notice a deadline.

**🟡 Gap 4 — the watchdog has no watchdog.** GitHub disables scheduled workflows
after ~60 days of repo inactivity; Guardian can switch itself off silently. Fix:
Guardian and pg_cron each write a heartbeat the other checks. Two clocks,
neither able to fail quietly.

**On the "keystone" — I had this wrong.** An earlier draft called enabling
pg_cron the single unlock. It is necessary and not close to sufficient: turning
it on today would start a function that filters on a permanently-NULL column and
writes into a queue nobody drains (§1.3). **pg_cron is the clock. The app is
missing the hands.** Enable it — but expect nothing to visibly happen until the
worker and `starts_at` exist, and do not read the silence as success.

**Blocked today:** the Supabase MCP fails to connect (`JWT could not be
decoded`), so live DB state could not be verified this session and the runbook
cannot be applied from here.

---

## 7. What must never be automated

- **Money.** No PSP, no custody, no automated payouts. Broker + off-platform only.
- **Deletion and money operations are never auto-retried.** Retrying a delete is
  how you delete twice.
- **The 18+ gate stays fail-closed.** Unknown age = restricted, always.
- **Location precision and the k-anonymity floor of 3** are safety properties. No
  optimisation may lower them.
- **Permanent removal and bans stay Tier C.** A machine may hide; only a human
  may erase.
- **The L4 quarterly checklist stays human.** A safety control you have never
  pressed is a hope.

No amount of self-improvement machinery earns a machine the right to amend §7.

---

## 8. Keeping this plan honest

Measured across the 38 root-level `.md` files: **31 carry no date or status
marker**, 18 are untouched for 3+ months, and at least one is *confidently
wrong* — `AUTOMATION_READINESS.md` opens by stating the deploy pipeline is armed
on push to main and dangerous. It is `workflow_dispatch:` only. Nothing is armed.
<!-- verify: ! grep -qE "^[[:space:]]+push:" .github/workflows/deploy.yml -->

A stale doc does not render as empty. It renders as **authority** — the 2026-07
silent-failure bug in a different organ, and worse, because a human acts on it.

So: **documentation drift is schema drift**, and gets the same treatment. Every
line is *generated* (print it, never type it), *asserted* (must carry an inline
HTML-comment `verify:` check), or *editorial* (human-owned, rarely rots). A
static `scripts/audit-docs.mjs` runs the checks in Guardian and goes red on a
failing claim or a live doc past `expires:`. Every doc gets a death condition;
archived plans move to `docs/archive/` so they cannot be mistaken for current.

The recursion terminates because `audit-docs.mjs` checks `audit-docs.mjs` — this
file carries its own contract and its own passing checks.

*Spec note, found the hard way (twice):* the extractor must skip **fenced code
blocks and inline code spans**. A first pass ran the `verify:` line from a
fenced example — it passed, which is worse than failing. The fix for that then
tripped on prose *describing* the marker inside backticks. A sensor that
silently checks the wrong thing is the exact failure mode this section exists
to prevent, so the extractor gets its own test.

---

## 9. Build order

Reordered after the §1.2 finding. **The worker moved to the front** — it is the
smallest build, it is the one thing every other item depends on, and it makes a
visible thing happen on real phones.

| # | Build | Why here |
|---|---|---|
| 0 | Enable **pg_cron**; fix the Supabase MCP token | The clock. Necessary, not sufficient (§6). |
| 1 | **The worker** — drain `notification_queue` → `push-notify`, set `sent_at` / `failed_at` / `attempts` | The missing half of a queue that already exists. Nothing else delivers anything. |
| 2 | **Populate `events.starts_at`** — trigger from `event_date` + `event_time`, plus one backfill | Without it the reminder query matches zero rows forever |
| 3 | **`events.status` + `ended_at` + `settled_at`**, additive migration | The heartbeat. Unlocks 41 satellite tables. |
| 4 | **Lifecycle advancer** — one scheduled function, enqueues to the same outbox | Creates the moments. Reuses the worker from step 1. |
| 5 | **First three reactions**: event-day notify, rating window, host-score settle | Proves the pattern on surfaces already built |
| 6 | Post-deploy verify + **auto-rollback** (Gap 1) | Small, Tier A, protects everything else |
| 7 | Expected-job registry + re-arm (Gap 2); dormancy deadlines (Gap 3); mutual heartbeat (Gap 4) | Guardian grows reflexes |
| 8 | `scripts/audit-docs.mjs` + doc triage (§8) | Cheapest build here; protects every other plan |
| 9 | Moderation ladder: push-don't-wait, anti-brigade, appeal path, SLA | An unread queue is wallpaper |

Steps 1–5 are the plan. Everything else keeps them alive.

**One acceptance test for the whole thing:** RSVP to an event on a test account,
wait for the reminder to arrive on a real device, then confirm `sent_at` is set
on that row. Today that test fails at three separate points (§1.3). When it
passes end to end, the app has a pulse.

### A standing rule this earns

**No new table ships without its consumer.** A producer merged alone is not
half a feature — it is a silent failure with a schema. If the consumer is not
in the same PR, the table does not merge. This is the cheapest possible fix for
the house failure mode, and it costs nothing to adopt today.

---

### Change log

| Date | Change | Verified how |
|---|---|---|
| 2026-09-28 | First draft: Guardian audit, autonomy budget, 4 gaps | Read `guardian.yml`, `maintenance_levels.sql`, `audit-maintenance.mjs`, `web-deploy.yml`, all `cron.schedule` declarations |
| 2026-09-28 | §8 added as self-improvement layer | `git log` across 38 docs; verified `deploy.yml` contradicts `AUTOMATION_READINESS.md` |
| 2026-09-28 | **Rewritten around the lifecycle finding** — heartbeat now leads, janitorial demoted to §6 | Counted 41 `event_*` tables, 77 services, 0 lifecycle columns on `events`; confirmed `is_past` is computed client-side in `hostStats.js:58` |
| 2026-11-16 | Re-verified before first commit. No content change beyond dates and one line reference | All 4 embedded checks re-run and passing; `events.user_id` still absent and `ProfilePage.js:2269` still references it — the §1.4 bug is unfixed after 7 weeks |
| 2026-09-28 | **Queues-without-workers finding (§1.2–1.3).** Two self-corrections: the outbox already exists (don't build one), and pg_cron is *not* the keystone | `sent_at`/`delivered_at`/`failed_at` declared 15× in schema with **0** writers in `src/` or SQL; read `notification_queue` DDL and `send_event_day_notifications()`; confirmed `events.starts_at` has no writer, trigger or backfill |
