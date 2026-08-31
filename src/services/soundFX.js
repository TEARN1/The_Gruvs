/**
 * soundFX — The Gruvs' sonic identity.
 *
 * Every sound is SYNTHESIZED from one crystalline palette (sine/triangle bells
 * with quick electric pitch-sweeps + shimmer) so the app sounds like nowhere
 * else — no stock samples, no asset files. Recipes are rendered once to WAV
 * data-URIs and cached; playback is web (HTMLAudio) or native (expo-av),
 * guarded so a sound can NEVER crash or block the UI.
 *
 * Respects a user mute toggle (persisted). Throttled so bursts don't machine-gun.
 */
import { Platform } from 'react-native';
import { synth, HZ } from '../utils/soundSynth';

let Storage = null;
try { Storage = require('@react-native-async-storage/async-storage').default; } catch {}
let ExpoAudio = null; // lazy — native only
const IS_WEB = Platform.OS === 'web';
const VOLUME = 0.55;                 // audible but not jarring
const THROTTLE_MS = 120;             // same sound can't retrigger faster than this
const STORE_KEY = 'gruvs_sound_enabled_v1';

// ── The sound language ─────────────────────────────────────────────────────
// v = voice: { type, f0, f1?(sweep), start, dur, gain, decay?, attack? }
const R = (voices) => ({ sampleRate: 22050, voices });
const SHIM = 1.006; // shimmer detune ratio

export const SOUNDS = {
  // Incoming DM — friendly rising "bloop-bleep" with a spark.
  messageReceived: R([
    { type: 'sine', f0: HZ.E5, start: 0.0, dur: 0.12, gain: 0.5, decay: 0.09 },
    { type: 'sine', f0: HZ.G5, start: 0.1, dur: 0.16, gain: 0.55, decay: 0.10 },
    { type: 'triangle', f0: HZ.B5, start: 0.10, dur: 0.10, gain: 0.16, decay: 0.06 },
  ]),
  // Sent DM — quiet downward tick.
  messageSent: R([
    { type: 'sine', f0: HZ.A5, f1: HZ.E5, start: 0, dur: 0.085, gain: 0.34, decay: 0.05 },
  ]),
  // Generic notification / ping — bright major shimmer.
  notification: R([
    { type: 'sine', f0: HZ.C6, start: 0.0, dur: 0.18, gain: 0.42, decay: 0.12 },
    { type: 'sine', f0: HZ.E6, start: 0.02, dur: 0.18, gain: 0.28, decay: 0.12 },
    { type: 'triangle', f0: HZ.G6, start: 0.05, dur: 0.09, gain: 0.14, decay: 0.05 },
  ]),
  // TOUCH DOWN — the hero. Ascending arpeggio landing on a shimmering high C + sparkle.
  touchDown: R([
    { type: 'sine', f0: HZ.C5, start: 0.00, dur: 0.10, gain: 0.5, decay: 0.07 },
    { type: 'sine', f0: HZ.E5, start: 0.09, dur: 0.10, gain: 0.5, decay: 0.07 },
    { type: 'sine', f0: HZ.G5, start: 0.18, dur: 0.10, gain: 0.5, decay: 0.07 },
    { type: 'sine', f0: HZ.C6, start: 0.27, dur: 0.30, gain: 0.6, decay: 0.20 },
    { type: 'sine', f0: HZ.C6 * SHIM, start: 0.27, dur: 0.30, gain: 0.26, decay: 0.20 },
    { type: 'triangle', f0: HZ.E6, start: 0.30, dur: 0.12, gain: 0.20, decay: 0.08 },
    { type: 'triangle', f0: HZ.G6, start: 0.37, dur: 0.10, gain: 0.16, decay: 0.07 },
  ]),
  // Reaction / like — a quick electric pop.
  reaction: R([
    { type: 'sine', f0: HZ.G6, f1: HZ.E6, start: 0, dur: 0.07, gain: 0.4, decay: 0.04 },
  ]),
  // New follower — warm two-note chime.
  follow: R([
    { type: 'sine', f0: HZ.G5, start: 0.0, dur: 0.2, gain: 0.45, decay: 0.13 },
    { type: 'sine', f0: HZ.C6, start: 0.06, dur: 0.22, gain: 0.4, decay: 0.14 },
  ]),
  // Incoming call — insistent two-tone ring. Deliberately longer and more
  // urgent than a ping; the caller loops it while the call is ringing.
  ringtone: R([
    { type: 'sine', f0: HZ.E6, start: 0.00, dur: 0.4, gain: 0.6, decay: 0.15 },
    { type: 'sine', f0: HZ.E6 * SHIM, start: 0.02, dur: 0.4, gain: 0.3, decay: 0.15 },
    { type: 'triangle', f0: HZ.E5, start: 0.00, dur: 0.35, gain: 0.15, decay: 0.1 },
    { type: 'sine', f0: HZ.C6, start: 0.45, dur: 0.45, gain: 0.6, decay: 0.15 },
    { type: 'sine', f0: HZ.C6 * SHIM, start: 0.47, dur: 0.45, gain: 0.3, decay: 0.15 },
    { type: 'triangle', f0: HZ.C5, start: 0.45, dur: 0.4, gain: 0.15, decay: 0.1 },
  ]),
  // Caller ringback — the "purr" YOU hear while waiting for them to pick up.
  // Deliberately softer, lower and more spaced than the incoming ringtone so the
  // two ends of the same call never sound alike.
  ringback: R([
    { type: 'sine', f0: HZ.C5, start: 0.00, dur: 0.8, gain: 0.4, decay: 0.4 },
    { type: 'sine', f0: HZ.C5 * 1.002, start: 0.02, dur: 0.8, gain: 0.2, decay: 0.4 },
  ]),
  // Soft error — a gentle low "donk", never harsh.
  error: R([
    { type: 'sine', f0: HZ.Bb3, f1: HZ.G3, start: 0, dur: 0.18, gain: 0.4, decay: 0.11 },
    { type: 'triangle', f0: HZ.G3, start: 0.0, dur: 0.14, gain: 0.14, decay: 0.09 },
  ]),
  // Level up / achievement — celebratory run up the scale into a chord.
  levelUp: R([
    { type: 'sine', f0: HZ.C5, start: 0.00, dur: 0.10, gain: 0.45, decay: 0.07 },
    { type: 'sine', f0: HZ.E5, start: 0.08, dur: 0.10, gain: 0.45, decay: 0.07 },
    { type: 'sine', f0: HZ.G5, start: 0.16, dur: 0.10, gain: 0.45, decay: 0.07 },
    { type: 'sine', f0: HZ.C6, start: 0.24, dur: 0.10, gain: 0.45, decay: 0.07 },
    { type: 'sine', f0: HZ.E6, start: 0.32, dur: 0.24, gain: 0.4, decay: 0.16 },
    { type: 'sine', f0: HZ.G6, start: 0.34, dur: 0.22, gain: 0.28, decay: 0.15 },
  ]),
  // Host alert — someone Touched Down at YOUR event, or a beacon lit nearby.
  // Distinct from generic `notification`: warmer and more insistent, because
  // it's telling a host something is happening at THEIR Gruv right now, not
  // just "you have a ping".
  hostAlert: R([
    { type: 'triangle', f0: HZ.G5, start: 0.00, dur: 0.14, gain: 0.42, decay: 0.09 },
    { type: 'sine', f0: HZ.C6, start: 0.05, dur: 0.16, gain: 0.5, decay: 0.10 },
    { type: 'sine', f0: HZ.C6 * SHIM, start: 0.05, dur: 0.16, gain: 0.2, decay: 0.10 },
  ]),
  // Mutual interest — a private match. Deliberately its own thing: warmer than
  // levelUp (this isn't an achievement, it's two people), quicker than
  // touchDown (this is a quiet, personal moment, not a hero beat for a crowd).
  match: R([
    { type: 'sine', f0: HZ.E5, start: 0.00, dur: 0.11, gain: 0.42, decay: 0.08 },
    { type: 'sine', f0: HZ.A5, start: 0.07, dur: 0.14, gain: 0.46, decay: 0.09 },
    { type: 'sine', f0: HZ.C6, start: 0.15, dur: 0.22, gain: 0.5, decay: 0.15 },
    { type: 'sine', f0: HZ.C6 * SHIM, start: 0.15, dur: 0.22, gain: 0.22, decay: 0.15 },
    { type: 'triangle', f0: HZ.E6, start: 0.18, dur: 0.10, gain: 0.16, decay: 0.06 },
  ]),
};

// ── Channels ───────────────────────────────────────────────────────────────
// A "channel" is what an event MEANS, not which specific recipe plays for it.
// Callers fire a channel (playChannel('dm')); which SOUNDS[name] answers it is
// resolvable per-user (Settings → tone picker) and, later, purchasable as a
// pack — without ever touching a call site. Every default below preserves
// today's exact behaviour; only level_up genuinely changes (see below).
export const CHANNELS = {
  dm:          { label: 'Messages',        defaultSound: 'messageReceived' },
  follow:      { label: 'New followers',   defaultSound: 'follow' },
  reaction:    { label: 'Likes & vibes',   defaultSound: 'reaction' },
  touchDown:   { label: 'Touch Down',      defaultSound: 'touchDown' },
  hostAlert:   { label: 'Host alerts',     defaultSound: 'hostAlert' },
  levelUp:     { label: 'Level up',        defaultSound: 'levelUp' },
  match:       { label: 'Matches',         defaultSound: 'match' },
  notification: { label: 'Everything else', defaultSound: 'notification' },
};

const CHANNEL_STORE_KEY = 'gruvs_channel_tones_v1';
let channelPrefs = null; // { [channelKey]: soundName } — user overrides only

// ── State ──────────────────────────────────────────────────────────────────
let enabled = true;
let loaded = false;
const uriCache = {};        // name -> data URI (rendered once)
const lastPlayed = {};      // name -> ts (throttle)

function uriFor(name) {
  if (!uriCache[name]) {
    const recipe = SOUNDS[name];
    if (!recipe) return null;
    try { uriCache[name] = synth(recipe); } catch { return null; }
  }
  return uriCache[name];
}

async function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  try {
    const v = Storage ? await Storage.getItem(STORE_KEY) : null;
    if (v === '0') enabled = false;
  } catch {}
  try {
    const raw = Storage ? await Storage.getItem(CHANNEL_STORE_KEY) : null;
    channelPrefs = raw ? JSON.parse(raw) : {};
  } catch { channelPrefs = {}; }
}

/** The sound name a channel actually plays right now (override, else default). */
function resolveChannelSound(channelKey) {
  const channel = CHANNELS[channelKey];
  if (!channel) return null;
  const override = channelPrefs?.[channelKey];
  return (override && SOUNDS[override]) ? override : channel.defaultSound;
}

// ── Public API ───────────────────────────────────────────────────────────────
export const SoundFX = {
  async init() { await ensureLoaded(); },

  isEnabled() { return enabled; },

  async setEnabled(on) {
    enabled = !!on;
    try { if (Storage) await Storage.setItem(STORE_KEY, on ? '1' : '0'); } catch {}
    if (on) this.play('follow'); // little confirmation chime
  },

  /**
   * Fire whatever sound is currently assigned to a channel. Every call site
   * that used to do `SoundFX.play('someRawSoundName')` for something that maps
   * to a real category (a DM, a host alert, a match) should call this instead
   * — it's the one place a user's tone choice, and later a purchased pack,
   * actually takes effect.
   */
  playChannel(channelKey) {
    const name = resolveChannelSound(channelKey);
    if (name) this.play(name);
  },

  /** All channels, for a Settings picker. */
  listChannels() {
    return Object.entries(CHANNELS).map(([key, c]) => ({ key, label: c.label, sound: resolveChannelSound(key) }));
  },

  /** Every sound name a channel could be assigned to, for a picker's options. */
  availableSounds() {
    return Object.keys(SOUNDS);
  },

  /** "messageReceived" -> "Message Received" — a human label for a picker. */
  soundLabel(name) {
    return String(name || '')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/^./, (c) => c.toUpperCase());
  },

  getChannelSound(channelKey) {
    return resolveChannelSound(channelKey);
  },

  /** Assign a channel to a specific sound and persist it. Previews immediately. */
  async setChannelSound(channelKey, soundName) {
    if (!CHANNELS[channelKey] || !SOUNDS[soundName]) return false;
    channelPrefs = { ...(channelPrefs || {}), [channelKey]: soundName };
    try { if (Storage) await Storage.setItem(CHANNEL_STORE_KEY, JSON.stringify(channelPrefs)); } catch {}
    this.play(soundName); // hear your choice immediately
    return true;
  },

  /** Fire a sound by name. Never throws, never blocks. */
  play(name) {
    try {
      if (!enabled || !SOUNDS[name]) return;
      const now = Date.now();
      if (lastPlayed[name] && now - lastPlayed[name] < THROTTLE_MS) return;
      lastPlayed[name] = now;
      const uri = uriFor(name);
      if (!uri) return;

      if (IS_WEB) {
        if (typeof Audio === 'undefined') return;
        const a = new Audio(uri);
        a.volume = VOLUME;
        // play() rejects before the first user gesture (autoplay policy) — ignore.
        const p = a.play();
        if (p && p.catch) p.catch(() => {});
      } else {
        if (!ExpoAudio) { try { ExpoAudio = require('expo-av').Audio; } catch { return; } }
        ExpoAudio.Sound.createAsync({ uri }, { volume: VOLUME, shouldPlay: true })
          .then(({ sound }) => {
            sound.setOnPlaybackStatusUpdate((s) => {
              if (s && s.didJustFinish) sound.unloadAsync().catch(() => {});
            });
          })
          .catch(() => {});
      }
    } catch { /* sound must be invisible on failure */ }
  },
};

// ── Web autoplay unlock ──────────────────────────────────────────────────────
// A browser silently drops Audio.play() until the user has interacted with the
// page. That's why an INCOMING RINGTONE could be inaudible — the callee is just
// staring at the screen, no gesture yet. So on the very first interaction we
// "prime" playback (play → immediately pause a real clip), after which every
// later play() — including the looping ringtone — is allowed for the session.
let _unlocked = false;
function primeAudio() {
  if (_unlocked || !IS_WEB || typeof Audio === 'undefined') return;
  _unlocked = true;
  try {
    const uri = uriFor('reaction'); // any cheap clip warms the pipeline
    if (!uri) return;
    const a = new Audio(uri);
    a.volume = 0; // silent prime
    const p = a.play();
    if (p && p.then) p.then(() => { try { a.pause(); a.currentTime = 0; } catch {} }).catch(() => {});
  } catch {}
}
if (IS_WEB && typeof window !== 'undefined' && window.addEventListener) {
  const evs = ['pointerdown', 'touchstart', 'keydown', 'click'];
  const onGesture = () => { primeAudio(); evs.forEach((e) => window.removeEventListener(e, onGesture)); };
  evs.forEach((e) => window.addEventListener(e, onGesture, { passive: true }));
}

export default SoundFX;
