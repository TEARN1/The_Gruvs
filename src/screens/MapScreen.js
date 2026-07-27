/**
 * MapScreen — "The Map" tab. The living map of your city's night.
 *
 * Phase 1: a real street map (LiveMap) with event pins and host-drawn impact
 * zones (road closures / routes / areas), a host "mark the impact" draw flow,
 * live zone updates, and a zone-detail sheet where the community confirms or
 * disputes a closure (Truth Protocol). Everything is SafeSection-wrapped so a
 * map failure never takes the app down.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LiveMap, isMapSupported } from '../components/LiveMap';
import { ZoneDrawTool } from '../components/ZoneDrawTool';
import { MapEventPreview } from '../components/MapEventPreview';
import { MapZones, ZONE_KINDS, ZONE_STATUS } from '../services/mapZones';
import { supabase } from '../services/supabase';
import { LocationService } from '../services/locationService';
import { useToast } from '../components/ToastNotification';
import { pickConciergeMove } from '../services/concierge';
import { MapNudge } from '../components/MapNudge';
import { VibeRouletteModal } from '../components/VibeRouletteModal';
import { GetHomeSafeModal } from '../components/GetHomeSafeModal';
import { getMyFog } from '../services/fogMap';
import { getCrewPlans } from '../services/crewMap';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NUDGE_COOLDOWN_KEY = 'gruvs_map_nudge_ts';
const NUDGE_COOLDOWN_MS = 2 * 3600 * 1000; // don't nag — at most every 2h

const JHB = { lat: -26.2041, lng: 28.0473 };

export const MapScreen = ({ onAuthRequired, onNavigateToEvent }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const { show: toast } = useToast();
  const primary = currentTheme?.primary || '#00f2ff';
  const bg = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.55)';

  const [center, setCenter] = useState(JHB);
  const [events, setEvents] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);

  // Draw session
  const [drawing, setDrawing] = useState(false);
  const [mode, setMode] = useState('line');
  const [points, setPoints] = useState([]);

  // Zone detail
  const [activeZone, setActiveZone] = useState(null);
  // Tapped event pin → rich preview (swipeable across nearby pins).
  const [previewId, setPreviewId] = useState(null);

  // Phase 2: presence heat + the Concierge
  const [heat, setHeat] = useState(false);
  const [nudge, setNudge] = useState(null);
  const [showRoulette, setShowRoulette] = useState(false);
  const [showHomeSafe, setShowHomeSafe] = useState(false);

  // Phase 2: Fog of the City — your lit Touch Downs.
  const [showMine, setShowMine] = useState(false);
  const [myFog, setMyFog] = useState({ points: [], passport: null });

  // Phase 2: Crew Convergence — where the people you follow are heading tonight.
  const [showCrew, setShowCrew] = useState(false);
  const [crewPlans, setCrewPlans] = useState([]);

  const centerRef = useRef(center);
  useEffect(() => { centerRef.current = center; }, [center]);

  // One-shot deliberate location for the initial centre (never continuous).
  useEffect(() => {
    (async () => {
      try {
        const c = await LocationService.requestAndGet();
        if (c?.lat != null && c?.lon != null) setCenter({ lat: c.lat, lng: c.lon });
      } catch { /* keep default */ }
    })();
  }, []);

  const loadZones = useCallback(async () => {
    const c = centerRef.current;
    const rows = await MapZones.near(c.lat, c.lng, { radiusM: 15000 });
    setZones(rows);
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      // Upcoming events with coordinates (either lat/lon or latitude/longitude).
      const { data } = await supabase
        .from('events')
        .select('id, title, latitude, longitude, lat, lon, going, event_date')
        .gte('event_date', today)
        .is('deleted_at', null)
        .limit(300);
      setEvents((data || []).filter((e) => (e.lat ?? e.latitude) != null && (e.lon ?? e.longitude) != null));
    } catch { setEvents([]); }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      await Promise.all([loadEvents(), loadZones()]);
      if (alive) setLoading(false);
    })();
    const off = MapZones.subscribe(() => loadZones());
    return () => { alive = false; off?.(); };
  }, [loadEvents, loadZones]);

  // Re-pull zones when the map centre moves meaningfully.
  useEffect(() => { loadZones(); }, [center, loadZones]);

  // ── The Concierge: a big closure near you + you're not into it → a real
  //    alternative. Cooldown'd so it never nags. ────────────────────────────
  useEffect(() => {
    if (loading || nudge) return;
    const closures = zones.filter((z) => z.kind === 'road_closed' || z.kind === 'detour');
    if (closures.length === 0) return;
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(NUDGE_COOLDOWN_KEY);
        if (raw && Date.now() - Number(raw) < NUDGE_COOLDOWN_MS) return;
        const move = await pickConciergeMove({
          userId: user?.id,
          nearbyEvents: events,
          excludeEventIds: closures.map((z) => z.event_id).filter(Boolean),
        });
        if (alive && move) { setNudge(move); AsyncStorage.setItem(NUDGE_COOLDOWN_KEY, String(Date.now())).catch(() => {}); }
      } catch { /* concierge is best-effort */ }
    })();
    return () => { alive = false; };
  }, [loading, zones, events, user?.id, nudge]);

  const actOnNudge = () => {
    const m = nudge; setNudge(null);
    if (!m) return;
    if (m.kind === 'openEvent' && m.payload?.eventId) onNavigateToEvent?.({ id: m.payload.eventId });
    else if (m.kind === 'roulette') setShowRoulette(true);
    else if (m.kind === 'getHomeSafe') { if (!user) onAuthRequired?.(); else setShowHomeSafe(true); }
  };

  // ── draw handlers ───────────────────────────────────────────────────────────
  const startDraw = () => {
    if (!user) { onAuthRequired?.(); return; }
    setActiveZone(null); setPoints([]); setDrawing(true);
  };
  const onMapClick = useCallback((lngLat) => setPoints((p) => [...p, lngLat]), []);
  const undo = () => setPoints((p) => p.slice(0, -1));
  const clear = () => setPoints([]);
  const cancelDraw = () => { setDrawing(false); setPoints([]); };
  const onPublished = () => { setDrawing(false); setPoints([]); loadZones(); };

  // ── zone verify ───────────────────────────────────────────────────────────
  const verify = async (vote) => {
    if (!user) { onAuthRequired?.(); return; }
    if (!activeZone) return;
    try {
      const updated = await MapZones.verify(activeZone.id, vote);
      setActiveZone((z) => (z ? { ...z, ...updated } : z));
      loadZones();
      toast(vote === 'confirm' ? 'Thanks — confirmed.' : 'Thanks — flagged.', 'success');
    } catch (e) { toast(e?.message || 'Could not submit.', 'error'); }
  };

  const recenter = async () => {
    const c = await LocationService.requestAndGet();
    if (c?.lat != null) setCenter({ lat: c.lat, lng: c.lon });
  };

  // Fog of the City — light up where you've actually been (lazy-loaded once).
  const toggleMine = async () => {
    if (!user) { onAuthRequired?.(); return; }
    const next = !showMine;
    setShowMine(next);
    if (next && myFog.points.length === 0) {
      const fog = await getMyFog(user.id);
      setMyFog(fog);
      if (fog.points.length === 0) toast("Touch Down at events to light up your map.", 'info');
    }
  };

  // Crew Convergence — pull your follows' tonight-intent, lit as magenta pins.
  const toggleCrew = async () => {
    if (!user) { onAuthRequired?.(); return; }
    const next = !showCrew;
    setShowCrew(next);
    if (next && crewPlans.length === 0) {
      const plans = await getCrewPlans(user.id);
      setCrewPlans(plans);
      if (plans.length === 0) toast('None of your crew has marked a plan yet — follow more people.', 'info');
    }
  };

  // The biggest convergence (most of your crew on one spot) drives the summary.
  const topCrew = showCrew && crewPlans.length ? crewPlans[0] : null;
  const crewOut = crewPlans.reduce((set, p) => { p.people.forEach((x) => set.add(x.id)); return set; }, new Set()).size;

  const activeClosures = zones.filter((z) => z.kind === 'road_closed' || z.kind === 'detour').length;

  return (
    <ErrorBoundary label="Map">
      <SafeAreaView style={[cs.screen, { backgroundColor: bg }]} edges={['top']}>
        {/* Header */}
        <View style={cs.header}>
          <Text style={[cs.title, { color: primary }]}>THE MAP</Text>
          <Text style={[cs.sub, { color: muted }]}>
            {loading ? 'Reading your city…'
              : `${events.length} events${activeClosures ? ` · ${activeClosures} live closure${activeClosures === 1 ? '' : 's'}` : ''}`}
          </Text>
        </View>

        {/* The map fills the rest */}
        <View style={{ flex: 1 }}>
          <ErrorBoundary label="Live map" inline primary={primary}>
            <LiveMap
              events={events}
              zones={zones}
              center={center}
              heat={heat}
              mine={myFog.points}
              showMine={showMine}
              crew={crewPlans}
              showCrew={showCrew}
              drawMode={drawing ? mode : null}
              drawPoints={points}
              onMapClick={onMapClick}
              onEventPress={(id) => { setActiveZone(null); setPreviewId(id); }}
              onZonePress={(id) => { const z = zones.find((x) => x.id === id); if (z) { setPreviewId(null); setActiveZone(z); } }}
            />
          </ErrorBoundary>

          {/* Floating controls (only when the real map is up and not drawing) */}
          {isMapSupported() && !drawing && (
            <View style={cs.fabCol} pointerEvents="box-none">
              <TouchableOpacity onPress={toggleMine} style={[cs.fab, { backgroundColor: showMine ? '#fbbf24' : bg, borderColor: showMine ? '#fbbf24' : `${primary}40` }]}>
                <Feather name="star" size={18} color={showMine ? '#000' : '#fbbf24'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleCrew} style={[cs.fab, { backgroundColor: showCrew ? '#ec4899' : bg, borderColor: showCrew ? '#ec4899' : `${primary}40` }]}>
                <Feather name="users" size={18} color={showCrew ? '#fff' : '#ec4899'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setHeat((h) => !h)} style={[cs.fab, { backgroundColor: heat ? primary : bg, borderColor: `${primary}40` }]}>
                <Feather name="activity" size={18} color={heat ? '#000' : primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={recenter} style={[cs.fab, { backgroundColor: bg, borderColor: `${primary}40` }]}>
                <Feather name="crosshair" size={18} color={primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={startDraw} style={[cs.markBtn, { backgroundColor: primary }]}>
                <Feather name="edit-3" size={15} color="#000" />
                <Text style={cs.markText}>Mark a closure</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* The Concierge nudge — a real alternative when a closure's near */}
          {nudge && !drawing && !activeZone && !previewId && (
            <MapNudge
              move={nudge} onAct={actOnNudge} onDismiss={() => setNudge(null)}
              primary={primary} bg={bg} textColor={textColor} muted={muted}
            />
          )}

          {/* Fog of the City — your exploration stat while your map is lit */}
          {showMine && myFog.passport && !drawing && (
            <View style={[cs.fogChip, { backgroundColor: '#fbbf2422', borderColor: '#fbbf24' }]}>
              <Feather name="star" size={12} color="#fbbf24" />
              <Text style={cs.fogChipText}>
                {myFog.passport.venues.length} place{myFog.passport.venues.length === 1 ? '' : 's'} lit
                {myFog.passport.cities.length > 1 ? ` · ${myFog.passport.cities.length} cities` : ''}
                {myFog.passport.totalTouchDowns ? ` · ${myFog.passport.totalTouchDowns} Touch Downs` : ''}
              </Text>
            </View>
          )}

          {/* Crew Convergence — who's out and the biggest meet-up tonight */}
          {showCrew && crewPlans.length > 0 && !drawing && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => { if (topCrew?.eventId) { setActiveZone(null); setPreviewId(topCrew.eventId); } }}
              style={[cs.crewChip, { backgroundColor: '#ec489922', borderColor: '#ec4899', top: showMine && myFog.passport ? 44 : 10 }]}
            >
              <Feather name="users" size={12} color="#ec4899" />
              <Text style={cs.crewChipText} numberOfLines={1}>
                {crewOut} of your crew out
                {topCrew && topCrew.people.length > 1 ? ` · ${topCrew.people.length} at ${topCrew.title}` : ''}
              </Text>
            </TouchableOpacity>
          )}

          {/* Legend (compact) */}
          {isMapSupported() && !drawing && !activeZone && !previewId && (
            <View style={[cs.legend, { backgroundColor: `${bg}dd`, borderColor: `${primary}22` }]}>
              <View style={cs.legendRow}><View style={[cs.dot, { backgroundColor: '#00f2ff' }]} /><Text style={cs.legendText}>Events</Text></View>
              <View style={cs.legendRow}><View style={[cs.dash, { backgroundColor: '#ef4444' }]} /><Text style={cs.legendText}>Road closed</Text></View>
              <View style={cs.legendRow}><View style={[cs.dash, { backgroundColor: '#10b981' }]} /><Text style={cs.legendText}>Route</Text></View>
            </View>
          )}
        </View>

        {/* Draw tool */}
        {drawing && (
          <ZoneDrawTool
            points={points} mode={mode} onSetMode={setMode}
            onUndo={undo} onClear={clear} onCancel={cancelDraw} onPublished={onPublished}
            primary={primary} bg={bg} textColor={textColor} muted={muted}
          />
        )}

        {/* Zone detail + Truth Protocol verify */}
        {activeZone && !drawing && (
          <ZoneDetail
            zone={activeZone} onClose={() => setActiveZone(null)} onVerify={verify}
            onOpenEvent={(id) => { setActiveZone(null); onNavigateToEvent?.({ id }); }}
            primary={primary} bg={bg} textColor={textColor} muted={muted}
          />
        )}

        {/* Tapped-pin preview — RSVP, save, route, live here-now, swipe pins */}
        {previewId && !drawing && !activeZone && (
          <MapEventPreview
            events={events}
            startId={previewId}
            userCoords={center}
            zones={zones}
            onOpenEvent={(id) => { setPreviewId(null); onNavigateToEvent?.({ id }); }}
            onOpenZone={(z) => { setPreviewId(null); setActiveZone(z); }}
            onClose={() => setPreviewId(null)}
            onAuthRequired={onAuthRequired}
          />
        )}

        {/* Concierge destinations */}
        <VibeRouletteModal
          visible={showRoulette} onClose={() => setShowRoulette(false)}
          events={events} primary={primary}
          onSelectEvent={(e) => { setShowRoulette(false); if (e?.id) onNavigateToEvent?.({ id: e.id }); }}
        />
        <GetHomeSafeModal visible={showHomeSafe} onClose={() => setShowHomeSafe(false)} />
      </SafeAreaView>
    </ErrorBoundary>
  );
};

// ── Zone detail sheet ─────────────────────────────────────────────────────────
const ZoneDetail = ({ zone, onClose, onVerify, onOpenEvent, primary, bg, textColor, muted }) => {
  const meta = ZONE_KINDS[zone.kind] || {};
  const st = ZONE_STATUS[zone.status] || { label: zone.status };
  const endsIn = Math.max(0, Math.round((new Date(zone.ends_at).getTime() - Date.now()) / 60000));
  const endsLabel = endsIn > 90 ? `${Math.round(endsIn / 60)}h` : `${endsIn}m`;

  return (
    <View style={[cs.sheet, { backgroundColor: bg, borderColor: `${meta.color || primary}40` }]}>
      <View style={cs.sheetHead}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <View style={[cs.kindDot, { backgroundColor: `${meta.color || primary}22`, borderColor: meta.color || primary }]}>
            <Feather name={meta.icon || 'map-pin'} size={15} color={meta.color || primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[cs.sheetTitle, { color: textColor }]} numberOfLines={1}>{zone.label || meta.label || 'Zone'}</Text>
            <Text style={{ color: muted, fontSize: 11 }}>{meta.label} · clears in {endsLabel}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="x" size={20} color={muted} />
        </TouchableOpacity>
      </View>

      {/* Trust tier */}
      <View style={[cs.trust, { borderColor: `${primary}22` }]}>
        <Feather name={zone.status === 'confirmed' || zone.status === 'official' ? 'check-circle' : 'help-circle'}
          size={13} color={zone.status === 'declared' ? muted : '#10b981'} />
        <Text style={{ color: zone.status === 'declared' ? muted : '#10b981', fontSize: 12, fontWeight: '700', flex: 1 }}>
          {st.label}{zone.confirm_count ? ` · ${zone.confirm_count} confirmed` : ''}{zone.dispute_count ? ` · ${zone.dispute_count} disputed` : ''}
        </Text>
      </View>

      {zone.note ? <Text style={{ color: muted, fontSize: 12, lineHeight: 17 }}>{zone.note}</Text> : null}

      {/* Truth Protocol */}
      <Text style={{ color: muted, fontSize: 11, marginTop: 4 }}>Is this still accurate?</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity onPress={() => onVerify('confirm')} style={[cs.verifyBtn, { borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.12)' }]}>
          <Feather name="check" size={14} color="#10b981" />
          <Text style={{ color: '#10b981', fontWeight: '800', fontSize: 13 }}>Still closed</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onVerify('dispute')} style={[cs.verifyBtn, { borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.10)' }]}>
          <Feather name="rotate-ccw" size={14} color="#ef4444" />
          <Text style={{ color: '#ef4444', fontWeight: '800', fontSize: 13 }}>Reopened</Text>
        </TouchableOpacity>
      </View>

      {zone.event_id ? (
        <TouchableOpacity onPress={() => onOpenEvent(zone.event_id)} style={cs.eventLink}>
          <Feather name="calendar" size={13} color={primary} />
          <Text style={{ color: primary, fontWeight: '800', fontSize: 12 }}>See the event</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const cs = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  sub: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  fabCol: { position: 'absolute', right: 14, bottom: 20, alignItems: 'flex-end', gap: 10 },
  fab: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  markBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24 },
  markText: { color: '#000', fontWeight: '900', fontSize: 13 },
  legend: { position: 'absolute', left: 14, bottom: 20, flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  fogChip: { position: 'absolute', top: 10, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  fogChipText: { color: '#fbbf24', fontSize: 11, fontWeight: '800' },
  crewChip: { position: 'absolute', alignSelf: 'center', maxWidth: '86%', flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  crewChipText: { color: '#ec4899', fontSize: 11, fontWeight: '800' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '700' },
  dot: { width: 9, height: 9, borderRadius: 5 },
  dash: { width: 14, height: 3, borderRadius: 2 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, padding: 16, paddingBottom: 26, gap: 10 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kindDot: { width: 34, height: 34, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { fontSize: 16, fontWeight: '900' },
  trust: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 12, padding: 10 },
  verifyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 22, paddingVertical: 11 },
  eventLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, marginTop: 2 },
});

export default MapScreen;
