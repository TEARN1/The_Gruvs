import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity,
  Modal, FlatList, Image, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { DirectMessageModal } from './DirectMessageModal';

const REFRESH_MS = 30_000;

const fmt = (n) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const avatarBg = (u = '') =>
  ['#0891b2', '#7c3aed', '#059669', '#d97706', '#db2777'][(u.charCodeAt(0) || 0) % 5];

export const CommunityStatsBar = () => {
  const { currentTheme } = useTheme();
  const { user }         = useAuth();
  const primary   = currentTheme?.primary    || '#00f2ff';
  const surface   = currentTheme?.surface    || '#1a1f21';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  const [onlineCount,   setOnlineCount]   = useState(0);
  const [onlineVibers,  setOnlineVibers]  = useState([]);
  const [modalVisible,  setModalVisible]  = useState(false);
  const [loadingVibers, setLoadingVibers] = useState(false);
  const [msgTarget,     setMsgTarget]     = useState(null);
  const [msgVisible,    setMsgVisible]    = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const getMutualIds = async () => {
    if (!user) return [];
    const [{ data: following }, { data: followers }] = await Promise.all([
      supabase.from('follows').select('following_id').eq('follower_id', user.id),
      supabase.from('follows').select('follower_id').eq('following_id', user.id),
    ]);
    const followingIds = new Set((following || []).map(r => r.following_id));
    return (followers || []).map(r => r.follower_id).filter(id => followingIds.has(id));
  };

  const fetchMutualOnline = async () => {
    if (!user) { setOnlineCount(0); return; }
    try {
      const mutualIds = await getMutualIds();
      if (!mutualIds.length) { setOnlineCount(0); return; }
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .in('id', mutualIds)
        .eq('is_online', true);
      setOnlineCount(count || 0);
    } catch {}
  };

  const fetchOnlineVibers = async () => {
    setLoadingVibers(true);
    try {
      const mutualIds = await getMutualIds();
      if (!mutualIds.length) { setOnlineVibers([]); return; }
      const { data } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, bio, vibe_score, is_online')
        .in('id', mutualIds)
        .eq('is_online', true)
        .order('vibe_score', { ascending: false });
      setOnlineVibers(data || []);
    } catch {} finally {
      setLoadingVibers(false);
    }
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

  const handleOpen = () => {
    setModalVisible(true);
    fetchOnlineVibers();
  };

  if (!user) return null;

  return (
    <>
      <TouchableOpacity
        style={[ss.bar, { backgroundColor: `${surface}cc`, borderColor: `${primary}18` }]}
        onPress={handleOpen}
        activeOpacity={0.8}
      >
        <Animated.View style={[ss.dot, { backgroundColor: '#10b981', transform: [{ scale: pulseAnim }] }]} />
        <Text style={[ss.count, { color: '#10b981' }]}>{fmt(onlineCount)}</Text>
        <Text style={[ss.label, { color: 'rgba(255,255,255,0.45)' }]}>
          {onlineCount === 1 ? 'mutual online' : 'mutuals online'}
        </Text>
        <Feather name="chevron-right" size={12} color="rgba(255,255,255,0.25)" style={{ marginLeft: 'auto' }} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity style={ss.backdrop} activeOpacity={1} onPress={() => setModalVisible(false)} />
        <View style={[ss.sheet, { backgroundColor: surface, borderColor: `${primary}18` }]}>
          <View style={[ss.handle, { backgroundColor: 'rgba(255,255,255,0.15)' }]} />
          <View style={[ss.sheetHeader, { borderBottomColor: 'rgba(255,255,255,0.06)' }]}>
            <Animated.View style={[ss.dot, { backgroundColor: '#10b981', transform: [{ scale: pulseAnim }] }]} />
            <Text style={[ss.sheetTitle, { color: textColor }]}>Mutuals Online Now</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={18} color={muted} />
            </TouchableOpacity>
          </View>

          {loadingVibers ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <ActivityIndicator color={primary} />
            </View>
          ) : onlineVibers.length === 0 ? (
            <View style={ss.empty}>
              <Feather name="wifi-off" size={32} color={muted} />
              <Text style={[ss.emptyText, { color: muted }]}>No mutuals online right now</Text>
            </View>
          ) : (
            <FlatList
              data={onlineVibers}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 4 }}
              renderItem={({ item }) => (
                <View style={[ss.viberRow, { borderBottomColor: `${primary}12` }]}>
                  <View style={{ position: 'relative' }}>
                    {item.avatar_url
                      ? <Image source={{ uri: item.avatar_url }} style={ss.avatar} />
                      : <View style={[ss.avatar, { backgroundColor: avatarBg(item.username), alignItems: 'center', justifyContent: 'center' }]}>
                          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>
                            {(item.username || 'V')[0].toUpperCase()}
                          </Text>
                        </View>
                    }
                    <View style={[ss.onlineDot, { borderColor: surface }]} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[ss.viberName, { color: textColor }]} numberOfLines={1}>
                      @{item.username}
                    </Text>
                    {item.bio
                      ? <Text style={[ss.viberBio, { color: muted }]} numberOfLines={1}>{item.bio}</Text>
                      : null
                    }
                  </View>
                  <TouchableOpacity
                    style={[ss.msgBtn, { backgroundColor: `${primary}18`, borderColor: `${primary}35` }]}
                    onPress={() => { setMsgTarget(item); setMsgVisible(true); setModalVisible(false); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="message-circle" size={16} color={primary} />
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>
      </Modal>

      {msgVisible && msgTarget && (
        <DirectMessageModal
          visible={msgVisible}
          onClose={() => { setMsgVisible(false); setMsgTarget(null); }}
          recipientId={msgTarget.id}
          recipientUsername={msgTarget.username}
          recipientAvatar={msgTarget.avatar_url}
        />
      )}
    </>
  );
};

const ss = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 9,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    gap: 7,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  count: { fontSize: 14, fontWeight: '900', letterSpacing: 0.3 },
  label: { fontSize: 11, fontWeight: '600' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    maxHeight: '70%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
  },
  sheetTitle: { flex: 1, fontSize: 15, fontWeight: '900' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { fontSize: 13 },
  viberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1,
  },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#10b981', borderWidth: 2,
  },
  viberName: { fontSize: 14, fontWeight: '800' },
  viberBio: { fontSize: 11 },
  msgBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
});
