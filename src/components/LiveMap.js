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
import React, { useEffect, useRef, useState } from 'react';
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

// OpenFreeMap basemaps — free, keyless, no billing account. All four verified
// live. `dark` is the default: this is a nightlife map, usually opened at night
// in a dim venue, and a white basemap is a flashbang in that context. The neon
// pins also read far better against dark.
export const MAP_STYLES = {
  dark:     { id: 'dark',     label: 'Night',   url: 'https://tiles.openfreemap.org/styles/dark' },
  positron: { id: 'positron', label: 'Light',   url: 'https://tiles.openfreemap.org/styles/positron' },
  liberty:  { id: 'liberty',  label: 'Detail',  url: 'https://tiles.openfreemap.org/styles/liberty' },
};
export const DEFAULT_MAP_STYLE = 'dark';
const styleUrl = (k) => (MAP_STYLES[k] || MAP_STYLES[DEFAULT_MAP_STYLE]).url;
const DEFAULT_CENTER = { lng: 28.0473, lat: -26.2041 }; // Johannesburg

// Clustering. Without it a dense city collapses into a single unreadable blob of
// overlapping pins and a tap hits whichever happens to be on top.
const CLUSTER_RADIUS = 45;
const CLUSTER_MAX_ZOOM = 14;   // past this, always show individual pins

// Native counterpart. Same engine, same style, same GeoJSON — a declarative
// React binding instead of the imperative web one. Guarded the same way as the
// web require above: Metro constant-folds Platform.OS, so this is dead-code
// eliminated from the web bundle and the native module never reaches it.
let MapLibreRN = null;
if (Platform.OS !== 'web') {
  try { MapLibreRN = require('@maplibre/maplibre-react-native'); } catch { MapLibreRN = null; }
}

export function isMapSupported() {
  if (Platform.OS === 'web') return !!maplibregl;
  return !!MapLibreRN;
}

// ── Layer styling, shared by BOTH platforms ────────────────────────────────
// MapLibre GL JS and MapLibre React Native both consume the MapLibre style
// spec, so one definition drives web and native. Kept here rather than inlined
// twice: two copies of these numbers would drift the moment either side is
// tweaked, and the map would quietly stop looking like itself on one platform.
const L_ZONES_FILL   = { 'fill-color': ['get', 'color'], 'fill-opacity': 0.18 };
const L_ZONES_LINE   = { 'line-color': ['get', 'color'], 'line-width': 5, 'line-opacity': 0.9, 'line-dasharray': [2, 1.5] };
const L_EVENTS_HEAT  = {
  'heatmap-weight': ['interpolate', ['linear'], ['get', 'here'], 0, 0.15, 50, 1],
  'heatmap-intensity': 1.1,
  'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 18, 15, 40],
  'heatmap-opacity': 0.75,
  'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
    0, 'rgba(0,0,0,0)', 0.2, 'rgba(0,242,255,0.35)', 0.5, 'rgba(16,185,129,0.6)',
    0.8, 'rgba(245,158,11,0.8)', 1, 'rgba(239,68,68,0.9)'],
};
const L_EVENTS_GLOW  = {
  'circle-radius': ['interpolate', ['linear'], ['get', 'here'], 0, 9, 50, 22],
  'circle-color': '#00f2ff', 'circle-opacity': 0.18, 'circle-blur': 0.6,
};
const L_EVENTS_DOT   = {
  'circle-radius': ['interpolate', ['linear'], ['get', 'here'], 0, 5, 50, 9],
  'circle-color': '#00f2ff', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5,
};
// Clusters: one puck standing in for N events, growing with the count.
const L_EVENTS_CLUSTER = {
  'circle-radius': ['interpolate', ['linear'], ['get', 'point_count'], 2, 15, 25, 26, 100, 36],
  'circle-color': '#00f2ff', 'circle-opacity': 0.85,
  'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2,
};
const L_EVENTS_CLUSTER_COUNT = {
  'text-field': ['to-string', ['get', 'point_count_abbreviated']],
  'text-size': 12, 'text-allow-overlap': true,
};
const L_MINE_GLOW    = { 'circle-radius': 16, 'circle-color': '#fbbf24', 'circle-opacity': 0.16, 'circle-blur': 0.7 };
const L_MINE_DOT     = { 'circle-radius': 5, 'circle-color': '#fbbf24', 'circle-stroke-color': '#fff7ed', 'circle-stroke-width': 1.5 };
const L_CREW_RING    = { 'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 1, 12, 6, 30], 'circle-color': '#ec4899', 'circle-opacity': 0.14, 'circle-blur': 0.5 };
const L_CREW_DOT     = { 'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 1, 6, 6, 12], 'circle-color': '#ec4899', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 };
const L_STAYS_GLOW   = { 'circle-radius': 15, 'circle-color': '#f59e0b', 'circle-opacity': 0.14, 'circle-blur': 0.6 };
const L_STAYS_DOT    = { 'circle-radius': 8, 'circle-color': '#f59e0b', 'circle-stroke-color': '#1a1205', 'circle-stroke-width': 2 };
// "You are here" — the blue dot. Deliberately NOT the app's neon cyan: cyan is
// the event pin colour, and the one marker that must never be mistaken for a
// pin is the one showing where the user is standing. Solid fill + a thick white
// ring is the universally-read "me" marker (Google/Apple both use it), so it
// stays legible against the light basemap and against every other layer here
// (gold Touch Downs, magenta crew, amber stays, red closures).
const L_ME_HALO      = { 'circle-radius': 24, 'circle-color': '#4285F4', 'circle-opacity': 0.18, 'circle-blur': 0.45 };
const L_ME_DOT       = { 'circle-radius': 8, 'circle-color': '#4285F4', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 };
const L_DRAW_LINE    = { 'line-color': '#ff2d55', 'line-width': 4, 'line-dasharray': [1, 1] };
const L_DRAW_VERTS   = { 'circle-radius': 5, 'circle-color': '#ff2d55', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 };

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
  myLocation = null,      // {lat,lng} — "you are here" blue dot
  focusZoom = null,       // when set, a `center` change also eases to this zoom
  mapStyle = DEFAULT_MAP_STYLE,   // key into MAP_STYLES
  cluster = true,         // group overlapping pins (tap a cluster to zoom in)
  onViewportChange,       // ({ bounds:{minLat,maxLat,minLng,maxLng}, center, zoom }) => void
  style,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const readyRef = useRef(false);
  const heatRef = useRef(heat);
  const mineRef = useRef(showMine);
  const crewRef = useRef(showCrew);
  const staysRef = useRef(showStays);
  // Read once at init. Switching basemap style remounts the whole component
  // (LiveMap is keyed on it by the caller) rather than calling setStyle, which
  // would wipe every custom source and layer and need them all re-installed.
  const mapStyleRef = useRef(mapStyle);
  const clusterRef = useRef(cluster);
  // Latest viewport callback, so the map's own listener never goes stale.
  const onViewportRef = useRef(onViewportChange);
  useEffect(() => { onViewportRef.current = onViewportChange; });
  // Native-only: last known zoom (from onRegionDidChange) and a camera override
  // used to expand a tapped cluster. Declared here because hooks must run before
  // the platform branches below return.
  const nativeZoomRef = useRef(null);
  const [nativeCam, setNativeCam] = useState(null); // {center:[lng,lat], zoom}
  useEffect(() => { heatRef.current = heat; toggleHeat(heat); });
  useEffect(() => { mineRef.current = showMine; toggleMine(showMine); });
  useEffect(() => { crewRef.current = showCrew; toggleCrew(showCrew); });
  useEffect(() => { staysRef.current = showStays; toggleStays(showStays); });

  // ── init once ─────────────────────────────────────────────────────────────
  useEffect(() => {
    // Web only. Everything below this line is the imperative maplibre-gl API;
    // native renders declaratively at the bottom of this component and shares
    // nothing but the style constants and the GeoJSON builders.
    if (Platform.OS !== 'web') return;
    if (!isMapSupported() || !containerRef.current || mapRef.current) return;
    let map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: styleUrl(mapStyleRef.current),
        center: [center?.lng ?? DEFAULT_CENTER.lng, center?.lat ?? DEFAULT_CENTER.lat],
        zoom: 12,
        attributionControl: { compact: true },
      });
    } catch { return; }
    mapRef.current = map;

    // Zoom buttons + compass. Pinch-only excluded one-handed use entirely, and
    // there was no way back to north once the map had been rotated.
    try {
      map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: false }), 'top-right');
      map.addControl(new maplibregl.ScaleControl({ maxWidth: 90, unit: 'metric' }), 'bottom-left');
    } catch { /* controls are polish — never let one break the map */ }

    // Tell the parent what the user is actually looking at. Without this the
    // app had no idea the map had moved, so nothing could ever reload for the
    // new area — the whole map was a fixed snapshot of wherever it opened.
    const emitViewport = () => {
      if (!onViewportRef.current) return;
      try {
        const b = map.getBounds();
        const c = map.getCenter();
        onViewportRef.current({
          bounds: { minLng: b.getWest(), minLat: b.getSouth(), maxLng: b.getEast(), maxLat: b.getNorth() },
          center: { lat: c.lat, lng: c.lng },
          zoom: map.getZoom(),
        });
      } catch { /* getBounds throws pre-style-load */ }
    };
    map.on('moveend', emitViewport);
    map.on('zoomend', emitViewport);

    map.on('load', () => {
      readyRef.current = true;
      // Zones: fill (for polygons) under lines (for closures/routes).
      map.addSource('zones', { type: 'geojson', data: zonesToGeoJSON(zones) });
      map.addLayer({
        id: 'zones-fill', type: 'fill', source: 'zones',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: L_ZONES_FILL,
      });
      map.addLayer({
        id: 'zones-line', type: 'line', source: 'zones',
        paint: L_ZONES_LINE,
      });

      // Events: glowing dots sized by verified presence, grouped into clusters
      // while zoomed out. `clusterProperties` sums each cluster's `here` count
      // so the heat layer keeps working on clustered and single points alike.
      map.addSource('events', {
        type: 'geojson',
        data: eventsToGeoJSON(events),
        cluster: clusterRef.current,
        clusterRadius: CLUSTER_RADIUS,
        clusterMaxZoom: CLUSTER_MAX_ZOOM,
        clusterProperties: { here: ['+', ['get', 'here']] },
      });
      // Presence heat — where the crowd actually is (weighted by verified count).
      map.addLayer({
        id: 'events-heat', type: 'heatmap', source: 'events',
        layout: { visibility: heatRef.current ? 'visible' : 'none' },
        paint: L_EVENTS_HEAT,
      });
      // Single pins only — clusters get their own puck below.
      const SINGLE = ['!', ['has', 'point_count']];
      map.addLayer({
        id: 'events-glow', type: 'circle', source: 'events',
        filter: SINGLE, paint: L_EVENTS_GLOW,
      });
      map.addLayer({
        id: 'events-dot', type: 'circle', source: 'events',
        filter: SINGLE, paint: L_EVENTS_DOT,
      });
      map.addLayer({
        id: 'events-cluster', type: 'circle', source: 'events',
        filter: ['has', 'point_count'], paint: L_EVENTS_CLUSTER,
      });
      map.addLayer({
        id: 'events-cluster-count', type: 'symbol', source: 'events',
        filter: ['has', 'point_count'],
        layout: L_EVENTS_CLUSTER_COUNT,
        paint: { 'text-color': '#00232b' },
      });

      // Fog of the City — your lit Touch Downs (warm gold), your personal territory.
      map.addSource('mine', { type: 'geojson', data: pointsToGeoJSON(mine) });
      map.addLayer({
        id: 'mine-glow', type: 'circle', source: 'mine',
        layout: { visibility: mineRef.current ? 'visible' : 'none' },
        paint: L_MINE_GLOW,
      });
      map.addLayer({
        id: 'mine-dot', type: 'circle', source: 'mine',
        layout: { visibility: mineRef.current ? 'visible' : 'none' },
        paint: L_MINE_DOT,
      });

      // Crew Convergence — where the people you follow are heading (magenta),
      // sized by how many of your crew are converging on each spot.
      map.addSource('crew', { type: 'geojson', data: crewToGeoJSON(crew) });
      map.addLayer({
        id: 'crew-ring', type: 'circle', source: 'crew',
        layout: { visibility: crewRef.current ? 'visible' : 'none' },
        paint: L_CREW_RING,
      });
      map.addLayer({
        id: 'crew-dot', type: 'circle', source: 'crew',
        layout: { visibility: crewRef.current ? 'visible' : 'none' },
        paint: L_CREW_DOT,
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
        paint: L_STAYS_GLOW,
      });
      map.addLayer({
        id: 'stays-dot', type: 'circle', source: 'stays',
        layout: { visibility: staysRef.current ? 'visible' : 'none' },
        paint: L_STAYS_DOT,
      });
      map.addLayer({
        id: 'stays-icon', type: 'symbol', source: 'stays',
        layout: { visibility: staysRef.current ? 'visible' : 'none',
          'text-field': '🛏', 'text-size': 11, 'text-allow-overlap': true },
      });

      // "You are here". Added LAST so the blue dot sits on top of every other
      // layer — it is the one marker the user must always be able to find.
      map.addSource('me', { type: 'geojson', data: pointsToGeoJSON(myLocation ? [myLocation] : []) });
      map.addLayer({ id: 'me-halo', type: 'circle', source: 'me', paint: L_ME_HALO });
      map.addLayer({ id: 'me-dot', type: 'circle', source: 'me', paint: L_ME_DOT });

      // In-progress draw geometry.
      map.addSource('draw', { type: 'geojson', data: emptyFC() });
      map.addLayer({
        id: 'draw-line', type: 'line', source: 'draw',
        paint: L_DRAW_LINE,
      });
      map.addLayer({
        id: 'draw-verts', type: 'circle', source: 'draw',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: L_DRAW_VERTS,
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
        // A cluster is not a pin — tapping it means "show me what's in here",
        // so expand to the zoom where it breaks apart.
        const cl = map.queryRenderedFeatures(ev.point, { layers: ['events-cluster', 'events-cluster-count'] });
        if (cl && cl[0]) {
          const src = map.getSource('events');
          const cid = cl[0].properties.cluster_id;
          try {
            src.getClusterExpansionZoom(cid).then((z) => {
              map.easeTo({ center: cl[0].geometry.coordinates, zoom: z, duration: 500 });
            }).catch(() => {});
          } catch {
            // older signature: callback form
            try { src.getClusterExpansionZoom(cid, (e, z) => { if (!e) map.easeTo({ center: cl[0].geometry.coordinates, zoom: z, duration: 500 }); }); } catch {}
          }
          return;
        }
        const hit = map.queryRenderedFeatures(ev.point, { layers: ['events-dot', 'events-glow'] });
        if (hit && hit[0]) { onEventRef.current?.(hit[0].properties.id); return; }
        const stay = map.queryRenderedFeatures(ev.point, { layers: ['stays-dot', 'stays-icon'] });
        if (stay && stay[0]) { onStayRef.current?.(stay[0].properties.id); return; }
        const z = map.queryRenderedFeatures(ev.point, { layers: ['zones-line', 'zones-fill'] });
        if (z && z[0]) onZoneRef.current?.(z[0].properties.id);
      });
      map.getCanvas().style.cursor = '';
      // First report — the caller needs a viewport before the user touches
      // anything, otherwise the initial load has no area to query.
      emitViewport();
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
  useEffect(() => { setData('me', pointsToGeoJSON(myLocation ? [myLocation] : [])); }, [myLocation]);
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !readyRef.current || !center) return;
    // focusZoom lets "take me to my location" actually zoom IN, the way Google
    // Maps does. Without it, recentring on a country-level view just slid the
    // same useless zoom sideways and the user still couldn't see their street.
    const opts = { center: [center.lng, center.lat], duration: 700 };
    if (focusZoom != null) opts.zoom = focusZoom;
    m.easeTo(opts);
  }, [center, focusZoom]);

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

  // ── NATIVE ────────────────────────────────────────────────────────────────
  // Same MapLibre engine, same OpenFreeMap style, same GeoJSON and the same
  // layer constants as web — expressed declaratively instead of imperatively.
  // Keyless by design: react-native-maps would have needed a Google Maps API
  // key on a billing-enabled account, which this project deliberately avoids.
  if (Platform.OS !== 'web' && MapLibreRN) {
    // v10 API (MapView/ShapeSource/typed layers), NOT v11's Map/GeoJSONSource/
    // generic Layer. Pinned to 10.x deliberately: v11's Expo config plugin
    // imports `CodeGenerator` from @expo/config-plugins, which does not exist in
    // the 9.x that Expo SDK 52 ships — registering it crashes `expo start`
    // outright, taking the WEB dev server down with it. v10 declares
    // @expo/config-plugins ">=7" and works. Revisit on the next SDK upgrade.
    const { MapView, Camera, ShapeSource, CircleLayer, HeatmapLayer, FillLayer, LineLayer } = MapLibreRN;
    const featureId = (e) => e?.features?.[0]?.properties?.id;

    // Frame the pins when the caller has no better centre, mirroring the web
    // auto-fit. Deliberately a centroid + fixed zoom rather than Camera bounds:
    // the bounds option shape is untested on this device path, and a wrong
    // guess would land the user somewhere arbitrary. Centroid is predictable.
    const pts = eventsToGeoJSON(events).features.map(f => f.geometry.coordinates);
    const centroid = (autoFit && pts.length)
      ? [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length]
      : null;
    const camCenter = center ? [center.lng, center.lat] : (centroid || [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat]);

    return (
      <MapView
        style={[{ flex: 1 }, style]}
        mapStyle={styleUrl(mapStyle)}
        onPress={(e) => {
          if (drawMode && e?.geometry?.coordinates) onMapClick?.(e.geometry.coordinates);
        }}
        onRegionDidChange={(f) => {
          // Native's counterpart to web's moveend — same contract, so the
          // caller's "reload for this area" logic is platform-agnostic.
          if (!onViewportChange) return;
          const vp = parseNativeRegion(f);
          if (!vp) {
            // A swallowed failure here reintroduces exactly the bug this whole
            // feature exists to kill: the map silently stops reloading and
            // looks merely "empty". Say so loudly, once, so it surfaces in
            // client_errors instead of dying quietly on a device we can't test.
            warnOnce('native-region-shape',
              '[LiveMap] onRegionDidChange payload not understood — the map will NOT reload on pan. ' +
              'Check @maplibre/maplibre-react-native region event shape. Got keys: ' +
              JSON.stringify({ props: Object.keys(f?.properties || {}), geom: f?.geometry?.type }));
            return;
          }
          nativeZoomRef.current = vp.zoom ?? nativeZoomRef.current;
          onViewportChange(vp);
        }}
      >
        <Camera
          centerCoordinate={nativeCam?.center || camCenter}
          zoomLevel={nativeCam?.zoom ?? (focusZoom != null ? focusZoom : (centroid ? 9 : 12))}
          animationDuration={nativeCam ? 400 : 600}
        />

        <ShapeSource id="zones" shape={zonesToGeoJSON(zones)} onPress={(e) => onZonePress?.(featureId(e))}>
          <FillLayer id="zones-fill" filter={['==', ['geometry-type'], 'Polygon']} style={L_ZONES_FILL} />
          <LineLayer id="zones-line" style={L_ZONES_LINE} />
        </ShapeSource>

        <ShapeSource
          id="events"
          shape={eventsToGeoJSON(events)}
          cluster={cluster}
          clusterRadius={CLUSTER_RADIUS}
          clusterMaxZoomLevel={CLUSTER_MAX_ZOOM}
          onPress={(e) => {
            const feat = e?.features?.[0];
            const id = feat?.properties?.id;
            if (id) { onEventPress?.(id); return; }
            // A cluster (no id, has point_count). Web asks the source for the
            // exact expansion zoom; that API's shape is unverified on native, so
            // step in by a fixed amount instead — predictable, and a tap that
            // zooms is far better than the tap doing nothing at all.
            if (feat?.properties?.point_count) {
              const coords = feat.geometry?.coordinates;
              const base = nativeZoomRef.current ?? 10;
              if (Array.isArray(coords)) {
                setNativeCam({ center: coords, zoom: Math.min(base + 2, CLUSTER_MAX_ZOOM + 1) });
              }
            }
          }}
        >
          {heat ? <HeatmapLayer id="events-heat" style={L_EVENTS_HEAT} /> : null}
          <CircleLayer id="events-glow" filter={['!', ['has', 'point_count']]} style={L_EVENTS_GLOW} />
          <CircleLayer id="events-dot" filter={['!', ['has', 'point_count']]} style={L_EVENTS_DOT} />
          <CircleLayer id="events-cluster" filter={['has', 'point_count']} style={L_EVENTS_CLUSTER} />
        </ShapeSource>

        {showMine ? (
          <ShapeSource id="mine" shape={pointsToGeoJSON(mine)}>
            <CircleLayer id="mine-glow" style={L_MINE_GLOW} />
            <CircleLayer id="mine-dot" style={L_MINE_DOT} />
          </ShapeSource>
        ) : null}

        {showCrew ? (
          <ShapeSource id="crew" shape={crewToGeoJSON(crew)}>
            <CircleLayer id="crew-ring" style={L_CREW_RING} />
            <CircleLayer id="crew-dot" style={L_CREW_DOT} />
          </ShapeSource>
        ) : null}

        {showStays ? (
          <ShapeSource id="stays" shape={staysToGeoJSON(stays)} onPress={(e) => onStayPress?.(featureId(e))}>
            <CircleLayer id="stays-glow" style={L_STAYS_GLOW} />
            <CircleLayer id="stays-dot" style={L_STAYS_DOT} />
          </ShapeSource>
        ) : null}

        {drawMode ? (
          <ShapeSource id="draw" shape={drawGeoJSON(drawMode, drawPoints)}>
            <LineLayer id="draw-line" style={L_DRAW_LINE} />
            <CircleLayer id="draw-verts" filter={['==', ['geometry-type'], 'Point']} style={L_DRAW_VERTS} />
          </ShapeSource>
        ) : null}

        {/* "You are here" — last, so the blue dot draws on top of everything. */}
        {myLocation ? (
          <ShapeSource id="me" shape={pointsToGeoJSON([myLocation])}>
            <CircleLayer id="me-halo" style={L_ME_HALO} />
            <CircleLayer id="me-dot" style={L_ME_DOT} />
          </ShapeSource>
        ) : null}
      </MapView>
    );
  }

  // Neither engine available (native module missing from this build).
  if (!isMapSupported()) {
    return (
      <View style={[cs.fallback, style]}>
        <Feather name="map" size={40} color="rgba(255,255,255,0.4)" />
        <Text style={cs.fallbackText}>The live map needs a newer build of the app.</Text>
        <Text style={cs.fallbackSub}>Update The Gruvs, or open it on the web.</Text>
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

// One console.error per distinct problem — enough to reach client_errors via
// the global handler without spamming it on every gesture.
const _warned = new Set();
function warnOnce(key, msg) {
  if (_warned.has(key)) return;
  _warned.add(key);
  // eslint-disable-next-line no-console
  console.error(msg);
}

/**
 * Normalise MapLibre RN's region-change payload into the same shape web emits.
 *
 * The payload differs across versions — visibleBounds has appeared as
 * [[east,north],[west,south]] and as [[west,south],[east,north]], and the zoom
 * key has been both `zoomLevel` and `zoom`. Rather than assume one, take the
 * min/max of whatever pair arrives (order-independent) and accept either zoom
 * key. Returns null if the shape is genuinely unusable, so the caller can
 * report it instead of silently never reloading.
 */
export function parseNativeRegion(f) {
  const props = f?.properties || {};
  const vb = props.visibleBounds;
  const c = f?.geometry?.coordinates;
  if (!Array.isArray(vb) || vb.length < 2) return null;
  const [a, b] = vb;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length < 2 || b.length < 2) return null;
  const lngs = [Number(a[0]), Number(b[0])];
  const lats = [Number(a[1]), Number(b[1])];
  if (lngs.some((n) => !Number.isFinite(n)) || lats.some((n) => !Number.isFinite(n))) return null;

  const bounds = {
    minLng: Math.min(...lngs), maxLng: Math.max(...lngs),
    minLat: Math.min(...lats), maxLat: Math.max(...lats),
  };
  // Centre from geometry when present, else the box centre — either is fine.
  const center = (Array.isArray(c) && Number.isFinite(Number(c[0])) && Number.isFinite(Number(c[1])))
    ? { lng: Number(c[0]), lat: Number(c[1]) }
    : { lng: (bounds.minLng + bounds.maxLng) / 2, lat: (bounds.minLat + bounds.maxLat) / 2 };

  const zoomRaw = props.zoomLevel ?? props.zoom;
  const zoom = Number.isFinite(Number(zoomRaw)) ? Number(zoomRaw) : null;
  return { bounds, center, zoom };
}

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
