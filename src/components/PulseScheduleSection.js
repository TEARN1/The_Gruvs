import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { resilient } from '../utils/resilience';
import { useToast } from './ToastNotification';
import * as Haptics from 'expo-haptics';

const CATEGORY_TEMPLATE = (cat = '') => {
  const c = cat.toLowerCase();
  if (['music', 'dance', 'party', 'nightlife'].includes(c)) return { type: 'The Jukebox', action: 'Request a song or set…', icon: 'music' };
  if (['food', 'wine', 'cooking', 'market'].includes(c))    return { type: 'The Menu',    action: 'Request a vibe special…', icon: 'coffee' };
  if (['sport', 'motorsport', 'esports', 'fitness'].includes(c)) return { type: 'The Fixture', action: 'Request a drill or map…', icon: 'activity' };
  if (['hackathon', 'faith', 'business', 'education'].includes(c)) return { type: 'The Forum', action: 'Request a key topic…', icon: 'message-square' };
  if (['fashion', 'arts', 'anime', 'cars'].includes(c))     return { type: 'The Showcase', action: 'Request a feature…', icon: 'star' };
  if (['mental health', 'yoga', 'parenting'].includes(c))   return { type: 'The Focus',   action: 'Vote a zen focus…', icon: 'heart' };
  return { type: 'The Spotlight', action: 'Request a prompt…', icon: 'mic' };
};

export const PulseScheduleSection = ({ eventId, eventCategory, onAuthRequired }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const [requests, setRequests]   = useState([]);
  const [myVotes, setMyVotes]     = useState(new Set());
  const [newRequest, setNewRequest] = useState('');
  const [loading, setLoading]     = useState(true);
  const [posting, setPosting]     = useState(false);

  const primary   = currentTheme?.primary   || '#00f2ff';
  const muted     = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const textColor = currentTheme?.text      || '#fff';

  const template = CATEGORY_TEMPLATE(eventCategory);

  const fetchRequests = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('pulse_requests')
        .select('*')
        .eq('event_id', eventId)
        .order('vote_count', { ascending: false })
        .limit(20);
      if (data) setRequests(data);
    } catch {}
    finally { setLoading(false); }
  }, [eventId]);

  const fetchMyVotes = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('pulse_votes')
        .select('request_id')
        .eq('user_id', user.id);
      if (data) setMyVotes(new Set(data.map(v => v.request_id)));
    } catch { /* keep existing vote state on transient failure */ }
  }, [user]);

  useEffect(() => {
    fetchRequests();
    fetchMyVotes();

    const channel = supabase.channel(`pulse:${eventId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'pulse_requests',
        filter: `event_id=eq.${eventId}`,
      }, () => fetchRequests())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [eventId, fetchRequests, fetchMyVotes]);

  const handleVote = async (requestId) => {
    if (!user) { onAuthRequired(); return; }
    if (myVotes.has(requestId)) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Optimistic
    setMyVotes(prev => new Set([...prev, requestId]));
    setRequests(prev =>
      prev.map(r => r.id === requestId ? { ...r, vote_count: r.vote_count + 1 } : r)
        .sort((a, b) => b.vote_count - a.vote_count)
    );

    try {
      const ok = await resilient(
        [
          () => supabase.from('pulse_votes').insert({ request_id: requestId, user_id: user.id }),
          () => supabase.from('pulse_votes').upsert({ request_id: requestId, user_id: user.id }, { onConflict: 'request_id,user_id', ignoreDuplicates: true }),
          () => supabase.rpc('cast_pulse_vote', { p_request_id: requestId, p_user_id: user.id }),
        ],
        { attemptsPerTier: 2, baseMs: 300, label: `PulseSchedule.vote:${requestId}`, fallbackValue: null }
      );
      if (ok !== null) {
        // Atomic increment — avoids race condition when multiple users vote simultaneously
        supabase.rpc('increment_pulse_votes', { p_request_id: requestId })
          .then(({ data }) => {
            // Sync authoritative count from server if available
            if (data?.vote_count != null) {
              setRequests(prev => prev.map(r => r.id === requestId ? { ...r, vote_count: data.vote_count } : r));
            }
          })
          .catch(() => {}); // keep optimistic count on RPC unavailability
      } else {
        setMyVotes(prev => { const n = new Set(prev); n.delete(requestId); return n; });
        setRequests(prev => prev.map(r => r.id === requestId ? { ...r, vote_count: r.vote_count - 1 } : r));
      }
    } catch {
      setMyVotes(prev => { const n = new Set(prev); n.delete(requestId); return n; });
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, vote_count: r.vote_count - 1 } : r));
    }
  };

  const handleRequest = async () => {
    if (!user) { onAuthRequired(); return; }
    const content = newRequest.trim();
    if (!content) return;
    setPosting(true);

    const tempId = `temp-${Date.now()}`;
    const optimistic = { id: tempId, event_id: eventId, user_id: user.id, content, vote_count: 1, is_live: false };
    setRequests(prev => [optimistic, ...prev]);
    setNewRequest('');

    try {
      const payload = { event_id: eventId, user_id: user.id, content, vote_count: 1 };
      const result = await resilient(
        [
          async () => {
            const { data, error } = await supabase.from('pulse_requests').insert(payload).select().single();
            if (error) throw error;
            return data;
          },
          async () => {
            const { data, error } = await supabase.from('pulse_requests').upsert(payload).select().single();
            if (error) throw error;
            return data;
          },
          () => supabase.rpc('add_pulse_request', { p_event_id: eventId, p_user_id: user.id, p_content: content }),
        ],
        { attemptsPerTier: 2, baseMs: 400, label: `PulseSchedule.request:${eventId}`, fallbackValue: null }
      );

      if (result === null) {
        setRequests(prev => prev.filter(r => r.id !== tempId));
        toast.show('Failed to add request', 'error');
      } else {
        const data = typeof result === 'object' ? result : null;
        setRequests(prev => prev.map(r => r.id === tempId ? (data || { ...optimistic, id: `confirmed-${Date.now()}` }) : r));
        if (data?.id) setMyVotes(prev => new Set([...prev, data.id]));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        toast.show('Request added to the Pulse!', 'success');
      }
    } catch {
      setRequests(prev => prev.filter(r => r.id !== tempId));
      toast.show('Failed to add request', 'error');
    } finally {
      setPosting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: `${primary}08`, borderColor: `${primary}20` }]}>
      <View style={styles.header}>
        <Feather name="activity" size={16} color={primary} />
        <Text style={[styles.title, { color: primary }]}>{template.type.toUpperCase()}</Text>
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { color: textColor, borderColor: `${primary}30`, backgroundColor: `${primary}10` }]}
          placeholder={template.action}
          placeholderTextColor={muted}
          value={newRequest}
          onChangeText={setNewRequest}
          onSubmitEditing={handleRequest}
          maxLength={200}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: primary }, posting && { opacity: 0.5 }]}
          onPress={handleRequest}
          disabled={posting}
        >
          {posting
            ? <ActivityIndicator size="small" color="#000" />
            : <Feather name="arrow-up" size={16} color="#000" />
          }
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={primary} style={{ marginVertical: 12 }} />
      ) : requests.length === 0 ? (
        <Text style={[styles.empty, { color: muted }]}>No requests yet — be the first to set the vibe!</Text>
      ) : (
        <View style={styles.list}>
          {requests.map((req) => {
            const voted = myVotes.has(req.id);
            return (
              <View
                key={req.id}
                style={[styles.reqRow, req.is_live && { borderColor: primary, borderWidth: 1, backgroundColor: `${primary}15` }]}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.reqContent, { color: textColor }]}>{req.content}</Text>
                    {req.is_live && (
                      <View style={[styles.liveBadge, { backgroundColor: primary }]}>
                        <Text style={{ color: '#000', fontSize: 8, fontWeight: '900' }}>LIVE</Text>
                      </View>
                    )}
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.voteBtn, { backgroundColor: voted ? `${primary}30` : `${primary}12`, borderColor: voted ? primary : 'transparent', borderWidth: 1 }]}
                  onPress={() => handleVote(req.id)}
                  disabled={voted}
                >
                  <Feather name="chevron-up" size={15} color={primary} />
                  <Text style={[styles.voteCount, { color: primary }]}>{req.vote_count}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginHorizontal: 14, marginBottom: 12, borderRadius: 16, borderWidth: 1, padding: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { fontSize: 12, fontWeight: '900', letterSpacing: 1, flex: 1 },
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  input: { flex: 1, height: 36, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, fontSize: 13 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 12, textAlign: 'center', paddingVertical: 12 },
  list: { gap: 8 },
  reqRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
  reqContent: { fontSize: 13, fontWeight: '700', flex: 1 },
  liveBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  voteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  voteCount: { fontSize: 13, fontWeight: '900' },
});
