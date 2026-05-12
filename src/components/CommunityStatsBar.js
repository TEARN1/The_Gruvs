import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { supabase } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const REFRESH_MS = 30_000;

const fmt = (n) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

export const CommunityStatsBar = () => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const primary = currentTheme?.primary || '#00f2ff';
  const surface = currentTheme?.surface || '#1a1f21';

  const [onlineCount, setOnlineCount] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const fetchMutualOnline = async () => {
    if (!user) { setOnlineCount(0); return; }
    try {
      const [{ data: following }, { data: followers }] = await Promise.all([
        supabase.from('follows').select('following_id').eq('follower_id', user.id),
        supabase.from('follows').select('follower_id').eq('following_id', user.id),
      ]);

      const followingIds = new Set((following || []).map(r => r.following_id));
      const mutualIds = (followers || []).map(r => r.follower_id).filter(id => followingIds.has(id));

      if (mutualIds.length === 0) { setOnlineCount(0); return; }

      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .in('id', mutualIds)
        .eq('is_online', true);
      setOnlineCount(count || 0);
    } catch {}
  };

  useEffect(() => {
    fetchMutualOnline();
    const timer = setInterval(fetchMutualOnline, REFRESH_MS);
    return () => clearInterval(timer);
  }, [user]);

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

  if (!user) return null;

  return (
    <View style={[ss.bar, { backgroundColor: `${surface}cc`, borderColor: `${primary}18` }]}>
      <Animated.View style={[ss.dot, { backgroundColor: '#10b981', transform: [{ scale: pulseAnim }] }]} />
      <Text style={[ss.count, { color: '#10b981' }]}>{fmt(onlineCount)}</Text>
      <Text style={[ss.label, { color: 'rgba(255,255,255,0.45)' }]}>
        {onlineCount === 1 ? 'mutual online' : 'mutuals online'}
      </Text>
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
    paddingVertical: 9,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    gap: 7,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  count: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
});
