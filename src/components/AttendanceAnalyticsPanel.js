/**
 * AttendanceAnalyticsPanel — "Proof of Who Came" for the Business dashboard.
 * The B2B moat: real verified-attendance numbers from live_checkins (Touch
 * Downs), not impressions. Zero invented data — empty state when there's none.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GlassView } from './GlassView';
import { getOwnerAttendance } from '../services/attendanceAnalytics';

const Stat = ({ label, value, suffix = '', icon, color, muted, textColor }) => (
  <View style={ap.stat}>
    <View style={[ap.statIcon, { backgroundColor: `${color}18` }]}>
      <Feather name={icon} size={15} color={color} />
    </View>
    <Text style={[ap.statVal, { color: textColor }]}>{value}{suffix}</Text>
    <Text style={[ap.statLabel, { color: muted }]}>{label}</Text>
  </View>
);

export const AttendanceAnalyticsPanel = ({ userId, primary, textColor, muted }) => {
  const [data, setData] = useState(null); // null = loading
  const pink = '#ec4899', amber = '#f59e0b', green = '#10b981';

  useEffect(() => {
    let alive = true;
    getOwnerAttendance(userId).then(d => { if (alive) setData(d); });
    return () => { alive = false; };
  }, [userId]);

  return (
    <GlassView style={[ap.card, { borderColor: `${primary}20` }]}>
      <View style={ap.head}>
        <View style={[ap.badge, { backgroundColor: `${primary}18` }]}>
          <Feather name="check-circle" size={13} color={primary} />
          <Text style={[ap.badgeText, { color: primary }]}>VERIFIED ATTENDANCE</Text>
        </View>
      </View>
      <Text style={[ap.title, { color: textColor }]}>Proof of Who Came</Text>
      <Text style={[ap.sub, { color: muted }]}>
        Real people who Touched Down at your Gruvs — the proof no impression can give.
      </Text>

      {data === null ? (
        <ActivityIndicator color={primary} style={{ marginVertical: 24 }} />
      ) : data.totalCheckins === 0 ? (
        <View style={ap.empty}>
          <Feather name="map-pin" size={30} color={muted} />
          <Text style={[ap.emptyText, { color: muted }]}>
            No Touch Downs yet. Once people check in at your Gruvs, your verified attendance shows here.
          </Text>
        </View>
      ) : (
        <>
          <View style={ap.grid}>
            <Stat label="Showed up" value={data.totalAttendees} icon="users" color={primary} muted={muted} textColor={textColor} />
            <Stat label="Touch Downs" value={data.totalCheckins} icon="map-pin" color={green} muted={muted} textColor={textColor} />
            {data.showUpRate != null && (
              <Stat label="RSVP → showed" value={data.showUpRate} suffix="%" icon="trending-up" color={amber} muted={muted} textColor={textColor} />
            )}
            <Stat label="Regulars" value={data.repeatVisitors} icon="repeat" color={pink} muted={muted} textColor={textColor} />
            {data.repeatRate > 0 && (
              <Stat label="Repeat rate" value={data.repeatRate} suffix="%" icon="rotate-cw" color="#06b6d4" muted={muted} textColor={textColor} />
            )}
            {!!data.busiestDay && (
              <Stat label="Busiest night" value={data.busiestDay} icon="calendar" color="#8b5cf6" muted={muted} textColor={textColor} />
            )}
          </View>

          {data.perEvent.length > 0 && (
            <View style={{ marginTop: 14 }}>
              <Text style={[ap.sectionLabel, { color: muted }]}>BY GRUV</Text>
              {data.perEvent.map(ev => (
                <View key={ev.id} style={[ap.row, { borderBottomColor: `${primary}12` }]}>
                  <Text style={[ap.evTitle, { color: textColor }]} numberOfLines={1}>{ev.title || 'Gruv'}</Text>
                  <Text style={[ap.evStat, { color: primary }]}>
                    {ev.attendees} came{ev.going > 0 ? ` · ${ev.going} said going` : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </GlassView>
  );
};

const ap = StyleSheet.create({
  card: { margin: 16, padding: 18, borderRadius: 20, borderWidth: 1 },
  head: { flexDirection: 'row', marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.8 },
  title: { fontSize: 18, fontWeight: '900' },
  sub: { fontSize: 12, marginTop: 4, marginBottom: 8, lineHeight: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  stat: { width: '30%', minWidth: 92, flexGrow: 1, alignItems: 'flex-start', gap: 4, paddingVertical: 8 },
  statIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  statVal: { fontSize: 22, fontWeight: '900', marginTop: 2 },
  statLabel: { fontSize: 10.5, fontWeight: '700' },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, gap: 10 },
  evTitle: { fontSize: 13, fontWeight: '700', flex: 1 },
  evStat: { fontSize: 11.5, fontWeight: '800' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 22, paddingHorizontal: 12 },
  emptyText: { fontSize: 12.5, textAlign: 'center', lineHeight: 17 },
});

export default AttendanceAnalyticsPanel;