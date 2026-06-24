/**
 * CrewOutCard — "Your crew is out right now." The strongest reason to leave the
 * house: real friends, physically Touched Down, in the last few hours. Reads the
 * verified-presence table (live_checkins) for people you follow, distils it with
 * the tested summarizeCrewOut util, and shows a present-tense digest. Renders
 * nothing when no one's out, or if reads are RLS-gated. Verified presence only.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';
import { GlassView } from './GlassView';
import { summarizeCrewOut } from '../utils/crewOut';

const WINDOW_MS = 6 * 60 * 60 * 1000;

export function CrewOutCard({ userId, onEventPress }) {
  const { currentTheme } = useTheme();
  const primary   = currentTheme?.primary   || '#00f2ff';
  const textColor = currentTheme?.text      || '#fff';
  const muted     = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  const [crew, setCrew] = useState([]);

  useEffect(() => {
    let alive = true;
    if (!userId) return undefined;
    (async () => {
      try {
        const { data: follows } = await supabase
          .from('follows').select('following_id').eq('follower_id', userId).limit(2000);
        const ids = (follows || []).map((f) => f.following_id).filter(Boolean);
        if (!ids.length) return;

        const sinceIso = new Date(Date.now() - WINDOW_MS).toISOString();
        const { data: checkins } = await supabase
          .from('live_checkins')
          .select('user_id, event_id, checked_in_at, events(title, venue_name)')
          .in('user_id', ids)
          .gte('checked_in_at', sinceIso)
          .order('checked_in_at', { ascending: false })
          .limit(300);

        let rows = summarizeCrewOut(checkins || []);
        if (rows.length) {
          // enrich with profiles (no declared FK embed on live_checkins → fetch separately)
          const { data: profs } = await supabase
            .from('profiles').select('id, username, avatar_url').in('id', rows.map((r) => r.userId));
          const byId = new Map((profs || []).map((p) => [p.id, p]));
          rows = rows.map((r) => ({
            ...r,
            username: byId.get(r.userId)?.username || r.username,
            avatar: byId.get(r.userId)?.avatar_url || r.avatar,
          }));
        }
        if (alive) setCrew(rows);
      } catch { /* RLS-gated or offline — stay hidden */ }
    })();
    return () => { alive = false; };
  }, [userId]);

  if (!crew.length) return null;

  const headline = crew.length === 1
    ? `${crew[0].username} is out right now`
    : `${crew.length} of your crew are out right now`;

  return (
    <GlassView style={[s.wrap, { borderColor: 'rgba(16,185,129,0.3)' }]}>
      <View style={s.header}>
        <View style={s.liveDot} />
        <Text style={[s.title, { color: textColor }]}>{headline}</Text>
      </View>

      {crew.slice(0, 5).map((m) => (
        <TouchableOpacity
          key={m.userId}
          style={s.row}
          activeOpacity={0.7}
          disabled={!m.eventId}
          onPress={() => m.eventId && onEventPress && onEventPress({ id: m.eventId, title: m.title })}
        >
          {m.avatar
            ? <Image source={{ uri: m.avatar }} style={s.avatar} />
            : <View style={[s.avatar, s.avatarFallback]}><Feather name="user" size={12} color={muted} /></View>}
          <Text style={[s.name, { color: textColor }]} numberOfLines={1}>{m.username}</Text>
          <Text style={[s.at, { color: muted }]} numberOfLines={1}>
            {m.venue ? `at ${m.venue}` : 'out now'}
          </Text>
          {m.eventId ? <Feather name="chevron-right" size={14} color={muted} /> : null}
        </TouchableOpacity>
      ))}
    </GlassView>
  );
}

const s = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 14, borderRadius: 20, padding: 16, borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' },
  title: { fontSize: 14, fontWeight: '900', flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 9 },
  avatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.08)' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 13, fontWeight: '800' },
  at: { fontSize: 12, fontWeight: '600', flex: 1 },
});
