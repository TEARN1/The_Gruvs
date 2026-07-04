/**
 * SuperfansPanel — "Your Superfans" for the host / business dashboard.
 * Ranks the people who Touch Down at your events the most (real check-ins only,
 * Ghost check-ins excluded), bucketed by This Month / This Year / All Time, and
 * nudges you to treat your most loyal fans special.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GlassView } from './GlassView';
import { getHostSuperfans } from '../services/superfans';

const PERIODS = [
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
  { key: 'all', label: 'All Time' },
];

const TIER_COLOR = { superfan: '#f59e0b', true_fan: '#a78bfa', regular: '#06b6d4', newcomer: '#64748b' };

const initials = (name) => (name || '?').slice(0, 1).toUpperCase();

const FanRow = ({ fan, rank, textColor, muted, primary }) => {
  const color = TIER_COLOR[fan.tier] || primary;
  return (
    <View style={[sf.row, { borderBottomColor: `${primary}12` }]}>
      <Text style={[sf.rank, { color: muted }]}>{rank}</Text>
      {fan.avatar_url
        ? <Image source={{ uri: fan.avatar_url }} style={sf.avatar} />
        : <View style={[sf.avatar, { backgroundColor: `${color}22`, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color, fontWeight: '900', fontSize: 14 }}>{initials(fan.username)}</Text>
          </View>}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={sf.nameRow}>
          <Text style={[sf.name, { color: textColor }]} numberOfLines={1}>
            {fan.username ? `@${fan.username}` : 'A Viber'}
          </Text>
          <View style={[sf.tierChip, { backgroundColor: `${color}1e`, borderColor: `${color}55` }]}>
            <Text style={[sf.tierChipText, { color }]}>{fan.tierEmoji} {fan.tierLabel}</Text>
          </View>
        </View>
        <Text style={[sf.meta, { color: muted }]} numberOfLines={1}>
          {fan.events} event{fan.events !== 1 ? 's' : ''} · {fan.checkins} Touch Down{fan.checkins !== 1 ? 's' : ''}
          {fan.sharePct > 0 ? ` · ${fan.sharePct}% of your Gruvs` : ''}
        </Text>
        {fan.loyalty && fan.fidelity > 0 && (
          <Text style={[sf.meta, { color, marginTop: 2 }]} numberOfLines={1}>
            {fan.loyalty.emoji} {fan.loyalty.label} · fidelity {fan.fidelity}
          </Text>
        )}
        {fan.dueForReward && (
          <View style={[sf.suggest, { backgroundColor: `${color}12` }]}>
            <Feather name="gift" size={11} color={color} />
            <Text style={[sf.suggestText, { color }]} numberOfLines={2}>{fan.suggestion}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

export const SuperfansPanel = ({ userId, primary, textColor, muted }) => {
  const [period, setPeriod] = useState('all');
  const [data, setData] = useState(null); // null = loading

  const load = useCallback((p) => {
    setData(null);
    let alive = true;
    getHostSuperfans(userId, { period: p }).then(d => { if (alive) setData(d); });
    return () => { alive = false; };
  }, [userId]);

  useEffect(() => load(period), [load, period]);

  const gold = '#f59e0b';

  return (
    <GlassView style={[sf.card, { borderColor: `${primary}20` }]}>
      <View style={sf.head}>
        <View style={[sf.badge, { backgroundColor: `${gold}18` }]}>
          <Feather name="award" size={13} color={gold} />
          <Text style={[sf.badgeText, { color: gold }]}>YOUR SUPERFANS</Text>
        </View>
      </View>
      <Text style={[sf.title, { color: textColor }]}>Who Keeps Coming Back</Text>
      <Text style={[sf.sub, { color: muted }]}>
        The people who actually show up at your Gruvs, most-loyal first. Treat them special — they're your real growth engine.
      </Text>

      {/* Period toggle */}
      <View style={sf.periodRow}>
        {PERIODS.map(p => {
          const active = period === p.key;
          return (
            <TouchableOpacity
              key={p.key}
              onPress={() => setPeriod(p.key)}
              style={[sf.periodBtn, { borderColor: active ? primary : `${primary}25`, backgroundColor: active ? primary : 'transparent' }]}
            >
              <Text style={[sf.periodText, { color: active ? '#000' : muted }]}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {data === null ? (
        <ActivityIndicator color={primary} style={{ marginVertical: 24 }} />
      ) : data.totalFans === 0 ? (
        <View style={sf.empty}>
          <Feather name="users" size={30} color={muted} />
          <Text style={[sf.emptyText, { color: muted }]}>
            No check-ins in this window yet. Once people Touch Down at your Gruvs, your top fans rank here.
          </Text>
        </View>
      ) : (
        <>
          {(data.superfans > 0 || data.trueFans > 0) && (
            <View style={[sf.summary, { backgroundColor: `${gold}10`, borderColor: `${gold}30` }]}>
              <Feather name="star" size={13} color={gold} />
              <Text style={[sf.summaryText, { color: textColor }]}>
                {data.superfans > 0 ? `${data.superfans} superfan${data.superfans !== 1 ? 's' : ''}` : ''}
                {data.superfans > 0 && data.trueFans > 0 ? ' · ' : ''}
                {data.trueFans > 0 ? `${data.trueFans} true fan${data.trueFans !== 1 ? 's' : ''}` : ''}
                {' '}worth rewarding.
              </Text>
            </View>
          )}
          {data.fans.map((fan, i) => (
            <FanRow key={fan.userId} fan={fan} rank={i + 1} textColor={textColor} muted={muted} primary={primary} />
          ))}
        </>
      )}
    </GlassView>
  );
};

const sf = StyleSheet.create({
  card: { margin: 16, padding: 18, borderRadius: 20, borderWidth: 1 },
  head: { flexDirection: 'row', marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.8 },
  title: { fontSize: 18, fontWeight: '900' },
  sub: { fontSize: 12, marginTop: 4, marginBottom: 12, lineHeight: 16 },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  periodBtn: { flex: 1, paddingVertical: 8, borderRadius: 20, borderWidth: 1, alignItems: 'center' },
  periodText: { fontSize: 12, fontWeight: '800' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, borderWidth: 1, marginTop: 10, marginBottom: 4 },
  summaryText: { fontSize: 12.5, fontWeight: '700', flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 11, borderBottomWidth: 1 },
  rank: { width: 18, fontSize: 13, fontWeight: '900', textAlign: 'center', marginTop: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 14, fontWeight: '800', flexShrink: 1 },
  tierChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  tierChipText: { fontSize: 10, fontWeight: '900' },
  meta: { fontSize: 11.5, fontWeight: '600', marginTop: 3 },
  suggest: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9 },
  suggestText: { fontSize: 11, fontWeight: '700', flex: 1, lineHeight: 15 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 22, paddingHorizontal: 12 },
  emptyText: { fontSize: 12.5, textAlign: 'center', lineHeight: 17 },
});

export default SuperfansPanel;
