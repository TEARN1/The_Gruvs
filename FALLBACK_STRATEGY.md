# The Gruvs — 5-Layer Fallback Strategy

Companion to [BUTTON_MAP.md](BUTTON_MAP.md). That doc says what the 1,427 controls *do*.
This one says what happens when one of them **fails**.

---

## Read this first: "everywhere" is the wrong goal

The instinct is to wrap all 720 data calls in the same fallback cascade. **Don't.** Uniform
fallback is actively dangerous, and your own code already says why:

> *"A fallback tier succeeding is not success — it means the intended path is dead and nobody
> noticed. Every bug in the 2026-07-19 sweep looked 'fine' precisely because a lower tier
> quietly covered for a broken tier 1."* — [resilience.js:102](src/utils/resilience.js#L102)

A cache fallback on the feed is excellent. The same fallback on **"Cash Out"** is a
double-payout. On **"Delete account"** it's a POPIA violation that reports success while the
data survives. A retry on a **gift send** is a double-spend — a class of bug you have already
had to fix once.

**So the strategy is not "add fallback everywhere." It is: classify every control by what
failure means, then apply the layer stack that class earns.** Same five layers everywhere;
different behaviour at the tiers that touch data.

---

## What you already have

You are not starting from zero. You are starting from ~14% adoption of a genuinely good engine.

| Piece | Where | State |
|---|---|---|
| Boot circuit breaker (safe mode after 3 crashes / 5 min) | [bootGuard.js](src/utils/bootGuard.js) | ✅ Solid |
| Per-attempt timeout (12s) + exponential backoff + jitter | [resilience.js](src/utils/resilience.js) | ✅ Solid |
| Failure classifier (fatal / transient / schema-miss) | [failureClassifier.js](src/utils/failureClassifier.js) | ✅ Solid |
| 3-tier cascade `resilient([primary, degraded, cached])` | [resilience.js](src/utils/resilience.js) | ⚠️ **101 call sites vs 720 raw calls** |
| Circuit breaker w/ half-open probes | [resilience.js:133](src/utils/resilience.js#L133) | ✅ Solid |
| Degradation + drift reporting to `client_errors` | [resilience.js](src/utils/resilience.js) | ✅ Solid |
| `ErrorBoundary` (render-level) | 44 usages | 🟡 Good, uneven |
| Third-party timeout wrapper | [fetchWithTimeout.js](src/utils/fetchWithTimeout.js) | 🟡 Exists, not universal |
| Offline **write** queue w/ dedupe | [checkinQueue.js](src/utils/checkinQueue.js) | 🟡 Touch Down only |
| Idempotency keys | `resilient()` opts | 🟡 Supported, barely used |

**The gap in one line: 619 of 720 data calls have no cascade behind them.**

### Fix this first: the word "Layer" already means four different things

| File | Says | Means |
|---|---|---|
| [App.js:980](App.js#L980) | "Layer -1" | Boot circuit breaker |
| [failureClassifier.js:107](src/utils/failureClassifier.js#L107) | "Layer 0 guard" | Stale-bundle check |
| [resilience.js:190](src/utils/resilience.js#L190) | "Layer 4" | God View resilience panel |
| [notificationService.js:51](src/services/notificationService.js#L51) | "Layer 1 / 2" | *Unrelated* — push delivery paths |
| [personalizationEngine.js:848](src/services/personalizationEngine.js#L848) | "Layer 1 / 2 / 3" | *Unrelated* — feed ranking |

Negative-indexed layers, a "Layer 4" with no 1–3, and two files using the same word for
something else entirely. **This is why the system feels unknowable — not because it's missing,
but because it's unnamed.** Step 1 of this plan is vocabulary, not code.

---

## The five layers

Read them as altitudes a single button press falls through. Higher layers catch what lower
ones miss; nothing reaches the user as a dead screen or a silent lie.

```
   USER PRESSES A BUTTON
            │
   L1  GUARD      can this even be attempted?      → refuse fast, explain why
            │
   L2  ATTEMPT    try it properly                  → timeout, backoff, classify
            │
   L3  DEGRADE    try a lesser version             → simpler query, cache, queue
            │
   L4  CONTAIN    the screen must not die          → boundary, safe mode
            │
   L5  OBSERVE    someone must find out            → drift log, circuit, alarm
```

### L1 — Guard · *"Should this be attempted at all?"*
Runs **before** any network call. Cheapest layer; prevents the most damage.

Checks: signed in? online? permission granted? circuit already open for this label? input valid?
Is this a **double-submit** of a write already in flight?

Today this is scattered — `if (!user) onAuthRequired()` is repeated across dozens of components,
and double-submit protection is per-component `busy` flags applied inconsistently. Every button
that spends value or mutates state needs it, and most currently rely on the button's own
`disabled` prop, which does nothing if the press already fired.

### L2 — Attempt · *"Try it properly."*
The single operation, done right: **12s timeout** (never an infinite spinner), exponential
backoff with jitter, and classification of the failure into fatal / transient / schema-miss so
the next layer knows whether retrying is pointless.

Already built and good. The gap is reach: 619 raw `supabase.from(...)` calls skip it entirely and
therefore have **no timeout at all**.

### L3 — Degrade · *"A lesser answer beats no answer — unless lying is worse."*
This is the layer that must differ by control class. **It is the whole strategy.**

| Class | Example controls | L3 behaviour |
|---|---|---|
| **READ** | feed, explore, calendar, profile, leaderboard | Full cascade: rich query → simplified query → **cache** → empty state. Stale data clearly beats a spinner. |
| **WRITE** | RSVP, Vibe, Touch Down, echo, post event | **Never cache-fallback.** Optimistic UI + **persistent queue + idempotency key**, replayed on reconnect. `checkinQueue` is the pattern — generalise it. |
| **CRITICAL** | cash out, gift send, release escrow, delete account/event, moderation remove | **No fallback. No silent retry.** One attempt, then fail loudly with a precise error. Retrying money or deletion is worse than failing. Idempotency key mandatory if a retry is ever added. |

Getting this table wrong is how you ship a double-spend. Getting it right is most of the value here.

### L4 — Contain · *"One broken thing must not take the app with it."*
Render-level. `ErrorBoundary` per screen and per major section, `Suspense` per lazy chunk, and
the boot guard's safe mode as the floor.

Largely in place (44 boundaries, per-tab isolation in `App.js`). The remaining work is
**granularity**: a boundary around a whole screen still blanks the screen. Sections that can
fail independently — a gallery, a playlist, an ad rail — should fail in place, inside their own
card, leaving the rest usable.

### L5 — Observe · *"A fallback nobody knows about is a bug with a disguise."*
The layer that stops silent rot. Drift reporting, degraded-path reporting, circuit-breaker state,
and surfacing it where a human sees it.

The reporting exists and writes to `client_errors`. What's missing is the **feedback loop**: no
one reads that table on a schedule. A `DEGRADED` line proving tier 1 is dead has the same
practical effect as no logging at all if nobody looks. This is how "48 missing RPCs and 14 missing
columns survived unnoticed."

---

## Rollout — in this order, and not a different one

Ordered so each step de-risks the next. Resist starting at step 4; instrumenting call sites
before you can see the results just moves the blindness.

**Step 1 — Vocabulary (half a day, zero risk).**
Adopt L1–L5 in comments. Renumber "Layer -1" → L4/boot-floor, "Layer 0 guard" → L1, "Layer 4"
panel → L5. Rename the two *unrelated* uses in `notificationService` and `personalizationEngine`
to "path"/"pass" so "Layer" means exactly one thing. Nothing to test; makes everything after
this legible.

**Step 2 — Classify the controls (one pass over BUTTON_MAP.md).**
Tag every control READ / WRITE / CRITICAL. This is a decision-making exercise, not typing, and
it's the artefact everything downstream depends on. The CRITICAL list should end up short —
roughly the money and deletion controls, ~15–20 buttons. **Do this before writing any code.**

**Step 3 — Make CRITICAL safe (small, highest stakes).**
For those ~15 controls: confirm single-attempt semantics, no cache tier, loud failure, and an
idempotency key wherever a retry could ever occur. This is the smallest step with the largest
downside avoided.

**Step 4 — Close the timeout gap on reads (mechanical, high value).**
619 calls with no timeout is the single biggest source of "screen spins forever." Sweep the
READ paths onto `resilient()` service-by-service — highest-traffic first (feed, explore,
profile). Mechanical and reviewable in small PRs.

**Step 5 — Generalise the write queue.**
Promote `checkinQueue` into a generic `pendingWrites` queue: dedupe key, cap, replay on
reconnect, idempotency key per entry. Adopt for RSVP, Vibe, echo, then the rest.

**Step 6 — Close the L5 loop.**
Add a resilience panel to God View reading `getOpenCircuits()` (the code already anticipates
this) plus a weekly digest of `DEGRADED` / `SCHEMA_DRIFT` from `client_errors`. Without this,
steps 3–5 quietly rot.

---

## How to tell it's working

Not "no errors" — that's unachievable and the wrong target. Aim for:

1. **No infinite spinners.** Every screen resolves to data, empty state, or a stated error within
   ~15s. Testable.
2. **Degradation is visible, never silent.** A tier-2 success always produces a `DEGRADED` line,
   and someone reads it that week.
3. **No CRITICAL control ever silently retries.** Verifiable by inspection of ~20 call sites.
4. **A dead table breaks one card, not one screen** — and never the app.
5. **Adoption metric:** `resilient()` call sites ÷ raw data calls. Today ≈ **14%**. Track it; make
   it a CI check once it's respectable so it can't regress.

---

## What this does *not* solve

Being explicit so it isn't oversold:

- **It cannot fix schema drift** — it makes drift *visible and survivable*. 48 missing RPCs still
  need the migrations run. Fallback that permanently masks a missing RPC is the failure mode this
  doc exists to prevent, not a fix.
- **It cannot make a write succeed offline.** Queue-and-replay defers the write; if the server
  rejects it on replay, the user must still be told — including after they've walked away.
- **It adds real complexity.** Every layer is code that can itself be wrong. That's precisely why
  the CRITICAL class gets *less* machinery, not more.
