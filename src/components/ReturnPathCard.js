/**
 * ReturnPathCard — "Safe Group Ride" suggestion that slides up
 * when an event is winding down (within 60 min of end_time).
 */
import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Image, Share, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pull the neighbourhood/city from a checkin's profile address fields */
const getHomeBase = (checkin) => {
  const p = checkin?.profiles;
  if (!p) return 'Unknown';
  // Try city field, then first segment of address string
  if (p.city) return p.city;
  if (p.address) return p.address.split(',')[0].trim();
  if (p.home_base) return p.home_base;
  return 'Nearby';
};

/**
 * Group an array of checkins by home_base neighbourhood.
 * Returns [{neighbourhood, members: [...checkins]}] sorted by member count desc.
 */
const groupByNeighbourhood = (checkins) => {
  const map = {};
  checkins.forEach(c => {
    const key = getHomeBase(c);
    if (!map[key]) map[key] = [];
    map[key].push(c);
  });
  return Object.entries(map)
    .map(([neighbourhood, members]) => ({ neighbourhood, members }))
    .sort((a, b) => b.members.length - a.members.length)
    .slice(0, 3);
};

/** Check if we're within 60 min of end_time, or 3h from event_date */
const shouldShowCard = (event) => {
  const now = Date.now();
  if (event?.end_time) {
    const end = new Date(event.end_time).getTime();
    return now >= end - 60 * 60 * 1000 && now <= end + 30 * 60 * 1000;
  }
  if (event?.event_date) {
    const start = new Date(event.event_date).getTime();
    return now >= start + 3 * 60 * 60 * 1000;
  }
  return false;
};

// ---------------------------------------------------------------------------
// Avatar stack
// ---------------------------------------------------------------------------
const AvatarStack = ({ members, primary }) => {
  const visible = members.slice(0, 4);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {visible.map((m, i) => {
        const avatar = m.profiles?.avatar_url;
        const name = m.profiles?.username || '?';
        const initial = name[0].toUpperCase();
        return (
          <View
            key={m.id || i}
            style={[
              av.wrap,
              { marginLeft: i === 0 ? 0 : -10, zIndex: visible.length - i },
            ]}
          >
            {avatar ? (
              <Image source={{ uri: avatar }} style={[av.img, { borderColor: "#0d1112" }]} />
            ) : (
              <View style={[av.fallback, { backgroundColor: `${primary}30`, borderColor: "#0d1112" }]}>
                <Text style={[av.initial, { color: primary }]}>{initial}</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};

const av = StyleSheet.create({
  wrap: { width: 30, height: 30, borderRadius: 15 },
  img: { width: 30, height: 30, borderRadius: 15, borderWidth: 2 },
  fallback: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 12, fontWeight: '900' },
});

// ---------------------------------------------------------------------------
// ReturnPathCard
// ---------------------------------------------------------------------------
export const ReturnPathCard = ({
  event,
  checkins = [],
  primary = "#00f2ff",
  muted = 'rgba(255,255,255,0.45)',
  textColor = '#fff',
  bg = "#0d1112",
  onDismiss,
  onCheckinsFetch,
}) => {
  const [visible, setVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(100)).current;

  // Only render within the time window
  useEffect(() => {
    const show = shouldShowCard(event);
    if (!show) {
      setVisible(false);
      return;
    }

    // Check if user has already dismissed for this event
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('gruv_return_dismissed');
        const dismissed = raw ? JSON.parse(raw) : [];
        if (dismissed.includes(event?.id)) return;
        setVisible(true);
        // Fetch checkins when card becomes visible
        onCheckinsFetch?.();
      } catch {
        setVisible(true);
        onCheckinsFetch?.();
      }
    })();
  }, [event, onCheckinsFetch]);

  // Slide up animation
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 70,
        friction: 11,
      }).start();
    } else {
      slideAnim.setValue(100);
    }
  }, [visible]);

  const groups = useMemo(
    () => groupByNeighbourhood(checkins.filter(c => c.user_id !== undefined)),
    [checkins]
  );

  // ------------------------------------------------------------------
  // Dismiss
  // ------------------------------------------------------------------
  const handleDismiss = async () => {
    Animated.timing(slideAnim, {
      toValue: 120,
      duration: 280,
      useNativeDriver: true,
    }).start(() => setVisible(false));

    try {
      const raw = await AsyncStorage.getItem('gruv_return_dismissed');
      const dismissed = raw ? JSON.parse(raw) : [];
      if (event?.id && !dismissed.includes(event.id)) {
        await AsyncStorage.setItem(
          'gruv_return_dismissed',
          JSON.stringify([...dismissed, event.id])
        );
      }
    } catch (_) {}

    onDismiss?.();
  };

  // ------------------------------------------------------------------
  // Group ride share
  // ------------------------------------------------------------------
  const handleGroupRide = async (group) => {
    const memberNames = group.members.map(m => m.profiles?.username || 'Someone').join(', ');
    const deepLink = `gruvs://event/${event?.id}?group=${encodeURIComponent(group.neighbourhood)}`;
    const message =
      `🚗 Safe Group Ride from ${group.neighbourhood}\n` +
      `Members: ${memberNames}\n` +
      `Join up: ${deepLink}`;

    try {
      await Share.share({ message, title: 'Safe Group Ride — The Gruvs' });
    } catch (_) {}
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        s.container,
        {
          backgroundColor: `${bg}F5`,
          borderColor: `${primary}30`,
          transform: [{ translateY: slideAnim }],
          ...(Platform.OS === 'android' ? { elevation: 12 } : {}),
        },
      ]}
    >
      {/* Header */}
      <View style={s.header}>
        <View style={[s.iconCircle, { backgroundColor: `${primary}18`, borderColor: `${primary}35` }]}>
          <Feather name="map" size={18} color={primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: textColor }]}>Safe Group Ride</Text>
          <Text style={[s.subtitle, { color: muted }]}>
            Event winding down — find your crew
          </Text>
        </View>
        <TouchableOpacity
          style={[s.dismissX, { borderColor: 'rgba(255,255,255,0.12)' }]}
          onPress={handleDismiss}
          activeOpacity={0.75}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="x" size={15} color={muted} />
        </TouchableOpacity>
      </View>

      {/* Group clusters */}
      {groups.length === 0 ? (
        <Text style={[s.noGroups, { color: muted }]}>No nearby groups detected yet.</Text>
      ) : (
        <View style={s.groups}>
          {groups.map((group, idx) => (
            <TouchableOpacity
              key={`${group.neighbourhood}-${idx}`}
              style={[s.groupRow, { borderColor: `${primary}18` }]}
              onPress={() => handleGroupRide(group)}
              activeOpacity={0.8}
            >
              <AvatarStack members={group.members} primary={primary} />
              <View style={s.groupInfo}>
                <Text style={[s.groupName, { color: textColor }]} numberOfLines={1}>
                  {group.neighbourhood}
                </Text>
                <Text style={[s.groupCount, { color: muted }]}>
                  {group.members.length} {group.members.length === 1 ? 'person' : 'people'}
                </Text>
              </View>
              <View style={[s.rideBtn, { backgroundColor: `${primary}18`, borderColor: `${primary}35` }]}>
                <Feather name="arrow-right" size={14} color={primary} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Footer action */}
      <TouchableOpacity
        style={[s.selfBtn, { borderColor: 'rgba(255,255,255,0.10)' }]}
        onPress={handleDismiss}
        activeOpacity={0.75}
      >
        <Text style={[s.selfBtnText, { color: muted }]}>I'll sort myself</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const s = StyleSheet.create({
  container: {
    marginHorizontal: 14,
    marginVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '900' },
  subtitle: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  dismissX: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noGroups: { fontSize: 13, textAlign: 'center', paddingVertical: 10 },
  groups: { gap: 8, marginBottom: 12 },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 13, fontWeight: '800' },
  groupCount: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  rideBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 9,
    alignItems: 'center',
  },
  selfBtnText: { fontSize: 13, fontWeight: '700' },
});
