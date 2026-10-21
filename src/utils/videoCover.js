/**
 * videoCover.js — grab one frame of a picked video as a JPEG, in the browser.
 *
 * Every reel used to post with no cover, so it showed black until the video
 * loaded (and shared links had no picture). This gives a new reel a cover the
 * moment it posts; the clip optimizer later swaps in one taken from the trimmed,
 * re-encoded file.
 *
 * Web only. On native there is no canvas, so it returns null and the reel waits
 * for the optimizer's cover. Never throws: a missing cover must not block a post.
 */
import { Platform } from 'react-native';

const once = (target, ok, fail, timeoutMs) => new Promise((resolve, reject) => {
  const t = setTimeout(() => { cleanup(); reject(new Error('timeout')); }, timeoutMs);
  const onOk = () => { cleanup(); resolve(); };
  const onFail = () => { cleanup(); reject(new Error(fail)); };
  const cleanup = () => {
    clearTimeout(t);
    target.removeEventListener(ok, onOk);
    target.removeEventListener('error', onFail);
  };
  target.addEventListener(ok, onOk);
  target.addEventListener('error', onFail);
});

/** Size that keeps the aspect ratio and puts the shorter side at most `maxShort`. */
export function coverSize(w, h, maxShort = 720) {
  if (!(w > 0) || !(h > 0)) return null;
  const scale = Math.min(1, maxShort / Math.min(w, h));
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

/**
 * @param {string} uri   blob:, data: or http(s) URL of the picked video
 * @param {{ atSec?: number, maxShort?: number, timeoutMs?: number }} opts
 * @returns {Promise<Blob|null>}
 */
export async function captureVideoCover(uri, { atSec = 0.5, maxShort = 720, timeoutMs = 8000 } = {}) {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || !uri) return null;
  const video = document.createElement('video');
  try {
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';
    video.src = uri;
    await once(video, 'loadeddata', 'load failed', timeoutMs);
    const dur = Number.isFinite(video.duration) ? video.duration : 0;
    const target = dur > 0 ? Math.min(Math.max(0, atSec), Math.max(0, dur - 0.1)) : 0;
    if (target > 0) {
      video.currentTime = target;
      await once(video, 'seeked', 'seek failed', timeoutMs);
    }
    const size = coverSize(video.videoWidth, video.videoHeight, maxShort);
    if (!size) return null;
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.getContext('2d').drawImage(video, 0, 0, size.width, size.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    return blob && blob.size > 0 ? blob : null;
  } catch {
    return null;
  } finally {
    video.removeAttribute('src');
    try { video.load(); } catch { /* releases the decoder; nothing to do if it fails */ }
  }
}

export default captureVideoCover;
