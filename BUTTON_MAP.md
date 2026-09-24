# The Gruvs — Complete Button & Functionality Map

Every interactive control in the app, screen by screen. Generated from a source sweep of
`App.js` + `src/screens/` + `src/components/` on 2026-07-29 (branch `feat/gaming-meal-business-ring`).

**Totals: 1,427 interactive elements** across 154 files (verified twice — see
[Coverage](#coverage--how-this-was-verified)):

| Type | Count |
|---|---|
| `TouchableOpacity` | 1,095 |
| `TextInput` | 193 |
| Custom wrappers (`InputField`, `ActionBtn`, `Chip`, `RoundBtn`, `LinkRow`, `ToggleRow`, cards…) | 117 |
| `Pressable` | 8 |
| `TouchableWithoutFeedback` (tap-catchers) | 8 |
| `Switch` | 6 |

Plus gesture surfaces that aren't tags at all: the tab-bar drag-scrub, tab swipe, and the
native map's tap/marker handlers.

**Beyond the buttons**, §22 covers every *non-press* interaction — typing, Enter-to-submit,
switches, Android back on 115 modals, web pull-to-refresh, the QR scanner's camera trigger, and
keyboard navigation. **Short answer on `onClick`: this app has none** (it's React Native —
`onPress` is the equivalent), so a broken tap is never an `onClick` problem.
See [§22](#22-non-press-interactions--everything-that-isnt-a-button).

> **Companion doc:** [FALLBACK_STRATEGY.md](FALLBACK_STRATEGY.md) covers what happens when one of
> these controls *fails* — the 5-layer model (Guard → Attempt → Degrade → Contain → Observe) and
> the READ / WRITE / CRITICAL classification that decides how much fallback each button earns.

**How to read this.** Each entry says what pressing the control actually *does*, not just its label.
Where a label is opaque or misleading (God View's "INITIATE SINGULARITY", the Wallet's
"MINT DETAILS"), the handler was read and the real behaviour is written out — including when
the answer is "nothing". Self-evident controls (Close, Cancel, Back, ✕) are listed without
explanation. `→` means "navigates to". ⚠️ marks a control that doesn't do what its label implies.

> **Note on parked features.** `src/constants/launchConfig.js` sets `LAUNCH_MINIMAL = true`.
> That hides some entry points without deleting anything. Currently **off**: Reels tab, the
> Reels rail on The Drop, gifting, Path Map, Crossed Paths, standalone Live Map tab.
> Currently **on**: Business, Stories, Resident alerts, Accommodation.
> Sections below are marked **[PARKED]** where the flag hides the entry point.
>
> **The flags leak.** Three parked surfaces still have live, ungated entry points — see
> [Things worth fixing](#things-worth-fixing). Those are marked **[PARKED — but reachable]**.
> The Reels button on The Drop is *deliberately* shown while the tab is hidden (opt-in entry,
> auto-hides if the tab is restored), so that one is intentional, not a leak.

---

## 1. App Shell (`App.js`)

### Bottom tab bar (narrow screens) / Left sidebar (wide, ≥ breakpoint)
Both render the same tab list. Visible tabs after the Focus Cut filter:

| Tab | Label | Icon |
|---|---|---|
| feed | The Drop | home |
| explore | Explore | compass |
| calendar | Lineup | calendar |
| chats | Linked Up | message-circle |
| notifications | Pings | bell |
| profile | Vibe Card | user |

Hidden but still mounted and deep-linkable: **Reels** (`film`), **Map** (`map`).

**Shell controls:**
- **Tab buttons** — switch section. Tapping the active Drop tab re-refreshes the feed.
- **Drag-to-scrub on the tab bar** — glide a finger across the bar to slide between sections (haptic per change).
- **Swipe between tabs** (native only) — horizontal swipe moves to prev/next tab. Disabled on web and on Reels.
- **Keyboard 1–7** (web desktop) — jump straight to a tab. Suppressed while a modal is open or typing.
- **Sidebar logo — long-press** → opens the **God View Dashboard** (admin).
- **"For Business"** sidebar item → Business hub. Only rendered if the user actually owns a `business_profiles` row.
- **Collapse / Expand sidebar** toggle.
- **"New version available — tap to refresh"** banner (web) → reloads to the new build.
- **"Skip to content"** link (web a11y).
- **"Exit safe mode"** → clears the crash log and reloads, after the boot guard trips on repeated crashes.
- **Android hardware back / web browser back** — closes the topmost modal, then falls back to The Drop, then double-press to exit.

---

## 2. The Drop — main feed (`LandingPage.js`, 53 elements)

### Top bar
- **Search field** (`Search...`)
- **Reels** button `[film]` — shown *because* the tab is hidden; auto-hides if Reels is restored
- **Path Map** button `[map]` **[PARKED — but reachable]** — not gated by `feature('pathMap')`
- **Vibe Roulette** `[compass]` — spin for a random event
- **Create (+)** — opens Post Event modal, or the auth modal if signed out

### Feed controls
- **Feed mode tabs:** Upcoming · For You · Following (signed in) · Mine (signed in). Tapping the active tab refreshes.
- **Grid / list layout toggle** — persisted to `@gruvs_feed_layout`
- **Refresh** button
- **Category chips** — filter by category, tap again to clear
- **Trending strip** + **"See all"** → trending modal; each trending spot opens the event
- **Scroll-to-top** `[chevrons-up]`
- **Floating create (+)** button
- **"Drop a Gruv"** / **"See All Upcoming"** empty-state CTAs
- **Community alert dismiss (✕)**

### Per event card
- **Tap poster image** → open event · **long-press** → reaction ring
- **Bookmark / unbookmark**
- **Tap host avatar** → viber profile · **Follow host**
- **"📋 Details on the poster"** → event detail
- **Venue chip** → opens Google Maps directions
- **"Get Tickets / RSVP"** → external ticket URL
- **Vibe ⚡** (like), with count
- **React** `[smile]` → reaction bar
- **Echo** `[message-circle]` → comments section
- **Gallery** `[camera]`
- **Pulse** `[activity]` → live schedule
- **Journey** — pin/unpin the event to your route
- **Rate** `[star]`
- **Share**
- **RSVP** `[check-circle]`
- **Report** `[flag]`
- **Edit** `[edit-2]` (host only)
- **Admin** `[bar-chart-2]` (host only)
- **Reactor list** `[chevron-right]` → who reacted, filterable by reaction type

### Long-press quick-action sheet
Reaction picker plus: **Vibe it ⚡ / Remove Vibe**, **Save / Unsave**, **RSVP**, **Share**,
**Add to Journey**, **View Details**, **Cancel**.

### Reaction ring (long-press radial)
Each reaction emoji, plus **"More actions"** → the quick-action sheet.

---

## 3. Explore (`ExplorePage.js`, 31 elements)

- **Search** events / artists / venues, with **clear (✕)**
- **Scout** `[award]` → Talent Scout leaderboard
- **Featured Today** card
- **Category grid** — tap a category to filter (shows event counts)
- **Mode selector** and **All Sports / per-sport chips**
- **GRUV SERVICES → Hire** → Service Marketplace
- **"Find Vibers"** → Discover People
- **"Who Was There"** → find people by time & place
- **"EVENTS NEAR YOU"** → Scout map/radius screen
- **Hashtag chips** — tap to search that tag
- **Viber tiles** → viber profile modal
- **🎂 Birthday cards** — "Wish them 🎉" → opens their profile
- **Photo grid** → full-screen photo viewer (with close), **Show all / less** toggles
- **Updates** — show all / less
- **"APP TUTORIALS"** → Tutorial Center
- **"Join The Gruvs"** → auth (signed out)
- **Scroll to top**

---

## 4. Lineup — calendar (`CalendarPage.js`, 14 elements)

- **Month grid day cells** → select a day
- **Prev / next month** arrows
- **Grid ↔ agenda toggle**
- **"Today"** — jump to today
- **Create (+)** and **"Add a Gruv"**
- **Search all gruvs** (title, venue, city) with **clear**
- **Filter mode chips** and **category filter chips**
- **Event rows / cards** → event detail

---

## 5. Linked Up — chats (`ChatsScreen.js`, 5 elements)

- **Segment switcher:** Chats · Crew
- **Search conversations** with **clear**
- **Conversation rows** → open the DM thread
- **"Sign In"** (signed out)
- Pending-request count badge

### Direct Message thread (`DirectMessageModal.js`, 33 elements) — the deepest surface in the app
- **Header:** back, **partner name/avatar** → their profile, **voice call** `[phone]`, **video call** `[video]`
- **"Touched Down"** verified badge → jumps to the shared event
- **Request bar:** **Lock In** (accept) / **Decline**
- **Message input**, **send**, **attachment menu** toggle
- **Per-message (long-press):** **Reply**, **Select** (enters multi-select), **Delete**, **reaction picker**
- **Failed message:** **retry** `[refresh-cw]`
- **Multi-select mode:** **Cancel**, **"Share to…"** → pick a conversation to forward into
- **Reply preview** dismiss (✕)
- **File attachments** → open in browser; **shared location** → opens Apple/Google Maps
- **Media send flow:** preview, **caption field**, **confirm send**, **discard (✕)**
- **Event picker:** **search your events**, tap an event to share it into the chat; shared event card → **"View Gruv"**

### Crew (`CrewHub.js`, 15 + `CrewCallModal.js`, 6)
- **New Crew (+)** → name, description, **icon picker**, **colour picker**, **Create Crew**
- **Crew rows** → detail; **invite members**, **leave crew**
- **Invitations:** **Join** / decline
- **"Call the crew"** → group call: **Voice** / **Video** join, **mute**, **camera off**, **hang up**

---

## 6. Pings — notifications (`NotificationsScreen.js`, 4 elements)

- **Segments:** Today · This Week · Older
- **Notification rows** → deep-link to the event / chat / profile
- **"Mark all read"**
- **"Sign In"** (signed out)

---

## 7. Vibe Card — profile (`ProfilePage.js`, 129 elements — the largest screen)

### Header
- **Cover photo** — tap to view, **camera button** to upload
- **Avatar** — tap to view, long-press (or tap when empty) to upload
- **Edit Profile**, **Share** profile, **Settings** `[settings]`
- **Inline edit** of display name and username (each with Save / Cancel)

### Quick-action grid
**Business** `[briefcase]` · **Clubs** `[shield]` · **Leaderboard** `[award]` · **Tutorials** `[book-open]` ·
**Find Me** · **Find Them** · **History** (Who Was There) ·
**Crossed** **[PARKED — but reachable]** (not gated by `feature('crossedPaths')`) ·
**Wallet** (gated behind biometric auth) · **Tickets** · **Hub** (provider dashboard) ·
**Council** (governance) · **Settings** · **My Path Map** **[PARKED]** · **Launch Resident Map**

> ⚠️ **Bug:** "Launch Resident Map" opens `http://localhost:3000/dashboard` — a hardcoded dev URL
> that will 404 for every real user. [ProfilePage.js:2862](src/screens/ProfilePage.js#L2862)

### Content tabs
My Gruvs · Saved · Vibed · Passport · Following · Co-Host · Activity · Gallery

- **My Gruvs:** per event **Edit** / **Delete**, **show all / less**, **create (+)**
- **Saved / Vibed:** empty-state prompts, show all / less
- **Gallery:** **Add Photo**, **Post Reel**, per-tile **like** / **delete**, lightbox with **delete** and close
- **Vibe Coach: "Get Tips"** — runs `BehavioralEngine.analyze` over your own activity and returns
  coaching tips plus your next milestone. Rules-based on your history, not an AI call.

### Find Me / Find Them sub-views
- **Discoverable toggle** — whether you surface in others' nearby searches at all
- **Beacon** `[map-pin]` — go "live on the radar": requests location permission and publishes your
  presence so others can find you now. Pressing again **deactivates** it ("You went off the radar")
- **Distance chips**, **interest filter chips** — narrow the search
- **"Find People Nearby"** — runs the search against the safe nearby-vibers RPC

### Edit Profile modal
Avatar upload · Change Cover Photo · **bio**, **location**, **website** fields ·
**gender chips** · **birth year** · **"What are you looking for?"** chips · **areas** field · **Save Profile**

### The long identity form (invite-by-name / algorithm data)
- **Interests** — chips with remove (✕) + **category picker**
- **Bio**, **city** (+ **GPS crosshair** to auto-fill)
- **First name**, **Surname**, **Clan name (isiduko)**
- **Date of birth** (DD / MM / YYYY)
- **Home village / area** + **"pin my home area"** GPS button
- **Language chips**, **community tag chips**
- **Siblings** — add/remove rows (name, age, relationship)
- **Emergency contacts** — add/remove rows (name, phone, relationship), each with a **🆘 SOS button** that sends location
- **Save Profile**

### Clubs modal
- **Tabs**, **club rows** → club screen
- **Invitations:** **Accept** / **Decline**
- **Create Club** form: name, abbreviation, **sport-type chips**, city, bio → **Create Club**

### Council / governance (gold-themed sub-view, reached from the **Council** quick action)
- **DECREE YES** / **DECREE NO** — cast your vote on an open platform proposal. Voting weight
  comes from your tier, which is why the Council entry sits behind the vibe-score ladder.

---

## 8. Settings (`SettingsScreen.js`, 13 elements + rows)

**Account:** Edit profile · Email (display) · Username (display)

**Privacy & Discovery:**
- **Safety Center** → safety hub
- **Discoverable** toggle · **Show online status** toggle · **Share events** toggle
- **Disappear now** — instant Ghost mode + cleared presence (confirms first)
- **Identity mode chips**
- **Discover radius chips**, **"Find Vibers within Nkm"**

**Notifications:** **Push notifications** toggle · **Sound effects** toggle · **Email me about new events & updates** toggle (POPIA consent withdrawal)

**Device access:** per-permission **Allow** prompts (`PermissionsPanel`)

**Career & Looks:** career title · career description · looks & aura → **Save Career Profile**

**Appearance:** **theme cards** (gender-keyed aura palettes) · **writing style picker** · **currency picker**

**Security:** **App lock** toggle (biometric) · **Two-factor authentication** → MFA setup modal

**About & Support:** Privacy policy · Terms of service · Version

**Account actions:** **Download my data** (POPIA s.23 export) · **Sign out** · **Delete account** (permanent, confirms first)

---

## 9. Event Detail (`EventDetailScreen.js`, 34 elements)

**Tabs:** Info · ⚙️ Manage (host/co-host only) · Polls · Playlist

### Header & host
- **Close**, **Share**
- **Organizer avatar/name** → profile · **Follow** · **Message** ·
  **Gift** `[gift]` **[PARKED — but reachable]** (not gated by `feature('gifting')`)

### Info
- **Venue** → opens maps · **phone** → dialer · **email** → mail client
- **Vibe ⚡**, **Who's going** `[users]` → guest list modal
- **RSVP options:** Locked In · Maybe · Not Going
- **Follow event** button + notification-preference sheet
- **Waitlist** button (when full)
- **"Get Passes"** → external tickets
- **Touch Down / check-in** button (opens Crossed Paths when enabled)
- **Reminder** toggle, **Add to calendar**
- **Guest list:** per-guest **hype ❤️**, tap → player card
- **"Tournament Governance"** → vote on who controls results
- **"Report Gruv"** `[flag]`
- **Event chat** `[message-circle]`

### Host tools
- **Guest list export**, **"Send an update to everyone coming"** (broadcast)
- **Door check-in** → ticket scanner
- **"Manage"** guests, **"Manage Team"** (roles), **"Invite My People"**

---

## 10. Post an Event (`PostEventModal.js`, 85 elements — the biggest single component)

A 3-step wizard. **Clear form** (double-tap to confirm) and **close** are always available.

### Step 1 — the basics
- **📸 Scan a poster** → on-device OCR auto-fill (downloads the reader on first use)
- **Paste text → auto-fill** — paste a WhatsApp blast / Instagram caption and it extracts date, time, venue, city, prices, ages, format, ticket link, contacts, load-shedding power, and the good-to-know bits
- **Title**, **"My poster already has the details"** toggle
- **Address / venue** + **"tap to use GPS"** pin
- **City**
- **Power during load-shedding** chips
- **Event tag chips**
- **Secret headliner** — hidden act + "reveal at how many RSVPs" (with a help toggle)
- **Contact number**, **contact email**
- **Date**, **start time**, **end time**, **end date** (each with a picker and a clear)
- **Make this a Tour** — multi-city stops, each with venue, city, date, time, ticket link; **add stop** / **remove stop**
- **Recurring Event** — weekly / monthly / annually / custom; **day-of-week chips**, **interval**, **custom dates**, **end date**
- **Schedule / lineup slots** — add slot (time, title, performer, notes, day), remove slot
- **NEXT →**

### Step 2 — media & category
- **Media picker** (multiple), per-item **remove**
- **Category picker** → full category modal
- **Event type chips**
- **Back** / **NEXT →**

### Step 3 — audience & tickets
- **Ticket URL**
- **Age range** — min/max chips + custom values
- **"Who is this for?" targeting panel:** gender chips, tag chips, language chips, **surnames**, **home village/area**, **professions**, **distance-from-venue radius**, **match-all** toggle
  *(Targeting prioritizes, never hard-filters — per the safety principles.)*
- **Ticket tiers:** VIP / VVIP / other package fields, **preset tier chips** (phases, rows, zones), **custom tier rows** (name + price) with add/remove
- **Back** / **Post**

---

## 11. Edit / manage an event

**`EditEventModal.js` (23):** cover photo, date, time, VIP/VVIP/other prices, package notes,
ticket tiers (add / edit / delete with name, description, price, capacity), **Save Changes**,
**Cancel Event**, **Delete Event**.

**`EventManagementPanel.js` (31)** — host control room, tabbed:
- **Lineup / roles:** add, edit, delete
- **Sessions:** **Go live** `[play-circle]`, edit, delete
- **Vendors / categories:** add, edit, delete, **Confirmed** toggle
- **Live updates:** update-type chips + **Post Update**
- **Stages:** add, edit, delete
- **Scores:** team picker, category picker, **Submit Score**, delete score

**`EventAdminPanel.js` (6):** tabs, RSVP filters, **manual check-in** by ticket ref or @username, **Export CSV**

**`EventRoleManager.js` (9):** search users, **Assign** role, role picker, **revoke**

**`EventGuestsModal.js` (11):** search/add players, **new player identity**, per-guest edit (rating, placement, award), remove

**`SportManagementPanel.js` (23):** teams (create/edit/delete, **link to a registered club**), fixtures (create, **edit score**, save), **live commentary** posting with minute markers, likes

**`AwardCeremonyPanel.js` (16):** create award (category, title, icon, **recipient search**, stat, season, notes), **Save Draft**, **Publish Award**, delete

**`TournamentGovernancePanel.js` (5):** team picker, **vote for role holders**, **stand for a role**, **create your club**

---

## 12. Live event surfaces

| Component | What its controls do |
|---|---|
| `EventChatRoom` (10) | Live chat for everyone at the event. Send a message; **long-press** any message for **Reply**, **pin** (hosts — sticks it to the top banner for all attendees), or **Delete**. Tap the pinned banner's ✕ to unpin. |
| `EventPollSection` (11) | Attendees **vote** and see live results. Hosts hit **New Poll** → question, 2+ options (add / remove), **allow multiple choices** toggle → **Post Poll**. **Close poll** freezes voting. |
| `EventScheduleSection` (10) | Expand a time slot to see detail. Hosts can attach a poll to a specific slot ("which act closes?") — **Create Poll** / **Add poll for this slot**, then attendees vote per slot. |
| `EventPlaylistSection` (12) | Crowd song requests. **Request a Song** searches **Spotify or YouTube**, optionally with a note to the DJ. Others **upvote** to push it up the queue. The DJ **marks played**, **opens the track** in its native app, or **removes** it. |
| `EventMomentsSection` (11) | Ephemeral event stories — **Add a Moment**, pick photo/video, caption, post; **disappears after 24 hours**. Viewer taps advance/retreat; **react** with an emoji that the poster sees. |
| `EventGallery` (8) | The shared event photo archive. Tap a tile for the lightbox, **like** a photo, **+ Add My Photo / Video** to contribute. Video tiles play/pause in place. |
| `LiveEventUpdates` (4) | Host posts a typed update ("doors open in 10") to everyone at the event; **update-type chips** categorise it. Attendees expand to read the feed. |
| `LiveEventBanner` (2) | Persistent "LIVE NOW" bar; expands for detail, **Share Your Moment** jumps into the moment composer. |
| `CrowdMeter` (1) | Crowdsourced busy-ness — vote how packed it is right now. This is the Truth Protocol in miniature: the crowd's read, not the organizer's. |
| `PresenceBar` (2) | **Touch Down** = verified physical check-in at the venue. Also **star** someone else who's checked in. |
| `EchoSection` (8) | Event comments. Post, **reply** to a specific echo, **like**, and re-**sort** the thread. Tap an avatar for their profile. |
| `RatingSection` (3) | Post-event star rating plus written feedback to the organiser. |
| `SetNowPlayingModal` (10) | DJ/host sets what's playing right now — pick from the lineup, drill into a set's tracklist, or type artist + song manually. **Clear** stops the now-playing bar. |
| `VIPTierSelector` (1) | Book a specific ticket tier; sold-out tiers are non-interactive. |
| `EventTicketModal` (2) | Shows your ticket + QR; **Share Ticket** sends it on. |
| `QRCheckInScanner` (3) | **Open Camera Scanner** (requests camera permission) to scan attendee ticket QRs at the door. |
| `DoorCheckInModal` (3) | Manual fallback for the scanner — type a ticket code (`VIBE-TKT-…`), **Check ticket** validates and admits. |
| `BroadcastModal` (4) | Host sends a push to everyone who RSVP'd; **kind chips** set the message category. |
| `VendorMenuSheet` (5) | Browse food/drink vendors at the event, search across vendors and dishes, tap one for its menu. |
| `StagePlaybookModal` (6) | Business-side: publish a timed offer to attendees — headline, button text, optional link, live toggle → **publish**. |
| `SurveyBuilderModal` (12) | Ask the community a question — answer type (single/multi/free text), options, how many days it runs → **GO LIVE**. |
| `SurveyCard` (5) | The answering side — pick options or type a reply, **submit**, or **Not now** to skip. |
| `MatchPredictionCard` (1) | Vote on a sport fixture outcome before it starts. |
| `PulseScheduleSection` (3) | Request an act/slot and **upvote** others' requests. |
| `CompetitionPicker` (5) | Attach a fixture to an existing competition, or create a new one inline. |
| `PlayerProfileModal` (9) | Sport player card — **follow**, **Rate** (score + note), **Edit**, **Share**, and **"This is me"** which *claims* an unclaimed player profile and binds it to your account. |
| `PlayerEditModal` (4) | Edit a player's name/category and save. |
| `TalentLeaderboardModal` (10) | Ranked players — search by name, filter by region, **Clear filters**, tap through to a player card. |

---

## 13. Reels **[PARKED — tab hidden, screen still mounts & deep-links]** (`ReelsScreen.js`, 52)

- **Tabs:** For You · Following · 🔥 Trending
- **Vertical feed:** tap to play/pause, **seek bar**, **prev / next** chevrons
- **Right rail:** author avatar → profile, **Follow**, **Like**, **Comment**, **Share**, **Save**, **Control** (settings), **DM**, **mute**, **Manage** (own reel), **Report**
- **Caption** expand, **event chip** → open the event
- **Tappable `#hashtags` inside the caption** — each `#tag` is its own tappable `<Text>` that
  filters the feed to that hashtag ([ReelsScreen.js:582](src/screens/ReelsScreen.js#L582)).
  ⚠️ `@mentions` in the same caption are **styled blue to look tappable but have no handler** —
  they do nothing. Either wire them to the profile or stop styling them as links.
- **Comments sheet:** add comment, like a comment
- **Manage sheet:** **Edit Caption**, **Share Reel**, **Delete Reel**
- **Advanced controls:** playback **speed**, **aspect ratio**, **zoom −/+**, **visual filters**, **Auto-Advance** toggle, **Immersive Clean Screen** toggle, **Background Play** toggle, **caption size**
- **Create (+)** → Create Reel
- **Hashtag filter** chip with clear

**`CreateReelModal.js` (22):** **Choose from Gallery** / **Record a Video**, caption, **quick tags**,
**link to an event**, **filters**, **text stickers** (text, position, style, add/remove), **trim** start/end,
**visibility**, **vibe colour**, **music/track name**, **Post**

---

## 14. Map surfaces

**`MapScreen.js` (14)** — Living Map **[standalone tab PARKED, merged into Path Map]**
- **Day filter chips** (All + per-day)
- **My events** `[star]` toggle · **Crew** `[users]` toggle · **Heatmap** `[activity]` toggle · **Live only** `[radio]` toggle
- **Fit all** `[maximize]` · **Recenter** `[crosshair]`
- **"Mark a closure"** `[edit-3]` → zone draw tool
- **Zone card:** **Still closed** / **Reopened** verification, **See the event**

**`ZoneDrawTool.js` (8):** pick event, **closure kind**, **undo**, **clear**, duration chips, note, **Publish to the map**

**`EventMapView.js` (6):** pin select, **View**, **Directions**, event list, close

**`MapEventPreview.js` (8):** prev/next event, **Going** toggle, **Save**, **Take me there**, **Details**, closure alert

**`ScoutScreen.js` (15 + the map itself):** category chips, **radius chips** + custom km entry,
**"Show city-wide"**, map modal, **Center on my location**, **crew-only toggle**,
**plan/unplan** an event, **View**

The native map (`react-native-maps`, native only) has two interactions that aren't buttons:
- **Tap a marker pin** → selects that event and opens its preview ([ScoutScreen.js:753](src/screens/ScoutScreen.js#L753))
- **Tap empty map** → deselects / dismisses the preview ([ScoutScreen.js:736](src/screens/ScoutScreen.js#L736))
- A **scan-radius ring** renders around you when the radius is under city-wide (display only)

**`PathMapScreen.js` (11)** **[PARKED]** — **My Path** ↔ **Live Map** switcher, tabs,
**drop a trace** (leave a message at a place), **Send a Spark** at an intersection, star

---

## 15. People & social

**`DiscoverPeopleScreen.js` (16):** search by username, **filter chips**, **description filters**
(gender, skin, hair, body, interest, age range) with **Clear All**, follow, message, open profile

**`ViberProfileModal.js` (16):** **Follow**, **Message**, **Report**, **Block**, **Share**,
avatar viewer, **View Player Card**, stat rows, tabs, show all events/gallery

**`WhoWasThereModal.js` (13):** venue search, **from / to datetime**, description filters,
username search, **Clear All**, open profile, message

**`CrossedPathsModal.js` (4)** **[PARKED]:** refresh, open profile, message

**`FollowListModal.js` (2):** open a profile

**`SuggestedFollows.js` (2):** follow / dismiss

**`InviteByNameModal.js` (5):** tabs (by surname / clan / village / profession), **select all in tab**, per-person toggle, **Send**

**`CrewFeedScreen.js` (5):** activity rows → event/profile, **FIND** → discover people

**`LeaderboardScreen.js` (4):** tabs, tap a ranked user → their profile

**`ClubScreen.js` (8):** back, **Invite Player** (search by username), **Edit Club**, tabs, **remove member**

**`CommunityStatsBar.js` (4):** **Mutuals Online Now** modal, message someone

**`StoriesRow.js` (6)** — Stories are **on**: open a story, **Your Story** (+), **Reshare**, tap left/right to navigate

---

## 16. Safety

- **`SafetyHubModal` (4):** **Disappear now** (instant invisibility), **Get home safe · trusted contacts**
- **`GetHomeSafeModal` (9):** pick trusted contacts, destination, **home-by time chips**, **Start check-in**, **"I'm home safe"**, **Alert them now**, **Cancel this check-in**
- **`ReturnPathCard` (3):** join a group ride home, **"I'll sort myself"**, dismiss
- **`CarpoolBoard` (19):** **post an offer** (area, departure time picker, seats, return trip toggle + return time, note), **request a seat**, **Manage** → accept / decline rider requests
- **`ReportModal` (5):** reason picker, details, **Submit Report**
- **`AppLockGate` (1):** **unlock** with biometrics
- **`MfaSetupModal` (3):** enrol, 6-digit code entry
- **`PermissionGuideModal` (4):** **Try again**, **Reload the page**
- **Emergency contacts + SOS** — in the profile identity form (§7)

---

## 17. Business (**ON** — un-parked at founder's request)

**`BusinessDashboardScreen.js` (29)** — 8 tabs. The labels are styled, so the plain meaning:

| Tab label | Internal key | What it actually shows |
|---|---|---|
| **Intel** | `overview` | Dashboard home / summary |
| **Storefront** | `store` | Your public store page → opens the Store Builder |
| **Missions & Promos** | `campaigns` | Campaigns you're running |
| **The Crowd** | `audience` | Who your audience is |
| **Reads** | `analytics` | Performance numbers |
| **Stacks** | `finance` | Money view |
| **Network** | `ecosystem` | Other businesses to partner with |
| **Playbook** | `playbook` | How-to guidance |

- **Setup form** → **"LAUNCH MY BUSINESS PROFILE"** (business type, name, tagline, description, website)
- **Settings** → re-open setup
- **+ POST DISH** → meal compose · **boost a meal**
- **NEW / LAUNCH MISSION** → campaign builder
- **Stage Playbook**, **Boost reach with a gift**
- **ASK** → survey builder
- **UPGRADE / SEE PLANS** → tier upgrade sheet (**pick a tier**, **Maybe later**)
- **JOIN** an ecosystem, **playbook view switcher**

**`BusinessStoreBuilder.js` (30):** **store slug**, **theme picker**, **preview toggle**, **ADD BLOCK**
(menu / deals / stats / FAQ / gallery), per-block **move up / down / edit / delete**, per-block item
add & remove, **SAVE**, **PUBLISH**

**`CampaignBuilderModal.js` (16):** template picker or **Start from scratch**, campaign type,
tag input, step navigation (**Back** / **NEXT**), **save**

**`ProviderDashboardScreen.js` (4):** **availability toggle**, settings, **set up provider profile**

**`ServiceMarketplace.js` (15):** tabs (Moving Help / Event Logistics), radius chips,
**Post Gig**, **My Hub**, **gig mode toggle**, **Book** a provider,
booking flow (cargo type, pickup, drop-off, date/time, **Lock Funds in Escrow**, **Cargo Received ✓**, **Dispute**)

> ⚠️ Escrow has **no payment processor behind it** — see `project_money_services_verdict` memory.
> The buttons exist; the money rail does not.

**`PostGigModal.js` (7):** what you need, category chips, details, pay, time window, **POST GIG**

**`GigModeCard.js` (1):** **Accept Gig**

**`MealComposeModal.js` (8):** photo, type chips, dish name, description, price, tags, **Post dish**

**`MealDetailModal.js` (3):** **Message the restaurant**, **Report**, close

**`OrganizerDashboard.js` (2):** expand, **Refresh** stats

**`SuperfansPanel.js` (1):** period switcher

---

## 18. Wallet & economy **[gifting PARKED]**

**`WalletScreen.js` (12)**

| Control | What it does |
|---|---|
| **Tabs** / **refresh** | Switch between balance, escrow and history views; reload |
| **TOP UP** | Opens `${APP_WEB_URL}` checkout in a browser — leaves the app |
| **CASH OUT** | Opens the cashout sheet: amount entry, **min 100 diamonds**, must not exceed balance, converts at **0.18** (shown live as "You will receive: …"), then `MonetizationService.requestCashout` files a request |
| **Release Funds** | `EscrowService.releaseToProvider(bookingId, providerId)` — marks the booking released and opens the review prompt |
| **Dispute** | `EscrowService.initiateDispute(bookingId, …)` — flags the booking as disputed |
| **UPGRADE TIER** | ⚠️ Does nothing. Shows a toast: *"Upgrade to Royal tier with Vibe Score >= 1000"* |
| **MINT DETAILS** | ⚠️ Does nothing. Shows a toast echoing your current vibe score |

**`GiftingModal.js` (5)** **[PARKED]:** pick a gift tier, **Top Up** (→ checkout), **send gift** — debits coins and credits the recipient's diamonds

**`GiftBoostModal.js` (3)** **[PARKED]:** pick a reach tier, **redeem** — spends a gift to boost campaign reach

**`Paywall.js` (3):** **Get Gruvs Pro** / **Unlock with Gruvs Pro** — opens the Pro upgrade flow on a gated feature

**`ReferralCard.js` (2):** share your invite link to a specific platform, or **copy link** to clipboard

---

## 19. Onboarding, auth & help

**`AuthModal.js` (18):** **Sign in ↔ Sign up** switcher, 2-step signup —
username/@handle, full name, city, **DOB picker**, **gender chips**, **interest chips**,
email (with **domain shortcut chips**), password + **show/hide**, **email opt-in checkbox**,
**Forgot password?**, submit. Includes a honeypot field.

**`ResetPasswordModal.js` (6):** new password + confirm, show/hide, **Update password**

**`TutorialCenter.js` (7):** **search the Academy**, lesson rows, **Reset progress**

**`TutorialOverlay.js` (3):** **Back**, **NEXT / DONE**, **SKIP**

**`GetAppModal.js` (4):** **Install now** (PWA), **Open in browser**, **copy link**

**`InstallAppBanner.js` (3):** **Get App**, **Install**, collapse

**`NotificationNudge.js` (2):** **enable**, dismiss

**`GoOutNudge.js` / `MapNudge.js` / `CheckInNudge.js` / `TonightAlert.js`:** act / dismiss pairs;
CheckInNudge's action is **Touch Down**

**`ErrorBoundary.js` (5):** **Try again**, **Reload app**, **Sign in**

---

## 20. Misc components

| Component | What its controls do |
|---|---|
| `ActivityCenterModal` (2) | Filter your activity history by type; close. |
| `AdFlywheel` (2) / `EventContextualAds` (1) | Sponsored card — CTA opens the advertiser's link, ✕ dismisses it for the session. |
| `AvatarViewerModal` (2) | Full-screen avatar; tap anywhere or ✕ to close. |
| `MediaViewer` (4) | Full-screen media — **like**, **download** to device, swipe/chevron between items. |
| `CategoryPickerModal` (9) | Pick interests/categories: search all, browse by group tab, **add your own custom category**, **Clear all**, confirm the selection. |
| `CurrencyPicker` (1) | Sets the **display** currency symbol (GPS-derived by default). No FX conversion happens — it re-labels, it doesn't convert. |
| `WritingStylePicker` (1) | Picks the app's copy voice/tone for your account. |
| `DateTimePickers` (15) | Shared calendar + clock. Calendar tap cycles **day → year → month** drill-down; prev/next month; time picker sets hour + minute → confirm. |
| `DateFilterStrip` (1) | Quick date filter (today / tomorrow / weekend …). |
| `SearchHistoryBar` (3) | Re-run a past search, delete one entry, or **Clear all** history. |
| `HashtagStrip` (1) | Tap a hashtag to search it. |
| `ReactPicker` (1) / `EventReactions` (1) | Apply one reaction to an event (one at a time — picking a new one replaces the old). |
| `CollapsibleSection` (1) | Expand / collapse, with a matching a11y label. |
| `EmptyState` (2) | Primary and optional secondary CTA when a list has nothing in it. |
| `ToastNotification` (1) | Dismiss the toast early. |
| `NightlifeWrappedModal` (4) | Your nightlife year-in-review, story-style — prev/next card, **Share Story Recap** exports it. |
| `WrappedCard` (2) | Compact Wrapped entry point; **Share** builds the share text and opens the OS share sheet. |
| `VibeRouletteModal` (4) | Can't decide where to go — pick a category, **Spin the Wheel** to land on a random matching event, then **Open Event Details**. |
| `WeekendPlannerCard` (4) | Suggests a Fri/Sat/Sun slate; **Plan it** pins that event into your journey. |
| `ContinueTheNightCard` (1) | After an event ends, suggests where to go next; tap to pick. |
| `CrewJourneyPanel` / `CrewOutCard` / `LineupRail` / `MasonryFeed` / `FriendActivityFeed` | All tap-through-to-event cards; the crew variants show *who* from your crew is going. |
| `NowPlayingBar` (1) | Persistent bar showing the current track; tap opens the playlist section. |
| `AutoPlayVideo` (1) | Mute / unmute the inline video. |
| `WaitlistButton` (1) | Join or leave the waitlist when an event is at capacity. |
| `EventFollowButton` (5) | Follow an event for updates; the gear opens **notification preferences** (per-type switch) → **Save**. |
| `EventDraftPanel` (15) | Co-creating an event with friends before it's public: **Plan an event together** starts a draft, add/remove/**assign tasks** to specific people ("bring the speaker"), each co-host **confirms**, and once enough confirm you can **launch** it live. **RUN IT BACK** clones a past event into a new draft. |
| `ResidentStaysSection` (1) | Rooms near the event (Resident sister app) — **message the host**. |
| `ResidentLiftsSection` (1) | Lifts to the event — **Book via The Resident app** (hands off to Resident). |
| `VerifiedRequestCard` (1) | **Apply** for a verified badge. |
| `ReviewModal` (4) | Star rating + written review of a service provider → **SUBMIT REVIEW**. |
| `RSVPConfirmModal` (5) | Confirm your RSVP status (Locked In / Maybe / Not Going); **External Tickets** opens the ticket URL if the event has one. |
| `HackathonLeaderboard` (1) | Expand a team row for its submission detail. |
| `PosterInsightsPanel` (1) | Share your poster's performance stats. |
| `VibeCardBubble` (1) | Opens the referenced person's Vibe Card. |
| `CallOverlay` (3) | In-call: send a live reaction to the other party, pick a video filter. |

---

## 21. God View — admin (`GodViewDashboard.js`, 10)

Reached by **long-pressing the sidebar logo**. Gated by a server-validated admin check
(`useIsAdmin`) — non-admins get the modal closed on them.

**Only 3 of these 10 controls do real work.** The screen carries its own honesty banner
("⚠️ SIMULATED — these figures are generated locally for modelling, not live data"), which is
correct and worth keeping. The rest print green text to a fake terminal.

### Actually does something
| Button | What it does |
|---|---|
| **Refresh** (queue) | Reloads `getModerationQueue()` — real reported/auto-hidden content |
| **RESTORE** | `moderateContent(type, id, 'restore')` — un-hides the item, removes it from the queue |
| **REMOVE** | `moderateContent(type, id, 'remove')` — confirms the takedown |

### Half-real
| Button | What it does |
|---|---|
| **RE-BALANCE ECONOMY** | Calls the `get_economic_velocity` RPC; if velocity exceeds a threshold it multiplies the in-memory `EVENT_HOSTING` XP multiplier by 0.95. The mutation is **in-memory only** (lost on reload) and the whole thing sits in a silent `catch` — and per the schema-drift audit that RPC may not exist on the live DB, in which case this is a no-op that still prints "Inflation re-balanced by PhD Brain." |

### Theatre — writes a log line, changes nothing
| Button | What actually happens |
|---|---|
| **EXECUTE SUPREME AUDIT** | Returns the hardcoded string `"Kingdom Optimized Locally"`, then sets the two stat cards to the **hardcoded constants** `vps: 1240, liquidity: 89.4, security_score: 99.9`. No query runs. |
| **SIMULATE 1M VIBERS** | Pure arithmetic on a constant: `0.98 − (userCount / 10_000_000) × 0.05`. No data involved. |
| **LAUNCH MARKET SANDBOX** | Sums the char codes of the string `"ZA Summer Strike"` and uses that hash to index one of 4 canned "strategic decrees". |
| **INITIATE SINGULARITY** | Returns a hardcoded manifest string listing things that are already true. |
| **PERFORM CORONATION** | Mutates an in-memory `projectDNA` object (`version = "Sovereign-1.0"`, pushes `CORONATION_SEAL_ACTIVE`) and returns a fixed decree. Lost on reload. |

> If you ever demo this screen, the moderation queue is the only part that survives scrutiny.
> The rest is a mock harness — the honesty banner is doing a lot of load-bearing work.

---

## 22. Non-press interactions — everything that isn't a button

Added 2026-07-29 after a sweep of **every** `on*` handler prop (168 distinct names, filtered to
the ones that represent real user input rather than component-to-component callbacks). The
sections above cover `onPress`/`onLongPress`; these are the interactions that were missing.

### ⚠️ First, the `onClick` question

**There is no `onClick` in this app.** The sweep found exactly 3 occurrences, all in
[LiveMap.js](src/components/LiveMap.js) — and they are `onClickRef` / `onMapClick`, a MapLibre
map-click *prop name*, not a DOM handler:

```
src/components/LiveMap.js:330   if (drawModeRef.current) { onClickRef.current?.(…) }
src/components/LiveMap.js:362   const onClickRef = useRef(onMapClick);
src/components/LiveMap.js:366   onClickRef.current = onMapClick;
```

That is expected — this is React Native. Even on web, `react-native-web` translates
`onPress` into DOM click handling for you, so app code never writes `onClick`. **If something
broke on tap, `onClick` is not where to look.** See [Finding a tap that broke](#finding-a-tap-that-broke).

### The real interaction handlers

| Handler | Count | What it is |
|---|---|---|
| `onChangeText` | 219 | Typing into any text field. Higher than the 193 `TextInput` count because custom wrappers (`InputField`, `Field`) forward it. |
| `onRequestClose` | 115 | **Android hardware back / Esc on a modal.** A real, easily-missed interaction: every one of the 115 modals can be dismissed this way, independently of its ✕ button. |
| `onSubmitEditing` | 15 | Pressing **Enter / Go / Search** on the keyboard. Submits without touching the on-screen button — used by the door check-in code field, echo composer, event chat, playlist search, category picker, campaign tags, draft tasks, admin check-in. |
| `onValueChange` | 13 | The `Switch` toggles — Settings' privacy/notification rows, event follow prefs, provider setup, stage playbook, survey builder, profile interests. |
| `onScroll` / `onMomentumScrollEnd` / `onScrollEndDrag` | 6 | Scroll-driven behaviour: the time picker snaps to the nearest hour/minute on scroll end; the feed and Explore drive scroll-to-top visibility. |
| `onTouchStart` / `onTouchEnd` | 4 | **Web pull-to-refresh** on The Drop ([LandingPage.js:2567](src/screens/LandingPage.js#L2567)) and Reels' tap zones. |
| `onPressIn` / `onPressOut` | 4 | Press-and-hold visual feedback (`Motion.js`) and the feed card's flash state. |
| `onLayout` | 7 | Measurement, not input — used by `PostEventModal` to scroll a failed-validation field into view, and by `MediaViewer` for sizing. |
| `onBlur` / `onFocus` | 3 | Field focus tracking in the draft panel and Scout's custom-radius entry. |
| `onContentSizeChange` | 1 | Event chat auto-scrolls to the newest message. |
| `onBarcodeScanned` | 1 | **The QR scanner's actual trigger** ([QRCheckInScanner.js:388](src/components/QRCheckInScanner.js#L388)) — door check-in fires from the camera, not a button press. |
| `onNaturalSize` | 1 | Media viewer aspect fitting. |

### Keyboard interactions (web)

- **Enter opens an event card.** Feed cards get `tabIndex: 0` and
  `onKeyPress: e => e.nativeEvent?.key === 'Enter' && onSelectEvent(event)` on web
  ([LandingPage.js:379](src/screens/LandingPage.js#L379)) — so the whole card is keyboard-reachable,
  not just its buttons. They also get `className: 'event-card'` and `cursor: pointer`.
- **Keys 1–7** switch tabs (App shell, §1).
- **Esc / hardware back** closes the topmost modal via `onRequestClose` + the `backStack`.

### Two ways to open event details

Worth stating because they behave differently, and this is the surface reported as broken:

| Path | Line | Trigger |
|---|---|---|
| Tapping the **title/description column** | [LandingPage.js:661](src/screens/LandingPage.js#L661) | `onPress={() => onSelectEvent(event)}` |
| **"📋 Details on the poster"** | [LandingPage.js:766](src/screens/LandingPage.js#L766) | `onPress={() => onSelectEvent(event)}` — same handler |
| **Enter** on a focused card (web) | [LandingPage.js:379](src/screens/LandingPage.js#L379) | `onKeyPress` |
| **Double-tap** the poster image | [LandingPage.js:2430](src/screens/LandingPage.js#L2430) | 210 ms debounce, then `setSelectedEvent` |

All four funnel into the same `setSelectedEvent`, which renders
`<EventDetailScreen>` inside a **`SafeSection`** ([LandingPage.js:2900](src/screens/LandingPage.js#L2900)).

### Finding a tap that broke

`SafeSection` is `ErrorBoundary inline` + `Suspense`. When Event Detail throws, it does **not**
crash the app — it replaces that section with a small *"Event Detail unavailable / Retry"* chip
and the feed behind it keeps working. So the symptom of a broken event page is a **small inline
chip, not a white screen**, which is easy to mistake for "the button did nothing".

To find the actual cause:

1. **Look for the inline chip** with the label `Event Detail`. Its presence confirms a throw
   rather than a dead handler.
2. **Read `client_errors`** — `ErrorBoundary` reports there. Query for recent rows with a label
   matching the section.
3. **Check the browser console** for the boundary's `componentStack`.
4. If the chip is *absent* and nothing happens at all, the handler never fired — check that the
   card isn't covered by an overlay, rather than looking for an exception.

> Nothing in the current source reproduces a crash on this path under static analysis: the four
> entry points are identical one-line calls, and `EventDetailScreen`'s reads (`profiles.city`,
> own-row `live_checkins`) don't touch a revoked column. Diagnosing further needs the runtime
> error — step 2 is the fastest route to it.

---

## Coverage — how this was verified

The first pass used a regex sweep for known tag names and reported **1,319**. That was wrong in
two directions, so a second, stricter pass was run to check it:

- **Undercounted.** It only matched hardcoded tag names, so it counted a wrapper's *definition*
  (`const LinkRow = … <TouchableOpacity>`) but not its 7 *usages*. 117 custom-component
  instances were invisible to it: `InputField` ×22, `ActionBtn` ×9, `Chip` ×8, `RoundBtn` ×7,
  `LinkRow` ×7, `ToggleRow` ×7, plus ~30 one-off card types.
- **Overcounted, briefly.** The stricter pass first reported 1,435 because a depth-aware
  attribute scan swallowed `onPress` from inside `renderItem={() => <TouchableOpacity …>}`,
  making 8 `FlatList`s look interactive. Stripping nested JSX before testing fixed it.

**1,427 is the reconciled figure.** Two pieces of genuine functionality surfaced only on the
second pass and have been added above: the **Scout map's marker/background taps** and the
**tappable hashtags in Reels captions** (which also exposed the dead `@mention` styling).

**Known limits of this method.** It finds elements by JSX shape, so it will miss anything
built by an imperative path — `Alert.alert` button arrays, `window.confirm`, and OS share
sheets. Those were read manually where they carry real choices (delete account, sign out,
delete event, panic mode). Re-run the sweep after any large UI change; treat the numbers as
accurate to roughly ±1%, not as a contract.

---

## Automation plan — making these 1,427 controls testable

This is about **button-level test automation**. For pipeline/CD readiness see the existing
[AUTOMATION_READINESS.md](AUTOMATION_READINESS.md), which is a separate and more mature audit —
don't duplicate it here.

### The blocker: zero test hooks

```
testID attributes across all of src/ ............ 0
```

1,427 interactive elements, not one addressable handle. The Playwright suite compensates by
selecting on user-visible text — of its selectors, **20 are `getByText`, 17 raw `locator()`,
2 `getByRole`, 1 `getByPlaceholder`**. Every one of those breaks when copy changes. Since much
of this app's copy is deliberately stylised ("Intel", "Stacks", "DECREE YES", "Drop a Gruv"),
copy churn is likely, and a red suite that cries wolf gets ignored — which is worse than no suite.

### Phased plan

**Phase 1 — instrument the critical path (highest value per hour).**
Add `testID` to the ~40 controls on the core loop only: sign in/up, the 6 tab buttons, feed
RSVP / Vibe / Share, Post Event's 3 wizard steps, Touch Down, DM send, Settings' privacy
toggles. Convention: `testID="screen.element.action"` (e.g. `drop.eventCard.rsvp`). React
Native Web maps `testID` to `data-testid`, so Playwright and Jest share one selector vocabulary.

**Phase 2 — make the E2E suite a gate, not advisory.**
It currently runs `continue-on-error`, so a deploy can ship with every UI flow broken. Once
Phase 1 selectors make it stable, flip it to blocking. Do this in that order — gating a
text-selector suite would just teach everyone to force-merge.

**Phase 3 — cover destructive and money paths.**
Delete account, delete event, cash out, release escrow, moderation remove, panic mode. These
need tests most (irreversible) and have none. Each should assert the confirm step actually
blocks, not just that the button exists.

**Phase 4 — regenerate this map in CI.**
Keep the extractor as `scripts/button-map.js` and have CI diff its output. A PR that adds an
interactive element without a `testID` on a critical-path screen fails the check. That's what
stops the instrumentation from rotting.

### Cheap wins available now
- `accessibilityLabel` coverage is already good on the feed and nav — Playwright's `getByRole`
  can use it today, no code change, and it's far sturdier than `getByText`.
- The existing `dataSet={{ screen, active }}` marker on mounted screens already lets tests scope
  to the visible tab. Several screens sit pre-mounted-but-hidden in the DOM, so **any selector
  that isn't scoped this way risks matching a hidden tab** — an existing, silent flake source.

---

## Security plan — the buttons as an attack surface

Scoped to what these controls expose. The broader posture lives in
[SECURITY-AUDIT.md](SECURITY-AUDIT.md) / [SECURITY-CHECKLIST.md](SECURITY-CHECKLIST.md).

### The governing rule

**A hidden button is not a disabled capability.** Every control here is a client-side affordance;
the only real boundary is the RLS policy or RPC behind it. Hiding a button behind
`feature('gifting')` stops honest users, not a crafted request. So each privileged control needs
its guard *server-side*, and the client check is only UX.

That rule is exactly what the three flag leaks below violate at the UX layer — and the reason
they matter less than they look, provided the server-side half holds.

### ✅ Verified 2026-07-29: the gifting server-side half DOES hold

Checked against the live database, not assumed. `process_gift` is `SECURITY DEFINER` with
`search_path` pinned, and it independently enforces every invariant the client cannot be
trusted with:

| Guard | How |
|---|---|
| Sender cannot be spoofed | `IF auth.uid() IS NULL OR auth.uid() <> p_sender_id THEN RAISE` — the client-supplied id is *validated*, not trusted |
| No double-spend | `pg_advisory_xact_lock('process_gift:' || sender)` serialises concurrent gifts from the same sender before the balance is read |
| Diamonds can't be minted to an arbitrary account | The host is re-resolved server-side (`SELECT author_id FROM events`); the client's `p_host_id` is ignored entirely |
| No self-gifting | Explicit check |
| Balance enforced | Summed from `coin_ledger` *under the lock* |
| Gifts can't buy Lineup heat | Credits `support_score`, deliberately separate from `vibe_count` — matches the product rule |

And the ledgers cannot be written around the RPC. `coin_ledger`, `diamond_ledger`,
`gift_logs`, `cashout_requests` and `gift_registry` all have RLS **enabled with SELECT-only
policies and no INSERT/UPDATE/DELETE policies whatsoever**, scoped to `user_id = auth.uid()`.
A `SECURITY DEFINER` function is the only thing that can write them.

**Conclusion: the ungated Gift button is a product exposure, not a vulnerability.** Nobody can
steal coins, mint diamonds, or overdraw a wallet through it. What they *can* do is transact in a
gifting economy you intended to have parked — which is a regulatory/product problem worth
closing, but not the security incident it first looked like.

⚠️ Separately: **`redeem_gift_boost` does not exist on the live DB**, so `GiftBoostModal`'s
redeem button would fail outright. Parked, so low priority — but it's live schema drift.

### ✅ Verified 2026-07-29: the location tier holds too

Probed by running actual queries as the `authenticated` role, not by reading policy text.

**Coordinates are locked at the column-grant level.** `authenticated` holds INSERT/UPDATE on
`profiles.lat` / `profiles.lon` but **no SELECT**. A client attempting to read another user's
coordinates gets `permission denied for table profiles`. Crossed Paths, Path Map and Find Them
therefore *cannot* bypass the safe RPCs (`get_crossed_paths`, `get_safe_nearby_vibers`) even
though their buttons are ungated. Same conclusion as gifting: **product exposure, not a leak.**

**Moderation auto-hide genuinely works.** `profiles_hide_autohidden` is **RESTRICTIVE**, so it
is AND-ed with the permissive policies and really does subtract. (Worth stating because the
five permissive `USING (true)` policies beside it look like they would defeat it. They don't.)

#### But two real problems surfaced

**1. `birthdaySpotlight` is silently dead.** Both `peopleWithBirthdayToday`
([birthdaySpotlight.js:46](src/services/birthdaySpotlight.js#L46)) and `myBirthdayTwins`
([:84](src/services/birthdaySpotlight.js#L84)) select `lat, lon` off *other* users' profiles.
That is exactly what the lockdown blocks, so the query throws, a `catch` logs a `console.warn`
and returns `[]`. The "🎂 Birthday · Wish them 🎉" cards on Explore have therefore been showing
nothing, with no error surfaced to anyone. This is a textbook **L5 Observe** failure from
[FALLBACK_STRATEGY.md](FALLBACK_STRATEGY.md) — a silent catch turning a permission error into
an empty list. It also fetches up to **5,000 rows** to filter client-side, which is its own problem.

**2. Latent PII hazard — safe by accident, not by design.** `email` and `phone` *do* have SELECT
granted to `authenticated`, and `profiles` carries **five duplicate PERMISSIVE SELECT policies
all with `USING (true)`**, so every row is readable by every signed-in user. It is not a leak
today only because both columns are **NULL for all 34 profiles** (the real PII lives in
`auth.users`). The moment anything writes an email or phone into `profiles`, it becomes
world-readable to every signed-in user — and `SettingsScreen` already renders `profile?.email`,
so something intends to populate it.

**Root cause of both: policy sprawl.** `profiles` has 5 identical `USING (true)` SELECT policies
and 6 overlapping insert/update policies with near-duplicate names ("Users can update own
profile", "Users can update own profile.", "Users update own profile", `profiles_update_own`,
`profiles_update_self`). Accumulated migration debt. It makes the effective policy genuinely hard
to reason about, and it is precisely how someone later hardens one policy while four others still
say `true`. Consolidating to one SELECT policy per table is the durable fix.

### Tiering the controls by blast radius

| Tier | Controls | Required guard |
|---|---|---|
| **Irreversible** | Delete account · Delete event · Delete reel · Moderation REMOVE · Cash out | Server-side ownership/role check + a confirm step. Delete account already goes through a JWT-verified edge function ✅ |
| **Value-moving** | Gift send · Top up · Release escrow · Dispute · vibe-score writes | Must be server-authoritative and atomic. Prior audits found and fixed double-spend and host-mint bugs here — any new button on this path needs the same scrutiny |
| **Location-exposing** | Beacon · Touch Down · Find Them · Who Was There · Crossed Paths · Path Map traces | Coordinates must never leave the server raw. The precise-coords leak was closed by routing through an RPC — new surfaces must use it, not query `profiles` directly |
| **Privilege-escalating** | God View (all) · Event role assign · Club member remove · Tournament governance | Server-validated role. God View's `useIsAdmin` is server-validated ✅ — that's the pattern to copy |
| **Abuse-prone** | Report · Broadcast · Invite by name · SOS · DM send | Rate-limit server-side. Broadcast and SOS are the ones that scale into spam or a false-alarm problem |

### Action items, in priority order

1. ~~**Verify the server-side half of the three flag leaks.**~~ ✅ **Done 2026-07-29 — it holds.**
   See the verification box above. Gifting is server-authoritative and the ledgers are
   RLS-locked. Severity drops from "possible live hole in a regulated surface" to "product
   exposure". ✅ The **location** tier was checked the same way and also holds — `lat`/`lon` have
   no SELECT grant for `authenticated`, so the ungated Crossed Paths / Path Map buttons cannot
   read raw coordinates. See the verification box above.
2. **Add the missing `feature()` guards** (~3 lines each). Now a product/compliance fix rather
   than a security one: it stops users transacting in a gifting economy you meant to park.
3. **Escrow: decide, then act.** "Lock Funds in Escrow" implies custody that doesn't exist. It's
   a consumer-protection problem before it's a technical one. Either gate the buttons or relabel
   the flow as broker-only, per the existing money-services decision.
4. **Rate-limit Broadcast and SOS** server-side if not already. A host who can push to every
   RSVP is one compromised account away from a mass-phishing vector — and notification phishing
   was already closed once at the RLS layer.
5. **Audit destructive buttons for confirm-step coverage.** Delete account and sign out confirm;
   spot-check that delete-event, remove-member, and moderation-remove do too.
6. **Treat God View as production surface.** It's admin-gated correctly, but it renders numbers
   that are fabricated. Keep the ⚠️ SIMULATED banner; don't let the mock engines grow.

---

## Things worth fixing

### ✅ Fixed 2026-07-29

1. ~~**The Focus Cut leaks in three places.**~~ **Guards added.** All three parked surfaces now
   check their flag: **Gift** → `feature('gifting')`, **Crossed** → `feature('crossedPaths')`,
   **Path Map** → `feature('pathMap')`. The server side was verified to hold independently
   (see the security section), so this was a product exposure rather than a hole — but the
   buttons are gated now too.

2. ~~**Hardcoded localhost URL.**~~ **Replaced with a configured host.** Added
   [residentUrl.js](src/constants/residentUrl.js) as the single source of truth, following the
   `appUrl.js` pattern, and it is **deliberately empty by default** — `hasResident()` gates the
   entry point so an unconfigured build hides the button instead of offering a link that cannot
   work. Set `EXPO_PUBLIC_RESIDENT_URL` to light it up. Opens via `SecurityService.safeOpenURL`
   rather than raw `Linking`.

3. ~~**`ResidentLiftsSection`'s "Book via The Resident app" had no `onPress` at all**~~ — a
   button that looked like a hand-off and did nothing. Now wired to the same configured host,
   and hidden when there isn't one.

4. ~~**Dead `@mention` styling in Reels captions.**~~ **Wired up.** `@handles` resolve the
   username to a profile (punctuation-tolerant, so `@thabo,` works) and open it; an unmatched
   handle now says so instead of failing silently.

5. ~~**Meal reporting was broken three ways and lied about it.**~~ The insert wrote `kind`
   (not a column — it's `target_type`), omitted `reporter_id` (`NOT NULL`), and `'meal'` wasn't
   in the `target_type` CHECK constraint. The `catch` then showed *"Reported."* on failure, so
   every meal report silently vanished while looking successful. Client fixed; the constraint
   needs [reports_meal_target.sql](supabase/queries/reports_meal_target.sql) applied —
   **until that runs, meal reports still won't land.**

6. ~~**`birthdaySpotlight` silently dead**~~ — see the location-tier box; moved to safe RPCs.

7. ~~**Stale `vibeCardShare` test**~~ — asserted an `@` prefix the app deliberately dropped.
   Suite is now **909/909 green**.

### Still open

8. **Escrow buttons with no payment rail** — "Lock Funds in Escrow" / "Release Funds" / "Cash Out"
   render real UI over a non-existent PSP. `EscrowService.lockFunds` just inserts a `service_bookings`
   row ([escrowService.js:28](src/services/escrowService.js#L28)) — no money moves. Either gate them
   behind a flag or relabel as broker-only, per the `project_money_services_verdict` decision.

9. **Two Wallet buttons are inert.** **UPGRADE TIER** and **MINT DETAILS**
   ([WalletScreen.js:246](src/screens/WalletScreen.js#L246), [:252](src/screens/WalletScreen.js#L252))
   look like actions but only fire a toast describing what the action *would* require. They read as
   broken rather than as "not yet available".

10. **God View is a mock harness wearing a dashboard's clothes.** 5 of its 7 command buttons return
   hardcoded strings or do arithmetic on constants; "EXECUTE SUPREME AUDIT" sets the stat cards to
   literals (`1240`, `89.4`, `99.9`). The screen's own ⚠️ SIMULATED banner is honest and should stay,
   but the buttons invite decisions on fake numbers. Only the moderation queue does real work.

11. **`profiles` policy sprawl** — 5 duplicate `USING (true)` SELECT policies + 6 overlapping
   write policies. Harmless today because `email`/`phone` are NULL for all 35 users, but it means
   any future write of PII into `profiles` is immediately world-readable to signed-in users.

12. **Zero `testID`s in 1,427 controls**, and the E2E suite is `continue-on-error`. See the
   [Automation plan](#automation-plan--making-these-1427-controls-testable).

13. **`ProfilePage.js` is 3,847 lines / 129 controls** in one file. It holds the profile, the identity
   form, clubs, the gallery, find-me/find-them, and the edit modal. A split would pay for itself.

14. **Two pending migrations gate fixes already shipped in the client:**
    [reports_meal_target.sql](supabase/queries/reports_meal_target.sql) (meal reports can't land
    without it) and the 11 files already in `DEPLOY_SQL_RUNBOOK.md`.

15. **61 of the 123 RPCs the client calls are defined nowhere in the repo's SQL.**
    Measured with the new `npm run audit:rpc` ([scripts/rpc-audit.js](scripts/rpc-audit.js)),
    which needs no database connection and now runs as part of `npm run preflight`. It exists
    because `audit:writes` checks written *columns* but skips RPCs entirely without a
    service-role key — the gap that let `create_user_profile` sit missing while every signup
    silently lost its data.

    Split by severity, because a missing tier-3 fallback is noise and a missing sole path is a
    dead feature:

    **🔴 16 sole-path** — no fallback, so absence means the feature doesn't work:
    `get_safe_nearby_vibers` · `report_map` · `verify_map_report` · `create_crew` ·
    `accept_crew_invite` · `count_path_crossings` · `suggested_follows` · `find_nearby_events` ·
    `find_popular_spots` · `find_gruv_hotspots` · `get_or_create_playlist` ·
    `record_daily_activity` · `apply_vibe_decay` · `distribute_to_war_chest` ·
    `get_follower_integrity_aggregate` · `get_precision_economic_metrics`

    **🟡 45 fallback-tier** — inside a `resilient([...])` cascade, so they degrade rather than
    die (this is where `create_user_profile` sat).

    ⚠️ **Two different failure modes, and the script cannot tell them apart.** Some of these are
    genuinely absent from live. Others — `report_map`, `verify_map_report`,
    `get_safe_nearby_vibers` — demonstrably *exist* on live but were applied without committing
    the SQL, so they work today and vanish on a rebuild. Both are real problems.
    Confirm against live with:
    `select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public';`

16. **`map_reports.sql` is a comment-only stub** — the crowdsourced-map DDL
    (`map_reports`, `map_report_votes`, `report_map`, `verify_map_report`) was applied straight
    to live and never written back to the repo. A fresh build silently loses the whole feature,
    and the RLS on a user-authored-content table can't be reviewed from source. The file now
    documents exactly how to recover the definitions from live rather than hand-reconstructing
    them (a reconstruction that drifts from live would be worse than the stub).
