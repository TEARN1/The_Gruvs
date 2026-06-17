/**
 * CrossedPathsScreen — "people you keep crossing paths with." Ranks vibers who
 * have repeatedly touched down at the same events/venues as you (CheckInManager
 * .getCrossedPaths: server RPC first, client aggregation fallback). Ghost-mode
 * and non-discoverable users are excluded for privacy. Tap a person to open
 * their profile. Rendered as a ProfilePage sub-view (parent supplies the header).
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SmartImage } from '../components/SmartImage';
import { ViberProfileModal } from '../components/ViberProfileModal';
import { CheckInManager } from '../services/dataFlow';
import { thumb } from '../utils/storageThumb';

const AVATAR_BG = ['#0891b2', '#7c3aed', '#059669', '#d97706', '#db2777', '#1d4ed8'];
const initials = (n) => (n ? n.trim().slice(0, 2).toUpperCase() : 'V');
const bgFor = (n) => AVATAR_BG[(n?.charCodeAt(0) || 0) % AVATAR_BG.length];

const lastSeenLabel = (iso) => {
  if (!iso) return '';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export const CrossedPathsScreen = ({ primary, muted, textColor, bg, user, onAuthRequired }) => {
  const [people, setPeople] = useState(null); // null = loading
  const [refreshing, setRefreshing] = useState(false);
  const [profileId, setProfileId] = useState(null);

  const load = useCallback(async () => {
    if (!user) { setPeople([]); return; }
    try {
      const rows = await CheckInManager.getCrossedPaths(user.id, { limit: 50 });
      setPeople(rows || []);
    } catch {
      setPeople([]);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  if (!user) {
    return (
      <View style={[cp.center, { backgroundColor: bg }]}>
        <Feather name="shuffle" size={40} color={muted} />
        <Text style={[cp.emptyTitle, { color: textColor }]}>Sign in to see your crossings</Text>
        <TouchableOpacity onPress={onAuthRequired} style={[cp.cta, { backgroundColor: primary }]}>
          <Text style={cp.ctaText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (people === null) {
    return (
      <View style={[cp.center, { backgroundColor: bg }]}>
        <ActivityIndicator color={primary} size="large" />
        <Text style={[cp.hint, { color: muted }]}>Finding who you keep crossing…</Text>
      </View>
    );
  }

  const renderItem = ({ item }) => {
    const name = item.display_name || item.username || 'Viber';
    const venueLine = (item.venues || []).join(' · ');
    return (
      <TouchableOpacity
        style={[cp.row, { borderColor: `${primary}18` }]}
        activeOpacity={0.85}
        onPress={() => setProfileId(item.id)}
      >
        <View style={cp.avatarWrap}>
          {item.avatar_url
            ? <SmartImage source={{ uri: thumb.avatar(item.avatar_url) }} style={cp.avatar} />
            : <View style={[cp.avatar, cp.avatarFallback, { backgroundColor: bgFor(name) }]}>
                <Text style={cp.avatarText}>{initials(name)}</Text>
              </View>}
          {item.is_online && <View style={[cp.onlineDot, { borderColor: bg }]} />}
        </View>

        <View style={{ flex: 1 }}>
          <View style={cp.nameRow}>
            <Text style={[cp.name, { color: textColor }]} numberOfLines={1}>{name}</Text>
            {item.is_verified && <Feather name="check-circle" size={13} color={primary} />}
          </View>
          {!!venueLine && (
            <Text style={[cp.venues, { color: muted }]} numberOfLines={1}>📍 {venueLine}</Text>
          )}
          {!!item.lastCrossedAt && (
            <Text style={[cp.meta, { color: muted }]}>last crossed {lastSeenLabel(item.lastCrossedAt)}</Text>
          )}
        </View>

        <View style={[cp.countPill, { backgroundColor: `${primary}18`, borderColor: `${primary}40` }]}>
          <Text style={[cp.countNum, { color: primary }]}>{item.crossings}×</Text>
          <Text style={[cp.countLabel, { color: muted }]}>crossed</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <FlatList
        data={people}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} colors={[primary]} />}
        ListHeaderComponent={
          <Text style={[cp.intro, { color: muted }]}>
            Vibers you keep touching down with — same events, same energy. Tap to connect.
          </Text>
        }
        ListEmptyComponent={
          <View style={cp.center}>
            <Feather name="shuffle" size={40} color={muted} />
            <Text style={[cp.emptyTitle, { color: textColor }]}>No crossings yet</Text>
            <Text style={[cp.hint, { color: muted, textAlign: 'center', paddingHorizontal: 30 }]}>
              Touch down at a few Gruvs and the vibers you keep meeting will show up here.
            </Text>
          </View>
        }
      />

      {profileId && (
        <ViberProfileModal visible={!!profileId} userId={profileId} onClose={() => setProfileId(null)} />
      )}
    </View>
  );
};

const cp = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 80 },
  hint: { fontSize: 13 },
  intro: { fontSize: 12, lineHeight: 17, marginBottom: 14 },
  emptyTitle: { fontSize: 16, fontWeight: '900' },
  cta: { paddingHorizontal: 22, paddingVertical: 11, borderRadius: 24, marginTop: 6 },
  ctaText: { color: '#000', fontWeight: '900', fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  onlineDot: { position: 'absolute', bottom: 2, right: 2, width: 13, height: 13, borderRadius: 7, backgroundColor: '#10b981', borderWidth: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 14.5, fontWeight: '800', flexShrink: 1 },
  venues: { fontSize: 11.5, marginTop: 2 },
  meta: { fontSize: 10.5, marginTop: 2, opacity: 0.8 },
  countPill: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, borderWidth: 1 },
  countNum: { fontSize: 16, fontWeight: '900' },
  countLabel: { fontSize: 8.5, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
});

export default CrossedPathsScreen;
