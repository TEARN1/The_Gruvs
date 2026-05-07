/**
 * EventMapView.js
 * Full-screen map modal showing event markers for "The Gruvs".
 * Falls back to a scrollable list on web or if react-native-maps is unavailable.
 */

import React, { useRef, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
  Platform,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

// ── Attempt to load react-native-maps ────────────────────────────────────────
let MapView = null;
let Marker = null;
let Callout = null;

if (Platform.OS !== 'web') {
  try {
    const RNMaps = require('react-native-maps');
    MapView = RNMaps.default;
    Marker = RNMaps.Marker;
    Callout = RNMaps.Callout;
  } catch (_) {
    // react-native-maps not installed — will use fallback list
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CAPE_TOWN = { latitude: -33.9249, longitude: 18.4241 };
const DELTA = { latitudeDelta: 0.08, longitudeDelta: 0.08 };
const BG = '#0d1112';

// ── Category → emoji map ──────────────────────────────────────────────────────
const CATEGORY_EMOJI = {
  music:      '🎵',
  nightlife:  '🌙',
  sport:      '⚡',
  art:        '🎨',
  food:       '🍽️',
  culture:    '🏛️',
  wellness:   '🧘',
  tech:       '💻',
  fashion:    '👗',
  comedy:     '😂',
  outdoor:    '🌿',
  film:       '🎬',
};

function getCategoryEmoji(category) {
  if (!category) return '📍';
  return CATEGORY_EMOJI[category.toLowerCase()] ?? '📍';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function toRegion(lat, lon) {
  return { latitude: lat, longitude: lon, ...DELTA };
}

function initialRegion(userCoords, events) {
  if (userCoords?.lat != null && userCoords?.lon != null) {
    return toRegion(userCoords.lat, userCoords.lon);
  }
  const first = events?.find(e => e.lat != null && e.lon != null);
  if (first) return toRegion(first.lat, first.lon);
  return { ...CAPE_TOWN, ...DELTA };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Coloured circle shown as the map pin */
function MarkerDot({ color, emoji }) {
  return (
    <View style={[styles.markerDot, { backgroundColor: color || '#a78bfa' }]}>
      <Text style={styles.markerEmoji}>{emoji}</Text>
    </View>
  );
}

/** Custom callout bubble rendered inside <Callout> */
function EventCallout({ event, onPress, primaryColor }) {
  const thumb = event.media?.[0]?.url;
  return (
    <View style={styles.callout}>
      {thumb ? (
        <Image source={{ uri: thumb }} style={styles.calloutThumb} resizeMode="cover" />
      ) : null}
      <View style={styles.calloutBody}>
        <Text style={styles.calloutTitle} numberOfLines={2}>
          {event.title}
        </Text>
        {event.venue_name ? (
          <Text style={styles.calloutVenue} numberOfLines={1}>
            {event.venue_name}
          </Text>
        ) : null}
        <View style={styles.calloutVibeRow}>
          <Feather name="zap" size={12} color="#facc15" />
          <Text style={styles.calloutVibeText}>
            {event.vibe_count ?? 0} vibing
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.calloutBtn, { backgroundColor: primaryColor }]}
          onPress={onPress}
          activeOpacity={0.8}
        >
          <Text style={styles.calloutBtnText}>View Event</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** Single row in the fallback list */
function EventListRow({ event, onPress, primaryColor }) {
  const thumb = event.media?.[0]?.url;
  const emoji = getCategoryEmoji(event.category);
  const dotColor = event.category_color || '#a78bfa';

  return (
    <TouchableOpacity
      style={styles.listRow}
      onPress={() => onPress(event)}
      activeOpacity={0.75}
    >
      {thumb ? (
        <Image source={{ uri: thumb }} style={styles.listThumb} resizeMode="cover" />
      ) : (
        <View style={[styles.listThumbPlaceholder, { backgroundColor: dotColor }]}>
          <Text style={{ fontSize: 22 }}>{emoji}</Text>
        </View>
      )}
      <View style={styles.listRowInfo}>
        <Text style={styles.listTitle} numberOfLines={1}>
          {event.title}
        </Text>
        {event.venue_name ? (
          <Text style={styles.listVenue} numberOfLines={1}>
            <Feather name="map-pin" size={11} color="#6b7280" /> {event.venue_name}
          </Text>
        ) : null}
        {event.lat != null && event.lon != null ? (
          <Text style={styles.listCoords}>
            {Number(event.lat).toFixed(4)}, {Number(event.lon).toFixed(4)}
          </Text>
        ) : null}
        <View style={styles.calloutVibeRow}>
          <Feather name="zap" size={11} color="#facc15" />
          <Text style={styles.calloutVibeText}>{event.vibe_count ?? 0} vibing</Text>
        </View>
      </View>
      <Feather name="chevron-right" size={18} color="#4b5563" style={{ alignSelf: 'center' }} />
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export const EventMapView = ({ events = [], userCoords, onSelectEvent, visible, onClose }) => {
  const { currentTheme } = useTheme();
  const primaryColor = currentTheme?.primary ?? '#a78bfa';
  const mapRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);

  const region = useMemo(() => initialRegion(userCoords, events), [userCoords, events]);

  const handleSelectEvent = useCallback(
    (event) => {
      if (onSelectEvent) onSelectEvent(event);
      if (onClose) onClose();
    },
    [onSelectEvent, onClose],
  );

  const useMapView = MapView !== null && Platform.OS !== 'web';

  // ── Header ─────────────────────────────────────────────────────────────────
  const Header = (
    <View style={styles.header}>
      <View>
        <Text style={styles.headerTitle}>Events Near You</Text>
        <Text style={styles.headerSub}>
          {events.length} {events.length === 1 ? 'event' : 'events'}
        </Text>
      </View>
      <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
        <Feather name="x" size={20} color="#f9fafb" />
      </TouchableOpacity>
    </View>
  );

  // ── Map content ────────────────────────────────────────────────────────────
  const MapContent = useMapView ? (
    <MapView
      ref={mapRef}
      style={styles.map}
      mapType="standard"
      userInterfaceStyle="dark"
      initialRegion={region}
      showsUserLocation={userCoords != null}
      showsMyLocationButton={userCoords != null}
      showsCompass={false}
    >
      {events.map((event) => {
        if (event.lat == null || event.lon == null) return null;
        const emoji = getCategoryEmoji(event.category);
        const dotColor = event.category_color || primaryColor;
        return (
          <Marker
            key={event.id}
            coordinate={{ latitude: event.lat, longitude: event.lon }}
            onPress={() => setSelectedId(event.id)}
          >
            <MarkerDot color={dotColor} emoji={emoji} />
            <Callout tooltip onPress={() => handleSelectEvent(event)}>
              <EventCallout
                event={event}
                onPress={() => handleSelectEvent(event)}
                primaryColor={primaryColor}
              />
            </Callout>
          </Marker>
        );
      })}
    </MapView>
  ) : null;

  // ── Fallback list ──────────────────────────────────────────────────────────
  const FallbackList = !useMapView ? (
    <ScrollView
      style={styles.fallbackList}
      contentContainerStyle={styles.fallbackContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.fallbackBanner}>
        <Feather name="map-off" size={16} color="#6b7280" />
        <Text style={styles.fallbackBannerText}>
          {Platform.OS === 'web'
            ? 'Map view is not supported on web.'
            : 'Map unavailable — react-native-maps not installed.'}
        </Text>
      </View>
      {events.map((event) => (
        <EventListRow
          key={event.id}
          event={event}
          onPress={handleSelectEvent}
          primaryColor={primaryColor}
        />
      ))}
    </ScrollView>
  ) : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {Header}
        {useMapView ? MapContent : FallbackList}
      </View>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  // ── Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    paddingBottom: 12,
    paddingHorizontal: 18,
    backgroundColor: '#111618',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    zIndex: 10,
  },
  headerTitle: {
    color: '#f9fafb',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerSub: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Map
  map: {
    flex: 1,
    width: SCREEN_W,
  },

  // ── Marker dot
  markerDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff22',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  markerEmoji: {
    fontSize: 16,
  },

  // ── Callout
  callout: {
    width: 220,
    backgroundColor: '#111618',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1f2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 10,
  },
  calloutThumb: {
    width: '100%',
    height: 100,
  },
  calloutBody: {
    padding: 12,
  },
  calloutTitle: {
    color: '#f9fafb',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  calloutVenue: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 6,
  },
  calloutVibeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  calloutVibeText: {
    color: '#facc15',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  calloutBtn: {
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  calloutBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ── Fallback list
  fallbackList: {
    flex: 1,
    backgroundColor: BG,
  },
  fallbackContent: {
    paddingBottom: 40,
    paddingTop: 8,
  },
  fallbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: '#1f2937',
    borderRadius: 10,
    padding: 12,
  },
  fallbackBannerText: {
    color: '#6b7280',
    fontSize: 13,
    flex: 1,
    marginLeft: 8,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#111618',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  listThumb: {
    width: 80,
    height: 80,
  },
  listThumbPlaceholder: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listRowInfo: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  listTitle: {
    color: '#f9fafb',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  listVenue: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 4,
  },
  listCoords: {
    color: '#4b5563',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    marginBottom: 4,
  },
});

export default EventMapView;
