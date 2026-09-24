/**
 * PosterInsightsPanel — per-event "know your real fans" for the host.
 * Shows real engagement on this poster: likes / reactions / Touch Downs / reach,
 * a likes-over-time trend, and the people who engage most (your real fans) with
 * a breakdown of what each did. Sharable so the host can send the proof out.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, TouchableOpacity, Share, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { GlassView } from './GlassView';
import { getPosterInsights } from '../services/posterInsights';

const Stat = ({ label, value, icon, color, textColor, muted }) => (
  <View style={pi.stat}>
    <View style={[pi.statIcon, { backgroundColor: `${color}18` }]}><Feather name={icon} size={14} color={color} /></View>
    <Text style={[pi.statVal, { color: textColor }]}>{value}</Text>
    <Text style={[pi.statLabel, { color: muted }]}>{label}</Text>
  </View>
);

const initials = (n) => (n || '?').slice(0, 1).toUpperCase();

// Compact likes-over-time bar trend (no chart lib — pure Views).
const TrendBars = ({ series, primary, muted }) => {
  const max = Math.max(1, ...series.map(s => s.count));
  return (
    <View style={pi.trendWrap}>
      {series.map((s, i) => (
        <View key={i} style={pi.trendCol}>
          <View style={[pi.trendBar, { height: 4 + Math.round((s.count / max) * 42), backgroundColor: s.count > 0 ? primary : `${muted}30` }]} />
        </View>
      ))}
    </View>
  );
};

export const PosterInsightsPanel = ({ eventId, eventTitle, primary, textColor, muted }) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    getPosterInsights(eventId).then(d => { if (alive) setData(d); });
    return () => { alive = false; };
  }, [eventId]);

  const gold = '#f59e0b', green = '#10b981', pink = '#ec4899', violet = '#8b5cf6';

  const share = useCallback(async () => {
    if (!data) return;
    const t = data.totals;
    const top = data.topFans.slice(0, 3).map((f, i) => `${i + 1}. ${f.username ? '@' + f.username : 'A fan'} — ${f.touchdowns ? `${f.touchdowns} touch down${f.touchdowns !== 1 ? 's' : ''}, ` : ''}${f.likes} like${f.likes !== 1 ? 's' : ''}`).join('\n');
    const msg = `📊 ${eventTitle || 'My Gruv'} — the real numbers\n`
      + `❤️ ${t.likes} likes · ⚡ ${t.reactions} reactions · 📍 ${t.touchdowns} showed up · 👀 ${t.reach} reached\n`
      + (top ? `\n👑 Top fans:\n${top}\n` : '')
      + `\nProof on The Gruvs — real people, not impressions.`;
    try {
      if (Platform.OS === 'web' && navigator?.clipboard) { await navigator.clipboard.writeText(msg); }
      else await Share.share({ message: msg });
    } catch { /* user cancelled */ }
  }, [data, eventTitle]);

  return (
    <GlassView style={[pi.card, { borderColor: `${primary}20` }]}>
      <View style={pi.head}>
        <View style={[pi.badge, { backgroundColor: `${gold}18` }]}>
          <Feather name="bar-chart-2" size={13} color={gold} />
          <Text style={[pi.badgeText, { color: gold }]}>POSTER INSIGHTS</Text>
        </View>
        {data && data.totals.fans > 0 && (
          <TouchableOpacity onPress={share} style={[pi.shareBtn, { borderColor: `${primary}40` }]}>
            <Feather name={Platform.OS === 'web' ? 'copy' : 'share-2'} size={12} color={primary} />
            <Text style={[pi.shareText, { color: primary }]}>{Platform.OS === 'web' ? 'Copy' : 'Send'}</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={[pi.title, { color: textColor }]}>Know Your Real Fans</Text>
      <Text style={[pi.sub, { color: muted }]}>
        Real engagement on this poster — who likes, reacts and actually shows up. Not impressions.
      </Text>

      {data === null ? (
        <ActivityIndicator color={primary} style={{ marginVertical: 24 }} />
      ) : (
        <>
          <View style={pi.grid}>
            <Stat label="Likes" value={data.totals.likes} icon="heart" color={pink} textColor={textColor} muted={muted} />
            <Stat label="Reactions" value={data.totals.reactions} icon="zap" color={violet} textColor={textColor} muted={muted} />
            <Stat label="Showed up" value={data.totals.touchdowns} icon="map-pin" color={green} textColor={textColor} muted={muted} />
            <Stat label="Reached" value={data.totals.reach} icon="eye" color={primary} textColor={textColor} muted={muted} />
          </View>

          {data.totals.likes > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text style={[pi.sectionLabel, { color: muted }]}>LIKES — LAST 14 DAYS</Text>
              <TrendBars series={data.likesOverTime} primary={pink} muted={muted} />
            </View>
          )}

          {data.topFans.length === 0 ? (
            <View style={pi.empty}>
              <Feather name="users" size={28} color={muted} />
              <Text style={[pi.emptyText, { color: muted }]}>
                No engagement yet. As people like, react and Touch Down at this Gruv, your real fans rank here.
              </Text>
            </View>
          ) : (
            <View style={{ marginTop: 14 }}>
              <View style={pi.fansHead}>
                <Text style={[pi.sectionLabel, { color: muted }]}>YOUR REAL FANS</Text>
                {data.realFanCount > 0 && (
                  <Text style={[pi.realFanPill, { color: gold, backgroundColor: `${gold}15` }]}>
                    ⭐ {data.realFanCount} worth rewarding
                  </Text>
                )}
              </View>
              {data.topFans.map((f, i) => (
                <View key={f.userId} style={[pi.row, { borderBottomColor: `${primary}10` }]}>
                  <Text style={[pi.rank, { color: muted }]}>{i + 1}</Text>
                  {f.avatar_url
                    ? <Image source={{ uri: f.avatar_url }} style={pi.avatar} />
                    : <View style={[pi.avatar, { backgroundColor: `${primary}22`, alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ color: primary, fontWeight: '900', fontSize: 13 }}>{initials(f.username)}</Text>
                      </View>}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={pi.nameRow}>
                      <Text style={[pi.name, { color: textColor }]} numberOfLines={1}>{f.username ? `${f.username}` : 'A Viber'}</Text>
                      {f.isRealFan && (
                        <View style={[pi.fanChip, { backgroundColor: `${gold}1e`, borderColor: `${gold}55` }]}>
                          <Text style={[pi.fanChipText, { color: gold }]}>👑 Real fan</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[pi.meta, { color: muted }]} numberOfLines={1}>
                      {[
                        f.touchdowns > 0 ? `📍 ${f.touchdowns} showed up` : null,
                        f.likes > 0 ? `❤️ ${f.likes}` : null,
                        f.reactions > 0 ? `⚡ ${f.reactions}` : null,
                      ].filter(Boolean).join('  ·  ')}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </GlassView>
  );
};

const pi = StyleSheet.create({
  card: { margin: 16, padding: 18, borderRadius: 20, borderWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.8 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1 },
  shareText: { fontSize: 11, fontWeight: '800' },
  title: { fontSize: 18, fontWeight: '900' },
  sub: { fontSize: 12, marginTop: 4, marginBottom: 10, lineHeight: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  stat: { width: '22%', minWidth: 74, flexGrow: 1, alignItems: 'flex-start', gap: 3, paddingVertical: 6 },
  statIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statVal: { fontSize: 20, fontWeight: '900', marginTop: 2 },
  statLabel: { fontSize: 10, fontWeight: '700' },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6 },
  trendWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 48, marginTop: 2 },
  trendCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  trendBar: { width: '100%', borderRadius: 2, minHeight: 4 },
  fansHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  realFanPill: { fontSize: 10.5, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  rank: { width: 16, fontSize: 13, fontWeight: '900', textAlign: 'center' },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 14, fontWeight: '800', flexShrink: 1 },
  fanChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  fanChipText: { fontSize: 10, fontWeight: '900' },
  meta: { fontSize: 11.5, fontWeight: '600', marginTop: 2 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 20, paddingHorizontal: 12 },
  emptyText: { fontSize: 12.5, textAlign: 'center', lineHeight: 17 },
});

export default PosterInsightsPanel;
