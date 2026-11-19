/**
 * src/utils/weeklyDigest.js
 *
 * Proximity calculation and 2-week event ranking for the weekly email digest.
 */

export const HAVERSINE_R = 6371; // Earth radius in kilometers

export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);
  if (!Number.isFinite(nLat1) || !Number.isFinite(nLon1) || !Number.isFinite(nLat2) || !Number.isFinite(nLon2)) {
    return null;
  }

  const dLat = ((nLat2 - nLat1) * Math.PI) / 180;
  const dLon = ((nLon2 - nLon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((nLat1 * Math.PI) / 180) * Math.cos((nLat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(HAVERSINE_R * c * 10) / 10;
}

export function rankEventsForUser(user, events, { maxEvents = 6, maxRadiusKm = 150 } = {}) {
  const userLat = user.home_base_lat ?? user.lat ?? null;
  const userLon = user.home_base_lon ?? user.lon ?? null;
  const hasCoords = userLat != null && userLon != null;
  const areaLabel = (user.home_area || user.location || '').toLowerCase().trim();

  const ranked = (events || []).map((event) => {
    const eLat = event.lat ?? event.latitude ?? null;
    const eLon = event.lon ?? event.longitude ?? null;
    let dist = null;

    if (hasCoords && eLat != null && eLon != null) {
      dist = haversineDistanceKm(userLat, userLon, eLat, eLon);
    }

    let areaMatch = false;
    if (areaLabel && areaLabel.length >= 3) {
      const eCity = (event.city || '').toLowerCase();
      const eLoc = (event.location || '').toLowerCase();
      const eVenue = (event.venue_name || '').toLowerCase();
      const eAddr = (event.address || '').toLowerCase();
      areaMatch = eCity.includes(areaLabel) || eLoc.includes(areaLabel) || eVenue.includes(areaLabel) || eAddr.includes(areaLabel);
    }

    return {
      ...event,
      distance_km: dist,
      _areaMatch: areaMatch,
    };
  });

  ranked.sort((a, b) => {
    if (a.distance_km != null && b.distance_km != null) {
      if (Math.abs(a.distance_km - b.distance_km) > 3) {
        return a.distance_km - b.distance_km;
      }
      return (a.event_date || '').localeCompare(b.event_date || '');
    }

    if (a.distance_km != null && a.distance_km <= maxRadiusKm) return -1;
    if (b.distance_km != null && b.distance_km <= maxRadiusKm) return 1;

    if (a._areaMatch && !b._areaMatch) return -1;
    if (!a._areaMatch && b._areaMatch) return 1;

    return (a.event_date || '').localeCompare(b.event_date || '');
  });

  return ranked.slice(0, maxEvents);
}
