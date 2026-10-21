const plan = require('../scripts/lib/clipPlan');

const reel = (over = {}) => ({
  id: 'r1', user_id: 'u1', media_type: 'video',
  media_url: 'https://x.supabase.co/storage/v1/object/public/reels/u1/reel_1.mp4',
  metadata: {}, ...over,
});

describe('clipPlan — which reels the optimizer picks up', () => {
  it('picks up a video that has never been optimised', () => {
    expect(plan.needsWork(reel())).toBe(true);
  });

  it('skips photos, deleted reels and finished clips', () => {
    expect(plan.needsWork(reel({ media_type: 'image' }))).toBe(false);
    expect(plan.needsWork(reel({ deleted_at: '2026-10-01T00:00:00Z' }))).toBe(false);
    expect(plan.needsWork(reel({ is_deleted: true }))).toBe(false);
    expect(plan.needsWork(reel({ metadata: { optimized: { done: true } } }))).toBe(false);
  });

  it('retries a failed clip, but stops after MAX_ATTEMPTS', () => {
    expect(plan.needsWork(reel({ metadata: { optimized: { done: false, attempts: 2 } } }))).toBe(true);
    expect(plan.needsWork(reel({ metadata: { optimized: { done: false, attempts: plan.MAX_ATTEMPTS } } }))).toBe(false);
  });

  it('recognises a legacy row with no media_type by its extension', () => {
    expect(plan.isVideoReel(reel({ media_type: null }))).toBe(true);
    expect(plan.isVideoReel(reel({ media_type: null, media_url: 'https://x/a.jpg' }))).toBe(false);
  });
});

describe('clipPlan — trimming is real, not a playback trick', () => {
  it('cuts to the trim the creator chose', () => {
    expect(plan.trimWindow({ trim: { start: 3, end: 9 } }, 20)).toEqual({ start: 3, end: 9 });
  });

  it('keeps the clip whole when the trim covers all of it', () => {
    expect(plan.trimWindow({ trim: { start: 0, end: 20 } }, 20)).toBeNull();
    expect(plan.trimWindow({ trim: { start: 0, end: 30 } }, 20)).toBeNull(); // picker default past the end
    expect(plan.trimWindow({}, 20)).toBeNull();
  });

  it('clamps an end past the real length and ignores a backwards window', () => {
    expect(plan.trimWindow({ trim: { start: 5, end: 60 } }, 20)).toEqual({ start: 5, end: 20 });
    expect(plan.trimWindow({ trim: { start: 9, end: 3 } }, 20)).toBeNull();
  });

  it('passes the cut to ffmpeg as a start and a length', () => {
    const args = plan.encodeArgs('in', 'out.mp4', { start: 3, end: 9 });
    expect(args.slice(args.indexOf('-ss'), args.indexOf('-ss') + 2)).toEqual(['-ss', '3.000']);
    expect(args.slice(args.indexOf('-t'), args.indexOf('-t') + 2)).toEqual(['-t', '6.000']);
    expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i')); // fast seek
  });
});

describe('clipPlan — the output is small and streams', () => {
  const args = plan.encodeArgs('in', 'out.mp4', null);

  it('encodes H.264 + AAC, capped at 30 fps and 1.5 Mbps, moov first', () => {
    expect(args).toEqual(expect.arrayContaining(['libx264', 'aac', '-fpsmax', '30', '-maxrate', '1500k', '+faststart']));
    expect(args).not.toContain('-ss');
  });

  it('limits the shorter side to 720 and keeps both sides even', () => {
    const vf = args[args.indexOf('-vf') + 1];
    expect(vf).toContain('min(720,iw)');
    expect(vf).toContain('min(720,ih)');
    expect(vf).toMatch(/trunc\(.*\/2\)\*2/);
  });

  it('keeps the original when re-encoding barely shrinks it', () => {
    expect(plan.shouldReplace({ inBytes: 1000, outBytes: 950, trimmed: false })).toBe(false);
    expect(plan.shouldReplace({ inBytes: 1000, outBytes: 400, trimmed: false })).toBe(true);
  });

  it('always replaces a trimmed clip, even if it did not shrink', () => {
    expect(plan.shouldReplace({ inBytes: 1000, outBytes: 1200, trimmed: true })).toBe(true);
    expect(plan.shouldReplace({ inBytes: 1000, outBytes: 0, trimmed: true })).toBe(false);
  });
});

describe('clipPlan — what gets written back', () => {
  it('drops the trim once it is baked into the file, and keeps other metadata', () => {
    const next = plan.successMetadata({ trim: { start: 1, end: 4 }, filter: 'warm' }, {
      at: 't', inBytes: 100, outBytes: 10, replaced: true, trimmed: true, originalPath: 'u1/reel_1.mp4',
    });
    expect(next.trim).toBeUndefined();
    expect(next.filter).toBe('warm');
    expect(next.optimized).toMatchObject({ done: true, replaced: true, to_bytes: 10, original_path: 'u1/reel_1.mp4' });
  });

  it('keeps the trim when the file was not cut', () => {
    const next = plan.successMetadata({ trim: { start: 0, end: 5 } }, { at: 't', inBytes: 100, outBytes: 100, replaced: false, trimmed: false });
    expect(next.trim).toEqual({ start: 0, end: 5 });
    expect(next.optimized.to_bytes).toBe(100);
  });

  it('counts failed attempts and keeps a short reason', () => {
    const once = plan.failureMetadata({}, { at: 't', error: 'x'.repeat(500) });
    expect(once.optimized).toMatchObject({ done: false, attempts: 1 });
    expect(once.optimized.last_error.length).toBe(300);
    expect(plan.failureMetadata(once, { at: 't', error: 'y' }).optimized.attempts).toBe(2);
  });

  it('writes into the owner folder and reads paths back out of public URLs', () => {
    expect(plan.outputPaths(reel())).toEqual({ video: 'u1/reel_r1_720.mp4', cover: 'u1/reel_r1_cover.jpg' });
    expect(plan.storagePathFromUrl(reel().media_url)).toBe('u1/reel_1.mp4');
    expect(plan.storagePathFromUrl('https://elsewhere.com/a.mp4')).toBeNull();
  });
});
