/**
 * clipPlan.js — the decisions behind scripts/optimize-clips.mjs, kept free of
 * ffmpeg, the network and the filesystem so Jest can check every one of them.
 *
 * WHY. Reels were stored exactly as the phone recorded them: up to 100 MB, the
 * whole untrimmed file (trim was faked during playback by seeking), and no cover
 * image, so every clip showed black until it loaded. On South African prepaid
 * data that is the difference between an app people keep and one they delete.
 *
 * CommonJS on purpose: the .mjs worker imports it, and Jest requires it as is.
 */

// Shorter side of the output, in pixels. 720 keeps a phone-screen clip sharp.
const TARGET_SHORT_SIDE = 720;
// A clip that failed this many times is left alone instead of retried forever.
const MAX_ATTEMPTS = 3;
// Keep the original only when re-encoding saves less than this fraction.
const MIN_SAVING = 0.1;
// Stamped into metadata.optimized so a later, better pass can find old work.
const WORKER_VERSION = 'clip-optimizer@1';

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|3gp|3gpp|mkv)(\?|$)/i;
const PUBLIC_MARKER = '/storage/v1/object/public/';

function isVideoReel(reel) {
  if (!reel || !reel.media_url) return false;
  if (reel.media_type) return reel.media_type === 'video';
  return VIDEO_EXT.test(reel.media_url);
}

/** True when the worker still has something to do for this reel. */
function needsWork(reel) {
  if (!isVideoReel(reel)) return false;
  if (reel.deleted_at || reel.is_deleted) return false;
  const o = (reel.metadata && reel.metadata.optimized) || null;
  if (!o) return true;
  if (o.done) return false;
  return (Number(o.attempts) || 0) < MAX_ATTEMPTS;
}

/**
 * The window to cut, or null when the clip is kept whole. Reads the trim the
 * creator chose (metadata.trim, in seconds) and clamps it to the real length.
 */
function trimWindow(metadata, durationSec) {
  const t = metadata && metadata.trim;
  if (!t || typeof t !== 'object') return null;
  const known = Number.isFinite(durationSec) && durationSec > 0;
  const start = Math.max(0, Number(t.start) || 0);
  let end = Number(t.end);
  if (!Number.isFinite(end) || end <= 0) end = known ? durationSec : Infinity;
  if (known) end = Math.min(end, durationSec);
  if (!(end > start)) return null;
  const startsAtZero = start < 0.05;
  const runsToEnd = !Number.isFinite(end) || (known && end >= durationSec - 0.05);
  if (startsAtZero && runsToEnd) return null;
  return { start, end: Number.isFinite(end) ? end : null };
}

/**
 * ffmpeg scale filter: shorter side at most 720, aspect kept. Both sides must
 * be even for H.264 4:2:0, and a phone can record an odd width (e.g. 479), so
 * the fixed side is rounded down to even too, not only the -2 side.
 */
function scaleFilter(short = TARGET_SHORT_SIDE) {
  const even = (side) => `trunc(min(${short},${side})/2)*2`;
  return `scale='if(gte(iw,ih),-2,${even('iw')})':'if(gte(iw,ih),${even('ih')},-2)'`;
}

/** Arguments for the main re-encode: H.264 + AAC, web-streamable. */
function encodeArgs(input, output, trim) {
  const args = ['-hide_banner', '-loglevel', 'error', '-y'];
  if (trim) args.push('-ss', trim.start.toFixed(3));
  args.push('-i', input);
  if (trim && trim.end != null) args.push('-t', (trim.end - trim.start).toFixed(3));
  args.push(
    '-map', '0:v:0', '-map', '0:a:0?',
    '-vf', scaleFilter(),
    '-fpsmax', '30',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28',
    '-maxrate', '1500k', '-bufsize', '3000k',
    '-profile:v', 'main', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '96k', '-ac', '2',
    // moov atom first, so playback starts before the whole file has arrived.
    '-movflags', '+faststart',
    output,
  );
  return args;
}

/** Arguments for the cover frame, taken half a second in (or mid-clip if shorter). */
function coverArgs(input, output, durationSec) {
  const at = Number.isFinite(durationSec) && durationSec > 0 ? Math.min(0.5, durationSec / 2) : 0;
  return [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', at.toFixed(3), '-i', input,
    '-frames:v', '1', '-vf', scaleFilter(), '-q:v', '4',
    output,
  ];
}

/**
 * Replace the stored file only when it is worth it: always after a trim (the
 * old file holds footage the creator cut), otherwise only if it shrank by at
 * least MIN_SAVING. A clip that is already small keeps its original bytes.
 */
function shouldReplace({ inBytes, outBytes, trimmed }) {
  if (!(outBytes > 0)) return false;
  if (trimmed) return true;
  if (!(inBytes > 0)) return true;
  return outBytes <= inBytes * (1 - MIN_SAVING);
}

/** "reels/<user>/reel_123.mp4" style object path from a public storage URL. */
function storagePathFromUrl(url, bucket = 'reels') {
  if (!url || typeof url !== 'string') return null;
  const i = url.indexOf(PUBLIC_MARKER + bucket + '/');
  if (i < 0) return null;
  const rest = url.slice(i + PUBLIC_MARKER.length + bucket.length + 1).split('?')[0];
  return rest ? decodeURIComponent(rest) : null;
}

/** Where the optimised clip and its cover live. Owner folder first, as storage RLS expects. */
function outputPaths(reel) {
  const owner = reel.user_id || 'unknown';
  return {
    video: `${owner}/reel_${reel.id}_720.mp4`,
    cover: `${owner}/reel_${reel.id}_cover.jpg`,
  };
}

/** metadata after a successful pass: the trim is baked into the file, so drop it. */
function successMetadata(prev, info) {
  const next = { ...(prev || {}) };
  if (info.trimmed) delete next.trim;
  next.optimized = {
    done: true,
    at: info.at,
    worker: WORKER_VERSION,
    replaced: !!info.replaced,
    trimmed: !!info.trimmed,
    from_bytes: info.inBytes || null,
    to_bytes: info.replaced ? info.outBytes : info.inBytes || null,
    original_path: info.originalPath || null,
  };
  return next;
}

/** metadata after a failed pass: count the attempt, keep a short reason. */
function failureMetadata(prev, info) {
  const before = (prev && prev.optimized) || {};
  return {
    ...(prev || {}),
    optimized: {
      done: false,
      at: info.at,
      worker: WORKER_VERSION,
      attempts: (Number(before.attempts) || 0) + 1,
      last_error: String(info.error || 'unknown error').slice(0, 300),
    },
  };
}

module.exports = {
  TARGET_SHORT_SIDE,
  MAX_ATTEMPTS,
  MIN_SAVING,
  WORKER_VERSION,
  isVideoReel,
  needsWork,
  trimWindow,
  scaleFilter,
  encodeArgs,
  coverArgs,
  shouldReplace,
  storagePathFromUrl,
  outputPaths,
  successMetadata,
  failureMetadata,
};
