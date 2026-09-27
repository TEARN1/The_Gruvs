/**
 * videoFilters.js — live look filters for video calls.
 *
 * The filter is applied to the OUTGOING track, not just your own preview, so
 * the other person actually sees it. A hidden <video> plays the raw camera
 * feed, each frame is drawn to a canvas with a CSS filter applied, and
 * canvas.captureStream() gives us a new video track to send in place of the
 * camera's. Swapping it in uses replaceTrack, so there's no renegotiation and
 * no interruption to the call.
 *
 * Everything here is browser-native — no ML models, no libraries, no download.
 * That keeps it instant and free; real background segmentation would need a
 * model download and is deliberately out of scope.
 */

export const VIDEO_FILTERS = [
  { key: 'none',  label: 'None',   css: 'none' },
  { key: 'glow',  label: 'Glow',   css: 'brightness(1.12) saturate(1.18) contrast(0.98)' },
  { key: 'soft',  label: 'Soft',   css: 'brightness(1.08) saturate(1.06) blur(0.7px)' },
  { key: 'warm',  label: 'Warm',   css: 'sepia(0.22) saturate(1.35) brightness(1.05)' },
  { key: 'cool',  label: 'Cool',   css: 'hue-rotate(-12deg) saturate(1.22) brightness(1.04)' },
  { key: 'night', label: 'Night',  css: 'brightness(1.38) contrast(1.12) saturate(0.92)' },
  { key: 'mono',  label: 'Mono',   css: 'grayscale(1) contrast(1.12)' },
  { key: 'vivid', label: 'Vivid',  css: 'saturate(1.6) contrast(1.12)' },
];

export function filtersSupported() {
  return typeof document !== 'undefined'
    && typeof HTMLCanvasElement !== 'undefined'
    && typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

/**
 * Wrap a camera stream in a canvas pipeline.
 * Returns { track, setFilter, stop } — or null if unsupported.
 */
export function createFilteredVideoTrack(sourceStream, initialCss = 'none') {
  if (!filtersSupported()) return null;
  const srcTrack = sourceStream?.getVideoTracks?.()[0];
  if (!srcTrack) return null;

  const settings = srcTrack.getSettings?.() || {};
  const w = settings.width || 1280;
  const h = settings.height || 720;
  const fps = settings.frameRate || 30;

  const video = document.createElement('video');
  video.playsInline = true;
  video.muted = true;
  video.srcObject = new MediaStream([srcTrack]);

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');

  let css = initialCss;
  let raf = null;
  let stopped = false;

  const draw = () => {
    if (stopped) return;
    try {
      ctx.filter = css || 'none';
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    } catch { /* a frame can fail while the camera settles — keep going */ }
    raf = requestAnimationFrame(draw);
  };

  video.play().then(() => { raf = requestAnimationFrame(draw); }).catch(() => {
    // Autoplay refused (no gesture yet) — still start the loop; drawImage
    // simply no-ops until frames arrive.
    raf = requestAnimationFrame(draw);
  });

  const out = canvas.captureStream(fps);
  const track = out.getVideoTracks()[0];

  return {
    track,
    setFilter: (nextCss) => { css = nextCss || 'none'; },
    stop: () => {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      try { track.stop(); } catch {}
      try { video.pause(); video.srcObject = null; } catch {}
    },
  };
}
