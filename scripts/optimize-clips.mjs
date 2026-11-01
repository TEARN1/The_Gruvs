#!/usr/bin/env node
/**
 * optimize-clips.mjs — make every reel cheap to watch.
 *
 * For each video reel that has not been through here yet:
 *   1. download the file the phone uploaded (up to 100 MB, untouched),
 *   2. cut it to the trim the creator chose — until now trim was faked during
 *      playback, so viewers still downloaded the footage that was cut,
 *   3. re-encode it to a 720p H.264 file that starts playing before it has
 *      finished downloading,
 *   4. save a cover image, so the clip is never a black box while it loads,
 *   5. point the reel at the new file and cover.
 *
 * The decisions live in scripts/lib/clipPlan.js (tested by Jest). This file is
 * only the plumbing: Supabase REST + Storage over fetch, and ffmpeg.
 *
 * Runs from .github/workflows/clip-optimizer.yml every 15 minutes, and by hand:
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/optimize-clips.mjs
 *
 * Originals are kept (their path is recorded in metadata.optimized.original_path)
 * so nothing a creator uploaded is lost. DRY_RUN=1 encodes but writes nothing.
 */
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm, stat, readFile, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import plan from './lib/clipPlan.js';

const URL_ = (process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BATCH = Math.max(1, Number(process.env.CLIP_BATCH) || 6);
const DRY_RUN = process.env.DRY_RUN === '1';
const BUCKET = 'reels';

if (!URL_ || !KEY) {
  // Not an alarm: until the secret is added there is simply nothing to run with.
  // The warning shows on every run's summary so it is never silently skipped.
  console.log('::warning::Clip optimizer skipped: add SUPABASE_SERVICE_ROLE_KEY (and EXPO_PUBLIC_SUPABASE_URL) as repository secrets.');
  process.exit(0);
}

const headers = (extra = {}) => ({ apikey: KEY, Authorization: `Bearer ${KEY}`, ...extra });

const run = (cmd, args) => new Promise((resolve, reject) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { err += d; });
  p.on('error', reject);
  p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}: ${err.trim().slice(-400)}`))));
});

async function durationOf(file) {
  const out = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  const d = Number(String(out).trim());
  return Number.isFinite(d) && d > 0 ? d : NaN;
}

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`download ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(file));
}

async function upload(path, file, contentType) {
  const body = await readFile(file);
  const res = await fetch(`${URL_}/storage/v1/object/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST',
    headers: headers({ 'Content-Type': contentType, 'x-upsert': 'true', 'cache-control': 'max-age=604800' }),
    body,
  });
  if (!res.ok) throw new Error(`upload ${path}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return `${URL_}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function rest(path, init = {}) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: headers({ 'Content-Type': 'application/json', ...(init.headers || {}) }) });
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path.split('?')[0]}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? null : res.json();
}

// Re-read metadata right before writing, so a caption or sticker edit made
// while this ran is not overwritten by the copy fetched at the start.
async function patchReel(id, build) {
  const [fresh] = await rest(`reels?id=eq.${id}&select=metadata`);
  if (!fresh) return false;
  const patch = build(fresh.metadata || {});
  if (DRY_RUN) { console.log(`  (dry run) would update ${id}:`, JSON.stringify(patch)); return true; }
  await rest(`reels?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
  return true;
}

async function optimize(reel) {
  const dir = await mkdtemp(join(tmpdir(), 'clip-'));
  const src = join(dir, 'in'), out = join(dir, 'out.mp4'), cover = join(dir, 'cover.jpg');
  const at = new Date().toISOString();
  try {
    await download(reel.media_url, src);
    const inBytes = (await stat(src)).size;
    const duration = await durationOf(src);
    const trim = plan.trimWindow(reel.metadata, duration);

    await run('ffmpeg', plan.encodeArgs(src, out, trim));
    const outBytes = (await stat(out)).size;
    const replaced = plan.shouldReplace({ inBytes, outBytes, trimmed: !!trim });
    const outDuration = trim ? (trim.end ?? duration) - trim.start : duration;
    await run('ffmpeg', plan.coverArgs(replaced ? out : src, cover, outDuration));

    const paths = plan.outputPaths(reel);
    let mediaUrl = reel.media_url, coverUrl;
    if (DRY_RUN) {
      coverUrl = '(dry run)';
    } else {
      coverUrl = await upload(paths.cover, cover, 'image/jpeg');
      if (replaced) mediaUrl = await upload(paths.video, out, 'video/mp4');
    }

    await patchReel(reel.id, (meta) => ({
      ...(replaced ? { media_url: mediaUrl } : {}),
      thumbnail_url: coverUrl,
      metadata: plan.successMetadata(meta, {
        at, inBytes, outBytes, replaced, trimmed: !!trim,
        originalPath: replaced ? plan.storagePathFromUrl(reel.media_url, BUCKET) : null,
      }),
    }));
    return { id: reel.id, ok: true, inBytes, outBytes: replaced ? outBytes : inBytes, replaced, trimmed: !!trim };
  } catch (e) {
    await patchReel(reel.id, (meta) => ({ metadata: plan.failureMetadata(meta, { at, error: e.message }) })).catch(() => {});
    return { id: reel.id, ok: false, error: e.message };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const mb = (b) => (b / 1048576).toFixed(1);

const rows = await rest('reels?select=id,user_id,media_url,media_type,metadata,deleted_at,is_deleted&deleted_at=is.null&order=created_at.desc&limit=200');
const todo = rows.filter(plan.needsWork).slice(0, BATCH);
console.log(`${todo.length} clip(s) to optimise (${rows.filter(plan.needsWork).length} waiting in total).`);

const results = [];
for (const reel of todo) {
  const r = await optimize(reel);
  results.push(r);
  console.log(r.ok
    ? `✓ ${r.id}: ${mb(r.inBytes)} MB → ${mb(r.outBytes)} MB${r.trimmed ? ' (trimmed)' : ''}${r.replaced ? '' : ' (kept original)'}`
    : `✗ ${r.id}: ${r.error}`);
}

if (process.env.GITHUB_STEP_SUMMARY && results.length) {
  const lines = ['| Reel | Before | After | Notes |', '|---|---|---|---|',
    ...results.map((r) => r.ok
      ? `| \`${r.id}\` | ${mb(r.inBytes)} MB | ${mb(r.outBytes)} MB | ${[r.trimmed && 'trimmed', !r.replaced && 'kept original'].filter(Boolean).join(', ') || '—'} |`
      : `| \`${r.id}\` | — | — | failed: ${r.error.replace(/\|/g, '/').slice(0, 120)} |`)];
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Clip optimizer\n\n${lines.join('\n')}\n`);
}

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.log(`::warning::${failed.length} clip(s) failed to optimise; each is retried up to ${plan.MAX_ATTEMPTS} times.`);
}
