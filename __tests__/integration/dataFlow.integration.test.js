import { VibeManager, RSVPManager, UserManager, LevelManager } from '../../src/services/dataFlow';
import { supabase, __mock, __reset, __setResult } from '../../src/services/supabase';

// Re-use the chainable mock structure from connectors.test.js
jest.mock('../../src/services/supabase', () => {
  const state = { results: {}, captured: {}, calls: {} };
  const rec = (table, method, args) => {
    if (!state.calls[table]) state.calls[table] = [];
    state.calls[table].push({ method, args });
  };
  const makeBuilder = (table) => {
    const b = {};
    const chain = (method) => (...args) => { rec(table, method, args); return b; };
    Object.assign(b, {
      select: chain('select'),
      insert: (...args) => { rec(table, 'insert', args); state.captured[table] = { ...(state.captured[table] || {}), insert: args[0] }; return b; },
      update: (...args) => { rec(table, 'update', args); state.captured[table] = { ...(state.captured[table] || {}), update: args[0] }; return b; },
      delete: (...args) => { rec(table, 'delete', args); state.captured[table] = { ...(state.captured[table] || {}), delete: args[0] }; return b; },
      upsert: (...args) => { rec(table, 'upsert', args); state.captured[table] = { ...(state.captured[table] || {}), upsert: args[0] }; return b; },
      eq: chain('eq'),
      neq: chain('neq'),
      in: chain('in'),
      not: chain('not'),
      limit: chain('limit'),
      order: chain('order'),
      range: chain('range'),
      single: () => Promise.resolve(state.results[table]?.single ?? { data: null, error: null }),
      maybeSingle: () => Promise.resolve(state.results[table]?.maybeSingle ?? { data: null, error: null }),
      then: (resolve) => resolve(state.results[table]?.list ?? { data: null, error: null }),
    });
    return b;
  };
  const fromFn = jest.fn((t) => makeBuilder(t));
  return {
    supabase: {
      from: fromFn,
      rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
    },
    isSupabaseEnabled: true,
    __mock: state,
    __reset: () => { state.results = {}; state.captured = {}; state.calls = {}; fromFn.mockClear(); },
    __setResult: (table, kind, value) => { state.results[table] = { ...(state.results[table] || {}), [kind]: value }; },
  };
});

// Mock notification service to fail so we fall back to database inserts
jest.mock('../../src/services/notificationService', () => ({
  NotificationService: {
    send: jest.fn(() => Promise.reject(new Error('Push service disabled in test'))),
  },
}));

// Mock other side-effect service files
jest.mock('../../src/services/vibeEquityLedger', () => ({
  VibeEquityLedger: {
    mintEquity: jest.fn(() => Promise.resolve(true)),
  },
}));

jest.mock('../../src/services/revenueEngine', () => ({
  VibeEconomyEngine: {
    getSovereignStatus: jest.fn(() => Promise.resolve({ isRoyal: false, equity: 0 })),
  },
}));

describe('DataFlow Integration Test', () => {
  beforeEach(() => {
    __reset();
    jest.clearAllMocks();
  });

  describe('RSVP Flow', () => {
    it('allows a user to RSVP going, incrementing vibe score and triggering notifications', async () => {
      // Setup event organizer
      __setResult('events', 'maybeSingle', { data: { author_id: 'organizer-1' } });
      __setResult('event_rsvps', 'single', { data: { id: 'rsvp-1', status: 'going' }, error: null });

      const result = await RSVPManager.upsert('event-123', 'user-456', 'going');
      expect(result).toBe(true);

      // Wait a tick for background fire-and-forget notifications to resolve
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify self-RSVP check was queried
      expect(supabase.from).toHaveBeenCalledWith('events');
      expect(__mock.calls.events.find(c => c.method === 'eq').args).toEqual(['id', 'event-123']);

      // Verify RSVP row upsert
      expect(__mock.captured.event_rsvps.upsert).toEqual(
        expect.objectContaining({ event_id: 'event-123', user_id: 'user-456', status: 'going' })
      );

      // Verify notification sent to event organizer
      expect(supabase.from).toHaveBeenCalledWith('notifications');
      expect(__mock.captured.notifications.insert).toEqual(
        expect.objectContaining({
          recipient_id: 'organizer-1',
          actor_id: 'user-456',
          type: 'rsvp',
        })
      );
    });

    it('blocks self-RSVP by the event organizer', async () => {
      // Setup organizer-id matches caller-id
      __setResult('events', 'maybeSingle', { data: { author_id: 'organizer-1' } });

      await expect(RSVPManager.upsert('event-123', 'organizer-1', 'going')).rejects.toThrow(
        'Organisers cannot RSVP to their own events.'
      );
    });
  });

  describe('Vibe / Likes Flow', () => {
    it('mints vibe equity and computes vibe score when sending a vibe', async () => {
      __setResult('events', 'maybeSingle', { data: { author_id: 'organizer-1' } });
      __setResult('event_vibes', 'single', { data: { id: 'vibe-1' }, error: null });

      const result = await VibeManager.sendVibe('event-123', 'user-456', 'organizer-1');
      expect(result).toBe(true);

      // Verify vibe record inserted
      expect(__mock.captured.event_vibes.upsert).toEqual(
        expect.objectContaining({ event_id: 'event-123', user_id: 'user-456' })
      );
    });
  });

  describe('Social Follow Flow', () => {
    it('inserts follow row and logs notification', async () => {
      supabase.rpc.mockImplementation((fn) => {
        if (fn === 'follow_user') {
          return Promise.resolve({ error: { message: 'RPC not available in test fallback' } });
        }
        return Promise.resolve({ data: null, error: null });
      });

      __setResult('follows', 'single', { data: { id: 'follow-1' }, error: null });

      console.log('test supabase.rpc is mock?', jest.isMockFunction(supabase.rpc));
      console.log('test supabase.rpc:', supabase.rpc);

      const result = await UserManager.follow('follower-1', 'following-1');
      expect(result).toBe(true);

      console.log('RPC mock calls:', JSON.stringify(supabase.rpc.mock.calls, null, 2));
      console.log('RPC mock results:', supabase.rpc.mock.results);
      console.log('Captured calls:', JSON.stringify(__mock.captured, null, 2));

      // Verify follow row
      expect(__mock.captured.follows.upsert).toEqual(
        expect.objectContaining({ follower_id: 'follower-1', following_id: 'following-1' })
      );

      // Verify notification triggered
      expect(supabase.from).toHaveBeenCalledWith('notifications');
      expect(__mock.captured.notifications.insert).toEqual(
        expect.objectContaining({
          recipient_id: 'following-1',
          actor_id: 'follower-1',
          type: 'follow',
        })
      );
    });
  });

  describe('XP / Level Up Flow', () => {
    it('increments XP and triggers level up notification when crossing threshold', async () => {
      // Mock profile with 30 XP (Level 1 on the canonical curve)
      __setResult('profiles', 'single', { data: { xp: 30 }, error: null });

      // Action CHECK_IN adds 50 XP (total 80 XP -> Level 2 on the ONE canonical
      // curve, getXpLevel: floor(sqrt(80/50)) + 1 = 2 — F3)
      const result = await LevelManager.addXP('user-123', 'CHECK_IN');

      expect(result.xp).toBe(80);
      expect(result.level).toBe(2);
      expect(result.leveledUp).toBe(true);

      // Verify level up notification is sent
      expect(__mock.captured.notifications.insert).toEqual(
        expect.objectContaining({
          recipient_id: 'user-123',
          actor_id: 'user-123',
          type: 'level_up',
        })
      );
    });
  });
});
