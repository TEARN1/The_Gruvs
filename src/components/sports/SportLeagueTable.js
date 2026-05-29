/**
 * SportLeagueTable
 * Renders a live league standings table. Auto-adapts columns to sport type.
 * Highlights top N promotion spots and bottom N relegation spots.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { TableManager, SportConfig, SPORT_REGISTRY } from '../../services/sportsEngine';
import { supabase } from '../../services/supabase';

const FORM_COLORS = { W: '#10b981', D: '#f59e0b', L: '#ef4444' };

function FormPill({ result }) {
  return (
    <View style={{ width: 16, height: 16, borderRadius: 3, backgroundColor: FORM_COLORS[result] || '#374151', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900' }}>{result}</Text>
    </View>
  );
}

export const SportLeagueTable = ({ eventId, groupId = null, primary = '#00f2ff', bg = '#0d1112', textColor = '#fff', muted = 'rgba(255,255,255,0.5)', onTeamPress }) => {
  const [table, setTable] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async () => {
    try {
      const [tableData, configData] = await Promise.all([
        TableManager.get(eventId, groupId),
        SportConfig.get(eventId),
      ]);
      setTable(tableData);
      setConfig(configData);
      if (tableData.length) setLastUpdated(tableData[0].last_updated);
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, [eventId, groupId]);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription
  useEffect(() => {
    const ch = supabase.channel(`league_table:${eventId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'sport_league_table', filter: `event_id=eq.${eventId}` },
        () => load()
      ).subscribe();
    return () => supabase.removeChannel(ch);
  }, [eventId, load]);

  const sportMeta = SPORT_REGISTRY[config?.sport_type] || SPORT_REGISTRY.soccer;
  const columns = sportMeta.table_columns || ['P', 'W', 'D', 'L', 'GD', 'Pts'];

  if (loading) return (
    <View style={{ paddingVertical: 24, alignItems: 'center' }}>
      <ActivityIndicator color={primary} />
    </View>
  );

  if (!table.length) return (
    <View style={{ paddingVertical: 20, alignItems: 'center' }}>
      <Text style={{ color: muted, fontSize: 13 }}>No standings yet. Add teams to get started.</Text>
    </View>
  );

  return (
    <View>
      {/* Header */}
      <View style={[s.headerRow, { borderBottomColor: `${primary}20` }]}>
        <Text style={[s.posCol, { color: muted }]}>#</Text>
        <Text style={[s.teamCol, { color: muted }]}>Team</Text>
        {columns.map(col => (
          <Text key={col} style={[s.statCol, { color: muted }]}>{col}</Text>
        ))}
        <Text style={[s.formCol, { color: muted }]}>Form</Text>
      </View>

      {table.map((row, idx) => {
        const team = row.sport_teams;
        const isTop2 = idx < 2;
        const isBottom2 = idx >= table.length - 2 && table.length > 4;
        const rowBg = isTop2 ? `${primary}08` : isBottom2 ? 'rgba(239,68,68,0.05)' : 'transparent';
        const accentColor = isTop2 ? primary : isBottom2 ? '#ef4444' : 'transparent';

        const statValues = {
          P: row.played, W: row.won, D: row.drawn, L: row.lost,
          GF: row.goals_for, GA: row.goals_against, GD: row.goal_diff > 0 ? `+${row.goal_diff}` : String(row.goal_diff),
          Pts: row.points, PF: row.goals_for, PA: row.goals_against, PD: row.goal_diff,
          BP: row.bonus_points || 0, SW: row.won, SL: row.lost, SR: `${row.won}:${row.lost}`,
          GW: row.won, GL: row.lost, NR: 0,
        };

        return (
          <TouchableOpacity
            key={row.id}
            onPress={() => onTeamPress?.(team)}
            style={[s.tableRow, { backgroundColor: rowBg, borderLeftWidth: 3, borderLeftColor: accentColor }]}
            activeOpacity={0.75}
          >
            <Text style={[s.posCol, { color: isTop2 ? primary : muted, fontWeight: '900' }]}>{row.position || idx + 1}</Text>

            <View style={s.teamCell}>
              {team?.logo_url
                ? <Image source={{ uri: team.logo_url }} style={s.teamLogo} />
                : <View style={[s.teamLogoPlaceholder, { backgroundColor: team?.color1 || primary }]}>
                    <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>{(team?.short_name || team?.name || '?')[0]}</Text>
                  </View>
              }
              <Text style={[s.teamName, { color: textColor }]} numberOfLines={1}>{team?.name || 'Unknown'}</Text>
            </View>

            {columns.map(col => (
              <Text key={col} style={[s.statCol, {
                color: col === 'Pts' ? primary : col === 'GD' ? (row.goal_diff > 0 ? '#10b981' : row.goal_diff < 0 ? '#ef4444' : muted) : textColor,
                fontWeight: col === 'Pts' ? '900' : '600',
              }]}>
                {statValues[col] ?? '-'}
              </Text>
            ))}

            <View style={s.formCol}>
              <View style={{ flexDirection: 'row', gap: 2 }}>
                {(row.form || []).slice(-5).map((r, i) => <FormPill key={i} result={r} />)}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Legend */}
      <View style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: primary }} />
          <Text style={{ color: muted, fontSize: 10 }}>Promotion zone</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#ef4444' }} />
          <Text style={{ color: muted, fontSize: 10 }}>Relegation zone</Text>
        </View>
        {lastUpdated && (
          <Text style={{ color: muted, fontSize: 10, marginLeft: 'auto' }}>
            Updated {new Date(lastUpdated).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1 },
  tableRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.04)' },
  posCol:    { width: 22, fontSize: 11, textAlign: 'center', fontWeight: '700' },
  teamCol:   { flex: 1, fontSize: 11 },
  teamCell:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  teamLogo:  { width: 20, height: 20, borderRadius: 10 },
  teamLogoPlaceholder: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  teamName:  { fontSize: 12, fontWeight: '700', flex: 1 },
  statCol:   { width: 28, fontSize: 11, textAlign: 'center' },
  formCol:   { width: 90, alignItems: 'flex-end' },
});

export default SportLeagueTable;
