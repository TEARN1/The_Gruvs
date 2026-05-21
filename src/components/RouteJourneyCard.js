import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GlassView } from './GlassView';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { resilient } from '../utils/resilience';

const ICON_MAP = {
  'glass-wine': 'glass-wine',
  music: 'music',
  'map-marker': 'map-marker',
  flag: 'flag',
};

export const RouteJourneyCard = ({ route, onPress }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const primary = currentTheme?.primary || '#00f2ff';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  const [joined, setJoined] = useState(route.is_joined || false);
  const [joinCount, setJoinCount] = useState(route.join_count || 0);
  const [joining, setJoining] = useState(false);

  const color = route.color || primary;
  const steps = route.steps || route.stops || [];
  const authorAvatar = route.profiles?.avatar_url || route.author_avatar || null;
  const authorName = route.profiles?.username || route.author || 'Viber';
  const vibeScore = route.vibe_score
    ? (typeof route.vibe_score === 'number' ? `${(route.vibe_score / 1000).toFixed(1)}k` : route.vibe_score)
    : joinCount > 0 ? `${joinCount}` : null;

  const handleJoin = async () => {
    if (!user || joining) return;
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    setJoining(true);
    const wasJoined = joined;
    try {
      if (joined) {
        setJoined(false);
        setJoinCount(c => Math.max(0, c - 1));
        await resilient(
          [
            () => supabase.from('route_joins').delete().eq('route_id', route.id).eq('user_id', user.id),
            () => supabase.from('route_joins').update({ active: false }).eq('route_id', route.id).eq('user_id', user.id),
            () => supabase.rpc('leave_route', { p_route_id: route.id, p_user_id: user.id }),
          ],
          { attemptsPerTier: 2, baseMs: 300, label: `RouteJourneyCard.leave:${route.id}`, fallbackValue: null }
        );
        supabase.from('routes').update({ join_count: Math.max(0, joinCount - 1) }).eq('id', route.id).then(() => {}).catch(() => {});
      } else {
        setJoined(true);
        setJoinCount(c => c + 1);
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
        await resilient(
          [
            () => supabase.from('route_joins').upsert({ route_id: route.id, user_id: user.id }, { onConflict: 'route_id,user_id', ignoreDuplicates: true }),
            () => supabase.from('route_joins').insert({ route_id: route.id, user_id: user.id }),
            () => supabase.rpc('join_route', { p_route_id: route.id, p_user_id: user.id }),
          ],
          { attemptsPerTier: 2, baseMs: 300, label: `RouteJourneyCard.join:${route.id}`, fallbackValue: null }
        );
        supabase.from('routes').update({ join_count: joinCount + 1 }).eq('id', route.id).then(() => {}).catch(() => {});
      }
    } catch {
      // rollback optimistic update
      setJoined(wasJoined);
      setJoinCount(c => wasJoined ? c + 1 : Math.max(0, c - 1));
    } finally {
      setJoining(false);
    }
  };

  return (
    <View>
      <GlassView style={styles.container}>
        <View style={styles.header}>
          <View style={[styles.badge, { backgroundColor: color }]}>
            <Text style={styles.badgeText}>ROYAL ROUTE</Text>
          </View>
          {vibeScore && <Text style={[styles.vibeCount, { color: muted }]}>🔥 {vibeScore} Vibers</Text>}
        </View>

        <Text style={[styles.title, { color: textColor }]}>{route.title || 'Unnamed Route'}</Text>
        {!!route.description && (
          <Text style={[styles.description, { color: muted }]} numberOfLines={2}>{route.description}</Text>
        )}

        {steps.length > 0 && (
          <View style={styles.pathContainer}>
            <View style={[styles.line, { backgroundColor: color, opacity: 0.3 }]} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stepsScroll}>
              {steps.map((step, i) => (
                <View key={i} style={styles.stepItem}>
                  <View style={[styles.dot, { backgroundColor: color }]}>
                    {step.icon ? (
                      <MaterialCommunityIcons name={ICON_MAP[step.icon] || 'map-marker'} size={14} color="#000" />
                    ) : (
                      <Text style={{ fontSize: 10, fontWeight: '900', color: '#000' }}>{i + 1}</Text>
                    )}
                  </View>
                  <Text style={[styles.stepTitle, { color: textColor }]} numberOfLines={1}>{step.title || step.name}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.footer}>
          <View style={styles.authorRow}>
            {authorAvatar ? (
              <Image source={{ uri: authorAvatar }} style={styles.authorAvatar} />
            ) : (
              <View style={[styles.authorAvatar, { backgroundColor: `${color}30`, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ fontSize: 9, fontWeight: '900', color }}>{authorName[0]?.toUpperCase()}</Text>
              </View>
            )}
            <Text style={[styles.authorName, { color: muted }]}>by @{authorName}</Text>
            {joinCount > 0 && (
              <Text style={[styles.authorName, { color: `${color}80` }]}>· {joinCount} joined</Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.joinBtn, joined
              ? { backgroundColor: color, borderColor: color }
              : { backgroundColor: 'transparent', borderColor: color }
            ]}
            onPress={handleJoin}
            disabled={joining || !user}
            activeOpacity={0.8}
          >
            <Text style={[styles.joinText, { color: joined ? '#000' : color }]}>
              {joining ? '...' : joined ? '✓ JOINED' : 'JOIN ROUTE'}
            </Text>
          </TouchableOpacity>
        </View>
      </GlassView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, marginHorizontal: 16, marginBottom: 16, borderRadius: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 8, fontWeight: '900', color: '#000', letterSpacing: 0.5 },
  vibeCount: { fontSize: 10, fontWeight: '700' },
  title: { fontSize: 18, fontWeight: '900', marginBottom: 6, letterSpacing: 0.3 },
  description: { fontSize: 12, lineHeight: 18, marginBottom: 16 },
  pathContainer: { marginBottom: 18, position: 'relative' },
  line: { position: 'absolute', top: 13, left: 15, right: 15, height: 2, zIndex: 0 },
  stepsScroll: { gap: 20, paddingHorizontal: 4 },
  stepItem: { alignItems: 'center', width: 76, zIndex: 1 },
  dot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  stepTitle: { fontSize: 9, fontWeight: '800', textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 14 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  authorAvatar: { width: 24, height: 24, borderRadius: 12 },
  authorName: { fontSize: 11, fontWeight: '700' },
  joinBtn: { borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16 },
  joinText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
});
