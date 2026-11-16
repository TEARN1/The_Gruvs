/**
 * navigationConfig.js — Master navigation registry, tab definitions, and layout tokens.
 */
import { BREAKPOINT } from '../constants/DesignTokens';
import { HIDDEN_TABS, feature } from '../constants/launchConfig';

// Master list — every screen the shell can mount (used for keep-alive + deep links).
export const ALL_TABS = [
  { key: 'feed', label: 'The Drop', icon: 'home' },
  { key: 'reels', label: 'Reels', icon: 'film' },
  { key: 'explore', label: 'Explore', icon: 'compass' },
  // The Living Map — a co-star of The Drop. Gated by feature('liveMap')
  ...(feature('liveMap') ? [{ key: 'map', label: 'Map', icon: 'map' }] : []),
  { key: 'calendar', label: 'Lineup', icon: 'calendar' },
  { key: 'chats', label: 'Linked Up', icon: 'message-circle' },
  { key: 'notifications', label: 'Pings', icon: 'bell' },
  { key: 'profile', label: 'Vibe Card', icon: 'user' },
];

// Visible list — what the bottom bar, sidebar, swipe, and hotkeys navigate.
// In minimal launch mode this drops demoted tabs (e.g. Reels).
// Hidden screens still mount via ALL_TABS and stay reachable through deep links.
export const TABS = ALL_TABS.filter((t) => !HIDDEN_TABS.includes(t.key));

export const WIDE_BREAKPOINT = BREAKPOINT.wide;
export const SIDEBAR_OPEN_WIDTH = 220;
export const SIDEBAR_CLOSED_WIDTH = 56;

export function getTabLabel(key) {
  return ALL_TABS.find((t) => t.key === key)?.label || 'The Drop';
}

export default {
  ALL_TABS,
  TABS,
  WIDE_BREAKPOINT,
  SIDEBAR_OPEN_WIDTH,
  SIDEBAR_CLOSED_WIDTH,
  getTabLabel,
};
