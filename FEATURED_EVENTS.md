# Featured Events — making The Gruvs feel alive, honestly

The cold-start problem is real: a new app looks empty. The fix is **editorial
curation of real events**, not fabricated crowds. This is the Bandsintown /
Resident Advisor model — a human curates genuinely-happening events so the app
feels alive from day one, while every number stays true.

**The hard line (Truth Protocol):** we never fabricate likes, comments, or
attendance, and never invent people. Featured events are **real events** that are
**actually happening**, flagged by an official curator. Engagement grows from
real users. The first time someone shows up to a "packed" event that's empty, the
brand is dead — so we simply never do that.

---

## How it works (already wired)
- `events.is_featured` (boolean) is the curator's **official pick** flag.
- `FeedManager.fetchFeatured()` now **prefers `is_featured = true`** upcoming
  events over the score-based fallback, so a featured real event becomes THE
  "Featured Gruv" hero on Explore.
- Everything else (RSVP, vibes, comments, map pin, host profile) already works —
  a featured event is just a normal real event with the flag on.

## Monthly playbook (~8 real events)
1. **Create the curator account** once — a real profile you control, e.g.
   `@thegruvs` or `@gruvs.official`. Give it the verified badge so users see it's
   official:
   ```sql
   -- after signing that account up normally in-app, in Supabase SQL editor:
   update public.profiles
     set is_verified = true, verified = true, verification_badge = 'official'
   where username = 'gruvs.official';
   ```
2. **Post ~8 real, genuinely-happening events** for the month from that account
   (real festivals, concerts, markets, club nights in your cities). Use their
   **real** date, venue, coordinates (so they land correctly on the map), and a
   real poster. The poster-autofill (upload flyer → fields) makes this fast.
3. **Flag them featured:**
   ```sql
   update public.events set is_featured = true
   where id in ('<event-id-1>', '<event-id-2>', ...);   -- the ones you posted
   ```
   To unfeature after they pass, just set `is_featured = false` (or let them age
   out — only upcoming events surface).
4. That's it. They appear as the Featured hero on Explore, on the map, and in
   discovery — real events, honestly presented.

## Guardrails (keep it honest)
- ✅ Real events that are actually happening. ✅ Real curator profile. ✅ Real
  coordinates so the map is accurate. ✅ Real engagement (whatever users give).
- ❌ No fake likes/comments/attendance. ❌ No invented profiles posing as guests.
  ❌ No claiming a crowd that isn't there. ❌ Don't mark an event featured you
  can't stand behind as real.
- If you're not selling tickets, that's fine — list them as informational
  "what's on" picks. Users get a live-feeling city; you get zero deception risk
  (and no Play Store "deceptive content" exposure).

## Optional next step (not built yet)
A dedicated **"Featured this month" rail** on Explore/The Drop showing all ~8
featured events (not just the single hero), with an official "Featured" badge.
Say the word and I'll add it — it reads from the same `is_featured` flag, so no
new data model.
