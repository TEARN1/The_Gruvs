/**
 * LiveEventUpdates — organiser posts real-time announcements during an event.
 * Attendees see updates live via Supabase realtime channel.
 * Organiser sees a compose bar; everyone else sees the feed only.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Animated, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../services/supabase';
import { resilient } from '../utils/resilience';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';

const UPDATE_TYPES = [
  { key: 'info',    icon: 'info',        color: "#06b6d4", label: 'Info'    },
  { key: 'hype',    icon: 'zap',         color: "#f59e0b", label: 'Hype'   },
  { key: 'change',  icon: 'alert-circle', color: "#ef4444", label: 'Change' },
  { key: 'shoutout',icon: 'mic',         color: "#8b5cf6", label: 'Shout'  },
];

const fmt = (iso) => {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const UpdateCard = React.memo(({ item, primary, textColor, muted, surface }) => {
  const type = UPDATE_TYPES.find(t => t.key === item.update_type) || UPDATE_TYPES[0];
  const slideIn = useRef(new Animated.Value(-20)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideIn, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        lu.card,
        { backgroundColor: `${type.color}10`, borderColor: `${type.color}35`, transform: [{ translateX: slideIn }], opacity },
      ]}
    >
      <View style={[lu.iconWrap, { backgroundColor: `${type.color}20` }]}>
        <Feather name={type.icon} size={14} color={type.color} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[lu.message, { color: textColor }]}>{item.message}</Text>
        <Text style={[lu.meta, { color: muted }]}>
          @{item.profiles?.username || 'organiser'} · {fmt(item.created_at)}
        </Text>
      </View>
    </Animated.View>
  );
});

export const LiveEventUpdates = ({ eventId, organiserId, canPost: canPostProp, primary, textColor, muted, surface }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [updates, setUpdates] = useState([]);
  const [message, setMessage] = useState('');
  const [updateType, setUpdateType] = useState('info');
  const [posting, setPosting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // canPost prop from useEventRole takes precedence; fall back to organiser check
  const isOrganiser = canPostProp !== undefined ? canPostProp : user?.id === organiserId;

  const renderUpdateItem = useCallback(({ item }) => (
    <UpdateCard item={item} primary={primary} textColor={textColor} muted={muted} surface={surface} />
  ), [primary, textColor, muted, surface]);

  const fetchUpdates = useCallback(async () => {
    if (!eventId) return;
    const { data } = await supabase
      .from('event_updates')
      .select('*, profiles:author_id(username, avatar_url)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setUpdates(data);
  }, [eventId]);

  useEffect(() => { fetchUpdates(); }, [fetchUpdates]);

  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`event_updates:${eventId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_updates', filter: `event_id=eq.${eventId}` }, (payload) => {
        setUpdates(prev => [payload.new, ...prev].slice(0, 20));
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setExpanded(true);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [eventId]);

  const postUpdate = async () => {
    if (!user?.id || !message.trim() || posting) return;
    setPosting(true);
    try {
      const ok = await resilient(
        [
          () => supabase.from('event_updates').insert({ event_id: eventId, author_id: user?.id, message: message.trim(), update_type: updateType }),
          () => supabase.rpc('post_event_update', { p_event_id: eventId, p_author: user?.id, p_message: message.trim(), p_type: updateType }),
        ],
        { attemptsPerTier: 2, baseMs: 400, label: 'LiveEventUpdates.post', fallbackValue: null }
      );
      if (ok === null) throw new Error('post failed');
      setMessage('');
      toast.show('Update posted!', 'success');
    } catch {
      toast.show('Could not post update. Try again.', 'error');
    } finally {
      setPosting(false);
    }
  };

  if (updates.length === 0 && !isOrganiser) return null;

  return (
    <View style={lu.container}>
      {/* Header */}
      <TouchableOpacity style={lu.headerRow} onPress={() => setExpanded(p => !p)} activeOpacity={0.8}>
        <View style={[lu.liveBadge, { backgroundColor: '#ef444420', borderColor: '#ef444440' }]}>
          <View style={lu.liveDot} />
          <Text style={{ color: "#ef4444", fontWeight: '900', fontSize: 10 }}>LIVE</Text>
        </View>
        <Text style={[lu.headerTitle, { color: textColor }]}>Event Updates</Text>
        {updates.length > 0 && (
          <View style={[lu.countBadge, { backgroundColor: `${primary}20` }]}>
            <Text style={{ color: primary, fontWeight: '900', fontSize: 11 }}>{updates.length}</Text>
          </View>
        )}
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={muted} style={{ marginLeft: 'auto' }} />
      </TouchableOpacity>

      {expanded && (
        <>
          {/* Organiser compose bar */}
          {isOrganiser && (
            <View style={[lu.compose, { backgroundColor: `${primary}08`, borderColor: `${primary}20` }]}>
              {/* Type selector */}
              <View style={lu.typeRow}>
                {UPDATE_TYPES.map(t => (
                  <TouchableOpacity
                    key={t.key}
                    onPress={() => setUpdateType(t.key)}
                    style={[lu.typeBtn, { borderColor: updateType === t.key ? t.color : 'rgba(255,255,255,0.1)', backgroundColor: updateType === t.key ? `${t.color}20` : 'transparent' }]}
                  >
                    <Feather name={t.icon} size={12} color={updateType === t.key ? t.color : muted} />
                    <Text style={{ color: updateType === t.key ? t.color : muted, fontSize: 10, fontWeight: '700' }}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={lu.inputRow}>
                <TextInput
                  style={[lu.input, { color: textColor, borderColor: `${primary}25` }]}
                  placeholder="Post an update to everyone at this event..."
                  placeholderTextColor={muted}
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  maxLength={280}
                />
                <TouchableOpacity
                  style={[lu.sendBtn, { backgroundColor: message.trim() ? primary : `${primary}30` }]}
                  onPress={postUpdate}
                  disabled={!message.trim() || posting}
                >
                  {posting
                    ? <ActivityIndicator size="small" color="#000" />
                    : <Feather name="send" size={15} color={message.trim() ? '#000' : muted} />
                  }
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Updates list */}
          {updates.length === 0 ? (
            <Text style={[lu.empty, { color: muted }]}>No updates yet. Check back during the event.</Text>
          ) : (
            <FlatList
              data={updates}
              keyExtractor={item => item.id}
              renderItem={renderUpdateItem}
              scrollEnabled={false}
              contentContainerStyle={{ gap: 8, paddingTop: 8 }}
            />
          )}
        </>
      )}
    </View>
  );
};

const lu = StyleSheet.create({
  container: { marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#ef4444" },
  headerTitle: { fontSize: 14, fontWeight: '900' },
  countBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  compose: { borderRadius: 14, borderWidth: 1, padding: 12, marginTop: 8, gap: 10 },
  typeRow: { flexDirection: 'row', gap: 6 },
  typeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, borderWidth: 1 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 10, fontSize: 13, maxHeight: 80, textAlignVertical: 'top' },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  iconWrap: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  message: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  meta: { fontSize: 10 },
  empty: { fontSize: 12, paddingVertical: 12, textAlign: 'center' },
});
