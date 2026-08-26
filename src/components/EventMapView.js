/**
 * EventMapView — 100% self-built, zero cost, zero API keys.
 * Renders event coordinates as positioned pins on a canvas-style View.
 * Note: this view does NOT offer directions — the header used to claim it opened
 * the device's maps app, but no such code existed. Directions live on the map
 * pin preview (MapEventPreview → utils/directions).
 * No react-native-maps. No Google Maps API. No billing.
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ScrollView, Image, Dimensions, Platform,
} from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useBackClose } from '../hooks/useBackClose';
import { LiveMap, isMapSupported } from './LiveMap';

const { width: SW, height: SH } = Dimensions.get('window');
const MAP_H = SH * 0.55;
const MAP_W = SW;
const PAD  = 24; // px padding inside the map so pins don't clip edges

const CATEGORY_EMOJI = {
  music: '🎵', nightlife: '🌙', sport: '⚡', art: '🎨', food: '🍽️',
  culture: '🏛️', wellness: '🧘', tech: '💻', fashion: '👗', comedy: '😂',
  outdoor: '🌿', film: '🎬',
};
const emoji = (cat) => CATEGORY_EMOJI[cat?.toLowerCase()] ?? '📍';

// Map lat/lon → pixel x/y within the MAP_W × MAP_H canvas
const project = (lat, lon, minLat, maxLat, minLon, maxLon) => {
  const rangeX = maxLon - minLon || 0.01;
  const rangeY = maxLat - minLat || 0.01;
  const x = PAD + ((lon - minLon) / rangeX) * (MAP_W - PAD * 2);
  // Latitude increases upward on earth, downward on screen
  const y = PAD + ((maxLat - lat) / rangeY) * (MAP_H - PAD * 2);
  return { x, y };
};

// Calculate distance in km between two lat/lon coordinates
const haversineDist = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth radius in km
  const dLat = ((Number(lat2) - Number(lat1)) * Math.PI) / 180;
  const dLon = ((Number(lon2) - Number(lon1)) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((Number(lat1) * Math.PI) / 180) *
      Math.cos((Number(lat2) * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const MapGrid = ({ events, userCoords, primaryColor, onSelectEvent, isRoute = false }) => {
  const [selected, setSelected] = useState(null);

  const withCoords = events.filter(e => e.lat != null && e.lon != null);

  // Add user position as a virtual point if available
  const allLats = [
    ...withCoords.map(e => Number(e.lat)),
    userCoords?.lat,
  ].filter(Boolean);
  const allLons = [
    ...withCoords.map(e => Number(e.lon)),
    userCoords?.lon,
  ].filter(Boolean);

  const minLat = Math.min(...allLats);
  const maxLat = Math.max(...allLats);
  const minLon = Math.min(...allLons);
  const maxLon = Math.max(...allLons);

  const pins = useMemo(() => withCoords.map(e => ({
    ...e,
    ...project(Number(e.lat), Number(e.lon), minLat, maxLat, minLon, maxLon),
  })), [withCoords, minLat, maxLat, minLon, maxLon]);

  const userPin = userCoords?.lat != null
    ? project(userCoords.lat, userCoords.lon, minLat, maxLat, minLon, maxLon)
    : null;

  return (
    <View style={[grid.canvas, { height: MAP_H }]}>
      {/* Grid lines for visual depth */}
      {[0.25, 0.5, 0.75].map(f => (
        <View key={`h${f}`} style={[grid.gridH, { top: MAP_H * f }]} />
      ))}
      {[0.25, 0.5, 0.75].map(f => (
        <View key={`v${f}`} style={[grid.gridV, { left: MAP_W * f }]} />
      ))}

      {/* Route Polylines */}
      {isRoute && pins.length > 1 && (
        <Svg style={StyleSheet.absoluteFill}>
          {pins.map((pin, i) => {
            if (i === 0) return null;
            const prev = pins[i - 1];
            return (
              <Line
                key={`line-${i}`}
                x1={prev.x}
                y1={prev.y}
                x2={pin.x}
                y2={pin.y}
                stroke={primaryColor}
                strokeWidth="2"
                strokeDasharray="5, 5"
                opacity={0.6}
              />
            );
          })}
        </Svg>
      )}

      {/* Dotted path connection line from user to selected pin */}
      {userPin && selected && (
        <Svg style={StyleSheet.absoluteFill}>
          <Line
            x1={userPin.x}
            y1={userPin.y}
            x2={selected.x}
            y2={selected.y}
            stroke={selected.category_color || primaryColor}
            strokeWidth="2.5"
            strokeDasharray="5, 5"
            opacity={0.8}
          />
        </Svg>
      )}

      {/* Compass rose */}
      <View style={grid.compass}>
        <Text style={grid.compassN}>N</Text>
        <Feather name="navigation" size={14} color="rgba(255,255,255,0.3)" />
      </View>

      {/* User location dot */}
      {userPin && (
        <View style={[grid.userDot, { left: userPin.x - 8, top: userPin.y - 8 }]}>
          <View style={[grid.userPulse, { borderColor: primaryColor }]} />
          <View style={[grid.userCenter, { backgroundColor: primaryColor }]} />
        </View>
      )}

      {/* Event pins */}
      {pins.map(pin => {
        const isSelected = selected?.id === pin.id;
        const color = pin.category_color || primaryColor;
        return (
          <TouchableOpacity
            key={pin.id}
            style={[grid.pin, { left: pin.x - 18, top: pin.y - 18 }]}
            onPress={() => setSelected(isSelected ? null : pin)}
            activeOpacity={0.8}
          >
            <View style={[
              grid.pinCircle,
              { backgroundColor: color, borderColor: isSelected ? '#fff' : 'rgba(255,255,255,0.2)' },
              isSelected && { transform: [{ scale: 1.3 }] },
            ]}>
              <Text style={{ fontSize: 13 }}>{emoji(pin.category)}</Text>
            </View>
            {isSelected && (
              <View style={[grid.pinTip, { backgroundColor: color }]} />
            )}
          </TouchableOpacity>
        );
      })}

      {/* Callout for selected pin */}
      {selected && (() => {
        const CALLOUT_W = 200;
        // Keep callout inside canvas bounds
        let left = selected.x - CALLOUT_W / 2;
        if (left < 8) left = 8;
        if (left + CALLOUT_W > MAP_W - 8) left = MAP_W - CALLOUT_W - 8;
        const above = selected.y > MAP_H / 2;
        const top = above ? selected.y - 170 : selected.y + 28;
        return (
          <View style={[grid.callout, { left, top, width: CALLOUT_W }]}>
            {selected.media?.[0]?.url && (
              <Image source={{ uri: selected.media[0].url }} style={grid.calloutImg} />
            )}
            <Text style={grid.calloutTitle} numberOfLines={2}>{selected.title}</Text>
            {selected.venue_name && (
              <Text style={grid.calloutVenue} numberOfLines={1}>
                <Feather name="map-pin" size={10} color="#9ca3af" /> {selected.venue_name}
              </Text>
            )}
            {userCoords?.lat != null && selected.lat != null && selected.lon != null && (() => {
              const dist = haversineDist(userCoords.lat, userCoords.lon, selected.lat, selected.lon);
              return (
                <Text style={[grid.calloutDistance, { color: selected.category_color || primaryColor }]} numberOfLines={1}>
                  📍 {dist.toFixed(1)} km away
                </Text>
              );
            })()}
            <View style={grid.calloutActions}>
              <TouchableOpacity
                style={[grid.calloutBtn, { backgroundColor: selected.category_color || primaryColor, width: '100%' }]}
                onPress={() => onSelectEvent(selected)}
              >
                <Text style={grid.calloutBtnText}>View Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })()}

      {/* No-coords notice */}
      {withCoords.length === 0 && (
        <View style={grid.noCoords}>
          <Feather name="map-off" size={32} color="rgba(255,255,255,0.2)" />
          <Text style={grid.noCoordsText}>Events don't have coordinates yet</Text>
          <Text style={grid.noCoordsText2}>Addresses are shown in the list below</Text>
        </View>
      )}
    </View>
  );
};

// Geocode a venue address using Nominatim (free OSM, no API key) with persistent AsyncStorage cache
const ASYNC_GEO_CACHE_KEY = '@gruvs_geocode_cache_v1';
let geocodeCache = {};
let geocodeCacheLoaded = false;

const loadGeocodeCache = async () => {
  if (geocodeCacheLoaded) return;
  try {
    const raw = await AsyncStorage.getItem(ASYNC_GEO_CACHE_KEY);
    if (raw) {
      geocodeCache = JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load geocode cache', e);
  }
  geocodeCacheLoaded = true;
};

const saveGeocodeCache = async () => {
  try {
    await AsyncStorage.setItem(ASYNC_GEO_CACHE_KEY, JSON.stringify(geocodeCache));
  } catch (e) {
    console.error('Failed to save geocode cache', e);
  }
};

const geocodeAddress = async (query) => {
  if (!query) return null;
  await loadGeocodeCache();
  if (geocodeCache[query]) return geocodeCache[query];
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'TheGruvs/1.0' } });
    const data = await res.json();
    if (data?.[0]) {
      const coords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      geocodeCache[query] = coords;
      await saveGeocodeCache();
      return coords;
    }
  } catch {}
  return null;
};

export const EventMapView = ({ events = [], userCoords, onSelectEvent, visible, onClose, isRoute = false }) => {
  useBackClose(visible, onClose);
  const { currentTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const primary = currentTheme?.primary || "#00f2ff";
  const bg      = currentTheme?.background || "#0d1112";
  const textColor = currentTheme?.text || '#fff';
  const muted   = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const [geocodedEvents, setGeocodedEvents] = useState(events);
  const geocodingRef = useRef(false);

  useEffect(() => {
    if (!visible || geocodingRef.current) return;
    const missing = events.filter(e => e.lat == null || e.lon == null);
    if (!missing.length) { setGeocodedEvents(events); return; }
    geocodingRef.current = true;

    (async () => {
      await loadGeocodeCache();
      const resolved = [];
      for (const e of missing) {
        const addr = [e.venue_name, e.city, e.address].filter(Boolean).join(', ');
        const isAlreadyCached = !!geocodeCache[addr];
        const coords = await geocodeAddress(addr);
        if (coords) {
          resolved.push({ ...e, lat: coords.lat, lon: coords.lon });
        } else {
          resolved.push(e);
        }
        if (!isAlreadyCached && addr) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }
      const resolvedMap = {};
      resolved.forEach(e => { resolvedMap[e.id] = e; });
      setGeocodedEvents(events.map(e => resolvedMap[e.id] || e));
      geocodingRef.current = false;
    })();
  }, [visible, events]);

  useEffect(() => {
    setGeocodedEvents(events);
    geocodingRef.current = false;
  }, [events]);

  const handleSelect = (event) => {
    onSelectEvent?.(event);
    onClose?.();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[s.root, { backgroundColor: bg }]}>

        {/* Header */}
        <View style={[s.header, { borderBottomColor: `${primary}20`, paddingTop: (insets.top || 0) + 16 }]}>
          <View>
            <Text style={[s.headerTitle, { color: textColor }]}>
              {isRoute ? 'Royal Journey' : 'Events Near You'}
            </Text>
            <Text style={[s.headerSub, { color: muted }]}>
              {geocodedEvents.filter(e => e.lat != null).length} pinned · {geocodedEvents.length} total
            </Text>
          </View>
          <TouchableOpacity style={[s.closeBtn, { backgroundColor: `${primary}15`, borderColor: `${primary}30` }]} onPress={onClose}>
            <Feather name="x" size={18} color={primary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

          {/* Map view: High-fidelity LiveMap if supported, else canvas fallback */}
          {isMapSupported() ? (
            <View style={{ height: MAP_H, width: MAP_W }}>
              <LiveMap
                events={geocodedEvents}
                userLoc={userCoords}
                primaryColor={primary}
                onEventPress={handleSelect}
              />
            </View>
          ) : (
            <MapGrid
              events={geocodedEvents}
              userCoords={userCoords}
              primaryColor={primary}
              onSelectEvent={handleSelect}
              isRoute={isRoute}
            />
          )}

          {/* Legend */}
          <View style={[s.legend, { borderColor: `${primary}15` }]}>
            <View style={s.legendRow}>
              <View style={[s.legendDot, { backgroundColor: primary }]} />
              <Text style={[s.legendText, { color: muted }]}>You</Text>
            </View>
            <View style={s.legendRow}>
              <View style={[s.legendDot, { backgroundColor: "#8b5cf6" }]} />
              <Text style={[s.legendText, { color: muted }]}>Event pin — tap to preview</Text>
            </View>
          </View>

          {/* Event list below map */}
          <Text style={[s.listHeader, { color: muted }]}>ALL EVENTS</Text>
          {geocodedEvents.map(event => {
            const color = event.category_color || primary;
            const thumb = event.media?.[0]?.url;
            return (
              <TouchableOpacity
                key={event.id}
                style={[s.listRow, { backgroundColor: `${bg}`, borderColor: `${primary}15` }]}
                onPress={() => handleSelect(event)}
                activeOpacity={0.8}
              >
                {thumb
                  ? <Image source={{ uri: thumb }} style={s.listThumb} />
                  : <View style={[s.listThumb, { backgroundColor: `${color}22`, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ fontSize: 22 }}>{emoji(event.category)}</Text>
                    </View>
                }
                <View style={s.listInfo}>
                  <Text style={[s.listTitle, { color: textColor }]} numberOfLines={1}>{event.title}</Text>
                  {event.venue_name && (
                    <Text style={[s.listVenue, { color: muted }]} numberOfLines={1}>
                      {event.venue_name}
                    </Text>
                  )}
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Feather name="zap" size={11} color={color} />
                      <Text style={[s.listMeta, { color: color }]}>{event.vibe_count || 0}</Text>
                    </View>
                    {event.lat != null && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Feather name="map-pin" size={11} color={muted} />
                        <Text style={[s.listMeta, { color: muted }]}>Pinned</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={s.dirBtn}>
                  <Feather name="chevron-right" size={20} color={primary} />
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
};

const grid = StyleSheet.create({
  canvas: { width: MAP_W, backgroundColor: "#0a1a1f", position: 'relative', overflow: 'hidden' },
  gridH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.04)' },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.04)' },
  compass: { position: 'absolute', top: 12, right: 14, alignItems: 'center', gap: 2 },
  compassN: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '800' },
  userDot: { position: 'absolute', width: 16, height: 16 },
  userPulse: { position: 'absolute', width: 28, height: 28, borderRadius: 14, borderWidth: 2, top: -6, left: -6, opacity: 0.4 },
  userCenter: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#fff' },
  pin: { position: 'absolute', width: 36, height: 36, alignItems: 'center' },
  pinCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  pinTip: { width: 8, height: 8, borderRadius: 4, marginTop: -2 },
  callout: {
    position: 'absolute', backgroundColor: "#111a1f", borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', zIndex: 99,
    shadowColor: '#000', shadowOpacity: 0.7, shadowRadius: 12, elevation: 12,
  },
  calloutImg: { width: '100%', height: 80 },
  calloutTitle: { color: '#fff', fontSize: 13, fontWeight: '800', padding: 10, paddingBottom: 4 },
  calloutVenue: { color: "#9ca3af", fontSize: 11, paddingHorizontal: 10, paddingBottom: 8 },
  calloutDistance: { fontSize: 11, fontWeight: '800', paddingHorizontal: 10, paddingBottom: 8 },
  calloutActions: { flexDirection: 'row', gap: 8, paddingHorizontal: 10, paddingBottom: 10 },
  calloutBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  calloutBtnText: { color: '#000', fontWeight: '900', fontSize: 12 },
  calloutDirBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8 },
  calloutDirText: { color: "#9ca3af", fontSize: 11 },
  noCoords: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  noCoordsText: { color: 'rgba(255,255,255,0.3)', fontSize: 14, fontWeight: '600' },
  noCoordsText2: { color: 'rgba(255,255,255,0.2)', fontSize: 12 },
});

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingBottom: 14,
    paddingBottom: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  headerSub: { fontSize: 12, marginTop: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', gap: 20, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11 },
  listHeader: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  listRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginBottom: 10, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  listThumb: { width: 72, height: 72 },
  listInfo: { flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
  listTitle: { fontSize: 14, fontWeight: '800' },
  listVenue: { fontSize: 12, marginTop: 2 },
  listMeta: { fontSize: 11, fontWeight: '700' },
  dirBtn: { paddingRight: 14, paddingLeft: 4 },
});
