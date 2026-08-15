/**
 * LiveMap — the real street map (MapLibre GL + OpenFreeMap, free & keyless).
 *
 * Renders event pins and host-drawn impact zones (road closures / routes /
 * areas), and supports a draw mode so a host can trace a closure onto the real
 * road. Web-only: MapLibre is a browser library, so the require is guarded by
 * Platform.OS === 'web' (constant-folded out of the native bundle). On native
 * it degrades to a calm "open on web" note; callers still show the zone list.
 *
 * No API keys, no billing — OpenFreeMap serves OSM vector tiles for free.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ZONE_KINDS } from '../services/mapZones';

// Guarded so MapLibre (which touches window/document) never loads in the native
// bundle. Metro constant-folds Platform.OS per platform, so this require is
// dead-code-eliminated on native.
let maplibregl = null;
if (Platform.OS === 'web') {
  try { maplibregl = require('maplibre-gl').default || require('maplibre-gl'); } catch { maplibregl = null; }
}

// OpenFreeMap positron — a clean, free, keyless basemap. Neon pins/zones sit on
// top and read beautifully against it. (A custom dark style is a later polish.)
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
const DEFAULT_CENTER = { lng: 28.0473, lat: -26.2041 }; // Johannesburg

export function isMapSupported() {
  return Platform.OS === 'web' && !!maplibregl;
}

const eventsToGeoJSON = (events = []) => ({
  type: 'FeatureCollection',
  features: events
    .map((e) => {
      const lat = e.lat ?? e.latitude, lng = e.lon ?? e.longitude;
      if (lat == null || lng == null) return null;
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
        properties: {
          id: e.id, title: e.title || 'Event',
          here: Number(e.here_count || e.going || 0),
        },
      };
    })
    .filter(Boolean),
});

const zonesToGeoJSON = (zones = []) => ({
  type: 'FeatureCollection',
  features: zones
    .filter((z) => z.geometry)
    .map((z) => ({
      type: 'Feature',
      geometry: z.geometry,
      properties: {
        id: z.id, kind: z.kind, status: z.status,
        color: (ZONE_KINDS[z.kind] || {}).color || '#ef4444',
        dashed: z.status === 'declared' ? 1 : 0,
      },
    })),
});

export function LiveMap({
  events = [],
  zones = [],
  center = null,
  heat = false,           // show the presence-heat layer
  mine = [],              // [{lat,lng}] — your lit Touch Downs ("Fog of the City")
  showMine = false,
  crew = [],              // [{lat,lng,count}] — where your crew is heading tonight
  showCrew = false,
  stays = [],             // [{lat,lng,...}] — accommodation from Resident Crew
  showStays = false,
  onStayPress,            // (stayId) => void
  drawMode = null,        // null | 'line' | 'polygon'
  drawPoints = [],        // [[lng,lat], ...] controlled by parent
  onMapClick,             // (lngLat) => void  — used while drawing
  onEventPress,           // (eventId) => void
  onZonePress,            // (zoneId) => void
  onReady,
  autoFit = false,        // frame the events once, when the caller has no better centre
  style,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const readyRef = useRef(false);
  const heatRef = useRef(heat);
  const mineRef = useRef(showMine);
  const crewRef = useRef(showCrew);
  const staysRef = useRef(showStays);
  useEffect(() => { heatRef.current = heat; toggleHeat(heat); });
  useEffect(() => { mineRef.current = showMine; toggleMine(showMine); });
  useEffect(() => { crewRef.current = showCrew; toggleCrew(showCrew); });
  useEffect(() => { staysRef.current = showStays; toggleStays(showStays); });

  // ── init once ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isMapSupported() || !containerRef.current || mapRef.current) return;
    let map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: [center?.lng ?? DEFAULT_CENTER.lng, center?.lat ?? DEFAULT_CENTER.lat],
        zoom: 12,
        attributionControl: { compact: true },
      });
    } catch { return; }
    mapRef.current = map;

    map.on('load', () => {
      readyRef.current = true;
      // Zones: fill (for polygons) under lines (for closures/routes).
      map.addSource('zones', { type: 'geojson', data: zonesToGeoJSON(zones) });
      map.addLayer({
        id: 'zones-fill', type: 'fill', source: 'zones',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.18 },
      });
      map.addLayer({
        id: 'zones-line', type: 'line', source: 'zones',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 5,
          'line-opacity': 0.9,
          'line-dasharray': [2, 1.5],
        },
      });

      // Events: glowing dots sized by verified presence.
      map.addSource('events', { type: 'geojson', data: eventsToGeoJSON(events) });
      // Presence heat — where the crowd actually is (weighted by verified count).
      map.addLayer({
        id: 'events-heat', type: 'heatmap', source: 'events',
        layout: { visibility: heatRef.current ? 'visible' : 'none' },
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'here'], 0, 0.15, 50, 1],
          'heatmap-intensity': 1.1,
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 18, 15, 40],
          'heatmap-opacity': 0.75,
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,0,0)', 0.2, 'rgba(0,242,255,0.35)', 0.5, 'rgba(16,185,129,0.6)',
            0.8, 'rgba(245,158,11,0.8)', 1, 'rgba(239,68,68,0.9)'],
        },
      });
      map.addLayer({
        id: 'events-glow', type: 'circle', source: 'events',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'here'], 0, 9, 50, 22],
          'circle-color': '#00f2ff',
          'circle-opacity': 0.18,
          'circle-blur': 0.6,
        },
      });
      map.addLayer({
        id: 'events-dot', type: 'circle', source: 'events',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'here'], 0, 5, 50, 9],
          'circle-color': '#00f2ff',
          'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5,
        },
      });

      // Fog of the City — your lit Touch Downs (warm gold), your personal territory.
      map.addSource('mine', { type: 'geojson', data: pointsToGeoJSON(mine) });
      map.addLayer({
        id: 'mine-glow', type: 'circle', source: 'mine',
        layout: { visibility: mineRef.current ? 'visible' : 'none' },
        paint: { 'circle-radius': 16, 'circle-color': '#fbbf24', 'circle-opacity': 0.16, 'circle-blur': 0.7 },
      });
      map.addLayer({
        id: 'mine-dot', type: 'circle', source: 'mine',
        layout: { visibility: mineRef.current ? 'visible' : 'none' },
        paint: { 'circle-radius': 5, 'circle-color': '#fbbf24', 'circle-stroke-color': '#fff7ed', 'circle-stroke-width': 1.5 },
      });

      // Crew Convergence — where the people you follow are heading (magenta),
      // sized by how many of your crew are converging on each spot.
      map.addSource('crew', { type: 'geojson', data: crewToGeoJSON(crew) });
      map.addLayer({
        id: 'crew-ring', type: 'circle', source: 'crew',
        layout: { visibility: crewRef.current ? 'visible' : 'none' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 1, 12, 6, 30],
          'circle-color': '#ec4899', 'circle-opacity': 0.14, 'circle-blur': 0.5,
        },
      });
      map.addLayer({
        id: 'crew-dot', type: 'circle', source: 'crew',
        layout: { visibility: crewRef.current ? 'visible' : 'none' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 1, 6, 6, 12],
          'circle-color': '#ec4899', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5,
        },
      });
      map.addLayer({
        id: 'crew-count', type: 'symbol', source: 'crew',
        layout: { visibility: crewRef.current ? 'visible' : 'none',
          'text-field': ['to-string', ['get', 'count']], 'text-size': 11, 'text-allow-overlap': true },
        paint: { 'text-color': '#fff' },
      });

      // Stays — accommodation from Resident Crew (warm gold homes). A place to
      // crash near an out-of-town event, pulled live from the Resident listings.
      map.addSource('stays', { type: 'geojson', data: staysToGeoJSON(stays) });
      map.addLayer({
        id: 'stays-glow', type: 'circle', source: 'stays',
        layout: { visibility: staysRef.current ? 'visible' : 'none' },
        paint: { 'circle-radius': 15, 'circle-color': '#f59e0b', 'circle-opacity': 0.14, 'circle-blur': 0.6 },
      });
      map.addLayer({
        id: 'stays-dot', type: 'circle', source: 'stays',
        layout: { visibility: staysRef.current ? 'visible' : 'none' },
        paint: { 'circle-radius': 8, 'circle-color': '#f59e0b', 'circle-stroke-color': '#1a1205', 'circle-stroke-width': 2 },
      });
      map.addLayer({
        id: 'stays-icon', type: 'symbol', source: 'stays',
        layout: { visibility: staysRef.current ? 'visible' : 'none',
          'text-field': '🛏', 'text-size': 11, 'text-allow-overlap': true },
      });

      // In-progress draw geometry.
      map.addSource('draw', { type: 'geojson', data: emptyFC() });
      map.addLayer({
        id: 'draw-line', type: 'line', source: 'draw',
        paint: { 'line-color': '#ff2d55', 'line-width': 4, 'line-dasharray': [1, 1] },
      });
      map.addLayer({
        id: 'draw-verts', type: 'circle', source: 'draw',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: { 'circle-radius': 5, 'circle-color': '#ff2d55', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 },
      });

      // Every source above was seeded from the MOUNT-time props. Anything that
      // arrived while the style was still downloading was buffered by setData()
      // rather than applied, so replay it now that the sources exist. Without
      // this the map renders an empty layer set whenever the data beats the
      // style — which is most loads.
      flushPending(map);
      // …and if the data beat the style, frame it now that we can.
      maybeAutoFit(map);

      // Taps: draw takes priority; else pin hit-test.
      map.on('click', (ev) => {
        if (drawModeRef.current) { onClickRef.current?.([ev.lngLat.lng, ev.lngLat.lat]); return; }
        const hit = map.queryRenderedFeatures(ev.point, { layers: ['events-dot', 'events-glow'] });
        if (hit && hit[0]) { onEventRef.current?.(hit[0].properties.id); return; }
        const stay = map.queryRenderedFeatures(ev.point, { layers: ['stays-dot', 'stays-icon'] });
        if (stay && stay[0]) { onStayRef.current?.(stay[0].properties.id); return; }
        const z = map.queryRenderedFeatures(ev.point, { layers: ['zones-line', 'zones-fill'] });
        if (z && z[0]) onZoneRef.current?.(z[0].properties.id);
      });
      map.getCanvas().style.cursor = '';
      onReady?.();
    });

    return () => { try { map.remove(); } catch {} mapRef.current = null; readyRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the latest callbacks/mode in refs so the single 'click' handler sees them.
  const drawModeRef = useRef(drawMode); const onClickRef = useRef(onMapClick);
  const onEventRef = useRef(onEventPress); const onZoneRef = useRef(onZonePress);
  const onStayRef = useRef(onStayPress);
  useEffect(() => { drawModeRef.current = drawMode; onClickRef.current = onMapClick;
    onEventRef.current = onEventPress; onZoneRef.current = onZonePress; onStayRef.current = onStayPress; });

  // ── update sources on data change ───────────────────────────────────────────
  useEffect(() => { setData('events', eventsToGeoJSON(events)); }, [events]);
  useEffect(() => { setData('zones', zonesToGeoJSON(zones)); }, [zones]);
  useEffect(() => { setData('draw', drawGeoJSON(drawMode, drawPoints)); }, [drawMode, drawPoints]);
  useEffect(() => { setData('mine', pointsToGeoJSON(mine)); }, [mine]);
  useEffect(() => { setData('crew', crewToGeoJSON(crew)); }, [crew]);
  useEffect(() => { setData('stays', staysToGeoJSON(stays)); }, [stays]);
  useEffect(() => {
    const m = mapRef.current;
    if (m && readyRef.current && center) m.easeTo({ center: [center.lng, center.lat], duration: 700 });
  }, [center]);

  // Latest GeoJSON per source id, kept even while the style is still loading.
  //
  // THE BUG THIS FIXES: setData() bails when `readyRef` is false, and the init
  // effect runs once with deps [] — so it seeds sources from the MOUNT-time
  // props, which are empty. If the Supabase query resolves BEFORE MapLibre
  // finishes downloading its style (the common case — a warm query beats a
  // network style fetch), the [events] effect fires while readyRef is still
  // false, setData drops the payload, and the effect never re-runs because
  // `events` never changes again. Result: 61 events in state, zero on the map,
  // permanently. Buffering the last value and flushing it on 'load' closes the
  // race for events, zones, draw, mine, crew and stays alike.
  const pendingRef = useRef({});

  function flushPending(map) {
    for (const [id, data] of Object.entries(pendingRef.current)) {
      try {
        const src = map.getSource(id);
        if (src) src.setData(data);
      } catch { /* source not on this style — ignore */ }
    }
  }

  // ── Opening view ──────────────────────────────────────────────────────────
  // The map used to open on a hardcoded Johannesburg centre at zoom 12 no matter
  // where the data (or the user) was. With events spread from the Western Cape
  // to Limpopo — median ~23km from that centre — only a handful ever landed in
  // the first viewport, so a working map still looked empty. When the caller
  // hasn't centred it on the user, frame the actual pins instead. Once only:
  // re-fitting on every refresh would yank the map out from under someone who
  // has panned away.
  const didFitRef = useRef(false);

  function fitToFeatures(map, fc) {
    const feats = fc?.features || [];
    if (!feats.length) return false;

    const lngs = [], lats = [];
    for (const f of feats) {
      const [lng, lat] = f.geometry?.coordinates || [];
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      lngs.push(lng); lats.push(lat);
    }
    if (!lngs.length) return false;
    lngs.sort((a, b) => a - b); lats.sort((a, b) => a - b);

    // Frame the BULK, not the extremes. Fitting the full bounding box lets a
    // single event in another province drag the view out to national scale and
    // park the centre on empty countryside — technically "all pins visible",
    // useless in practice. The 10th–90th percentile box frames where the events
    // actually are; the outliers stay one pan away. Below ~12 points there
    // aren't enough to call anything an outlier, so use the full extent.
    const q = (arr, p) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(arr.length * p)))];
    const trim = lngs.length >= 12;
    const minLng = trim ? q(lngs, 0.10) : lngs[0];
    const maxLng = trim ? q(lngs, 0.90) : lngs[lngs.length - 1];
    const minLat = trim ? q(lats, 0.10) : lats[0];
    const maxLat = trim ? q(lats, 0.90) : lats[lats.length - 1];
    if (!Number.isFinite(minLng) || !Number.isFinite(minLat)) return false;
    try {
      // A single pin (or several at one venue) gives a zero-area box, which
      // fitBounds would zoom to absurd depth — centre it at a readable zoom.
      if (maxLng - minLng < 1e-6 && maxLat - minLat < 1e-6) {
        map.easeTo({ center: [minLng, minLat], zoom: 14, duration: 600 });
      } else {
        map.fitBounds([[minLng, minLat], [maxLng, maxLat]], {
          padding: 64,
          maxZoom: 13,   // never punch past neighbourhood level on an auto-fit
          duration: 600,
        });
      }
      return true;
    } catch { return false; }
  }

  function maybeAutoFit(map) {
    if (!autoFit || didFitRef.current) return;
    if (fitToFeatures(map, pendingRef.current.events)) didFitRef.current = true;
  }

  function setData(id, data) {
    pendingRef.current[id] = data; // record first, so a pre-ready write survives
    const m = mapRef.current;
    if (!m || !readyRef.current) return;
    const src = m.getSource(id);
    if (src) src.setData(data);
    // Events usually arrive after the style is ready, so this — not the load
    // handler — is where the first fit normally happens.
    if (id === 'events') maybeAutoFit(m);
  }

  function toggleHeat(on) {
    const m = mapRef.current;
    if (!m || !readyRef.current || !m.getLayer('events-heat')) return;
    try { m.setLayoutProperty('events-heat', 'visibility', on ? 'visible' : 'none'); } catch {}
  }

  function toggleMine(on) {
    const m = mapRef.current;
    if (!m || !readyRef.current) return;
    for (const id of ['mine-glow', 'mine-dot']) {
      if (m.getLayer(id)) try { m.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); } catch {}
    }
  }

  function toggleCrew(on) {
    const m = mapRef.current;
    if (!m || !readyRef.current) return;
    for (const id of ['crew-ring', 'crew-dot', 'crew-count']) {
      if (m.getLayer(id)) try { m.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); } catch {}
    }
  }

  function toggleStays(on) {
    const m = mapRef.current;
    if (!m || !readyRef.current) return;
    for (const id of ['stays-glow', 'stays-dot', 'stays-icon']) {
      if (m.getLayer(id)) try { m.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); } catch {}
    }
  }

  if (!isMapSupported()) {
    return (
      <View style={[cs.fallback, style]}>
        <Feather name="map" size={40} color="rgba(255,255,255,0.4)" />
        <Text style={cs.fallbackText}>The live map runs in the browser for now.</Text>
        <Text style={cs.fallbackSub}>Open The Gruvs on the web to see your city's map.</Text>
      </View>
    );
  }

  // Web: a real DOM node for MapLibre. react-native-web renders 'div' to the DOM.
  return React.createElement('div', {
    ref: containerRef,
    style: { position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#0d1112' },
  });
}

const emptyFC = () => ({ type: 'FeatureCollection', features: [] });

// Plain lat/lng points (Fog of the City — your lit Touch Downs).
function pointsToGeoJSON(pts) {
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

// Stays — accommodation pins (Resident Crew), each carrying its id for tap-open.
function staysToGeoJSON(stays) {
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

// Crew Convergence — one pin per event, carrying how many of your crew are going.
function crewToGeoJSON(crew) {
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

function drawGeoJSON(mode, pts) {
  if (!mode || !pts || pts.length === 0) return emptyFC();
  const features = pts.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: {} }));
  if (pts.length >= 2) {
    if (mode === 'polygon') {
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [...pts, pts[0]] }, properties: {} });
    } else {
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: pts }, properties: {} });
    }
  }
  return { type: 'FeatureCollection', features };
}

// Build the final GeoJSON geometry for submission.
export function buildGeometry(mode, pts) {
  if (!pts || pts.length < 2) return null;
  if (mode === 'polygon') {
    if (pts.length < 3) return null;
    return { type: 'Polygon', coordinates: [[...pts, pts[0]]] };
  }
  return { type: 'LineString', coordinates: pts };
}

const cs = StyleSheet.create({
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 30, backgroundColor: '#0d1112' },
  fallbackText: { color: '#fff', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  fallbackSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center' },
});
