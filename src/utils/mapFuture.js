/**
 * mapFuture — the futuristic Vibe Map (web / MapLibre GL).
 *
 *   createBeams(engine, map, { onPress })  Light pillars rising from the busiest
 *       hotspots: taller when busier, a light packet racing up each one, a
 *       glowing orb on top and a rippling base. Green = live, amber = busy,
 *       cyan = everything else. DOM markers animated by CSS (webFx.js).
 *   createStreams(engine, map)  Glowing arcs from you to the nearest hotspots
 *       with sparks flowing along them, like a live route.
 *   createHud(container, map)  Scan line, corner brackets, a faint grid and a
 *       compass that turns with the map (tap → north up).
 *   cinematicIntro(map, loc) / focusOrbit(map, loc)  Camera moves: the fly-in
 *       when the map opens, and the fly-to + slow orbit when a hotspot is picked.
 *   applyNeonCity(map)  Neon-tinted 3D buildings and a dusk sky.
 *
 * Performance rule (learned the hard way): nothing here changes map paint
 * properties on a timer. A paint change makes MapLibre redraw the whole map;
 * a 15 fps loop of them measured as a fully busy CPU. Constant motion is CSS on
 * DOM markers (compositor-only), plus a 30 fps nudge of a few spark markers that
 * stops when the map is hidden or the page is in the background. Camera moves
 * happen only on open and when you pick a hotspot. Reduced motion: none of it.
 */
import { rankHotspots } from './mapMotion';

const REDUCED = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const HAS_DOM = () => typeof document !== 'undefined';

const KIND_COLOR = { live: '#10b981', hot: '#f59e0b', cool: '#00f2ff' };
const kindOf = (h) => (h.live ? 'live' : h.here >= 10 ? 'hot' : 'cool');

// ── Neon 3D city ────────────────────────────────────────────────────────────
export const NEON_BUILDING_COLOR = [
  'interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 0],
  0, '#0c2a33', 25, '#0f5566', 60, '#1d4ed8', 140, '#7c3aed',
];

export function applyNeonCity(map) {
  try {
    if (map.getLayer('3d-buildings')) {
      map.setPaintProperty('3d-buildings', 'fill-extrusion-color', NEON_BUILDING_COLOR);
      map.setPaintProperty('3d-buildings', 'fill-extrusion-opacity', 0.82);
      map.setPaintProperty('3d-buildings', 'fill-extrusion-vertical-gradient', true);
    }
  } catch { /* style without buildings */ }
  try {
    // A dusk sky behind the tilted city (MapLibre 4+). Older engines: no-op.
    map.setSky?.({
      'sky-color': '#04060c', 'horizon-color': '#0b4a5c', 'fog-color': '#04060c',
      'sky-horizon-blend': 0.55, 'horizon-fog-blend': 0.45, 'fog-ground-blend': 0.75,
    });
  } catch { /* no sky support */ }
}

// ── Camera ──────────────────────────────────────────────────────────────────
export function cinematicIntro(map, loc) {
  if (!map || !loc) return;
  try {
    if (REDUCED()) { map.jumpTo({ center: [loc.lng, loc.lat], zoom: 14.5 }); return; }
    map.flyTo({ center: [loc.lng, loc.lat], zoom: 14.6, pitch: 55, bearing: -20, duration: 2800, curve: 1.6, essential: false });
  } catch { /* mid-transition */ }
}

// Fly to a hotspot, tilt in, then slowly circle it until the user touches the
// map (any drag/zoom/rotate stops the camera — MapLibre's own stop()).
export function focusOrbit(map, loc) {
  if (!map || !loc) return () => {};
  if (REDUCED()) { try { map.easeTo({ center: [loc.lng, loc.lat], zoom: 16 }); } catch {} return () => {}; }
  let alive = true;
  const stop = () => { alive = false; try { map.stop(); } catch {} };
  const onUser = () => { if (alive) { alive = false; cleanup(); } };
  const cleanup = () => {
    for (const t of ['mousedown', 'touchstart', 'wheel', 'dragstart']) map.getCanvasContainer?.().removeEventListener(t, onUser);
  };
  for (const t of ['mousedown', 'touchstart', 'wheel', 'dragstart']) map.getCanvasContainer?.().addEventListener(t, onUser, { passive: true });
  try {
    map.flyTo({ center: [loc.lng, loc.lat], zoom: 16.2, pitch: 60, bearing: map.getBearing() - 30, duration: 1900, curve: 1.4 });
    map.once('moveend', () => {
      if (!alive) return;
      map.easeTo({ bearing: map.getBearing() + 140, duration: 36000, easing: (t) => t });
      map.once('moveend', () => { alive = false; cleanup(); });
    });
  } catch { /* mid-transition */ }
  return () => { if (alive) stop(); cleanup(); };
}

// ── Light beams ─────────────────────────────────────────────────────────────
export function createBeams(engine, map, { onPress, max = 12 } = {}) {
  if (!HAS_DOM() || !engine?.Marker) return { update() {}, destroy() {} };
  const markers = new Map(); // id -> { marker, el }
  const update = (events = []) => {
    const ranked = rankHotspots(events, max);
    const keep = new Set(ranked.map((r) => r.id));
    for (const [id, m] of markers) if (!keep.has(id)) { m.marker.remove(); markers.delete(id); }
    ranked.forEach((r, i) => {
      let m = markers.get(r.id);
      if (!m) {
        const el = document.createElement('div');
        el.className = 'gx-beam';
        el.innerHTML = '<div class="gx-beam-base"><i></i><i></i></div>'
          + '<div class="gx-beam-pillar"><i class="gx-beam-packet"></i></div><div class="gx-beam-orb"></div>';
        el.addEventListener('click', (e) => { e.stopPropagation(); onPress?.(r.id); });
        // Upright in a tilted map: the pillar stands like a light column.
        const marker = new engine.Marker({ element: el, anchor: 'bottom', pitchAlignment: 'viewport', rotationAlignment: 'viewport' })
          .setLngLat([r.lng, r.lat]).addTo(map);
        m = { marker, el };
        markers.set(r.id, m);
      } else {
        m.marker.setLngLat([r.lng, r.lat]);
      }
      const kind = kindOf(r);
      m.el.setAttribute('data-kind', kind);
      m.el.style.setProperty('--gx-beam', KIND_COLOR[kind]);
      m.el.style.setProperty('--gx-beam-h', `${Math.round(46 + Math.min(1, r.here / 40) * 84)}px`);
      m.el.style.setProperty('--gx-beam-d', `${(i % 5) * -0.37}s`); // de-sync the packets
    });
  };
  return { update, destroy() { for (const m of markers.values()) m.marker.remove(); markers.clear(); } };
}

// ── Vibe streams ────────────────────────────────────────────────────────────
// Quadratic arc between two points, bowed sideways so parallel routes fan out.
export function arcPoints(a, b, steps = 28, bow = 0.22) {
  const mx = (a.lng + b.lng) / 2, my = (a.lat + b.lat) / 2;
  const dx = b.lng - a.lng, dy = b.lat - a.lat;
  const cx = mx - dy * bow, cy = my + dx * bow; // perpendicular offset
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    pts.push([u * u * a.lng + 2 * u * t * cx + t * t * b.lng, u * u * a.lat + 2 * u * t * cy + t * t * b.lat]);
  }
  return pts;
}

const distKm = (a, b) => {
  const R = 6371, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

export function pickStreams(user, events = [], { max = 4, maxKm = 6, focusId = null } = {}) {
  if (!user) return [];
  const ranked = rankHotspots(events, 40).map((h) => ({ ...h, km: distKm(user, h) })).filter((h) => h.km > 0.03 && h.km <= maxKm);
  const focus = focusId != null ? ranked.find((h) => h.id === focusId) : null;
  const rest = ranked.filter((h) => h !== focus).sort((a, b) => (b.live - a.live) || (b.here - a.here) || (a.km - b.km));
  return [focus, ...rest].filter(Boolean).slice(0, max);
}

export function createStreams(engine, map, { primary = '#00f2ff' } = {}) {
  const off = { update() {}, destroy() {} };
  if (!HAS_DOM() || !engine?.Marker || !map) return off;
  try {
    if (!map.getSource('vibe-streams')) {
      map.addSource('vibe-streams', { type: 'geojson', lineMetrics: true, data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'vibe-streams-glow', type: 'line', source: 'vibe-streams',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': ['case', ['get', 'focus'], 9, 6], 'line-opacity': 0.12, 'line-blur': 4 },
      });
      map.addLayer({
        id: 'vibe-streams', type: 'line', source: 'vibe-streams',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-width': ['case', ['get', 'focus'], 3, 1.6],
          // Fades in from you toward the venue.
          'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, 'rgba(59,130,246,0)', 0.35, primary, 1, '#ffffff'],
          'line-opacity': ['case', ['get', 'focus'], 0.95, 0.55],
        },
      });
    }
  } catch { return off; }

  let routes = [];        // [{ pts, color, sparks: [marker...] }]
  let raf = 0, last = 0, visible = true;
  const container = map.getContainer?.();
  const reduced = REDUCED();

  const clearSparks = () => { routes.forEach((r) => r.sparks.forEach((s) => s.remove())); };
  const tick = (now) => {
    raf = 0;
    if (!visible || document.hidden || !routes.length) return;
    if (now - last > 33) { // 30 fps
      last = now;
      for (const r of routes) {
        r.sparks.forEach((s, k) => {
          const t = ((now / r.ms) + k / r.sparks.length) % 1;
          const f = t * (r.pts.length - 1), i = Math.floor(f), w = f - i;
          const p = r.pts[i], q = r.pts[Math.min(i + 1, r.pts.length - 1)];
          s.setLngLat([p[0] + (q[0] - p[0]) * w, p[1] + (q[1] - p[1]) * w]);
        });
      }
    }
    raf = requestAnimationFrame(tick);
  };
  const start = () => { if (!reduced && !raf && visible && !document.hidden && routes.length) raf = requestAnimationFrame(tick); };
  let io = null;
  if (container && typeof IntersectionObserver !== 'undefined') {
    io = new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); if (visible) start(); });
    io.observe(container);
  }
  const onVis = () => { if (!document.hidden) start(); };
  document.addEventListener('visibilitychange', onVis);

  return {
    update(user, events, focusId) {
      clearSparks();
      const picks = pickStreams(user, events, { focusId });
      const features = [];
      routes = picks.map((h) => {
        const kind = kindOf(h);
        const pts = arcPoints(user, h);
        const focus = h.id === focusId;
        features.push({ type: 'Feature', properties: { color: KIND_COLOR[kind], focus }, geometry: { type: 'LineString', coordinates: pts } });
        const n = reduced ? 0 : focus ? 4 : 2;
        const sparks = Array.from({ length: n }, () => {
          const el = document.createElement('div');
          el.className = 'gx-spark';
          el.style.setProperty('--gx-spark', KIND_COLOR[kind]);
          return new engine.Marker({ element: el, anchor: 'center' }).setLngLat(pts[0]).addTo(map);
        });
        // ~2.4 s for a 1 km trip, capped so long routes don't crawl.
        return { pts, sparks, ms: Math.min(6000, 1600 + h.km * 800) };
      });
      try { map.getSource('vibe-streams')?.setData({ type: 'FeatureCollection', features }); } catch {}
      start();
    },
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      clearSparks(); routes = [];
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    },
  };
}

// ── HUD ─────────────────────────────────────────────────────────────────────
export function createHud(container, map) {
  if (!HAS_DOM() || !container) return { destroy() {} };
  const hud = document.createElement('div');
  hud.className = 'gx-hud';
  hud.setAttribute('aria-hidden', 'true');
  hud.innerHTML = '<div class="gx-hud-grid"></div><div class="gx-hud-scan"></div>'
    + '<i class="gx-hud-c tl"></i><i class="gx-hud-c tr"></i><i class="gx-hud-c bl"></i><i class="gx-hud-c br"></i>';
  const compass = document.createElement('button');
  compass.className = 'gx-compass';
  compass.type = 'button';
  compass.setAttribute('aria-label', 'Point the map north');
  compass.innerHTML = '<span class="gx-compass-n">N</span><span class="gx-compass-needle"></span>';
  compass.addEventListener('click', () => { try { map.easeTo({ bearing: 0, duration: 600 }); } catch {} });
  container.appendChild(hud);
  container.appendChild(compass);
  const turn = () => {
    try {
      const b = map.getBearing(), p = map.getPitch();
      compass.style.transform = `rotate(${-b}deg)`;
      compass.setAttribute('data-tilted', p > 5 ? 'true' : 'false');
    } catch { /* map gone */ }
  };
  map.on('rotate', turn); map.on('pitch', turn); turn();
  return {
    destroy() { map.off('rotate', turn); map.off('pitch', turn); hud.remove(); compass.remove(); },
  };
}
