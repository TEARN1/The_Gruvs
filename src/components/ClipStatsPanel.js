/**
 * ClipStatsPanel — in an event's Manage tab: post a clip, and see which clips
 * actually filled the event (views → event opened → RSVP).
 *
 * Numbers come from my_clip_stats(), which returns totals only — never who
 * tapped. Until that function exists (migration not applied) the panel still
 * offers "Post a clip" and simply shows no numbers.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { supabase } from '../services/supabase';
import { storageThumb } from '../utils/storageThumb';

const Stat = ({ n, label, color, muted }) => (
  <View style={cs.stat}>
    <Text style={[cs.statN, { color }]}>{n}</Text>
    <Text style={[cs.statLabel, { color: muted }]}>{label}</Text>
  </View>
);

export const ClipStatsPanel = ({ eventId, primary, textColor, muted, onPostClip, refreshKey = 0 }) => {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    if (!eventId) return undefined;
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('my_clip_stats');
        if (alive) setRows(error ? [] : (data || []).filter((r) => r.event_id === eventId));
      } catch { if (alive) setRows([]); }
    })();
    return () => { alive = false; };
  }, [eventId, refreshKey]);

  const total = (k) => (rows || []).reduce((sum, r) => sum + Number(r[k] || 0), 0);

  return (
    <View style={[cs.card, { borderColor: `${primary}25`, backgroundColor: `${primary}08` }]}>
      <View style={cs.head}>
        <Feather name="film" size={15} color={primary} />
        <Text style={[cs.title, { color: textColor }]}>Clips</Text>
        <TouchableOpacity
          onPress={onPostClip}
          style={[cs.postBtn, { backgroundColor: primary }]}
          accessibilityRole="button"
          accessibilityLabel="Post a clip for this event"
        >
          <Feather name="plus" size={13} color="#000" />
          <Text style={cs.postText}>Post a clip</Text>
        </TouchableOpacity>
      </View>

      {rows && rows.length > 0 ? (
        <>
          <View style={cs.totals}>
            <Stat n={total('views')} label="views" color={textColor} muted={muted} />
            <Feather name="chevron-right" size={14} color={muted} />
            <Stat n={total('event_opens')} label="opened the event" color={textColor} muted={muted} />
            <Feather name="chevron-right" size={14} color={muted} />
            <Stat n={total('rsvps')} label="RSVP'd" color={primary} muted={muted} />
          </View>
          {rows.slice(0, 5).map((r) => (
            <View key={r.reel_id} style={[cs.row, { borderTopColor: `${primary}15` }]}>
              {r.thumbnail_url
                ? <Image source={{ uri: storageThumb(r.thumbnail_url, 72, 108, 60) }} style={cs.thumb} />
                : <View style={[cs.thumb, { backgroundColor: `${primary}15` }]} />}
              <Text style={[cs.rowText, { color: muted }]} numberOfLines={1}>
                {r.mine ? 'Your clip' : 'A guest’s clip'} · {r.views} views · {r.event_opens} opened · {r.rsvps} RSVP’d
              </Text>
            </View>
          ))}
        </>
      ) : (
        <Text style={[cs.empty, { color: muted }]}>
          Post a 10–15 second clip of the venue, the lineup or last time's crowd. Every clip gets an RSVP button, and this shows how many people each one brought in.
        </Text>
      )}
    </View>
  );
};

const cs = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 14, fontWeight: '900' },
  postBtn: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  postText: { color: '#000', fontSize: 12, fontWeight: '800' },
  totals: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 6 },
  stat: { alignItems: 'center', flex: 1 },
  statN: { fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 10.5, fontWeight: '600', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 8, marginTop: 8, borderTopWidth: 1 },
  thumb: { width: 36, height: 54, borderRadius: 6 },
  rowText: { flex: 1, fontSize: 11.5 },
  empty: { fontSize: 12, lineHeight: 17, marginTop: 10 },
});

export default ClipStatsPanel;
