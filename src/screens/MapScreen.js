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
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Linking, Image, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LiveMap, isMapSupported, mapCapabilities } from '../components/LiveMap';
import { ZoneDrawTool } from '../components/ZoneDrawTool';
import { MapEventPreview } from '../components/MapEventPreview';
import { MapReportSheet } from '../components/MapReportSheet';
import { MapLayersModal } from '../components/MapLayersModal';
import { SmartImage } from '../components/SmartImage';
import { GLASS, SHADOW } from '../constants/DesignTokens';
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
import { searchPlaces } from '../services/geocoding';
import { useToast } from '../components/ToastNotification';
import { pickConciergeMove } from '../services/concierge';
import { MapNudge } from '../components/MapNudge';
import { VibeRouletteModal } from '../components/VibeRouletteModal';
import { GetHomeSafeModal } from '../components/GetHomeSafeModal';
import { getMyFog } from '../services/fogMap';
import { getCrewPlans } from '../services/crewMap';
import { rankPeople } from '../services/peopleScore';
import { Accommodation } from '../services/accommodation';
import { residentUrl, hasResident } from '../constants/residentUrl';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NUDGE_COOLDOWN_KEY = 'gruvs_map_nudge_ts';
const NUDGE_COOLDOWN_MS = 2 * 3600 * 1000; // don't nag — at most every 2h

const JHB = { lat: -26.2041, lng: 28.0473 };

// How long to wait for the map's first viewport before assuming it will never
// come and loading unbounded instead.
const VIEWPORT_WAIT_MS = 4000;

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
  const [hourFilter, setHourFilter] = useState(null); // 20 (8PM) to 4 (4AM) | null (all hours)
  const [nudge, setNudge] = useState(null);
  const [showRoulette, setShowRoulette] = useState(false);
  const [showHomeSafe, setShowHomeSafe] = useState(false);
  // Crowdsourced map reports (the "update the map yourself" layer).
  const [reports, setReports] = useState([]);
  const [reportSheet, setReportSheet] = useState(false);
  const [layersModalVisible, setLayersModalVisible] = useState(false);
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

  // Phase 2: Find Them — discoverable vibers near you, ranked by relevance
  // rather than returned in whatever order the GPS-radius RPC happens to give
  // them. get_safe_nearby_vibers() is a pure distance scan with zero notion of
  // "who's actually worth walking over to" — this is that ranking.
  const fetchNearbyVibers = useCallback(async () => {
    const raw = await DiscoveryManager.findNearbyVibers(user?.id, 10);
    if (!user?.id || raw.length === 0) return raw;

    // "Here, right now" beats "two blocks away" (peopleScore's sameEventNow) —
    // find what event the viewer is currently checked into, then which of the
    // nearby candidates share it. Best-effort: a failure here just means
    // everyone ranks on proximity/vibe alone, never a broken screen.
    let sameEventIds = new Set();
    try {
      const since = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
      const { data: mine } = await supabase
        .from('live_checkins').select('event_id')
        .eq('user_id', user.id).gte('checked_in_at', since)
        .order('checked_in_at', { ascending: false }).limit(1).maybeSingle();
      if (mine?.event_id) {
        const { data: shared } = await supabase
          .from('live_checkins').select('user_id')
          .eq('event_id', mine.event_id).gte('checked_in_at', since)
          .in('user_id', raw.map((v) => v.id));
        sameEventIds = new Set((shared || []).map((r) => r.user_id));
      }
    } catch (_err) { /* ranking degrades to proximity-only */ }

    const viewer = { id: user.id, lat: userLoc?.lat, lon: userLoc?.lng };
    const extras = Object.fromEntries(raw.map((v) => [v.id, { sameEventNow: sameEventIds.has(v.id) }]));
    return rankPeople(viewer, raw, extras);
  }, [user?.id, userLoc?.lat, userLoc?.lng]);

  const nearbyLayer = useMapLayer({
    fetch: fetchNearbyVibers,
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

  // What the active renderer (web MapLibre GL vs native MapLibre) can do.
  const caps = mapCapabilities();

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
    let loadFallbackTimer = null;
    (async () => {
      setLoading(true);
      // When there's a real map, its first 'moveend' tells us what to load —
      // loading here too would fetch the wrong area and then immediately refetch.
      // Without a map (native, or MapLibre unavailable) nothing will ever emit a
      // viewport, so the list view still needs its one unbounded load.
      if (isMapSupported()) {
        // Safety net: isMapSupported() only says the library loaded. If the map
        // itself fails to construct, no viewport ever arrives and the spinner
        // would run forever. Give up waiting and load unbounded instead.
        loadFallbackTimer = setTimeout(() => {
          if (!alive || fetchedBboxRef.current) return;
          Promise.all([loadEvents(), loadZones(), loadReports()])
            .finally(() => { if (alive) setLoading(false); });
        }, VIEWPORT_WAIT_MS);
        return;
      }
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
    // postgres_changes can't filter by geography, so every client is woken by
    // every check-in on earth. Reloading on all of them would mean the busier
    // the platform gets, the more pointless refetches each map does. So only
    // react to a change that affects what THIS map is currently showing.
    const affectsOurMap = (eventId) => !!eventId && eventsRef.current.some((x) => x.id === eventId);
    const inView = (lat, lon) => {
      const b = fetchedBboxRef.current;
      if (!b || !Number.isFinite(lat) || !Number.isFinite(lon)) return true; // unknown → don't suppress
      return lat >= b.south && lat <= b.north && lon >= b.west && lon <= b.east;
    };

    // A new check-in: ripple at that venue if it's on the map, then refresh counts.
    const onCheckin = (p) => {
      const evId = p?.new?.event_id;
      const e = evId && eventsRef.current.find((x) => x.id === evId);
      if (!e) return; // someone checked in somewhere we aren't looking
      const lat = e.lat ?? e.latitude, lng = e.lon ?? e.longitude;
      if (lat != null) setRipple({ lat, lng, key: Date.now() });
      bump();
    };
    const onCheckout = (p) => { if (affectsOurMap(p?.old?.event_id)) bump(); };
    const onNewEvent = (p) => {
      const lat = Number(p?.new?.lat ?? p?.new?.latitude);
      const lon = Number(p?.new?.lon ?? p?.new?.longitude);
      if (inView(lat, lon)) bump();
    };

    const live = supabase
      .channel(`map_live_${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_checkins' }, onCheckin)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'live_checkins' }, onCheckout)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, onNewEvent)
      .subscribe();

    return () => {
      alive = false; off?.(); offReports?.();
      clearTimeout(t); clearTimeout(loadFallbackTimer);
      try { supabase.removeChannel(live); } catch {}
    };
  }, [loadEvents, loadZones, loadReports]);

  // Re-pull zones + reports when the centre moves — but ONLY where nothing else
  // will. With a real map, easeTo → moveend → onViewportChange already handles
  // it, and that path is guarded by shouldRefetch; running this too would fetch
  // again unconditionally on every centre change, bypassing the guard.
  useEffect(() => {
    if (isMapSupported()) return;
    loadZones(); loadReports();
  }, [center, loadZones, loadReports]);

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
      // Goes through the shared geocoder rather than calling Nominatim raw.
      // geocoding.js exists precisely so map search resolves places the same way
      // event posting does: a serial ≥1.1s queue (Nominatim's policy is ~1 req/s
      // and this screen has a button you can hammer), a result cache, and the
      // on-device geocoder first on native. The raw call here also set a
      // User-Agent header, which browsers silently drop — so it was claiming an
      // identity Nominatim never saw.
      const near = bboxCenter(fetchedBboxRef.current) || centerRef.current;
      const [place] = await searchPlaces(searchQuery, {
        limit: 1,
        near: near ? { lat: near.lat, lon: near.lng } : undefined,
      });
      if (place && Number.isFinite(place.lat) && Number.isFinite(place.lon)) {
        setCenter({ lat: place.lat, lng: place.lon });
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

  // Where crowds ACTUALLY move between venues: the same person Touched Down at
  // one venue and then another. This used to draw lines between consecutive
  // events in array order — a decoration shaped like an insight. The server
  // aggregates it and only returns a hop 3+ distinct people made, so no single
  // person's night is legible on the map.
  const fetchTrails = useCallback(async () => {
    const bbox = fetchedBboxRef.current;
    if (!bbox) return [];
    const { data, error } = await supabase.rpc('venue_flows_in_bbox', {
      p_west: bbox.west, p_south: bbox.south, p_east: bbox.east, p_north: bbox.north,
    });
    if (error) {
      // No fabricated fallback: an empty layer is honest, an invented one isn't.
      logError('map:venue_flows_in_bbox', error, { code: error.code || null });
      return [];
    }
    return (data || []).map((f) => ({
      from: { lat: f.from_lat, lng: f.from_lon },
      to: { lat: f.to_lat, lng: f.to_lon },
      people: Number(f.people || 0),
    }));
  }, []);

  const staysLayer = useMapLayer({
    fetch: fetchStays,
    emptyMessage: 'No Resident Crew stays near here yet.',
    toast,
  });
  const stays = staysLayer.data;
  const showStays = staysLayer.on;

  const trailsLayer = useMapLayer({
    fetch: fetchTrails,
    emptyMessage: 'No crowd movement between these venues yet — it appears once people Touch Down at more than one.',
    toast,
  });
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

  // There is deliberately no "route" line here any more. It drew a straight
  // segment from you to the venue and called it the way there — through
  // buildings, over the M1, across the Jukskei — and "Take me there" told you to
  // follow it. A route that isn't a route is the same class of thing as a
  // promoter's inflated door count, which is what this app exists to replace.
  // Directions now hand off to the phone's own nav app (utils/directions).

  // "Live now" filters to venues with verified people there; the scrubber filters
  // to a chosen night; search query instantly matches event names/venues; otherwise everything upcoming shows.
  const shownEvents = React.useMemo(() => {
    let list = events;
    if (liveOnly) list = list.filter((e) => (e.here_count || 0) > 0);
    if (dayFilter) list = list.filter((e) => String(e.event_date || '').slice(0, 10) === dayFilter);
    if (hourFilter !== null) {
      list = list.filter((e) => {
        if (!e.event_date) return true;
        const evHour = new Date(e.event_date).getHours();
        // Match events within +/- 2 hours of selected nightlife timeline
        const diff = Math.abs(evHour - hourFilter);
        return diff <= 2 || diff >= 22;
      });
    }
    const q = (searchQuery || '').trim().toLowerCase();
    if (q) {
      list = list.filter((e) =>
        (e.title && e.title.toLowerCase().includes(q)) ||
        (e.venue_name && e.venue_name.toLowerCase().includes(q)) ||
        (e.suburb && e.suburb.toLowerCase().includes(q)) ||
        (e.category && e.category.toLowerCase().includes(q))
      );
    }
    return list;
  }, [events, liveOnly, dayFilter, searchQuery]);

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
        {/* Floating Top Control Capsule */}
        <View style={cs.floatingHeader} pointerEvents="box-none">
          {/* Glass Search Bar */}
          <View style={[cs.glassSearchRow, { backgroundColor: `${bg}dd`, borderColor: `${primary}35` }]}>
            <Feather name="search" size={17} color={primary} style={{ marginLeft: 12, marginRight: 8 }} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchBar}
              placeholder="Search spots, vibes, areas..."
              placeholderTextColor={muted}
              onSubmitEditing={handleSearch}
              style={[cs.searchInput, { color: textColor }]}
            />
            {searching ? (
              <ActivityIndicator size="small" color={primary} style={{ marginRight: 10 }} />
            ) : searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => setSearchBar('')} style={{ padding: 8 }}>
                <Feather name="x" size={16} color={muted} />
              </TouchableOpacity>
            ) : null}
            <View style={[cs.searchDivider, { backgroundColor: `${muted}30` }]} />
            <TouchableOpacity onPress={recenter} style={cs.headerActionBtn} accessibilityLabel="My Location">
              <Feather name="crosshair" size={18} color={primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setLayersModalVisible(true)} style={[cs.headerActionBtn, { backgroundColor: `${primary}18`, borderRadius: 18 }]} accessibilityLabel="Layers and filters">
              <Feather name="layers" size={18} color={primary} />
            </TouchableOpacity>
          </View>

          {/* Quick Filter Pill Strip */}
          {isMapSupported() && !drawing && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={cs.quickFilterStrip} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
              {/* Live Now verified pill */}
              <TouchableOpacity
                onPress={() => setLiveOnly((v) => !v)}
                style={[
                  cs.quickPill,
                  {
                    borderColor: liveOnly ? '#10b981' : `${muted}35`,
                    backgroundColor: liveOnly ? '#10b98122' : `${bg}dd`,
                  }
                ]}
                activeOpacity={0.8}
              >
                <Feather name="radio" size={12} color={liveOnly ? '#10b981' : muted} />
                <Text style={[cs.quickPillText, { color: liveOnly ? '#10b981' : textColor }]}>Live Now</Text>
                {liveOnly && <View style={[cs.activePillDot, { backgroundColor: '#10b981' }]} />}
              </TouchableOpacity>

              {/* Crowd Heatmap pill */}
              <TouchableOpacity
                onPress={() => setHeat((h) => !h)}
                style={[
                  cs.quickPill,
                  {
                    borderColor: heat ? '#f59e0b' : `${muted}35`,
                    backgroundColor: heat ? '#f59e0b22' : `${bg}dd`,
                  }
                ]}
                activeOpacity={0.8}
              >
                <Feather name="activity" size={12} color={heat ? '#f59e0b' : muted} />
                <Text style={[cs.quickPillText, { color: heat ? '#f59e0b' : textColor }]}>Heatmap</Text>
              </TouchableOpacity>

              {/* Crew Convergence pill */}
              <TouchableOpacity
                onPress={crewLayer.toggle}
                style={[
                  cs.quickPill,
                  {
                    borderColor: showCrew ? '#ec4899' : `${muted}35`,
                    backgroundColor: showCrew ? '#ec489922' : `${bg}dd`,
                  }
                ]}
                activeOpacity={0.8}
              >
                <Feather name="users" size={12} color={showCrew ? '#ec4899' : muted} />
                <Text style={[cs.quickPillText, { color: showCrew ? '#ec4899' : textColor }]}>
                  Crew{crewOut > 0 ? ` (${crewOut})` : ''}
                </Text>
              </TouchableOpacity>

              {/* Day filter pills */}
              <TouchableOpacity onPress={() => setDayFilter(null)}
                style={[cs.quickPill, { borderColor: !dayFilter ? primary : `${muted}35`, backgroundColor: !dayFilter ? `${primary}22` : `${bg}dd` }]}>
                <Text style={[cs.quickPillText, { color: !dayFilter ? primary : muted }]}>All Nights</Text>
              </TouchableOpacity>
              {/* Nightlife 8 PM - 4 AM Time-Scrubber Pills */}
              {[
                { hour: null, label: 'Anytime' },
                { hour: 20, label: '8 PM (Warmup)' },
                { hour: 23, label: '11 PM (Peak)' },
                { hour: 2, label: '2 AM (Afters)' },
              ].map((slot, i) => {
                const active = hourFilter === slot.hour;
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setHourFilter(active ? null : slot.hour)}
                    style={[
                      cs.quickPill,
                      {
                        borderColor: active ? '#00f2ff' : `${muted}35`,
                        backgroundColor: active ? 'rgba(0,242,255,0.22)' : `${bg}dd`,
                      }
                    ]}
                  >
                    <Feather name="clock" size={11} color={active ? '#00f2ff' : muted} />
                    <Text style={[cs.quickPillText, { color: active ? '#00f2ff' : textColor }]}>{slot.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

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

          {/* Clean Modern Floating Action Bar */}
          {isMapSupported() && !drawing && (
            <View style={cs.fabCol} pointerEvents="box-none">
              {/* Report button */}
              <TouchableOpacity
                onPress={() => (user ? setReportSheet(true) : onAuthRequired?.())}
                style={[cs.fabPrimary, { backgroundColor: primary }]}
                accessibilityLabel="Report incident or live tip"
              >
                <Feather name="plus" size={22} color="#000" />
              </TouchableOpacity>

              {/* Layers Drawer Trigger */}
              <TouchableOpacity
                onPress={() => setLayersModalVisible(true)}
                style={[cs.fab, { backgroundColor: `${bg}ee`, borderColor: `${primary}35` }]}
                accessibilityLabel="Open map layers and visual modes"
              >
                <Feather name="layers" size={18} color={primary} />
              </TouchableOpacity>

              {/* Roulette / Discovery prompt */}
              <TouchableOpacity
                onPress={() => setShowRoulette(true)}
                style={[cs.fab, { backgroundColor: `${bg}ee`, borderColor: `${primary}35` }]}
                accessibilityLabel="Vibe roulette"
              >
                <Feather name="compass" size={18} color={primary} />
              </TouchableOpacity>

              {/* Zoom & Fit Cluster */}
              <View style={[cs.zoomCluster, { backgroundColor: `${bg}ee`, borderColor: `${primary}30` }]}>
                <TouchableOpacity onPress={zoomIn} style={cs.zoomBtn} accessibilityLabel="Zoom in">
                  <Feather name="plus" size={17} color={primary} />
                </TouchableOpacity>
                <View style={[cs.zoomDivider, { backgroundColor: `${muted}30` }]} />
                <TouchableOpacity onPress={zoomOut} style={cs.zoomBtn} accessibilityLabel="Zoom out">
                  <Feather name="minus" size={17} color={primary} />
                </TouchableOpacity>
              </View>

              {/* Fit All in View */}
              <TouchableOpacity onPress={fitAll} style={[cs.fab, { backgroundColor: `${bg}ee`, borderColor: `${primary}35` }]} accessibilityLabel="Fit all events">
                <Feather name="maximize-2" size={16} color={primary} />
              </TouchableOpacity>

              {/* Mark closure tool on web */}
              {caps.draw && (
                <TouchableOpacity onPress={startDraw} style={[cs.markBtn, { backgroundColor: primary }]}>
                  <Feather name="edit-3" size={14} color="#000" />
                  <Text style={cs.markText}>Closure</Text>
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

          {/* Bottom Quick Vibe Bar — glanceable pulse when no sheet is open */}
          {isMapSupported() && !drawing && !activeZone && !previewId && shownEvents.length > 0 && (
            <View style={cs.bottomVibeBar} pointerEvents="box-none">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
              >
                {shownEvents.slice(0, 8).map((ev) => {
                  const here = ev.here_count || 0;
                  const isLive = here > 0;
                  const cover = ev.image_url || ev.image;
                  return (
                    <TouchableOpacity
                      key={ev.id}
                      style={[
                        cs.vibeSpotCard,
                        {
                          backgroundColor: `${bg}f0`,
                          borderColor: isLive ? '#10b98166' : `${primary}25`,
                        }
                      ]}
                      onPress={() => {
                        setPreviewId(ev.id);
                        if (ev.lat != null && ev.lon != null) {
                          setCenter({ lat: ev.lat, lng: ev.lon });
                        }
                      }}
                      activeOpacity={0.85}
                    >
                      {cover ? (
                        <SmartImage source={cover} style={cs.vibeSpotThumb} />
                      ) : (
                        <View style={[cs.vibeSpotThumb, { backgroundColor: `${primary}18`, alignItems: 'center', justifyContent: 'center' }]}>
                          <Feather name="music" size={14} color={primary} />
                        </View>
                      )}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[cs.vibeSpotTitle, { color: textColor }]} numberOfLines={1}>
                          {ev.title || ev.venue_name || 'Gruv'}
                        </Text>
                        <Text style={[cs.vibeSpotSub, { color: muted }]} numberOfLines={1}>
                          {ev.venue_name || ev.suburb || 'South Africa'}
                        </Text>
                      </View>
                      {isLive ? (
                        <View style={cs.liveBadgeWrap}>
                          <View style={cs.livePulseDot} />
                          <Text style={cs.liveBadgeText}>{here}</Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
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

        {/* Map Layers & Visual Modes Drawer */}
        <MapLayersModal
          visible={layersModalVisible}
          onClose={() => setLayersModalVisible(false)}
          mapStyle={mapStyle}
          onSelectStyle={setMapStyle}
          heat={heat}
          onToggleHeat={() => setHeat((h) => !h)}
          liveOnly={liveOnly}
          onToggleLiveOnly={() => setLiveOnly((v) => !v)}
          showMine={showMine}
          onToggleMine={mineLayer.toggle}
          showCrew={showCrew}
          onToggleCrew={crewLayer.toggle}
          showNearby={showNearby}
          onToggleNearby={nearbyLayer.toggle}
          showTrails={showTrails}
          onToggleTrails={trailsLayer.toggle}
          showStays={showStays}
          onToggleStays={staysLayer.toggle}
          show3D={show3D}
          onToggle3D={() => setShow3D((v) => !v)}
          showWeather={showWeather}
          onToggleWeather={() => setShowWeather((v) => !v)}
          caps={caps}
        />

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
  // Floating top controls capsule
  floatingHeader: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    zIndex: 30,
    gap: 10,
  },
  glassSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1.5,
    height: 48,
    paddingHorizontal: 4,
    ...SHADOW?.lift,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } : {}),
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 0,
  },
  searchDivider: {
    width: 1,
    height: 22,
    marginHorizontal: 4,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickFilterStrip: {
    flexGrow: 0,
  },
  quickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    ...SHADOW?.card,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } : {}),
  },
  quickPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  activePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // Floating controls cluster
  fabCol: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    alignItems: 'center',
    gap: 12,
    zIndex: 20,
  },
  fabPrimary: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW?.lift,
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW?.card,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } : {}),
  },
  zoomCluster: {
    borderRadius: 22,
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    ...SHADOW?.card,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } : {}),
  },
  zoomBtn: {
    width: 40,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomDivider: {
    width: 24,
    height: 1,
  },
  markBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    ...SHADOW?.lift,
  },
  markText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 12,
  },
  legend: { position: 'absolute', left: 16, bottom: 24, flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  fogChip: { position: 'absolute', top: 120, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, zIndex: 10 },
  fogChipText: { color: '#fbbf24', fontSize: 11, fontWeight: '800' },
  crewChip: { position: 'absolute', alignSelf: 'center', maxWidth: '86%', flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, zIndex: 10 },
  crewChipText: { color: '#ec4899', fontSize: 11, fontWeight: '800' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '700' },
  dot: { width: 9, height: 9, borderRadius: 5 },
  dash: { width: 14, height: 3, borderRadius: 2 },
  // Bottom Quick Vibe Carousel Bar
  bottomVibeBar: {
    position: 'absolute',
    left: 0,
    right: 80,
    bottom: 24,
    zIndex: 15,
  },
  vibeSpotCard: {
    width: 195,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 10,
    ...SHADOW?.lift,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } : {}),
  },
  vibeSpotThumb: {
    width: 38,
    height: 38,
    borderRadius: 12,
  },
  vibeSpotTitle: {
    fontSize: 12,
    fontWeight: '900',
  },
  vibeSpotSub: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  liveBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10b98120',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#10b98155',
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  liveBadgeText: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: '900',
  },
  vibeCategoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  vibeCategoryText: {
    fontSize: 9,
    fontWeight: '800',
  },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1.5, padding: 18, paddingBottom: 28, gap: 10, zIndex: 40 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kindDot: { width: 36, height: 36, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { fontSize: 16, fontWeight: '900' },
  trust: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 12, padding: 10 },
  verifyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 22, paddingVertical: 11 },
  eventLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, marginTop: 2 },
});

export default MapScreen;
