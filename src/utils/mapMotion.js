/**
 * mapMotion — makes the Vibe Map feel alive (web / MapLibre GL).
 *
 *   createRadar(engine, map, { color })  A sonar sweep + pings centred on you,
 *       sized to the 15-minute walking ring. It is a DOM marker animated by
 *       CSS (src/styles/webFx.js), so it runs on the compositor; JavaScript
 *       only re-sizes it when the zoom changes.
 *
 *   rankHotspots(events)  Which hotspots get a light beam (utils/mapFuture).
 *
 *   startMapPulse(map, containerEl)  Only a short "pop" when new hotspots load.
 *       Anything continuous was moved OFF the map canvas: every paint-property
 *       change makes MapLibre redraw the whole map, and a 15 fps breathing loop
 *       measured as a fully busy CPU without a GPU. CSS markers cost the map
 *       nothing. The pop stops when the map is hidden or the page is in the
 *       background, and never runs for reduced motion.
 *
 * Layer ids are the ones LiveMap.js creates. Every paint call is guarded, so a
 * missing layer (style switch, partial load) can never throw.
 */

const REDUCED = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const RADAR_RADIUS_M = 1200; // the 15-minute walking ring (utils/mapGeoJSON isochronesGeoJSON)

const rgba = (hex, a) => {
  const h = String(hex || '#00f2ff').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  if (!Number.isFinite(n)) return `rgba(0,242,255,${a})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// MapLibre web-mercator: metres per CSS pixel at a latitude and zoom (512px tiles).
export const metresPerPixel = (lat, zoom) =>
  (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * Math.pow(2, zoom));

export function createRadar(engine, map, { color = '#00f2ff' } = {}) {
  if (typeof document === 'undefined' || !engine?.Marker) return { setLocation() {}, destroy() {} };
  const el = document.createElement('div');
  el.className = 'gx-radar';
  el.setAttribute('aria-hidden', 'true');
  el.style.setProperty('--gx-radar-strong', rgba(color, 0.42));
  el.style.setProperty('--gx-radar-soft', rgba(color, 0.08));
  el.style.setProperty('--gx-radar-line', rgba(color, 0.75));
  el.innerHTML = '<div class="gx-radar-sweep"></div>'
    + '<div class="gx-radar-ping"></div><div class="gx-radar-ping"></div><div class="gx-radar-ping"></div>';

  const marker = new engine.Marker({ element: el, anchor: 'center', pitchAlignment: 'map', rotationAlignment: 'map' });
  let loc = null;
  let added = false;

  const resize = () => {
    if (!loc) return;
    const d = Math.min(4000, Math.max(24, Math.round((2 * RADAR_RADIUS_M) / metresPerPixel(loc.lat, map.getZoom()))));
    el.style.width = `${d}px`;
    el.style.height = `${d}px`;
  };
  map.on('zoom', resize);

  return {
    setLocation(next) {
      loc = next && next.lat != null && next.lng != null ? next : null;
      if (!loc) { if (added) { marker.remove(); added = false; } return; }
      marker.setLngLat([loc.lng, loc.lat]);
      if (!added) { marker.addTo(map); added = true; }
      resize();
    },
    destroy() {
      map.off('zoom', resize);
      if (added) marker.remove();
      added = false;
    },
  };
}

const HOT_MAX = 12;

/** Which hotspots get a pulse: live venues first, then the busiest; capped. */
export function rankHotspots(events = [], max = HOT_MAX) {
  return (events || [])
    .map((e) => {
      const lat = Number(e?.lat ?? e?.latitude), lng = Number(e?.lon ?? e?.longitude);
      if (!e || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const here = Number(e.here_count ?? e.going ?? 0) || 0;
      const live = Number(e.here_count || 0) > 0;
      return { id: e.id, lat, lng, here, live, score: (live ? 1e6 : 0) + here };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}

const DOT_RADIUS = ['interpolate', ['linear'], ['get', 'here'], 0, 5, 50, 9];
const POP_MS = 520;
const easeOutBack = (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

export function startMapPulse(map, containerEl) {
  const noop = { stop() {}, popEvents() {} };
  if (!map || typeof window === 'undefined' || REDUCED()) return noop;

  const set = (layer, prop, value) => {
    try { if (map.getLayer(layer)) map.setPaintProperty(layer, prop, value); } catch { /* layer mid-reload */ }
  };

  let visible = true;
  let raf = 0;
  let popStart = 0;

  const tick = (now) => {
    raf = 0;
    if (!visible || document.hidden) return; // restarted by the observers below

    if (popStart) {
      // Hotspot pop-in runs every frame for half a second, then hands back.
      const t = Math.min(1, (now - popStart) / POP_MS);
      set('ev-dot', 'circle-radius', t < 1 ? ['*', Math.max(0.05, easeOutBack(t)), DOT_RADIUS] : DOT_RADIUS);
      if (t >= 1) popStart = 0;
    }

    if (popStart) raf = requestAnimationFrame(tick);
  };
  const start = () => { if (popStart && !raf && visible && !document.hidden) raf = requestAnimationFrame(tick); };

  // Hidden tab (display:none → not intersecting) or background page: stop.
  let io = null;
  if (containerEl && typeof IntersectionObserver !== 'undefined') {
    io = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      if (visible) start();
    });
    io.observe(containerEl);
  }
  const onVis = () => { if (!document.hidden) start(); };
  document.addEventListener('visibilitychange', onVis);

  return {
    stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    },
    popEvents() { popStart = performance.now(); start(); },
  };
}
