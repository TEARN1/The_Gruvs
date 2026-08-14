/**
 * PathMapScreen — Full-screen modal showing the user's Digital Footprint.
 * Self-built canvas (no external map library). Shows checkin dots, dashed
 * paths between them, intersection highlights, crossings, and stats.
 */
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Animated, RefreshControl, Dimensions, Image, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { supabase } from '../services/supabase';
import { resilient } from '../utils/resilience';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { GlassView } from '../components/GlassView';
import { useToast } from '../components/ToastNotification';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { WeekendPlannerCard } from '../components/WeekendPlannerCard';
import { useBackClose } from '../hooks/useBackClose';

const { width: SW, height: SH } = Dimensions.get('window');
const MAP_W = SW;
const MAP_H = SH * 0.45;
const PAD = 28;

// ---------------------------------------------------------------------------
// Haversine
// ---------------------------------------------------------------------------
const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ---------------------------------------------------------------------------
// Projection: lat/lon → canvas pixel
// ---------------------------------------------------------------------------
const project = (lat, lon, minLat, maxLat, minLon, maxLon) => {
  const rangeX = maxLon - minLon || 0.01;
  const rangeY = maxLat - minLat || 0.01;
  const x = PAD + ((lon - minLon) / rangeX) * (MAP_W - PAD * 2);
  const y = PAD + ((maxLat - lat) / rangeY) * (MAP_H - PAD * 2);
  return { x, y };
};

// ---------------------------------------------------------------------------
// Segment intersection math
// ---------------------------------------------------------------------------
const segmentsIntersect = (p1, p2, p3, p4) => {
  const d1 = { x: p2.x - p1.x, y: p2.y - p1.y };
  const d2 = { x: p4.x - p3.x, y: p4.y - p3.y };
  const cross = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(cross) < 0.001) return null; // parallel
  const t = ((p3.x - p1.x) * d2.y - (p3.y - p1.y) * d2.x) / cross;
  const u = ((p3.x - p1.x) * d1.y - (p3.y - p1.y) * d1.x) / cross;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return { x: p1.x + t * d1.x, y: p1.y + t * d1.y };
  }
  return null;
};

// ---------------------------------------------------------------------------
// Animated glowing dot
// ---------------------------------------------------------------------------
const GlowDot = ({ x, y, color, size = 12, gold = false, onPress }) => {
  const glowOpacity = useRef(new Animated.Value(0.4)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowOpacity, { toValue: 0.85, duration: 800, useNativeDriver: false }),
          Animated.timing(pulseScale, { toValue: gold ? 1.4 : 1.2, duration: 800, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(glowOpacity, { toValue: 0.35, duration: 800, useNativeDriver: false }),
          Animated.timing(pulseScale, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      style={{ position: 'absolute', left: x - size, top: y - size, zIndex: gold ? 10 : 5 }}>
      <Animated.View
        style={[
          dot.outer,
          {
            left: 0,
            top: 0,
            width: size * 2,
            height: size * 2,
            borderRadius: size,
            borderColor: color,
            shadowColor: color,
            shadowOpacity: glowOpacity,
            shadowRadius: gold ? 14 : 8,
            elevation: gold ? 10 : 6,
            transform: [{ scale: pulseScale }],
          },
        ]}
      >
        <View style={[dot.inner, { backgroundColor: color, width: size, height: size, borderRadius: size / 2 }]} />
      </Animated.View>
    </TouchableOpacity>
  );
};

const dot = StyleSheet.create({
  outer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 0 },
  },
  inner: {},
});

// ---------------------------------------------------------------------------
// Dashed line between two points
// ---------------------------------------------------------------------------
const DashedPath = ({ x1, y1, x2, y2, color }) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const dashW = 6;
  const dashGap = 5;
  const dashCount = Math.floor(length / (dashW + dashGap));

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x1,
        top: y1 - 1,
        width: length,
        height: 2,
        flexDirection: 'row',
        alignItems: 'center',
        transform: [{ rotate: `${angle}deg` }],
        transformOrigin: 'left center',
      }}
    >
      {Array.from({ length: dashCount }).map((_, i) => (
        <View
          key={i}
          style={{
            width: dashW,
            height: 2,
            backgroundColor: color,
            marginRight: dashGap,
            opacity: 0.55,
          }}
        />
      ))}
    </View>
  );
};

// ---------------------------------------------------------------------------
// The Canvas map
// ---------------------------------------------------------------------------
const FootprintCanvas = ({ checkins, paths, primary, onIntersectionPress }) => {
  const GOLD = "#FFD700";

  // Collect all coordinates to determine bounds
  const allCoords = useMemo(() => {
    const pts = [];
    checkins.forEach(c => {
      if (c.lat != null && c.lon != null) pts.push({ lat: +c.lat, lon: +c.lon });
    });
    paths.forEach(p => {
      pts.push({ lat: +p.origin_lat, lon: +p.origin_lon });
      pts.push({ lat: +p.dest_lat, lon: +p.dest_lon });
    });
    return pts;
  }, [checkins, paths]);

  const bounds = useMemo(() => {
    if (allCoords.length === 0) return { minLat: 0, maxLat: 1, minLon: 0, maxLon: 1 };
    return {
      minLat: Math.min(...allCoords.map(p => p.lat)),
      maxLat: Math.max(...allCoords.map(p => p.lat)),
      minLon: Math.min(...allCoords.map(p => p.lon)),
      maxLon: Math.max(...allCoords.map(p => p.lon)),
    };
  }, [allCoords]);

  const { minLat, maxLat, minLon, maxLon } = bounds;

  // Project checkin dots
  const pins = useMemo(() =>
    checkins
      .filter(c => c.lat != null && c.lon != null)
      .map(c => ({
        ...c,
        ...project(+c.lat, +c.lon, minLat, maxLat, minLon, maxLon),
      })),
    [checkins, bounds]
  );

  // Project path segments (consecutive checkins by date)
  const sortedPins = useMemo(() =>
    [...pins].sort((a, b) => new Date(a.checked_in_at) - new Date(b.checked_in_at)),
    [pins]
  );

  // Dashed segments between consecutive checkins
  const segments = useMemo(() => {
    const segs = [];
    for (let i = 0; i < sortedPins.length - 1; i++) {
      segs.push({ p1: sortedPins[i], p2: sortedPins[i + 1] });
    }
    return segs;
  }, [sortedPins]);

  // Intersection points between all segment pairs
  const intersections = useMemo(() => {
    const pts = [];
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 2; j < segments.length; j++) {
        const pt = segmentsIntersect(
          segments[i].p1, segments[i].p2,
          segments[j].p1, segments[j].p2
        );
        if (pt) pts.push(pt);
      }
    }
    return pts;
  }, [segments]);

  return (
    <View style={[canvas.root, { width: MAP_W, height: MAP_H }]}>
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map(f => (
        <View key={`h${f}`} style={[canvas.gridH, { top: MAP_H * f }]} />
      ))}
      {[0.25, 0.5, 0.75].map(f => (
        <View key={`v${f}`} style={[canvas.gridV, { left: MAP_W * f }]} />
      ))}

      {/* Compass rose */}
      <View style={canvas.compass}>
        <Text style={canvas.compassN}>N</Text>
        <Feather name="navigation" size={13} color="rgba(255,255,255,0.25)" />
      </View>

      {/* Dashed path lines */}
      {segments.map((seg, i) => (
        <DashedPath
          key={`seg-${i}`}
          x1={seg.p1.x} y1={seg.p1.y}
          x2={seg.p2.x} y2={seg.p2.y}
          color={primary}
        />
      ))}

      {/* Intersection gold circles */}
      {intersections.map((pt, i) => (
        <GlowDot
          key={`int-${i}`}
          x={pt.x} y={pt.y}
          color={GOLD}
          size={10}
          gold
          onPress={() => onIntersectionPress?.(pt)} />
      ))}

      {/* Checkin dots */}
      {pins.map((pin, i) => (
        <GlowDot key={`pin-${i}`} x={pin.x} y={pin.y} color={primary} size={7} />
      ))}

      {/* Empty state */}
      {pins.length === 0 && (
        <View style={canvas.empty}>
          <Feather name="map" size={32} color="rgba(255,255,255,0.15)" />
          <Text style={canvas.emptyText}>No paths recorded yet</Text>
          <Text style={canvas.emptySubtext}>Check in to events to build your footprint</Text>
        </View>
      )}
    </View>
  );
};

const canvas = StyleSheet.create({
  root: { backgroundColor: "#08161a", position: 'relative', overflow: 'hidden' },
  gridH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.04)' },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.04)' },
  compass: { position: 'absolute', top: 10, right: 12, alignItems: 'center', gap: 2 },
  compassN: { color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: '900' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 14, fontWeight: '700' },
  emptySubtext: { color: 'rgba(255,255,255,0.18)', fontSize: 12 },
});

// ---------------------------------------------------------------------------
// Crossing row
// ---------------------------------------------------------------------------
const CrossingRow = ({ crossing, primary, textColor, muted, onStar }) => {
  const avatar = crossing.profiles?.avatar_url;
  const name = crossing.profiles?.username || 'Unknown';
  const count = crossing.cross_count || 1;
  const [starred, setStarred] = useState(false);

  const handleStar = () => {
    setStarred(true);
    onStar?.(crossing.other_user_id);
  };

  return (
    <View style={[cr.row, { borderColor: `${primary}15` }]}>
      {avatar ? (
        <Image source={{ uri: avatar }} style={[cr.avatar, { borderColor: `${primary}40` }]} />
      ) : (
        <View style={[cr.avatarFallback, { backgroundColor: `${primary}20`, borderColor: `${primary}40` }]}>
          <Text style={[cr.initial, { color: primary }]}>{name[0].toUpperCase()}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[cr.name, { color: textColor }]}>{name}</Text>
        <Text style={[cr.crossText, { color: muted }]}>
          Crossed your path {count} {count === 1 ? 'time' : 'times'}
        </Text>
      </View>
      <TouchableOpacity
        style={[cr.starBtn, { backgroundColor: starred ? `${primary}20` : 'rgba(255,255,255,0.06)', borderColor: starred ? primary : 'rgba(255,255,255,0.15)' }]}
        onPress={handleStar}
        disabled={starred}
      >
        <Text style={{ fontSize: 13 }}>{starred ? '⭐' : '☆'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const cr = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2 },
  avatarFallback: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 18, fontWeight: '900' },
  name: { fontSize: 14, fontWeight: '800' },
  crossText: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  starBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});

// ---------------------------------------------------------------------------
// PathMapScreen
// ---------------------------------------------------------------------------
export const PathMapScreen = ({ visible, onClose }) => {
  useBackClose(visible, onClose);
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { show: showToast } = useToast();

  const primary = currentTheme?.primary || "#00f2ff";
  const bg = currentTheme?.background || "#0d1112";
  const surface = currentTheme?.surface || "#111c22";
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.45)';

  const [tab, setTab] = useState('paths');
  const [checkins, setCheckins] = useState([]);
  const [savedPaths, setSavedPaths] = useState([]);
  const [crossings, setCrossings] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIntersection, setSelectedIntersection] = useState(null);
  const [showTraceCreator, setShowTraceCreator] = useState(null);
  const [traceNote, setTraceNote] = useState('');
  const [loading, setLoading] = useState(true);

  // Bounds computed here so handleCanvasTap can use them
  const bounds = useMemo(() => {
    const pts = checkins
      .filter(c => c.lat != null && c.lon != null)
      .map(c => ({ lat: +c.lat, lon: +c.lon }));
    if (pts.length === 0) return { minLat: 0, maxLat: 1, minLon: 0, maxLon: 1 };
    return {
      minLat: Math.min(...pts.map(p => p.lat)),
      maxLat: Math.max(...pts.map(p => p.lat)),
      minLon: Math.min(...pts.map(p => p.lon)),
      maxLon: Math.max(...pts.map(p => p.lon)),
    };
  }, [checkins]);

  // ------------------------------------------------------------------
  // Stats derived from data
  // ------------------------------------------------------------------
  const stats = useMemo(() => {
    const cities = new Set(
      checkins.map(c => c.events?.city || c.events?.venue_city).filter(Boolean)
    );
    const events = new Set(checkins.map(c => c.event_id)).size;

    // Intersection count — consecutive path segments
    const sorted = [...checkins]
      .filter(c => c.lat && c.lon)
      .sort((a, b) => new Date(a.checked_in_at) - new Date(b.checked_in_at));
    let intersections = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      for (let j = i + 2; j < sorted.length - 1; j++) {
        const p1 = { x: +sorted[i].lon, y: +sorted[i].lat };
        const p2 = { x: +sorted[i + 1].lon, y: +sorted[i + 1].lat };
        const p3 = { x: +sorted[j].lon, y: +sorted[j].lat };
        const p4 = { x: +sorted[j + 1].lon, y: +sorted[j + 1].lat };
        if (segmentsIntersect(p1, p2, p3, p4)) intersections++;
      }
    }

    return {
      totalPaths: savedPaths.length + Math.max(0, sorted.length - 1),
      citiesVisited: cities.size,
      eventsAttended: events,
      intersections,
    };
  }, [checkins, savedPaths]);

  // ------------------------------------------------------------------
  // Fetch
  // ------------------------------------------------------------------
  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Fetch upcoming RSVPs for the user (going or maybe)
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: rsvpData } = await supabase
        .from('event_rsvps')
        // event_rsvps has no `id` column (composite PK) — selecting it 400s.
        .select('user_id, status, event_id, events(id, title, lat, lon, city, venue_name, event_date, event_time)')
        .eq('user_id', user?.id)
        .in('status', ['going', 'maybe'])
        .gte('events.event_date', todayStr);

      // Enrich RSVPs to look like checkin pins on the map sorted chronologically
      const enriched = (rsvpData || [])
        .filter(r => r.events && r.events.lat != null && r.events.lon != null)
        .map(r => ({
          id: r.id,
          user_id: r.user_id,
          event_id: r.event_id,
          checked_in_at: `${r.events.event_date}T${r.events.event_time || '00:00:00'}`,
          lat: r.events.lat,
          lon: r.events.lon,
          events: r.events
        }))
        .sort((a, b) => new Date(a.checked_in_at) - new Date(b.checked_in_at));
      setCheckins(enriched);

      // Saved paths
      const { data: pathData } = await supabase
        .from('user_paths')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      setSavedPaths(pathData || []);

      // Crossings
      const { data: crossData } = await supabase
        .from('path_crossings')
        .select('*, profiles:other_user_id(id, username, avatar_url)')
        .eq('user_id', user?.id)
        .order('cross_count', { ascending: false });
      setCrossings(crossData || []);
    } catch {
      showToast('Could not load planned path data.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, showToast]);

  useEffect(() => {
    if (visible) fetchData();
  }, [visible, fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleStar = async (toUserId) => {
    if (!user?.id) return;
    // Supabase resolves (not rejects) on errors — each tier must inspect `error`
    // and throw, or a blocked/duplicate write silently looks like success.
    await resilient(
      [
        async () => {
          const { error } = await supabase.from('path_stars').insert({ from_user_id: user?.id, to_user_id: toUserId, event_id: null });
          if (error && !/duplicate|already exists|unique/i.test(error.message || '')) throw error;
          return true;
        },
        async () => {
          const { error } = await supabase.from('path_stars').upsert({ from_user_id: user?.id, to_user_id: toUserId, event_id: null }, { onConflict: 'from_user_id,to_user_id', ignoreDuplicates: true });
          if (error) throw error;
          return true;
        },
        async () => {
          const { error } = await supabase.rpc('send_path_star', { p_from: user?.id, p_to: toUserId });
          if (error) throw error;
          return true;
        },
      ],
      { attemptsPerTier: 2, baseMs: 300, label: `PathMap.star:${toUserId}`, fallbackValue: null }
    );
  };

  const handleCanvasTap = (evt) => {
    const { locationX, locationY } = evt.nativeEvent;
    const { minLat, maxLat, minLon, maxLon } = bounds;
    const lat = maxLat - ((locationY - PAD) / (MAP_H - PAD * 2)) * (maxLat - minLat);
    const lon = minLon + ((locationX - PAD) / (MAP_W - PAD * 2)) * (maxLon - minLon);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch { }
    setTraceNote('');
    setShowTraceCreator({ x: locationX, y: locationY, lat, lon });
  };

  const handleDropTrace = async () => {
    if (!user?.id || !showTraceCreator) return;
    const note = traceNote.trim();
    const payload = { user_id: user?.id, lat: showTraceCreator.lat, lon: showTraceCreator.lon, note: note || null };
    setShowTraceCreator(null);
    setTraceNote('');
    const ok = await resilient(
      [
        async () => { const { error } = await supabase.from('path_traces').insert(payload); if (error) throw error; return true; },
        async () => { const { error } = await supabase.from('path_traces').upsert(payload); if (error) throw error; return true; },
        async () => { const { error } = await supabase.rpc('drop_path_trace', { p_user_id: user?.id, p_lat: payload.lat, p_lon: payload.lon, p_note: payload.note }); if (error) throw error; return true; },
      ],
      { attemptsPerTier: 2, baseMs: 400, label: 'PathMap.dropTrace', fallbackValue: null }
    );
    if (ok !== null) {
      showToast('Trace dropped! Vibers crossing this path will see it.', 'success');
    } else {
      showToast('Could not drop trace. Try again.', 'error');
    }
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <ErrorBoundary label="Path Map">
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[s.root, { backgroundColor: bg }]}>
        {/* Header */}
        <View
          style={[
            s.header,
            {
              paddingTop: (insets.top || 0) + 16,
              borderBottomColor: `${primary}18`,
            },
          ]}
        >
          <View>
            <Text style={[s.headerTitle, { color: textColor }]}>Path Map</Text>
            <Text style={[s.headerSub, { color: muted }]}>Forward planning — who is going where</Text>
          </View>
          <TouchableOpacity
            style={[s.closeBtn, { backgroundColor: `${primary}15`, borderColor: `${primary}30` }]}
            onPress={onClose}
          >
            <Feather name="x" size={18} color={primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={primary}
              colors={[primary]}
            />
          }
          contentContainerStyle={{ paddingBottom: (insets.bottom || 0) + 32 }}
        >
          {/* Canvas map */}
          <FootprintCanvas
            checkins={checkins}
            paths={savedPaths}
            primary={primary} // Pass primary color
            onIntersectionPress={(pt) => setSelectedIntersection(pt)} // Set selected intersection
          />

          {/* Weekend / holiday planner — suggests a Gruv for the next 5 weekends */}
          <ErrorBoundary inline label="Planner" primary={primary}>
            <WeekendPlannerCard />
          </ErrorBoundary>

          {/* Legend */}
          <View style={[s.legend, { borderColor: `${primary}12` }]}>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: primary, shadowColor: primary, shadowOpacity: 0.8, shadowRadius: 4 }]} />
              <Text style={[s.legendLabel, { color: muted }]}>Planned Stop</Text>
            </View>
            <View style={s.legendItem}>
              <View style={s.legendDash}>
                {[0, 1, 2].map(i => (
                  <View key={i} style={[s.legendDashSeg, { backgroundColor: primary }]} />
                ))}
              </View>
              <Text style={[s.legendLabel, { color: muted }]}>Optimal Route</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: "#FFD700", width: 14, height: 14, borderRadius: 7, shadowColor: "#FFD700", shadowOpacity: 0.9, shadowRadius: 6 }]} />
              <Text style={[s.legendLabel, { color: muted }]}>Meeting Spot</Text>
            </View>
          </View>

          {/* Stats row */}
          <View style={s.statsRow}>
            {[
              { label: 'Planned Journeys', value: stats.totalPaths, icon: 'navigation' },
              { label: 'Cities (Planned)', value: stats.citiesVisited, icon: 'map-pin' },
              { label: 'Events (Planned)', value: stats.eventsAttended, icon: 'calendar' },
              { label: 'Planned Crossings', value: stats.intersections, icon: 'git-commit' },
            ].map(stat => (
              <View
                key={stat.label}
                style={[s.statCard, { backgroundColor: surface, borderColor: `${primary}18` }]}
              >
                <Feather name={stat.icon} size={16} color={primary} />
                <Text style={[s.statNum, { color: textColor }]}>{stat.value}</Text>
                <Text style={[s.statLabel, { color: muted }]}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Tab strip */}
          <View style={[s.tabStrip, { borderColor: `${primary}18` }]}>
            {[
              { key: 'paths', label: 'My Paths' },
              { key: 'crossings', label: 'Crossings' },
            ].map(t => (
              <TouchableOpacity
                key={t.key}
                style={[
                  s.tabBtn,
                  tab === t.key && { borderBottomColor: primary, borderBottomWidth: 2.5 },
                ]}
                onPress={() => setTab(t.key)}
              >
                <Text
                  style={[
                    s.tabLabel,
                    { color: tab === t.key ? primary : muted },
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab content */}
          <View style={{ paddingHorizontal: 14, paddingTop: 14 }}>
            {tab === 'paths' ? (
              <>
                {checkins.length === 0 ? (
                  <View style={s.emptyState}>
                    <Feather name="map" size={30} color={`${primary}40`} />
                    <Text style={[s.emptyText, { color: muted }]}>No paths recorded yet</Text>
                    <Text style={[s.emptySubtext, { color: `${muted}80` }]}>
                      Check in to events to start your journey
                    </Text>
                  </View>
                ) : (
                  checkins.map((c, i) => (
                    <View
                      key={c.id || i}
                      style={[s.pathRow, { backgroundColor: surface, borderColor: `${primary}15` }]}
                    >
                      <View style={[s.pathDot, { backgroundColor: primary, shadowColor: primary }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.pathTitle, { color: textColor }]} numberOfLines={1}>
                          {c.events?.title || 'Unknown Event'}
                        </Text>
                        <Text style={[s.pathMeta, { color: muted }]}>
                          {new Date(c.checked_in_at).toLocaleDateString([], {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                          {(c.events?.city || c.events?.venue_city)
                            ? ` · ${c.events.city || c.events.venue_city}`
                            : ''}
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={16} color={`${primary}50`} />
                    </View>
                  ))
                )}
              </>
            ) : (
              <>
                {crossings.length === 0 ? (
                  <View style={s.emptyState}>
                    <Feather name="git-merge" size={30} color={`${primary}40`} />
                    <Text style={[s.emptyText, { color: muted }]}>No crossings found</Text>
                    <Text style={[s.emptySubtext, { color: `${muted}80` }]}>
                      Attend more events to cross paths with people
                    </Text>
                  </View>
                ) : (
                  crossings.map((c, i) => (
                    <CrossingRow
                      key={c.id || i}
                      crossing={c}
                      primary={primary}
                      textColor={textColor}
                      muted={muted}
                      onStar={handleStar}
                    />
                  ))
                )}
              </>
            )}
          </View>
        </ScrollView>

        {/* Movement Trace Creator */}
        {showTraceCreator && (
          <GlassView style={[s.traceCreator, { top: showTraceCreator.y + 40, left: Math.max(10, Math.min(SW - 210, showTraceCreator.x - 100)), borderColor: `${primary}30`, backgroundColor: bg }]}>
            <Text style={{ color: primary, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>📍 DROP A TRACE</Text>
            <TextInput
              style={{ color: textColor, fontSize: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: `${primary}30` }}
              placeholder="Leave a message here..."
              placeholderTextColor={muted}
              value={traceNote}
              onChangeText={setTraceNote}
              autoFocus
              maxLength={120}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <TouchableOpacity onPress={() => setShowTraceCreator(null)}>
                <Text style={{ color: muted, fontSize: 11 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDropTrace}>
                <Text style={{ color: primary, fontSize: 11, fontWeight: '800' }}>Drop</Text>
              </TouchableOpacity>
            </View>
          </GlassView>
        )}

        {/* Cross Path Intersection Detail */}
        {selectedIntersection && (
          <Modal
            visible={!!selectedIntersection}
            animationType="slide"
            transparent
            onRequestClose={() => setSelectedIntersection(null)}
          >
            <View style={[s.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
              <View style={[s.modalContent, { backgroundColor: bg, borderColor: `${primary}20` }]}>
                <View style={s.modalHeader}>
                  <Text style={[s.modalTitle, { color: textColor }]}>Intersection Point</Text>
                  <TouchableOpacity onPress={() => setSelectedIntersection(null)}>
                    <Feather name="x" size={20} color={textColor} />
                  </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={s.modalBody}>
                  <Text style={[s.modalBodyText, { color: muted }]}>
                    Your path has crossed this point more than once.
                    {crossings.length > 0 && '\n\nVibers you may have crossed here:'}
                  </Text>
                  {crossings.slice(0, 3).map((c, i) => (
                    <Text key={i} style={{ color: textColor, marginTop: 6, fontSize: 13, fontWeight: '700' }}>
                      @{c.profiles?.username || 'Anonymous Viber'}
                    </Text>
                  ))}
                  <TouchableOpacity
                    style={[s.sparkBtn, { backgroundColor: primary, marginTop: 20 }]}
                    onPress={async () => {
                      if (!user?.id || crossings.length === 0) {
                        showToast('No vibers to spark at this intersection.', 'info');
                        setSelectedIntersection(null);
                        return;
                      }
                      try {
                        const targets = crossings.slice(0, 3);
                        const notifications = targets.map(c => ({
                          user_id: c.other_user_id,
                          type: 'spark',
                          title: 'Someone sent you a Spark!',
                          body: 'You crossed paths — they want to connect.',
                          data: { sender_id: user?.id },
                          read: false,
                        }));
                        const ok = await resilient(
                          [
                            () => supabase.from('notifications').insert(notifications),
                            () => Promise.allSettled(targets.map(c => supabase.from('notifications').insert(notifications.find(n => n.user_id === c.other_user_id)))),
                            () => supabase.rpc('send_spark_notifications', { p_sender_id: user?.id, p_recipient_ids: targets.map(c => c.other_user_id) }),
                          ],
                          { attemptsPerTier: 2, baseMs: 400, label: 'PathMap.spark', fallbackValue: null }
                        );
                        if (ok !== null) showToast('Spark sent to Vibers you crossed paths with!', 'success');
                        else showToast('Could not send Spark. Try again.', 'error');
                      } catch {
                        showToast('Could not send Spark. Try again.', 'error');
                      }
                      setSelectedIntersection(null);
                    }}
                  >
                    <Feather name="zap" size={16} color="#000" />
                    <Text style={s.sparkBtnText}>Send a Spark</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}
      </View>
    </Modal>

    </ErrorBoundary>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: '900' },
  headerSub: { fontSize: 12, marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: {
    flexDirection: 'row',
    gap: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  legendDash: { flexDirection: 'row', gap: 2, alignItems: 'center' },
  legendDashSeg: { width: 5, height: 2, opacity: 0.7 },
  legendLabel: { fontSize: 10, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  statNum: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 9, fontWeight: '700', textAlign: 'center' },
  tabStrip: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginHorizontal: 14,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
  },
  tabLabel: { fontSize: 13, fontWeight: '800' },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: { fontSize: 15, fontWeight: '700' },
  emptySubtext: { fontSize: 12, textAlign: 'center', maxWidth: 240 },
  pathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
    marginBottom: 8,
  },
  pathDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  pathTitle: { fontSize: 13, fontWeight: '800' },
  pathMeta: { fontSize: 11, fontWeight: '500', marginTop: 2 },
});
