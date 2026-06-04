/**
 * EVENT_TAGS — free, host-declared "good to know" tags for accessibility,
 * safety, sensory warnings and vibe. No cost, no API — just attributes on the
 * event that render as badges and (later) feed filters. Helps The Gruvs be the
 * responsible, inclusive SA nightlife platform.
 */
export const EVENT_TAGS = [
  // Accessibility
  { key: 'wheelchair',          label: 'Wheelchair access',   emoji: '♿',  color: '#38bdf8', group: 'Access' },
  { key: 'accessible_restroom', label: 'Accessible restroom', emoji: '🚻', color: '#38bdf8', group: 'Access' },
  { key: 'seating',             label: 'Seating',             emoji: '🪑', color: '#38bdf8', group: 'Access' },
  { key: 'quiet_zone',          label: 'Quiet zone',          emoji: '🌙', color: '#a78bfa', group: 'Access' },

  // Sensory warnings
  { key: 'strobe',              label: 'Strobe lights',       emoji: '⚠️', color: '#f59e0b', group: 'Sensory' },
  { key: 'loud',                label: 'Very loud',           emoji: '🔊', color: '#f59e0b', group: 'Sensory' },
  { key: 'pyro',                label: 'Pyrotechnics',        emoji: '🎆', color: '#f59e0b', group: 'Sensory' },

  // Vibe
  { key: 'sober_friendly',      label: 'Sober-friendly',      emoji: '🚭', color: '#10b981', group: 'Vibe' },
  { key: 'all_ages',            label: 'All ages',            emoji: '👪', color: '#10b981', group: 'Vibe' },

  // Safety / parking
  { key: 'gated_parking',       label: 'Gated parking',       emoji: '🅿️', color: '#34d399', group: 'Safety' },
  { key: 'car_guards',          label: 'Car guards',          emoji: '🦺', color: '#34d399', group: 'Safety' },
  { key: 'uber_dropoff',        label: 'Uber drop-off',       emoji: '🚕', color: '#34d399', group: 'Safety' },

  // Eco / transit
  { key: 'eco_friendly',        label: 'Eco-friendly',        emoji: '🌱', color: '#84cc16', group: 'Eco' },
  { key: 'near_transit',        label: 'Near transit',        emoji: '🚆', color: '#06b6d4', group: 'Transit' },
];

export const EVENT_TAG_MAP = Object.fromEntries(EVENT_TAGS.map((t) => [t.key, t]));
