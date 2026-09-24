# THE GRUVS — BD PLAYBOOK (getting the first real humans in)

> **This is the operating doc for the next 8 weeks.** Where it disagrees with
> LAUNCH_ACTIONS.md, GO_LIVE.md, MASTER_PLAN.md or REVENUE_PLAYBOOK.md, this one
> wins; those are reference. One plan, or you'll run four half-plans.
>
> The plan's #1 risk was never code. It's this: **can we get real hosts and real
> crowds to show up?** Everything else is downstream. Marked ⟨YOU⟩ = needs your
> ground truth.

**STATUS — update this line every Monday. A stale status is worse than none.**

| Field | Value |
|---|---|
| Last updated | 2026-08-26 |
| Week of the run | **not started** |
| Users / hosts / Touch Downs | 29 / 2 / 2 *(as of 2026-07-06 — re-pull, see §7)* |
| Scene | **JHB / PTA weekend nightlife** (locked 2026-08-26) |
| Budget | ~15h/week · ~R3,000 barter-first for 8 weeks (§6) |
| Host #1 booked? | ⟨YOU⟩ |

Goal: **10 real hosts, 100 real attendees, 50 real Touch Downs in ONE scene
within ~8 weeks** — where "real" means not you.

> ⚠️ The 8-week window in the original draft opened on 2026-07-06 and has already
> run out on paper. Treat week 1 as starting the day you complete §0.5, and reset
> the dates. Don't carry a fictional timeline.

---

## 0. The mindset shift
You are not "launching an app." You are **throwing (or powering) real nights in
one city** and using the app to run them. For the next 8 weeks you are a
**promoter first, a developer second.** The app is your tool, not your product.

If that feels uncomfortable — good. That discomfort is the exact reason most
technical founders fail here, and why the ones who push through win.

---

## 0.5 PRE-FLIGHT — do not book host #1 until every box is ticked

The door demo (§4 step 4) is the single most important action in this plan. It
happens once, in front of the person you're trying to convert, in a loud dark
room on bad signal. It gets tested **before** it matters, not during.

**The install path is a PWA, not a store app.** `GetAppModal` says "free, no
store needed." That's an advantage at a door — no store, no 80MB download — but
it has sharp edges you must know before you're standing there:

- [ ] **Android door run.** Mid-range phone, mobile data throttled, real venue.
      Time it: **tap link → check-in done in under 60 seconds.** Write the number
      down. If it's over 60s, fix that before anything else in this doc.
- [ ] **iOS door run.** PWA install on iOS needs Share → Add to Home Screen —
      nobody does that in a queue. Decide now: either you walk iOS users through
      it, or you accept they check in from a browser tab. Know which.
- [ ] **Push reality check.** "Come back next weekend" runs on notifications, and
      PWA push only works once installed to the home screen. If most attendees
      stay in a tab, your week-2 retention has no channel. Know your split.
- [ ] **First-load weight.** The JS bundle parse is the known remaining
      bottleneck. Measure first-paint on congested venue data, not on your wifi.
- [ ] **Dead-zone check-in.** Airplane mode → Touch Down → it must say *"Bad
      signal — we'll log it"* and then actually appear when you reconnect.
      ✅ *Fixed 2026-08-26:* the offline queue now fires on a **failed send**
      (not just `navigator.onLine`, which is true in a basement wifi that goes
      nowhere), replays at the **real check-in time**, preserves ghost mode, and
      drains the moment the network returns — see `src/services/checkinSync.js`.
- [ ] **Migrations applied.** Work DEPLOY_SQL_RUNBOOK.md to zero pending before
      host #1's night. If anything gated touches check-in or attendance, week 1
      fails on infra and you'll blame BD.
- [ ] **Concurrency.** Nobody has ever put 50 people on one venue at once — which
      is precisely the §1 goal. Check the free-tier ceilings you'd hit on your
      *best* night: realtime connections, row reads, storage for the night's
      photos. A success-shaped outage is still an outage.
- [ ] **"Who's here now" feels live.** ✅ *Fixed 2026-08-26:* `CrowdMeter` loaded
      once and then sat there under a live dot; it now subscribes to realtime
      with a 60s poll behind it (the table may not be in the publication) which
      also ages votes out of the 45-min window. Still stand in a room and count
      the seconds — if it reads as a list rather than a pulse, that's the magic gone.
- [ ] **Run `referral_lineage.sql`** before printing any door sign, or the QR's
      `?ref=` has no column to land in and every door scan attributes to nobody.
- [ ] **Guardian is armed for the night.** You'll be at the door, not watching
      logs. Alarm on check-in failures during venue hours.
- [ ] **A support channel exists.** When someone's check-in fails, where do they
      go? A WhatsApp number on the door sign counts.

⟨YOU⟩ Door-run time recorded: ______ sec (Android) / ______ sec (iOS)

---

## 1. Pick the beachhead (narrow until it hurts)
Not "South Africa." Not even "Joburg." **One scene, one night type, one area.**

⟨YOU⟩ Choose ONE (recommendation in **bold** based on liquidity + your access):
- **Joburg / Pretoria weekend nightlife** (clubs, lounges, parties) — highest
  frequency (every weekend = fast feedback loops), strong SA culture fit.
- University scene (Wits/UP/UJ res + campus parties) — dense, social, phone-native,
  loves status/leaderboards, cheap to reach. **⚠️ Check the calendar first:**
  Oct/Nov exams flatten campus scenes exactly during weeks 5–8, and the age mix
  makes §11 non-optional.
- A single recurring event series you already have a relationship with.

**Why narrow wins:** density is local. 50 people at ONE venue lights up Who's-
Here-Now, Crossed Paths and the live layer. 50 people spread across a country
lights up nothing. You need *concentration*, not coverage.

**Open the calendar before you commit.** Public holidays, long weekends, exam
periods and big competing events will make or break individual weekends. Map all
8 weeks now so you don't read a dead public holiday as a dead product.

**THE SCENE (locked 2026-08-26): Joburg / Pretoria weekend nightlife.**
Chosen for frequency — every weekend is a feedback loop — and because it has no
exam-season cliff. This is now fixed for all 8 weeks; §9 forbids adding a second
scene, and that includes quietly drifting into the campus one.

⟨YOU⟩ Narrow it once more, because "JHB/PTA" is still too big to create density:
name the **area** (e.g. Braamfontein / Fourways / Hatfield) and the **night**
(Fri or Sat): ______________________

⟨YOU⟩ Weeks 1–8 dates, and which are compromised by holidays or big competing
events: __________________

---

## 2. Who you actually recruit first (supply before demand)
The chicken-and-egg breaks on the **supply** side, because a host has a reason to
use the app even with zero Gruvs audience (you plan + promote their night for
them). Target, in order:

1. **The mid-tier promoter / small venue** — throws events monthly, hungry for
   reach, NOT big enough to ignore you (skip the mega-clubs for now; they don't
   need you yet). This is your ideal host #1.
2. **The scene connector** — the DJ, the "plug," the person whose WhatsApp status
   everyone watches. One of these = 20 attendees.
3. **The freelancer with events** — photographers/MCs who already work every
   weekend and know every promoter. They become your scouts.

⟨YOU⟩ List 10 real names you can reach this week: 1)__ 2)__ … 10)__

**Keep a rejection log.** You'll pitch ~30 to sign 10. The 20 nos are the most
valuable data you will generate in these 8 weeks — the objection that repeats is
your actual product problem. One line each: who, what they said no to, why.

---

## 3. The pitch (what you actually say)

### To a host
Not "download my app." Lead with **their** pain and a **free** win:

> "I'm building the app that runs the [scene] night — I'll list your event, let
> your crowd request songs and RSVP, and afterwards I give you the **verified
> list of who actually showed up** and who your real regulars are. Free. I just
> want your next event on it. Can I set it up for you in 5 minutes?"

**When they say "I already use WhatsApp and Instagram"** — and they will, because
they do — the answer is the only thing you have that those don't:

> "Instagram tells you who *liked* it. I tell you who **walked through the door**,
> by name, and which of them keep coming back. You can't get that from a story."

The hooks that land (each maps to a real feature you already have):
- **"Verified who-showed-up"** → attendance analytics + Superfans (nobody else gives this)
- **"Your crowd picks the music"** → the event playlist 🎧 (⚠️ ⟨YOU⟩ **run this
  end-to-end yourself before you pitch it** — confirm an *attendee* can add a
  request, not just that the host can set now-playing. Never sell a hook you
  haven't personally completed.)
- **"Free promo"** → the feed, stories, share cards
- **"Know your real fans"** → Poster Insights + fidelity

### To an attendee, at the door, in ten seconds
This is the script you'll use 100+ times — more than the host one. Lead with the
Truth Protocol, because "is it actually busy or is the flyer lying" is the
sharpest thing this app does:

> "See who's actually inside before you pay to get in. Tap this, you're on the
> list — and you're in for [the door incentive]."

⟨YOU⟩ Translate both into your voice / local language. They must sound like *you*,
in a WhatsApp voice note, not a brochure.

---

## 4. The concierge motion (do things that don't scale)
For the first ~10 hosts, **you** do the work, in person / over WhatsApp:

1. **Create their event as a draft and hand it over.** Use the co-creation path
   (`EventDraftPanel` / `EventRoleManager`) so the **host owns the event** — if
   you create it under your own account, the attendance and Superfans data
   belongs to you, and step 5's promise is undeliverable. This is the one step
   people get wrong; get it right on host #1.
2. Seed the playlist + turn on RSVP.
3. Post it to the feed + a story; share the link into their groups.
4. **Give them an asset kit.** Their WhatsApp broadcast is the real growth
   channel, not yours — so hand them a ready-to-post share card, a caption, and
   a story frame. Zero friction between "yes" and them posting it.
5. **Print the door code.** ✅ *Built 2026-08-26:* on the event, as host, tap
   **Door Sign** → an A5 sheet with a QR that opens *this* event and carries your
   referral code. Print from a laptop (browser print dialog); on phone it shares
   the link instead. Requires `referral_lineage.sql` to be applied first.
6. **On the night: you show up.** You get 5–10 people to physically Touch Down
   (you demo it at the door). This is the single most important action in the
   entire plan — the first real check-ins.
7. **Send the report while they still feel the night** — that night or first
   thing next morning, not Sunday. Peak host emotion decays fast. ⟨YOU⟩ Decide
   the exact artifact now: which Superfans export, which fields, sent on which
   channel — or you'll be improvising it at 2am. *(§11 limits what you may
   include.)*
8. **Next day: the photo drop.** Your photographer scouts (§2.3) shoot anyway.
   Last night's photos landing in the app is the classic reason people open it
   the next morning. Free retention; use it.

This is unglamorous and it's the whole game. Airbnb photographed listings by
hand; you run nights by hand.

**Then the part that actually matters: event #2.** A first event is a favour to
you. The second one — booked by the host, ideally run without you standing there
— is the only evidence that any of this works. Every host you sign gets an
explicit ask for their next date before you leave the venue.

---

## 5. The activation trick: make Touch Down irresistible on the night
Touch Down is your moat but people won't do it unprompted. Manufacture it:
- ⟨YOU⟩ **Door incentive**: partner with the host so the first N Touch Downs get
  something real — free entry, a drink, front-of-queue, a shoutout. (No money
  handled by the app — the host honours it; you broker recognition. See §11 on
  drink-linked incentives.)
- **Physical prompt**: a printed sign / QR at the door: "Touch Down on The Gruvs
  → you're on the guest list next time." (Ties to Reward-My-Top-Fans.)
  ⚠️ Signage and photography at a venue need the **venue's** sign-off, not just
  the promoter's — bigger rooms have exclusivity contracts.
- **The DJ shoutout**: "request your song on The Gruvs" from the booth = instant
  installs + song requests + a reason to keep the app open (the 3 hours).
- **Onboard under the host's invite.** ✅ *Fixed 2026-08-26:* invite lineage was
  advertised but not wired — `?ref=` links had been going out for a while and
  **nothing read the parameter**, and `profiles` had no `referred_by` column, so
  every invite and every scan attributed to nobody. Now the landing page captures
  the code, `claim_referral` attaches it once the profile exists, and the door QR
  carries the host's code. Without this you get 100 users and no idea which night
  produced them.

---

## 6. The weekly loop (your operating rhythm)
- **Mon–Tue:** debrief last weekend (run the scoreboard query, §7); update the
  STATUS block at the top; sign 1–2 new hosts; log the nos.
- **Wed–Thu:** load the weekend's events; push "This Weekend in [scene]"; seed
  the playlist; send host asset kits; rally.
- **Fri–Sat:** be at the venues. Drive Touch Downs. Watch it live.
- **Sun:** post the Wrapped/recap. Ask attendees the two questions (§8).
  *(Host reports go out on the night — §4.7 — not here.)*

**Budget — both kinds, or this won't survive week 3.**

**Time: ~15h/week.** Fri + Sat at venues (~8h), Mon debrief + scoreboard (~2h),
Wed load-in and host asset kits (~3h), plus ~2h of slack for the host you're
chasing. This is the *minimum* that makes the §6 loop real rather than
aspirational — below it, host recruiting is always the thing that slips, and
recruiting is the whole plan. It deliberately leaves weekdays for dev, because
the §9 carve-out means door-loop blockers must get fixed inside the same week
they appear. Do **not** go near full-time on BD: you're the only person who can
fix the app, and a broken check-in costs more than an extra host.

**Money: barter-first, with a ~R3,000 ceiling for the 8 weeks.** The posture is
that the host covers your entry and honours the door incentive — this is fair
(you're promoting their night for free) and it's the only version that respects
the no-recurring-cost constraint. But budget real cash for the things you can't
barter and that fail badly when missing: **printing** (~R400 for A5 door signs
across 10 events), **transport** (~R1,800 — late-night rides home you should
never skip on, see §11), and a **~R800 incentive reserve** for the night a host
won't cover it and you don't want to lose the demo. If you're spending more than
R3,000 to prove ten nights, the problem isn't budget — it's that the value isn't
landing, and §7's kill criteria should be catching it.

---

## 7. The numbers to hit (the only scoreboard)

> **The gate is one sentence: a host reuses The Gruvs for their next event
> without you asking.** Everything in the table below is just the leading
> indicators for that. If it happens in week 4, you're ahead. If it hasn't
> happened by week 8, nothing else in this table saved you.

| Week | Hosts | Events | Attendees | **Touch Downs** | of which WITHOUT you | Came back | Signal |
|---|---|---|---|---|---|---|---|
| 1–2 | 2–3 | 2–3 | 30 | **15** | 0 ok | — | loop works on a phone |
| 3–4 | 5 | 5 | 60 | **35** | ≥5 | ≥5 | non-founder check-ins |
| 5–6 | 7 | 8 | 100 | **60** | ≥20 | ≥15 | week-2 retention is real |
| 7–8 | 10 | 10 | 150 | **90** | ≥40 | ≥30 | a host reuses it unprompted → **Stage-1 gate met** |

**Where the numbers come from:** `supabase/queries/bd_weekly_scoreboard.sql`.
Run it Monday, paste the top row into the STATUS block. Put your own user id in
it first. If pulling numbers takes an hour it stops happening by week 3.

**Counting rules — write these down before you're motivated to bend them:**
- **You don't count.** The founder account is excluded from every number. You
  personally driving check-ins measures a promoter, not a product.
- **"Without you" is the real column.** Touch Downs on nights you weren't there
  is the only figure that distinguishes a product from your charisma.
- Duplicates collapse to one per person per event.
- Note that the check-in geofence allows a Touch Down from up to 2km away
  (parking, queues). That's correct for real attendees and it also means the
  number is inflatable — by you, during exactly the weeks you most want it high.
  Don't.

**If Touch Downs aren't growing week over week, stop and diagnose — don't add
features.** The answer is in §8.

### Kill criteria (decide now, while it's cheap)
⟨YOU⟩ Pre-commit to what makes you say *this scene is wrong* or *this isn't
working*, so an 8-week experiment can't quietly become a six-month one:
- By **week 4**: if fewer than 3 hosts have said yes at all → the pitch or the
  segment is wrong. Change one, not both.
- By **week 6**: if "Touch Downs without you" is still ~0 → you are the product.
  Stop and fix the door flow before signing anyone else.
- By **week 8**: if no host has rebooked unprompted → do **not** roll to a second
  scene. Either the value isn't landing or the segment is wrong; write down which
  and run one more 4-week cycle on that hypothesis alone.

---

## 8. Learn fast (the falsification loop)
Every weekend, ask **at least 20** real attendees TWO questions (5 is too few to
read a percentage from — 40% of 5 is the difference between two people and three):
1. "Would you be bummed if this app disappeared?" (the only retention question
   that matters — you want >40% "yes, very.")
2. "What did you actually use it for?" (find the ONE feature that hooks — double
   down on it, cut the rest from your pitch.)

**And ask every host one:** *"What would you pay for this, and for which part?"*
MONETIZATION.md bets on a B2B host tier — these 8 weeks in the room with 10 hosts
are the cheapest willingness-to-pay research you will ever get. Don't waste them.

**Name the load-bearing assumption and test it in week 1.** §2 is supply-first,
but §7 expects 30 attendees from 2–3 hosts — which silently assumes *a host's
WhatsApp broadcast converts to installs*. Guess the rate now (5%? 10%?), measure
it on host #1's night, and write down the real number. Everything downstream of
§7 depends on it.

⟨YOU⟩ Log answers weekly in your working doc (see §12). This is how you find
product-market fit or learn you don't have it — cheaply, in weeks, not years.

---

## 9. What NOT to do (discipline)
- ❌ Don't build new features to "fix" low usage. Usage is low because there are
  no users, not because a feature is missing.
  - ✅ **Carve-out:** fixes that unblock the door loop — check-in, install, event
    creation, the report — are always allowed. Nothing else is. Without this
    exception the rule is unfollowable (you *will* hit a blocking bug at a door)
    and you'll throw out the whole discipline the first time you break it.
- ❌ Don't spread to a second city/scene. Density is everything.
  - The only condition that unlocks a second scene: **the Stage-1 gate met, and
    a weekend running without you present.** Not "it's going well."
- ❌ Don't chase the biggest clubs — they'll ignore you. Own the mid-tier.
- ❌ Don't run paid ads yet. Hand-to-hand first; you need to *learn*, not scale.
- ❌ Don't measure signups. Measure **Touch Downs** and **returns.**

---

## 10. The 29 people who are already here
You have 29 existing users. They are either your first attendee pool for host
#1's night or they are your first churn data — and either answer is useful.
⟨YOU⟩ Message all 29 personally in week 1. Two outcomes worth having: some show
up, and the ones who don't tell you why they stopped.

---

## 11. Safety, POPIA, and the things that end companies
This section is not optional and it is not paperwork. It is the only part of this
playbook where getting it wrong can't be fixed by trying again next weekend.

- **Age gate stays on, always.** It's the one legal hard gate. The university
  option in §1 puts under-18s in the room; an 18+ Gruv must refuse them and a
  drink-linked door incentive must not be reachable by them. If a host wants to
  "just this once," the answer is no.
- **The attendance report is personal data.** You are handing a third party a
  list of named humans and their physical location on a given night. Send only
  what the host needs (per POPIA_COMPLIANCE.md), tell attendees it happens, and
  don't include anything a ghost-mode user chose to hide.
- **Decide the retention window before you need it.** If an incident happens at
  an event, your check-in records become evidence someone can compel. Know how
  long you keep precise presence data and why — see `data_retention.sql`.
- **Venue permission** for signage and photography, in writing-ish (a WhatsApp
  yes from the venue, not just the promoter).
- **Your own safety.** You, alone, in clubs, late, weekly, in SA, carrying the
  device the entire company runs on. Tell someone where you are, back up the
  phone, don't do the money-and-laptop thing. Plan it like the operational risk
  it is, because it is one.

---

## 12. The one decision that determines everything
⟨YOU⟩ **Who is host #1, and when is their next event?**

| | Name | Date | Your ask |
|---|---|---|---|
| Host #1 | ________ | ________ | ________ |
| Backup A | ________ | ________ | ________ |
| Backup B | ________ | ________ | ________ |

**Three, not one.** The original draft made everything downstream of a single
booking — and promoters ghost. A pipeline of three is the difference between a
slow week and a dead month.

> **On the ⟨YOU⟩ blanks:** these will not get filled in a git-tracked markdown
> file, and pretending otherwise is how a playbook becomes decoration. Keep the
> live answers — names, weekly logs, rejection log, the two-question answers — in
> whatever you actually open every day (a note, a sheet, a WhatsApp to yourself).
> This file holds the *plan*; that holds the *state*. Only the STATUS block at
> the top gets updated here.

Everything in this playbook is downstream of that one booking. Get host #1's
next night onto The Gruvs, be there, and get 10 real Touch Downs. Then do it
again. That's the company.
