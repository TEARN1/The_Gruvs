import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Image, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

const formatAge = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

const RANK_STYLES = [
  { bg: 'rgba(124,58,237,0.3)', color: '#c084fc', label: 'Top' },
  { bg: 'rgba(245,158,11,0.3)', color: '#fbbf24', label: '2nd' },
  { bg: 'rgba(16,185,129,0.2)', color: '#34d399', label: '3rd' },
];

export const EchoSection = ({ eventId, onAuthRequired }) => {
  const { currentTheme } = useTheme();
  const { user, profile } = useAuth();
  const [echoes, setEchoes] = useState([]);
  const [text, setText] = useState('');
  const [sort, setSort] = useState('top');
  const [replyTo, setReplyTo] = useState(null);
  const [likedEchoes, setLikedEchoes] = useState(new Set());
  const [posting, setPosting] = useState(false);

  const primary = currentTheme?.primary || '#00f2ff';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const surface = currentTheme?.surface || '#1a1a1a';

  const fetchEchoes = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('echoes')
        .select('*, profiles(username, avatar_url)')
        .eq('event_id', eventId)
        .order(sort === 'top' ? 'likes' : 'created_at', { ascending: false })
        .limit(30);
      if (data) setEchoes(data);
    } catch (e) {
      console.log('Echo fetch error:', e.message);
    }
  }, [eventId, sort]);

  useEffect(() => {
    fetchEchoes();
  }, [fetchEchoes]);

  const submitEcho = async () => {
    if (!text.trim()) return;
    if (!user) { onAuthRequired(); return; }
    setPosting(true);
    const { error } = await supabase.from('echoes').insert({
      event_id: eventId,
      user_id: user.id,
      body: text.trim(),
      parent_id: replyTo?.id || null,
    });
    setPosting(false);
    if (!error) {
      setText('');
      setReplyTo(null);
      fetchEchoes();
    }
  };

  const likeEcho = async (echoId) => {
    if (!user) { onAuthRequired(); return; }
    const isCurrentlyLiked = likedEchoes.has(echoId);

    // Optimistic UI update first
    setLikedEchoes(prev => {
      const next = new Set(prev);
      isCurrentlyLiked ? next.delete(echoId) : next.add(echoId);
      return next;
    });
    setEchoes(prev => prev.map(e =>
      e.id === echoId
        ? { ...e, likes: Math.max(0, (e.likes || 0) + (isCurrentlyLiked ? -1 : 1)) }
        : e
    ));

    // Persist new count to Supabase
    const echo = echoes.find(e => e.id === echoId);
    if (echo) {
      const newCount = Math.max(0, (echo.likes || 0) + (isCurrentlyLiked ? -1 : 1));
      await supabase.from('echoes').update({ likes: newCount }).eq('id', echoId);
    }
  };

  const avatarInitials = (name) =>
    name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'G';

  const avatarColor = (name) => {
    const colors = ['#0891b2', '#0d9488', '#1d4ed8', '#65a30d', '#dc2626', '#7c3aed'];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  };

  const displayEchoes = echoes;

  const myAvatar = profile?.avatar_url;
  const myInitials = avatarInitials(profile?.username || user?.email);
  const myColor = avatarColor(profile?.username || user?.email);

  return (
    <View style={[styles.container, { borderTopColor: `${primary}18` }]}>
      {/* Sort */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>Echoes ({displayEchoes.length})</Text>
        <View style={styles.sortRow}>
          {['top', 'new'].map(s => (
            <TouchableOpacity
              key={s}
              onPress={() => setSort(s)}
              style={[styles.sortBtn, sort === s && { backgroundColor: `${primary}25` }]}
            >
              <Text style={[styles.sortText, { color: sort === s ? primary : muted }]}>
                {s === 'top' ? 'Top' : 'New'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Reply preview */}
      {replyTo && (
        <View style={[styles.replyPreview, { backgroundColor: `${primary}15`, borderColor: `${primary}30` }]}>
          <Text style={[styles.replyText, { color: primary }]}>↩ Replying to @{replyTo.username}</Text>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Text style={{ color: muted, fontSize: 14 }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Echo list */}
      {displayEchoes.length === 0
        ? <Text style={[styles.empty, { color: muted }]}>No echoes yet. Be the first.</Text>
        : displayEchoes.map((echo, idx) => {
          const rank = idx < 3 ? RANK_STYLES[idx] : null;
          const isLiked = likedEchoes.has(echo.id);
          const name = echo.profiles?.username || 'Viber';
          return (
            <View key={echo.id} style={styles.echoItem}>
              {/* Avatar */}
              {echo.profiles?.avatar_url
                ? <Image source={{ uri: echo.profiles.avatar_url }} style={styles.avatar} />
                : <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: avatarColor(name) }]}>
                    <Text style={styles.avatarText}>{avatarInitials(name)}</Text>
                  </View>
              }
              <View style={[styles.bubble, { backgroundColor: `${primary}08`, borderColor: `${primary}18` }]}>
                <View style={styles.bubbleHeader}>
                  <Text style={[styles.echoName, { color: primary }]}>{name}</Text>
                  {rank && (
                    <View style={[styles.rankBadge, { backgroundColor: rank.bg }]}>
                      <Text style={[styles.rankText, { color: rank.color }]}>{rank.label}</Text>
                    </View>
                  )}
                  <Text style={[styles.echoTime, { color: muted }]}>{formatAge(echo.created_at)}</Text>
                </View>
                <Text style={[styles.echoContent, { color: textColor }]}>{echo.body}</Text>
                <View style={styles.echoActions}>
                  <TouchableOpacity onPress={() => likeEcho(echo.id)} style={[styles.likeBtn, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                    <Feather name="heart" size={13} color={isLiked ? '#ef4444' : muted} />
                    <Text style={{ color: isLiked ? '#ef4444' : muted, fontSize: 12 }}>
                      {(echo.likes || 0) + (isLiked ? 1 : 0)}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setReplyTo({ id: echo.id, username: name })}>
                    <Text style={[styles.replyBtn, { color: muted }]}>Reply</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })
      }

      {/* Input */}
      <View style={styles.inputRow}>
        {myAvatar
          ? <Image source={{ uri: myAvatar }} style={[styles.avatar, { marginRight: 8 }]} />
          : <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: myColor, marginRight: 8 }]}>
              <Text style={styles.avatarText}>{myInitials}</Text>
            </View>
        }
        <TextInput
          style={[styles.input, { color: textColor, borderColor: `${primary}35` }]}
          placeholder={replyTo ? `Reply to @${replyTo.username}...` : 'Drop an Echo...'}
          placeholderTextColor={muted}
          value={text}
          onChangeText={setText}
          onSubmitEditing={submitEcho}
          returnKeyType="send"
          maxLength={280}
        />
        <TouchableOpacity onPress={submitEcho} style={[styles.sendBtn, { backgroundColor: primary }]} disabled={posting}>
          {posting
            ? <ActivityIndicator size="small" color="#000" />
            : <Feather name="send" size={15} color="#000" />
          }
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingTop: 14, paddingHorizontal: 14, paddingBottom: 8, borderTopWidth: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 12, fontWeight: '800' },
  sortRow: { flexDirection: 'row', gap: 4 },
  sortBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  sortText: { fontSize: 11, fontWeight: '700' },
  replyPreview: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 8, borderRadius: 8, borderWidth: 1, marginBottom: 10 },
  replyText: { fontSize: 12, fontWeight: '600' },
  empty: { fontSize: 12, textAlign: 'center', paddingVertical: 8 },
  echoItem: { flexDirection: 'row', marginBottom: 10 },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  bubble: { flex: 1, marginLeft: 8, borderWidth: 1, borderRadius: 12, padding: 10 },
  bubbleHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  echoName: { fontSize: 12, fontWeight: '800' },
  rankBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  rankText: { fontSize: 9, fontWeight: '800' },
  echoTime: { fontSize: 9, marginLeft: 'auto' },
  echoContent: { fontSize: 13, lineHeight: 18 },
  echoActions: { flexDirection: 'row', gap: 14, marginTop: 6 },
  likeBtn: {},
  replyBtn: { fontSize: 12, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  input: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8, fontSize: 13, backgroundColor: 'rgba(255,255,255,0.05)' },
  sendBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#000', fontWeight: '900', fontSize: 16 },
});
