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

---

# Round 2 (2026-06-03) — code-side hardening + threat-model mapping

Three new findings beyond the original 7. The code-side ones are fixed in this
commit; the rest need your Supabase/Vercel.

## 8. 🔴 CRITICAL — Spotify **client secret** ships in the bundle
`src/services/musicService.js` runs the Spotify *Client Credentials* flow in the
client using `EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET`. **Every `EXPO_PUBLIC_*` var is
compiled into the public web/app bundle**, so the secret is extractable by
anyone. (The original audit only checked for the Supabase service_role + Anthropic
keys, which are correctly absent — this one slipped through.)
**Fix (you):** rotate the secret now; move the token exchange into a Supabase
**Edge Function** that holds the secret server-side and returns only the
short-lived access token; point the client at that function. Also restrict the
`EXPO_PUBLIC_YOUTUBE_API_KEY` by HTTP-referrer + API in the Google console.
A warning is now in `musicService.js` at the call site.

## 9. 🟠 → ✅ Unsafe-scheme link opening (hardened in code)
`Linking.openURL()` on app-constructed links (maps from coords, music URLs)
didn't validate the scheme. Added `safeOpenExternal()` to `src/utils/sanitize.js`
— allows only `http/https/mailto/tel` (blocks `javascript:`, `data:`, `file:`,
`intent:`, `blob:` which can run code / read local files, esp. on web) while
allowing any host (users share arbitrary legit links). Routed the music-link
opener through it; the helper is ready for any future "linkify user text" feature.
Note: no current screen opens a *raw user-typed* URL — messages/captions render as
plain RN `<Text>`, which can't execute links (so **no stored/reflected XSS sink**).

## 10. 🟠 → ✅ Missing web security headers (added to `vercel.json`)
The web deploy sent no security headers. Added for `/(.*)`:
`Strict-Transport-Security` (HSTS — blocks **SSL/TLS stripping**),
`X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` (blocks **clickjacking /
UI-redress**), `X-Content-Type-Options: nosniff` (blocks **MIME confusion**),
`Referrer-Policy` (limits referrer leakage), `Permissions-Policy` (locks down
USB/Bluetooth; allows geolocation/camera/mic/payment the app uses). A full
script/connect CSP was deliberately *not* added yet — it needs a runtime pass to
enumerate allowed origins (Supabase, open-meteo, open.er-api, Spotify, YouTube)
without breaking the Expo web runtime.

## Dependency audit (supply chain)
`npm audit` reports 29 issues (14 high / 14 moderate / 1 low) — almost all in
**Expo build/CLI tooling** (`@expo/bunyan`, `xcode`, `ws`, `@expo/rudder-sdk-node`),
i.e. build-time, not shipped to users. Run `npm audit fix` (safe subset); avoid
`--force` without testing — it can break the SDK 51 build.

## Threat-model applicability (vs the broad attack list)
This is a **React Native/Expo client + Supabase (managed Postgres/Auth/Storage)
+ Vercel static hosting**. There is **no server, OS, Active Directory, Kubernetes,
SCADA/OT, or datacenter of yours** to attack, so whole categories don't apply.

| Category | Applies? | Status |
|---|---|---|
| XSS (stored/reflected/DOM) | Partly (web) | ✅ No HTML sinks; RN `<Text>` auto-escapes; no `dangerouslySetInnerHTML`/`eval` |
| SQL/NoSQL/filter injection | Yes | ✅ Supabase parameterises; PostgREST `.or()` injection fixed (`sanitizeSearch`) |
| IDOR / BOLA / BFLA | Yes | ⚠️ = server-side RLS (findings #1–#5, #7) — run `security-rls-fixes.sql` |
| Clickjacking / UI-redress | Yes (web) | ✅ X-Frame-Options + CSP frame-ancestors |
| CSRF | Low | ✅ Auth is JWT in `Authorization` header, not cookies |
| SSL/TLS stripping | Yes (web) | ✅ HSTS |
| Open redirect / scheme abuse | Yes | ✅ `safeOpenURL` / `safeOpenExternal` |
| Secrets in client | Yes | 🔴 Spotify secret (#8); ✅ no service_role/Anthropic key |
| Quishing (malicious QR) | Yes | ✅ QR scanner only accepts ticket-prefixed payloads, never opens URLs |
| Credential stuffing / brute force / MFA fatigue | Yes | ⚠️ Supabase Auth side — enable rate-limits + leaked-password protection in the dashboard |
| Supply chain (deps/typosquat) | Yes | ⚠️ `npm audit` (build-time); review lockfile |
| DoS / ReDoS / zip-bomb | Yes | ✅ upload type+size caps; search regex is linear; file size capped |
| AI prompt injection | Yes | ⚠️ `claudeService` builds prompts from user data — treat model output as untrusted, never auto-execute |
| Phishing / vishing / BEC / SIM-swap / social eng. | Yes | 👤 People-process, not app code — needs a staff/user policy + the admin-email cleanup (#3) |
| DDoS (network/amplification) | N/A to app code | Vercel + Supabase absorb at the edge |
| Malware / ransomware / rootkits / LotL | N/A | No server/endpoint you operate |
| Kerberos/AD, K8s, cloud-IAM, SCADA/OT, hardware/IoT, BGP/DNS infra | N/A | No such infrastructure in this stack |

---

# Round 2 — build-pipeline & server-side review (2026-08-27)

Scope: CI/CD workflows, Supabase Edge Functions, nginx config, and the client
code paths the round-1 fixes touched. Every finding below was reproduced before
being fixed; the verification command is given with each.

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 11 | 🔴 HIGH | Secret scanning **had never run** — wrong gitleaks subcommand, silently swallowed | ✅ Fixed + now blocking |
| 12 | 🟠 MEDIUM | Spotify **client secret** injected into every build as an `EXPO_PUBLIC_*` var | ✅ Removed from all 6 workflows |
| 13 | 🟠 MEDIUM | `spotify-token` built its auth client with the **service_role** key | ✅ Now anon key + explicit JWT |
| 14 | 🟠 MEDIUM | `.mcp.json` tracked in git with a **Supabase PAT** slot; `.gitignore` was inert | ✅ Untracked, `.example` added |
| 15 | 🟠 MEDIUM | nginx `/thegruvs.apk` dropped **every** security header | ✅ Headers restated |
| 16 | 🟡 LOW | Edge Functions pinned to a **floating** `npm:@supabase/supabase-js` | ✅ Pinned to `@2.58.0` |
| 17 | 🟡 LOW | `push-notify` compared the service key with non-constant-time `!==` | ✅ `timingSafeEqual` |
| 18 | 🟡 LOW | `spotify-token` echoed internal/upstream error text to callers | ✅ Logged server-side only |
| 19 | 🐛 BUG | `isSpotifyConfigured()` threw `ReferenceError` (fallout of the #8 fix) | ✅ Fixed |
| 20 | 🔴 HIGH | `og-meta` share links bypassed the **auto-hide moderation system** entirely | ✅ Fixed + regression test |
| 21 | 🟠 MEDIUM | CI's `service_role` lacked `BYPASSRLS`, so it modelled the opposite of production | ✅ Fixed |

## 11. 🔴 HIGH — the secret scanner never actually ran

`.github/workflows/security.yml` invoked `gitleaks dir . --config ...`. The
`dir` subcommand does not exist in gitleaks **8.18.4** (the version the workflow
pins) — it was added in a later release. So every run did this:

```
Error: unknown command "dir" for "gitleaks"
```

…and the trailing `|| true` swallowed the failure, after which the job printed
"Secret scan complete" and went green. The repo has had secret scanning in name
only since it was added — a real committed credential would not have been caught.

**Fixed:** use the subcommand that exists in 8.18.4 (`detect --no-git --source .`),
drop `|| true`, and set `--exit-code 1` so a finding fails the build. Also runs on
all branches now, not just `main`.

Verified both directions on this tree:

```
# clean tree
$ gitleaks detect --no-git --source . --config .gitleaks.toml --exit-code 1
INF no leaks found                                    → exit 0

# with a service_role-shaped JWT planted in a source file
$ gitleaks detect --no-git --source . --config .gitleaks.toml --exit-code 1
WRN leaks found: 1                                    → exit 1
```

The two findings on the real tree were both public-by-design and are now
allowlisted in `.gitleaks.toml`: the **VAPID public key** (`src/constants/webPush.js`
— it is handed to `PushManager.subscribe()`, so it is meant to be in the client)
and the token-shaped **fixtures in `__tests__/log.test.js`** (that test asserts the
logger *scrubs* tokens, so it has to contain token-shaped strings). The VAPID
**private** key is deliberately not allowlisted.

## 12. 🟠 MEDIUM — Spotify client secret plumbed through every build

Six workflows passed `EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET` into the build env
(`ci.yml`, `web-deploy.yml`, `deploy.yml`, `eas-preview.yml`, `eas-production.yml`,
`eas-update.yml` — 8 references). `.env.example` in this very repo says never to
do that, because every `EXPO_PUBLIC_*` var is inlined into the public bundle.

**Measured, so the record is accurate:** a canary build with
`EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET=CANARY_…` set showed the value does **not**
reach `dist/` today — Metro only inlines a var some source file actually
references, and the last reference was removed in `92f2959`. So this was a
**latent footgun, not an active leak**: one `process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET`
added back anywhere in `src/` would have silently shipped a live credential to
production. The real secret belongs only on the `spotify-token` Edge Function.

**Fixed:** removed from all six workflows; `.github/CICD_SETUP.md` now states the
rule and marks the remaining vars as public-by-design. **Action for the owner:**
delete `EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET` from the repo's Actions secrets and
rotate the secret in the Spotify dashboard.

## 13. 🟠 MEDIUM — `spotify-token` verified callers with a service_role client

```ts
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {   // service_role!
  global: { headers: { Authorization: authHeader } },        // caller-controlled
});
const { data: { user } } = await supabase.auth.getUser();    // no explicit JWT
```

Pairing the **service_role** key with a caller-supplied `Authorization` header is
a privilege-escalation footgun. It happens to verify correctly on current
supabase-js (which honours a custom auth header), but the failure mode is
maximally bad: any refactor, or a change in how that fallback works, turns a
failed verification into a fully privileged client. `delete-account` already got
this right — it uses the anon key.

**Fixed:** anon key for the verification client, and the JWT is passed explicitly
to `getUser(jwt)` so a missing/invalid token fails closed. Also now rejects
non-POST, returns generic errors (#18), and returns only `access_token` /
`expires_in` rather than the whole upstream payload.

## 14. 🟠 MEDIUM — `.mcp.json` tracked despite being in `.gitignore`

`.gitignore` lists `.mcp.json`, but the file was already tracked (`92f2959`) —
and `.gitignore` has no effect on an already-tracked file. The file is the
designated slot for a **Supabase Personal Access Token**, which is a
full-account credential, far stronger than the service_role key.

History is clean: every committed revision holds only the
`YOUR_SUPABASE_PAT_HERE` placeholder, so **nothing leaked**. But the ignore rule
gave false confidence — filling the token in locally and running `git add -A`
would have committed it.

**Fixed:** `git rm --cached .mcp.json` (file kept on disk), with
`.mcp.json.example` committed as the template. Finding #11 is the backstop:
gitleaks would now actually catch such a token.

## 15. 🟠 MEDIUM — nginx served the APK with no security headers

nginx inherits `add_header` from an outer block **only when the current block
defines none**. `location = /thegruvs.apk` defines `Content-Disposition`, so all
seven server-level headers (CSP, HSTS, `nosniff`, `X-Frame-Options`,
`Referrer-Policy`, `Permissions-Policy`, `X-XSS-Protection`) were dropped for the
APK download. The config's own comment states this exact invariant — the asset
locations were written to respect it, and this one location broke it.

**Fixed:** the security headers are restated inside that location, with a
`default-src 'none'` CSP (nothing is rendered from a binary download).

Also strengthened HSTS at the server level: `max-age=31536000` →
`max-age=63072000; includeSubDomains`. Without `includeSubDomains` a subdomain
can still be MITM'd over plain HTTP and set a cookie the apex origin reads; two
years is also the minimum the HSTS preload list requires.

## 19. 🐛 `isSpotifyConfigured()` threw on every call

Commit `92f2959` removed `const SPOTIFY_SECRET = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET`
(the correct fix for #8) but left the identifier referenced:

```js
isSpotifyConfigured: () => !!(SPOTIFY_ID && SPOTIFY_SECRET),   // ReferenceError
```

`EventPlaylistSection.js:31` calls it during render, so the event-playlist UI hit
`ReferenceError: SPOTIFY_SECRET is not defined` every time it mounted. Reproduced
directly. **Fixed:** the check is now `SPOTIFY_ID && isSupabaseEnabled`, which is
what "configured" actually means once the token comes from the Edge Function.

## 20. 🔴 HIGH — share links bypassed the entire auto-hide moderation system

`og-meta` is public (no JWT) and reads with the **service_role** key. service_role
is `BYPASSRLS`, so it skips the four RESTRICTIVE policies in `schema_part_4.sql`
that take reported content out of public view once ~3 trusted reports land
(`events.auto_hidden`, `reels.auto_hidden`, `echoes.auto_hidden`,
`profiles.is_auto_hidden`).

None of the three handlers re-applied that rule:

| Handler | Filtered | Missing |
|---|---|---|
| `handleEvent` | `is_published`, `deleted_at` | `auto_hidden` |
| `handleReel` | `is_deleted` | `auto_hidden` |
| `handleProfile` | *(nothing at all)* | `is_auto_hidden` |

So the content most likely to be reported — an abusive profile, a harmful event,
a reported reel — kept serving a full rich preview (name, bio, avatar, cover
image, stats) from `/functions/v1/og-meta/...` to anyone with the link, and to
WhatsApp / X / Facebook / Telegram crawlers, which then **cache and redistribute**
it. Moderating the content in-app did nothing to the share card.

`handleEvent` even carries the comment *"service_role bypasses RLS, so filter
explicitly"* — the reasoning was right there, applied to two flags and not to the
one that matters most for abuse.

**Reproduced on a local Postgres** modelling the live roles:

```
anon         → cleanuser
service_role → cleanuser, reporteduser     ← the auto-hidden profile
```

**Fixed:** all three handlers now apply `COALESCE(<flag>, false) = false` (the
policy's own semantics, so a NULL flag still counts as visible), via a shared
`notHidden()` helper, with a header comment on the client explaining why every
query in that file has to do this by hand.

**Regression test added** — `supabase/test/rls_autohide_test.sql`, wired into
DB Schema CI. It asserts each policy still exists, is still `RESTRICTIVE` (a
PERMISSIVE one would be worse than none — permissive policies are OR'd, so it
would *widen* access), and still gates on the right column; then proves the
behaviour end-to-end on a throwaway table. It refuses to pass vacuously if the
tables are missing. Verified it fails on each real breakage:

| Broken control | Result |
|---|---|
| a policy dropped | ✅ fails |
| policy recreated PERMISSIVE | ✅ fails |
| `service_role` loses BYPASSRLS | ✅ fails |
| all restored | ✅ passes |

## 21. 🟠 MEDIUM — CI modelled `service_role` incorrectly

`supabase/test/bootstrap.sql` created `service_role` as plain `NOLOGIN`. In
production Supabase it is `NOLOGIN BYPASSRLS`. CI therefore modelled a
service_role that RLS still applies to — the **opposite** of live behaviour — so
an RLS test there could pass while the real Edge Functions sail straight through
the same policy. That is precisely the gap that let #20 exist unnoticed.

**Fixed:** `CREATE ROLE service_role NOLOGIN BYPASSRLS`, plus an idempotent
`ALTER ROLE` for pre-existing roles. Finding #20's test asserts this and fails
loudly if the environment stops modelling production.

## Still open (server-side / owner action)

These need the Supabase dashboard or a SQL run — they cannot be fixed in this repo:

- **Findings #1–#5, #7** from round 1 — run `scripts/security-rls-fixes.sql`.
  The GPS exposure on `live_checkins` (#1) is still the highest-severity item.
- **Rotate the Spotify client secret** and remove
  `EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET` from the repo's Actions secrets (#12).
- **Dependency vulnerabilities**: `npm audit` reports 29 (1 critical, 23 high),
  effectively all in the Expo/Metro **build toolchain** (`tar`, `cacache`,
  `metro`, `@expo/cli`) rather than in shipped app code. Clearing them means an
  Expo SDK 52 → 57 major upgrade, which is a separate, breaking piece of work —
  deliberately not attempted here. Dependabot PRs #25/#26 cover part of it.
