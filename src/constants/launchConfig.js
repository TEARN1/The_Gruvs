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
