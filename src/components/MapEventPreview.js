/**
 * MapEventPreview — the actionable place card that slides up when you tap an
 * event pin on The Map. It's a mini command centre, not just a preview:
 *
 *   • cover, smart countdown, and how far / how long to get there
 *   • live "here now" count (verified Touch-Downs) + who's going, friends first
 *   • act without leaving the map: RSVP, Save, Touch Down, or route there
 *   • warns if a live road closure sits right next to the venue (Truth Protocol)
 *   • swipe through the other nearby pins without closing
 *
 * All data comes from the managers the rest of the app already uses, so nothing
 * here is fabricated — a section simply hides when its data is missing.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, PanResponder, Platform, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SmartImage } from './SmartImage';
import { distanceKm } from '../utils/geo';
import { FeedManager, RSVPManager, BookmarkManager, CheckInManager, DiscoveryManager } from '../services/dataFlow';
import { thumb } from '../utils/storageThumb';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from './ToastNotification';
import { ViberProfileModal } from './ViberProfileModal';

// A closure within this many metres of the venue is "right next to it".
const CLOSURE_NEAR_M = 450;

const evLatLng = (e) => ({ lat: e?.lat ?? e?.latitude, lng: e?.lon ?? e?.longitude });

// "Tonight · 9:00 PM", "Sat · in 2 days", "Live now" — humane, glanceable.
function whenLabel(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const now = new Date();
  const ms = d - now;
  const day = 86400000;
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (ms < -3 * 3600000) return `Ended`;
  if (ms < 0) return `Live now`;
  if (sameDay) return `Tonight · ${time}`;
  if (ms < 2 * day) return `Tomorrow · ${time}`;
  const days = Math.round(ms / day);
  return `${d.toLocaleDateString([], { weekday: 'short' })} · in ${days} day${days === 1 ? '' : 's'}`;
}

// Rough, honest travel estimate: walk under 2 km, otherwise a city drive.
function travelLabel(km) {
  if (km == null) return null;
  if (km < 2) return `${Math.max(1, Math.round((km / 5) * 60))} min walk`;
  return `${Math.max(1, Math.round((km / 30) * 60))} min drive`;
}

export function MapEventPreview({
  events = [],          // the nearby pins, for swiping
  startId,              // which pin was tapped
  userCoords,           // { lat, lng } | null
  zones = [],           // live impact zones, to flag closures near the venue
  onOpenEvent,          // (id) => void — full detail
  onOpenZone,           // (zone) => void
  onClose,
  onAuthRequired,
}) {
  const { user } = useAuth();
  const { currentTheme } = useTheme();
  const { show: toast } = useToast();
  const primary = currentTheme?.primary || '#00f2ff';
  const bg = currentTheme?.background || '#0d1112';
  const text = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.55)';
  const surface = currentTheme?.surface || '#141a1c';

  const ids = events.map((e) => e.id);
  const [index, setIndex] = useState(Math.max(0, ids.indexOf(startId)));
  useEffect(() => { setIndex(Math.max(0, ids.indexOf(startId))); }, [startId]); // eslint-disable-line

  const base = events[index] || null;
  const [full, setFull] = useState(base);
  const [going, setGoing] = useState(false);
  const [attendees, setAttendees] = useState([]);
  const [viberId, setViberId] = useState(null);
  const [viberVisible, setViberVisible] = useState(false);
  const [saved, setSaved] = useState(false);
  const [goingCount, setGoingCount] = useState(base?.going || 0);
  const [friends, setFriends] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!full?.id) return;
    DiscoveryManager.getEventAttendees(full.id).then(setAttendees).catch(() => {});
  }, [full?.id]);

  const openViber = (id) => {
    setViberId(id);
    setViberVisible(true);
  };

  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(slide, { toValue: 1, useNativeDriver: true, tension: 60, friction: 11 }).start();
  }, [slide]);

  // Load everything for the current pin. Each piece fails soft.
  const load = useCallback(async (ev) => {
    if (!ev?.id) return;
    setFull(ev); setGoingCount(ev.going || 0); setGoing(false); setSaved(false); setAttendees([]); setFriends(0);
    const [detail, count, status, live] = await Promise.all([
      FeedManager.fetchSingle(ev.id).catch(() => null),
      RSVPManager.getGoingCount(ev.id).catch(() => ev.going || 0),
      user ? RSVPManager.getUserStatus(ev.id, user.id).catch(() => null) : Promise.resolve(null),
      CheckInManager.getLiveAttendees(ev.id).catch(() => []),
    ]);
    if (detail) setFull((f) => ({ ...f, ...detail }));
    setGoingCount(count || 0);
    setGoing(status === 'going');
    // live rows are { user_id, profiles: { username, avatar_url } } — flatten.
    setAttendees((Array.isArray(live) ? live : []).map((a) => ({
      id: a.user_id || a.id,
      username: a.profiles?.username || a.username,
      avatar_url: a.profiles?.avatar_url || a.avatar_url,
    })));
    if (user) {
      try {
        const saw = await BookmarkManager.getUserSaved(user.id);
        setSaved(Array.isArray(saw) ? saw.some((s) => (s.event_id || s.id) === ev.id) : false);
      } catch {}
      // Friends going = people you follow among the RSVPs.
      try {
        const [{ data: rsvps }, { data: follows }] = await Promise.all([
          supabase.from('event_rsvps').select('user_id').eq('event_id', ev.id).eq('status', 'going').limit(500),
          supabase.from('follows').select('following_id').eq('follower_id', user.id).limit(1000),
        ]);
        const followed = new Set((follows || []).map((f) => f.following_id));
        setFriends((rsvps || []).filter((r) => followed.has(r.user_id)).length);
      } catch {}
    }
  }, [user]);

  useEffect(() => { if (base) load(base); }, [index]); // eslint-disable-line

  if (!base) return null;

  const { lat, lng } = evLatLng(full);
  const km = (userCoords && lat != null) ? distanceKm(userCoords.lat, userCoords.lng, lat, lng) : null;
  const cover = full.cover_url || full.image_url;
  const when = whenLabel(full.event_date || full.start_time);
  const here = attendees.length;

  // A live closure hugging this venue?
  const closure = (lat != null) ? zones.find((z) => {
    if (!z?.geometry) return false;
    const c = z.geometry.type === 'Point' ? z.geometry.coordinates
      : (z.geometry.coordinates?.[0]?.[0] || z.geometry.coordinates?.[0]);
    if (!Array.isArray(c)) return false;
    return distanceKm(lat, lng, c[1], c[0]) * 1000 < CLOSURE_NEAR_M
      && (z.kind === 'road_closed' || z.kind === 'detour');
  }) : null;

  const requireAuth = () => { if (!user) { onAuthRequired?.(); return true; } return false; };

  const toggleGoing = async () => {
    if (requireAuth() || busy) return;
    setBusy(true);
    const next = !going;
    setGoing(next); setGoingCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      if (next) await RSVPManager.upsert(full.id, user.id, 'going');
      else await RSVPManager.remove(full.id, user.id);
    } catch {
      setGoing(!next); setGoingCount((c) => Math.max(0, c + (next ? -1 : 1)));
      toast('Could not update RSVP.', 'error');
    } finally { setBusy(false); }
  };

  const toggleSave = async () => {
    if (requireAuth()) return;
    const next = !saved;
    setSaved(next);
    try { await BookmarkManager.toggle(full.id, user.id, saved); }
    catch { setSaved(!next); toast('Could not save.', 'error'); }
  };

  const takeMeThere = () => {
    if (lat == null) { toast('No location on this event.', 'info'); return; }
    // Since we're already on the Map tab, "Take me there" just closes the
    // preview so the user can follow the dotted route line already drawn
    // on the main map.
    onClose();
    toast('Follow the dotted line on the map.', 'info');
  };

  const go = (delta) => {
    const n = index + delta;
    if (n < 0 || n >= events.length) return;
    slide.setValue(0.7);
    Animated.spring(slide, { toValue: 1, useNativeDriver: true, tension: 70, friction: 12 }).start();
    setIndex(n);
  };

  // Horizontal swipe on the sheet moves between pins.
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
    onPanResponderRelease: (_e, g) => { if (g.dx <= -40) go(1); else if (g.dx >= 40) go(-1); },
  })).current;

  return (
    <Animated.View
      {...pan.panHandlers}
      style={[cs.sheet, {
        backgroundColor: `${bg}f7`, borderColor: `${primary}40`,
        opacity: slide, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
      }]}
    >
      {/* Carousel controls + close */}
      <View style={cs.topRow}>
        <TouchableOpacity onPress={() => go(-1)} disabled={index === 0} style={cs.navBtn} hitSlop={cs.hit}>
          <Feather name="chevron-left" size={20} color={index === 0 ? `${muted}66` : text} />
        </TouchableOpacity>
        <Text style={[cs.counter, { color: muted }]}>{index + 1} / {events.length}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity onPress={() => go(1)} disabled={index >= events.length - 1} style={cs.navBtn} hitSlop={cs.hit}>
            <Feather name="chevron-right" size={20} color={index >= events.length - 1 ? `${muted}66` : text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={cs.navBtn} hitSlop={cs.hit}>
            <Feather name="x" size={20} color={text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        {/* Cover */}
        {cover
          ? <SmartImage source={cover} style={cs.cover} />
          : <View style={[cs.cover, { backgroundColor: `${primary}18`, alignItems: 'center', justifyContent: 'center' }]}>
              <Feather name="calendar" size={22} color={primary} />
            </View>}

        <View style={{ flex: 1, gap: 4 }}>
          <Text numberOfLines={2} style={[cs.title, { color: text }]}>{full.title || 'Event'}</Text>
          {when && (
            <View style={cs.metaRow}>
              <Feather name={when === 'Live now' ? 'radio' : 'clock'} size={12} color={when === 'Live now' ? '#10b981' : muted} />
              <Text style={[cs.meta, { color: when === 'Live now' ? '#10b981' : muted, fontWeight: when === 'Live now' ? '800' : '600' }]}>{when}</Text>
            </View>
          )}
          {full.venue_name ? (
            <View style={cs.metaRow}><Feather name="map-pin" size={12} color={muted} /><Text numberOfLines={1} style={[cs.meta, { color: muted }]}>{full.venue_name}</Text></View>
          ) : null}
          {km != null && (
            <View style={cs.metaRow}>
              <Feather name="navigation" size={12} color={primary} />
              <Text style={[cs.meta, { color: primary, fontWeight: '700' }]}>{km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`} · {travelLabel(km)}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Social proof — live here-now, going, friends */}
      <View style={cs.proofRow}>
        {here > 0 && (
          <View style={cs.proofChip}>
            <View style={cs.liveDot} />
            <Text style={[cs.proofText, { color: '#10b981' }]}>{here} here now</Text>
          </View>
        )}
        <View style={cs.proofChip}>
          <Feather name="users" size={12} color={muted} />
          <Text style={[cs.proofText, { color: muted }]}>{goingCount} going</Text>
        </View>
        {friends > 0 && (
          <View style={cs.proofChip}>
            <Feather name="heart" size={12} color={primary} />
            <Text style={[cs.proofText, { color: primary }]}>{friends} you follow</Text>
          </View>
        )}
        {/* Live attendee avatars — tapping opens their networking profile */}
        {attendees.slice(0, 5).map((a, i) => (
          <TouchableOpacity key={a.id || i} onPress={() => openViber(a.id)}>
            {a?.avatar_url
              ? <SmartImage source={a.avatar_url} style={[cs.av, { marginLeft: i ? -8 : 4, borderColor: bg }]} />
              : <View style={[cs.av, { marginLeft: i ? -8 : 4, borderColor: bg, backgroundColor: `${primary}22`, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: text, fontSize: 10, fontWeight: '800' }}>{(a?.username || '?')[0]?.toUpperCase()}</Text>
                </View>
            }
          </TouchableOpacity>
        ))}
      </View>

      {/* Networking Modal */}
      {viberVisible && (
        <ViberProfileModal
          visible={viberVisible}
          userId={viberId}
          onClose={() => setViberVisible(false)}
        />
      )}

      {/* Truth Protocol — closure right by the venue */}
      {closure && (
        <TouchableOpacity onPress={() => onOpenZone?.(closure)} style={[cs.warn, { borderColor: '#ef444455' }]} activeOpacity={0.8}>
          <Feather name="alert-triangle" size={13} color="#ef4444" />
          <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700', flex: 1 }}>
            {closure.kind === 'road_closed' ? 'Road closed' : 'Detour'} right by the venue — tap for details
          </Text>
        </TouchableOpacity>
      )}

      {/* Actions */}
      <View style={cs.actions}>
        <TouchableOpacity onPress={toggleGoing} style={[cs.actBtn, { backgroundColor: going ? primary : `${primary}18`, borderColor: primary }]}>
          <Feather name={going ? 'check' : 'star'} size={15} color={going ? '#000' : primary} />
          <Text style={[cs.actText, { color: going ? '#000' : primary }]}>{going ? 'Going' : 'RSVP'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleSave} style={[cs.iconBtn, { borderColor: `${primary}30`, backgroundColor: saved ? `${primary}18` : 'transparent' }]}>
          <Feather name="bookmark" size={16} color={saved ? primary : muted} />
        </TouchableOpacity>
        <TouchableOpacity onPress={takeMeThere} style={[cs.iconBtn, { borderColor: `${primary}30` }]}>
          <Feather name="navigation-2" size={16} color={primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onOpenEvent?.(full.id)} style={[cs.detailsBtn, { borderColor: `${primary}30` }]}>
          <Text style={[cs.actText, { color: text }]}>Details</Text>
          <Feather name="arrow-up-right" size={14} color={text} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const cs = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, padding: 16, paddingBottom: 26, gap: 12 },
  hit: { top: 8, bottom: 8, left: 8, right: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { padding: 2 },
  counter: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  cover: { width: 84, height: 84, borderRadius: 14 },
  title: { fontSize: 16, fontWeight: '900' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { fontSize: 12 },
  proofRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  proofChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  proofText: { fontSize: 12, fontWeight: '700' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#10b981' },
  av: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 10, backgroundColor: 'rgba(239,68,68,0.08)' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1 },
  iconBtn: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  detailsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 14, height: 44, borderRadius: 14, borderWidth: 1 },
  actText: { fontSize: 13, fontWeight: '900' },
});

export default MapEventPreview;
