# STORE_SUBMISSION.md — Play Store & App Store submission pack

Everything needed to submit The Gruvs, with the console answers **derived from
the actual codebase** (not guessed). Inaccurate Data Safety / App Privacy
answers are a top cause of apps being rejected or pulled — these are honest.

App: **The Gruvs** · `com.thegruvs.app` · v1.1.0
EAS project: `3a2292ca-e3ad-4741-85ce-5b9b859b1fb6` · owner `tearn`

---

## 0. Pre-flight status

| Requirement | Status |
|---|---|
| Privacy policy URL | ✅ https://thegruvs.com/privacy.html |
| Terms URL | ✅ https://thegruvs.com/terms.html |
| **Account deletion** (Play *requires* an in-app + web path) | ✅ in-app Settings → Delete account + https://thegruvs.com/account-deletion.html, backed by `delete-account` edge fn + `purge_user_data()` |
| Android FCM (push) | ✅ `google-services.json` present |
| Export-compliance declaration | ✅ `ITSAppUsesNonExemptEncryption: false` (HTTPS only = exempt) |
| Deep links / App Links | ✅ `autoVerify` on thegruvs.com |
| Production build profile | ✅ `production` → Android **app-bundle (AAB)**, autoIncrement |
| `google-service-account.json` | ❌ **you must add** (only for automated `eas submit`; manual upload works without it) |
| iOS APNs key | ❌ **you must add** in EAS credentials (required for iOS push) |
| Android notification icon | ⚠️ currently the full-colour `icon-512.png`. Android renders notification icons as a **silhouette** — supply a white-on-transparent glyph or it shows a white blob. |

---

## 1. Google Play — Data Safety form

**Is all user data encrypted in transit?** → **Yes** (HTTPS/TLS to Supabase; CSP enforced on web).
**Do you provide a way for users to request data deletion?** → **Yes** — in-app + https://thegruvs.com/account-deletion.html.
**Is data collected by your app?** → **Yes.**

### Data types — collected / shared / purpose

| Data type | Collected | Shared* | Required | Purpose |
|---|---|---|---|---|
| **Name** (username, display name) | Yes | No | Required | App functionality, account management |
| **Email address** | Yes | No | Required | Account management, auth |
| **User IDs** | Yes | No | Required | App functionality |
| **Phone number** | Yes | No | **Optional** | App functionality (user-entered contact) |
| **Precise location** | Yes | No | **Optional** | App functionality (nearby events, Touch Down verification) |
| **Approximate location** (city) | Yes | No | Optional | App functionality, personalization |
| **Photos** | Yes | No | Optional | App functionality (avatars, event media, reels, stories) |
| **Videos** | Yes | No | Optional | App functionality (reels, event media) |
| **Messages** (in-app DMs) | Yes | No | Optional | App functionality |
| **Other user-generated content** (events, echoes, reviews) | Yes | No | Optional | App functionality |
| **App interactions** (views, RSVPs, check-ins, dwell) | Yes | No | Required | App functionality, **personalization** (ranking your feed) |
| **Crash logs / diagnostics** | Yes | No | Required | Analytics (stability) |
| **Date of birth** | Yes | No | Required | App functionality — **age gating (legal)** |

\* **Shared = No** throughout: data goes to **Supabase** (backend service provider / processor) and **Expo Push** (notification delivery) — under Play's definition these are service providers, not third-party "sharing." **No ad networks, no data brokers, no data sold.**

### Answers to expect
- **Is data used for advertising or marketing?** → **No.**
- **Is data used to track users across apps/sites?** → **No** (no IDFA, no ad SDK).
- **Data collection optional?** → Location, photos/videos, phone are **optional**; account basics + interactions are required.

### Play declarations you'll also need
- **Location permission declaration** — justify `ACCESS_FINE_LOCATION`: *"Precise location shows events near the user and verifies real-world attendance (Touch Down). It is user-initiated, foreground-only, and never used for ads."* (No background-location permission is requested — say so.)
- **Photo/Video permissions** (`READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO`) — *"Users select photos/videos to post as event media, reels and stories."*
- **`RECEIVE_BOOT_COMPLETED`** — *"Re-registers local event reminders after device restart."*

---

## 2. Apple — App Privacy answers

Same substance, Apple's taxonomy. **"Data Linked to You"** (all linked to identity):
- Contact Info: **Email**, **Phone** (optional), **Name**
- Location: **Precise Location**, **Coarse Location**
- User Content: **Photos or Videos**, **Messages (in-app)**, **Other User Content**
- Identifiers: **User ID**
- Usage Data: **Product Interaction**
- Diagnostics: **Crash Data**
- Sensitive Info: **Date of birth** (declare under "Other Data" — used solely for legal age gating)

**Used for Tracking:** **No** — no IDFA, no cross-app tracking, no ad SDKs.
**Purposes:** App Functionality, Personalization (feed ranking), Analytics (crash only).

---

## 3. IARC age rating questionnaire

Answer honestly — the app is **18+ by design**:

| Question | Answer |
|---|---|
| User-generated content? | **Yes** — events, reels, stories, DMs, echoes |
| Can users interact / share content? | **Yes** |
| Does the app share the user's location with other users? | **Yes** (opt-in presence; ghost/incognito modes provided) |
| Content moderation & reporting? | **Yes** — in-app report on every surface, block + mute, trust-weighted auto-hide, rate-limited reporting |
| References to alcohol / tobacco / drugs? | **Yes — references** (nightlife venue events). No depiction of use, no sale. |
| Violence / sexual content / gambling? | **No** |
| In-app purchases? | **No** (no payment processor integrated) |

**Expected rating:** Mature 17+ (Apple) / PEGI 16–18 / ESRB Mature — driven by UGC + social interaction + alcohol references. **This is correct and expected — do not try to rate it lower.**

---

## 4. Store listing copy

**App name:** The Gruvs
**Short description (Play, ≤80):**
> Find what's on tonight — verified by the people actually there.

**Full description:**
> **The Gruvs shows you what's actually happening — tonight, near you.**
>
> Most apps rank events by who paid or who shouted loudest. The Gruvs ranks by
> the one thing nobody can fake: people physically showing up. Touch Down at a
> venue and you become part of the truth — a live signal of where the night is
> really at.
>
> **Discover** — a feed built around what's on soonest, nearest, and hottest by
> real verified presence, not bought likes.
> **Touch Down** — check in at a venue and see who else is there right now.
> **Link up** — message the people you keep crossing paths with, roll with your
> Crew, or drop a beacon when you're out so your people can pull up.
> **Host** — post a Gruv in seconds (upload your poster and we read the details
> off it), then see who's really coming.
> **Stay** — heading to an event out of town? Find a room nearby.
>
> Reputation here is earned by being there, not by posting. No bought reach,
> no fake counts — the Truth Protocol is the product.
>
> The Gruvs is 18+.

**Keywords (Apple, 100 chars):**
`events,nightlife,party,gigs,whats on,tonight,near me,discover,social,crew,south africa,live`

**Category:** Events (primary) · Social (secondary)

---

## 5. Assets still needed (yours)
- **Screenshots** — Play: min 2 phone (1080×1920+); Apple: 6.7" + 6.5" sets. Suggested: The Drop feed · Event detail w/ "here now" · Touch Down/Crossed Paths · Chats · Profile/Vibe Card.
- **Feature graphic** (Play): 1024×500.
- **App icon**: ✅ have (`icon-512.png`).
- **Android notification icon**: ⚠️ white-on-transparent silhouette (see §0).
- **Demo login for reviewers** — a real test account (email + password). Reviewers WILL reject if they can't get past auth. Put it in Play "App access" and App Store Connect "Sign-in required."

---

## 6. Build & submit

```bash
# Production AAB (Play) — signs + increments automatically
eas build --platform android --profile production

# iOS (needs Apple Developer account + APNs key in EAS credentials)
eas build --platform ios --profile production

# Submit (Android needs google-service-account.json; otherwise upload the AAB by hand)
eas submit --platform android --profile production
```

**Before building:** the SDK-52 upgrade branch should get a `preview` APK smoke-test on a real device first (verify push arrives, camera/location prompts read correctly, deep links open).

---

## 7. Honest blockers before you can submit
1. **Apple Developer Program** membership ($99/yr) + **Google Play Developer** ($25 one-off) — if not already enrolled.
2. **APNs key** (iOS push) in EAS credentials.
3. **Demo reviewer account** — must exist and work.
4. **Screenshots + feature graphic**.
5. **`google-service-account.json`** if you want automated submission.
6. Optional but recommended: Android notification silhouette icon.
