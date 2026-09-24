/**
 * persistentCache — what is allowed onto disk, and the size cap.
 *
 * The allowlist is a privacy boundary, not a tuning knob: DMs, notifications
 * and location traces must never be written to the device. These tests exist so
 * that a future "let's cache that too" change has to argue with a red test.
 */
import { __testing } from '../src/services/persistentCache';

const { isPersistable, buildRecord, MAX_BYTES } = __testing;

describe('persistentCache allowlist', () => {
  it('persists public, feed-shaped data', () => {
    expect(isPersistable('feed:for_you:all::0:anon:2026-09-02')).toBe(true);
    expect(isPersistable('event:abc-123')).toBe(true);
    expect(isPersistable('trending:20')).toBe(true);
    expect(isPersistable('rising:10')).toBe(true);
    expect(isPersistable('happening_now')).toBe(true);
    expect(isPersistable('this_week')).toBe(true);
    expect(isPersistable('category_counts')).toBe(true);
    expect(isPersistable('hot_event_ids')).toBe(true);
  });

  it('never persists direct messages', () => {
    expect(isPersistable('thread:abc')).toBe(false);
    expect(isPersistable('convos:user-1')).toBe(false);
  });

  it('never persists personal account state', () => {
    expect(isPersistable('notifs:user-1')).toBe(false);
    expect(isPersistable('profile:user-1')).toBe(false);
    expect(isPersistable('follows:user-1')).toBe(false);
    expect(isPersistable('saved:user-1')).toBe(false);
  });

  it('never persists location traces', () => {
    // Location privacy is a safety property in this app, not a preference.
    expect(isPersistable('nearby_vibers:user-1:5')).toBe(false);
    expect(isPersistable('nearby_events:-262:280:10')).toBe(false);
  });
});

describe('persistentCache record building', () => {
  it('drops non-allowlisted keys from the written record', () => {
    const rec = buildRecord({
      'feed:a': { value: [1], ts: 1, ttl: 1000 },
      'thread:secret': { value: ['dm'], ts: 1, ttl: 1000 },
    });
    expect(Object.keys(rec.entries)).toEqual(['feed:a']);
  });

  it('preserves the original timestamp so TTL rules still apply after restore', () => {
    const rec = buildRecord({ 'feed:a': { value: [1], ts: 12345, ttl: 1000 } });
    expect(rec.entries['feed:a'].ts).toBe(12345);
  });

  it('skips entries with no value', () => {
    const rec = buildRecord({ 'feed:a': { ts: 1, ttl: 1000 } });
    expect(rec).toBeNull();
  });

  it('evicts oldest-first to stay under the byte cap', () => {
    // Three entries, each individually large enough that all three cannot fit.
    const big = (n) => ({ value: 'x'.repeat(MAX_BYTES / 2), ts: n, ttl: 1000 });
    const rec = buildRecord({
      'feed:oldest': big(1),
      'feed:middle': big(2),
      'feed:newest': big(3),
    });
    expect(rec).not.toBeNull();
    expect(JSON.stringify(rec).length).toBeLessThanOrEqual(MAX_BYTES);
    // Whatever survived, the oldest must be the first thing dropped.
    expect(Object.keys(rec.entries)).not.toContain('feed:oldest');
  });

  it('returns null rather than an empty record when nothing fits', () => {
    const rec = buildRecord({ 'feed:huge': { value: 'x'.repeat(MAX_BYTES * 2), ts: 1, ttl: 1 } });
    expect(rec).toBeNull();
  });
});
