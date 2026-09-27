/**
 * MatchPredictionCard — "Who will win?" fan vote for a competitive event.
 *
 * Self-contained: pulls the event's teams (sport_teams), lets a fan pick a
 * winner, then shows the live % split. One prediction per user (changeable).
 * Renders nothing if the event has no teams to predict between.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';
import { GlassView } from './GlassView';
import { AnimatedCounter } from './Motion';
import { haptics } from '../utils/haptics';
import { supabase } from '../services/supabase';
import { TournamentEngine } from '../services/tournamentEngine';

export const MatchPredictionCard = ({ eventId, primary: primaryProp }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const primary   = primaryProp || currentTheme?.primary || '#00f2ff';
  const textColor = currentTheme?.text      || '#fff';
  const muted     = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface   || '#1a1f21';

  const [options, setOptions] = useState([]);     // [{ key, label, side, teamId }]
  const [tally, setTally]     = useState({});
  const [total, setTotal]     = useState(0);
  const [myPick, setMyPick]   = useState(null);   // label
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);

  const buildOptions = useCallback(async () => {
    // Prefer registered teams; fall back to guests grouped by team side.
    const { data: teams } = await supabase
      .from('sport_teams').select('id, name').eq('event_id', eventId).limit(4);
    let opts = (teams || []).map((t, i) => ({
      key: t.id, label: t.name, side: i === 0 ? 'home' : i === 1 ? 'away' : `team_${i}`, teamId: t.id,
    }));
    if (opts.length >= 2 && opts.length <= 2) opts.push({ key: 'draw', label: 'Draw', side: 'draw', teamId: null });
    return opts;
  }, [eventId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [opts, t, mine] = await Promise.all([
        buildOptions(),
        TournamentEngine.getPredictionTally(eventId),
        TournamentEngine.getMyPrediction(eventId, user?.id),
      ]);
      setOptions(opts);
      setTally(t.tally || {}); setTotal(t.total || 0);
      setMyPick(mine?.predicted_label || null);
    } finally {
      setLoading(false);
    }
  }, [eventId, buildOptions, user?.id]);

  useEffect(() => { load(); }, [load]);

  const vote = async (opt) => {
    if (!user) { toast.show('Sign in to predict', 'info'); return; }
    if (busy) return;
    setBusy(true);
    haptics.medium();
    // optimistic
    const prevPick = myPick;
    setMyPick(opt.label);
    setTally(prev => {
      const next = { ...prev };
      if (prevPick && next[prevPick]) next[prevPick] = Math.max(0, next[prevPick] - 1);
      next[opt.label] = (next[opt.label] || 0) + 1;
      return next;
    });
    if (!prevPick) setTotal(t => t + 1);

    try {
      const res = await TournamentEngine.castPrediction({
        eventId, side: opt.side, teamId: opt.teamId, label: opt.label,
      });
      if (res.ok) { haptics.success(); if (res.total != null) setTotal(res.total); if (res.tally) setTally(res.tally); }
      else { toast.show('Could not save prediction', 'error'); load(); }
    } catch {
      toast.show('Could not save prediction', 'error'); load();
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;
  if (options.length < 2) return null; // nothing to predict between

  const pct = (label) => total > 0 ? Math.round(((tally[label] || 0) / total) * 100) : 0;
  const voted = !!myPick;

  return (
    <GlassView glow style={mp.card}>
      <View style={mp.head}>
        <Feather name="zap" size={14} color={primary} />
        <Text style={[mp.title, { color: textColor }]}>Who will win?</Text>
        <View style={{ flex: 1 }} />
        <AnimatedCounter value={total} style={[mp.count, { color: muted }]} format={(n) => `${n} votes`} />
      </View>

      <View style={{ gap: 8, marginTop: 10 }}>
        {options.map(opt => {
          const p = pct(opt.label);
          const mine = myPick === opt.label;
          return (
            <TouchableOpacity
              key={opt.key}
              activeOpacity={0.85}
              onPress={() => vote(opt)}
              disabled={busy}
              style={[mp.row, { borderColor: mine ? primary : `${primary}25`, backgroundColor: surface }]}
            >
              {/* fill bar (after voting) */}
              {voted && (
                <View style={[mp.fill, { width: `${p}%`, backgroundColor: mine ? `${primary}33` : 'rgba(255,255,255,0.06)' }]} />
              )}
              <Text style={[mp.optLabel, { color: textColor }]} numberOfLines={1}>
                {opt.label}{mine ? '  ✓' : ''}
              </Text>
              {voted && <Text style={[mp.pct, { color: mine ? primary : muted }]}>{p}%</Text>}
              {!voted && <Feather name="chevron-right" size={16} color={muted} />}
            </TouchableOpacity>
          );
        })}
      </View>
      {voted && <Text style={[mp.foot, { color: muted }]}>Tap another to change your call</Text>}
    </GlassView>
  );
};

const mp = StyleSheet.create({
  card: { padding: 14, marginHorizontal: 16, marginTop: 8, marginBottom: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { fontSize: 14, fontWeight: '900' },
  count: { fontSize: 11, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1, overflow: 'hidden', position: 'relative' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 14 },
  optLabel: { flex: 1, fontSize: 14, fontWeight: '800' },
  pct: { fontSize: 14, fontWeight: '900' },
  foot: { fontSize: 10, textAlign: 'center', marginTop: 8 },
});

export default MatchPredictionCard;
