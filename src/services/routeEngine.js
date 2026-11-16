/**
 * Royal Routes Engine — High-Precision Tracking & Route Optimization.
 *
 * Implements the Ivory Park AC TSP & Tracking strategy:
 *   1. Nearest Neighbor heuristic with 2-Opt local search refinement (uncrosses routes).
 *   2. Empirical road-winding calibration factor (1.25x haversine) for realistic driving distances.
 *   3. Multi-tier speed profiles: Township/Urban arterial (35 km/h + 2 min boarding) vs Highway (75 km/h).
 *   4. Accurate multi-stop pick-up schedule with cumulative ETAs and stop metrics.
 *   5. Real-time animated route tracer interpolation frames.
 */
import { GeoUtils } from './dataFlow';
import { supabase } from './supabase';

/**
 * High-precision haversine distance in meters between two coordinates.
 */
export function haversineM(a, b) {
  if (!a || !b) return 0;
  const aLat = Number(a.lat ?? a.latitude);
  const aLon = Number(a.lon ?? a.lng ?? a.longitude);
  const bLat = Number(b.lat ?? b.latitude);
  const bLon = Number(b.lon ?? b.lng ?? b.longitude);
  if (!Number.isFinite(aLat) || !Number.isFinite(aLon) || !Number.isFinite(bLat) || !Number.isFinite(bLon)) {
    return 0;
  }
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Adds minutes to a 24h "HH:MM" string, rolling cleanly past midnight.
 */
export function addMinutesToTime(timeStr = '19:00', addMin = 0) {
  const parts = String(timeStr).split(':');
  let h = parseInt(parts[0], 10) || 0;
  let m = parseInt(parts[1], 10) || 0;
  let totalMin = h * 60 + m + Math.round(addMin);
  totalMin = ((totalMin % 1440) + 1440) % 1440;
  const newH = Math.floor(totalMin / 60);
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

/**
 * 2-Opt local search optimizer to uncross any intersecting legs.
 */
export function twoOptOptimize(stops, startCoord, endCoord) {
  if (!stops || stops.length <= 2) return [...(stops || [])];
  const route = [...stops];
  let improved = true;
  let iterations = 0;
  const maxIterations = 50;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;
    for (let i = 0; i < route.length - 1; i++) {
      for (let k = i + 1; k < route.length; k++) {
        const prevCoord = i === 0 ? startCoord : route[i - 1];
        const nextCoord = k === route.length - 1 ? endCoord : route[k + 1];

        const currentDist =
          haversineM(prevCoord, route[i]) + haversineM(route[k], nextCoord);
        const newDist =
          haversineM(prevCoord, route[k]) + haversineM(route[i], nextCoord);

        // Meaningful improvement (> 25m)
        if (newDist < currentDist - 25) {
          const reversed = route.slice(i, k + 1).reverse();
          route.splice(i, reversed.length, ...reversed);
          improved = true;
        }
      }
    }
  }
  return route;
}

export const RouteEngine = {
  haversineM,
  addMinutesToTime,
  twoOptOptimize,

  /**
   * Optimizes the shortest pick-up / safe group ride route across multiple
   * attendee locations heading to a destination event or venue.
   *
   * @param {Array} waypoints List of attendee/pickup locations [{id, name, lat, lon, label}]
   * @param {Object} destination Destination venue {name, lat, lon}
   * @param {string} departureTime Scheduled start (e.g. "19:00")
   * @param {Object} startOrigin Starting depot or driver location {lat, lon, label}
   */
  optimizePickupRoute(
    waypoints = [],
    destination,
    departureTime = '19:00',
    startOrigin = null
  ) {
    const origin = startOrigin || {
      label: 'Trip Origin',
      lat: waypoints[0]?.lat ?? -26.0021,
      lon: waypoints[0]?.lon ?? 28.1945,
    };

    if (!destination || (!destination.lat && !destination.latitude) || (!destination.lon && !destination.longitude)) {
      throw new Error('Destination with valid coordinates is required.');
    }
    const destLat = Number(destination.lat ?? destination.latitude);
    const destLon = Number(destination.lon ?? destination.lng ?? destination.longitude);
    const destName = destination.name || destination.title || destination.venue_name || 'Destination';

    if (waypoints.length === 0) {
      const destCoords = { lat: destLat, lon: destLon };
      const directDistM = haversineM(origin, destCoords) * 1.25;
      const directKm = Math.round((directDistM / 1000) * 10) / 10;
      const directDriveMin = Math.max(5, Math.round((directKm / 65) * 60));
      return {
        startOrigin: { ...origin, departureTime },
        stops: [],
        destination: {
          name: destName,
          lat: destLat,
          lon: destLon,
          arrivalEta: addMinutesToTime(departureTime, directDriveMin),
        },
        totalDistanceKm: directKm,
        totalDriveTimeMin: directDriveMin,
        routePoints: [
          { lat: origin.lat, lon: origin.lon },
          { lat: destLat, lon: destLon },
        ],
      };
    }

    // 1. Nearest Neighbor heuristic
    const unvisited = [...waypoints];
    const orderedStops = [];
    let currentPos = origin;

    while (unvisited.length > 0) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < unvisited.length; i++) {
        const d = haversineM(currentPos, unvisited[i]);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      const nextStop = unvisited.splice(bestIdx, 1)[0];
      orderedStops.push(nextStop);
      currentPos = nextStop;
    }

    // 2. 2-Opt local search uncrossing
    const destCoords = { lat: destLat, lon: destLon };
    const optimizedStops = twoOptOptimize(orderedStops, origin, destCoords);

    // 3. Build turn-by-turn timeline, distances, and ETAs
    let curTime = departureTime;
    let runningDistM = 0;
    let runningTimeMin = 0;
    let prevPos = origin;
    const stops = [];
    const routePoints = [{ lat: origin.lat, lon: origin.lon }];

    optimizedStops.forEach((stop, idx) => {
      const sLat = Number(stop.lat ?? stop.latitude);
      const sLon = Number(stop.lon ?? stop.lng ?? stop.longitude);
      const stopCoord = { lat: sLat, lon: sLon };

      // 1.25x road factor
      const legM = haversineM(prevPos, stopCoord) * 1.25;
      const legKm = Math.round((legM / 1000) * 10) / 10;
      // Township/urban arterial ~35 km/h + 2 min boarding per stop
      const legDriveMin = Math.max(3, Math.round((legKm / 35) * 60) + 2);

      runningDistM += legM;
      runningTimeMin += legDriveMin;
      curTime = addMinutesToTime(curTime, legDriveMin);

      stops.push({
        stopNumber: idx + 1,
        id: stop.id || `stop-${idx + 1}`,
        name: stop.name || stop.title || `Stop ${idx + 1}`,
        label: stop.label || stop.address || `${legKm} km from prev`,
        lat: sLat,
        lon: sLon,
        eta: curTime,
        distanceFromPrevKm: legKm,
        driveTimeMin: legDriveMin,
      });

      routePoints.push(stopCoord);
      prevPos = stopCoord;
    });

    // Final leg to destination venue (highway/arterial ~65 km/h)
    const finalLegM = haversineM(prevPos, destCoords) * 1.25;
    const finalLegKm = Math.round((finalLegM / 1000) * 10) / 10;
    const finalLegDriveMin = Math.max(4, Math.round((finalLegKm / 65) * 60));

    runningDistM += finalLegM;
    runningTimeMin += finalLegDriveMin;
    const finalEta = addMinutesToTime(curTime, finalLegDriveMin);
    routePoints.push(destCoords);

    return {
      startOrigin: { ...origin, departureTime },
      stops,
      destination: {
        name: destName,
        lat: destLat,
        lon: destLon,
        arrivalEta: finalEta,
      },
      totalDistanceKm: Math.round((runningDistM / 1000) * 10) / 10,
      totalDriveTimeMin: runningTimeMin,
      routePoints,
    };
  },

  /**
   * Sort events chronologically and geometrically (with 2-opt) to form a logical journey.
   */
  async calculateOptimalPath(events, startCoords = null) {
    if (!events || events.length === 0) return [];

    // 1. Filter events with valid dates and coordinates
    const validEvents = events.filter(e => e.event_date && (e.lat || e.latitude) && (e.lon || e.longitude));

    // 2. Sort by date/time first
    const sortedByTime = [...validEvents].sort((a, b) => {
      const dateA = new Date(`${a.event_date}T${a.event_time || '00:00'}`);
      const dateB = new Date(`${b.event_date}T${b.event_time || '00:00'}`);
      return dateA - dateB;
    });

    if (sortedByTime.length <= 1) return sortedByTime;

    // 3. Vibe Heat Biasing & Nearest Neighbor
    const finalRoute = [];
    let currentPos = startCoords || {
      lat: sortedByTime[0].lat || sortedByTime[0].latitude,
      lon: sortedByTime[0].lon || sortedByTime[0].longitude,
    };
    let remaining = [...sortedByTime];

    let hotspots = null;
    try {
      const { data } = await supabase.rpc('find_gruv_hotspots', {
        user_lat: currentPos.lat,
        user_lon: currentPos.lon,
        radius_m: 20000,
      });
      hotspots = data;
    } catch {}

    while (remaining.length > 0) {
      let bestNextEvent = null;
      let bestIdx = 0;
      let highestScore = -Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const event = remaining[i];
        const evLat = event.lat || event.latitude;
        const evLon = event.lon || event.longitude;
        let score = 0;
        const distToEvent = GeoUtils.getDistance(currentPos.lat, currentPos.lon, evLat, evLon);
        score -= distToEvent * 0.5;
        if (hotspots?.some(h => GeoUtils.getDistance(h.lat, h.lon, evLat, evLon) < 1)) score += 20;
        if (score > highestScore) {
          highestScore = score;
          bestNextEvent = event;
          bestIdx = i;
        }
      }
      const next = bestNextEvent || remaining[0];
      const removeIdx = bestNextEvent ? bestIdx : 0;
      remaining.splice(removeIdx, 1);
      finalRoute.push(next);
      currentPos = { lat: next.lat || next.latitude, lon: next.lon || next.longitude };
    }

    // 4. 2-Opt refinement to uncross any zig-zagging legs
    const firstCoord = startCoords || {
      lat: finalRoute[0].lat || finalRoute[0].latitude,
      lon: finalRoute[0].lon || finalRoute[0].longitude,
    };
    const lastCoord = {
      lat: finalRoute[finalRoute.length - 1].lat || finalRoute[finalRoute.length - 1].latitude,
      lon: finalRoute[finalRoute.length - 1].lon || finalRoute[finalRoute.length - 1].longitude,
    };

    return twoOptOptimize(finalRoute, firstCoord, lastCoord);
  },

  /**
   * Estimate total travel time and distance for an ordered path.
   */
  getRouteStats(path = []) {
    let totalDistKm = 0;
    if (!path || path.length < 2) return { distance: '0.0', count: path?.length || 0, estimatedTravelTimeMins: 0 };

    for (let i = 0; i < path.length - 1; i++) {
      const start = path[i];
      const end = path[i + 1];
      const sLat = start.lat || start.latitude;
      const sLon = start.lon || start.longitude;
      const eLat = end.lat || end.latitude;
      const eLon = end.lon || end.longitude;
      totalDistKm += (haversineM({ lat: sLat, lon: sLon }, { lat: eLat, lon: eLon }) * 1.25) / 1000;
    }

    return {
      distance: totalDistKm.toFixed(1),
      count: path.length,
      estimatedTravelTimeMins: Math.round(totalDistKm * 2.2),
    };
  },

  /**
   * Generates smooth interpolated coordinate frames for a real-time animated tracer
   * moving along the route (similar to Ivory Park AC ipac-pin-me tracer).
   */
  generateRouteTracerFrames(routePoints = [], stepsPerSegment = 8) {
    if (!routePoints || routePoints.length < 2) return [];
    const frames = [];

    for (let i = 0; i < routePoints.length - 1; i++) {
      const p1 = routePoints[i];
      const p2 = routePoints[i + 1];
      const lat1 = Number(p1.lat ?? p1.latitude);
      const lon1 = Number(p1.lon ?? p1.lng ?? p1.longitude);
      const lat2 = Number(p2.lat ?? p2.latitude);
      const lon2 = Number(p2.lon ?? p2.lng ?? p2.longitude);

      for (let s = 0; s < stepsPerSegment; s++) {
        const fraction = s / stepsPerSegment;
        frames.push({
          lat: lat1 + (lat2 - lat1) * fraction,
          lon: lon1 + (lon2 - lon1) * fraction,
          progress: (i + fraction) / (routePoints.length - 1),
        });
      }
    }
    const last = routePoints[routePoints.length - 1];
    frames.push({
      lat: Number(last.lat ?? last.latitude),
      lon: Number(last.lon ?? last.lng ?? last.longitude),
      progress: 1.0,
    });
    return frames;
  },
};

export default RouteEngine;
