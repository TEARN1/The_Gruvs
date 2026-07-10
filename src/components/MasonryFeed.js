/**
 * MasonryFeed — Pinterest-style staggered event grid for The Drop.
 * Two columns of full-bleed event images with varied heights ("layers"),
 * balanced by shortest-column packing. Tap a card → event detail.
 * Pure presentation; the packing math lives in utils/masonry (tested).
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SmartImage } from './SmartImage';
import { packMasonry, eventImageUrl } from '../utils/masonry';
import { thumb } from '../utils/storageThumb';
import { CATEGORY_CONFIG } from '../constants/CategoryConfig';
import { priceLabel } from '../constants/currencies';

const isWeb = Platform.OS === 'web';

const fmtDate = (d) => {
  if (!d) return null;
  try { return new Date(d).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }); }
  catch { return null; }
};

const MasonryCard = ({ event, aspect, onPress, primary, textColor }) => {
  const url = thumb.thumbnail(eventImageUrl(event)); // downscaled — masonry tiles are small
  const catColor = CATEGORY_CONFIG[event.category]?.color || primary;
  const date = fmtDate(event.event_date);
  const pl = priceLabel(event.price);
  const isFree = pl === 'FREE';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress?.(event)}
      style={[m.card, { borderColor: `${catColor}22` }]}
      accessibilityRole="button"
      accessibilityLabel={`Open event: ${event.title || 'event'}`}
    >
      <View style={{ width: '100%', aspectRatio: 1 / aspect, backgroundColor: `${catColor}14` }}>
        {url ? (
          <SmartImage source={{ uri: url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
            <Feather name="music" size={26} color={`${catColor}66`} />
          </View>
        )}
        {/* bottom scrim for legibility */}
        <View style={[StyleSheet.absoluteFill, isWeb
          ? { backgroundImage: 'linear-gradient(to bottom, transparent 55%, rgba(0,0,0,0.72) 100%)' }
          : { backgroundColor: 'rgba(0,0,0,0.18)' }]} pointerEvents="none" />
        {/* date chip */}
        {date && (
          <View style={[m.dateChip, { backgroundColor: 'rgba(8,14,16,0.82)', borderColor: `${catColor}66` }]}>
            <Text style={[m.dateChipText, { color: '#fff' }]}>{date}</Text>
          </View>
        )}
        {/* overlay caption */}
        <View style={m.overlay}>
          <Text style={m.title} numberOfLines={2}>{event.title || 'Untitled Gruv'}</Text>
          <View style={m.metaRow}>
            {event.venue_name ? (
              <Text style={m.venue} numberOfLines={1}>📍 {event.venue_name}</Text>
            ) : <View style={{ flex: 1 }} />}
            <Text style={[m.price, { color: isFree ? '#34d399' : '#fff' }]}>{pl}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export const MasonryFeed = ({ events = [], onSelectEvent, primary, textColor }) => {
  const columns = useMemo(() => packMasonry(events, { columns: 2 }), [events]);
  if (!events.length) return null;
  return (
    <View style={m.wrap}>
      {columns.map((col, ci) => (
        <View key={ci} style={m.col}>
          {col.map(({ event, aspect }) => (
            <MasonryCard
              key={event.id}
              event={event}
              aspect={aspect}
              onPress={onSelectEvent}
              primary={primary}
              textColor={textColor}
            />
          ))}
        </View>
      ))}
    </View>
  );
};

const m = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingBottom: 24 },
  col: { flex: 1, gap: 10 },
  card: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, backgroundColor: '#0b1112' },
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 10 },
  title: { color: '#fff', fontSize: 13.5, fontWeight: '900', lineHeight: 17, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  venue: { color: 'rgba(255,255,255,0.85)', fontSize: 10.5, fontWeight: '700', flex: 1 },
  price: { fontSize: 11, fontWeight: '900' },
  dateChip: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  dateChipText: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.4 },
});

export default MasonryFeed;
