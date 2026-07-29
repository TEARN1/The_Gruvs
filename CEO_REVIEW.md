# The Six CEOs — a review lens for The Gruvs

A reusable prompt. Point it at any screen, feature, or decision and ask six operators who have
already solved this at scale what they'd do differently.

**Why six and not one:** they disagree. Zuckerberg's answer to "how do we grow" contradicts
Koum's answer to "what do we refuse to build." The disagreement is the product — where two of
them collide is usually where the real decision is.

**How to use it:** paste the prompt, name the target, and demand *specifics*. A verdict like
"improve engagement" is a failed run. "Cut the 8 profile tabs to 3, because the other 5 are
where your only 35 users churn" is a passing one.

---

## The prompt

> You are reviewing **The Gruvs** — a real-time nightlife and events app. Its thesis is the
> **Truth Protocol**: crowdsourced reality beats organiser spin. Verified physical presence
> ("Touch Down") is the core signal. It is anti-social-media by design — it exists to get people
> off their phones and into rooms. Solo developer, no budget for paid APIs, no money-handling.
> South Africa is the launch beachhead, not the ceiling.
>
> **Target of this review:** `<SCREEN / FEATURE / DECISION>`
>
> Answer as six people, in their own voice, each in 3–5 sentences. No hedging, no consensus,
> no "it depends". Each must name **one specific thing to cut, change, or ship** — a button, a
> screen, a default, a number.
>
> **Mark Zuckerberg (Facebook)** — Growth loops and the magic number. What is the equivalent of
> "7 friends in 10 days" here, and does anything in this target move it? He will delete a
> beloved feature that doesn't compound. Ask: what is the retention mechanic, and where is the
> instrumentation to prove it?
>
> **Adam Mosseri (Instagram)** — Creation friction and the shape of the feed. How many taps from
> intent to posted? Does this reward the creator or exhaust them? He killed the "square photo"
> constraint and later un-killed the feed's chronology. Ask: what is the one tap we can remove,
> and is the feed showing what people actually want or what we wish they wanted?
>
> **Shou Zi Chew (TikTok)** — Cold-start quality and interest over social graph. A new user with
> zero follows must get value in under 30 seconds. TikTok wins because the *content* is ranked,
> not your friends. Ask: what does an empty-state user see, and is the ranking signal honest?
>
> **Ryan Roslansky (LinkedIn)** — Identity, proof, and the professional graph. What here is a
> *credential* someone would put their name to? LinkedIn's moat is verified reputation, not
> posts. Ask: what does this target prove about a person, and would they show it to someone who
> matters?
>
> **Jan Koum (WhatsApp)** — Ruthless subtraction and trust. No ads, no games, no gimmicks, no
> stickers for years. He would look at this and ask what to *delete*. Ask: what is the smallest
> thing that still works, and what here is a privacy liability the user didn't ask for?
>
> **Jack Dorsey (Twitter)** — The public square and real-time. What is the atomic unit of
> content, and can a stranger's post reach the right person in seconds? He would collapse
> hierarchy and speed up the loop. Ask: what is the fastest path from "something is happening
> now" to "the right people know"?
>
> **Then close with a section titled "Where they disagree"**: name the two sharpest conflicts
> between them and say which side you'd take for The Gruvs specifically, and why. Do not
> resolve the conflict by splitting the difference.

---

## Why each lens earns its place here

| CEO | The question they're best at | Where The Gruvs is weak on it |
|---|---|---|
| Zuckerberg | Does this compound? | 35 users, 2 check-ins. Nothing has been proven to retain — and with 0 `testID`s and an advisory-only E2E suite, there's little instrumentation to find out. |
| Mosseri | How hard is it to create? | `PostEventModal` is a **3-step wizard with 85 controls**. The poster-scan autofill is the right instinct; the wizard around it may still be the wall. |
| Chew | What does a cold user see? | The Drop opens on **Upcoming**, not a ranked "For You". With low density, an empty city looks like a dead app. |
| Roslansky | What does this prove? | The **Vibe Passport** and Touch Down history *are* a credential — arguably the most defensible thing here — and they're buried behind a tab on a 3,847-line profile. |
| Koum | What should we delete? | 1,427 controls. The Focus Cut already parked five surfaces; God View is a mock harness; escrow buttons front a payment rail that doesn't exist. |
| Dorsey | How fast is now→known? | "Touch Down", `CrowdMeter`, `LiveEventUpdates` are all real-time truth signals — but they're spread across separate sections rather than one live surface. |

---

## Rules that keep this useful

1. **One target per run.** "Review the whole app" produces six paragraphs of nothing. "Review
   `PostEventModal`" produces cuts you can make today.
2. **Force a number.** Every verdict names a count, a tap, a screen, or a percentage. "Simplify
   onboarding" is not a finding; "step 1 asks for 11 fields before the user has seen a single
   event" is.
3. **Let them contradict the founder.** The point is to hear what a room of operators would say
   if they weren't being polite. If all six agree with the current design, the run was too soft.
4. **Koum gets a veto on anything touching privacy.** Location, contacts, presence and the
   `profiles` table are where this app can do real harm. When his answer conflicts with a growth
   answer, his wins by default — that's already the standing safety principle.
5. **Ignore the ones who don't apply.** Reviewing the SQL layer? Only Koum and Zuckerberg have
   anything useful to say. Forcing all six produces filler.

---

## A worked example — target: `ProfilePage.js`

Illustrative, to show the output shape. Grounded in what the audit actually found: 129 controls,
3,847 lines, 8 content tabs.

**Zuckerberg** — Eight tabs on a profile is seven too many for 35 users. None of them is
instrumented, so you cannot tell which one anybody opens. Ship three (Gruvs, Passport, Gallery),
add a `testID` to each, and read the numbers in a fortnight before restoring anything.

**Mosseri** — The identity form asks for clan name, siblings, home village and languages before
the user has any reason to trust you with them. Move all of it behind "complete your Vibe Card"
*after* their first Touch Down, when the value is obvious. Right now it reads as a census.

**Chew** — A profile with no events, no gallery and no passport is your most common profile, and
it currently renders as a wall of empty tabs. Make the empty state a single ranked prompt —
"3 Gruvs near you tonight" — because a cold profile should push outward, not inward.

**Roslansky** — The Vibe Passport is the only thing here that a stranger would trust: verified
attendance nobody can buy. It should be the *first* tab and the shareable artifact, not the
fourth. That is your LinkedIn moment; the gallery is not.

**Koum** — Emergency contacts with phone numbers, siblings' ages, and a home-village GPS pin
sit in the same form as a bio. That is a serious liability in one table, and `profiles` already
carries five duplicate `USING (true)` SELECT policies. Split sensitive fields into their own
table with their own policy, or stop collecting them.

**Dorsey** — Nothing on this profile tells me what this person is doing *tonight*. Put a live
status line at the top — where they touched down, who they're out with — and let the biography
sink. Identity here should be present-tense.

**Where they disagree:**

*Roslansky vs Koum, on the identity form.* One wants richer verified identity; the other wants
half of it deleted. **Side with Koum** — but keep the passport. Verified *attendance* is a
credential that carries no PII, so you can have the reputation without the census. Siblings and
phone numbers add liability without adding proof.

*Zuckerberg vs Mosseri, on the tabs.* Cut to three and measure, or move the form and keep the
surface? **Side with Zuckerberg** — measurement first. You cannot make a considered cut on a
surface where nothing is instrumented, and at 35 users the cost of cutting wrong is one day of
work, while the cost of guessing wrong for six months is the product.

---

## Related

- [BUTTON_MAP.md](BUTTON_MAP.md) — what all 1,427 controls do (Koum's cut list starts here)
- [FALLBACK_STRATEGY.md](FALLBACK_STRATEGY.md) — how they should fail
- `MONETIZATION.md`, `PRODUCT_VISION.md`, `GOLDEN_PLAN.md` — the founder's own answers to
  roughly the same questions; worth reading *after* a run, so the lens stays independent
