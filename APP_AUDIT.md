# The Gruvs — Application Audit

_2026-10-04 · branch `claude/app-system-design-progress-pdqrz0` @ `df3f54b` · live project
`feevvddvrjmfbhffccbf`. Covers the client, all 5 Edge Functions, storage, dependencies, and
the database paths those touch. Complements `SYSTEM_DESIGN.md` (architecture) and
`DB_BASELINE.md` (schema/advisor audit); does not repeat them._

Every finding below was verified against code or the live database, and each says how
exposed it is **today**, not just in principle. Nothing in this audit was changed.

## Summary

| # | Finding | Severity | Exposed today? |
|---|---|---|---|
| 1 | Account deletion leaves user data behind | **High** | Yes, on every deletion |
| 2 | Native push is not wired — `push-notify` never fires | **High** | Yes |
| 3 | Any user can send any user a notification, including blocked users | **High** | In-app now; lock-screen once #2 is wired |
| 4 | `og-meta` share previews ignore moderation, deletion and reel visibility | Medium | Latent (0 affected rows) |
| 5 | Per-app display names are readable across apps | Medium | Latent (0 users differ) |
| 6–11 | Hygiene: deps, rate limits, committed build output | Low | — |

**Fix order matters: #3 before #2.** Wiring push first would turn notification injection into
arbitrary text on any user's lock screen.

---

## High

### 1. Account deletion leaves user data behind
`supabase/functions/delete-account/index.ts`

Two independent defects, both in the path Google Play and POPIA require to actually delete:

- **The purge result is never checked (line 67).** `await admin.rpc('purge_user_data', …)`
  discards the `{ error }` that supabase-js returns — it does not throw. If the purge fails,
  the function still deletes the login and returns `{ deleted: true }`. Rows that are not
  `ON DELETE CASCADE` from `auth.users` keep their personal data after the user was told it
  was gone.
- **Two of eight live buckets are missing from `BUCKETS` (line 23).** The function cleans
  `avatars, covers, event-media, moments, reels, chat_media`. The live project also has
  **`gossip-media`** (5 objects) and **`stories`** (2 objects). Both are public, so a deleted
  user's gossip media and stories stay reachable by URL indefinitely.

Verified: `purge_user_data` exists; all 12 upload call sites prefix paths with the user id, so
the storage sweep's `${uid}/` convention is otherwise correct.

**Fix:** `const { error: purgeErr } = await admin.rpc(…); if (purgeErr) throw purgeErr;` and
add the two buckets — better, list buckets at runtime with `admin.storage.listBuckets()` so a
new bucket can never be missed again. Redeploy the function.

### 2. Native push is not wired — `push-notify` never fires
`push-notify` is designed to run from a Database Webhook on `notifications` INSERT. A
Supabase webhook is a trigger, and **`notifications` has no triggers at all**. No function in
the database references `push-notify`; the only HTTP-calling functions belong to The Resident.

Consequence: notifications are written and show in-app, but nothing is delivered to a
backgrounded or closed native app. `src/services/webrtcCall.js:63` explicitly relies on "the
existing push-notify pipeline" to ring the callee — so **incoming calls do not ring** a phone
whose app is not open. Same for DMs, check-ins, and event-day alerts.

**Fix:** Dashboard → Database → Webhooks → `notifications` / INSERT → `push-notify`, with
`Authorization: Bearer <service_role>` — **only after #3 is fixed.**

### 3. Any user can send any user a notification, including blocked users
Live policy `notifs_insert`:
`WITH CHECK (auth.role()='service_role' OR actor_id = auth.uid() OR recipient_id = auth.uid())`

Setting `actor_id` to yourself satisfies it for **any** `recipient_id`, with attacker-chosen
`title`, `body` and `data`. There is no rate limit (no trigger on the table) and no block-list
check, so a blocked user can keep messaging the person who blocked them. For a nightlife app
with a safety mission, that is a harassment channel.

Bounded today: notification `data` is never passed to `Linking.openURL`, so injected
notifications cannot redirect anyone. Once #2 is wired, the text lands on the lock screen.

Not a one-line policy fix: the client inserts notifications directly from 5 places
(`EditEventModal.js:296`, `broadcast.js:77`, `notificationService.js:197`, `dataFlow.js:2652`,
`PathMapScreen.js:851`). Restricting `recipient_id` would break those features.

**Fix:** a `SECURITY DEFINER` `send_notification()` RPC that enforces the block list, a
relationship check appropriate to each `type`, and a per-sender rate limit; migrate the 5 call
sites; then drop the `actor_id = auth.uid()` branch from the policy.

---

## Medium

### 4. `og-meta` share previews ignore moderation, deletion and visibility
`supabase/functions/og-meta/index.ts` uses the `service_role` key, which bypasses RLS, so its
own filters are the only protection. They are incomplete:

| Route | Filters present | Missing |
|---|---|---|
| `/event/<id>` | `is_published`, `deleted_at` | `is_hidden`, `auto_hidden`, `is_deleted` |
| `/profile/<username>` | none | `deleted_at`, `is_auto_hidden` |
| `/reel/<id>` | `is_deleted` | `visibility = 'public'`, `is_hidden`, `auto_hidden`, `deleted_at` |

The crawler branch is reachable by anyone who sets a crawler User-Agent
(`curl -A facebookexternalhit …`). For reels it returns `media_url` — the video itself.

Latent: today all 10 reels are `public` and no event, reel or profile is hidden, auto-hidden or
deleted. It becomes a leak the first time moderation acts. A profile lookup on a missing
username also confirms non-existence, a minor enumeration oracle.

**Fix:** add the missing `.eq/.is` filters (≈6 lines).

### 5. Per-app display names are readable across apps
The `x-app-id` work partitions display name and bio per app (`app_user_profiles`, 3 apps ×
40 users). But the table's `public read` policy is `USING (true)` for `anon` and
`authenticated`, and `get_app_profile(p_user_id, p_app_id)` is anon-callable with any app id.
Anyone can map a user's identity in The Gruvs to their identity in The Resident — a
neighbourhood app with legal-name verification.

Writes are safe: insert and update are owner-checked and `(user_id, app_id)` is unique, so no
one can set another user's name. Latent: 0 users currently have different names across apps.

**Decision needed:** if per-app personas are meant to be private from each other, replace the
`USING (true)` policy with one scoped to `current_app_id()` and validate `p_app_id` in
`get_app_profile`. If cross-app visibility is acceptable, document it so nobody builds on the
assumption that it is private.

---

## Low

6. **`maplibre-gl` 4.7.1 has a critical XSS advisory** (sanitizer bypass). Not reachable: the
   app never calls `setHTML`/`setDOMContent`. Upgrade on the next dependency pass.
7. **`npm audit --omit=dev` reports 78 advisories (2 critical, 63 high)** — almost all
   build-time (jest, metro, expo-cli, tar) and never shipped. They count as production because
   `jest`, `jest-expo`, `typescript` and `@types/react` sit in `dependencies`. Move them to
   `devDependencies`; then audit what is left.
8. **`spotify-token` has no rate limit** — any signed-in user can drive the app's Spotify
   client-credentials quota until Spotify throttles the whole app. It also echoes internal
   error messages to the client.
9. **`dist-p3/` (29 build files) is committed.** Stale output that can mislead anyone grepping
   the repo; add to `.gitignore` and remove.
10. **`google-services.json` carries a Firebase API key.** Public by design on Android, but
    confirm in Google Cloud that it is restricted to package `com.thegruvs.app`.
11. **`ClubCreateModal.js:59` and `MealComposeModal.js:60` build paths from `user?.id`.** If the
    user is null the file lands under `undefined/…`, outside the deletion sweep.

Known from earlier: `__tests__/currency.test.js:44` is stale after the global-currency change
(ZAR vs USD default — a product call).

---

## Verified clean

- **No secrets in the repo or build output.** The committed JWTs in `eas.json` decode to
  `role: anon`; no `service_role`, Spotify secret or private key anywhere tracked.
- **No XSS sinks** in client or web code (`dangerouslySetInnerHTML`, `innerHTML`, `eval`).
- **`sso-redeem`** is well built: atomic single-use claim, 60-second expiry, audience-bound.
- **`push-notify`** correctly requires the service-role bearer token.
- **`delete-account` and `spotify-token`** derive identity from the caller's JWT, never the body.
- **Storage paths** are user-id-prefixed at all 12 upload sites.
- **Lint** clean; **unit tests** 1002/1003.
