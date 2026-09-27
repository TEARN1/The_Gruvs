// ── Status palette ────────────────────────────────────────────────────────────
// Semantic status tokens with a hard rule: status is NEVER conveyed by colour
// alone (#264 / #269). Every token carries an icon + label too, so it stays
// legible under deuteranopia/protanopia, for screen readers, and in glare at 1am.
// Render colour AND icon AND (where space allows) label — never just the colour.

export const STATUS = {
  live:     { color: '#10b981', icon: 'radio',          label: 'Live' },
  verified: { color: '#10b981', icon: 'check-circle',   label: 'Verified' },
  hot:      { color: '#f97316', icon: 'trending-up',    label: 'Hot' },
  intent:   { color: '#f59e0b', icon: 'clock',          label: 'Filling' },
  warning:  { color: '#f59e0b', icon: 'alert-triangle', label: 'Heads up' },
  full:     { color: '#ef4444', icon: 'slash',          label: 'Full' },
  free:     { color: '#22d3ee', icon: 'tag',            label: 'Free' },
  muted:    { color: '#9ca3af', icon: 'minus',          label: '' },
};

export function statusToken(key) {
  return STATUS[key] || STATUS.muted;
}
