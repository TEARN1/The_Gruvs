/**
 * soundSynth — a tiny, dependency-free additive synthesizer.
 *
 * Turns a "recipe" (a set of tone voices with pitch sweeps + bell envelopes)
 * into a WAV audio data-URI, entirely in JS. No audio files, no assets, no
 * network — so the app's whole sonic identity is generated from one code
 * palette (unique to The Gruvs, tiny footprint, works offline, web + native).
 *
 * Pure + deterministic → unit-tested. Playback lives in services/soundFX.
 *
 * Recipe shape:
 *   { sampleRate?: 22050, voices: [ Voice, ... ] }
 *   Voice = { type:'sine'|'triangle', f0, f1?, start, dur, gain,
 *             attack?, decay?  }   // f1 = sweep target; decay = e-fold seconds
 */

const TWO_PI = Math.PI * 2;

// Named frequencies (Hz) for readable recipes.
export const HZ = {
  G3: 196.0, Bb3: 233.08, C4: 261.63,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77,
  C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98,
};

function wave(type, phase) {
  if (type === 'triangle') return (2 / Math.PI) * Math.asin(Math.sin(phase));
  // default: sine
  return Math.sin(phase);
}

// Attack (linear) → exponential decay, with a tiny tail fade to kill clicks.
function envelope(t, dur, attack, decayTau) {
  let a;
  if (t < attack) a = attack > 0 ? t / attack : 1;
  else a = Math.exp(-(t - attack) / (decayTau || 0.1));
  const tail = Math.min(1, (dur - t) / 0.008); // 8ms fade-out
  return a * Math.max(0, Math.min(1, tail));
}

/** Render a recipe to a Float32Array of mono samples in [-1, 1]. */
export function renderSamples(recipe = {}) {
  const sr = recipe.sampleRate || 22050;
  const voices = Array.isArray(recipe.voices) ? recipe.voices : [];
  let end = 0;
  for (const v of voices) end = Math.max(end, (v.start || 0) + (v.dur || 0));
  const n = Math.max(1, Math.ceil((end + 0.02) * sr));
  const buf = new Float32Array(n);

  for (const v of voices) {
    const startI = Math.floor((v.start || 0) * sr);
    const len = Math.floor((v.dur || 0) * sr);
    const attack = v.attack == null ? 0.005 : v.attack;
    const decay = v.decay == null ? 0.1 : v.decay;
    const gain = v.gain == null ? 0.4 : v.gain;
    let phase = 0;
    for (let i = 0; i < len; i++) {
      const idx = startI + i;
      if (idx >= n) break;
      const frac = len > 1 ? i / len : 0;
      const freq = v.f1 != null ? v.f0 + (v.f1 - v.f0) * frac : v.f0;
      phase += (TWO_PI * freq) / sr;
      const t = i / sr;
      buf[idx] += wave(v.type, phase) * envelope(t, v.dur, attack, decay) * gain;
    }
  }

  // Normalise to a safe peak, then gentle soft-clip for warmth.
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(buf[i]));
  if (peak > 0) {
    const norm = Math.min(1, 0.9 / peak);
    for (let i = 0; i < n; i++) {
      const s = buf[i] * norm;
      buf[i] = Math.tanh(1.1 * s) / Math.tanh(1.1);
    }
  }
  return buf;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function bytesToBase64(bytes) {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = bytes[i] << 16;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + '==';
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + '=';
  }
  return out;
}

/** Encode mono float samples as a 16-bit PCM WAV byte array. */
export function encodeWav(samples, sampleRate = 22050) {
  const n = samples.length;
  const bytes = new Uint8Array(44 + n * 2);
  const dv = new DataView(bytes.buffer);
  const ws = (off, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE');
  ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sampleRate, true); dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  ws(36, 'data'); dv.setUint32(40, n * 2, true);
  let off = 44;
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    dv.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return bytes;
}

/** Recipe → playable `data:audio/wav;base64,...` URI. */
export function synth(recipe) {
  const sr = recipe?.sampleRate || 22050;
  const samples = renderSamples(recipe);
  const wav = encodeWav(samples, sr);
  return 'data:audio/wav;base64,' + bytesToBase64(wav);
}

export default { synth, renderSamples, encodeWav, HZ };
