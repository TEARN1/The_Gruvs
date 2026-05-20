import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image,
  StyleSheet, RefreshControl, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { MessageManager, isOnline as checkOnline } from '../services/dataFlow';
import { DirectMessageModal } from '../components/DirectMessageModal';
import { thumb } from '../utils/storageThumb';
import { CrewFeedScreen } from './CrewFeedScreen';

const fmtAge = (ts) => {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

const avatarBg = (name) => {
  const colors = ['#0891b2', '#7c3aed', '#dc2626', '#059669', '#d97706', '#db2777'];
  return colors[(name?.charCodeAt(0) || 0) % colors.length];
};

// ── Conversation Row ──────────────────────────────────────────────────────────
const ConvoRow = ({ item, userId, primary, textColor, muted, surface, onPress }) => {
  const partner      = item.partner;
  const isUnread     = !item.read_at && item.recipient_id === userId;
  const isPending    = item.is_request && !item.request_accepted && item.recipient_id === userId;
  const lastMsg      = item.body || '';

  const unreadLabel = isUnread ? ', unread' : '';
  const previewLabel = isPending ? 'wants to link up' : (item.sender_id === userId ? `You: ${lastMsg}` : lastMsg);
  const timeLabel = item.created_at ? `, ${fmtAge(item.created_at)}` : '';
  const rowLabel = `@${partner?.username || 'Unknown'}${unreadLabel}, ${previewLabel}${timeLabel}`;

  return (
    <TouchableOpacity
      style={[cs.row, { borderBottomColor: `${primary}12` }]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={rowLabel}
      accessibilityHint="Double-tap to open conversation"
    >
      {/* Avatar */}
      <View style={{ position: 'relative' }}>
        {partner?.avatar_url
          ? <Image source={{ uri: thumb.avatar(partner.avatar_url) }} style={cs.avatar} />
          : <View style={[cs.avatar, { backgroundColor: avatarBg(partner?.username), alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>
                {(partner?.username || '?').slice(0, 2).toUpperCase()}
              </Text>
            </View>
        }
        {checkOnline(partner) && (
          <View style={[cs.onlineDot, { borderColor: surface }]} />
        )}
      </View>

      {/* Text */}
      <View style={cs.info}>
        <View style={cs.topRow}>
          <Text style={[cs.name, { color: textColor }, isUnread && { fontWeight: '900' }]} numberOfLines={1}>
            @{partner?.username || 'Unknown'}
          </Text>
          <Text style={[cs.time, { color: muted }]}>{fmtAge(item.created_at)}</Text>
        </View>
        <View style={cs.bottomRow}>
          {isPending
            ? <Text style={[cs.preview, { color: primary, fontWeight: '800' }]} numberOfLines={1}>
                🔔 Wants to link up
              </Text>
            : <Text style={[cs.preview, { color: isUnread ? textColor : muted, fontWeight: isUnread ? '700' : '400' }]} numberOfLines={1}>
                {item.sender_id === userId ? 'You: ' : ''}{lastMsg}
              </Text>
          }
          {isUnread && (
            <View style={[cs.unreadDot, { backgroundColor: primary }]} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const cs = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1 },
  avatar:    { width: 50, height: 50, borderRadius: 25 },
  onlineDot: { position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, borderRadius: 7, backgroundColor: '#10b981', borderWidth: 2 },
  info:      { flex: 1, marginLeft: 14 },
  topRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  name:      { fontSize: 14, fontWeight: '700', flex: 1 },
  time:      { fontSize: 11, marginLeft: 8 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  preview:   { fontSize: 13, flex: 1 },
  unreadDot: { width: 9, height: 9, borderRadius: 5, marginLeft: 8 },
});

const CONVO_ROW_HEIGHT = 79; // paddingVertical 14*2 + avatar 50 + 1 border

// ── Main ChatsScreen ──────────────────────────────────────────────────────────
export const ChatsScreen = ({ onAuthRequired }) => {
  const { currentTheme }  = useTheme();
  const { user }          = useAuth();

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface    || '#1a1f21';

  const [pageMode,    setPageMode]    = useState('chats'); // 'chats' | 'crew'
  const [convos,      setConvos]      = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);
  const [search,      setSearch]      = useState('');
  const [activeConvo, setActiveConvo] = useState(null);  // partner profile for DM modal
  const unsubRef = useRef(null);

  const fetchConvos = useCallback(async (isRefresh = false) => {
    if (!user) { setConvos([]); return; }
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await MessageManager.getConversations(user.id);
      setConvos(data || []);
    } catch {
      // Convos are best-effort — keep existing list on transient failure
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchConvos();
    if (!user) return;
    // Real-time: any new/updated message refreshes the inbox
    unsubRef.current = MessageManager.subscribeUnreadCount(user.id, () => {
      fetchConvos();
    });
    return () => unsubRef.current?.();
  }, [fetchConvos, user]);

  const filtered = useMemo(() => search.trim()
    ? convos.filter(c => (c.partner?.username || '').toLowerCase().includes(search.toLowerCase()))
    : convos,
  [convos, search]);

  const pendingCount = useMemo(
    () => convos.filter(c => c.is_request && !c.request_accepted && c.recipient_id === user?.id).length,
    [convos, user?.id],
  );

  const renderConvoRow = useCallback(({ item }) => (
    <ConvoRow
      item={item}
      userId={user.id}
      primary={primary}
      textColor={textColor}
      muted={muted}
      surface={surface}
      onPress={() => setActiveConvo(item.partner)}
    />
  ), [user?.id, primary, textColor, muted, surface]);

  if (!user) {
    return (
      <SafeAreaView style={[ch.screen, { backgroundColor: bg }]}>
        <View style={ch.unauthWrap}>
          <Feather name="message-circle" size={52} color={muted} />
          <Text style={[ch.unauthTitle, { color: textColor }]}>Sign in to see your Chats</Text>
          <Text style={[ch.unauthSub, { color: muted }]}>Link up with other Vibers in real time</Text>
          {onAuthRequired && (
            <TouchableOpacity style={[ch.signInBtn, { backgroundColor: primary }]} onPress={onAuthRequired}>
              <Text style={{ color: '#000', fontWeight: '900', fontSize: 14 }}>Sign In</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[ch.screen, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={ch.header}>
        <Text style={[ch.title, { color: primary }]}>LINKED UP</Text>
        {pendingCount > 0 && pageMode === 'chats' && (
          <View style={[ch.pendingBadge, { backgroundColor: `${primary}20`, borderColor: `${primary}40` }]}>
            <Feather name="bell" size={12} color={primary} />
            <Text style={[ch.pendingText, { color: primary }]}>{pendingCount} request{pendingCount > 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>

      {/* Segment toggle: Chats | Crew */}
      <View style={[ch.segWrap, { borderBottomColor: `${primary}18` }]}>
        {[{ key: 'chats', label: 'Chats', icon: 'message-circle' }, { key: 'crew', label: 'Crew', icon: 'users' }].map(s => (
          <TouchableOpacity
            key={s.key}
            style={[ch.segBtn, pageMode === s.key && { borderBottomColor: primary, borderBottomWidth: 2 }]}
            onPress={() => setPageMode(s.key)}
          >
            <Feather name={s.icon} size={14} color={pageMode === s.key ? primary : muted} />
            <Text style={[ch.segLabel, { color: pageMode === s.key ? primary : muted }]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {pageMode === 'crew' ? (
        <CrewFeedScreen onAuthRequired={onAuthRequired} />
      ) : (
        <>
          {/* Search */}
          <View style={[ch.searchWrap, { backgroundColor: surface, borderColor: `${primary}20` }]}>
            <Feather name="search" size={15} color={muted} />
            <TextInput
              style={[ch.searchInput, { color: textColor }]}
              placeholder="Search conversations..."
              placeholderTextColor={muted}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Feather name="x" size={15} color={muted} />
              </TouchableOpacity>
            )}
          </View>

          {/* List */}
          {loading ? (
            <View style={{ paddingTop: 6 }}>
              {[...Array(7)].map((_, i) => (
                <View key={i} style={[cs.row, { borderBottomColor: `${primary}12` }]}>
                  <View style={[cs.avatar, { backgroundColor: `${primary}12` }]} />
                  <View style={{ flex: 1, marginLeft: 14, gap: 10 }}>
                    <View style={{ height: 13, width: '50%', borderRadius: 6, backgroundColor: `${primary}12` }} />
                    <View style={{ height: 11, width: '75%', borderRadius: 6, backgroundColor: `${primary}08` }} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={item => item.id}
              renderItem={renderConvoRow}
              showsVerticalScrollIndicator={false}
              getItemLayout={(_, index) => ({ length: CONVO_ROW_HEIGHT, offset: CONVO_ROW_HEIGHT * index, index })}
              contentContainerStyle={{ paddingBottom: 140 }}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => fetchConvos(true)} tintColor={primary} />
              }
              ListEmptyComponent={
                <View style={ch.empty}>
                  <Feather name="message-circle" size={44} color={muted} />
                  <Text style={[ch.emptyTitle, { color: textColor }]}>No conversations yet</Text>
                  <Text style={[ch.emptySub, { color: muted }]}>
                    {search ? 'No chats match that name' : 'Tap a Viber\'s profile and hit the message button to link up'}
                  </Text>
                </View>
              }
            />
          )}

          {/* DM Modal */}
          {activeConvo && (
            <DirectMessageModal
              visible={!!activeConvo}
              recipient={activeConvo}
              onClose={() => {
                setActiveConvo(null);
                fetchConvos();
              }}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
};

// ── useUnreadDMCount hook (for nav badge) ────────────────────────────────────
export const useUnreadDMCount = () => {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const unsubRef = useRef(null);

  useEffect(() => {
    if (!user) { setCount(0); return; }
    MessageManager.getUnreadCount(user.id).then(setCount);
    unsubRef.current = MessageManager.subscribeUnreadCount(user.id, setCount);
    return () => unsubRef.current?.();
  }, [user]);

  return count;
};

const ch = StyleSheet.create({
  screen:       { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title:        { fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1 },
  pendingText:  { fontSize: 11, fontWeight: '800' },
  searchWrap:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  searchInput:  { flex: 1, fontSize: 14 },
  empty:        { alignItems: 'center', paddingTop: 70, gap: 12, paddingHorizontal: 40 },
  emptyTitle:   { fontSize: 16, fontWeight: '800' },
  emptySub:     { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  unauthWrap:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 40 },
  unauthTitle:  { fontSize: 18, fontWeight: '900' },
  unauthSub:    { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  signInBtn:    { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14, marginTop: 8 },
  segWrap:      { flexDirection: 'row', borderBottomWidth: 1 },
  segBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  segLabel:     { fontSize: 13, fontWeight: '800' },
});
