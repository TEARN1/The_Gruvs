// ── Level unlock menu ─────────────────────────────────────────────────────────
// What each vibe-level tier unlocks. Pure data + helpers so the profile can show
// "what you've earned" and "what's next", and so Premium can mirror the
// convenience unlocks.
//
//   earned: true  → a TRUST power — earned only, NEVER buyable (keeps the
//                   verification system honest).
//   earned: false → convenience / status — can also be a Premium shortcut.
import { VIBE_LEVELS, getVibeLevel } from './vibeLevel';

export const LEVEL_UNLOCKS = {
  'Viber': [
    { key: 'core', label: 'Discover, Touch Down, Vibe, Crew & post Gruvs', icon: 'zap', earned: true },
  ],
  'Elite Viber': [
    { key: 'who_was_there',   label: 'Who Was There — investigate a venue/time', icon: 'search',      earned: false },
    { key: 'crossed_history', label: 'Deeper Crossed Paths history',             icon: 'shuffle',     earned: false },
    { key: 'beacon',          label: '"I\'m out — pull up" beacon to your Crew', icon: 'radio',       earned: false },
    { key: 'create_crew',     label: 'Create your own Crew + group chat',        icon: 'users',       earned: false },
    { key: 'who_viewed',      label: 'See who viewed your Vibe Card',            icon: 'eye',         earned: false },
    { key: 'streak_mult',     label: 'Streak multiplier — level up faster',      icon: 'trending-up', earned: false },
  ],
  'Royal Viber': [
    { key: 'host_featured',   label: 'Host featured / bigger Gruvs',             icon: 'star',        earned: false },
    { key: 'recurring',       label: 'Recurring series + co-host roles',         icon: 'repeat',      earned: false },
    { key: 'crew_only',       label: 'Crew-only / private Gruvs',                icon: 'lock',        earned: false },
    { key: 'analytics',       label: 'Mini analytics on your Gruvs',             icon: 'bar-chart-2', earned: false },
    { key: 'vouch',           label: 'Vouch / verify a Gruv — your stamp counts', icon: 'shield',    earned: true },
    { key: 'skip_waitlist',   label: 'Skip-the-waitlist priority',               icon: 'fast-forward',earned: false },
    { key: 'ghost_touchdown', label: 'Ghost Touch Down — counted but anonymous', icon: 'eye-off',     earned: false },
    { key: 'boost_credits',   label: 'Monthly boost credits for your Gruvs',     icon: 'gift',        earned: false },
  ],
  'Gruv Master': [
    { key: 'curate',          label: 'Curate a scene / trusted-moderator powers', icon: 'award',      earned: true },
    { key: 'verified_badge',  label: 'Verified "Gruv Master" badge',             icon: 'check-circle',earned: true },
    { key: 'endorse',         label: 'Endorsements that nudge the Lineup',       icon: 'trending-up', earned: true },
    { key: 'secret_gruvs',    label: 'Access secret / underground Gruvs',        icon: 'key',         earned: true },
    { key: 'tastemaker',      label: 'Tastemaker rail others can follow',        icon: 'list',        earned: true },
    { key: 'spotlight',       label: 'Profile spotlight in "Vibers to know"',    icon: 'sun',         earned: true },
  ],
  'Legend': [
    { key: 'collectible_card',label: '1-of-a-kind animated Vibe Card',           icon: 'star',        earned: true },
    { key: 'found_movement',  label: 'Found an official scene / movement',       icon: 'flag',        earned: true },
    { key: 'ambassador',      label: 'Ambassador status — real-world perks',     icon: 'globe',       earned: true },
    { key: 'shape_product',   label: "Shape the product (founder's council)",    icon: 'compass',     earned: true },
  ],
};

/** Unlocks introduced AT a given tier. */
export function unlocksForLevel(levelName) {
  return LEVEL_UNLOCKS[levelName] || [];
}

/** Everything a Viber has unlocked so far (their tier + all tiers below). */
export function unlockedSoFar(score) {
  const { name } = getVibeLevel(score);
  const idx = VIBE_LEVELS.findIndex((l) => l.name === name);
  const out = [];
  for (let i = 0; i <= idx; i++) out.push(...unlocksForLevel(VIBE_LEVELS[i].name));
  return out;
}

/** The unlocks waiting at the NEXT tier (empty at the top). */
export function nextUnlocks(score) {
  const { next } = getVibeLevel(score);
  return next ? unlocksForLevel(next) : [];
}
