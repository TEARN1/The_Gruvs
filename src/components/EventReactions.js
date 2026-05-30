/**
 * EventReactions — emoji reaction bar for events.
 * Each reaction is stored as a row in event_reactions (event_id, user_id, reaction_key).
 * Optimistic updates + rollback. Real-time count sync via Supabase channel.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { supabase } from '../services/supabase';
import { resilient } from '../utils/resilience';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';

const REACTIONS = [
  { key: 'fire',    emoji: '🔥', label: 'Hyped'   },
  { key: 'gem',     emoji: '💎', label: 'Luxury'  },
  { key: 'music',   emoji: '🎶', label: 'Music'   },
  { key: 'iconic',  emoji: '🤩', label: 'Iconic'  },
  { key: 'vibes',   emoji: '✨', label: 'Vibes'   },
  { key: 'jokes',   emoji: '😂', label: 'Jokes'   },
];

const ReactionPill = ({ reaction, count, active, onPress, primary, muted }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.35, duration: 100, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.75}
        style={[
          r.pill,
          {
            backgroundColor: active ? `${primary}25` : 'rgba(255,255,255,0.05)',
            borderColor: active ? primary : 'rgba(255,255,255,0.1)',
          },
        ]}
      >
        <Text style={r.emoji}>{reaction.emoji}</Text>
        {count > 0 && (
          <Text style={[r.count, { color: active ? primary : muted }]}>
            {count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

export const EventReactions = ({ eventId, primary, muted }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [counts, setCounts] = useState({});   // { fire: 12, gem: 3, ... }
  const [myReactions, setMyReactions] = useState(new Set());
  const [ready, setReady] = useState(false);

  const fetchReactions = useCallback(async () => {
    if (!eventId) return;
    try {
      const { data } = await supabase
        .from('event_reactions')
        .select('reaction_key, user_id')
        .eq('event_id', eventId);
      if (!data) return;
      const c = {};
      const mine = new Set();
      data.forEach(row => {
        c[row.reaction_key] = (c[row.reaction_key] || 0) + 1;
        if (user && row.user_id === user.id) mine.add(row.reaction_key);
      });
      setCounts(c);
      setMyReactions(mine);
    } catch {}
    finally { setReady(true); }
  }, [eventId, user]);

  useEffect(() => { fetchReactions(); }, [fetchReactions]);

  // Real-time patch — new reactions appear instantly
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`reactions:${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_reactions', filter: `event_id=eq.${eventId}` }, fetchReactions)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [eventId, fetchReactions]);

  const handleReaction = async (key) => {
    if (!user) { toast.show('Sign in to react', 'info'); return; }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const wasActive = myReactions.has(key);
    // Optimistic update
    setMyReactions(prev => {
      const next = new Set(prev);
      wasActive ? next.delete(key) : next.add(key);
      return next;
    });
    setCounts(prev => ({
      ...prev,
      [key]: Math.max(0, (prev[key] || 0) + (wasActive ? -1 : 1)),
    }));

    try {
      if (wasActive) {
        await resilient(
          [
            () => supabase.from('event_reactions').delete().eq('event_id', eventId).eq('user_id', user.id).eq('reaction_key', key),
            () => supabase.rpc('remove_event_reaction', { p_event_id: eventId, p_user_id: user.id, p_reaction_key: key }),
          ],
          { attemptsPerTier: 2, baseMs: 200, label: 'EventReactions.remove', fallbackValue: null }
        );
      } else {
        await resilient(
          [
            () => supabase.from('event_reactions').upsert({ event_id: eventId, user_id: user.id, reaction_key: key }, { onConflict: 'event_id,user_id,reaction_key', ignoreDuplicates: true }),
            () => supabase.from('event_reactions').insert({ event_id: eventId, user_id: user.id, reaction_key: key }),
          ],
          { attemptsPerTier: 2, baseMs: 200, label: 'EventReactions.add', fallbackValue: null }
        );
      }
    } catch {
      // Rollback
      setMyReactions(prev => {
        const next = new Set(prev);
        wasActive ? next.add(key) : next.delete(key);
        return next;
      });
      setCounts(prev => ({
        ...prev,
        [key]: Math.max(0, (prev[key] || 0) + (wasActive ? 1 : -1)),
      }));
    }
  };

  if (!ready) return null;

  return (
    <View style={r.container}>
      <Text style={[r.header, { color: muted }]}>REACTIONS</Text>
      <View style={r.row}>
        {REACTIONS.map(reaction => (
          <ReactionPill
            key={reaction.key}
            reaction={reaction}
            count={counts[reaction.key] || 0}
            active={myReactions.has(reaction.key)}
            onPress={() => handleReaction(reaction.key)}
            primary={primary}
            muted={muted}
          />
        ))}
      </View>
    </View>
  );
};

const r = StyleSheet.create({
  container: { marginBottom: 16 },
  header: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
  },
  emoji: { fontSize: 16 },
  count: { fontSize: 12, fontWeight: '800' },
});
