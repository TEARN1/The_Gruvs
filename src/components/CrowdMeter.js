/**
 * CrowdMeter — anonymous "how's the vibe right now" meter for a live event.
 *
 * Shows the current crowd level (the average of everyone's votes in the last
 * 45 min) and lets you cast/change your own. Helps people decide whether to
 * head over. Zero cost — just Supabase. Degrades silently if the
 * event_crowd_votes table isn't migrated yet.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { haptics } from '../utils/haptics';

const WINDOW_MS = 45 * 60 * 1000; // votes count for 45 min
const LEVELS = [
  { v: 1, label: 'Chilled', color: '#38bdf8', emoji: '😌' },
  { v: 2, label: 'Busy',    color: '#fbbf24', emoji: '🔥' },
  { v: 3, label: 'Packed',  color: '#ef4444', emoji: '🤯' },
];

export const CrowdMeter = ({ eventId, primary = '#00f2ff', textColor = '#fff', muted = 'rgba(255,255,255,0.55)', surface = 'rgba(255,255,255,0.05)', onAuthRequired }) => {
  const { user } = useAuth();
  const [votes, setVotes] = useState([]);
  const [myLevel, setMyLevel] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const since = new Date(Date.now() - WINDOW_MS).toISOString();
      const { data } = await supabase
        .from('event_crowd_votes')
        .select('user_id, level, created_at')
        .eq('event_id', eventId)
        .gte('created_at', since);
      setVotes(data || []);
      if (user) {
        const mine = (data || []).find((v) => v.user_id === user.id);
        setMyLevel(mine ? mine.level : null);
      }
    } catch { /* table not migrated / offline */ } finally {
      setLoading(false);
    }
  }, [eventId, user]);

  useEffect(() => { load(); }, [load]);

  const vote = async (lvl) => {
    if (!user) { onAuthRequired?.(); return; }
    try { haptics.select?.(); } catch {}
    const prevLevel = myLevel;
    setMyLevel(lvl);
    // optimistic: replace my vote locally
    setVotes((prev) => {
      const others = prev.filter((v) => v.user_id !== user.id);
      return [...others, { user_id: user.id, level: lvl, created_at: new Date().toISOString() }];
    });
    try {
      await supabase.from('event_crowd_votes').upsert(
        { event_id: eventId, user_id: user.id, level: lvl, created_at: new Date().toISOString() },
        { onConflict: 'event_id,user_id' },
      );
    } catch {
      setMyLevel(prevLevel); // rollback on failure
    }
  };

  const count = votes.length;
  const avg = count ? votes.reduce((s, v) => s + v.level, 0) / count : 0;
  const current = count ? (LEVELS.find((l) => Math.round(avg) === l.v) || LEVELS[1]) : null;
  const fillPct = count ? Math.max(8, ((avg - 1) / 2) * 100) : 0;

  return (
    <View style={[cm.wrap, { borderColor: `${primary}25`, backgroundColor: surface }]}>
      <View style={cm.headerRow}>
        <View style={cm.liveDot} />
        <Text style={[cm.title, { color: textColor }]}>Crowd right now</Text>
        {current && <Text style={[cm.current, { color: current.color }]}>{current.emoji} {current.label}</Text>}
      </View>

      {loading ? (
        <ActivityIndicator color={primary} style={{ marginVertical: 12 }} />
      ) : (
        <>
          {/* gradient-ish meter track */}
          <View style={cm.track}>
            <View style={[cm.fill, { width: `${fillPct}%`, backgroundColor: current ? current.color : `${primary}40` }]} />
          </View>

          <View style={cm.voteRow}>
            {LEVELS.map((l) => {
              const active = myLevel === l.v;
              return (
                <TouchableOpacity
                  key={l.v}
                  onPress={() => vote(l.v)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`Vote ${l.label}`}
                  style={[cm.voteBtn, { borderColor: active ? l.color : `${primary}25`, backgroundColor: active ? `${l.color}22` : 'transparent' }]}
                >
                  <Text style={{ fontSize: 17 }}>{l.emoji}</Text>
                  <Text style={{ color: active ? l.color : muted, fontSize: 11, fontWeight: '800', marginTop: 2 }}>{l.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[cm.footer, { color: muted }]}>
            {count === 0 ? 'Be the first to call the vibe' : `${count} ${count === 1 ? 'person' : 'people'} voted · last 45 min`}
          </Text>
        </>
      )}
    </View>
  );
};

const cm = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  title: { fontSize: 13, fontWeight: '900' },
  current: { fontSize: 12, fontWeight: '900', marginLeft: 'auto' },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 12 },
  fill: { height: 8, borderRadius: 4 },
  voteRow: { flexDirection: 'row', gap: 8 },
  voteBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
  footer: { fontSize: 11, marginTop: 10, textAlign: 'center' },
});

export default CrowdMeter;
