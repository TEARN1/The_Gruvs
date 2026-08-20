/**
 * MapScreen — "The Map" tab. The living map of your city's night.
 *
 * Phase 1: a real street map (LiveMap) with event pins and host-drawn impact
 * zones (road closures / routes / areas), a host "mark the impact" draw flow,
 * live zone updates, and a zone-detail sheet where the community confirms or
 * disputes a closure (Truth Protocol). Everything is SafeSection-wrapped so a
 * map failure never takes the app down.
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Linking, Image, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LiveMap, isMapSupported, MAP_STYLES, DEFAULT_MAP_STYLE } from '../components/LiveMap';
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
import { Accommodation } from '../services/accommodation';
import { residentUrl, hasResident } from '../constants/residentUrl';
import { filterByViewerAge } from '../utils/contentAgeRating';
import { loadViewerAge, viewerAgeSync } from '../utils/viewerAge';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NUDGE_COOLDOWN_KEY = 'gruvs_map_nudge_ts';
const NUDGE_COOLDOWN_MS = 2 * 3600 * 1000; // don't nag — at most every 2h

const JHB = { lat: -26.2041, lng: 28.0473 };

// Query a generously padded box, never the exact viewport. Opening on your own
// location lands at street zoom, where the literal viewport is a few hundred
// metres — a strict bbox query there returns nothing and the map looks broken.
// The floor (~0.25° ≈ 27km) keeps a city's worth of context loaded, so panning
// a few blocks never blanks the map.
function padBounds(b, factor = 1.6, minSpanDeg = 0.25) {
  const midLat = (b.minLat + b.maxLat) / 2;
  const midLng = (b.minLng + b.maxLng) / 2;
  const halfLat = Math.max((b.maxLat - b.minLat) * factor, minSpanDeg) / 2;
  const halfLng = Math.max((b.maxLng - b.minLng) * factor, minSpanDeg) / 2;
  return {
    minLat: midLat - halfLat, maxLat: midLat + halfLat,
    minLng: midLng - halfLng, maxLng: midLng + halfLng,
  };
}

// Has the map moved far enough that the loaded data no longer covers the view?
// Deliberately NOT "refetch on every moveend" — that would fire a query on each
// frame of a drag. The map offers a button instead, the way every map app does.
function boundsAreStale(loaded, next) {
  if (!loaded || !next) return false;
  const cLat = (next.minLat + next.maxLat) / 2;
  const cLng = (next.minLng + next.maxLng) / 2;
  // Centre wandered outside the area we actually queried.
  if (cLat < loaded.minLat || cLat > loaded.maxLat || cLng < loaded.minLng || cLng > loaded.maxLng) return true;
  // Or zoomed out far enough to be looking at meaningfully more ground.
  const areaOf = (b) => Math.max(1e-9, (b.maxLat - b.minLat) * (b.maxLng - b.minLng));
  return areaOf(next) > areaOf(loaded) * 1.8;
}

export const MapScreen = ({ onAuthRequired, onNavigateToEvent }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const { show: toast } = useToast();
  const primary = currentTheme?.primary || '#00f2ff';
  const bg = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.55)';

  const [center, setCenter] = useState(JHB);
  // True once we've centred on the user's real position. Until then the map is
  // sitting on the hardcoded JHB default, which is a guess — so let LiveMap
  // frame the actual pins instead of pretending the guess was right.
  const [centredOnUser, setCentredOnUser] = useState(false);
  // The blue "you are here" dot. Separate from `center`: the map can be panned
  // anywhere, but the dot stays where the user actually is.
  const [myLocation, setMyLocation] = useState(null);
  // Street-level zoom applied when we deliberately jump to the user. Null the
  // rest of the time so panning/auto-fit isn't forced back to this zoom.
  const [focusZoom, setFocusZoom] = useState(null);
  const [locating, setLocating] = useState(false);
  const [events, setEvents] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Viewport-driven loading ────────────────────────────────────────────────
  // The map used to be a fixed snapshot: it loaded once around wherever it
  // opened and never queried again, so panning to another city showed nothing
  // and events were fetched with no geographic filter at all (300 arbitrary
  // rows worldwide). LiveMap now reports its viewport, we query by bounding
  // box, and moving far enough offers a "Search this area" button rather than
  // refetching on every twitch of a drag.
  const [areaDirty, setAreaDirty] = useState(false);
  const [searching, setSearching] = useState(false);
  const [firstBounds, setFirstBounds] = useState(null);
  const [truncated, setTruncated] = useState(false);
  const viewportRef = useRef(null);      // latest {bounds, center, zoom}
  const loadedBoundsRef = useRef(null);  // the area the loaded events came from

  // ── Search + filters (client-side over the loaded set — instant, no round trip)
  const [query, setQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');   // all | tonight | week
  const [catFilter, setCatFilter] = useState([]);   // multi-select
  const [styleKey, setStyleKey] = useState(DEFAULT_MAP_STYLE);

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

  // Stays via Resident Crew — accommodation near you, from the sister app.
  const [showStays, setShowStays] = useState(false);
  const [stays, setStays] = useState([]);
  const [activeStay, setActiveStay] = useState(null);

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

  // `at` lets the viewport drive the query; falls back to the tracked centre
  // for the initial load and for the realtime-subscription refresh.
  const loadZones = useCallback(async (at = null) => {
    const c = at || viewportRef.current?.center || centerRef.current;
    const rows = await MapZones.near(c.lat, c.lng, { radiusM: 15000 });
    setZones(rows);
  }, []);

  // `bounds` narrows the query to what's actually on screen. Passing null keeps
  // the old global behaviour, used only for the very first paint before the map
  // has reported a viewport.
  const loadEvents = useCallback(async (bounds = null) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      let q = supabase
        .from('events')
        // `description` feeds the content age-rating below the same text signal
        // the other surfaces get (a tame title can carry a mature description);
        // it is not rendered on the map. `min_age` is the STORED floor and takes
        // priority over text rating — without it the gate silently degraded to
        // guessing from prose, which let 18+ listings through.
        // `venue_name`/`city` back the search box; `category` backs the filter.
        .select('id, title, description, min_age, latitude, longitude, lat, lon, going, event_date, venue_name, city, category')
        .gte('event_date', today)
        .is('deleted_at', null);

      // Bounding-box filter on lat/lon. Verified against the live DB: lat/lon is
      // populated on every event row, while latitude/longitude is set on barely
      // half and never alone — so lat/lon is the authoritative pair and it is
      // safe to filter on directly.
      if (bounds) {
        q = q.gte('lat', bounds.minLat).lte('lat', bounds.maxLat)
             .gte('lon', bounds.minLng).lte('lon', bounds.maxLng);
      }

      const CAP = 500;
      const { data } = await q.limit(CAP);
      // Hitting the cap means the map is showing a silently truncated slice —
      // the same class of bug as the old hard 300 limit, just a bigger number.
      // Surface it instead of quietly lying about coverage.
      setTruncated((data || []).length >= CAP);
      const withCoords = (data || []).filter((e) => (e.lat ?? e.latitude) != null && (e.lon ?? e.longitude) != null);
      // Silently hide mature listings from under-age viewers. The map was the
      // ONLY discovery surface missing this — The Drop, Explore, Scout and Reels
      // all apply it, so the same event was hidden in the feed but still pinned
      // on the map. The hard legal gate (RSVP / Touch Down in EventDetailScreen)
      // was never bypassed; this closes the content-visibility gap.
      setEvents(filterByViewerAge(withCoords, viewerAgeSync(), e => `${e.title || ''} ${e.description || ''}`));
    } catch { setEvents([]); }
  }, []);

  const handleViewport = useCallback((vp) => {
    if (!vp?.bounds) return;
    viewportRef.current = vp;
    // First report also arms the one-time refine below.
    setFirstBounds((prev) => prev || vp.bounds);
    if (loadedBoundsRef.current) setAreaDirty(boundsAreStale(loadedBoundsRef.current, vp.bounds));
  }, []);

  // The very first fetch runs before the map has reported anything, so it's
  // unbounded. The moment we learn where the map actually settled, narrow to
  // that area — this is what makes "the map shows what's HERE" true instead of
  // showing an arbitrary slice of every event in the database.
  const refinedRef = useRef(false);
  useEffect(() => {
    if (!firstBounds || refinedRef.current) return;
    refinedRef.current = true;
    const padded = padBounds(firstBounds);
    loadedBoundsRef.current = padded;
    loadEvents(padded);
  }, [firstBounds, loadEvents]);

  // "Search this area" — reload events, zones and (if shown) stays for exactly
  // what's on screen right now.
  const searchThisArea = useCallback(async () => {
    const vp = viewportRef.current;
    if (!vp?.bounds || searching) return;
    setSearching(true);
    try {
      const b = padBounds(vp.bounds);
      await Promise.all([
        loadEvents(b),
        loadZones(vp.center),
        showStays ? Accommodation.near(vp.center.lat, vp.center.lng, { radiusM: 15000 }).then(setStays) : Promise.resolve(),
      ]);
      loadedBoundsRef.current = b;
      setAreaDirty(false);
    } catch { toast('Could not load this area.', 'error'); }
    finally { setSearching(false); }
  }, [loadEvents, loadZones, searching, showStays, toast]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      // Prime the viewer's age BEFORE loading events. viewerAgeSync() reads a
      // module cache that only loadViewerAge() fills; without this it is always
      // null here, so every viewer — including adults — was treated as
      // unknown-age. LandingPage primes it the same way before its first load.
      await loadViewerAge(user?.id).catch(() => {});
      // Opening the map takes you to where you ARE — the Google Maps contract.
      // A cached fix is used instantly (no wait, no prompt); in parallel we ask
      // for a live one, which is what triggers the permission prompt the first
      // time. If permission is refused the map still works: autoFit frames the
      // events instead, so a denial degrades rather than breaking anything.
      try {
        const cached = LocationService.getCached?.();
        if (alive && cached?.lat != null) {
          const here = { lat: cached.lat, lng: cached.lon };
          setMyLocation(here); setCenter(here); setCentredOnUser(true); setFocusZoom(16);
        }
      } catch { /* no cached fix — the live request below is the real path */ }
      // silent: opening the map should never throw an error toast at someone
      // who simply hasn't granted location yet.
      recenter({ silent: true });
      await Promise.all([loadEvents(), loadZones()]);
      if (alive) setLoading(false);
    })();
    const off = MapZones.subscribe(() => loadZones());
    return () => { alive = false; off?.(); };
    // user?.id included so signing in/out re-primes the age and re-filters the
    // pins — otherwise an adult who signs in keeps the signed-out (unknown-age)
    // view until they navigate away and back.
  }, [loadEvents, loadZones, user?.id]);

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

  // "Take me to where I am" — the crosshair button. Google-Maps behaviour:
  // jump to the live position AND zoom to street level. Recentring without the
  // zoom just slid a country-wide view sideways, which doesn't answer the
  // question the user is asking when they tap it.
  const recenter = async ({ silent = false } = {}) => {
    if (locating) return;
    setLocating(true);
    try {
      const c = await LocationService.requestAndGet();
      if (c?.lat != null) {
        const here = { lat: c.lat, lng: c.lon };
        setMyLocation(here);
        setCenter(here);
        setCentredOnUser(true);
        // Nudge the zoom each time so a second tap still re-focuses even when
        // the centre hasn't changed (same object value = no easeTo otherwise).
        setFocusZoom((z) => (z === 16 ? 16.0001 : 16));
      } else if (!silent) {
        toast('Could not get your location. Check location permission.', 'error');
      }
    } catch {
      if (!silent) toast('Could not get your location.', 'error');
    } finally {
      setLocating(false);
    }
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

  // Stays via Resident Crew — pull accommodation around the map centre on demand.
  const toggleStays = async () => {
    const next = !showStays;
    setShowStays(next);
    // Always refetch for wherever the map is NOW. The old `stays.length === 0`
    // guard meant that once loaded, panning to another city and re-toggling
    // still showed the first city's listings.
    if (next) {
      const c = viewportRef.current?.center || centerRef.current;
      const rows = await Accommodation.near(c.lat, c.lng, { radiusM: 15000 });
      setStays(rows);
      if (rows.length === 0) toast('No Resident Crew stays near here yet.', 'info');
    }
  };
  const openStay = (id) => { const s = stays.find((x) => x.id === id); if (s) setActiveStay(s); };

  // ── Search + filters ───────────────────────────────────────────────────────
  // Geography is the expensive dimension, so that's filtered server-side by
  // bounding box. These three are instant and need no round trip, so they run
  // client-side over whatever's loaded.
  const categories = useMemo(() => {
    const seen = new Map();
    for (const e of events) {
      const c = (e.category || '').trim();
      if (c) seen.set(c, (seen.get(c) || 0) + 1);
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c]) => c);
  }, [events]);

  const visibleEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    const today = new Date().toISOString().split('T')[0];
    const weekOut = new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0];
    return events.filter((e) => {
      if (dateFilter === 'tonight' && e.event_date !== today) return false;
      if (dateFilter === 'week' && !(e.event_date >= today && e.event_date <= weekOut)) return false;
      if (catFilter.length && !catFilter.includes(e.category || '')) return false;
      if (q) {
        const hay = `${e.title || ''} ${e.venue_name || ''} ${e.city || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [events, query, dateFilter, catFilter]);

  const filtersOn = dateFilter !== 'all' || catFilter.length > 0 || !!query.trim();

  // Typing filters the pins instantly. Submitting when nothing matched treats
  // the text as a PLACE instead and moves the map there — the two things people
  // actually type into a map search box.
  const submitSearch = async () => {
    const q = query.trim();
    if (!q || visibleEvents.length > 0) return;
    try {
      const hit = await LocationService.geocode(q);
      if (hit?.lat != null) {
        setCenter({ lat: hit.lat, lng: hit.lon });
        setCentredOnUser(true);
        setFocusZoom((z) => (z === 13 ? 13.0001 : 13));
        toast('Moved there — tap "Search this area" to load events.', 'info');
      } else {
        toast('Nothing matched that name or place.', 'info');
      }
    } catch { toast('Could not look that place up.', 'error'); }
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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={[cs.title, { color: primary }]}>THE MAP</Text>
              <Text style={[cs.sub, { color: truncated ? '#f59e0b' : muted }]}>
                {loading ? 'Reading your city…'
                  : `${visibleEvents.length}${filtersOn ? ` of ${events.length}` : ''} event${visibleEvents.length === 1 ? '' : 's'}${truncated ? '+ (zoom in for all)' : ''}${activeClosures ? ` · ${activeClosures} live closure${activeClosures === 1 ? '' : 's'}` : ''}`}
              </Text>
            </View>
            {/* Refresh in place. "Search this area" only appears once you've
                MOVED, so without this there was no way to pull in events or
                closures posted since the map opened. */}
            <TouchableOpacity
              onPress={searchThisArea}
              disabled={searching || loading}
              style={[cs.headBtn, { borderColor: `${primary}40`, marginRight: 8, opacity: searching || loading ? 0.5 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel={searching ? 'Refreshing the map' : 'Refresh the map'}
            >
              {searching
                ? <ActivityIndicator size="small" color={primary} />
                : <Feather name="refresh-cw" size={16} color={primary} />}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setShowSearch((s) => !s); if (showSearch) setQuery(''); }}
              style={[cs.headBtn, { borderColor: `${primary}40`, backgroundColor: showSearch ? primary : 'transparent' }]}
              accessibilityRole="button"
              accessibilityLabel={showSearch ? 'Close search' : 'Search events and places'}
            >
              <Feather name={showSearch ? 'x' : 'search'} size={17} color={showSearch ? '#000' : primary} />
            </TouchableOpacity>
          </View>

          {/* Search + filters */}
          {showSearch && (
            <View style={{ gap: 8, marginTop: 8 }}>
              <View style={[cs.searchBox, { borderColor: `${primary}35` }]}>
                <Feather name="search" size={14} color={muted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={submitSearch}
                  returnKeyType="search"
                  placeholder="Event, venue, city or a place…"
                  placeholderTextColor={muted}
                  style={[cs.searchInput, { color: textColor }]}
                  accessibilityLabel="Search events, venues, or a place"
                />
                {!!query && (
                  <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="x-circle" size={15} color={muted} />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
                {[
                  { k: 'all', label: 'Any date' },
                  { k: 'tonight', label: 'Tonight' },
                  { k: 'week', label: 'This week' },
                ].map((d) => (
                  <Chip
                    key={d.k} label={d.label} active={dateFilter === d.k}
                    onPress={() => setDateFilter(d.k)} primary={primary} muted={muted}
                  />
                ))}
                {categories.map((c) => (
                  <Chip
                    key={c} label={c} active={catFilter.includes(c)}
                    onPress={() => setCatFilter((v) => (v.includes(c) ? v.filter((x) => x !== c) : [...v, c]))}
                    primary={primary} muted={muted}
                  />
                ))}
              </ScrollView>

              {filtersOn && (
                <TouchableOpacity
                  onPress={() => { setQuery(''); setDateFilter('all'); setCatFilter([]); }}
                  style={{ alignSelf: 'flex-start' }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear all filters"
                >
                  <Text style={{ color: primary, fontSize: 11, fontWeight: '800' }}>Clear filters</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* The map fills the rest */}
        <View style={{ flex: 1 }}>
          <ErrorBoundary label="Live map" inline primary={primary}>
            <LiveMap
              // Remount on style change: switching basemap via setStyle wipes
              // every custom source and layer, so a clean remount is both
              // simpler and safer than reinstalling them all by hand.
              key={styleKey}
              mapStyle={styleKey}
              onViewportChange={handleViewport}
              events={visibleEvents}
              zones={zones}
              center={center}
              autoFit={!centredOnUser}
              myLocation={myLocation}
              focusZoom={focusZoom}
              heat={heat}
              mine={myFog.points}
              showMine={showMine}
              crew={crewPlans}
              showCrew={showCrew}
              stays={stays}
              showStays={showStays}
              onStayPress={(id) => { setPreviewId(null); setActiveZone(null); openStay(id); }}
              drawMode={drawing ? mode : null}
              drawPoints={points}
              onMapClick={onMapClick}
              onEventPress={(id) => { setActiveZone(null); setActiveStay(null); setPreviewId(id); }}
              onZonePress={(id) => { const z = zones.find((x) => x.id === id); if (z) { setPreviewId(null); setActiveStay(null); setActiveZone(z); } }}
            />
          </ErrorBoundary>

          {/* "Search this area" — appears once the map has been moved far enough
              that the loaded data no longer covers what's on screen. */}
          {areaDirty && !drawing && !activeZone && !previewId && (
            <TouchableOpacity
              onPress={searchThisArea}
              disabled={searching}
              activeOpacity={0.85}
              style={[cs.areaBtn, { backgroundColor: primary, opacity: searching ? 0.7 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel="Search this area for events"
            >
              {searching
                ? <ActivityIndicator size="small" color="#000" />
                : <Feather name="refresh-cw" size={14} color="#000" />}
              <Text style={cs.areaBtnText}>{searching ? 'Searching…' : 'Search this area'}</Text>
            </TouchableOpacity>
          )}

          {/* Floating controls (only when the real map is up and not drawing) */}
          {isMapSupported() && !drawing && (
            <View style={cs.fabCol} pointerEvents="box-none">
              <TouchableOpacity
                onPress={() => {
                  // Changing style remounts the map, which would otherwise drop
                  // you back at the default zoom. Pin the CURRENT viewport into
                  // the props the fresh instance initialises from. Done here and
                  // not on every moveend on purpose: `center`/`focusZoom` drive
                  // an easeTo inside LiveMap, so writing them continuously would
                  // feed the map its own movement in a loop.
                  const vp = viewportRef.current;
                  if (vp?.center) {
                    setCenter(vp.center);
                    setCentredOnUser(true);            // don't let autoFit re-frame after the swap
                    if (Number.isFinite(vp.zoom)) setFocusZoom(vp.zoom);
                  }
                  const keys = Object.keys(MAP_STYLES);
                  setStyleKey((k) => keys[(keys.indexOf(k) + 1) % keys.length]);
                }}
                style={[cs.fab, { backgroundColor: bg, borderColor: `${primary}40` }]}
                accessibilityRole="button"
                accessibilityLabel={`Map style: ${MAP_STYLES[styleKey]?.label}. Tap to change.`}
              >
                <Feather name="layers" size={17} color={primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleMine} style={[cs.fab, { backgroundColor: showMine ? '#fbbf24' : bg, borderColor: showMine ? '#fbbf24' : `${primary}40` }]}>
                <Feather name="star" size={18} color={showMine ? '#000' : '#fbbf24'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleCrew} style={[cs.fab, { backgroundColor: showCrew ? '#ec4899' : bg, borderColor: showCrew ? '#ec4899' : `${primary}40` }]}>
                <Feather name="users" size={18} color={showCrew ? '#fff' : '#ec4899'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleStays} style={[cs.fab, { backgroundColor: showStays ? '#f59e0b' : bg, borderColor: showStays ? '#f59e0b' : `${primary}40` }]} accessibilityLabel="Places to stay from Resident Crew">
                <Feather name="home" size={17} color={showStays ? '#000' : '#f59e0b'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setHeat((h) => !h)} style={[cs.fab, { backgroundColor: heat ? primary : bg, borderColor: `${primary}40` }]}>
                <Feather name="activity" size={18} color={heat ? '#000' : primary} />
              </TouchableOpacity>
              {/* Take me to my location. Lights up once we actually have a fix,
                  so the control tells you whether the map knows where you are. */}
              <TouchableOpacity
                onPress={() => recenter()}
                disabled={locating}
                style={[cs.fab, {
                  backgroundColor: myLocation ? primary : bg,
                  borderColor: `${primary}40`,
                  opacity: locating ? 0.6 : 1,
                }]}
                accessibilityRole="button"
                accessibilityLabel={locating ? 'Finding your location' : 'Centre the map on my location'}
              >
                {locating
                  ? <ActivityIndicator size="small" color={myLocation ? '#000' : primary} />
                  : <Feather name="crosshair" size={18} color={myLocation ? '#000' : primary} />}
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
              <View style={cs.legendRow}><Feather name="bell" size={9} color="#eab308" /><Text style={cs.legendText}>Resident alert</Text></View>
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
            events={visibleEvents}
            startId={previewId}
            userCoords={center}
            zones={zones}
            onOpenEvent={(id) => { setPreviewId(null); onNavigateToEvent?.({ id }); }}
            onOpenZone={(z) => { setPreviewId(null); setActiveZone(z); }}
            onClose={() => setPreviewId(null)}
            onAuthRequired={onAuthRequired}
          />
        )}

        {/* Stay detail — accommodation from Resident Crew */}
        {activeStay && !drawing && (
          <StayDetail
            stay={activeStay} onClose={() => setActiveStay(null)}
            bg={bg} textColor={textColor} muted={muted}
          />
        )}

        {/* Concierge destinations */}
        <VibeRouletteModal
          visible={showRoulette} onClose={() => setShowRoulette(false)}
          events={visibleEvents} primary={primary}
          onSelectEvent={(e) => { setShowRoulette(false); if (e?.id) onNavigateToEvent?.({ id: e.id }); }}
        />
        <GetHomeSafeModal visible={showHomeSafe} onClose={() => setShowHomeSafe(false)} />
      </SafeAreaView>
    </ErrorBoundary>
  );
};

// ── Filter chip ───────────────────────────────────────────────────────────────
const Chip = ({ label, active, onPress, primary, muted }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[cs.chip, { borderColor: active ? primary : `${primary}30`, backgroundColor: active ? primary : 'transparent' }]}
    accessibilityRole="button"
    accessibilityState={{ selected: !!active }}
    accessibilityLabel={`Filter: ${label}`}
  >
    <Text style={[cs.chipText, { color: active ? '#000' : muted }]} numberOfLines={1}>{label}</Text>
  </TouchableOpacity>
);

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
            <Text style={{ color: muted, fontSize: 11 }}>
              {zone.source_app === 'resident' ? 'Community report · via The Resident' : meta.label} · clears in {endsLabel}
            </Text>
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
  headBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '600', padding: 0 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  areaBtn: {
    position: 'absolute', top: 12, alignSelf: 'center', flexDirection: 'row', alignItems: 'center',
    gap: 7, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  areaBtnText: { color: '#000', fontWeight: '900', fontSize: 12.5 },
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
