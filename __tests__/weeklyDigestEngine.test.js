import { haversineDistanceKm, rankEventsForUser } from '../src/utils/weeklyDigest';

describe('weeklyDigestEngine', () => {
  describe('haversineDistanceKm', () => {
    test('calculates correct distance between two points', () => {
      // Sandton (-26.1078, 28.0550) to Rosebank (-26.1453, 28.0436) ~ 4.3 km
      const d = haversineDistanceKm(-26.1078, 28.0550, -26.1453, 28.0436);
      expect(d).toBeGreaterThan(3.5);
      expect(d).toBeLessThan(5.5);
    });

    test('returns null for missing or invalid coordinates', () => {
      expect(haversineDistanceKm(null, 28.0, -26.0, 28.0)).toBeNull();
      expect(haversineDistanceKm(-26.0, undefined, -26.0, 28.0)).toBeNull();
      expect(haversineDistanceKm('abc', 28.0, -26.0, 28.0)).toBeNull();
    });
  });

  describe('rankEventsForUser', () => {
    const mockEvents = [
      {
        id: 'ev-far',
        title: 'Cape Town Festival',
        city: 'Cape Town',
        event_date: '2026-11-20',
        lat: -33.9249,
        lon: 18.4241,
      },
      {
        id: 'ev-close-sandton',
        title: 'Sandton Rooftop Party',
        city: 'Sandton',
        event_date: '2026-11-25',
        lat: -26.1080,
        lon: 28.0552,
      },
      {
        id: 'ev-medium-joburg',
        title: 'Joburg CBD Block Party',
        city: 'Johannesburg',
        event_date: '2026-11-21',
        lat: -26.2041,
        lon: 28.0473,
      },
    ];

    test('prioritizes closest events first for users with coordinates', () => {
      const sandtonUser = {
        home_base_lat: -26.1078,
        home_base_lon: 28.0550,
        home_area: 'Sandton',
      };

      const ranked = rankEventsForUser(sandtonUser, mockEvents, { maxEvents: 3 });
      expect(ranked[0].id).toBe('ev-close-sandton');
      expect(ranked[0].distance_km).toBeLessThan(1);
      expect(ranked[1].id).toBe('ev-medium-joburg');
      expect(ranked[2].id).toBe('ev-far');
    });

    test('matches on text area if coordinates are missing', () => {
      const userWithoutCoords = {
        home_area: 'Cape Town',
      };

      const ranked = rankEventsForUser(userWithoutCoords, mockEvents, { maxEvents: 3 });
      expect(ranked[0].id).toBe('ev-far');
    });

    test('respects maxEvents limit', () => {
      const user = { home_area: 'Johannesburg' };
      const ranked = rankEventsForUser(user, mockEvents, { maxEvents: 2 });
      expect(ranked).toHaveLength(2);
    });
  });
});
