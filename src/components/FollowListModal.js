/**
 * FollowListModal — "who follows me / who am I following", tappable from the
 * profile stats row. Fetches via the follows FK-hint embeds (works on the live
 * composite-PK table — never select `id` on follows).
 */
import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';
import { useBackClose } from '../hooks/useBackClose';

export const FollowListModal = ({ visible, onClose, userId, mode = 'followers', onOpenProfile }) => {
  useBackClose(visible, onClose);
  const { currentTheme } = useTheme();
  const primary = currentTheme?.primary || '#00f2ff';
  const bg = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  const [people, setPeople] = useState(null); // null = loading

  useEffect(() => {
    if (!visible || !userId) return;
    let alive = true;
    setPeople(null);
    (async () => {
      try {
        const q = mode === 'followers'
          ? supabase.from('follows')
              .select('created_at, profiles!follows_follower_id_fkey(id, username, display_name, avatar_url, vibe_score, is_verified)')
              .eq('following_id', userId)
          : supabase.from('follows')
              .select('created_at, profiles!follows_following_id_fkey(id, username, display_name, avatar_url, vibe_score, is_verified)')
              .eq('follower_id', userId);
        const { data } = await q.order('created_at', { ascending: false }).limit(200);
        if (alive) setPeople((data || []).map(r => r.profiles).filter(Boolean));
      } catch { if (alive) setPeople([]); }
    })();
    return () => { alive = false; };
  }, [visible, userId, mode]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={fl.overlay}>
        <View style={[fl.sheet, { backgroundColor: bg, borderColor: `${primary}30` }]}>
          <View style={fl.header}>
            <Text style={[fl.title, { color: textColor }]}>
              {mode === 'followers' ? 'Your Crew' : 'Following'}
              {Array.isArray(people) ? `  ·  ${people.length}` : ''}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={22} color={textColor} />
            </TouchableOpacity>
          </View>

          {people === null ? (
            <ActivityIndicator color={primary} style={{ marginVertical: 30 }} />
          ) : people.length === 0 ? (
            <View style={fl.empty}>
              <Feather name="users" size={30} color={muted} />
              <Text style={[fl.emptyText, { color: muted }]}>
                {mode === 'followers'
                  ? 'No followers yet — post Gruvs and show up, your crew will find you.'
                  : "You aren't following anyone yet. Follow hosts you rate to see their drops first."}
              </Text>
            </View>
          ) : (
            <FlatList
              data={people}
              keyExtractor={p => p.id}
              style={{ maxHeight: 480 }}
              renderItem={({ item: p }) => (
                <TouchableOpacity
                  style={[fl.row, { borderBottomColor: `${primary}12` }]}
                  onPress={() => onOpenProfile?.(p)}
                  activeOpacity={onOpenProfile ? 0.7 : 1}
                >
                  {p.avatar_url
                    ? <Image source={{ uri: p.avatar_url }} style={fl.avatar} />
                    : <View style={[fl.avatar, { backgroundColor: `${primary}22`, alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ color: primary, fontWeight: '900' }}>{(p.username || '?')[0].toUpperCase()}</Text>
                      </View>}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text style={[fl.name, { color: textColor }]} numberOfLines={1}>
                        {p.display_name || p.username || 'Viber'}
                      </Text>
                      {p.is_verified && (
                        <View style={[fl.verified, { backgroundColor: primary }]}>
                          <Feather name="check" size={8} color="#000" />
                        </View>
                      )}
                    </View>
                    <Text style={[fl.handle, { color: muted }]} numberOfLines={1}>@{p.username || 'viber'}</Text>
                  </View>
                  {Number(p.vibe_score) > 0 && (
                    <Text style={[fl.vibe, { color: primary }]}>⚡ {p.vibe_score}</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const fl = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, paddingBottom: Platform.OS === 'web' ? 20 : 34, maxHeight: '80%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, paddingBottom: 12 },
  title: { fontSize: 17, fontWeight: '900' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 30, paddingHorizontal: 24 },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 11, borderBottomWidth: 1 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  name: { fontSize: 14.5, fontWeight: '800', flexShrink: 1 },
  handle: { fontSize: 12, marginTop: 1 },
  verified: { width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  vibe: { fontSize: 12, fontWeight: '900' },
});

export default FollowListModal;
