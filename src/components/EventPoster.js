/**
 * EventPoster — a poster drawn from the event's own details, for events posted
 * with no picture (60 of the 106 upcoming ones). They used to show a grey box
 * reading "No photo added", which made a real night look abandoned.
 *
 * Everything on it comes from the event row — title, category, date, time,
 * venue — so it never claims anything the host didn't say.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/** "SAT 25 OCT · 21:00" from an ISO date and an optional "HH:MM[:SS]" time. Exported for tests. */
export function posterWhen(date, time) {
  if (!date) return '';
  const d = new Date(`${String(date).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/,/g, '');
  const hhmm = /^\d{1,2}:\d{2}/.test(String(time || '')) ? String(time).slice(0, 5) : '';
  return [day.toUpperCase(), hhmm].filter(Boolean).join(' · ');
}

const pretty = (cat) => String(cat || '').replace(/[_-]+/g, ' ').trim().toUpperCase();

export const EventPoster = ({ title, category, date, time, venue, color = '#00f2ff', height = 260 }) => (
  <View
    style={[ep.wrap, { height, backgroundColor: '#0b1112', borderColor: `${color}40` }]}
    accessibilityRole="image"
    accessibilityLabel={`Poster: ${title || 'event'}${venue ? ` at ${venue}` : ''}`}
  >
    {/* Two soft discs of the category colour, so each category reads differently at a glance */}
    <View style={[ep.disc, { backgroundColor: `${color}2e`, width: height * 1.1, height: height * 1.1, borderRadius: height, top: -height * 0.45, right: -height * 0.35 }]} />
    <View style={[ep.disc, { backgroundColor: `${color}18`, width: height * 0.8, height: height * 0.8, borderRadius: height, bottom: -height * 0.35, left: -height * 0.2 }]} />
    <View style={ep.body}>
      {!!category && <Text style={[ep.cat, { color }]} numberOfLines={1}>{pretty(category)}</Text>}
      <Text style={ep.title} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.7}>{title || 'Untitled event'}</Text>
      <View style={[ep.rule, { backgroundColor: color }]} />
      {!!posterWhen(date, time) && <Text style={ep.when}>{posterWhen(date, time)}</Text>}
      {!!venue && <Text style={ep.venue} numberOfLines={1}>{venue}</Text>}
    </View>
  </View>
);

const ep = StyleSheet.create({
  wrap: { width: '100%', overflow: 'hidden', borderBottomWidth: 1, justifyContent: 'flex-end' },
  disc: { position: 'absolute' },
  body: { padding: 18, gap: 6 },
  cat: { fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  title: { color: '#fff', fontSize: 26, fontWeight: '900', lineHeight: 30, letterSpacing: -0.3 },
  rule: { width: 36, height: 3, borderRadius: 2, marginVertical: 4 },
  when: { color: 'rgba(255,255,255,0.92)', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  venue: { color: 'rgba(255,255,255,0.7)', fontSize: 12.5, fontWeight: '600' },
});

export default EventPoster;
