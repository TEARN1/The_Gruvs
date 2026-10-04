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

---

# Security check — database privileges, PII and storage (2026-10-04)

Second pass, focused on what the first pass did not cover: the ~250 `SECURITY DEFINER`
functions any signed-in user can call, column-level PII exposure, and storage permissions.
**Nothing was changed.** Every function below was confirmed by reading its body, not inferred
from its name. Every Supabase function is callable at `/rest/v1/rpc/<name>` by anyone with the
public anon key and a free account, so "the app doesn't call it" does not reduce exposure.

## Critical — anyone can forge balances and trust scores

These run with owner privileges, take a user id as a parameter, and never check that the caller
*is* that user (no `auth.uid()`, no admin check):

| Function | What any signed-in user can do | App uses it? |
|---|---|---|
| `increment_wallet_balance(p_user_id, p_amount)` | Add or subtract any amount on **any** user's `wallet_balance` | Call at `escrowService.js:106` is already broken (wrong parameter names) |
| `update_sis_score(p_user_id, p_delta)` | Set any user's `social_integrity_score` anywhere in 0–100 — the trust score behind trust gates and trust-weighted moderation | Call at `trustLedger.js:108` is already broken (wrong parameter names) |
| `verify_pop(p_event_id, p_user_id)` | +200 XP and +50 points to anyone, unlimited repeats | No |
| `release_escrow(p_transaction_id, p_user_id)` | Release **anyone's** escrow by passing the sender's id — the "only the customer" check compares against the caller-supplied id | No |

Because both app call sites are already broken, **revoking `EXECUTE` on all four breaks nothing
that works today.**

## High

- **`get_crossed_paths(p_user_id)` returns any user's crossed paths:** who they have been at
  events with, the venue names, and when. Pass a victim's id and you get a partial location
  history. In a nightlife app built around safety, that is a stalking vector. The app only
  ever passes the caller's own id (`dataFlow.js:2013`), so requiring
  `p_user_id = auth.uid()` breaks nothing.
- **Precise location and date of birth are readable by every signed-in user.** `profiles.coords`
  is a `geography` stored at 7–13 decimal places (millimetre precision), set for **7 of 40
  users**; `birth_date` is set for 1. `SELECT` on both columns is granted to `authenticated`
  despite the earlier `lock_profile_coordinates` migration.
  - `coords`: the client never selects it (only definer functions use it) — revoking is safe.
  - `birth_date`: `ViberProfileModal.js:319` reads it for *other* users, so that path needs an
    age-only helper before the grant can go.
- **`purchase_tickets` and `place_bid` act as any user** (caller-supplied `p_user_id`). Unused by
  the app — revoke.

## Medium

- **Acting on another user's behalf:** `increment_vibe`, `increment_vibe_count`,
  `decrement_vibe`, `decrement_vibe_count`, `record_daily_activity` accept any user id. The used
  ones need an `auth.uid()` check; the unused ones can be revoked.
- **Reading or changing another user's notification state and feed:** `mark_notifications_read`,
  `get_unread_notification_count`, `feed_for_user`. Unused — revoke.
- **DM images can't be read by the recipient.** `chat_media` `SELECT` is limited to the
  uploader's own folder, so a recipient cannot load an image sent to them. It fails safe, so it
  is not a leak — it is a broken feature that needs a participant-scoped read policy.

## Confirmed safe on this pass

- **Storage writes:** every bucket only accepts uploads into the caller's own `uid/` folder;
  update and delete are owner-scoped.
- **No `USING (true)` write policies** on any public table.
- **Moderation hiding works:** the `*_hide_autohidden` policies on profiles, events and reels
  are `RESTRICTIVE`, so they hold even next to `USING (true)` read policies.
- **`set_user_role`** is protected by `assert_admin()` (flagged by the scan; cleared on reading).

## Recommended fix — one migration, no app changes required

1. `REVOKE EXECUTE … FROM anon, authenticated` on: `increment_wallet_balance`,
   `update_sis_score`, `verify_pop`, `release_escrow`, `purchase_tickets`, `place_bid`,
   `increment_vibe`, `decrement_vibe`, `mark_notifications_read`,
   `get_unread_notification_count`, `feed_for_user`.
   Owner-run (definer) callers are unaffected by the revoke.
2. Add `IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'forbidden'` to
   `get_crossed_paths`, `increment_vibe_count`, `decrement_vibe_count`,
   `record_daily_activity`.
3. `REVOKE SELECT (coords) ON public.profiles FROM anon, authenticated`.

Follow-ups that need app code: an age-only helper for `birth_date`; a participant-scoped
`chat_media` read policy; and fixing the two broken client calls if wallet and trust-score
updates are meant to work (they must run server-side, not from the client).
