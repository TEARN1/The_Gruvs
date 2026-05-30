# The Gruvs — Security Audit

**Scope:** Authorized, non-destructive security review of the owner's own app.
Tested live against production Supabase using **only the public `anon` key** (the
same key shipped in every app install / the web bundle) — i.e. exactly what an
attacker can do after pulling the key out of the bundle. No data was modified;
write tests used impossible filters (0 rows) and any probe inserts were deleted.

Tooling: `node scripts/sec-probe.js` (re-runnable).

---

## TL;DR

**The good news — your write-side is solid:**
- ✅ RLS **is enabled** — every anonymous INSERT / UPDATE / DELETE was blocked.
- ✅ No anonymous data forgery (couldn't fake a follow, check-in, etc.).
- ✅ Truly private tables (`messages`, `dm_rooms`, `wallet_transactions`,
  `event_chat_messages`, `service_bookings`, `ai_user_memory`,
  `user_deep_profile`, `reports`, `notifications`) returned **0 rows** to anon —
  their read policies are correct.
- ✅ **No secrets leaked** in the web bundle — the only token present decodes to
  `role: anon` (public by design). No `service_role` key, no Anthropic key.

**The problems — your read-side leaks, and they're server-side (RLS), so they
can't be fixed in app code:**

| # | Severity | Issue |
|---|----------|-------|
| 1 | 🔴 **CRITICAL** | `live_checkins` exposes **real GPS coordinates** of users to anonymous callers |
| 2 | 🟠 MEDIUM | `profiles` read policy exposes **PII columns** (email, push_token, phone, emergency_contacts) to anon (empty in test data — latent leak) |
| 3 | 🟠 MEDIUM | Owner's **personal email is hardcoded** in the client bundle; admin gate is a client-side email match |
| 4 | 🟡 LOW | `follows` exposes the **entire social graph** (who-follows-whom) to anon |
| 5 | 🟡 LOW | `events` exposes `author_id` + exact `lat/lon/address` to anon (mostly expected for public events) |
| 6 | 🟡 MED (**FIXED in code**) | PostgREST `.or()` **filter injection** via search inputs |
| 7 | ⚠️ VERIFY | Admin RPCs (`admin_flag_user`, `admin_suspend_user`) must check caller role server-side |

---

## 1. 🔴 CRITICAL — Anonymous GPS location exposure (`live_checkins`)

A logged-out caller with the public anon key read real rows:

```
📍 user a1b2ea24… @ -25.9954945, 28.2023722
📍 user a1b2ea24… @ -25.9955,    28.2021224
```

These are exact physical coordinates (Pretoria/Gauteng, SA). This **defeats the
app's entire Ghost/Celebrity identity-privacy system** — all that location
fuzzing happens client-side, but the raw `lat`/`lon` sit in an anon-readable
table. Anyone can harvest where your users physically are. **Stalking / physical
safety risk.**

**Fix:** restrict `live_checkins` SELECT — at minimum block anonymous, ideally
serve locations only through the privacy-aware `get_safe_nearby_vibers` RPC and
revoke direct table reads. SQL in `scripts/security-rls-fixes.sql` (§1).

## 2. 🟠 MEDIUM — PII columns readable on `profiles`

All 26 profiles are anon-readable. The sensitive columns
(`email`, `push_token`, `phone`, `first_name`, `surname`, `emergency_contacts`,
`siblings`) are **selectable by anon** — currently empty in test data, so nothing
leaks *yet*, but the moment a real user fills them in, they're public.
`push_token` exposure also enables push-notification abuse.

**Fix:** RLS is row-level and can't hide columns — use a column-level
`REVOKE` (immediate) and/or a public profile **view** (proper). SQL §2.

## 3. 🟠 MEDIUM — Owner email hardcoded; client-side admin gate

`OWNER_EMAIL = 'asemahlenkwali@gmail.com'` is hardcoded in
`GodViewDashboard.js` and `AdminAIScreen.js` and **ships in the public web
bundle** — anyone can `view-source` and find the admin's real email (phishing /
account-takeover target). The God View / Admin gate is `user.email === OWNER_EMAIL`,
which only hides UI; the real boundary must be server-side.

**Fix (partly done in code):** added `src/hooks/useIsAdmin.js` — the admin UI
(God View + Admin AI) now gates on the **server `profiles.is_admin` flag**, with
the owner email kept only as a transitional bootstrap (so you're never locked
out before the column ships). The email is now in **one** place instead of two.
**Final step (you):** run §3 SQL, set your account `is_admin = true`, then delete
the `OWNER_EMAIL` line in `useIsAdmin.js` to fully remove the hardcoded email.
Also ensure admin RPCs re-check `is_admin` server-side (§7).

## 4. 🟡 LOW — Full social graph public (`follows`)

`follows` returned 45 rows to anon — the complete who-follows-whom graph is
enumerable logged-out. Common in some social apps, but enables scraping and
de-anonymisation. Consider requiring authentication (SQL §4).

## 5. 🟡 LOW — `events` author + precise location public

Public events expose `author_id` and exact `lat/lon/address`. Mostly expected,
but precise coordinates of private/secret events could be sensitive. Consider
rounding coordinates in a public view if needed.

## 6. 🟡 MEDIUM — PostgREST filter injection (**FIXED in code**)

Search boxes interpolated raw user text into PostgREST `.or()` filter strings,
e.g. `q.or(\`username.ilike.%${q}%,display_name.ilike.%${q}%\`)`. A value like
`x,is_admin.eq.true` or `x),or(...)` could inject extra filter conditions or
break out of the intended group (filter-logic manipulation; not full SQL
injection, since PostgREST still parameterises the SQL).

**Fixed:** added `src/utils/sanitize.js` (`sanitizeSearch`) which strips the
`.or()` grammar metacharacters (`, ( ) * \ % _ :`) and caps length, then routed
every user-search interpolation through it (`dataFlow.js`, `claudeService.js`,
`DiscoverPeopleScreen.js`). Normal/accented text still searches; injection
payloads are neutralised. The `${user.id}`-style interpolations were left as-is —
those are session UUIDs, not attacker-controlled.

## 7. ⚠️ VERIFY — Admin RPC role enforcement

`AdminAIScreen` suspends users with a tier-1 raw
`profiles.update(...).eq('id', victim)` then falls back to `admin_suspend_user`.
The raw update is only safe if the `profiles` UPDATE policy is strictly
own-row (`auth.uid() = id`) — verify it is (our anon write test was blocked,
which is consistent, but confirm an *authenticated* non-owner also can't update
another row). And confirm `admin_flag_user` / `admin_suspend_user` are
`SECURITY DEFINER` functions that check the caller is an admin **inside** the
function — otherwise any logged-in user could call them directly.

---

## What was fixed in this commit (client-side)
- `src/utils/sanitize.js` — `sanitizeSearch` / `isUuid`.
- Routed all user-search `.or()` interpolations through `sanitizeSearch`
  (finding #6).

## What you must apply server-side (cannot be done from app code)
Review and run `scripts/security-rls-fixes.sql` against your Supabase project
(**test on a branch / staging first** — RLS changes can lock out features).
That file addresses findings #1, #2, #4 and #5, with comments on each.

## Re-test anytime
```
node scripts/sec-probe.js            # live anon read/write/PII probe
node scripts/validate-schema.js      # schema + (with service key) RPC check
```
