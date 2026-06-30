import { enqueueCheckin, readCheckinQueue, removeCheckin } from '../src/utils/checkinQueue';

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

  it('rejects garbage + is null-safe', async () => {
    const s = makeStore();
    expect(await enqueueCheckin(s, {})).toBe(false);
    expect(await enqueueCheckin(null, { eventId: 'e', userId: 'u' })).toBe(false);
    expect(await readCheckinQueue(null)).toEqual([]);
  });
});
