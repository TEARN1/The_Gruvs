/**
 * CheckInNudge — "📍 You're at Taboo — Touch Down?" When you're physically at a
 * Gruv you saved / RSVP'd today, prompt the core verified-presence action right
 * in the feed (don't make people dig into the event to check in). Self-contained:
 * fetches today's relevant events + best-effort location, uses the tested
 * nearestCheckInTarget util. Renders nothing unless you're actually at one.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';
import { GlassView } from './GlassView';
import { LocationService } from '../services/locationService';
import { nearestCheckInTarget } from '../utils/nearestCheckIn';

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function CheckInNudge({ userId, onCheckIn }) {
  const { currentTheme } = useTheme();
  const textColor = currentTheme?.text || '#fff';
  const muted     = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  const [target, setTarget] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!userId) return undefined;
    (async () => {
      try {
        const today = todayStr();
        const [saved, rsvps] = await Promise.all([
          supabase.from('saved_events').select('events(id,title,venue_name,lat,lon,event_date)').eq('user_id', userId),
          supabase.from('event_rsvps').select('events(id,title,venue_name,lat,lon,event_date)').eq('user_id', userId).in('status', ['going', 'maybe']),
        ]);
        const evs = [...(saved.data || []), ...(rsvps.data || [])]
          .map((r) => r.events)
          .filter((e) => e && Number.isFinite(e.lat) && Number.isFinite(e.lon) && String(e.event_date || '').slice(0, 10) === today);
        if (!evs.length) return;                       // nothing today → skip location prompt
        const coords = await LocationService.requestAndGet();   // null if denied/unavailable
        if (!coords) return;
        if (alive) setTarget(nearestCheckInTarget(evs, coords));
      } catch { /* offline / RLS / no GPS — stay hidden */ }
    })();
    return () => { alive = false; };
  }, [userId]);

  if (!target?.event) return null;
  const ev = target.event;

  return (
    <GlassView style={[s.wrap, { borderColor: 'rgba(16,185,129,0.4)' }]}>
      <View style={s.left}>
        <View style={s.dot} />
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: textColor }]} numberOfLines={1}>
            You're at <Text style={{ fontWeight: '900' }}>{ev.venue_name || ev.title}</Text>
          </Text>
          <Text style={[s.sub, { color: muted }]} numberOfLines={1}>Touch Down to get counted</Text>
        </View>
      </View>
      <TouchableOpacity
        style={s.btn}
        accessibilityRole="button"
        accessibilityLabel={`Touch Down at ${ev.title}`}
        onPress={() => onCheckIn && onCheckIn(ev)}
      >
        <Feather name="map-pin" size={13} color="#000" />
        <Text style={s.btnText}>Touch Down</Text>
      </TouchableOpacity>
    </GlassView>
  );
}

const s = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 14, borderRadius: 20, padding: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#10b981' },
  title: { fontSize: 14, fontWeight: '700' },
  sub: { fontSize: 11, marginTop: 1 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#10b981', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14 },
  btnText: { color: '#000', fontWeight: '900', fontSize: 13 },
});
