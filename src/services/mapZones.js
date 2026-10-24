/**
 * mapZones.js — client for The Living Map's civic layer (map_zones).
 *
 * A zone is an event's real-world impact drawn on the map: a road closure, an
 * affected area, a race route — with a type and a time window. Hosts create;
 * the community verifies (Truth Protocol); zones auto-expire server-side.
 *
 * All writes go through SECURITY DEFINER RPCs (host-gated, provenance stamped
 * from auth.uid()). Reads come back as GeoJSON so the client never touches a
 * PostGIS type. Everything is best-effort and wrapped so a map hiccup never
 * breaks the app.
 */
import { supabase } from './supabase';
import { logError } from '../utils/logError';

export const ZONE_KINDS = {
  road_closed:   { label: 'Road closed',   color: '#ef4444', icon: 'slash',      line: true  },
  heavy_traffic: { label: 'Heavy traffic', color: '#f59e0b', icon: 'alert-triangle', line: true },
  detour:        { label: 'Detour',        color: '#06b6d4', icon: 'corner-up-right', line: true },
  no_parking:    { label: 'No parking',    color: '#a855f7', icon: 'x-octagon',   line: false },
  route:         { label: 'Race route',    color: '#10b981', icon: 'flag',        line: true  },
  zone:          { label: 'Affected area', color: '#f97316', icon: 'map',         line: false },
  alert:         { label: 'Alert',         color: '#eab308', icon: 'bell',        line: false },
};

export const ZONE_STATUS = {
  declared:  { label: 'Declared by host',   dashed: true,  weight: 0.8 },
  confirmed: { label: 'Confirmed by locals', dashed: false, weight: 1 },
  official:  { label: 'Official',            dashed: false, weight: 1 },
};

/**
 * Extracts structured traffic, detour, pointsman and geometry tags from zone/report notes.
 */
export function parseZoneTags(note = '') {
  if (!note || typeof note !== 'string') {
    return {
      traffic: null,
      detour: null,
      pointsman: null,
      routeCoords: null,
      detourCoords: null,
      cleanNote: '',
    };
  }

  const trafficMatch = note.match(/\[TRAFFIC:\s*([^\]]+)\]/i);
  const detourMatch = note.match(/\[DETOUR:\s*([^\]]+)\]/i);
  const pointsmanMatch = note.match(/\[POINTSMAN:\s*(police|volunteer|none)\]/i);
  const routeMatch = note.match(/\[ROUTE_GEO:\s*([^\]]+)\]/i);
  const detourGeoMatch = note.match(/\[DETOUR_GEO:\s*([^\]]+)\]/i);

  const parsePairs = (str) => {
    return str
      .split(';')
      .map((p) => {
        const parts = p.split(',').map(Number);
        return [parts[0], parts[1]];
      })
      .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
  };

  const routeCoords = routeMatch ? parsePairs(routeMatch[1]) : null;
  const detourCoords = detourGeoMatch ? parsePairs(detourGeoMatch[1]) : null;

  const cleanNote = note
    .replace(/\[TRAFFIC:[^\]]+\]/gi, '')
    .replace(/\[DETOUR:[^\]]+\]/gi, '')
    .replace(/\[POINTSMAN:[^\]]+\]/gi, '')
    .replace(/\[ROUTE_GEO:[^\]]+\]/gi, '')
    .replace(/\[DETOUR_GEO:[^\]]+\]/gi, '')
    .trim();

  return {
    traffic: trafficMatch ? trafficMatch[1].trim() : null,
    detour: detourMatch ? detourMatch[1].trim() : null,
    pointsman: pointsmanMatch ? pointsmanMatch[1].toLowerCase() : null,
    routeCoords: routeCoords && routeCoords.length >= 2 ? routeCoords : null,
    detourCoords: detourCoords && detourCoords.length >= 2 ? detourCoords : null,
    cleanNote,
  };
}

/**
 * Formats note string with structured metadata tags.
 */
export function formatZoneNote({ note = '', traffic = null, detour = null, pointsman = null, routeCoords = null, detourCoords = null }) {
  const parts = [];
  if (traffic) parts.push(`[TRAFFIC: ${traffic}]`);
  if (detour) parts.push(`[DETOUR: ${detour}]`);
  if (pointsman) parts.push(`[POINTSMAN: ${pointsman}]`);
  if (routeCoords && routeCoords.length >= 2) {
    const geoStr = routeCoords.map(([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)}`).join(';');
    parts.push(`[ROUTE_GEO: ${geoStr}]`);
  }
  if (detourCoords && detourCoords.length >= 2) {
    const geoStr = detourCoords.map(([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)}`).join(';');
    parts.push(`[DETOUR_GEO: ${geoStr}]`);
  }
  if (note && note.trim()) parts.push(note.trim());
  return parts.join(' ').trim();
}

/**
 * Calculates 1-tap navigation URLs (Google Maps bypass + Waze).
 */
export function calculateDetourNavigation({ lat, lon, coordinates = null, detourCoords = null }) {
  let destLat = lat;
  let destLng = lon;

  if (coordinates && coordinates.length > 0) {
    const endCoord = coordinates[coordinates.length - 1];
    destLng = endCoord[0];
    destLat = endCoord[1];
  }

  let waypointsParam = '';
  if (detourCoords && detourCoords.length > 0) {
    const wp = detourCoords.slice(0, 3).map(([wLon, wLat]) => `${wLat.toFixed(5)},${wLon.toFixed(5)}`).join('|');
    waypointsParam = `&waypoints=${encodeURIComponent(wp)}`;
  }

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}${waypointsParam}&travelmode=driving`;
  const wazeUrl = `https://waze.com/ul?ll=${destLat},${destLng}&navigate=yes`;

  return { googleMapsUrl, wazeUrl, destLat, destLng };
}

export const MapZones = {
  // Fetch zones near a point, active at a given time. Returns GeoJSON-carrying rows.
  async near(lat, lng, { radiusM = 8000, at = null } = {}) {
    if (lat == null || lng == null) return [];
    try {
      const { data, error } = await supabase.rpc('zones_near', {
        p_lat: lat, p_lng: lng, p_radius_m: radiusM,
        p_at: at ? new Date(at).toISOString() : new Date().toISOString(),
      });
      if (error) throw error;
      return (data || []).map((z) => {
        let geom = safeParse(z.geojson);
        if (!geom && z.note) {
          const tags = parseZoneTags(z.note);
          if (tags.routeCoords) {
            geom = { type: 'LineString', coordinates: tags.routeCoords };
          } else if (tags.detourCoords) {
            geom = { type: 'LineString', coordinates: tags.detourCoords };
          }
        }
        return { ...z, geometry: geom };
      }).filter((z) => z.geometry);
    } catch (e) { logError('MapZones.near', e); return []; }
  },

  // Host creates a zone. `geometry` is a GeoJSON geometry object (LineString/Polygon).
  async create({ eventId, kind, geometry, startsAt, endsAt, label, note, severity = 2 }) {
    const { data, error } = await supabase.rpc('zone_create', {
      p_event: eventId,
      p_kind: kind,
      p_geojson: JSON.stringify(geometry),
      p_starts_at: new Date(startsAt).toISOString(),
      p_ends_at: new Date(endsAt).toISOString(),
      p_label: label || null,
      p_note: note || null,
      p_severity: severity,
    });
    if (error) { logError('MapZones.create', error); throw error; }
    return data;
  },

  async remove(zoneId) {
    const { error } = await supabase.rpc('zone_remove', { p_zone: zoneId });
    if (error) { logError('MapZones.remove', error); throw error; }
  },

  // Confirm / dispute a zone (Truth Protocol). Returns the updated row.
  async verify(zoneId, vote /* 'confirm' | 'dispute' */) {
    const { data, error } = await supabase.rpc('zone_verify', { p_zone: zoneId, p_vote: vote });
    if (error) { logError('MapZones.verify', error); throw error; }
    return data;
  },

  // Live updates: any zone insert/update/expire re-runs the caller's fetch.
  subscribe(onChange) {
    const channel = supabase
      .channel(`map_zones_${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'map_zones' }, () => onChange?.())
      .subscribe();
    return () => { try { supabase.removeChannel(channel); } catch {} };
  },
};

function safeParse(s) {
  try { return typeof s === 'string' ? JSON.parse(s) : s; } catch { return null; }
}
