// ── Launch surface control ────────────────────────────────────────────────────
// One switch to present the focused, nightlife-first launch surface. Flip
// LAUNCH_MINIMAL to false to restore the full app exactly as before — nothing
// here deletes anything.
//
// In minimal mode, secondary tabs are hidden from the bottom bar + sidebar.
// Their screens still mount and stay reachable via deep links (a shared Reel
// still opens) — only the nav buttons are hidden, so no content is lost.
export const LAUNCH_MINIMAL = true;

// Tabs hidden from the bar/sidebar while in minimal launch mode.
// Reels is demoted at launch: endless short-form scrolling pulls against the
// "get people off their phones and into the real world" thesis, and it isn't
// part of the core discover → verify → Touch Down → coordinate loop. To bring a
// tab back, remove its key here (or set LAUNCH_MINIMAL = false). You can also
// add 'notifications' here if you want a tighter 5-tab bar.
export const HIDDEN_TABS = LAUNCH_MINIMAL ? ['reels'] : [];

// ── Feature surfaces (The Focus Cut) ──────────────────────────────────────────
// Present the core loop (see tonight → go → Touch Down → coordinate) and PARK
// the premature / density-dependent / regulated surfaces. Nothing is deleted —
// only their entry points are hidden. Flip any flag to true to bring it back
// instantly (or set LAUNCH_MINIMAL = false to restore the whole app).
export const FEATURES = LAUNCH_MINIMAL ? {
  reelsRail:    false, // the Reels strip on The Drop (Reels tab already hidden)
  business:     true,  // Business dashboard + Store builder + campaigns — un-parked (founder wants it visible)
  gifting:      false, // creator gifting economy (regulated fintech — build last)
  pathMap:      false, // Path Map — needs crowd density to feel alive
  crossedPaths: false, // Crossed Paths — needs density
  stories:      true,  // kept — cheap, familiar, low-risk
  // Resident (sister app) community safety alerts. res_* schema is LIVE as of
  // 2026-07-17 (resident_schema_v2 applied), so res_alerts resolves — ON.
  residentAlerts: true,
  // Resident "Stays" — rooms/guesthouses near an event (res_listings). Schema
  // live; the section still self-disables on any missing-table response, so
  // this is safe even before listings are seeded (renders nothing until then).
  accommodation: true,
} : {
  reelsRail: true, business: true, gifting: true,
  pathMap: true, crossedPaths: true, stories: true,
  residentAlerts: true, // res_* schema live (2026-07-17)
  accommodation: true,  // res_* schema live (2026-07-17)
};

/** feature('business') → true when the surface is live. Unknown keys default on. */
export const feature = (key) => FEATURES[key] !== false;
