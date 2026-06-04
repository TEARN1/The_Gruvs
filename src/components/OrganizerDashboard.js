/**
 * OrganizerDashboard — live stats panel visible only to the event organiser.
 * Shows real-time check-in counter, RSVP breakdown, vibe count, chat activity,
 * revenue estimate, and top attendees. Updates via Supabase Realtime.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { resilient } from '../utils/resilience';
import { money } from '../constants/currencies';

// ─── Stat card ────────────────────────────────────────────────────────────────

const StatCard = React.memo(({ icon, label, value, sub, color, pulse }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulse) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={[sc.card, { borderColor: `${color}25`, backgroundColor: `${color}08` }]}>
      <Animated.View style={[sc.iconWrap, { backgroundColor: `${color}20`, transform: [{ scale: pulseAnim }] }]}>
        <Feather name={icon} size={16} color={color} />
      </Animated.View>
      <Text style={[sc.value, { color }]}>{value ?? '—'}</Text>
      <Text style={sc.label}>{label}</Text>
      {!!sub && <Text style={sc.sub}>{sub}</Text>}
    </View>
  );
});

const sc = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 80,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  value: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  sub: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
  },
});

// ─── RSVP bar ─────────────────────────────────────────────────────────────────

const RSVPBar = ({ going, maybe, notGoing, primary }) => {
  const total = (going || 0) + (maybe || 0) + (notGoing || 0);
  if (!total) return null;
  const pct = (n) => `${Math.round((n / total) * 100)}%`;
  return (
    <View style={{ marginTop: 12, marginHorizontal: 2 }}>
      <View style={{ flexDirection: 'row', marginBottom: 6, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: primary }} />
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700' }}>Going {going}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#f59e0b" }} />
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700' }}>Maybe {maybe}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#ef4444" }} />
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700' }}>Not Going {notGoing}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', height: 6, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)' }}>
        <View style={{ width: pct(going || 0), backgroundColor: primary }} />
        <View style={{ width: pct(maybe || 0), backgroundColor: "#f59e0b" }} />
        <View style={{ width: pct(notGoing || 0), backgroundColor: "#ef4444" }} />
      </View>
      <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 4, textAlign: 'right' }}>
        {total} total responses
      </Text>
    </View>
  );
};

// ─── Top attendees row ─────────────────────────────────────────────────────────

const TopAttendees = ({ attendees, primary }) => {
  if (!attendees?.length) return null;
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
        Top Vibers
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {attendees.slice(0, 8).map((a, i) => (
          <View key={a.user_id || i} style={{ backgroundColor: `${primary}15`, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: `${primary}25` }}>
            <Text style={{ color: primary, fontSize: 11, fontWeight: '800' }}>
              {a.profiles?.display_name || a.profiles?.username || 'Gruv'}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// ─── Main component ────────────────────────────────────────────────────────────

export const OrganizerDashboard = ({ event, primary, textColor, surface, muted }) => {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const channelRef = useRef(null);
  const expandAnim = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    const toVal = expanded ? 0 : 1;
    setExpanded(!expanded);
    Animated.spring(expandAnim, { toValue: toVal, useNativeDriver: false, tension: 60, friction: 10 }).start();
    if (!expanded && !stats) fetchStats();
  };

  const fetchStats = useCallback(async () => {
    if (!event?.id) return;
    setLoading(true);
    try {
      const [rsvpRes, checkinsRes, vibesRes, chatRes, attendeesRes] = await Promise.all([
        resilient(
          [() => supabase.from('event_rsvps').select('status').eq('event_id', event.id)],
          { fallbackValue: { data: [] }, label: 'OrganizerDashboard.rsvps' }
        ),
        resilient(
          [() => supabase.from('event_checkins').select('id', { count: 'exact', head: true }).eq('event_id', event.id)],
          { fallbackValue: { count: 0 }, label: 'OrganizerDashboard.checkins' }
        ),
        resilient(
          [() => supabase.from('event_vibes').select('id', { count: 'exact', head: true }).eq('event_id', event.id)],
          { fallbackValue: { count: 0 }, label: 'OrganizerDashboard.vibes' }
        ),
        resilient(
          [() => supabase.from('event_chat_messages').select('id', { count: 'exact', head: true }).eq('event_id', event.id)],
          { fallbackValue: { count: 0 }, label: 'OrganizerDashboard.chat' }
        ),
        resilient(
          [() => supabase.from('event_rsvps').select('user_id, profiles:user_id(username, display_name)').eq('event_id', event.id).eq('status', 'going').order('created_at', { ascending: false }).limit(8)],
          { fallbackValue: { data: [] }, label: 'OrganizerDashboard.attendees' }
        ),
      ]);

      const rsvps = rsvpRes?.data || [];
      const going = rsvps.filter(r => r.status === 'going').length;
      const maybe = rsvps.filter(r => r.status === 'maybe').length;
      const notGoing = rsvps.filter(r => r.status === 'not_going').length;

      const priceVal = (() => {
        if (!event.price || event.price === 'FREE' || event.price === '0') return 0;
        if (typeof event.price === 'string' && event.price.trim().startsWith('{')) {
          try {
            const p = JSON.parse(event.price);
            return parseFloat(p.general || p.vip || 0);
          } catch { return 0; }
        }
        return parseFloat(event.price) || 0;
      })();

      setStats({
        going,
        maybe,
        notGoing,
        checkins: checkinsRes?.count ?? 0,
        vibes: vibesRes?.count ?? 0,
        chat: chatRes?.count ?? 0,
        revenue: priceVal > 0 ? money(going * priceVal) : 'Free',
        revenueNote: priceVal > 0 ? `${going} × ${money(priceVal)}` : 'No entry fee',
        topAttendees: attendeesRes?.data || [],
      });
    } finally {
      setLoading(false);
    }
  }, [event?.id, event?.price]);

  // Realtime — keep checkins + rsvps live
  useEffect(() => {
    if (!event?.id || !expanded) return;

    const ch = supabase.channel(`organizer_dash:${event.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_rsvps', filter: `event_id=eq.${event.id}` }, () => {
        fetchStats();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_checkins', filter: `event_id=eq.${event.id}` }, () => {
        setStats(prev => prev ? { ...prev, checkins: prev.checkins + 1 } : prev);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_vibes', filter: `event_id=eq.${event.id}` }, (payload) => {
        setStats(prev => {
          if (!prev) return prev;
          const delta = payload.eventType === 'INSERT' ? 1 : payload.eventType === 'DELETE' ? -1 : 0;
          return { ...prev, vibes: Math.max(0, prev.vibes + delta) };
        });
      })
      .subscribe();

    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [event?.id, expanded, fetchStats]);

  const maxH = expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 600] });
  const opacity = expandAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0, 1] });

  const checkInRate = stats?.going > 0 ? Math.round((stats.checkins / stats.going) * 100) : 0;

  return (
    <View style={[dash.wrap, { borderColor: `${primary}30`, backgroundColor: `${primary}06` }]}>
      <TouchableOpacity style={dash.header} onPress={toggle} activeOpacity={0.8}>
        <View style={[dash.headerIcon, { backgroundColor: `${primary}20` }]}>
          <Feather name="activity" size={15} color={primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[dash.headerTitle, { color: primary }]}>Organizer Dashboard</Text>
          {stats && !expanded && (
            <Text style={dash.headerSub}>
              {stats.going} going · {stats.checkins} checked in · {stats.vibes} vibes
            </Text>
          )}
        </View>
        <View style={[dash.liveChip, { borderColor: `${primary}40` }]}>
          <View style={[dash.liveDot, { backgroundColor: primary }]} />
          <Text style={[dash.liveText, { color: primary }]}>LIVE</Text>
        </View>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={muted} style={{ marginLeft: 8 }} />
      </TouchableOpacity>

      <Animated.View style={{ maxHeight: maxH, overflow: 'hidden', opacity }}>
        <View style={{ padding: 14, paddingTop: 0 }}>
          {loading ? (
            <ActivityIndicator color={primary} size="small" style={{ marginVertical: 24 }} />
          ) : stats ? (
            <>
              {/* Top stat row */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <StatCard icon="check-circle" label="Going" value={stats.going} color={primary} />
                <StatCard icon="map-pin" label="Checked In" value={stats.checkins} sub={`${checkInRate}% rate`} color="#10b981" pulse={stats.checkins > 0} />
                <StatCard icon="zap" label="Vibes" value={stats.vibes} color="#f59e0b" />
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <StatCard icon="message-circle" label="Messages" value={stats.chat} color="#8b5cf6" />
                <StatCard icon="dollar-sign" label="Est. Revenue" value={stats.revenue} sub={stats.revenueNote} color="#06b6d4" />
              </View>

              {/* RSVP bar */}
              <RSVPBar going={stats.going} maybe={stats.maybe} notGoing={stats.notGoing} primary={primary} />

              {/* Top attendees */}
              <TopAttendees attendees={stats.topAttendees} primary={primary} />

              <TouchableOpacity
                style={[dash.refreshBtn, { borderColor: `${primary}30` }]}
                onPress={fetchStats}
              >
                <Feather name="refresh-cw" size={12} color={muted} />
                <Text style={[dash.refreshText, { color: muted }]}>Refresh</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
};

const dash = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  headerSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 1,
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 12,
  },
  refreshText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
