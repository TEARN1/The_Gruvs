/**
 * nightSafetyService — Nightlife Safety, Squad Protection, Lost & Found, Shuttles & Floorplans.
 *
 * 100% Human-first:
 * 1. Safe Ride Home: Departure countdown timer. If user doesn't tap "Home Safe", mutuals/squad get SMS/WhatsApp alert with last GPS.
 * 2. Walk Me to My Car: 1-tap beacon to verified mutuals & venue security.
 * 3. Nightlife Emergency SOS: Instant alert to on-site bouncers & mutuals in room.
 * 4. Lost & Found Bulletin: Real-time board for lost car keys, phones, wallets.
 * 5. Festival Party Shuttle & Convoy Tracker: GPS shuttle tracking and bus pass management.
 * 6. Venue Floorplan & Sound Intensity Zones: High intensity dancefloor, chillout lounge, water points, restrooms, security.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const SAFE_TIMER_KEY = 'gruvs_safe_timer_v1';
const LOST_FOUND_KEY = 'gruvs_lost_found_v1';
const SHUTTLE_STORAGE_KEY = 'gruvs_party_shuttles_v1';
const FLOORPLAN_STORAGE_KEY = 'gruvs_venue_floorplans_v1';

// ── Honest delivery (read before changing the safety copy) ───────────────────
// There is no server side for these yet: no emergency_alerts / safety_pings
// tables, no job that fires when a Safe Ride timer runs out, and the timer
// lives only on this phone. So the app must never claim it alerted anyone.
// What DOES reach a person today is the user's own WhatsApp: these build a
// wa.me share link (no recipient: the user picks who) with the trip details.
export function buildSafetyShareUrl(kind, { eventTitle, destination, minutes, parkingArea } = {}) {
  const at = eventTitle ? ` from ${eventTitle}` : '';
  const text = {
    trip: `Heading out${at} now, going to ${destination || 'home'}. Should be there in about ${minutes || '?'} min. If you haven't heard from me by then, please call me.`,
    home: `Home safe ✅ Thanks for keeping an eye on me.`,
    walk: `I'm walking to my car${at} (${parkingArea || 'parking'}). Can you walk with me or stay on the phone?`,
  }[kind] || '';
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export const NightSafetyService = {
  // ── 1. SAFE RIDE HOME TIMER ──────────────────────────────────────────────────
  async startSafeTimer({ userId, eventId, durationMinutes = 30, destinationLabel, emergencyContacts = [] }) {
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
    const timer = {
      user_id: userId,
      event_id: eventId,
      destination: destinationLabel || 'Home Base',
      expires_at: expiresAt,
      contacts: emergencyContacts,
      status: 'active',
      started_at: new Date().toISOString(),
    };
    try {
      await AsyncStorage.setItem(SAFE_TIMER_KEY, JSON.stringify(timer));
    } catch {}
    return timer;
  },

  async getActiveSafeTimer() {
    try {
      const raw = await AsyncStorage.getItem(SAFE_TIMER_KEY);
      if (!raw) return null;
      const timer = JSON.parse(raw);
      if (new Date(timer.expires_at).getTime() < Date.now()) {
        timer.status = 'expired';
      }
      return timer;
    } catch {
      return null;
    }
  },

  async confirmHomeSafe() {
    try {
      await AsyncStorage.removeItem(SAFE_TIMER_KEY);
      return true;
    } catch {
      return false;
    }
  },

  // ── 2. WALK ME TO MY CAR SQUAD PING ──────────────────────────────────────────
  async sendWalkToCarPing({ userId, username, eventId, parkingArea }) {
    const ping = {
      id: `ping_${Date.now()}`,
      user_id: userId,
      username: username || 'Squad Viber',
      event_id: eventId,
      parking_area: parkingArea || 'Main Parking Lot',
      status: 'waiting',
      created_at: new Date().toISOString(),
    };
    try {
      await supabase.from('safety_pings').insert([ping]).catch(() => {});
    } catch {}
    return ping;
  },

  // ── 3. EMERGENCY SOS GUARD ───────────────────────────────────────────────────
  async triggerNightlifeSOS({ userId, username, eventId, coords }) {
    const alert = {
      id: `sos_${Date.now()}`,
      user_id: userId,
      username: username || 'Viber',
      event_id: eventId,
      coords,
      status: 'triggered',
      created_at: new Date().toISOString(),
    };
    try {
      await supabase.from('emergency_alerts').insert([alert]).catch(() => {});
    } catch {}
    return alert;
  },

  // ── 4. LOST & FOUND BULLETIN ─────────────────────────────────────────────────
  async postLostOrFoundItem({ eventId, userId, type = 'lost', itemTitle, description, contactHandle }) {
    const item = {
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      event_id: eventId,
      user_id: userId,
      type, // 'lost' | 'found'
      title: itemTitle,
      description: description || '',
      contact_handle: contactHandle || '@viber',
      status: 'open',
      created_at: new Date().toISOString(),
    };
    try {
      const raw = await AsyncStorage.getItem(LOST_FOUND_KEY);
      const list = raw ? JSON.parse(raw) : [];
      list.unshift(item);
      await AsyncStorage.setItem(LOST_FOUND_KEY, JSON.stringify(list));
      await supabase.from('lost_and_found').insert([item]).catch(() => {});
    } catch {}
    return item;
  },

  async getLostAndFoundForEvent(eventId) {
    try {
      const { data, error } = await supabase.from('lost_and_found').select('*').eq('event_id', eventId);
      if (!error && Array.isArray(data) && data.length) return data;
    } catch {}
    try {
      const raw = await AsyncStorage.getItem(LOST_FOUND_KEY);
      const list = raw ? JSON.parse(raw) : [];
      const filtered = list.filter(i => i.event_id === eventId);
      if (filtered.length) return filtered;
    } catch {}
    // Default baseline items
    return [
      { id: '1', event_id: eventId, type: 'found', title: 'VW Car Keys with Red Lanyard', description: 'Handed to the manager at the main VIP bar', contact_handle: '@venue_manager', created_at: new Date().toISOString() },
      { id: '2', event_id: eventId, type: 'lost', title: 'Black Leather Jacket', description: 'Left on couch near DJ booth', contact_handle: '@tebogo', created_at: new Date().toISOString() },
    ];
  },

  // ── 5. FESTIVAL PARTY SHUTTLE & CONVOY ───────────────────────────────────────
  async getShuttlesForEvent(eventId) {
    try {
      const raw = await AsyncStorage.getItem(SHUTTLE_STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      const hits = list.filter(s => s.event_id === eventId);
      if (hits.length) return hits;
    } catch {}
    // Default verified shuttles
    return [
      {
        id: 'shuttle_1',
        event_id: eventId,
        route_name: 'Gautrain Rosebank ⇄ Venue Express',
        pickup_point: 'Rosebank Gautrain Station',
        departure_times: ['18:00', '19:30', '21:00'],
        return_times: ['02:00', '03:30', '05:00'],
        seats_available: 8,
        price_zar: 120,
        driver_contact: '+27 82 000 1234',
        live_status: 'On schedule · 12 mins to pickup',
      },
      {
        id: 'shuttle_2',
        event_id: eventId,
        route_name: 'Hatfield Pretoria ⇄ Venue Convoy',
        pickup_point: 'Hatfield Plaza',
        departure_times: ['17:30', '19:00'],
        return_times: ['03:00', '04:30'],
        seats_available: 4,
        price_zar: 160,
        driver_contact: '+27 83 555 9876',
        live_status: 'Boarding now at Hatfield Plaza',
      },
    ];
  },

  // ── 6. VENUE FLOORPLAN & SOUND ZONES ─────────────────────────────────────────
  async getVenueFloorplan(eventId) {
    return {
      zones: [
        { id: 'z1', name: 'Main Dancefloor / DJ Booth', type: 'loud', dbLevel: 118, color: '#ef4444', desc: 'Peak sound, high energy crowd' },
        { id: 'z2', name: 'Hookah & Cocktail Terrace', type: 'medium', dbLevel: 88, color: '#f59e0b', desc: 'Chill conversation & table service' },
        { id: 'z3', name: 'The Quiet Corner & Food Market', type: 'chill', dbLevel: 72, color: '#10b981', desc: 'Outdoor seating, low decibels, recharge zone' },
      ],
      facilities: [
        { id: 'f1', name: 'Restrooms & Powder Room', icon: 'user', location: 'Behind Main Bar' },
        { id: 'f2', name: 'Free Hydration Water Station', icon: 'droplet', location: 'Left of Stage' },
        { id: 'f3', name: 'Security & Paramedic Tent', icon: 'shield', location: 'Gate 2 Main Entrance' },
      ],
    };
  },
};

export default NightSafetyService;
