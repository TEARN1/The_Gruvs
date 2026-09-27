import { fuzzLocation, getGhostAlias } from '../src/context/IdentityContext';

describe('Identity Engine Utilities', () => {
  describe('fuzzLocation', () => {
    it('should fuzz location within the specified radius', () => {
      const lat = 37.7749;
      const lon = -122.4194;
      const radius = 500;

      // Test multiple runs to check bounds
      for (let i = 0; i < 50; i++) {
        const result = fuzzLocation(lat, lon, radius);

        // Calculate distance in meters between (lat, lon) and (result.lat, result.lon)
        const R = 6371000; // Earth's radius in meters
        const dLat = ((result.lat - lat) * Math.PI) / 180;
        const dLon = ((result.lon - lon) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((lat * Math.PI) / 180) *
            Math.cos((result.lat * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        expect(distance).toBeLessThanOrEqual(radius + 1); // allow small floating point variance
      }
    });

    it('should default to 500m radius if not specified', () => {
      const lat = 40.7128;
      const lon = -74.0060;
      const result = fuzzLocation(lat, lon);

      // Verify it deviates but not too far
      expect(result.lat).not.toBe(lat);
      expect(result.lon).not.toBe(lon);
    });
  });

  describe('getGhostAlias', () => {
    it('should generate a deterministic alias based on user ID', () => {
      const userId1 = 'user-abc-123';
      const userId2 = 'user-xyz-987';

      const alias1 = getGhostAlias(userId1);
      const alias2 = getGhostAlias(userId1); // same ID should yield same alias
      const alias3 = getGhostAlias(userId2); // different ID should yield different alias

      expect(alias1).toBe(alias2);
      expect(alias1).not.toBe(alias3);
      expect(typeof alias1).toBe('string');
      expect(alias1.length).toBeGreaterThan(0);
    });

    it('should handle empty or undefined userId', () => {
      const alias1 = getGhostAlias();
      const alias2 = getGhostAlias('');

      expect(typeof alias1).toBe('string');
      expect(alias1.length).toBeGreaterThan(0);
      expect(alias1).toBe(alias2);
    });
  });
});
