/**
 * Royal Routes Engine — Calculates optimal paths between multiple events.
 * Handles journey logic, time estimations, and waypoint sequencing.
 * Now with Vibe-Optimal Pathfinding.
 */
import { GeoUtils } from './dataFlow';
import { supabase } from './supabase';

export const RouteEngine = {
  // Sort events chronologically and then by distance to form a logical journey
  async calculateOptimalPath(events, startCoords = null) {
    if (!events || events.length === 0) return [];

    // 1. Filter events with valid dates and coordinates
    const validEvents = events.filter(e => e.event_date && e.lat && e.lon);

    // 2. Sort by date/time first
    const sortedByTime = [...validEvents].sort((a, b) => {
      const dateA = new Date(`${a.event_date}T${a.event_time || '00:00'}`);
      const dateB = new Date(`${b.event_date}T${b.event_time || '00:00'}`);
      return dateA - dateB;
    });

    if (sortedByTime.length <= 1) return sortedByTime;

    // 3. NEURAL ROUTING: Optimize for "Vibe Heat"
    const finalRoute = [];
    let currentPos = startCoords || { lat: sortedByTime[0].lat, lon: sortedByTime[0].lon };
    let remaining = [...sortedByTime];

    // Fetch spatial hotspots to bias the route towards high-vibe areas
    let hotspots = null;
    try {
      const { data } = await supabase.rpc('find_gruv_hotspots', {
        user_lat: currentPos.lat,
        user_lon: currentPos.lon,
        radius_m: 20000 // 20km radius for hotspot detection
      });
      hotspots = data;
    } catch { /* RPC may not exist yet — graceful fallback */ }

    while (remaining.length > 0) {
      let bestNextEvent = null;
      let bestIdx = 0;
      let highestScore = -Infinity;

      // Prioritize events that are near a hotspot and are next chronologically
      for (let i = 0; i < remaining.length; i++) {
        const event = remaining[i];
        let score = 0;
        const distToEvent = GeoUtils.getDistance(currentPos.lat, currentPos.lon, event.lat, event.lon);
        score -= distToEvent * 0.5; // Penalty for distance
        // Boost for being near a hotspot
        if (hotspots?.some(h => GeoUtils.getDistance(h.lat, h.lon, event.lat, event.lon) < 1)) score += 20;
        if (score > highestScore) { highestScore = score; bestNextEvent = event; bestIdx = i; }
      }
      const next = bestNextEvent || remaining[0];
      const removeIdx = bestNextEvent ? bestIdx : 0;
      remaining.splice(removeIdx, 1); // Remove from remaining to prevent infinite loop
      finalRoute.push(next);
      currentPos = { lat: next.lat, lon: next.lon };
    }

    return finalRoute;
  },

  // Estimate total travel time and distance
  getRouteStats(path) {
    let totalDist = 0;
    if (path.length < 2) return { distance: 0, count: path.length };

    for (let i = 0; i < path.length - 1; i++) {
      const start = path[i];
      const end = path[i + 1];
      totalDist += GeoUtils.getDistance(start.lat, start.lon, end.lat, end.lon);
    }

    return {
      distance: totalDist.toFixed(1),
      count: path.length,
      estimatedTravelTimeMins: Math.round(totalDist * 2.5) // Rough estimate: 2.5 mins per km (city traffic)
    };
  }
};
