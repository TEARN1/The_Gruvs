/**
 * NowPlayingBar — real-time "currently playing" strip for music/festival events.
 * Drop it anywhere inside an event detail screen.
 * Shows artist name + song title with a pulsing live indicator.
 * Subscribes to event_now_playing via Supabase realtime.
 * Falls back to offline cache when connection drops.
 */
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase, isSupabaseEnabled } from '../services/supabase';
import { EventCache, withCache } from '../services/offlineCache';
import { useTheme } from '../context/ThemeContext';

export const NowPlayingBar = ({ eventId, onPress }) => {
  const { colors } = useTheme();
  const primary = colors?.primary || "#00f2ff";
  const bg = colors?.card || '#111';
  const textColor = colors?.text || '#fff';
  const muted = colors?.muted || 'rgba(255,255,255,0.5)';

  const [nowPlaying, setNowPlaying] = useState(null);
  const [isStale, setIsStale] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!eventId) return;

    // Pulsing dot animation
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  useEffect(() => {
    if (!eventId || !isSupabaseEnabled) return;
    let sub;

    const load = async () => {
      const data = await withCache(
        () => EventCache.getNowPlaying(eventId),
        () => EventCache.getNowPlayingStale(eventId),
        async () => {
          const { data: rows } = await supabase
            .from('event_now_playing')
            .select('id, artist_name, song_title, started_at, lineup_id')
            .eq('event_id', eventId)
            .eq('is_active', true)
            .maybeSingle();
          return rows;
        },
        (d) => EventCache.saveNowPlaying(eventId, d),
      );

      if (data) {
        setNowPlaying(data);
        setIsStale(false);
      } else {
        // Try stale cache and show as stale
        const stale = await EventCache.getNowPlayingStale(eventId);
        if (stale) { setNowPlaying(stale); setIsStale(true); }
      }
    };

    load();

    // Realtime subscription
    sub = supabase
      .channel(`now_playing:${eventId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'event_now_playing',
        filter: `event_id=eq.${eventId}`,
      }, ({ new: row, eventType }) => {
        if (eventType === 'DELETE' || (row && !row.is_active)) {
          setNowPlaying(null);
          EventCache.saveNowPlaying(eventId, null);
        } else if (row?.is_active) {
          setNowPlaying(row);
          setIsStale(false);
          EventCache.saveNowPlaying(eventId, row);
        }
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Reconnect after 3s
          setTimeout(() => sub?.subscribe(), 3000);
        }
      });

    return () => { sub?.unsubscribe(); };
  }, [eventId]);

  if (!nowPlaying) return null;

  const elapsed = nowPlaying.started_at
    ? Math.floor((Date.now() - new Date(nowPlaying.started_at).getTime()) / 60000)
    : null;

  return (
    <TouchableOpacity
      style={[s.bar, { backgroundColor: bg, borderColor: `${primary}40` }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityLabel={`Now playing: ${nowPlaying.song_title || 'set'} by ${nowPlaying.artist_name}`}
    >
      {/* Live dot */}
      <Animated.View style={[s.dot, { backgroundColor: primary, opacity: pulse }]} />

      <View style={s.info}>
        <Text style={[s.label, { color: muted }]}>
          {isStale ? 'LAST KNOWN' : 'NOW PLAYING'}
        </Text>
        <Text style={[s.artist, { color: textColor }]} numberOfLines={1}>
          {nowPlaying.artist_name}
        </Text>
        {nowPlaying.song_title ? (
          <Text style={[s.song, { color: primary }]} numberOfLines={1}>
            {nowPlaying.song_title}
          </Text>
        ) : null}
      </View>

      <View style={s.right}>
        {elapsed !== null && (
          <Text style={[s.elapsed, { color: muted }]}>{elapsed}m</Text>
        )}
        <Feather name="music" size={16} color={primary} />
      </View>
    </TouchableOpacity>
  );
};

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  info: { flex: 1 },
  label: { fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 2 },
  artist: { fontSize: 13, fontWeight: '800' },
  song: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  right: { alignItems: 'flex-end', gap: 4 },
  elapsed: { fontSize: 10, fontWeight: '700' },
});
