import { FeedManager, VibeManager } from '../../src/services/dataFlow';
import { supabase } from '../../src/services/supabase';

// Mock Supabase with custom chaos-injecting behaviors
let mockNetworkLatencyMs = 0;
let mockNetworkShouldDrop = false;
let mockQueryCount = 0;

jest.mock('../../src/services/supabase', () => {
  return {
    isSupabaseEnabled: true,
    supabase: {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        upsert: jest.fn().mockImplementation(() => {
          mockQueryCount++;
          return Promise.resolve({ data: { id: 'success' }, error: null });
        }),
        single: jest.fn().mockImplementation(async () => {
          mockQueryCount++;
          if (mockNetworkShouldDrop) {
            throw new Error('Database connection dropped unexpectedly');
          }
          if (mockNetworkLatencyMs > 0) {
            await new Promise(resolve => setTimeout(resolve, mockNetworkLatencyMs));
          }
          return { data: { id: 'event-1', author_id: 'organizer-1', vibe_count: 10 }, error: null };
        }),
      })),
      rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
    },
  };
});

describe('Network Chaos & Database Strain Integration Tests', () => {
  beforeEach(() => {
    mockNetworkLatencyMs = 0;
    mockNetworkShouldDrop = false;
    mockQueryCount = 0;
    jest.clearAllMocks();
  });

  describe('1. High-Concurrency Spikes', () => {
    it('handles multiple concurrent read operations without crashing', async () => {
      const concurrencyLimit = 100;
      const promises = Array.from({ length: concurrencyLimit }, () =>
        FeedManager.fetchSingle('event-123')
      );

      const start = Date.now();
      const results = await Promise.all(promises);
      const duration = Date.now() - start;

      expect(results.length).toBe(concurrencyLimit);
      results.forEach(r => {
        expect(r).not.toBeNull();
        expect(r.id).toBe('event-1');
      });
      console.log(`Successfully completed ${concurrencyLimit} concurrent queries in ${duration}ms`);
    });
  });

  describe('2. Sequential Write Floods & Rate Limiting', () => {
    it('throttles rapid sequential user action writes to protect DB resource locks', async () => {
      // Send 5 rapid vibes in a row within milliseconds
      const vibePromises = Array.from({ length: 5 }, () =>
        VibeManager.sendVibe('event-123', 'user-456', 'organizer-2')
      );

      const results = await Promise.all(vibePromises);
      // Because SecurityService throttles clicks to 1000ms delay,
      // subsequent immediate vibes are throttled client-side.
      // The first should succeed, the rest should resolve immediately as throttled (returning true)
      // but without hitting the database.
      expect(results.every(r => r === true || r === 'self')).toBe(true);

      // Verify database write queryCount is throttled (only 1 query made instead of 5)
      expect(mockQueryCount).toBeLessThan(5);
    });
  });

  describe('3. Latency Emulation and Connection Drop Resilience', () => {
    it('gracefully completes requests with 3G latency (e.g. 500ms)', async () => {
      mockNetworkLatencyMs = 500; // Inject simulated 3G latency

      const start = Date.now();
      const result = await FeedManager.fetchSingle('event-123');
      const duration = Date.now() - start;

      expect(result).not.toBeNull();
      expect(duration).toBeGreaterThanOrEqual(500);
      console.log(`Completed slow connection query in ${duration}ms`);
    });

    it('recovers via cache fallbacks during a sudden connection drop', async () => {
      // Step A: Load and cache successfully first
      const firstLoad = await FeedManager.fetchSingle('event-123');
      expect(firstLoad).not.toBeNull();

      // Step B: Set network to drop completely
      mockNetworkShouldDrop = true;

      // Step C: Requesting should fall back to cache without throwing a crash error
      const result = await FeedManager.fetchSingle('event-123');
      expect(result).not.toBeNull(); // returns cached copy
      expect(result.id).toBe('event-1');
    });
  });
});
