import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';

const REFRESH_MS = 60_000; // re-fetch every minute

const Stat = ({ icon, value, label, color, primary }) => (
  <View style={ss.stat}>
    <Feather name={icon} size={11} color={color || primary} />
    <Text style={[ss.value, { color: color || primary }]}>{value}</Text>
    <Text style={[ss.label, { color: 'rgba(255,255,255,0.45)' }]}>{label}</Text>
  </View>
);

const fmt = (n) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

export const CommunityStatsBar = () => {
  const { currentTheme } = useTheme();
  const primary = currentTheme?.primary || '#00f2ff';
  const surface = currentTheme?.surface || '#1a1f21';

  const [stats, setStats] = useState({ users: 0, events: 0, online: 0 });
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const fetchStats = async () => {
    try {
      const [usersRes, eventsRes, onlineRes] = await Promise.allSettled([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('events').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_online', true),
      ]);
      setStats({
        users:  usersRes.status  === 'fulfilled' ? (usersRes.value.count  || 0) : 0,
        events: eventsRes.status === 'fulfilled' ? (eventsRes.value.count || 0) : 0,
        online: onlineRes.status === 'fulfilled' ? (onlineRes.value.count || 0) : 0,
      });
    } catch {}
  };

  useEffect(() => {
    fetchStats();
    const timer = setInterval(fetchStats, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  // Pulse the online dot
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.6, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  if (stats.users === 0 && stats.events === 0) return null;

  return (
    <View style={[ss.bar, { backgroundColor: `${surface}cc`, borderColor: `${primary}18` }]}>
      <Stat icon="users"      value={fmt(stats.users)}  label="Vibers"  primary={primary} />
      <View style={[ss.divider, { backgroundColor: `${primary}20` }]} />
      <Stat icon="calendar"   value={fmt(stats.events)} label="Gruvs"   primary={primary} />
      <View style={[ss.divider, { backgroundColor: `${primary}20` }]} />
      <View style={ss.stat}>
        <Animated.View style={[ss.onlineDot, { backgroundColor: '#10b981', transform: [{ scale: pulseAnim }] }]} />
        <Text style={[ss.value, { color: '#10b981' }]}>{fmt(stats.online)}</Text>
        <Text style={[ss.label, { color: 'rgba(255,255,255,0.45)' }]}>Online</Text>
      </View>
    </View>
  );
};

const ss = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    gap: 0,
  },
  stat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  value: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: 22,
    marginHorizontal: 4,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
