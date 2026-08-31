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
import {
  emptyFC, eventsToGeoJSON, zonesToGeoJSON, zonesToMarkersGeoJSON, reportsToGeoJSON,
  pointsToGeoJSON, staysToGeoJSON, poisToGeoJSON, crewToGeoJSON,
  nearbyToGeoJSON, trailsToGeoJSON, drawGeoJSON,
} from '../utils/mapGeoJSON';
import { toBbox } from '../utils/mapViewport';
import { applyGroupVisibility } from '../constants/mapLayers';

// A pan fires 'moveend' once, but a flick that settles can fire several. Wait
// for the map to actually stop before asking the server for anything.
const VIEWPORT_DEBOUNCE_MS = 400;

// Guarded so MapLibre (which touches window/document) never loads in the native
// bundle. Metro constant-folds Platform.OS per platform, so this require is
// dead-code-eliminated on native.
let maplibregl = null;
if (Platform.OS === 'web') {
  try { maplibregl = require('maplibre-gl').default || require('maplibre-gl'); } catch { maplibregl = null; }
}

// OpenFreeMap dark — keyless & free, and it matches the app's dark UI so the
// neon pins, heat and closures pop instead of washing out on a light ground.
// Same host as before, so the existing CSP (tiles.openfreemap.org) covers it.
const MAP_STYLES = {
  dark:  'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/bright',
  liberty: 'https://tiles.openfreemap.org/styles/liberty',
};
const DEFAULT_CENTER = { lng: 28.0473, lat: -26.2041 }; // Johannesburg

export function isMapSupported() {
  return Platform.OS === 'web' && !!maplibregl;
}

/**
 * What this renderer can actually do. The screen reads this instead of assuming
 * every control works everywhere — a FAB that toggles nothing is worse than an
 * absent one, and once a native renderer existed the assumption stopped holding.
 */
export function mapCapabilities() {
  const on = isMapSupported();
  return { draw: on, threeD: on, weather: on, styles: on };
}

export function LiveMap({
  events = [],
  zones = [],
  center = null,
  userLoc = null,         // { lat, lng } — a real device fix → "you are here" dot
  ripple = null,          // { lng, lat, key } — pulse a ring when someone checks in
  heat = false,           // show the presence-heat layer
  mine = [],              // [{lat,lng}] — your lit Touch Downs ("Fog of the City")
  showMine = false,
  crew = [],              // [{lat,lng,count}] — where your crew is heading tonight
  showCrew = false,
  nearby = [],            // [{id, username, avatar_url, lat, lon}] — live vibers
  showNearby = false,
  trails = [],            // [{from:{lat,lng}, to:{lat,lng}}] — flow trails
  showTrails = false,
  stays = [],             // [{lat,lng,...}] — accommodation from Resident Crew
  showStays = false,
  pois = [],              // [{lat,lng,icon}] — community POIs
  showWeather = false,    // show RainViewer radar overlay
  onStayPress,            // (stayId) => void
  onViberPress,           // (viberId) => void
  reports = [],           // crowdsourced typed pins (map_reports)
  onReportPress,          // (reportId) => void
  drawMode = null,        // null | 'line' | 'polygon'
  drawPoints = [],        // [[lng,lat], ...] controlled by parent
  onMapClick,             // (lngLat) => void  — used while drawing
  onEventPress,           // (eventId) => void
  onZonePress,            // (zoneId) => void
  onViewportChange,       // (bbox, zoom) => void — fires on settle, drives loading
  followUser = false,     // if true, auto-pans to userLoc
  mapStyle = 'dark',      // 'dark' | 'light' | 'liberty'
  show3D = false,         // show 3D buildings
  onReady,
  primaryColor = '#00f2ff',
  style,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const readyRef = useRef(false);
  const heatRef = useRef(heat);
  const mineRef = useRef(showMine);
  const crewRef = useRef(showCrew);
  const nearbyRef = useRef(showNearby);
  const trailsRef = useRef(showTrails);
  const staysRef = useRef(showStays);
  const show3DRef = useRef(show3D);
  const weatherRef = useRef(showWeather);

  // Pan to user if following is active
  useEffect(() => {
    if (followUser && userLoc && mapRef.current && readyRef.current) {
      mapRef.current.easeTo({ center: [userLoc.lng, userLoc.lat], zoom: 15, duration: 1000 });
    }
  }, [followUser, userLoc?.lat, userLoc?.lng]);

  useEffect(() => { heatRef.current = heat; setGroup('heat', heat); });
  useEffect(() => { mineRef.current = showMine; setGroup('mine', showMine); });
  useEffect(() => { crewRef.current = showCrew; setGroup('crew', showCrew); });
  useEffect(() => { nearbyRef.current = showNearby; setGroup('nearby', showNearby); });
  useEffect(() => { trailsRef.current = showTrails; setGroup('trails', showTrails); });
  useEffect(() => { staysRef.current = showStays; setGroup('stays', showStays); });
  useEffect(() => { show3DRef.current = show3D; toggle3D(show3D); });
  useEffect(() => { weatherRef.current = showWeather; toggleWeather(showWeather); });

  // Update style if it changes
  useEffect(() => {
    if (mapRef.current && readyRef.current) {
      mapRef.current.setStyle(MAP_STYLES[mapStyle] || MAP_STYLES.dark);
    }
  }, [mapStyle]);

  // ── init once ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isMapSupported() || !containerRef.current || mapRef.current) return;
    let map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLES[mapStyle] || MAP_STYLES.dark,
        center: [center?.lng ?? DEFAULT_CENTER.lng, center?.lat ?? DEFAULT_CENTER.lat],
        zoom: 12,
        pitch: show3D ? 45 : 0,
        attributionControl: { compact: true },
      });
    } catch { return; }
    mapRef.current = map;
    // Swallow async tile/style errors (a slow tile, a transient 5xx) so they
    // never bubble up as a crash — the basemap simply retries.
    map.on('error', () => {});

    map.on('load', () => {
     try {
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
          // Width + opacity read severity: a major closure is visibly heavier
          // than a minor one, so the map's danger is legible at a glance.
          'line-width': ['interpolate', ['linear'], ['get', 'severity'], 1, 3, 2, 5, 3, 8],
          'line-opacity': ['interpolate', ['linear'], ['get', 'severity'], 1, 0.7, 3, 1],
          'line-dasharray': [2, 1.5],
        },
      });

      // Zone markers (Entry/Exit for road closures)
      map.addSource('zone-markers', { type: 'geojson', data: emptyFC() });
      map.addLayer({
        id: 'zone-markers-text', type: 'symbol', source: 'zone-markers',
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
          'text-size': 10,
          'text-offset': [0, 0.6],
          'text-anchor': 'top'
        },
        paint: { 'text-color': '#fff', 'text-halo-color': '#000', 'text-halo-width': 1 }
      });
      map.addLayer({
        id: 'zone-markers-dot', type: 'circle', source: 'zone-markers',
        paint: { 'circle-radius': 4, 'circle-color': '#fff', 'circle-stroke-width': 2, 'circle-stroke-color': '#ef4444' }
      });

      // Community POIs (ATM, Police, etc.)
      // These are long-lived confirmed reports.
      map.addSource('pois', { type: 'geojson', data: emptyFC() });
      map.addLayer({
        id: 'pois-icon', type: 'symbol', source: 'pois',
        layout: {
          'text-field': ['get', 'icon'],
          'text-size': 14,
          'text-allow-overlap': true,
        },
        paint: { 'text-halo-color': '#0d1112', 'text-halo-width': 1 }
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
      // Clustered pins live on their OWN source (a heatmap can't cluster), so at
      // city zoom overlapping venues group into a count and split as you zoom in.
      map.addSource('eventsC', {
        type: 'geojson', data: eventsToGeoJSON(events),
        cluster: true, clusterRadius: 48, clusterMaxZoom: 13,
      });
      // Cluster bubble — colour + size step up with how many venues it holds.
      map.addLayer({
        id: 'ev-cluster', type: 'circle', source: 'eventsC', filter: ['has', 'point_count'],
        layout: { visibility: heatRef.current ? 'none' : 'visible' },
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#00f2ff', 5, '#10b981', 15, '#f59e0b', 40, '#ef4444'],
          'circle-opacity': 0.85,
          'circle-radius': ['step', ['get', 'point_count'], 16, 5, 20, 15, 26, 40, 34],
          'circle-stroke-color': '#0d1112', 'circle-stroke-width': 2,
        },
      });
      map.addLayer({
        id: 'ev-cluster-count', type: 'symbol', source: 'eventsC', filter: ['has', 'point_count'],
        layout: { visibility: heatRef.current ? 'none' : 'visible',
          'text-field': ['get', 'point_count_abbreviated'], 'text-size': 13, 'text-allow-overlap': true },
        paint: { 'text-color': '#0d1112' },
      });
      // Individual venue — soft glow, then the "hot right now" ring on busy ones,
      // then the crisp dot on top.
      map.addLayer({
        id: 'ev-glow', type: 'circle', source: 'eventsC', filter: ['!', ['has', 'point_count']],
        layout: { visibility: heatRef.current ? 'none' : 'visible' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'here'], 0, 9, 50, 22],
          'circle-color': '#00f2ff', 'circle-opacity': 0.18, 'circle-blur': 0.6,
        },
      });

      // Vibe Aura — a larger, pulsing ring for high-vibe venues (P2P signal)
      // Businesses get a wider, brand-coloured aura (B2P signal)
      map.addLayer({
        id: 'ev-aura', type: 'circle', source: 'eventsC', filter: ['!', ['has', 'point_count']],
        layout: { visibility: heatRef.current ? 'none' : 'visible' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'here'], 0, 0, 5, 20, 50, 45],
          'circle-color': ['case', ['get', 'biz'], 'rgba(0,242,255,0.08)', 'rgba(0,242,255,0.04)'],
          'circle-stroke-color': primaryColor,
          'circle-stroke-width': ['case', ['get', 'biz'], 2, 1],
          'circle-stroke-opacity': ['interpolate', ['linear'], ['get', 'here'], 0, 0, 10, 0.4],
        }
      }, 'ev-glow');

      // 3D Buildings layer (fill-extrusion)
      // OpenFreeMap tiles often include building heights in 'render_height' or 'height'
      map.addLayer({
        'id': '3d-buildings',
        'source': 'openmaptiles',
        'source-layer': 'building',
        'type': 'fill-extrusion',
        'minzoom': 14,
        'layout': { 'visibility': show3DRef.current ? 'visible' : 'none' },
        'paint': {
          'fill-extrusion-color': '#aaa',
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'render_height']],
          'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'render_min_height']],
          'fill-extrusion-opacity': 0.6
        }
      }, 'ev-glow'); // Place under event pins

      // 3D Buildings layer (fill-extrusion)
      // OpenFreeMap tiles often include building heights in 'render_height' or 'height'
      map.addLayer({
        'id': '3d-buildings',
        'source': 'openmaptiles',
        'source-layer': 'building',
        'type': 'fill-extrusion',
        'minzoom': 14,
        'layout': { 'visibility': show3DRef.current ? 'visible' : 'none' },
        'paint': {
          'fill-extrusion-color': '#aaa',
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'render_height']],
          'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'render_min_height']],
          'fill-extrusion-opacity': 0.6
        }
      }, 'ev-glow'); // Place under event pins

      map.addLayer({
        id: 'ev-hot', type: 'circle', source: 'eventsC',
        filter: ['all', ['!', ['has', 'point_count']], ['>=', ['get', 'here'], 10]],
        layout: { visibility: heatRef.current ? 'none' : 'visible' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'here'], 10, 12, 60, 26],
          'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-color': '#f59e0b', 'circle-stroke-width': 2, 'circle-stroke-opacity': 0.9,
        },
      });
      map.addLayer({
        id: 'ev-dot', type: 'circle', source: 'eventsC', filter: ['!', ['has', 'point_count']],
        layout: { visibility: heatRef.current ? 'none' : 'visible' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'here'], 0, 5, 50, 9],
          'circle-color': '#00f2ff', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5,
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

      // Nearby Vibers — ANY discoverable viber (primary color),
      // shown when searching / discovering people.
      map.addSource('nearby', { type: 'geojson', data: nearbyToGeoJSON(nearby) });
      map.addLayer({
        id: 'nearby-glow', type: 'circle', source: 'nearby',
        layout: { visibility: nearbyRef.current ? 'visible' : 'none' },
        paint: { 'circle-radius': 18, 'circle-color': primaryColor, 'circle-opacity': 0.12, 'circle-blur': 0.8 },
      });
      map.addLayer({
        id: 'nearby-dot', type: 'circle', source: 'nearby',
        layout: { visibility: nearbyRef.current ? 'visible' : 'none' },
        paint: { 'circle-radius': 6, 'circle-color': primaryColor, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 },
      });

      // Nearby Vibers Text (Username)
      map.addLayer({
        id: 'nearby-text', type: 'symbol', source: 'nearby',
        layout: {
          visibility: nearbyRef.current ? 'visible' : 'none',
          'text-field': ['get', 'username'],
          'text-size': 10,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
        },
        paint: { 'text-color': '#fff', 'text-halo-color': '#000', 'text-halo-width': 1 }
      });

      // You are here — a single bright dot so people orient instantly. Only ever
      // set from a real device fix (never the default city centre).
      map.addSource('self', { type: 'geojson', data: pointsToGeoJSON(userLoc ? [userLoc] : []) });
      map.addLayer({
        id: 'self-glow', type: 'circle', source: 'self',
        paint: { 'circle-radius': 20, 'circle-color': '#3b82f6', 'circle-opacity': 0.18, 'circle-blur': 0.8 },
      });
      map.addLayer({
        id: 'self-dot', type: 'circle', source: 'self',
        paint: { 'circle-radius': 7, 'circle-color': '#3b82f6', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2.5 },
      });

      // Vibe Trails — flow lines between venues (After-Event journey)
      map.addSource('trails', { type: 'geojson', data: emptyFC() });
      map.addLayer({
        id: 'trails-line', type: 'line', source: 'trails',
        layout: { visibility: trailsRef.current ? 'visible' : 'none', 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': primaryColor,
          // Weight reads how many people actually made this hop.
          'line-width': ['interpolate', ['linear'], ['get', 'people'], 3, 1.5, 50, 7],
          'line-opacity': ['interpolate', ['linear'], ['get', 'people'], 3, 0.35, 50, 0.85],
          'line-dasharray': [2, 2],
        },
      });

      // Touch-Down ripple — a one-shot expanding ring when someone checks in.
      // Crowdsourced reports — typed community pins (queues, water, unsafe…).
      map.addSource('reports', { type: 'geojson', data: reportsToGeoJSON(reports) });
      map.addLayer({
        id: 'reports-halo', type: 'circle', source: 'reports',
        paint: { 'circle-radius': 13, 'circle-color': ['get', 'color'], 'circle-opacity': 0.16, 'circle-blur': 0.5 },
      });
      map.addLayer({
        id: 'reports-dot', type: 'circle', source: 'reports',
        paint: {
          'circle-radius': 7, 'circle-color': ['get', 'color'],
          'circle-stroke-color': '#0d1112', 'circle-stroke-width': 2,
          // Confirmed pins read solid; unconfirmed a touch translucent.
          'circle-opacity': ['case', ['==', ['get', 'status'], 'confirmed'], 1, 0.8],
        },
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

      map.addSource('ripple', { type: 'geojson', data: emptyFC() });
      map.addLayer({
        id: 'ripple-ring', type: 'circle', source: 'ripple',
        paint: { 'circle-radius': 4, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#10b981', 'circle-stroke-width': 3, 'circle-stroke-opacity': 0.9 },
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

      // Taps: draw takes priority; then cluster (zoom in); then a pin; then a zone.
      map.on('click', (ev) => {
        if (drawModeRef.current) { onClickRef.current?.([ev.lngLat.lng, ev.lngLat.lat]); return; }
        const cl = map.queryRenderedFeatures(ev.point, { layers: ['ev-cluster'] });
        if (cl && cl[0]) {
          const src = map.getSource('eventsC');
          const center = cl[0].geometry.coordinates;
          const fly = (zoom) => map.easeTo({ center, zoom: Math.min((zoom || map.getZoom()) + 0.5, 17), duration: 500 });
          try {
            // maplibre v4 returns a Promise; older builds use a callback. Support both.
            const p = src.getClusterExpansionZoom(cl[0].properties.cluster_id, (err, zoom) => { if (!err) fly(zoom); });
            if (p && typeof p.then === 'function') p.then(fly).catch(() => {});
          } catch { fly(); }
          return;
        }
        const hit = map.queryRenderedFeatures(ev.point, { layers: ['ev-dot', 'ev-glow', 'ev-hot'] });
        if (hit && hit[0]) { onEventRef.current?.(hit[0].properties.id); return; }
        const viber = map.queryRenderedFeatures(ev.point, { layers: ['nearby-dot', 'nearby-glow'] });
        if (viber && viber[0]) { onViberRef.current?.(viber[0].properties.id); return; }
        const rp = map.queryRenderedFeatures(ev.point, { layers: ['reports-dot', 'reports-halo'] });
        if (rp && rp[0]) { onReportRef.current?.(rp[0].properties.id); return; }
        const stay = map.queryRenderedFeatures(ev.point, { layers: ['stays-dot', 'stays-icon'] });
        if (stay && stay[0]) { onStayRef.current?.(stay[0].properties.id); return; }
        const z = map.queryRenderedFeatures(ev.point, { layers: ['zones-line', 'zones-fill'] });
        if (z && z[0]) onZoneRef.current?.(z[0].properties.id);
      });
      // Tell the screen where we're looking, so it can load THIS area rather
      // than whatever was on screen at mount. Debounced: a pan fires moveend
      // once, but a flick-and-settle can fire several in quick succession.
      const emitViewport = () => {
        clearTimeout(viewportTimerRef.current);
        viewportTimerRef.current = setTimeout(() => {
          try {
            onViewportRef.current?.(toBbox(map.getBounds()), map.getZoom());
          } catch { /* bounds unavailable mid-transition */ }
        }, VIEWPORT_DEBOUNCE_MS);
      };
      map.on('moveend', emitViewport);
      map.on('zoomend', emitViewport);
      emitViewport(); // first load: report the opening view

      map.getCanvas().style.cursor = '';
      onReady?.(map);
     } catch (e) { /* one bad layer must never blank the whole map */ }
    });

    return () => {
      clearTimeout(viewportTimerRef.current);
      try { map.remove(); } catch {}
      mapRef.current = null; readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the latest callbacks/mode in refs so the single 'click' handler sees them.
  const drawModeRef = useRef(drawMode); const onClickRef = useRef(onMapClick);
  const onEventRef = useRef(onEventPress); const onZoneRef = useRef(onZonePress);
  const onReportRef = useRef(onReportPress);
  const onStayRef = useRef(onStayPress);
  const onViberRef = useRef(onViberPress);
  const onViewportRef = useRef(onViewportChange);
  const viewportTimerRef = useRef(null);
  useEffect(() => { drawModeRef.current = drawMode; onClickRef.current = onMapClick;
    onEventRef.current = onEventPress; onZoneRef.current = onZonePress;
    onReportRef.current = onReportPress; onStayRef.current = onStayPress;
    onViberRef.current = onViberPress; onViewportRef.current = onViewportChange; });

  // ── update sources on data change ───────────────────────────────────────────
  useEffect(() => { const g = eventsToGeoJSON(events); setData('events', g); setData('eventsC', g); }, [events]);
  useEffect(() => {
    setData('zones', zonesToGeoJSON(zones));
    setData('zone-markers', zonesToMarkersGeoJSON(zones));
  }, [zones]);
  useEffect(() => { setData('draw', drawGeoJSON(drawMode, drawPoints)); }, [drawMode, drawPoints]);
  useEffect(() => { setData('mine', pointsToGeoJSON(mine)); }, [mine]);
  useEffect(() => { setData('crew', crewToGeoJSON(crew)); }, [crew]);
  useEffect(() => { setData('nearby', nearbyToGeoJSON(nearby)); }, [nearby]);
  useEffect(() => { setData('trails', trailsToGeoJSON(trails)); }, [trails]);
  useEffect(() => { setData('stays', staysToGeoJSON(stays)); }, [stays]);
  useEffect(() => { setData('pois', poisToGeoJSON(pois)); }, [pois]);
  useEffect(() => { setData('self', pointsToGeoJSON(userLoc ? [userLoc] : [])); }, [userLoc]);
  useEffect(() => { setData('reports', reportsToGeoJSON(reports)); }, [reports]);
  // Animate a ripple each time `ripple.key` changes — radius grows, ring fades.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !readyRef.current || !ripple || ripple.lng == null || !m.getLayer('ripple-ring')) return;
    setData('ripple', pointsToGeoJSON([{ lat: ripple.lat, lng: ripple.lng }]));
    const start = performance.now();
    const DUR = 1400;
    let raf;
    const step = (now) => {
      const t = Math.min(1, (now - start) / DUR);
      try {
        m.setPaintProperty('ripple-ring', 'circle-radius', 4 + t * 46);
        m.setPaintProperty('ripple-ring', 'circle-stroke-opacity', 0.9 * (1 - t));
      } catch {}
      if (t < 1) raf = requestAnimationFrame(step);
      else setData('ripple', emptyFC());
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [ripple?.key]); // eslint-disable-line
  useEffect(() => {
    const m = mapRef.current;
    if (m && readyRef.current && center) m.easeTo({ center: [center.lng, center.lat], duration: 700 });
  }, [center]);

  function setData(id, data) {
    const m = mapRef.current;
    if (!m || !readyRef.current) return;
    const src = m.getSource(id);
    if (src) src.setData(data);
  }

  // One toggle for all of them — the per-group layer ids live in mapLayers.js,
  // where a typo is a test failure instead of a layer that silently never shows.
  function setGroup(group, on) {
    const m = mapRef.current;
    if (!m || !readyRef.current) return;
    applyGroupVisibility(m, group, on);
  }

  // Was called (useEffect at "show3DRef.current = show3D; toggle3D(show3D);")
  // but never defined ANYWHERE in this file's history — a pre-existing
  // ReferenceError that threw on every single render, invisible only because
  // the map was unreachable (LAUNCH_MINIMAL parked it) until liveMap: true.
  // pitch is otherwise set once, at map construction (`pitch: show3D ? 45 : 0`);
  // this is the missing runtime handler for toggling it after the map exists.
  function toggle3D(on) {
    const m = mapRef.current;
    if (!m || !readyRef.current) return;
    try { m.easeTo({ pitch: on ? 45 : 0, duration: 400 }); } catch { /* mid-transition */ }
  }

  async function toggleWeather(on) {
    const m = mapRef.current;
    if (!m || !readyRef.current) return;
    if (!on) {
      if (m.getLayer('weather-radar')) m.removeLayer('weather-radar');
      if (m.getSource('weather-radar')) m.removeSource('weather-radar');
      return;
    }

    try {
      const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
      const data = await res.json();
      const ts = data.radar.past[data.radar.past.length - 1].time;
      const url = `https://tilecache.rainviewer.com/v2/radar/${ts}/256/{z}/{x}/{y}/2/1_1.png`;

      if (m.getSource('weather-radar')) m.removeSource('weather-radar');
      m.addSource('weather-radar', { type: 'raster', tiles: [url], tileSize: 256 });
      m.addLayer({ id: 'weather-radar', type: 'raster', source: 'weather-radar', paint: { 'raster-opacity': 0.6 } }, 'ev-glow');
    } catch { /* weather failed — silent */ }
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

const cs = StyleSheet.create({
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 30, backgroundColor: '#0d1112' },
  fallbackText: { color: '#fff', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  fallbackSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center' },
});
