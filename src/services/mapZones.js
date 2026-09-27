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
      return (data || []).map((z) => ({ ...z, geometry: safeParse(z.geojson) })).filter((z) => z.geometry);
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
