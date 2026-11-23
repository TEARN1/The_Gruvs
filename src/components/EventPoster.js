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
import { SmartImage } from './SmartImage';

export const CATEGORY_FALLBACK_IMAGES = {
  market: 'https://images.unsplash.com/photo-1513885535751-8b9238bd345a?auto=format&fit=crop&w=800&q=80',
  food: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
  nightlife: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80',
  party: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80',
  music: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80',
  sport: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=800&q=80',
  art: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?auto=format&fit=crop&w=800&q=80',
  comedy: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?auto=format&fit=crop&w=800&q=80',
  wine: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=800&q=80',
  festival: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=800&q=80',
  fashion: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80',
  fitness: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80',
  default: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
};

export function getCategoryPhoto(category, title = '') {
  const cat = String(category || '').toLowerCase();
  const t = String(title || '').toLowerCase();
  if (cat.includes('market') || t.includes('market') || t.includes('christmas')) return CATEGORY_FALLBACK_IMAGES.market;
  if (cat.includes('food') || cat.includes('cook') || t.includes('food')) return CATEGORY_FALLBACK_IMAGES.food;
  if (cat.includes('nightlife') || cat.includes('club') || t.includes('dj')) return CATEGORY_FALLBACK_IMAGES.nightlife;
  if (cat.includes('party')) return CATEGORY_FALLBACK_IMAGES.party;
  if (cat.includes('music') || cat.includes('concert') || cat.includes('acoustic')) return CATEGORY_FALLBACK_IMAGES.music;
  if (cat.includes('sport') || cat.includes('cricket') || cat.includes('match') || cat.includes('tournament')) return CATEGORY_FALLBACK_IMAGES.sport;
  if (cat.includes('art') || cat.includes('theatre') || cat.includes('teater')) return CATEGORY_FALLBACK_IMAGES.art;
  if (cat.includes('comedy') || cat.includes('standup')) return CATEGORY_FALLBACK_IMAGES.comedy;
  if (cat.includes('wine')) return CATEGORY_FALLBACK_IMAGES.wine;
  if (cat.includes('festival')) return CATEGORY_FALLBACK_IMAGES.festival;
  if (cat.includes('fashion') || cat.includes('beauty')) return CATEGORY_FALLBACK_IMAGES.fashion;
  if (cat.includes('fitness') || cat.includes('wellness') || cat.includes('yoga')) return CATEGORY_FALLBACK_IMAGES.fitness;
  return CATEGORY_FALLBACK_IMAGES[cat] || CATEGORY_FALLBACK_IMAGES.default;
}

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

export const EventPoster = ({ title, category, date, time, venue, color = '#00f2ff', height = 260 }) => {
  const photoUri = getCategoryPhoto(category, title);
  return (
    <View
      style={[ep.wrap, { height, backgroundColor: '#0b1112', borderColor: `${color}40` }]}
      accessibilityRole="image"
      accessibilityLabel={`Poster: ${title || 'event'}${venue ? ` at ${venue}` : ''}`}
    >
      {/* Background category photograph with rich contrast overlay */}
      <SmartImage
        source={photoUri}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(11,17,18,0.76)' }]} />
      {/* Soft category colour glow */}
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
};

/**
 * CategoryCover — the backdrop of EventPoster without its text, for small
 * tiles that already print the title over the image (Trending rows).
 */
export const CategoryCover = ({ category, color = '#00f2ff', style }) => {
  const photoUri = getCategoryPhoto(category);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0b1112', overflow: 'hidden' }, style]} accessible={false}>
      <SmartImage
        source={photoUri}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(11,17,18,0.78)' }]} />
      <View style={[ep.disc, { backgroundColor: `${color}38`, width: '130%', aspectRatio: 1, borderRadius: 999, top: '-55%', right: '-45%' }]} />
      <View style={[ep.disc, { backgroundColor: `${color}1c`, width: '90%', aspectRatio: 1, borderRadius: 999, bottom: '-30%', left: '-30%' }]} />
      {!!category && <Text style={[ep.cat, { color, position: 'absolute', top: 14, right: 12, fontSize: 10 }]} numberOfLines={1}>{pretty(category)}</Text>}
    </View>
  );
};

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
