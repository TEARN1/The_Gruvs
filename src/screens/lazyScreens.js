import { lazy } from 'react';
import { Platform } from 'react-native';

// Web-only code splitting.
//
// Every screen used to be a static import in App.js, so the first parse paid
// for Reels, Explore, Lineup, Vibe Card and God View even though the shell
// mounts them lazily (see visitedTabs). Splitting them moves that cost off the
// critical path: the browser parses The Drop, then streams the rest on idle.
//
// Native stays static on purpose. Metro resolves import() at build time, so
// React.lazy buys nothing there and only adds a Suspense boundary that can
// flash. Platform.OS is constant-folded per bundle, so the native build keeps
// the plain require path.
//
// LandingPage / ChatsScreen / NotificationsScreen are deliberately NOT here:
// The Drop is the first paint, and the other two export shell-level hooks
// (useUnreadDMCount, useUnreadCount) that run before any tab is visited.

const named = (loader, key) => () => loader().then(m => ({ default: m[key] }));

export const ReelsScreen = Platform.OS === 'web'
  ? lazy(named(() => import('./ReelsScreen'), 'ReelsScreen'))
  : require('./ReelsScreen').ReelsScreen;

export const ExplorePage = Platform.OS === 'web'
  ? lazy(named(() => import('./ExplorePage'), 'ExplorePage'))
  : require('./ExplorePage').ExplorePage;

export const CalendarPage = Platform.OS === 'web'
  ? lazy(named(() => import('./CalendarPage'), 'CalendarPage'))
  : require('./CalendarPage').CalendarPage;

export const ProfilePage = Platform.OS === 'web'
  ? lazy(named(() => import('./ProfilePage'), 'ProfilePage'))
  : require('./ProfilePage').ProfilePage;

export const GodViewDashboard = Platform.OS === 'web'
  ? lazy(named(() => import('./GodViewDashboard'), 'GodViewDashboard'))
  : require('./GodViewDashboard').GodViewDashboard;

// Conditional overlays reached from inside another screen. PathMapScreen and
// WalletScreen sit behind parked Focus Cut flags (pathMap, gifting) — before
// this they were parsed on every single load to render nothing at all.
export const PathMapScreen = Platform.OS === 'web'
  ? lazy(named(() => import('./PathMapScreen'), 'PathMapScreen'))
  : require('./PathMapScreen').PathMapScreen;

export const WalletScreen = Platform.OS === 'web'
  ? lazy(named(() => import('./WalletScreen'), 'WalletScreen'))
  : require('./WalletScreen').WalletScreen;

export const ServiceMarketplace = Platform.OS === 'web'
  ? lazy(named(() => import('./ServiceMarketplace'), 'ServiceMarketplace'))
  : require('./ServiceMarketplace').ServiceMarketplace;
