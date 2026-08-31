# The Gruvs — Play Store: what could get it rejected or pulled

_Reviewed 2026-08-05 against the current `app.json` + Google Play policy. Ranked by how likely
it is to block/remove the app. 🔴 = very likely rejection, 🟠 = common rejection, 🟡 = watch._

This is a **social + location + user-generated-content + nightlife (18+)** app. Google reviews
those categories hard. The three that sink apps like this: **background location**, **UGC
moderation**, and **account deletion**. Get those right and most of the rest is paperwork.

---

## 🔴 0. Android developer verification — hard deadline Sep 30, 2026 (NEW, found 2026-08-31)
Google emailed a **"[Final reminder]"** on 2026-08-31: every Play app's package name + signing
key must be registered to a **verified developer identity** by **September 30, 2026**, or the
app is **removed from Google Play globally**. This is a platform-wide policy (not specific to
The Gruvs) and wasn't in this doc's 2026-08-05 pass because it's a new requirement.
- Google says >99% of apps were auto-registered, and identity verification already succeeded
  for this account (a separate "Your identity has been verified" email, 2026-08-11) — but
  **auto-registration and app-registration are two different steps**. Confirm the actual app is
  registered, not just the developer identity.
- **Do (user-only — needs Play Console login):** open **Play Console → Android developer
  verification** and confirm The Gruvs' package name (`com.thegruvs.app`) shows as
  **Registered**, not a draft or unregistered status. If any signing key is used to sign builds
  outside of Play (e.g. a local upload key for side-loaded APKs), register that key too.
  This cannot be checked or fixed from the codebase — it's an account-level Play Console action.

## 🔴 1. Background location permission
`app.json` configures `expo-location` with `locationAlwaysAndWhenInUsePermission` ("Always").
That wording can make the plugin request **ACCESS_BACKGROUND_LOCATION**. Google treats background
location as a **restricted permission**: it needs a special Play Console declaration, a
demonstrable core feature that _requires_ it, a prominent in-app disclosure, and often a review
video — and it's **rejected by default** if the feature doesn't truly need it.
The Gruvs uses **deliberate, one-shot foreground location only** (never ambient tracking), so it
should request **when-in-use only** and declare **no** background location.
- **Fix:** change the plugin string to `locationWhenInUsePermission` (done in the paired commit),
  keep `ACCESS_BACKGROUND_LOCATION` out of `android.permissions`, and in Data Safety mark location
  as "used in-app, not shared, not for tracking."

## 🔴 2. User-generated content: moderation is mandatory
Google's UGC policy requires social apps to ship **all** of: (a) in-app **reporting** of content
and users, (b) **blocking** users, (c) a way to **moderate/remove** content + repeat offenders,
and (d) an **EULA/terms** that prohibits objectionable content and harassment. Missing any one is
a standard rejection for social apps.
- **Have:** report + block flows and moderation engine exist in-code (ReportModal, block/ghost,
  trust-weighted auto-hide).
- **Do:** make sure **report + block are reachable on every UGC surface** (profiles, events, DMs,
  reels, map reports, chat), and that a **Terms/EULA link** is visible in-app and on the listing.
  Have a takedown path and a contact email. Document your moderation process for the review notes.

## 🔴 3. Account deletion (in-app + a public web URL)
Google requires account-based apps to let users **delete their account from inside the app** AND
provide a **publicly reachable deletion URL** (no login required to find it), and to delete/anonymise
associated data. The deletion pipeline is live in-DB — the gaps to close:
- **Do:** confirm the in-app "Delete my account" entry point works end-to-end, and publish a
  `https://thegruvs.com/delete-account` (or similar) page describing what's deleted/retained.
  Put that URL in the Play Console "Data deletion" field.

## 🟠 4. Privacy Policy + Data Safety form accuracy
- **Have:** `privacyPolicyUrl = https://thegruvs.com/privacy.html`.
- **Do:** verify that page is **live, reachable, and specific** (names the data: email, DOB,
  precise location, photos, messages, contacts if any; who it's shared with; retention; deletion).
  The **Data Safety form must match the code** — mismatches are a top rejection/removal cause.
  Declare: personal info (email/DOB), location (precise), photos/videos, messages, app activity;
  encrypted in transit (yes, HTTPS/TLS); deletion available (yes). Declare data **not sold**.

## 🟠 5. Permissions — declare only what you use, justify the sensitive ones
Currently declared: FINE/COARSE location, CAMERA, READ_MEDIA_IMAGES/VIDEO, RECORD_AUDIO,
MODIFY_AUDIO_SETTINGS, VIBRATE, RECEIVE_BOOT_COMPLETED.
- **RECORD_AUDIO / CAMERA** — justified by calls + posting media; fine, but each needs a runtime
  rationale and a Data Safety entry.
- **RECEIVE_BOOT_COMPLETED** — only defensible if used for scheduled notifications; if not used,
  **remove it** (unused sensitive-ish permissions draw scrutiny).
- **READ_MEDIA_VIDEO/IMAGES** — fine on Android 13+; ensure you're not also requesting legacy
  `READ_EXTERNAL_STORAGE`. Prefer the photo picker where possible.
- **Rule:** every permission must map to a visible feature the reviewer can reach.

## 🟠 6. Content rating + target audience (18+ / alcohol / social)
Nightlife with alcohol context and social "vibers" → **must complete the content-rating
questionnaire honestly** (references to alcohol, user interaction, sharing location, mature
themes). Set **target age to adults (18+)**; do **not** mark it as appealing to children (that
triggers Families policy and stricter data rules). Under-18 gating already exists in signup —
keep the age gate enforced server-side.

## 🟠 7. "Minimum functionality" — ship the native build, not a web wrapper
Google rejects apps that are just a **WebView/TWA wrapper** of a website. The Gruvs is a real
Expo/React-Native app (native), so it qualifies — **as long as you upload the EAS native build**
(AAB), not a webview shell pointing at thegruvs.com. Don't submit the `.apk` that's served for
side-loading as the Play artifact; submit the **signed AAB from EAS**.

## 🟡 8. Target API level & signing
- **Do:** build against a **current target SDK** (Google requires new apps/updates to target a
  recent API level — keep Expo SDK up to date so `targetSdkVersion` meets the current-year bar).
- **Do:** use **Play App Signing**; keep the upload key safe. `versionCode` must increase each
  upload (currently 3).

## 🟡 9. Reviewer access (login-walled app)
The app requires login. Google reviewers will **reject if they can't get in**. Provide **test
credentials** (a demo account) in the Play Console "App access" section, or a guest mode that
shows real functionality.

## 🟡 10. Deceptive behavior / impersonation / real venues
- Listing metadata, screenshots, and description must reflect the actual app (no keyword spam,
  no fake "download" buttons). Screenshots must be from the real app.
- Your handle-impersonation guard helps prevent users trading on real venue names — keep it.

## 🟡 11. Ads ID & tracking
- If you ship **no ads SDK**, declare **no advertising ID** in the Console; if you add analytics/
  ads later, add the `com.google.android.gms.permission.AD_ID` declaration and update Data Safety.

## 🟡 12. Payments
- You currently **handle no money** (broker-only) — good, that avoids Play Billing obligations.
  If premium/IAP is added later, digital goods **must** use Google Play Billing (external payment
  for digital goods = removal). Off-platform physical services (a room, a gig) are exempt.

---

## Pre-submission checklist (fastest path to approval)
- [ ] 🔴 Location = **when-in-use only**; no background location; Data Safety matches.
- [ ] 🔴 Report + Block reachable on every UGC surface; Terms/EULA linked in-app + listing.
- [ ] 🔴 In-app account deletion works + public `/delete-account` URL set in Console.
- [ ] 🟠 Privacy policy live + specific; Data Safety form matches the code.
- [ ] 🟠 Remove any unused permission (esp. `RECEIVE_BOOT_COMPLETED` if unused).
- [ ] 🟠 Content rating completed honestly; audience = 18+.
- [ ] 🟠 Upload the **signed EAS AAB** (native), not a web wrapper / side-load APK.
- [ ] 🟡 Provide reviewer demo credentials in "App access".
- [ ] 🟡 Target a current API level; Play App Signing on; versionCode bumped.
- [ ] 🟡 Declare advertising ID correctly (none, for now).

The two that most often surprise founders: **background location** (fixed here) and **account
deletion URL**. Nail the 🔴s and you're in good shape.
