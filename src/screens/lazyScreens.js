// Screens are required on FIRST RENDER, not at app start (all platforms).
//
// Startup (2026-10-06): with every screen eagerly required, a mid-range phone
// spent seconds executing each screen's module and building its StyleSheets
// before the first tab could render. Each export below is a tiny wrapper that
// require()s the real screen the first time it renders. The code is still in
// the one bundle (no async chunks, so the failure described below can't
// recur); only its *execution* moves off the startup path. Tabs mount on first
// visit or during idle prefetch (App.js), so that's when this now runs.
//
// History: screens were eager-required on every platform, because of this:
//
// These were React.lazy(() => import(...)) on web to split them off the first-
// parse critical path. But the web build ships with app.json
// `web.output: "single"` — a single-bundle output with NO runtime to load and
// register the async chunks that import() emits. The chunks were built and
// even fetched (HTTP 200), but their modules never registered, so every split
// screen (Explore, Lineup, Vibe Card, God View, …) threw at runtime
// ("Requiring unknown module N") and fell to its error boundary in production.
// Dev never split, so it hid the bug entirely.
//
// Static requires put every screen in the one bundle that actually loads —
// correctness over the ~0.7 MB the split saved. Revisiting code-splitting for
// web means switching to `web.output: "static"` first, so the async-chunk
// loader actually exists.
//
// LandingPage / ChatsScreen / NotificationsScreen were never here: The Drop is
// the first paint, and the other two export shell-level unread hooks that run
// before any tab is visited.

import React from 'react';

const deferred = (load, name) => {
  let Screen = null;
  const Deferred = React.forwardRef((props, ref) => {
    if (!Screen) Screen = load();
    return <Screen ref={ref} {...props} />;
  });
  Deferred.displayName = `Deferred(${name})`;
  return Deferred;
};

export const ReelsScreen = deferred(() => require('./ReelsScreen').ReelsScreen, 'ReelsScreen');
export const ExplorePage = deferred(() => require('./ExplorePage').ExplorePage, 'ExplorePage');
export const CalendarPage = deferred(() => require('./CalendarPage').CalendarPage, 'CalendarPage');
export const ProfilePage = deferred(() => require('./ProfilePage').ProfilePage, 'ProfilePage');
export const GodViewDashboard = deferred(() => require('./GodViewDashboard').GodViewDashboard, 'GodViewDashboard');
export const MapScreen = deferred(() => require('./MapScreen').MapScreen, 'MapScreen');

// Conditional overlays reached from inside another screen (PathMapScreen and
// WalletScreen sit behind parked Focus Cut flags).
export const PathMapScreen = deferred(() => require('./PathMapScreen').PathMapScreen, 'PathMapScreen');
export const WalletScreen = deferred(() => require('./WalletScreen').WalletScreen, 'WalletScreen');
export const ServiceMarketplace = deferred(() => require('./ServiceMarketplace').ServiceMarketplace, 'ServiceMarketplace');
