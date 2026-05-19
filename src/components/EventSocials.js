import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, FlatList, Image, ActivityIndicator,
} from 'react-native';
import { GlassView } from './GlassView';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

const RSVP_OPTIONS = [
  { key: 'going',  label: '✅ Going',  activeColor: '#10b981' },
  { key: 'maybe',  label: '🤔 Maybe',  activeColor: '#f59e0b' },
  { key: 'no',     label: '❌ Can\'t', activeColor: '#ef4444' },
];

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export const EventSocials = ({ eventId, onAuthRequired }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const [rsvpStatus, setRsvpStatus] = useState(null);
  const [rsvpCounts, setRsvpCounts] = useState({ going: 0, maybe: 0, no: 0 });
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [loadingRsvp, setLoadingRsvp] = useState(false);
  const [postingComment, setPostingComment] = useState(false);

  const primary = currentTheme?.primary || '#00f2ff';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  const fetchSocialData = useCallback(async () => {
    try {
      // RSVP counts
      const { data: rsvpData } = await supabase
        .from('event_rsvps')
        .select('status')
        .eq('event_id', eventId);

      if (rsvpData) {
        const counts = { going: 0, maybe: 0, no: 0 };
        rsvpData.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });
        setRsvpCounts(counts);
      }

      // User's own RSVP
      if (user) {
        const { data: myRsvp } = await supabase
          .from('event_rsvps')
          .select('status')
          .eq('event_id', eventId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (myRsvp) setRsvpStatus(myRsvp.status);
      }

      // Echoes (comments) with profile info
      const { data: commentData } = await supabase
        .from('echoes')
        .select('*, profiles(username, avatar_url)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (commentData) setComments(commentData);
    } catch (e) {
    }
  }, [eventId, user]);

  useEffect(() => {
    fetchSocialData();
  }, [fetchSocialData]);

  const updateVibeScore = async (amount) => {
    if (!user) return;
    const { data: profile } = await supabase
      .from('profiles')
      .select('vibe_score')
      .eq('id', user.id)
      .single();
    if (profile) {
      await supabase
        .from('profiles')
        .update({ vibe_score: (profile.vibe_score || 0) + amount })
        .eq('id', user.id);
    }
  };

  const handleRsvp = async (status) => {
    if (!user) { onAuthRequired?.(); return; }
    if (loadingRsvp) return;
    setLoadingRsvp(true);
    const { error } = await supabase
      .from('event_rsvps')
      .upsert({ event_id: eventId, user_id: user.id, status }, { onConflict: 'event_id,user_id' });
    setLoadingRsvp(false);
    if (!error) {
      setRsvpStatus(status);
      setRsvpCounts(prev => ({ ...prev, [status]: (prev[status] || 0) + 1 }));
      updateVibeScore(5);
    }
  };

  const postComment = async () => {
    if (!user) { onAuthRequired?.(); return; }
    if (!newComment.trim() || postingComment) return;
    setPostingComment(true);
    const { error } = await supabase
      .from('echoes')
      .insert({ event_id: eventId, user_id: user.id, body: newComment.trim() });
    setPostingComment(false);
    if (!error) {
      setNewComment('');
      fetchSocialData();
      updateVibeScore(2);
    }
  };

  return (
    <View style={styles.container}>
      {/* RSVP Row */}
      <View style={styles.rsvpRow}>
        {RSVP_OPTIONS.map(({ key, label, activeColor }) => {
          const isActive = rsvpStatus === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => handleRsvp(key)}
              style={[
                styles.rsvpBtn,
                {
                  backgroundColor: isActive ? activeColor : 'rgba(255,255,255,0.07)',
                  borderColor: isActive ? activeColor : 'rgba(255,255,255,0.12)',
                },
              ]}
            >
              <Text style={[styles.rsvpLabel, { color: isActive ? '#fff' : muted }]}>{label}</Text>
              <Text style={[styles.rsvpCount, { color: isActive ? 'rgba(255,255,255,0.8)' : muted }]}>
                {rsvpCounts[key] || 0}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Comment toggle */}
      <TouchableOpacity
        onPress={() => setShowComments(v => !v)}
        style={styles.commentToggle}
      >
        <Text style={[styles.commentToggleText, { color: primary }]}>
          {showComments ? '▲' : '▼'} {comments.length} Comment{comments.length !== 1 ? 's' : ''}
        </Text>
      </TouchableOpacity>

      {showComments && (
        <GlassView style={styles.commentSection}>
          {/* Comment input */}
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { color: textColor, borderColor: `${primary}40` }]}
              placeholder="Share your vibe..."
              placeholderTextColor={muted}
              value={newComment}
              onChangeText={setNewComment}
              onSubmitEditing={postComment}
              returnKeyType="send"
              maxLength={280}
            />
            <TouchableOpacity
              onPress={postComment}
              style={[styles.sendBtn, { backgroundColor: primary }, postingComment && styles.disabled]}
              disabled={postingComment}
            >
              {postingComment
                ? <ActivityIndicator size="small" color="#000" />
                : <Text style={styles.sendText}>↑</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Comments list */}
          {comments.length === 0
            ? <Text style={[styles.emptyText, { color: muted }]}>Be the first to echo this vibe!</Text>
            : comments.map(item => (
              <View key={item.id} style={styles.commentItem}>
                {item.profiles?.avatar_url
                ? <Image source={{ uri: item.profiles.avatar_url }} style={[styles.commentAvatar, { borderColor: `${primary}50` }]} />
                : <View style={[styles.commentAvatar, { borderColor: `${primary}50`, backgroundColor: '#0891b2', alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>{(item.profiles?.username || 'V')[0].toUpperCase()}</Text>
                  </View>
              }
                <View style={styles.commentBody}>
                  <View style={styles.commentHeader}>
                    <Text style={[styles.commentUser, { color: primary }]}>
                      {item.profiles?.username || 'Viber'}
                    </Text>
                    <Text style={[styles.commentTime, { color: muted }]}>
                      {formatTime(item.created_at)}
                    </Text>
                  </View>
                  <Text style={[styles.commentText, { color: textColor }]}>{item.body}</Text>
                </View>
              </View>
            ))
          }
        </GlassView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 12 },
  rsvpRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  rsvpBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  rsvpLabel: { fontSize: 11, fontWeight: '700' },
  rsvpCount: { fontSize: 13, fontWeight: '900', marginTop: 2 },
  commentToggle: { paddingVertical: 6, marginBottom: 8 },
  commentToggleText: { fontSize: 12, fontWeight: '700' },
  commentSection: { padding: 14, borderRadius: 14 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: '#000', fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.6 },
  emptyText: { textAlign: 'center', fontSize: 12, paddingVertical: 10 },
  commentItem: { flexDirection: 'row', marginBottom: 12 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, marginRight: 10, marginTop: 2 },
  commentBody: { flex: 1 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  commentUser: { fontWeight: '800', fontSize: 12 },
  commentTime: { fontSize: 10 },
  commentText: { fontSize: 13, lineHeight: 18 },
});
