/**
 * mapReports.js — client for the crowdsourced map layer (map_reports).
 *
 * A report is a typed pin a user drops on the live map — "long queue", "free
 * water", "unsafe corner", "taxi rank" (see constants/mapContributions.js). The
 * community confirms or disputes it (Truth Protocol) and it auto-expires. All
 * provenance + rules are server-side (report_map / verify_map_report SECURITY
 * DEFINER RPCs): the author is stamped from auth.uid(), the TTL is clamped, and
 * votes are deduped — so nothing here can be spoofed from the client.
 *
 * Reads are a plain bounded query (RLS only returns live reports), so no PostGIS.
 */
import { supabase } from './supabase';
import { logError } from '../utils/logError';
import { MAP_REPORT_BY_KEY } from '../constants/mapContributions';

// ~metres → degrees (rough, lat-only is fine for a small bbox around a user).
const mToDeg = (m) => m / 111000;

export const MapReports = {
  /** Live reports within a box around a point. */
  async near(lat, lng, { radiusM = 6000 } = {}) {
    if (lat == null || lng == null) return [];
    const d = mToDeg(radiusM);
    try {
      const { data, error } = await supabase
        .from('map_reports')
        .select('id, kind, lat, lon, note, status, confirm_count, dispute_count, expires_at, author_id, created_at')
        .gt('expires_at', new Date().toISOString())
        .gte('lat', lat - d).lte('lat', lat + d)
        .gte('lon', lng - d).lte('lon', lng + d)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    } catch (e) { logError('MapReports.near', e); return []; }
  },

  /** Drop a report. `kind` is a catalog key; TTL comes from the catalog (clamped server-side). */
  async create({ kind, lat, lon, note = null }) {
    const ttlH = MAP_REPORT_BY_KEY[kind]?.ttlH || 6;
    const { data, error } = await supabase.rpc('report_map', {
      p_kind: kind, p_lat: lat, p_lon: lon, p_note: note, p_ttl_hours: ttlH,
    });
    if (error) { logError('MapReports.create', error); throw error; }
    return Array.isArray(data) ? data[0] : data;
  },

  /** Confirm / dispute (Truth Protocol). Returns the updated row. */
  async verify(reportId, vote /* 'confirm' | 'dispute' */) {
    const { data, error } = await supabase.rpc('verify_map_report', { p_report: reportId, p_vote: vote });
    if (error) { logError('MapReports.verify', error); throw error; }
    return Array.isArray(data) ? data[0] : data;
  },

  /** Author removes their own report. */
  async remove(reportId) {
    const { error } = await supabase.from('map_reports').delete().eq('id', reportId);
    if (error) { logError('MapReports.remove', error); throw error; }
  },

  /** Live updates — any report insert/update re-runs the caller's fetch. */
  subscribe(onChange) {
    const channel = supabase
      .channel(`map_reports_${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'map_reports' }, () => onChange?.())
      .subscribe();
    return () => { try { supabase.removeChannel(channel); } catch {} };
  },
};

export default MapReports;
