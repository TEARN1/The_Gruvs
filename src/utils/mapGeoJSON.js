/**
 * mapGeoJSON — every "app row → GeoJSON" conversion the map does, in one place.
 *
 * These lived inside LiveMap.js (the web renderer). Native needs exactly the
 * same shapes — MapLibre's style spec is the same on both platforms, so the only
 * thing that legitimately differs between renderers is HOW layers are declared,
 * not what goes into them. Keeping the converters here means the native map is a
 * second renderer over shared data, rather than a second implementation that
 * quietly drifts from the web one.
 *
 * All pure: rows in, GeoJSON out, no map instance involved.
 */
import { ZONE_KINDS } from '../services/mapZones';
import { MAP_REPORT_BY_KEY } from '../constants/mapContributions';

export const emptyFC = () => ({ type: 'FeatureCollection', features: [] });

export const eventsToGeoJSON = (events = []) => ({
  type: 'FeatureCollection',
  features: (events || [])
    .map((e) => {
      const lat = e.lat ?? e.latitude, lng = e.lon ?? e.longitude;
      if (lat == null || lng == null) return null;
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
        properties: {
          id: e.id, title: e.title || 'Event',
          // Prefer the live Touch-Down tally (?? keeps a real 0 as 0 — heat/hot
          // pins stay honest); only fall back to going when no live count exists.
          here: Number(e.here_count ?? e.going ?? 0),
          cat: e.category || '',
          biz: !!(e.is_business || e.profiles?.is_business),
        },
      };
    })
    .filter(Boolean),
});

export function zonesToGeoJSON(zones = []) {
  return {
    type: 'FeatureCollection',
    features: (zones || [])
      .filter((z) => z.geometry)
      .map((z) => ({
        type: 'Feature',
        geometry: z.geometry,
        properties: {
          id: z.id, kind: z.kind, status: z.status,
          color: (ZONE_KINDS[z.kind] || {}).color || '#ef4444',
          dashed: z.status === 'declared' ? 1 : 0,
          // Severity drives how loud the line reads (1 = minor, 3 = major).
          severity: Math.max(1, Math.min(3, Number(z.severity) || 2)),
        },
      })),
  };
}

/** Entry/exit labels at the ends of a road closure. */
export function zonesToMarkersGeoJSON(zones = []) {
  const features = [];
  (zones || []).forEach((z) => {
    if (z.kind === 'road_closed' && z.geometry?.type === 'LineString' && z.geometry.coordinates.length >= 2) {
      const coords = z.geometry.coordinates;
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: coords[0] }, properties: { label: 'ENTRY' } });
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: coords[coords.length - 1] }, properties: { label: 'EXIT' } });
    }
  });
  return { type: 'FeatureCollection', features };
}

/** Crowdsourced report pins, carrying the catalog colour + status. */
export function reportsToGeoJSON(reports = []) {
  return {
    type: 'FeatureCollection',
    features: (reports || [])
      .filter((r) => r && r.lat != null && r.lon != null)
      .map((r) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [Number(r.lon), Number(r.lat)] },
        properties: { id: r.id, status: r.status || 'reported', color: (MAP_REPORT_BY_KEY[r.kind] || {}).color || '#00f2ff' },
      })),
  };
}

/** A single LineString from [[lng,lat],…] (the route to a chosen pin). */
export function lineGeoJSON(coords) {
  if (!Array.isArray(coords) || coords.length < 2) return emptyFC();
  return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} }] };
}

/** Plain {lat,lng} points — Fog of the City, "you are here". */
export function pointsToGeoJSON(pts) {
  return {
    type: 'FeatureCollection',
    features: (pts || [])
      .filter((p) => p && p.lat != null && p.lng != null)
      .map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [Number(p.lng), Number(p.lat)] },
        properties: {},
      })),
  };
}

/** Accommodation pins (Resident Crew), each carrying its id for tap-open. */
export function staysToGeoJSON(stays) {
  return {
    type: 'FeatureCollection',
    features: (stays || [])
      .filter((s) => s && s.lat != null && s.lng != null)
      .map((s) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [Number(s.lng), Number(s.lat)] },
        properties: { id: s.id },
      })),
  };
}

export function poisToGeoJSON(pois) {
  return {
    type: 'FeatureCollection',
    features: (pois || [])
      .filter((p) => p && p.lat != null && p.lng != null)
      .map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [Number(p.lng), Number(p.lat)] },
        properties: { icon: p.icon || '📍' },
      })),
  };
}

/** Crew Convergence — one pin per event, with how many of your crew are going. */
export function crewToGeoJSON(crew) {
  return {
    type: 'FeatureCollection',
    features: (crew || [])
      .filter((c) => c && c.lat != null && c.lng != null)
      .map((c) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [Number(c.lng), Number(c.lat)] },
        properties: { count: c.count ?? (c.people ? c.people.length : 1), eventId: c.eventId ?? null },
      })),
  };
}

export function nearbyToGeoJSON(nearby) {
  return {
    type: 'FeatureCollection',
    features: (nearby || [])
      .filter((v) => v && v.lat != null && v.lon != null)
      .map((v) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [Number(v.lon), Number(v.lat)] },
        properties: { id: v.id, username: v.username, avatar: v.avatar_url },
      })),
  };
}

export function trailsToGeoJSON(trails) {
  return {
    type: 'FeatureCollection',
    features: (trails || [])
      .filter((t) => t.from?.lat != null && t.to?.lat != null)
      .map((t) => ({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [[Number(t.from.lng), Number(t.from.lat)], [Number(t.to.lng), Number(t.to.lat)]],
        },
        // How many people actually made this hop — drives line weight, so a
        // well-worn route between two venues reads heavier than a rare one.
        properties: { people: Number(t.people) || 0 },
      })),
  };
}

/**
 * The final geometry a host submits for a zone. Lives here rather than in a
 * renderer, because it is the same on web and native — and ZoneDrawTool used to
 * import it from LiveMap, which would have resolved to the WEB renderer's file
 * on native once a platform-specific twin existed.
 */
export function buildGeometry(mode, pts) {
  if (!pts || pts.length < 2) return null;
  if (mode === 'polygon') {
    if (pts.length < 3) return null;
    return { type: 'Polygon', coordinates: [[...pts, pts[0]]] };
  }
  return { type: 'LineString', coordinates: pts };
}

/** The in-progress zone a host is tracing: vertices, plus the line so far. */
export function drawGeoJSON(mode, pts) {
  if (!mode || !pts || pts.length === 0) return emptyFC();
  const features = pts.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: {} }));
  if (pts.length >= 2) {
    const coordinates = mode === 'polygon' ? [...pts, pts[0]] : pts;
    features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: {} });
  }
  return { type: 'FeatureCollection', features };
}
