/**
 * mapContributions.js — the catalog of ways a user can update the live map
 * themselves. Text-only, tap-to-drop: no photos, no video, just a typed pin the
 * community then confirms or disputes (Truth Protocol). This is the "we build it
 * for them" layer — the map stays true because the people actually there keep it
 * true, not because an organiser said so.
 *
 * Each type: { key, label, icon (Feather), color, group, ttlH (hours it stays
 * live before auto-expiring) }. Short TTLs for fast-moving facts (a queue), long
 * for stable ones (an accessible entrance). Groups drive the picker's sections.
 *
 * Adding a "way" = adding one row here — the engine (map_reports + mapReports.js)
 * is generic, so the catalog is the single source of truth for all 50+.
 */
const T = (key, label, icon, color, group, ttlH) => ({ key, label, icon, color, group, ttlH });

// palette
const RED = '#ef4444', AMBER = '#f59e0b', GREEN = '#10b981', CYAN = '#06b6d4',
      BLUE = '#3b82f6', PURPLE = '#a855f7', PINK = '#ec4899', YELLOW = '#eab308',
      TEAL = '#14b8a6', ORANGE = '#f97316', SLATE = '#64748b';

export const MAP_REPORT_TYPES = [
  // ── Safety (visibility = safety) ──────────────────────────────────────────
  T('unsafe_area',    'Unsafe area',        'alert-triangle', RED,   'Safety', 6),
  T('poor_lighting',  'Poorly lit',         'moon',           SLATE, 'Safety', 12),
  T('harassment',     'Harassment here',    'alert-octagon',  RED,   'Safety', 6),
  T('pickpockets',    'Watch your things',  'eye',            AMBER, 'Safety', 8),
  T('safe_spot',      'Safe spot',          'shield',         GREEN, 'Safety', 12),
  T('security_here',  'Security present',    'shield',         GREEN, 'Safety', 6),
  T('well_lit',       'Well lit & busy',    'sun',            GREEN, 'Safety', 12),
  T('police_nearby',  'Police nearby',      'shield',         BLUE,  'Safety', 6),
  T('medical_point',  'Medical / first aid','plus-square',    RED,   'Safety', 12),
  T('lost_found',     'Lost & found',       'help-circle',    CYAN,  'Safety', 12),

  // ── Getting there / away ──────────────────────────────────────────────────
  T('taxi_rank',      'Taxi rank',          'navigation',     YELLOW,'Transport', 24),
  T('ehail_pickup',   'e-Hailing pickup',   'navigation-2',   BLUE,  'Transport', 12),
  T('dropoff',        'Drop-off zone',      'log-out',        CYAN,  'Transport', 12),
  T('parking_ok',     'Parking available',  'square',         GREEN, 'Transport', 4),
  T('parking_full',   'Parking full',       'x-square',       RED,   'Transport', 3),
  T('paid_parking',   'Paid parking',       'dollar-sign',    AMBER, 'Transport', 24),
  T('road_closed',    'Road closed',        'slash',          RED,   'Transport', 8),
  T('heavy_traffic',  'Heavy traffic',      'alert-triangle', AMBER, 'Transport', 3),
  T('detour',         'Detour',             'corner-up-right',CYAN,  'Transport', 8),
  T('free_shuttle',   'Free shuttle',       'truck',          GREEN, 'Transport', 12),
  T('bus_stop',       'Bus / taxi stop',    'map-pin',        BLUE,  'Transport', 48),
  T('station',        'Train station',      'map-pin',        BLUE,  'Transport', 48),

  // ── Entry & queues ────────────────────────────────────────────────────────
  T('entrance',       'Entrance here',      'log-in',         GREEN, 'Entry', 24),
  T('exit',           'Exit here',          'log-out',        SLATE, 'Entry', 24),
  T('long_queue',     'Long queue',         'users',          RED,   'Entry', 2),
  T('short_queue',    'Short queue',        'user-check',     GREEN, 'Entry', 2),
  T('sold_out_door',  'Sold out at door',   'x-circle',       RED,   'Entry', 4),
  T('free_entry_now', 'Free entry now',     'gift',           GREEN, 'Entry', 3),
  T('id_check',       'ID check',           'credit-card',    AMBER, 'Entry', 6),
  T('dress_code',     'Dress code enforced','check-square',   PURPLE,'Entry', 6),
  T('accessible',     'Accessible entrance','heart',          TEAL,  'Entry', 48),

  // ── Amenities ─────────────────────────────────────────────────────────────
  T('free_water',     'Free water',         'droplet',        CYAN,  'Amenities', 6),
  T('water_refill',   'Water refill',       'droplet',        BLUE,  'Amenities', 12),
  T('toilets',        'Toilets',            'home',           SLATE, 'Amenities', 24),
  T('clean_toilets',  'Clean toilets',      'thumbs-up',      GREEN, 'Amenities', 6),
  T('atm',            'ATM',                'dollar-sign',    GREEN, 'Amenities', 48),
  T('cash_only',      'Cash only',          'dollar-sign',    AMBER, 'Amenities', 12),
  T('card_ok',        'Card accepted',      'credit-card',    GREEN, 'Amenities', 12),
  T('charging',       'Phone charging',     'battery-charging',YELLOW,'Amenities', 6),
  T('wifi',           'Free WiFi',          'wifi',           BLUE,  'Amenities', 12),
  T('cloakroom',      'Cloakroom',          'archive',        SLATE, 'Amenities', 12),
  T('smoking_area',   'Smoking area',       'wind',           SLATE, 'Amenities', 12),
  T('chill_area',     'Chill area',         'coffee',         TEAL,  'Amenities', 6),
  T('quiet_zone',     'Quiet zone',         'volume-x',       SLATE, 'Amenities', 6),

  // ── Food & drink ──────────────────────────────────────────────────────────
  T('food_here',      'Food here',          'coffee',         ORANGE,'Food', 6),
  T('cheap_food',     'Cheap eats',         'coffee',         GREEN, 'Food', 4),
  T('bar_here',       'Bar here',           'coffee',         PURPLE,'Food', 6),
  T('happy_hour',     'Happy hour',         'clock',          AMBER, 'Food', 2),

  // ── Vibe & crowd ──────────────────────────────────────────────────────────
  T('packed',         'Packed right now',   'users',          RED,   'Vibe', 2),
  T('dead',           'Quiet / dead',       'user',           SLATE, 'Vibe', 2),
  T('great_vibe',     'Great vibe',         'zap',            PINK,  'Vibe', 3),
  T('good_music',     'Music is 🔥',         'music',          PURPLE,'Vibe', 2),
  T('live_now',       'Live act on now',    'radio',          GREEN, 'Vibe', 2),
  T('winding_down',   'Winding down',       'sunset',         AMBER, 'Vibe', 2),
  T('afterparty',     'Afterparty here',    'moon',           PURPLE,'Vibe', 4),

  // ── Deals & people ────────────────────────────────────────────────────────
  T('special_on',     'Special on now',     'tag',            GREEN, 'Deals', 3),
  T('promoter_here',  'Promoter here',      'user-plus',      CYAN,  'Deals', 4),
  T('merch_here',     'Merch here',         'shopping-bag',   PINK,  'Deals', 6),
  T('meeting_point',  'Meeting point',      'flag',           BLUE,  'Deals', 6),
];

// Fast lookup + grouped view for the picker.
export const MAP_REPORT_BY_KEY = Object.fromEntries(MAP_REPORT_TYPES.map((t) => [t.key, t]));
export const MAP_REPORT_GROUPS = MAP_REPORT_TYPES.reduce((acc, t) => {
  (acc[t.group] = acc[t.group] || []).push(t);
  return acc;
}, {});
export const MAP_REPORT_KEYS = MAP_REPORT_TYPES.map((t) => t.key);

export default MAP_REPORT_TYPES;
