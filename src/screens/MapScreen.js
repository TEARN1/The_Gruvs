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
  const [userLoc, setUserLoc] = useState(null); // real device fix only (drives the "you are here" dot)
  const mapApiRef = useRef(null);                // the MapLibre instance, for fitBounds
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
  const [liveOnly, setLiveOnly] = useState(false); // show only venues with verified people there now
  const [ripple, setRipple] = useState(null);      // {lng,lat,key} — pulse on a live check-in
  const [dayFilter, setDayFilter] = useState(null); // 'YYYY-MM-DD' | null(all) — the time-scrubber
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
  const eventsRef = useRef(events);
  useEffect(() => { eventsRef.current = events; }, [events]);

  // One-shot deliberate location for the initial centre (never continuous).
  useEffect(() => {
    (async () => {
      try {
        const c = await LocationService.requestAndGet();
        if (c?.lat != null && c?.lon != null) { setCenter({ lat: c.lat, lng: c.lon }); setUserLoc({ lat: c.lat, lng: c.lon }); }
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
        .select('id, title, category, cover_url, venue, latitude, longitude, lat, lon, going, event_date')
        .gte('event_date', today)
        .is('deleted_at', null)
        .limit(300);
      const rows = (data || []).filter((e) => (e.lat ?? e.latitude) != null && (e.lon ?? e.longitude) != null);

      // Real "here now" = a live tally of verified Touch-Downs (live_checkins is
      // the same source getLiveAttendees trusts), so the heat/hot pins are truth,
      // not the static going count. One extra query, counted client-side.
      try {
        const ids = rows.map((e) => e.id);
        if (ids.length) {
          const { data: ci } = await supabase.from('live_checkins').select('event_id').in('event_id', ids);
          const tally = new Map();
          for (const r of ci || []) tally.set(r.event_id, (tally.get(r.event_id) || 0) + 1);
          rows.forEach((e) => { e.here_count = tally.get(e.id) || 0; });
        }
      } catch { /* counts are best-effort; pins still render */ }

      setEvents(rows);
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

    // The map breathes: live check-ins and new/updated events repaint the pins
    // without a manual refresh, so here-now counts and fresh gruvs appear as they
    // happen. Debounced so a burst of arrivals is one repaint, not fifty.
    let t = null;
    const bump = () => { clearTimeout(t); t = setTimeout(() => { if (alive) loadEvents(); }, 1200); };
    // A new check-in: ripple at that venue if it's on the map, then refresh counts.
    const onCheckin = (p) => {
      const evId = p?.new?.event_id;
      const e = evId && eventsRef.current.find((x) => x.id === evId);
      if (e) { const lat = e.lat ?? e.latitude, lng = e.lon ?? e.longitude; if (lat != null) setRipple({ lat, lng, key: Date.now() }); }
      bump();
    };
    const live = supabase
      .channel(`map_live_${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_checkins' }, onCheckin)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'live_checkins' }, bump)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, bump)
      .subscribe();

    return () => { alive = false; off?.(); clearTimeout(t); try { supabase.removeChannel(live); } catch {} };
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
    if (c?.lat != null) { setCenter({ lat: c.lat, lng: c.lon }); setUserLoc({ lat: c.lat, lng: c.lon }); }
  };

  // Fit every pin in view — one tap to see the whole night at once.
  const fitAll = () => {
    const m = mapApiRef.current;
    const pts = events.map((e) => [e.lon ?? e.longitude, e.lat ?? e.latitude]).filter((p) => p[0] != null && p[1] != null);
    if (!m || pts.length === 0) return;
    let minX = pts[0][0], minY = pts[0][1], maxX = pts[0][0], maxY = pts[0][1];
    for (const [x, y] of pts) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
    try { m.fitBounds([[minX, minY], [maxX, maxY]], { padding: 70, maxZoom: 15, duration: 600 }); } catch {}
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
  // The scrubber: next 7 nights as chips (today + 6). Tonight is null(all-upcoming)
  // vs a specific day so the map can jump forward in time — Path Map planning.
  const days = React.useMemo(() => {
    const out = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      out.push({
        key: d.toISOString().split('T')[0],
        label: i === 0 ? 'Tonight' : i === 1 ? 'Tomorrow' : d.toLocaleDateString([], { weekday: 'short' }),
      });
    }
    return out;
  }, []);

  // "Live now" filters to venues with verified people there; the scrubber filters
  // to a chosen night; otherwise everything upcoming shows.
  const shownEvents = React.useMemo(() => {
    let list = events;
    if (liveOnly) list = list.filter((e) => (e.here_count || 0) > 0);
    if (dayFilter) list = list.filter((e) => String(e.event_date || '').slice(0, 10) === dayFilter);
    return list;
  }, [events, liveOnly, dayFilter]);

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

        {/* Time-scrubber — jump the map forward night by night */}
        {isMapSupported() && !drawing && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={cs.dayStrip} contentContainerStyle={{ gap: 8, paddingHorizontal: 14 }}>
            <TouchableOpacity onPress={() => setDayFilter(null)}
              style={[cs.dayChip, { borderColor: !dayFilter ? primary : `${primary}30`, backgroundColor: !dayFilter ? primary : 'transparent' }]}>
              <Text style={{ color: !dayFilter ? '#000' : primary, fontSize: 12, fontWeight: '800' }}>All</Text>
            </TouchableOpacity>
            {days.map((d) => {
              const on = dayFilter === d.key;
              return (
                <TouchableOpacity key={d.key} onPress={() => setDayFilter(on ? null : d.key)}
                  style={[cs.dayChip, { borderColor: on ? primary : `${primary}30`, backgroundColor: on ? primary : 'transparent' }]}>
                  <Text style={{ color: on ? '#000' : primary, fontSize: 12, fontWeight: '800' }}>{d.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* The map fills the rest */}
        <View style={{ flex: 1 }}>
          <ErrorBoundary label="Live map" inline primary={primary}>
            <LiveMap
              events={shownEvents}
              zones={zones}
              center={center}
              userLoc={userLoc}
              ripple={ripple}
              heat={heat}
              mine={myFog.points}
              showMine={showMine}
              crew={crewPlans}
              showCrew={showCrew}
              drawMode={drawing ? mode : null}
              drawPoints={points}
              onMapClick={onMapClick}
              onReady={(map) => { mapApiRef.current = map; }}
              onEventPress={(id) => {
                setActiveZone(null); setPreviewId(id);
                // Focus the tapped pin (A7) so it sits above the preview sheet.
                const e = events.find((x) => x.id === id);
                if (e) setCenter({ lat: e.lat ?? e.latitude, lng: e.lon ?? e.longitude });
              }}
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
              <TouchableOpacity onPress={() => setLiveOnly((v) => !v)} style={[cs.fab, { backgroundColor: liveOnly ? '#10b981' : bg, borderColor: liveOnly ? '#10b981' : `${primary}40` }]}>
                <Feather name="radio" size={17} color={liveOnly ? '#000' : '#10b981'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={fitAll} style={[cs.fab, { backgroundColor: bg, borderColor: `${primary}40` }]}>
                <Feather name="maximize" size={17} color={primary} />
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
              {heat && <View style={cs.legendRow}><Feather name="activity" size={9} color="#f59e0b" /><Text style={cs.legendText}>Heat = verified Touch Downs</Text></View>}
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
  dayStrip: { flexGrow: 0, paddingVertical: 8 },
  dayChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, borderWidth: 1.5 },
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
