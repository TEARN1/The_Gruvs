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
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Linking, Image, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LiveMap, isMapSupported, isDrawSupported } from '../components/LiveMap';
import { ZoneDrawTool } from '../components/ZoneDrawTool';
import { MapEventPreview } from '../components/MapEventPreview';
import { MapReportSheet } from '../components/MapReportSheet';
import { MapReports } from '../services/mapReports';
import { MAP_REPORT_BY_KEY } from '../constants/mapContributions';
import { MapZones, ZONE_KINDS, ZONE_STATUS } from '../services/mapZones';
import { supabase } from '../services/supabase';
// Nearby vibers used DiscoveryManager without ever importing it — the FAB threw
// a ReferenceError into a silent catch, so that layer has never once worked.
import { DiscoveryManager } from '../services/dataFlow';
import { useMapLayer } from '../hooks/useMapLayer';
import { logError } from '../utils/logError';
import { shouldRefetch, padBbox, bboxRadiusM, bboxCenter } from '../utils/mapViewport';
import { LocationService } from '../services/locationService';
import { useToast } from '../components/ToastNotification';
import { pickConciergeMove } from '../services/concierge';
import { MapNudge } from '../components/MapNudge';
import { VibeRouletteModal } from '../components/VibeRouletteModal';
import { GetHomeSafeModal } from '../components/GetHomeSafeModal';
import { getMyFog } from '../services/fogMap';
import { getCrewPlans } from '../services/crewMap';
import { Accommodation } from '../services/accommodation';
import { residentUrl, hasResident } from '../constants/residentUrl';
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
  // Crowdsourced map reports (the "update the map yourself" layer).
  const [reports, setReports] = useState([]);
  const [reportSheet, setReportSheet] = useState(false);
  const [activeReport, setActiveReport] = useState(null);

  // Phase 2: Fog of the City — your lit Touch Downs.
  // Optional layers: each is (is it on, its data, load it once on first ask).
  // These were five hand-written copies of the same toggle; see useMapLayer.
  const mineLayer = useMapLayer({
    fetch: useCallback(() => getMyFog(user?.id), [user?.id]),
    requiresAuth: true, user, onAuthRequired,
    initial: { points: [], passport: null },
    isEmpty: (f) => !f?.points?.length,
    emptyMessage: 'Touch Down at events to light up your map.',
    toast,
  });
  const myFog = mineLayer.data;
  const showMine = mineLayer.on;

  // Phase 2: Crew Convergence — your follows' tonight-intent, magenta pins.
  const crewLayer = useMapLayer({
    fetch: useCallback(() => getCrewPlans(user?.id), [user?.id]),
    requiresAuth: true, user, onAuthRequired,
    emptyMessage: 'None of your crew has marked a plan yet — follow more people.',
    toast,
  });
  const crewPlans = crewLayer.data;
  const showCrew = crewLayer.on;

  // Phase 2: Find Them — discoverable vibers near you.
  const nearbyLayer = useMapLayer({
    fetch: useCallback(() => DiscoveryManager.findNearbyVibers(user?.id, 10), [user?.id]),
    requiresAuth: true, user, onAuthRequired,
    emptyMessage: 'No vibers found nearby — try again later.',
    toast,
  });
  const nearbyVibers = nearbyLayer.data;
  const showNearby = nearbyLayer.on;

  // Stays via Resident Crew — the layer itself is declared lower down, next to
  // its fetcher, which needs the viewport refs.
  const [activeStay, setActiveStay] = useState(null);

  // Phase 2: Strategic Networking
  const [networkingMode, setNetworkingMode] = useState(false);
  const [attendees, setAttendees] = useState([]);
  const [viberModalVisible, setViberModalVisible] = useState(false);
  const [selectedViberId, setSelectedViberId] = useState(null);

  const [followMe, setFollowMe] = useState(false);
  const [mapStyle, setMapStyle] = useState('dark');
  const [show3D, setShow3D] = useState(false);
  const [showWeather, setShowWeather] = useState(false);
  const [searchQuery, setSearchBar] = useState('');
  const [searching, setSearchBusy] = useState(false);

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

  // What the map is looking at, and what we last fetched FOR. These drive every
  // loader below: a fixed 15km around wherever you happened to open the map is
  // wrong the moment you pan.
  // A ref, not state: the viewport changes on every pan and nothing renders from
  // it directly, so holding it in state would re-render this whole screen for
  // no visible change.
  const fetchedBboxRef = useRef(null);

  // Radius loaders follow the viewport too, with a floor so a deep zoom-in
  // doesn't ask for a 50m circle and show an empty map.
  const viewRadius = useCallback(() => {
    const b = fetchedBboxRef.current;
    return b ? Math.max(2000, bboxRadiusM(b)) : 15000;
  }, []);

  const loadZones = useCallback(async () => {
    const c = bboxCenter(fetchedBboxRef.current) || centerRef.current;
    const rows = await MapZones.near(c.lat, c.lng, { radiusM: viewRadius() });
    setZones(rows);
  }, [viewRadius]);

  const loadReports = useCallback(async () => {
    const c = bboxCenter(fetchedBboxRef.current) || centerRef.current;
    setReports(await MapReports.near(c.lat, c.lng, { radiusM: viewRadius() }));
  }, [viewRadius]);

  // Drop a report at the map centre (where the user is looking).
  const submitReport = useCallback(async (kind, note) => {
    const c = centerRef.current;
    if (!user) { onAuthRequired?.(); return; }
    try {
      await MapReports.create({ kind, lat: c.lat, lon: c.lng, note });
      setReportSheet(false);
      toast('Added to the map — thanks!', 'success');
      loadReports();
    } catch { toast('Could not add that. Try again.', 'error'); }
  }, [user, onAuthRequired, toast, loadReports]);

  const verifyReport = useCallback(async (vote) => {
    if (!user) { onAuthRequired?.(); return; }
    if (!activeReport) return;
    try {
      const updated = await MapReports.verify(activeReport.id, vote);
      setActiveReport((r) => (r ? { ...r, ...updated } : r));
      loadReports();
      toast(vote === 'confirm' ? 'Confirmed — thanks!' : 'Flagged — thanks!', 'success');
    } catch { toast('Could not submit.', 'error'); }
  }, [user, onAuthRequired, activeReport, toast, loadReports]);

  const loadEvents = useCallback(async () => {
    const bbox = fetchedBboxRef.current;
    try {
      // Tier 1 — the server does the geography AND the counting in one pass.
      if (bbox) {
        const { data, error } = await supabase.rpc('events_in_bbox', {
          p_west: bbox.west, p_south: bbox.south, p_east: bbox.east, p_north: bbox.north, p_limit: 300,
        });
        if (!error && Array.isArray(data)) {
          setEvents(data.map((e) => ({ ...e, here_count: Number(e.here_count || 0) })));
          return;
        }
        // RPC missing (map_viewport.sql not applied) or it errored — fall to
        // tier 2, but make the drift visible rather than silently slower.
        logError('map:events_in_bbox', error || new Error('no rows'), { code: error?.code || null });
      }

      // Tier 2 — RPC not deployed yet. Same query client-side, still bounded by
      // the viewport so panning works even before map_viewport.sql is applied.
      const today = new Date().toISOString().split('T')[0];
      let q = supabase
        .from('events')
        .select('id, title, category, cover_url, venue_name, latitude, longitude, lat, lon, going, event_date')
        .gte('event_date', today)
        .is('deleted_at', null)
        .limit(300);
      if (bbox) {
        // Filters the canonical lat/lon pair (what PostEventModal writes). The
        // legacy latitude/longitude columns are read fallbacks only; tier 1
        // COALESCEs both, so anything old still shows once the RPC is deployed.
        q = q.gte('lat', bbox.south).lte('lat', bbox.north).gte('lon', bbox.west).lte('lon', bbox.east);
      }
      const { data } = await q;
      const rows = (data || []).filter((e) => (e.lat ?? e.latitude) != null && (e.lon ?? e.longitude) != null);

      // Real "here now" = a live tally of verified Touch-Downs. Counting these
      // client-side means fetching every check-in row for every pin, which gets
      // slower the better the product does — so it's capped, and the RPC above
      // is the path that should actually run in production.
      try {
        const ids = rows.slice(0, 100).map((e) => e.id);
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

  /**
   * The map settled somewhere. Load that area — but only if it isn't already
   * covered by what we hold, so a nudge of the map costs nothing.
   */
  const onViewportChange = useCallback((bbox) => {
    if (!bbox) return;
    if (!shouldRefetch(fetchedBboxRef.current, bbox)) { setLoading(false); return; }
    fetchedBboxRef.current = padBbox(bbox, 0.5);
    Promise.all([loadEvents(), loadZones(), loadReports()]).finally(() => setLoading(false));
  }, [loadEvents, loadZones, loadReports]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      // When there's a real map, its first 'moveend' tells us what to load —
      // loading here too would fetch the wrong area and then immediately refetch.
      // Without a map (native, or MapLibre unavailable) nothing will ever emit a
      // viewport, so the list view still needs its one unbounded load.
      if (isMapSupported()) return;
      await Promise.all([loadEvents(), loadZones(), loadReports()]);
      if (alive) setLoading(false);
    })();
    const off = MapZones.subscribe(() => loadZones());
    const offReports = MapReports.subscribe(() => loadReports());

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

    return () => { alive = false; off?.(); offReports?.(); clearTimeout(t); try { supabase.removeChannel(live); } catch {} };
  }, [loadEvents, loadZones, loadReports]);

  // Re-pull zones + reports when the map centre moves meaningfully.
  useEffect(() => { loadZones(); loadReports(); }, [center, loadZones, loadReports]);

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
    setFollowMe(false);
    const c = await LocationService.requestAndGet();
    if (c?.lat != null) { setCenter({ lat: c.lat, lng: c.lon }); setUserLoc({ lat: c.lat, lng: c.lon }); }
  };

  const zoomIn = () => {
    if (mapApiRef.current) mapApiRef.current.zoomIn();
  };

  const zoomOut = () => {
    if (mapApiRef.current) mapApiRef.current.zoomOut();
  };

  const toggleFollowMe = () => {
    const next = !followMe;
    setFollowMe(next);
    if (next && userLoc) {
      setCenter({ lat: userLoc.lat, lng: userLoc.lng });
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || searching) return;
    setSearchBusy(true);
    setFollowMe(false);
    try {
      const q = encodeURIComponent(searchQuery.trim());
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
        headers: { 'User-Agent': 'TheGruvs/1.0' }
      });
      const data = await res.json();
      if (data && data[0]) {
        const { lat, lon } = data[0];
        setCenter({ lat: parseFloat(lat), lng: parseFloat(lon) });
        setSearchBar('');
      } else {
        toast('Location not found.', 'info');
      }
    } catch {
      toast('Search failed.', 'error');
    } finally {
      setSearchBusy(false);
    }
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
  // Stays via Resident Crew — accommodation around whatever you're looking at.
  const fetchStays = useCallback(async () => {
    const c = bboxCenter(fetchedBboxRef.current) || centerRef.current;
    return Accommodation.near(c.lat, c.lng, { radiusM: viewRadius() });
  }, [viewRadius]);

  // ⚠️ NOT REAL DATA. This draws a line from each event to the next one in the
  // array — an arbitrary order, not an observed movement. It is presented as a
  // "flow trail" insight, which is exactly the promoter-spin the Truth Protocol
  // exists to replace. Kept as-is to avoid silently removing a visible feature,
  // but it should either be derived from consecutive live_checkins by the same
  // users (a real flow) or cut.
  const fetchTrails = useCallback(async () => {
    const list = eventsRef.current.slice(0, 8);
    const generated = [];
    for (let i = 0; i < list.length - 1; i++) {
      if (list[i].lat && list[i + 1].lat) {
        generated.push({ from: { lat: list[i].lat, lng: list[i].lon }, to: { lat: list[i + 1].lat, lng: list[i + 1].lon } });
      }
    }
    return generated;
  }, []);

  const staysLayer = useMapLayer({
    fetch: fetchStays,
    emptyMessage: 'No Resident Crew stays near here yet.',
    toast,
  });
  const stays = staysLayer.data;
  const showStays = staysLayer.on;

  const trailsLayer = useMapLayer({ fetch: fetchTrails });
  const vibeTrails = trailsLayer.data;
  const showTrails = trailsLayer.on;

  const toggleNetworking = () => {
    setNetworkingMode(!networkingMode);
    if (!networkingMode) {
      toast('Networking Mode: See who else is out tonight.', 'info');
    }
  };

  const handleViberPress = (viberId) => {
    setSelectedViberId(viberId);
    setViberModalVisible(true);
  };
  const openStay = (id) => { const s = stays.find((x) => x.id === id); if (s) setActiveStay(s); };

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

  // A line from you to the pin you're previewing — "here's the way there".
  const routeLine = React.useMemo(() => {
    if (!userLoc || !previewId) return null;
    const e = events.find((x) => x.id === previewId);
    if (!e) return null;
    const lat = e.lat ?? e.latitude, lng = e.lon ?? e.longitude;
    if (lat == null) return null;
    return [[userLoc.lng, userLoc.lat], [lng, lat]];
  }, [userLoc, previewId, events]);

  // "Live now" filters to venues with verified people there; the scrubber filters
  // to a chosen night; otherwise everything upcoming shows.
  const shownEvents = React.useMemo(() => {
    let list = events;
    if (liveOnly) list = list.filter((e) => (e.here_count || 0) > 0);
    if (dayFilter) list = list.filter((e) => String(e.event_date || '').slice(0, 10) === dayFilter);
    return list;
  }, [events, liveOnly, dayFilter]);

  const communityPois = React.useMemo(() => {
    const POI_TYPES = new Set(['police_nearby', 'atm', 'medical_point', 'station', 'taxi_rank', 'safe_spot']);
    return reports
      .filter(r => POI_TYPES.has(r.kind) && r.status === 'confirmed')
      .map(r => ({
        lat: r.lat, lng: r.lon,
        icon: MAP_REPORT_BY_KEY[r.kind]?.icon === 'shield' ? '🛡️' :
              MAP_REPORT_BY_KEY[r.kind]?.icon === 'plus-square' ? '🏥' :
              MAP_REPORT_BY_KEY[r.kind]?.icon === 'dollar-sign' ? '💰' :
              MAP_REPORT_BY_KEY[r.kind]?.icon === 'navigation' ? '🚕' : '📍'
      }));
  }, [reports]);

  const cycleStyle = () => {
    const next = mapStyle === 'dark' ? 'light' : mapStyle === 'light' ? 'liberty' : 'dark';
    setMapStyle(next);
  };

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

        {/* Search Bar */}
        <View style={[cs.searchRow, { backgroundColor: `${primary}12`, borderColor: `${primary}30` }]}>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchBar}
            placeholder="Search city or area..."
            placeholderTextColor={muted}
            onSubmitEditing={handleSearch}
            style={[cs.searchInput, { color: textColor }]}
          />
          <TouchableOpacity onPress={handleSearch} style={cs.searchBtn}>
            {searching ? <ActivityIndicator size="small" color={primary} /> : <Feather name="search" size={18} color={primary} />}
          </TouchableOpacity>
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
              reports={reports}
              onReportPress={(id) => { const r = reports.find((x) => x.id === id); if (r) { setPreviewId(null); setActiveZone(null); setActiveStay(null); setActiveReport(r); } }}
              center={center}
              onViewportChange={onViewportChange}
              userLoc={userLoc}
              ripple={ripple}
              route={routeLine}
              heat={heat}
              mine={myFog.points}
              showMine={showMine}
              crew={crewPlans}
              showCrew={showCrew}
              nearby={nearbyVibers}
              showNearby={networkingMode}
              stays={stays}
              pois={communityPois}
              trails={vibeTrails}
              showTrails={showTrails}
              mapStyle={mapStyle}
              show3D={show3D}
              showWeather={showWeather}
              primaryColor={primary}
              showStays={showStays}
              onStayPress={(id) => { setPreviewId(null); setActiveZone(null); openStay(id); }}
              onViberPress={handleViberPress}
              drawMode={drawing ? mode : null}
              drawPoints={points}
              followUser={followMe}
              onMapClick={onMapClick}
              onReady={(map) => { mapApiRef.current = map; }}
              onEventPress={(id) => {
                setActiveZone(null); setActiveStay(null); setPreviewId(id);
                // Focus the tapped pin (A7) so it sits above the preview sheet.
                const e = events.find((x) => x.id === id);
                if (e) setCenter({ lat: e.lat ?? e.latitude, lng: e.lon ?? e.longitude });
              }}
              onZonePress={(id) => { const z = zones.find((x) => x.id === id); if (z) { setPreviewId(null); setActiveStay(null); setActiveZone(z); } }}
            />
          </ErrorBoundary>

          {/* Floating controls (only when the real map is up and not drawing) */}
          {isMapSupported() && !drawing && (
            <View style={cs.fabCol} pointerEvents="box-none">
              <TouchableOpacity onPress={() => (user ? setReportSheet(true) : onAuthRequired?.())} style={[cs.fab, { backgroundColor: primary, borderColor: primary }]} accessibilityLabel="Add a report to the map">
                <Feather name="plus" size={20} color="#000" />
              </TouchableOpacity>
              <TouchableOpacity onPress={mineLayer.toggle} style={[cs.fab, { backgroundColor: showMine ? '#fbbf24' : bg, borderColor: showMine ? '#fbbf24' : `${primary}40` }]}>
                <Feather name="star" size={18} color={showMine ? '#000' : '#fbbf24'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={crewLayer.toggle} style={[cs.fab, { backgroundColor: showCrew ? '#ec4899' : bg, borderColor: showCrew ? '#ec4899' : `${primary}40` }]}>
                <Feather name="users" size={18} color={showCrew ? '#fff' : '#ec4899'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={nearbyLayer.toggle} style={[cs.fab, { backgroundColor: showNearby ? primary : bg, borderColor: showNearby ? primary : `${primary}40` }]} accessibilityLabel="Find vibers nearby">
                <Feather name="user-check" size={18} color={showNearby ? '#000' : primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleNetworking} style={[cs.fab, { backgroundColor: networkingMode ? primary : bg, borderColor: networkingMode ? primary : `${primary}40` }]} accessibilityLabel="Toggle networking mode">
                <Feather name="message-square" size={18} color={networkingMode ? '#000' : primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={trailsLayer.toggle} style={[cs.fab, { backgroundColor: showTrails ? primary : bg, borderColor: showTrails ? primary : `${primary}40` }]} accessibilityLabel="Show flow trails">
                <Feather name="trending-up" size={18} color={showTrails ? '#000' : primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={staysLayer.toggle} style={[cs.fab, { backgroundColor: showStays ? '#f59e0b' : bg, borderColor: showStays ? '#f59e0b' : `${primary}40` }]} accessibilityLabel="Places to stay from Resident Crew">
                <Feather name="home" size={17} color={showStays ? '#000' : '#f59e0b'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setHeat((h) => !h)} style={[cs.fab, { backgroundColor: heat ? primary : bg, borderColor: `${primary}40` }]}>
                <Feather name="activity" size={18} color={heat ? '#000' : primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setLiveOnly((v) => !v)} style={[cs.fab, { backgroundColor: liveOnly ? '#10b981' : bg, borderColor: liveOnly ? '#10b981' : `${primary}40` }]}>
                <Feather name="radio" size={17} color={liveOnly ? '#000' : '#10b981'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={cycleStyle} style={[cs.fab, { backgroundColor: bg, borderColor: `${primary}40` }]} accessibilityLabel="Change map style">
                <Feather name="layers" size={17} color={primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShow3D(!show3D)} style={[cs.fab, { backgroundColor: show3D ? primary : bg, borderColor: `${primary}40` }]} accessibilityLabel="Toggle 3D buildings">
                <Text style={{ color: show3D ? '#000' : primary, fontWeight: '900', fontSize: 10 }}>3D</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowWeather(!showWeather)} style={[cs.fab, { backgroundColor: showWeather ? primary : bg, borderColor: `${primary}40` }]} accessibilityLabel="Toggle weather radar">
                <Feather name="cloud" size={17} color={showWeather ? '#000' : primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={fitAll} style={[cs.fab, { backgroundColor: bg, borderColor: `${primary}40` }]}>
                <Feather name="maximize" size={17} color={primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={zoomIn} style={[cs.fab, { backgroundColor: bg, borderColor: `${primary}40` }]}>
                <Feather name="plus-circle" size={18} color={primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={zoomOut} style={[cs.fab, { backgroundColor: bg, borderColor: `${primary}40` }]}>
                <Feather name="minus-circle" size={18} color={primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleFollowMe} style={[cs.fab, { backgroundColor: followMe ? primary : bg, borderColor: followMe ? primary : `${primary}40` }]}>
                <Feather name="navigation" size={18} color={followMe ? '#000' : primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={recenter} style={[cs.fab, { backgroundColor: bg, borderColor: `${primary}40` }]}>
                <Feather name="crosshair" size={18} color={primary} />
              </TouchableOpacity>
              {/* Tracing a closure needs the web renderer's map-click; on native
                  the button would open a draw UI that never receives a point. */}
              {isDrawSupported() && (
                <TouchableOpacity onPress={startDraw} style={[cs.markBtn, { backgroundColor: primary }]}>
                  <Feather name="edit-3" size={15} color="#000" />
                  <Text style={cs.markText}>Mark a closure</Text>
                </TouchableOpacity>
              )}
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
              <View style={cs.legendRow}><View style={[cs.dot, { backgroundColor: primary, borderWidth: 1, borderColor: '#fff' }]} /><Text style={cs.legendText}>Vibers</Text></View>
              <View style={cs.legendRow}><View style={[cs.dot, { backgroundColor: '#ec4899' }]} /><Text style={cs.legendText}>Networking</Text></View>
              <View style={cs.legendRow}><Text style={cs.legendText}>🛡️ Safety</Text></View>
              <View style={cs.legendRow}><Feather name="bell" size={9} color="#eab308" /><Text style={cs.legendText}>Resident alert</Text></View>
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

        {viberModalVisible && (
          <ViberProfileModal
            visible={viberModalVisible}
            userId={selectedViberId}
            onClose={() => setViberModalVisible(false)}
            onNavigateToEvent={(ev) => { setViberModalVisible(false); onNavigateToEvent?.(ev); }}
          />
        )}

        {/* Add-a-report picker (the crowdsourced map layer) */}
        <MapReportSheet visible={reportSheet} onClose={() => setReportSheet(false)} onSubmit={submitReport} />

        {/* Report detail + Truth Protocol confirm/dispute */}
        {activeReport && !drawing && (
          <ReportDetail
            report={activeReport} onClose={() => setActiveReport(null)} onVerify={verifyReport}
            primary={primary} bg={bg} textColor={textColor} muted={muted}
          />
        )}

        {/* Stay detail — accommodation from Resident Crew */}
        {activeStay && !drawing && (
          <StayDetail
            stay={activeStay} onClose={() => setActiveStay(null)}
            bg={bg} textColor={textColor} muted={muted}
          />
        )}
      </SafeAreaView>
    </ErrorBoundary>
  );
};

// ── Report detail sheet — confirm / dispute a crowdsourced pin ─────────────────
const ReportDetail = ({ report, onClose, onVerify, primary, bg, textColor, muted }) => {
  const meta = MAP_REPORT_BY_KEY[report.kind] || { label: report.kind, color: primary, icon: 'map-pin' };
  const mins = Math.max(0, Math.round((new Date(report.expires_at).getTime() - Date.now()) / 60000));
  const fades = mins > 90 ? `${Math.round(mins / 60)}h` : `${mins}m`;
  return (
    <View style={[cs.sheet, { backgroundColor: bg, borderColor: `${meta.color}55` }]}>
      <View style={cs.sheetHead}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <View style={[cs.kindDot, { backgroundColor: `${meta.color}22`, borderColor: meta.color }]}>
            <Feather name={meta.icon} size={15} color={meta.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[cs.sheetTitle, { color: textColor }]} numberOfLines={1}>{meta.label}</Text>
            <Text style={{ color: muted, fontSize: 11 }}>
              {report.status === 'confirmed' ? '✓ Confirmed by locals' : report.status === 'disputed' ? 'Disputed' : 'Just reported'} · fades in {fades}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="x" size={20} color={muted} />
        </TouchableOpacity>
      </View>
      {report.note ? <Text style={{ color: muted, fontSize: 13, lineHeight: 18 }}>{report.note}</Text> : null}
      <Text style={{ color: muted, fontSize: 11, marginTop: 2 }}>Is this still accurate?</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity onPress={() => onVerify('confirm')} style={[cs.verifyBtn, { borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.12)' }]}>
          <Feather name="check" size={14} color="#10b981" />
          <Text style={{ color: '#10b981', fontWeight: '800', fontSize: 13 }}>Still true{report.confirm_count ? ` · ${report.confirm_count}` : ''}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onVerify('dispute')} style={[cs.verifyBtn, { borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.10)' }]}>
          <Feather name="x" size={14} color="#ef4444" />
          <Text style={{ color: '#ef4444', fontWeight: '800', fontSize: 13 }}>Gone{report.dispute_count ? ` · ${report.dispute_count}` : ''}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ── Stay detail sheet — accommodation from Resident Crew ──────────────────────
const StayDetail = ({ stay, onClose, bg, textColor, muted }) => {
  const gold = '#f59e0b';
  const price = stay.price != null ? `${stay.currency || 'ZAR'} ${stay.price}` : null;
  const place = [stay.suburb, stay.city].filter(Boolean).join(', ');
  const amenities = [
    stay.wifi ? 'WiFi' : null,
    stay.parking ? 'Parking' : null,
    stay.bathroom ? `${stay.bathroom} bath` : null,
    stay.livesHere ? 'Landlord on-site' : null,
  ].filter(Boolean).join(' · ');
  const link = residentUrl('dashboard'); // Resident's map/listings live under the dashboard
  const open = () => { if (link) Linking.openURL(link).catch(() => {}); };

  return (
    <View style={[cs.sheet, { backgroundColor: bg, borderColor: `${gold}55` }]}>
      <View style={cs.sheetHead}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          {stay.image ? (
            <Image source={{ uri: stay.image }} style={{ width: 46, height: 46, borderRadius: 10 }} />
          ) : (
            <View style={[cs.kindDot, { backgroundColor: `${gold}22`, borderColor: gold }]}>
              <Feather name="home" size={15} color={gold} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[cs.sheetTitle, { color: textColor }]} numberOfLines={1}>{stay.title}</Text>
            <Text style={{ color: muted, fontSize: 11 }} numberOfLines={1}>
              {price ? `${price}/mo` : 'Enquire'}{place ? ` · ${place}` : ''} · via Resident Crew
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="x" size={20} color={muted} />
        </TouchableOpacity>
      </View>

      {amenities ? <Text style={{ color: muted, fontSize: 12 }}>{amenities}</Text> : null}
      {stay.safety ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Feather name="shield" size={12} color={stay.safety === 'high' ? '#10b981' : stay.safety === 'low' ? '#ef4444' : gold} />
          <Text style={{ color: muted, fontSize: 11, textTransform: 'capitalize' }}>{stay.safety} safety area</Text>
        </View>
      ) : null}

      {hasResident() ? (
        <TouchableOpacity onPress={open} style={[cs.verifyBtn, { borderColor: gold, backgroundColor: `${gold}1a` }]}>
          <Feather name="external-link" size={14} color={gold} />
          <Text style={{ color: gold, fontWeight: '800', fontSize: 13 }}>View on Resident Crew</Text>
        </TouchableOpacity>
      ) : (
        <Text style={{ color: muted, fontSize: 11, fontStyle: 'italic' }}>Open The Resident to book this stay.</Text>
      )}
    </View>
  );
};

// ── Zone detail sheet ─────────────────────────────────────────────────────────
const ZoneDetail = ({ zone, onClose, onVerify, onOpenEvent, primary, bg, textColor, muted }) => {
  const [endpoints, setEndpoints] = useState({ start: '', end: '' });

  useEffect(() => {
    if (zone.geometry?.type === 'LineString' && zone.geometry.coordinates.length >= 2) {
      const coords = zone.geometry.coordinates;
      const start = coords[0];
      const end = coords[coords.length - 1];

      const reverseGeocode = async (lng, lat) => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18`, {
            headers: { 'User-Agent': 'TheGruvs/1.0' }
          });
          const data = await res.json();
          return data.display_name?.split(',')[0] || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        } catch { return `${lat.toFixed(4)}, ${lng.toFixed(4)}`; }
      };

      Promise.all([reverseGeocode(start[0], start[1]), reverseGeocode(end[0], end[1])])
        .then(([s, e]) => setEndpoints({ start: s, end: e }))
        .catch(() => {});
    }
  }, [zone.id]);

  const meta = ZONE_KINDS[zone.kind] || {};
  const st = ZONE_STATUS[zone.status] || { label: zone.status };
  const startsAt = new Date(zone.starts_at);
  const endsAt = new Date(zone.ends_at);
  const now = Date.now();
  const isFuture = startsAt.getTime() > now;
  const timeRange = `${startsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${endsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  const endsIn = Math.max(0, Math.round((endsAt.getTime() - now) / 60000));
  const endsLabel = endsIn > 90 ? `${Math.round(endsIn / 60)}h` : `${endsIn}m`;
  const startsIn = Math.max(0, Math.round((startsAt.getTime() - now) / 60000));
  const startsLabel = startsIn > 90 ? `${Math.round(startsIn / 60)}h` : `${startsIn}m`;

  return (
    <View style={[cs.sheet, { backgroundColor: bg, borderColor: `${meta.color || primary}40` }]}>
      <View style={cs.sheetHead}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <View style={[cs.kindDot, { backgroundColor: `${meta.color || primary}22`, borderColor: meta.color || primary }]}>
            <Feather name={meta.icon || 'map-pin'} size={15} color={meta.color || primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[cs.sheetTitle, { color: textColor }]} numberOfLines={1}>{zone.label || meta.label || 'Zone'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Feather name="clock" size={10} color={isFuture ? '#fbbf24' : muted} />
              <Text style={{ color: isFuture ? '#fbbf24' : muted, fontSize: 11 }}>{timeRange}</Text>
              <Text style={{ color: isFuture ? '#fbbf24' : primary, fontSize: 11, fontWeight: '700' }}>
                · {isFuture ? `starts in ${startsLabel}` : `${endsLabel} left`}
              </Text>
            </View>
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

      {/* Confidence meter — how much the crowd backs this, at a glance. */}
      {(() => {
        const c = zone.confirm_count || 0, d = zone.dispute_count || 0, total = c + d;
        if (total === 0) return null;
        const pct = Math.round((c / total) * 100);
        const col = pct >= 66 ? '#10b981' : pct >= 33 ? '#f59e0b' : '#ef4444';
        return (
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: muted, fontSize: 10, fontWeight: '700' }}>COMMUNITY CONFIDENCE</Text>
              <Text style={{ color: col, fontSize: 10, fontWeight: '900' }}>{pct}%</Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: `${muted}25`, overflow: 'hidden' }}>
              <View style={{ width: `${pct}%`, height: '100%', backgroundColor: col }} />
            </View>
          </View>
        );
      })()}

      {zone.note ? <Text style={{ color: muted, fontSize: 12, lineHeight: 17 }}>{zone.note}</Text> : null}

      {/* Point A to Point B explanation (for lines) */}
      {zone.geometry?.type === 'LineString' && (
        <View style={{ gap: 4, padding: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, borderWidth: 1, borderColor: `${primary}15` }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', borderWidth: 2, borderColor: '#ef4444' }} />
            <Text style={{ color: textColor, fontSize: 12, fontWeight: '800' }}>FROM: <Text style={{ color: muted, fontWeight: '600' }}>{endpoints.start || 'Point A'}</Text></Text>
          </View>
          <View style={{ width: 1, height: 10, backgroundColor: `${primary}30`, marginLeft: 3.5 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', borderWidth: 2, borderColor: '#ef4444' }} />
            <Text style={{ color: textColor, fontSize: 12, fontWeight: '800' }}>TO: <Text style={{ color: muted, fontWeight: '600' }}>{endpoints.end || 'Point B'}</Text></Text>
          </View>
          <Text style={{ color: primary, fontSize: 10, fontWeight: '700', marginTop: 4, fontStyle: 'italic' }}>
            {isFuture ? 'Strategically scheduled to minimize resident impact.' : 'Live impact area active now.'}
          </Text>
        </View>
      )}

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
  searchRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, alignItems: 'center' },
  searchInput: { flex: 1, height: 44, fontSize: 14, fontWeight: '600' },
  searchBtn: { padding: 8 },
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
