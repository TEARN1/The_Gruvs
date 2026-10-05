/**
 * boothAndStreetService — DJ Booth Audio, Track ID Radar, Kota Order Pipeline, 3AM Recovery & Car Meets.
 *
 * 100% Human-first:
 * 1. "Live From The Booth": 15-second ambient soundboard audio drops from resident DJs.
 * 2. DJ Live Tracklist & Unreleased ID Radar: Live track names and crowdsourced dubplate IDs.
 * 3. Crowd Song Request Bounties: Attendees pooling coins to bump tracks in the DJ queue.
 * 4. Kota Live Order Pipeline: Real-time progress (Kitchen Received → On Grill → Chips Frying → Ready).
 * 5. 3 AM After-Groove Recovery Radar: Open 24/7 petrol station kitchens, car washes, and street braai spots.
 * 6. Kasi Car Culture & Sound-Off: Decibel sound-off competition meter & multi-car convoy tracker.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const BOOTH_DROPS_KEY = 'gruvs_booth_audio_drops_v1';
const TRACKLIST_KEY = 'gruvs_live_tracklist_v1';
const KOTA_PIPELINE_KEY = 'gruvs_kota_pipeline_v1';
const SOUNDOFF_KEY = 'gruvs_soundoff_leaderboard_v1';

export const BoothAndStreetService = {
  // ── 1. LIVE FROM THE BOOTH AUDIO DROPS ───────────────────────────────────────
  async getLatestBoothDrop(eventId) {
    try {
      const raw = await AsyncStorage.getItem(BOOTH_DROPS_KEY);
      const map = raw ? JSON.parse(raw) : {};
      if (map[eventId]) return map[eventId];
    } catch {}
    // Default sample booth drop
    return {
      id: 'drop_sample',
      event_id: eventId,
      dj_name: 'DJ Stokie',
      track_genre: 'Private School Piano',
      duration_sec: 15,
      recorded_at: '20 mins ago',
      audio_url: 'https://actions.google.com/sounds/v1/crowds/club_cheer.ogg',
      energy_level: 'PEAK GROOVE 🔥',
    };
  },

  async postBoothAudioDrop({ eventId, djName, genre, energyLevel }) {
    const drop = {
      id: `drop_${Date.now()}`,
      event_id: eventId,
      dj_name: djName || 'Resident DJ',
      track_genre: genre || 'Amapiano / Deep House',
      duration_sec: 15,
      recorded_at: 'Just now',
      energy_level: energyLevel || 'JUMPING ⚡',
      audio_url: 'https://actions.google.com/sounds/v1/crowds/club_cheer.ogg',
    };
    try {
      const raw = await AsyncStorage.getItem(BOOTH_DROPS_KEY);
      const map = raw ? JSON.parse(raw) : {};
      map[eventId] = drop;
      await AsyncStorage.setItem(BOOTH_DROPS_KEY, JSON.stringify(map));
    } catch {}
    return drop;
  },

  // ── 2. DJ TRACKLIST & UNRELEASED ID RADAR ────────────────────────────────────
  async getLiveTracklist(eventId) {
    try {
      const raw = await AsyncStorage.getItem(TRACKLIST_KEY);
      const map = raw ? JSON.parse(raw) : {};
      if (map[eventId]) return map[eventId];
    } catch {}
    return [
      { id: 't1', title: 'Kelvin Momo - Exclusive Dubplate ID (unreleased)', timestamp: '01:15', identifiedBy: '@dj_resident', verified: true },
      { id: 't2', title: 'De Mthuda - John Wick Vocal Mix', timestamp: '00:45', identifiedBy: '@amapiano_head', verified: true },
      { id: 't3', title: 'Kabza De Small - Horns of Soweto (Live Flute Edit)', timestamp: '00:10', identifiedBy: '@kagiso', verified: true },
    ];
  },

  async addTrackId({ eventId, trackTitle, timestamp, userHandle }) {
    const track = {
      id: `tr_${Date.now()}`,
      title: trackTitle,
      timestamp: timestamp || 'Live Now',
      identifiedBy: userHandle || '@you',
      verified: true,
    };
    try {
      const raw = await AsyncStorage.getItem(TRACKLIST_KEY);
      const map = raw ? JSON.parse(raw) : {};
      const list = map[eventId] || [];
      list.unshift(track);
      map[eventId] = list;
      await AsyncStorage.setItem(TRACKLIST_KEY, JSON.stringify(map));
    } catch {}
    return track;
  },

  // ── 3. CROWD SONG REQUEST BOUNTIES ───────────────────────────────────────────
  async boostSongRequest(songId, coinBounty) {
    return { success: true, newBounty: (coinBounty || 10) + 15 };
  },

  // ── 4. KOTA LIVE ORDER PIPELINE ──────────────────────────────────────────────
  async getKotaOrdersForUser(userId) {
    try {
      const raw = await AsyncStorage.getItem(KOTA_PIPELINE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      if (list.length) return list;
    } catch {}
    return [
      {
        id: 'ord_1',
        kitchen_name: 'Braamfontein Legendary Kotas',
        combo_name: 'The Big Boy Quarter (Russian, Egg, Cheese, Atchar)',
        stage: 'grill', // 'received' | 'grill' | 'frying' | 'ready'
        eta_minutes: 8,
        price_zar: 65,
        updated_at: new Date().toISOString(),
      },
    ];
  },

  async placeKotaOrder({ kitchenName, comboName, priceZar, customerHandle }) {
    const order = {
      id: `ord_${Date.now()}`,
      kitchen_name: kitchenName || 'Kasi Corner Kitchen',
      combo_name: comboName,
      stage: 'received',
      eta_minutes: 12,
      price_zar: priceZar || 65,
      customer_handle: customerHandle || '@you',
      updated_at: new Date().toISOString(),
    };
    try {
      const raw = await AsyncStorage.getItem(KOTA_PIPELINE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      list.unshift(order);
      await AsyncStorage.setItem(KOTA_PIPELINE_KEY, JSON.stringify(list));
    } catch {}
    return order;
  },

  // ── 5. 3 AM AFTER-GROOVE RECOVERY RADAR ──────────────────────────────────────
  async getRecoverySpots(eventId) {
    return [
      {
        id: 'r1',
        name: 'TotalEnergies 24/7 Bonjour & Bakery',
        type: 'petrol_kitchen',
        distanceKm: 1.2,
        openStatus: 'Open 24/7 · Hot Pies & Coffee',
        perk: 'Fresh rolls & cold drinks',
      },
      {
        id: 'r2',
        name: 'Soweto Midnight Shisanyama & Carwash',
        type: 'street_braai',
        distanceKm: 2.4,
        openStatus: 'Open until 05:30 AM',
        perk: 'Hot brisket & pap + night car wash',
      },
      {
        id: 'r3',
        name: 'Sasol Delight Express & Pies',
        type: 'petrol_kitchen',
        distanceKm: 0.8,
        openStatus: 'Open 24/7',
        perk: 'Ice & quick recovery energy drinks',
      },
    ];
  },

  // ── 6. KASI CAR CULTURE & SOUND-OFF LEADERBOARD ──────────────────────────────
  async getSoundOffLeaderboard(eventId) {
    try {
      const raw = await AsyncStorage.getItem(SOUNDOFF_KEY);
      const map = raw ? JSON.parse(raw) : {};
      if (map[eventId]) return map[eventId];
    } catch {}
    return [
      { rank: 1, car_model: 'Golf 7R (Red Devil)', crew: 'Soweto Vw Crew', decibels: 134.8, category: 'Bass Reflex' },
      { rank: 2, car_model: 'BMW E30 325is (Gusheshe)', crew: 'East Rand Stance', decibels: 131.2, category: 'Exhaust Tone' },
      { rank: 3, car_model: 'Toyota RSI TwinCam', crew: 'Pretoria Spinning Squad', decibels: 128.5, category: 'Engine Roar' },
    ];
  },

  async logSoundOffScore({ eventId, carModel, crew, decibels, category }) {
    const entry = {
      id: `db_${Date.now()}`,
      event_id: eventId,
      car_model: carModel,
      crew: crew || 'Independent',
      decibels: Number(decibels),
      category: category || 'Sound System',
    };
    try {
      const raw = await AsyncStorage.getItem(SOUNDOFF_KEY);
      const map = raw ? JSON.parse(raw) : {};
      const list = map[eventId] || [];
      list.push(entry);
      list.sort((a, b) => b.decibels - a.decibels);
      map[eventId] = list;
      await AsyncStorage.setItem(SOUNDOFF_KEY, JSON.stringify(map));
    } catch {}
    return entry;
  },
};

export default BoothAndStreetService;
