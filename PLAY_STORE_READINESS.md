# Play Store readiness — first pass

Started from the audit dimensions you listed (security, performance, usability &
accessibility, device compatibility, input & edge cases, listing + privacy
policy). This is the **first pass**: the checks that could be run and verified
tonight. Device-matrix testing and real performance profiling need a dev build,
which is the open item below.

---

## Already in good shape

| Check | Result |
|---|---|
| `android.versionCode` | **2** — set (Play rejects without it) |
| `android.package` | `com.thegruvs.app` |
| Icon / splash / **adaptiveIcon** | all set — adaptiveIcon matters for listing quality |
| Orientation | `portrait`, locked |
| Cleartext traffic | not enabled — HTTPS only |
| Privacy policy | **live** at `/privacy.html`, linked from Settings, `POPIA_COMPLIANCE.md` in repo |
| Terms | live at `/terms.html` |
| Secrets at rest | `expo-secure-store` used; no tokens/passwords in AsyncStorage (the only AsyncStorage writes are geocode cache, nudge timestamps, search history) |
| Secrets in bundle | none — no service-role key, no hardcoded JWT |
| Background location | explicitly **disabled** in the expo-location plugin (`isAndroidBackgroundLocationEnabled: false`) — this is the single most common location rejection, and it's already correct |

---

## Blockers / risks before submission

### 1. `RECORD_AUDIO` is declared but nothing on native uses it — *rejection risk*
The only audio-recording code is `MediaRecorder` in `webrtcCall.js`, which is a
**browser** API guarded by `typeof MediaRecorder !== 'undefined'`. On this branch
`isCallSupported()` requires `navigator.mediaDevices.getUserMedia`, so it returns
false on native and the microphone is never touched.

Play rejects permissions with no corresponding in-app feature, and `RECORD_AUDIO`
is a sensitive permission that also needs a Data Safety declaration.

**Do not just delete it.** The `feat/gaming-meal-business-ring` branch adds real
native calling via `react-native-webrtc`, which *would* need it. Decide by what
ships in the first release: if calling isn't in v1, drop the permission and
re-add it with the calling feature.

### 2. `RECEIVE_BOOT_COMPLETED` looks unjustified
That permission exists to re-register **locally scheduled** notifications after a
reboot. There are no `scheduleNotificationAsync` calls in the codebase — push is
server-driven via `push-notify`. Same rejection risk as above; likely safe to
remove, but confirm nothing schedules locally first.

### 3. `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO` need the photo-picker justification
Play's photo/video permission policy requires either a justification form or
migrating to the Android Photo Picker. `expo-image-picker` can use the system
picker without broad media permissions — worth checking which mode is configured
before filling in the declaration.

### 4. Accessibility coverage is thin — **7%**
1,176 `onPress` handlers, **94** `accessibilityLabel`s. TalkBack users hit a lot
of unlabelled controls. Not a hard rejection, but it is a listing-quality and
inclusion issue, and you specifically asked about TalkBack.

Highest-value fix order: the tab bar, the RSVP/Touch Down buttons, and the feed
card actions — the paths a screen-reader user must traverse to do the core thing
the app is for. `MediaViewer`'s controls already have labels; use those as the
pattern.

### 5. Nested `<button>` (web-only) — deferred deliberately
The feed card is a touchable that contains touchables (`MediaViewer`'s like /
download). React logs `validateDOMNesting`. Functionally it works and it is
**web-only** — harmless on native, so it does not block Play.

I did not fix it: the fix means restructuring The Drop's card, which is your
primary screen, and doing that unsupervised overnight is the wrong trade. It
needs a small design decision (move the media controls outside the tappable
card, or make the card a non-button with an explicit press target).

---

## Not yet done — needs a dev build

These cannot be measured from this environment, and all of them were on your list:

- **Startup time, frame rendering, CPU/memory/battery** — needs a real device.
  Worth doing right after the first dev build, since the native map is new and
  MapLibre is the heaviest thing on the screen.
- **Device compatibility** — models, screen sizes, Android versions.
- **Interruptions & configuration changes** — incoming call, backgrounding,
  rotation (orientation is locked to portrait, which removes most of this),
  low memory, permission revoked while running.
- **Offline behaviour** — there is a `resilient()` cascade and cache layer, but
  no offline pass has been run end to end. Note the app already shows a "No
  internet connection" banner that appears to be a **false positive** even when
  online — worth confirming before shipping, since it is the first thing a
  reviewer will see.

## Listing itself
Not written/reviewed yet. Needs: short + full description, screenshots (per form
factor), feature graphic, content rating questionnaire, Data Safety form (which
must match the permissions above), and target audience. The Data Safety form is
the one that most often contradicts the manifest — fix findings 1–3 first so the
two agree.
