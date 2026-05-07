import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl, SafeAreaView, Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { GlassView } from '../components/GlassView';
import { supabase } from '../services/supabase';

const TABS = ['Weekly', 'Monthly', 'All-Time'];

const TIER_CONFIG = [
  { label: 'Royal',    min: 10000, color: '#f5c518', icon: '👑' },
  { label: 'Platinum', min: 2000,  color: '#a5f3fc', icon: '💎' },
  { label: 'Gold',     min: 500,   color: '#fbbf24', icon: '🥇' },
  { label: 'Silver',   min: 100,   color: '#94a3b8', icon: '🥈' },
  { label: 'Bronze',   min: 0,     color: '#b45309', icon: '🥉' },
];

const getTier = (score) => {
  return TIER_CONFIG.find(t => score >= t.min) || TIER_CONFIG[TIER_CONFIG.length - 1];
};

const RANK_COLORS = { 1: '#f5c518', 2: '#94a3b8', 3: '#b45309' };

const getAvatarBg = (username) => {
  const colors = ['#0891b2', '#7c3aed', '#dc2626', '#059669', '#d97706', '#db2777'];
  return colors[(username?.charCodeAt(0) || 0) % colors.length];
};

export const LeaderboardScreen = ({ visible, onClose }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const [tab, setTab] = useState('All-Time');
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#ffffff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface    || '#1a1f21';

  const fetchLeaderboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      let query = supabase
        .from('profiles')
        .select('id, username, avatar_url, city, vibe_score')
        .order('vibe_score', { ascending: false })
        .limit(50);

      if (tab === 'Weekly') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        query = query.gte('updated_at', weekAgo.toISOString());
      } else if (tab === 'Monthly') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        query = query.gte('updated_at', monthAgo.toISOString());
      }

      const { data } = await query;
      setProfiles(data || []);
    } catch (e) {
      console.log('Leaderboard fetch error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useEffect(() => {
    if (visible) fetchLeaderboard();
  }, [visible, fetchLeaderboard]);

  const renderTopThree = () => {
    const top = profiles.slice(0, 3);
    if (top.length === 0) return null;
    const order = top.length >= 3 ? [top[1], top[0], top[2]] : [top[0]];
    const rankOrder = top.length >= 3 ? [2, 1, 3] : [1];
    const sizeOrder = top.length >= 3 ? [72, 88, 72] : [88];

    return (
      <View style={lb.podium}>
        {order.map((p, idx) => {
          const rank = rankOrder[idx];
          const size = sizeOrder[idx];
          const rankColor = RANK_COLORS[rank] || primary;
          const tier = getTier(p.vibe_score || 0);
          const isMe = p.id === user?.id;
          return (
            <View key={p.id} style={[lb.podiumItem, rank === 1 && lb.podiumCenter]}>
              {rank === 1 && (
                <Text style={lb.crownEmoji}>👑</Text>
              )}
              <View style={[lb.podiumAvatar, { width: size, height: size, borderRadius: size / 2, borderColor: rankColor }]}>
                {p.avatar_url ? (
                  <Image source={{ uri: p.avatar_url }} style={{ width: size, height: size, borderRadius: size / 2 }} />
                ) : (
                  <View style={[lb.podiumAvatarFallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: getAvatarBg(p.username) }]}>
                    <Text style={[lb.initials, { fontSize: rank === 1 ? 28 : 22 }]}>
                      {(p.username || 'G')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              <View style={[lb.rankBadge, { backgroundColor: rankColor }]}>
                <Text style={lb.rankBadgeText}>#{rank}</Text>
              </View>
              <Text style={[lb.podiumName, { color: isMe ? primary : textColor }]} numberOfLines={1}>
                {p.username || 'Unknown'}
              </Text>
              <Text style={[lb.podiumScore, { color: rankColor }]}>
                <Feather name="zap" size={11} color={rankColor} /> {p.vibe_score || 0}
              </Text>
              <View style={[lb.tierChip, { backgroundColor: `${tier.color}22`, borderColor: tier.color }]}>
                <Text style={[lb.tierChipText, { color: tier.color }]}>{tier.icon} {tier.label}</Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderItem = ({ item, index }) => {
    const rank = index + 1;
    const tier = getTier(item.vibe_score || 0);
    const isMe = item.id === user?.id;
    if (rank <= 3) return null;

    return (
      <View style={[
        lb.row,
        { borderBottomColor: `${primary}12` },
        isMe && { borderWidth: 1, borderColor: primary, borderRadius: 12, marginHorizontal: 4, marginBottom: 4 },
      ]}>
        <Text style={[lb.rankNum, { color: muted, width: 30 }]}>#{rank}</Text>
        <View style={[lb.rowAvatar, { backgroundColor: getAvatarBg(item.username) }]}>
          {item.avatar_url
            ? <Image source={{ uri: item.avatar_url }} style={lb.rowAvatarImg} />
            : <Text style={lb.rowInitials}>{(item.username || 'G')[0].toUpperCase()}</Text>
          }
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[lb.rowName, { color: isMe ? primary : textColor }]} numberOfLines={1}>
            {item.username || 'Unknown'}
          </Text>
          {!!item.city && (
            <Text style={[lb.rowCity, { color: muted }]}>{item.city}</Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <View style={lb.scoreRow}>
            <Feather name="zap" size={12} color={primary} />
            <Text style={[lb.scoreText, { color: primary }]}>{item.vibe_score || 0}</Text>
          </View>
          <View style={[lb.tierChip, { backgroundColor: `${tier.color}22`, borderColor: tier.color }]}>
            <Text style={[lb.tierChipText, { color: tier.color }]}>{tier.icon} {tier.label}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[lb.overlay, { backgroundColor: `${bg}F5` }]}>
        <SafeAreaView style={{ flex: 1 }}>
          {/* Header */}
          <View style={lb.header}>
            <Text style={[lb.headerTitle, { color: primary }]}>LEADERBOARD</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={22} color={textColor} />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={[lb.tabRow, { backgroundColor: surface }]}>
            {TABS.map(t => {
              const isActive = tab === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[lb.tabBtn, isActive && { backgroundColor: primary }]}
                  onPress={() => setTab(t)}
                >
                  <Text style={[lb.tabText, { color: isActive ? '#000' : muted }]}>{t}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {loading ? (
            <ActivityIndicator color={primary} size="large" style={{ marginTop: 60 }} />
          ) : (
            <FlatList
              data={profiles}
              keyExtractor={item => item.id}
              renderItem={renderItem}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={renderTopThree()}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => fetchLeaderboard(true)}
                  tintColor={primary}
                />
              }
              ListEmptyComponent={
                <View style={lb.empty}>
                  <Feather name="award" size={44} color={muted} />
                  <Text style={[lb.emptyText, { color: muted }]}>No rankings yet</Text>
                </View>
              }
              contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16 }}
            />
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const lb = StyleSheet.create({
  overlay: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  headerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 3,
  },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabText: { fontSize: 12, fontWeight: '800' },
  podium: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingVertical: 20,
    gap: 12,
    paddingHorizontal: 8,
  },
  podiumItem: { alignItems: 'center', flex: 1, gap: 4 },
  podiumCenter: { marginBottom: 16 },
  crownEmoji: { fontSize: 24, marginBottom: 4 },
  podiumAvatar: { borderWidth: 3, overflow: 'hidden' },
  podiumAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#fff', fontWeight: '900' },
  rankBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 6,
  },
  rankBadgeText: { color: '#000', fontSize: 11, fontWeight: '900' },
  podiumName: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
  podiumScore: { fontSize: 12, fontWeight: '700' },
  tierChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 2,
  },
  tierChipText: { fontSize: 10, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  rankNum: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  rowAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  rowAvatarImg: { width: 40, height: 40, borderRadius: 20 },
  rowInitials: { color: '#fff', fontWeight: '900', fontSize: 15 },
  rowName: { fontSize: 14, fontWeight: '800' },
  rowCity: { fontSize: 11, marginTop: 1 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  scoreText: { fontSize: 13, fontWeight: '900' },
  empty: { alignItems: 'center', paddingTop: 70, gap: 12 },
  emptyText: { fontSize: 16, fontWeight: '800' },
});
