/**
 * LiveEventBanner
 *
 * Full-width "LIVE NOW" banner shown on EventDetailScreen when the event is
 * currently happening.  Replaces the simple "Happening Now!" text.
 *
 * Features:
 * - Pulsing LIVE badge (animated red dot)
 * - Real-time check-in count with animated increment flash
 * - Crowd energy bar (check-ins / capacity pct)
 * - Recent arrivals ticker: last 3 people who checked in (with avatars)
 * - Quick "Add Moment" shortcut button
 * - Collapsible — taps the header to expand/collapse
 * - Subscribes to event_checkins realtime channel
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Animated, Easing, ScrollView,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { supabase } from '../services/supabase';

// ── Pulsing dot ────────────────────────────────────────────────────────────────
const PulseDot = ({ color }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale,   { toValue: 1.6, duration: 700, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
          Animated.timing(scale,   { toValue: 1,   duration: 700, useNativeDriver: true, easing: Easing.in(Easing.ease) }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0,   duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.8, duration: 700, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [scale, opacity]);

  return (
    <View style={{ width: 12, height: 12, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{
        position: 'absolute',
        width: 12, height: 12, borderRadius: 6,
        backgroundColor: color,
        transform: [{ scale }],
        opacity,
      }} />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
};

// ── Check-in count with flash animation ───────────────────────────────────────
const LiveCount = ({ count, color }) => {
  const flash = useRef(new Animated.Value(1)).current;
  const prev = useRef(count);

  useEffect(() => {
    if (count !== prev.current) {
      prev.current = count;
      Animated.sequence([
        Animated.timing(flash, { toValue: 1.4, duration: 150, useNativeDriver: true }),
        Animated.spring(flash, { toValue: 1, useNativeDriver: true, damping: 10 }),
      ]).start();
    }
  }, [count, flash]);

  return (
    <Animated.Text style={[lb.countNum, { color, transform: [{ scale: flash }] }]}>
      {count}
    </Animated.Text>
  );
};

// ── Energy bar ─────────────────────────────────────────────────────────────────
const EnergyBar = ({ pct, color }) => {
  const width = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(width, {
      toValue: Math.min(1, Math.max(0, pct)),
      useNativeDriver: false,
      damping: 14,
      stiffness: 80,
    }).start();
  }, [pct, width]);

  const barColor = pct > 0.85 ? "#ef4444" : pct > 0.6 ? "#f59e0b" : color;

  return (
    <View style={lb.energyTrack}>
      <Animated.View
        style={[
          lb.energyFill,
          {
            backgroundColor: barColor,
            width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          },
        ]}
      />
    </View>
  );
};

// ── Avatar chip ────────────────────────────────────────────────────────────────
const AvatarChip = ({ profile, color }) => {
  const bg = ["#0891b2", "#7c3aed", "#059669", "#d97706", "#db2777", "#dc2626"];
  const c = bg[(profile?.username?.charCodeAt(0) || 0) % bg.length];
  return (
    <View style={lb.chip}>
      {profile?.avatar_url
        ? <Image source={{ uri: profile.avatar_url }} style={lb.chipAvatar} />
        : <View style={[lb.chipAvatar, { backgroundColor: c, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>
              {(profile?.username || '?')[0].toUpperCase()}
            </Text>
          </View>
      }
      <Text style={[lb.chipName, { color }]} numberOfLines={1}>{profile?.username || '...'}</Text>
    </View>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
export const LiveEventBanner = ({
  event,
  primary,
  textColor,
  surface,
  onAddMoment,   // callback to open moment capture
  capacity = 0,
}) => {
  const [checkinCount, setCheckinCount] = useState(0);
  const [recentArrivals, setRecentArrivals] = useState([]); // last 3 checkin profiles
  const [expanded, setExpanded] = useState(true);
  const heightAnim = useRef(new Animated.Value(1)).current;

  const pct = capacity > 0 ? checkinCount / capacity : 0;

  const fetchState = useCallback(async () => {
    if (!event?.id) return;
    try {
      // Count
      const { count } = await supabase
        .from('event_checkins')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', event.id);
      setCheckinCount(count || 0);

      // Recent arrivals (last 3, with profile)
      const { data } = await supabase
        .from('event_checkins')
        .select('profiles:user_id(id, username, avatar_url)')
        .eq('event_id', event.id)
        .order('checked_in_at', { ascending: false })
        .limit(3);
      setRecentArrivals((data || []).map(r => r.profiles).filter(Boolean));
    } catch { /* non-blocking */ }
  }, [event?.id]);

  // Initial load
  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Realtime: listen for new check-ins
  useEffect(() => {
    if (!event?.id) return;
    const ch = supabase
      .channel(`live_banner_${event.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'event_checkins', filter: `event_id=eq.${event.id}` },
        () => {
          // Refetch to get latest profile data for arrivals ticker
          fetchState();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [event?.id, fetchState]);

  // Collapse animation
  const toggleExpand = () => {
    const toVal = expanded ? 0 : 1;
    Animated.spring(heightAnim, {
      toValue: toVal,
      useNativeDriver: false,
      damping: 16,
      stiffness: 120,
    }).start();
    setExpanded(!expanded);
  };

  const energyLabel = pct > 0.9 ? 'PACKED' : pct > 0.7 ? 'HYPE' : pct > 0.4 ? 'VIBING' : checkinCount > 0 ? 'BUILDING' : 'ARRIVING';
  const energyColor = pct > 0.85 ? "#ef4444" : pct > 0.6 ? "#f59e0b" : primary;

  return (
    <View style={[lb.root, { backgroundColor: '#ff000012', borderColor: '#ff000030' }]}>
      {/* Header row — always visible */}
      <TouchableOpacity style={lb.header} onPress={toggleExpand} activeOpacity={0.85}>
        <PulseDot color="#ef4444" />
        <Text style={lb.liveLabel}>LIVE NOW</Text>
        <View style={lb.sep} />
        <Text style={[lb.eventName, { color: textColor }]} numberOfLines={1}>{event?.title}</Text>
        <View style={{ flex: 1 }} />
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="rgba(255,255,255,0.4)" />
      </TouchableOpacity>

      {/* Expandable body */}
      {expanded && (
        <View style={lb.body}>
          {/* Stats row */}
          <View style={lb.statsRow}>
            <View style={lb.statBlock}>
              <LiveCount count={checkinCount} color={primary} />
              <Text style={lb.statLabel}>checked in</Text>
            </View>

            {capacity > 0 && (
              <View style={lb.statBlock}>
                <Text style={[lb.countNum, { color: energyColor }]}>
                  {Math.round(pct * 100)}%
                </Text>
                <Text style={lb.statLabel}>capacity</Text>
              </View>
            )}

            <View style={[lb.energyPill, { backgroundColor: `${energyColor}20`, borderColor: `${energyColor}40` }]}>
              <Text style={[lb.energyText, { color: energyColor }]}>{energyLabel}</Text>
            </View>
          </View>

          {/* Energy bar */}
          {capacity > 0 && (
            <View style={{ marginBottom: 12 }}>
              <EnergyBar pct={pct} color={primary} />
              <Text style={[lb.capText, { color: 'rgba(255,255,255,0.3)' }]}>
                {capacity - checkinCount > 0 ? `${capacity - checkinCount} spots left` : 'At capacity'}
              </Text>
            </View>
          )}

          {/* Recent arrivals */}
          {recentArrivals.length > 0 && (
            <View style={lb.arrivalsRow}>
              <Feather name="user-check" size={11} color="rgba(255,255,255,0.35)" style={{ marginRight: 6 }} />
              <Text style={lb.arrivalsLabel}>Just arrived: </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {recentArrivals.map((p, i) => (
                    <AvatarChip key={p?.id || i} profile={p} color={primary} />
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Quick moment CTA */}
          {onAddMoment && (
            <TouchableOpacity
              style={[lb.momentBtn, { backgroundColor: primary }]}
              onPress={onAddMoment}
              activeOpacity={0.85}
            >
              <Feather name="camera" size={14} color="#000" />
              <Text style={lb.momentBtnText}>Share Your Moment</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const lb = StyleSheet.create({
  root: {
    marginHorizontal: 0,
    marginBottom: 16,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  liveLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: "#ef4444",
    letterSpacing: 1.5,
  },
  sep: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  eventName: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    marginLeft: 2,
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  statBlock: {
    alignItems: 'center',
  },
  countNum: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 26,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  energyPill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginLeft: 'auto',
  },
  energyText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  energyTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginBottom: 4,
  },
  energyFill: {
    height: '100%',
    borderRadius: 3,
  },
  capText: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'right',
  },
  arrivalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  arrivalsLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '600',
    marginRight: 4,
    flexShrink: 0,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  chipName: {
    fontSize: 10,
    fontWeight: '700',
    maxWidth: 80,
  },
  momentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 12,
  },
  momentBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000',
  },
});
