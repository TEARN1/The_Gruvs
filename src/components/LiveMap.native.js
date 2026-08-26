/**
 * LiveMap (native) — the same map, rendered by MapLibre's native SDK.
 *
 * The Map tab used to show "open this on the web" on a phone, which is a strange
 * thing for a nightlife app whose whole point is being out. This is the native
 * twin of LiveMap.js: same props, same data (both import the converters from
 * utils/mapGeoJSON), same free keyless OpenFreeMap tiles. Metro picks this file
 * on iOS/Android and LiveMap.js on web, so callers just import './LiveMap'.
 *
 * Why MapLibre and not react-native-maps (which is already a dependency):
 * react-native-maps on Android is Google Maps, which needs an API key and a
 * billing account. MapLibre + OpenFreeMap stays keyless and free, matches the
 * web renderer's style spec exactly, and lets both platforms share one set of
 * GeoJSON converters instead of drifting apart.
 *
 * PORTED: basemap, event pins (clustered) + heat, zones, reports, fog, crew,
 * nearby vibers, stays, user location, viewport reporting, taps.
 * NOT YET PORTED (web-only for now, and deliberately not faked here): the host
 * draw tool, the weather radar overlay, 3D buildings, and the check-in ripple.
 * Those degrade by simply not rendering rather than by breaking the map.
 */
import React, { useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  eventsToGeoJSON, zonesToGeoJSON, zonesToMarkersGeoJSON, reportsToGeoJSON,
  pointsToGeoJSON, staysToGeoJSON, poisToGeoJSON, crewToGeoJSON,
  nearbyToGeoJSON, trailsToGeoJSON,
} from '../utils/mapGeoJSON';

// Same guarded-require discipline as the web file: if the native module isn't
// in this build (Expo Go, or a binary built before the plugin was added), the
// screen shows a calm note instead of red-screening.
let MLRN = null;
try { MLRN = require('@maplibre/maplibre-react-native'); } catch { MLRN = null; }

const MAP_STYLES = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/bright',
  liberty: 'https://tiles.openfreemap.org/styles/liberty',
};
const DEFAULT_CENTER = { lng: 28.0473, lat: -26.2041 }; // Johannesburg

export function isMapSupported() {
  return !!MLRN?.MapView;
}

/**
 * What this renderer can actually do — see the PORTED list above. Drawing, 3D
 * buildings and the weather overlay aren't here yet, and a control that toggles
 * nothing is worse than an absent one, so the screen hides them rather than
 * offering a dead button. Hosts can still trace zones on the web app; this map
 * shows the zones they drew.
 */
export function mapCapabilities() {
  const on = isMapSupported();
  return { draw: false, threeD: false, weather: false, styles: on };
}

const vis = (on) => ({ visibility: on ? 'visible' : 'none' });

export function LiveMap({
  events = [],
  zones = [],
  center = null,
  userLoc = null,
  heat = false,
  mine = [], showMine = false,
  crew = [], showCrew = false,
  nearby = [], showNearby = false,
  trails = [], showTrails = false,
  stays = [], showStays = false,
  pois = [],
  reports = [],
  mapStyle = 'dark',
  followUser = false,
  onEventPress,
  onZonePress,
  onReportPress,
  onStayPress,
  onViberPress,
  onViewportChange,
  onReady,
}) {
  const cameraRef = useRef(null);
  const mapViewRef = useRef(null);

  /**
   * The screen drives zoom and fit-all imperatively through whatever onReady
   * hands it — on web that's the raw MapLibre GL map. Native has no such object,
   * so this adapter presents the same three methods with the same signatures.
   * Without it those buttons silently did nothing on a phone.
   */
  const buildMapApi = useCallback(() => ({
    zoomIn: async () => {
      try {
        const z = await mapViewRef.current?.getZoom();
        cameraRef.current?.zoomTo(Math.min((z ?? 12) + 1, 20), 300);
      } catch { /* map not ready */ }
    },
    zoomOut: async () => {
      try {
        const z = await mapViewRef.current?.getZoom();
        cameraRef.current?.zoomTo(Math.max((z ?? 12) - 1, 1), 300);
      } catch { /* map not ready */ }
    },
    // Matches the web call: fitBounds([[minX,minY],[maxX,maxY]], { padding, duration })
    fitBounds: ([[minX, minY], [maxX, maxY]], opts = {}) => {
      try {
        cameraRef.current?.setCamera({
          bounds: { ne: [maxX, maxY], sw: [minX, minY] },
          padding: {
            paddingTop: opts.padding ?? 60, paddingBottom: opts.padding ?? 60,
            paddingLeft: opts.padding ?? 60, paddingRight: opts.padding ?? 60,
          },
          animationDuration: opts.duration ?? 600,
        });
      } catch { /* map not ready */ }
    },
  }), []);

  // Converters are shared with the web renderer, so a change to what a pin
  // carries lands on both platforms at once.
  const eventsFC = useMemo(() => eventsToGeoJSON(events), [events]);
  const zonesFC = useMemo(() => zonesToGeoJSON(zones), [zones]);
  const zoneMarkersFC = useMemo(() => zonesToMarkersGeoJSON(zones), [zones]);
  const reportsFC = useMemo(() => reportsToGeoJSON(reports), [reports]);
  const mineFC = useMemo(() => pointsToGeoJSON(mine), [mine]);
  const crewFC = useMemo(() => crewToGeoJSON(crew), [crew]);
  const nearbyFC = useMemo(() => nearbyToGeoJSON(nearby), [nearby]);
  const staysFC = useMemo(() => staysToGeoJSON(stays), [stays]);
  const poisFC = useMemo(() => poisToGeoJSON(pois), [pois]);
  const trailsFC = useMemo(() => trailsToGeoJSON(trails), [trails]);

  // Same contract as web: report the settled viewport so the screen loads the
  // area actually on screen. Native gives us the bounds in the region payload.
  const handleRegionChange = useCallback((feature) => {
    const b = feature?.properties?.visibleBounds; // [[east,north],[west,south]]
    if (!Array.isArray(b) || b.length !== 2) return;
    const [[east, north], [west, south]] = b;
    onViewportChange?.({ west, south, east, north }, feature?.properties?.zoomLevel);
  }, [onViewportChange]);

  const firstId = (e) => e?.features?.[0]?.properties?.id;

  if (!isMapSupported()) {
    return (
      <View style={cs.fallback}>
        <Feather name="map" size={26} color="rgba(255,255,255,0.5)" />
        <Text style={cs.fallbackText}>Map needs the latest app build</Text>
        <Text style={cs.fallbackSub}>Everything else works — the zone list below is live.</Text>
      </View>
    );
  }

  const { MapView, Camera, ShapeSource, CircleLayer, SymbolLayer, LineLayer, FillLayer, HeatmapLayer, UserLocation } = MLRN;

  return (
    <MapView
      ref={mapViewRef}
      style={{ flex: 1 }}
      mapStyle={MAP_STYLES[mapStyle] || MAP_STYLES.dark}
      onRegionDidChange={handleRegionChange}
      onDidFinishLoadingMap={() => onReady?.(buildMapApi())}
      logoEnabled={false}
      attributionPosition={{ bottom: 8, right: 8 }}
    >
      <Camera
        ref={cameraRef}
        defaultSettings={{
          centerCoordinate: [center?.lng ?? DEFAULT_CENTER.lng, center?.lat ?? DEFAULT_CENTER.lat],
          zoomLevel: 12,
        }}
        centerCoordinate={center ? [center.lng, center.lat] : undefined}
        followUserLocation={followUser}
        animationDuration={700}
      />

      {/* Zones sit under the pins — they describe the ground, not what's on it. */}
      <ShapeSource id="zones" shape={zonesFC} onPress={(e) => onZonePress?.(firstId(e))}>
        <FillLayer
          id="zones-fill"
          filter={['==', ['geometry-type'], 'Polygon']}
          style={{ fillColor: ['get', 'color'], fillOpacity: 0.18 }}
        />
        <LineLayer
          id="zones-line"
          style={{
            lineColor: ['get', 'color'],
            lineWidth: ['interpolate', ['linear'], ['get', 'severity'], 1, 2, 3, 6],
            lineOpacity: 0.9,
            lineCap: 'round',
          }}
        />
      </ShapeSource>

      <ShapeSource id="zone-markers" shape={zoneMarkersFC}>
        <SymbolLayer
          id="zone-marker-text"
          style={{ textField: ['get', 'label'], textSize: 10, textColor: '#fff', textHaloColor: '#000', textHaloWidth: 1 }}
        />
      </ShapeSource>

      <ShapeSource id="trails" shape={trailsFC}>
        <LineLayer
          id="trails-line"
          style={{
            lineColor: '#00f2ff',
            // Weight reads how many people actually made this hop.
            lineWidth: ['interpolate', ['linear'], ['get', 'people'], 3, 1.5, 50, 7],
            lineOpacity: ['interpolate', ['linear'], ['get', 'people'], 3, 0.35, 50, 0.85],
            ...vis(showTrails),
          }}
        />
      </ShapeSource>

      {/* Fog of the City — your own lit Touch Downs, gold. */}
      <ShapeSource id="mine" shape={mineFC}>
        <CircleLayer id="mine-glow" style={{ circleRadius: 18, circleColor: '#fbbf24', circleOpacity: 0.16, ...vis(showMine) }} />
        <CircleLayer id="mine-dot" style={{ circleRadius: 4, circleColor: '#fbbf24', circleOpacity: 0.9, ...vis(showMine) }} />
      </ShapeSource>

      <ShapeSource id="crew" shape={crewFC} onPress={(e) => onEventPress?.(e?.features?.[0]?.properties?.eventId)}>
        <CircleLayer id="crew-ring" style={{ circleRadius: 16, circleColor: 'transparent', circleStrokeColor: '#ec4899', circleStrokeWidth: 2, ...vis(showCrew) }} />
        <CircleLayer id="crew-dot" style={{ circleRadius: 6, circleColor: '#ec4899', ...vis(showCrew) }} />
        <SymbolLayer id="crew-count" style={{ textField: ['to-string', ['get', 'count']], textSize: 10, textColor: '#fff', ...vis(showCrew) }} />
      </ShapeSource>

      <ShapeSource id="nearby" shape={nearbyFC} onPress={(e) => onViberPress?.(firstId(e))}>
        <CircleLayer id="nearby-glow" style={{ circleRadius: 14, circleColor: '#00f2ff', circleOpacity: 0.18, ...vis(showNearby) }} />
        <CircleLayer id="nearby-dot" style={{ circleRadius: 5, circleColor: '#00f2ff', ...vis(showNearby) }} />
        <SymbolLayer id="nearby-text" style={{ textField: ['get', 'username'], textSize: 9, textColor: '#fff', textOffset: [0, 1.4], ...vis(showNearby) }} />
      </ShapeSource>

      <ShapeSource id="stays" shape={staysFC} onPress={(e) => onStayPress?.(firstId(e))}>
        <CircleLayer id="stays-glow" style={{ circleRadius: 14, circleColor: '#f59e0b', circleOpacity: 0.18, ...vis(showStays) }} />
        <CircleLayer id="stays-dot" style={{ circleRadius: 5, circleColor: '#f59e0b', ...vis(showStays) }} />
      </ShapeSource>

      <ShapeSource id="pois" shape={poisFC}>
        <SymbolLayer id="pois-icon" style={{ textField: ['get', 'icon'], textSize: 16 }} />
      </ShapeSource>

      <ShapeSource id="reports" shape={reportsFC} onPress={(e) => onReportPress?.(firstId(e))}>
        <CircleLayer id="reports-halo" style={{ circleRadius: 13, circleColor: ['get', 'color'], circleOpacity: 0.2 }} />
        <CircleLayer id="reports-dot" style={{ circleRadius: 5, circleColor: ['get', 'color'], circleStrokeColor: '#fff', circleStrokeWidth: 1 }} />
      </ShapeSource>

      {/* Events: heat and clustered pins are two readings of the same data, so
          exactly one of them is visible at a time — same rule as the web map. */}
      <ShapeSource id="events-heat-src" shape={eventsFC}>
        <HeatmapLayer
          id="events-heat"
          style={{
            heatmapWeight: ['interpolate', ['linear'], ['get', 'here'], 0, 0, 30, 1],
            heatmapIntensity: 1,
            heatmapRadius: 30,
            heatmapOpacity: 0.7,
            ...vis(heat),
          }}
        />
      </ShapeSource>

      <ShapeSource
        id="eventsC"
        shape={eventsFC}
        cluster
        clusterRadius={50}
        clusterMaxZoomLevel={14}
        onPress={(e) => {
          const f = e?.features?.[0];
          if (!f) return;
          // A cluster has no event id — zoom into it instead of opening nothing.
          if (f.properties?.cluster) {
            const [lng, lat] = f.geometry.coordinates;
            cameraRef.current?.setCamera({ centerCoordinate: [lng, lat], zoomLevel: 14.5, animationDuration: 500 });
            return;
          }
          onEventPress?.(f.properties?.id);
        }}
      >
        <CircleLayer
          id="ev-cluster"
          filter={['has', 'point_count']}
          style={{ circleRadius: ['step', ['get', 'point_count'], 16, 10, 22, 50, 28], circleColor: '#00f2ff', circleOpacity: 0.75, ...vis(!heat) }}
        />
        <SymbolLayer
          id="ev-cluster-count"
          filter={['has', 'point_count']}
          style={{ textField: ['to-string', ['get', 'point_count']], textSize: 12, textColor: '#001014', ...vis(!heat) }}
        />
        <CircleLayer
          id="ev-glow"
          filter={['!', ['has', 'point_count']]}
          style={{ circleRadius: 16, circleColor: '#00f2ff', circleOpacity: 0.16, ...vis(!heat) }}
        />
        <CircleLayer
          id="ev-hot"
          filter={['all', ['!', ['has', 'point_count']], ['>', ['get', 'here'], 0]]}
          style={{ circleRadius: ['interpolate', ['linear'], ['get', 'here'], 1, 8, 50, 20], circleColor: '#ff2d55', circleOpacity: 0.35, ...vis(!heat) }}
        />
        <CircleLayer
          id="ev-dot"
          filter={['!', ['has', 'point_count']]}
          style={{ circleRadius: 6, circleColor: '#00f2ff', circleStrokeColor: '#fff', circleStrokeWidth: 1.5, ...vis(!heat) }}
        />
      </ShapeSource>

      {userLoc ? <UserLocation visible showsUserHeadingIndicator /> : null}
    </MapView>
  );
}

const cs = StyleSheet.create({
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 30, backgroundColor: '#0d1112' },
  fallbackText: { color: '#fff', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  fallbackSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center' },
});

export default LiveMap;
