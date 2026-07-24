/**
 * permissions.js — one place to ask for (and explain) device access.
 *
 * Web-first: camera/mic go through getUserMedia, location through the
 * Permissions API, notifications through Notification.permission. Every helper
 * fails soft and returns a typed result so the UI can show a specific,
 * actionable message ("access is blocked — tap the lock icon…") instead of a
 * vague "something went wrong."
 */
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web' && typeof navigator !== 'undefined';

// 'granted' | 'denied' | 'prompt' | 'unknown'
export async function queryPermission(name) {
  if (!isWeb) return 'unknown';
  try {
    if (name === 'notifications') {
      return typeof Notification !== 'undefined' ? Notification.permission : 'unknown';
    }
    if (navigator.permissions?.query) {
      const status = await navigator.permissions.query({ name });
      return status.state;
    }
  } catch { /* Permissions API not available for this name */ }
  return 'unknown';
}

// Ask for camera+mic. Returns { ok, stream } or { ok:false, error }.
// error ∈ 'denied' | 'no-device' | 'insecure' | 'unsupported' | 'unknown'
export async function requestMedia({ video = false } = {}) {
  if (!isWeb || !navigator.mediaDevices?.getUserMedia) return { ok: false, error: 'unsupported' };
  if (typeof window !== 'undefined' && window.isSecureContext === false) return { ok: false, error: 'insecure' };
  // Voice quality is the thing people actually notice, so ask for the DSP that
  // makes a call sound clean: kill the speaker echo, suppress room noise, and
  // even out volume. Video is capped at 720p/30 so it can't hog the uplink and
  // starve audio — the #1 cause of "you're breaking up" on video calls.
  const constraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
    video: video ? {
      width: { ideal: 1280, max: 1280 },
      height: { ideal: 720, max: 720 },
      frameRate: { ideal: 30, max: 30 },
      facingMode: 'user',
    } : false,
  };
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return { ok: true, stream };
  } catch (e) {
    // Some devices reject the ideal constraints outright — retry plainly rather
    // than telling the user their camera is broken.
    if (e?.name === 'OverconstrainedError' || e?.name === 'NotReadableError') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: !!video });
        return { ok: true, stream };
      } catch { /* fall through to the typed error below */ }
    }
    const n = e?.name || '';
    if (n === 'NotAllowedError' || n === 'SecurityError') return { ok: false, error: 'denied' };
    if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'OverconstrainedError') return { ok: false, error: 'no-device' };
    return { ok: false, error: 'unknown' };
  }
}

// Location — triggers the browser prompt. Returns 'granted' | 'denied' | 'unknown'.
export async function requestLocation() {
  if (!isWeb || !navigator.geolocation) return 'unknown';
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    try {
      navigator.geolocation.getCurrentPosition(
        () => done('granted'),
        (err) => done(err?.code === 1 ? 'denied' : 'unknown'),
        { timeout: 10000, maximumAge: 60000 },
      );
    } catch { done('unknown'); }
  });
}

// Notifications — returns 'granted' | 'denied' | 'default' | 'unknown'.
export async function requestNotifications() {
  if (!isWeb || typeof Notification === 'undefined') return 'unknown';
  try {
    if (Notification.permission === 'granted') return 'granted';
    return await Notification.requestPermission();
  } catch { return 'unknown'; }
}

// A human, actionable line for a failed/denied request.
export function permissionHint(error, kind = 'camera and mic') {
  switch (error) {
    case 'denied':
      return `${cap(kind)} access is blocked. Tap the lock icon in your address bar, allow ${kind}, then try again.`;
    case 'no-device':
      return `No ${kind} found on this device.`;
    case 'insecure':
      return `${cap(kind)} needs a secure (https) connection.`;
    case 'unsupported':
      return `This browser doesn't support ${kind} here.`;
    default:
      return `Couldn't get ${kind} access — check your browser's site settings.`;
  }
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Which browser are we in? Order matters — Edge/Brave/Opera all contain
// "Chrome" in their UA, and iOS Chrome/Firefox are really Safari underneath.
export function detectBrowser() {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (iOS) return 'ios';                              // every iOS browser is WebKit
  if (/Edg\//.test(ua)) return 'edge';
  if (/OPR\/|Opera/.test(ua)) return 'opera';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Chrome\//.test(ua)) return 'chrome';           // covers Brave/Vivaldi closely enough
  if (/Safari\//.test(ua)) return 'safari';
  return 'unknown';
}

// Step-by-step, in the user's ACTUAL browser. A generic "check your settings"
// is why people give up here — the steps differ meaningfully per browser.
const STEPS = {
  chrome: [
    'Tap the 🔒 lock (or ⓘ) icon on the left of the address bar',
    'Open “Site settings”',
    'Set Camera and Microphone to “Allow”',
    'Reload this page',
  ],
  edge: [
    'Tap the 🔒 lock icon on the left of the address bar',
    'Open “Permissions for this site”',
    'Set Camera and Microphone to “Allow”',
    'Reload this page',
  ],
  opera: [
    'Tap the 🔒 lock icon in the address bar',
    'Open “Site settings”',
    'Set Camera and Microphone to “Allow”',
    'Reload this page',
  ],
  firefox: [
    'Tap the 🔒 lock icon on the left of the address bar',
    'Find the blocked Camera / Microphone entry',
    'Click the ✕ next to “Blocked” to clear it',
    'Reload this page and choose “Allow”',
  ],
  safari: [
    'In the menu bar, open Safari → Settings for This Website',
    'Set Camera and Microphone to “Allow”',
    'Reload this page',
  ],
  ios: [
    'Open the iPhone Settings app',
    'Scroll down and tap your browser (Safari or Chrome)',
    'Tap Camera and Microphone and choose “Allow”',
    'Come back and reload this page',
  ],
  unknown: [
    'Open your browser’s site settings for thegruvs.com',
    'Set Camera and Microphone to “Allow”',
    'Reload this page',
  ],
};

export function unblockSteps(browser = detectBrowser()) {
  return STEPS[browser] || STEPS.unknown;
}

export const BROWSER_LABEL = {
  chrome: 'Chrome', edge: 'Edge', opera: 'Opera', firefox: 'Firefox',
  safari: 'Safari', ios: 'your iPhone', unknown: 'your browser',
};

// What each permission unlocks — for a friendly pre-prompt UI.
export const PERMISSION_COPY = {
  camera:      { icon: 'video',    title: 'Camera',        why: 'Video calls and sharing photos.' },
  microphone:  { icon: 'mic',      title: 'Microphone',    why: 'Voice and video calls.' },
  geolocation: { icon: 'map-pin',  title: 'Location',      why: 'Find events near you and share where you are.' },
  notifications:{ icon: 'bell',    title: 'Notifications', why: 'Know when someone messages or calls you.' },
};
