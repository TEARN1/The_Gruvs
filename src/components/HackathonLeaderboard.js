/**
 * HackathonLeaderboard — live ranked leaderboard for hackathon / competition events.
 * Reads from event_teams + event_judge_scores, averages scores per team,
 * and renders a ranked list with submission status badges.
 * Subscribes to realtime so scores update live as judges submit.
 *
 * Usage:
 *   <HackathonLeaderboard eventId={id} />
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { supabase, isSupabaseEnabled } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';

const MEDAL = ['🥇', '🥈', '🥉'];

export const HackathonLeaderboard = ({ eventId, style }) => {
  const { colors } = useTheme();
  const primary   = colors?.primary   || "#00f2ff";
  const bg        = colors?.card      || '#111';
  const textColor = colors?.text      || '#fff';
  const muted     = colors?.muted     || 'rgba(255,255,255,0.5)';
  const surface   = colors?.surface   || "#1a1f21";

  const [teams, setTeams]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const subRef = useRef(null);

  const load = useCallback(async () => {
    if (!eventId || !isSupabaseEnabled) return;
    const [{ data: teamData }, { data: scoreData }] = await Promise.all([
      supabase
        .from('event_teams')
        .select('id, name, project_title, project_desc, project_url, demo_url, tech_stack, submitted, submitted_at, members, leader_id')
        .eq('event_id', eventId)
        .order('name'),
      supabase
        .from('event_judge_scores')
        .select('participant_id, participant_name, category, score, max_score, judge_name, notes')
        .eq('event_id', eventId),
    ]);

    const teams = teamData || [];
    const scores = scoreData || [];

    // Compute average score per team
    const ranked = teams.map(team => {
      const myScores = scores.filter(s => s.participant_id === team.id);
      const totalPct = myScores.length
        ? myScores.reduce((sum, s) => sum + (s.score / (s.max_score || 10)), 0) / myScores.length * 100
        : null;
      const byCategory = {};
      myScores.forEach(s => {
        if (!byCategory[s.category]) byCategory[s.category] = [];
        byCategory[s.category].push(s);
      });
      return { ...team, avgScore: totalPct, scoreCount: myScores.length, byCategory };
    });

    // Sort: scored teams by avgScore desc, unscored at bottom
    ranked.sort((a, b) => {
      if (a.avgScore == null && b.avgScore == null) return 0;
      if (a.avgScore == null) return 1;
      if (b.avgScore == null) return -1;
      return b.avgScore - a.avgScore;
    });

    setTeams(ranked);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    load();

    // Realtime — refresh on any score change
    subRef.current = supabase
      .channel(`leaderboard:${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_judge_scores', filter: `event_id=eq.${eventId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_teams', filter: `event_id=eq.${eventId}` }, load)
      .subscribe((s) => {
        if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') setTimeout(() => subRef.current?.subscribe(), 3000);
      });

    return () => subRef.current?.unsubscribe();
  }, [load]);

  if (loading) return <ActivityIndicator color={primary} style={[{ margin: 24 }, style]} />;
  if (!teams.length) return null;

  return (
    <View style={style}>
      <View style={s.header}>
        <Feather name="award" size={16} color={primary} />
        <Text style={[s.headerTitle, { color: textColor }]}>Leaderboard</Text>
        <Text style={[s.teamCount, { color: muted }]}>{teams.length} teams</Text>
      </View>

      {teams.map((team, idx) => {
        const isExpanded = expanded === team.id;
        const medal = MEDAL[idx];
        const scoreColor = team.avgScore == null ? muted
          : team.avgScore >= 75 ? "#10b981"
          : team.avgScore >= 50 ? "#f59e0b"
          : "#ef4444";

        return (
          <TouchableOpacity
            key={team.id}
            style={[s.row, { backgroundColor: surface, borderColor: idx < 3 ? `${primary}40` : `${primary}15` }]}
            onPress={() => setExpanded(isExpanded ? null : team.id)}
            activeOpacity={0.8}
          >
            {/* Rank + medal */}
            <View style={s.rankCell}>
              {medal
                ? <Text style={s.medal}>{medal}</Text>
                : <Text style={[s.rank, { color: muted }]}>#{idx + 1}</Text>
              }
            </View>

            {/* Team info */}
            <View style={{ flex: 1 }}>
              <View style={s.teamRow}>
                <Text style={[s.teamName, { color: textColor }]} numberOfLines={1}>{team.name}</Text>
                {team.submitted && (
                  <View style={[s.badge, { backgroundColor: `${primary}20`, borderColor: `${primary}40` }]}>
                    <Text style={[s.badgeText, { color: primary }]}>Submitted</Text>
                  </View>
                )}
              </View>
              {team.project_title ? (
                <Text style={[s.projectTitle, { color: muted }]} numberOfLines={1}>{team.project_title}</Text>
              ) : null}
              {team.tech_stack?.length > 0 && (
                <View style={s.techRow}>
                  {team.tech_stack.slice(0, 4).map((t, i) => (
                    <Text key={i} style={[s.techChip, { color: primary, borderColor: `${primary}30`, backgroundColor: `${primary}10` }]}>{t}</Text>
                  ))}
                </View>
              )}
            </View>

            {/* Score */}
            <View style={s.scoreCell}>
              {team.avgScore != null
                ? <Text style={[s.score, { color: scoreColor }]}>{Math.round(team.avgScore)}%</Text>
                : <Text style={[s.score, { color: muted }]}>—</Text>
              }
              <Text style={[s.scoreLabel, { color: muted }]}>
                {team.scoreCount ? `${team.scoreCount} judge${team.scoreCount > 1 ? 's' : ''}` : 'not judged'}
              </Text>
            </View>

            <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={muted} style={{ marginLeft: 4 }} />

            {/* Expanded detail */}
            {isExpanded && (
              <View style={[s.detail, { borderTopColor: `${primary}20` }]}>
                {team.project_desc ? (
                  <Text style={[s.detailDesc, { color: muted }]}>{team.project_desc}</Text>
                ) : null}
                {Object.keys(team.byCategory).length > 0 && (
                  <View style={{ marginTop: 10, gap: 6 }}>
                    <Text style={[s.catHeader, { color: primary }]}>SCORES BY CATEGORY</Text>
                    {Object.entries(team.byCategory).map(([cat, scores]) => {
                      const avg = scores.reduce((a, s) => a + (s.score / (s.max_score || 10)), 0) / scores.length * 100;
                      return (
                        <View key={cat} style={s.catRow}>
                          <Text style={[s.catName, { color: textColor }]}>{cat}</Text>
                          <Text style={[s.catScore, { color: scoreColor }]}>{Math.round(avg)}%</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
                {(team.project_url || team.demo_url) && (
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                    {team.project_url && (
                      <View style={[s.linkChip, { borderColor: `${primary}30` }]}>
                        <Feather name="github" size={12} color={primary} />
                        <Text style={[s.linkText, { color: primary }]}>Repo</Text>
                      </View>
                    )}
                    {team.demo_url && (
                      <View style={[s.linkChip, { borderColor: `${primary}30` }]}>
                        <Feather name="play" size={12} color={primary} />
                        <Text style={[s.linkText, { color: primary }]}>Demo</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const s = StyleSheet.create({
  header:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  headerTitle:  { fontSize: 16, fontWeight: '900', flex: 1 },
  teamCount:    { fontSize: 12 },
  row:          { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' },
  rankCell:     { width: 32, alignItems: 'center', paddingTop: 2 },
  medal:        { fontSize: 20 },
  rank:         { fontSize: 14, fontWeight: '900' },
  teamRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  teamName:     { fontSize: 14, fontWeight: '900', flex: 1 },
  badge:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  badgeText:    { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  projectTitle: { fontSize: 12, marginTop: 2 },
  techRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5 },
  techChip:     { fontSize: 10, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  scoreCell:    { alignItems: 'flex-end' },
  score:        { fontSize: 18, fontWeight: '900' },
  scoreLabel:   { fontSize: 9, fontWeight: '700', marginTop: 1 },
  detail:       { width: '100%', borderTopWidth: 1, marginTop: 12, paddingTop: 12 },
  detailDesc:   { fontSize: 13, lineHeight: 18 },
  catHeader:    { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  catRow:       { flexDirection: 'row', justifyContent: 'space-between' },
  catName:      { fontSize: 13 },
  catScore:     { fontSize: 13, fontWeight: '800' },
  linkChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  linkText:     { fontSize: 12, fontWeight: '700' },
});
