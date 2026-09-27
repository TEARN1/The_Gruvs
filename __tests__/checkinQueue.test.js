import { enqueueCheckin, readCheckinQueue, removeCheckin, isStale } from '../src/utils/checkinQueue';

const makeStore = () => {
  let m = {};
  return { getItem: async (k) => m[k] ?? null, setItem: async (k, v) => { m[k] = v; }, _dump: () => m };
};

describe('checkinQueue — never lose a Touch Down offline', () => {
  it('enqueues and reads back a pending check-in', async () => {
    const s = makeStore();
    await enqueueCheckin(s, { eventId: 'e1', userId: 'u1', coords: { lat: 1, lon: 2 } });
    const q = await readCheckinQueue(s);
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ eventId: 'e1', userId: 'u1' });
    expect(q[0].queuedAt).toEqual(expect.any(Number));
  });

  it('dedupes the same event+user', async () => {
    const s = makeStore();
    await enqueueCheckin(s, { eventId: 'e1', userId: 'u1' });
    await enqueueCheckin(s, { eventId: 'e1', userId: 'u1' });
    expect(await readCheckinQueue(s)).toHaveLength(1);
  });

  it('removes a check-in after it syncs', async () => {
    const s = makeStore();
    await enqueueCheckin(s, { eventId: 'e1', userId: 'u1' });
    await enqueueCheckin(s, { eventId: 'e2', userId: 'u1' });
    const left = await removeCheckin(s, 'e1', 'u1');
    expect(left.map((c) => c.eventId)).toEqual(['e2']);
  });

  it('carries identityMode + expiresAt so a ghost replays as a ghost', async () => {
    const s = makeStore();
    await enqueueCheckin(s, {
      eventId: 'e1', userId: 'u1',
      identityMode: 'ghost', expiresAt: '2026-09-01T23:59:59.000Z',
    });
    const [q] = await readCheckinQueue(s);
    expect(q.identityMode).toBe('ghost');
    expect(q.expiresAt).toBe('2026-09-01T23:59:59.000Z');
  });

  it('marks a check-in stale once the night is long over', () => {
    const now = Date.now();
    expect(isStale({ queuedAt: now - 60_000 }, now)).toBe(false);
    expect(isStale({ queuedAt: now - 25 * 60 * 60 * 1000 }, now)).toBe(true);
    // unknown age must never be discarded — that would destroy real presence data
    expect(isStale({}, now)).toBe(false);
  });

  it('rejects garbage + is null-safe', async () => {
    const s = makeStore();
    expect(await enqueueCheckin(s, {})).toBe(false);
    expect(await enqueueCheckin(null, { eventId: 'e', userId: 'u' })).toBe(false);
    expect(await readCheckinQueue(null)).toEqual([]);
  });
});
