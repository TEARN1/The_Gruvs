/**
 * pathService — Path data operations for The Gruvs Movement OS.
 * Handles: user paths, live check-ins, path crossings, presence ledger.
 */
import { supabase } from './supabase';

const CHECKIN_TTL_MINUTES = 90;

export const pathService = {

  // ── Paths ──────────────────────────────────────────────────────────────────

  async createPath({ userId, eventId, origin, destination, intentTag, identityLayer = 'public' }) {
    const { data, error } = await supabase
      .from('paths')
      .insert({
        user_id:        userId,
        event_id:       eventId,
        origin_lat:     origin?.lat,
        origin_lon:     origin?.lon,
        origin_label:   origin?.label,
        dest_lat:       destination?.lat,
        dest_lon:       destination?.lon,
        dest_label:     destination?.label,
        intent_tag:     intentTag,
        identity_layer: identityLayer,
        created_at:     new Date().toISOString(),
      })
      .select()
      .single();
    if (error) { console.warn('createPath:', error.message); return null; }
    return data;
  },

  async fetchUserPaths(userId, limit = 20) {
    const { data, error } = await supabase
      .from('paths')
      .select('*, events(title, venue_name, event_date, event_time)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) { console.warn('fetchUserPaths:', error.message); return []; }
    return data || [];
  },

  async fetchPathsByEvent(eventId) {
    const { data, error } = await supabase
      .from('paths')
      .select('id, intent_tag, identity_layer, origin_label, dest_label, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    if (error) { console.warn('fetchPathsByEvent:', error.message); return []; }
    return data || [];
  },

  // ── Live Check-ins (Presence Ledger) ──────────────────────────────────────

  async checkIn({ userId, eventId, lat, lon, identityLayer = 'public', ghostAlias = null }) {
    const expiresAt = new Date(Date.now() + CHECKIN_TTL_MINUTES * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('live_checkins')
      .upsert(
        {
          user_id:        userId,
          event_id:       eventId,
          lat,
          lon,
          identity_layer: identityLayer,
          ghost_alias:    identityLayer === 'ghost' ? ghostAlias : null,
          checked_in_at:  new Date().toISOString(),
          expires_at:     expiresAt,
        },
        { onConflict: 'user_id,event_id' }
      )
      .select()
      .single();
    if (error) { console.warn('checkIn:', error.message); return null; }
    return data;
  },

  async checkOut(userId, eventId) {
    const { error } = await supabase
      .from('live_checkins')
      .delete()
      .eq('user_id', userId)
      .eq('event_id', eventId);
    if (error) { console.warn('checkOut:', error.message); return false; }
    return true;
  },

  async fetchLiveCheckins(eventId) {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('live_checkins')
      .select('*, profiles(username, avatar_url, social_integrity_score)')
      .eq('event_id', eventId)
      .gt('expires_at', now)
      .order('checked_in_at', { ascending: false });
    if (error) { console.warn('fetchLiveCheckins:', error.message); return []; }
    return data || [];
  },

  async subscribeToCheckins(eventId, callback) {
    const channel = supabase
      .channel(`checkins:${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_checkins', filter: `event_id=eq.${eventId}` },
        () => pathService.fetchLiveCheckins(eventId).then(callback)
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  },

  // ── Path Crossings (Invisible Hand Matcher) ────────────────────────────────

  async recordPathCrossing(pathIdA, pathIdB, overlapScore) {
    const { error } = await supabase
      .from('path_crossings')
      .insert({ path_id_a: pathIdA, path_id_b: pathIdB, overlap_score: overlapScore });
    if (error) { console.warn('recordPathCrossing:', error.message); }
  },

  async findNearbyPaths({ lat, lon, radiusKm = 2, eventId }) {
    // Haversine approximation: 1 degree lat ≈ 111km
    const latDelta = radiusKm / 111;
    const lonDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
    const query = supabase
      .from('paths')
      .select('id, user_id, dest_lat, dest_lon, intent_tag, identity_layer, created_at')
      .gte('dest_lat', lat - latDelta)
      .lte('dest_lat', lat + latDelta)
      .gte('dest_lon', lon - lonDelta)
      .lte('dest_lon', lon + lonDelta)
      .order('created_at', { ascending: false })
      .limit(50);
    if (eventId) query.eq('event_id', eventId);
    const { data, error } = await query;
    if (error) { console.warn('findNearbyPaths:', error.message); return []; }
    return data || [];
  },

  // ── Return Path Daemon ─────────────────────────────────────────────────────

  async fetchReturnGroups(eventId, userHomeBase) {
    if (!userHomeBase) return [];
    const { lat, lon } = userHomeBase;
    const radiusDeg = 5 / 111; // ~5km
    const { data, error } = await supabase
      .from('paths')
      .select('id, user_id, dest_lat, dest_lon, identity_layer, ghost_alias, profiles(username, avatar_url, social_integrity_score)')
      .eq('event_id', eventId)
      .eq('intent_tag', 'going_home')
      .gte('dest_lat', lat - radiusDeg)
      .lte('dest_lat', lat + radiusDeg)
      .limit(20);
    if (error) { console.warn('fetchReturnGroups:', error.message); return []; }
    return data || [];
  },

  async setGoingHome({ userId, eventId, homeLat, homeLon, identityLayer = 'public' }) {
    return pathService.createPath({
      userId,
      eventId,
      origin:    null,
      destination: { lat: homeLat, lon: homeLon, label: 'Home' },
      intentTag: 'going_home',
      identityLayer,
    });
  },

  // ── Path Stars (anonymized engagement) ────────────────────────────────────

  async starPath(userId, pathId) {
    const { error } = await supabase
      .from('path_stars')
      .insert({ user_id: userId, path_id: pathId });
    if (error && error.code !== '23505') console.warn('starPath:', error.message);
  },

  async getPathStarCount(pathId) {
    const { count, error } = await supabase
      .from('path_stars')
      .select('*', { count: 'exact', head: true })
      .eq('path_id', pathId);
    if (error) return 0;
    return count || 0;
  },
};
