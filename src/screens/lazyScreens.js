// Screens are eager-required on every platform.
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
// correctness over the ~0.7 MB the split saved.
//
// Revisited 2026-08-07: `web.output: "static"` is NOT a generic multi-chunk
// SPA mode — in Expo SDK it specifically means Expo Router's static-site
// generation, and requires expo-router as the app's entry point ("Unable to
// resolve module expo-router/node/render.js" when tried). This app uses a
// manual tab-switcher (App.js's screenFor/renderScreen), not expo-router, so
// enabling it means adopting expo-router first — a real migration, not a flag
// flip. Not attempting that here. If code-splitting web is revisited, start
// there, not with this file.
//
// LandingPage / ChatsScreen / NotificationsScreen were never here: The Drop is
// the first paint, and the other two export shell-level unread hooks that run
// before any tab is visited.

export const ReelsScreen = require('./ReelsScreen').ReelsScreen;
export const ExplorePage = require('./ExplorePage').ExplorePage;
export const CalendarPage = require('./CalendarPage').CalendarPage;
export const ProfilePage = require('./ProfilePage').ProfilePage;
export const GodViewDashboard = require('./GodViewDashboard').GodViewDashboard;
export const MapScreen = require('./MapScreen').MapScreen;

// Conditional overlays reached from inside another screen (PathMapScreen and
// WalletScreen sit behind parked Focus Cut flags).
export const PathMapScreen = require('./PathMapScreen').PathMapScreen;
export const WalletScreen = require('./WalletScreen').WalletScreen;
export const ServiceMarketplace = require('./ServiceMarketplace').ServiceMarketplace;
