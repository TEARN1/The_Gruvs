import {
  RouteEngine,
  haversineM,
  addMinutesToTime,
  twoOptOptimize,
} from '../src/services/routeEngine';
import { SafeRoute } from '../src/services/safeRoute';

describe('Ivory Park AC Accurate Tracking & Routing Strategy', () => {
  describe('Mathematical distance & time primitives', () => {
    it('haversineM calculates high-precision distance between two geographic points', () => {
      // Ivory Park Freedom Drive (-25.9967, 28.2000) to Mall of Africa (-26.0160, 28.1090)
      const dist = haversineM(
        { lat: -25.9967, lon: 28.2000 },
        { lat: -26.0160, lon: 28.1090 }
      );
      // Expected straight-line distance is ~9.3 km (9300m)
      expect(dist).toBeGreaterThan(8500);
      expect(dist).toBeLessThan(10500);
    });

    it('haversineM gracefully handles null/undefined coordinates without throwing', () => {
      expect(haversineM(null, { lat: -26, lon: 28 })).toBe(0);
      expect(haversineM({ lat: -26, lon: 28 }, null)).toBe(0);
    });

    it('addMinutesToTime rolls times cleanly past midnight', () => {
      expect(addMinutesToTime('19:00', 45)).toBe('19:45');
      expect(addMinutesToTime('23:45', 30)).toBe('00:15');
      expect(addMinutesToTime('00:15', -20)).toBe('23:55');
    });
  });

  describe('2-Opt Route Optimization (Uncrossing intersecting paths)', () => {
    it('uncrosses an inverted/crossed path to reduce total distance', () => {
      // 4 points on a grid where a crossed path is obvious:
      // Start at (0, 0), End at (10, 0)
      // Crossed stops: (2, 8) then (2, 1) then (8, 8) then (8, 1)
      const start = { lat: 0, lon: 0 };
      const end = { lat: 0, lon: 10 };
      const crossedStops = [
        { lat: 8, lon: 2, id: 'A' },
        { lat: 1, lon: 8, id: 'B' },
        { lat: 8, lon: 8, id: 'C' },
        { lat: 1, lon: 2, id: 'D' },
      ];

      const optimized = twoOptOptimize(crossedStops, start, end);
      expect(optimized.length).toBe(4);

      // Verify total optimized distance is less than or equal to crossed distance
      let crossedDist = haversineM(start, crossedStops[0]);
      for (let i = 0; i < crossedStops.length - 1; i++) {
        crossedDist += haversineM(crossedStops[i], crossedStops[i + 1]);
      }
      crossedDist += haversineM(crossedStops[crossedStops.length - 1], end);

      let optDist = haversineM(start, optimized[0]);
      for (let i = 0; i < optimized.length - 1; i++) {
        optDist += haversineM(optimized[i], optimized[i + 1]);
      }
      optDist += haversineM(optimized[optimized.length - 1], end);

      expect(optDist).toBeLessThanOrEqual(crossedDist);
    });
  });

  describe('optimizePickupRoute (Ivory Park AC Multi-Stop Scheduling)', () => {
    const origin = {
      label: 'Ivory Park Athletics Hub / Freedom Drive Depot',
      lat: -25.9967,
      lon: 28.2000,
    };

    const athleteStops = [
      { id: 'ath-1', name: 'Sibusiso Molefe', lat: -26.0021, lon: 28.1945 },
      { id: 'ath-2', name: 'Katlego Dlamini', lat: -25.9912, lon: 28.2052 },
      { id: 'ath-3', name: 'Thabo Mokoena', lat: -26.0105, lon: 28.1880 },
    ];

    const destination = {
      name: 'FNB Stadium Mega Event',
      lat: -26.2348,
      lon: 27.9824,
    };

    it('generates an ordered pick-up schedule with ETAs and cumulative metrics', () => {
      const schedule = RouteEngine.optimizePickupRoute(
        athleteStops,
        destination,
        '05:00',
        origin
      );

      expect(schedule).toBeDefined();
      expect(schedule.stops.length).toBe(3);
      expect(schedule.totalDistanceKm).toBeGreaterThan(25);
      expect(schedule.totalDriveTimeMin).toBeGreaterThan(30);
      expect(schedule.destination.arrivalEta).toBeDefined();

      // Check chronological ETA progression
      const eta1 = schedule.stops[0].eta;
      const eta2 = schedule.stops[1].eta;
      const eta3 = schedule.stops[2].eta;
      const finalEta = schedule.destination.arrivalEta;

      expect(eta1 <= eta2).toBe(true);
      expect(eta2 <= eta3).toBe(true);
      expect(eta3 <= finalEta).toBe(true);

      // Verify full polyline coordinates include origin, all stops, and destination
      expect(schedule.routePoints.length).toBe(5);
    });

    it('delegates through SafeRoute.planSafeCrewPickupRoute', () => {
      const schedule = SafeRoute.planSafeCrewPickupRoute(
        athleteStops,
        destination,
        '23:00',
        origin
      );
      expect(schedule.stops.length).toBe(3);
      expect(schedule.destination.name).toBe('FNB Stadium Mega Event');
    });
  });

  describe('generateRouteTracerFrames (Animated Route Tracer)', () => {
    it('creates smooth interpolated coordinate steps along the route polyline', () => {
      const routePoints = [
        { lat: -25.99, lon: 28.20 },
        { lat: -26.00, lon: 28.21 },
        { lat: -26.01, lon: 28.22 },
      ];

      const frames = RouteEngine.generateRouteTracerFrames(routePoints, 4);
      // 2 segments * 4 steps + 1 terminal point = 9 frames
      expect(frames.length).toBe(9);
      expect(frames[0].lat).toBe(-25.99);
      expect(frames[frames.length - 1].lat).toBe(-26.01);
      expect(frames[0].progress).toBe(0);
      expect(frames[frames.length - 1].progress).toBe(1.0);
    });
  });
});
