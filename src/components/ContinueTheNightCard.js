/**
 * ContinueTheNightCard — "where do we go after?" for a specific Gruv.
 *
 * Shows once the current Gruv is underway/winding down: ranked next stops to keep
 * the night going (after-party / nearby later Gruvs), plus — when tonight's top
 * options clash — one concrete plan (catch both, or which to pick). Powered by the
 * pure, tested engine in src/services/nightPlanner. Anchored to THIS venue's
 * location, so "close by" means close to where you are now.
 *
 * Self-contained: fetches its own candidates and opens a picked stop in a nested
 * detail modal (runtime require avoids an import cycle with EventDetailScreen).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabase';
import { suggestNextStops, resolveClashes } from '../services/nightPlanner';
import { getEventPhase } from '../utils/eventPhase';
import { filterByViewerAge } from '../utils/contentAgeRating';
import { loadViewerAge, viewerAgeSync } from '../utils/viewerAge';

export const ContinueTheNightCard = ({ event, checkedIn = false, onAuthRequired }) => {
  const { currentTheme } = useTheme();
  const primary = currentTheme?.primary || '#00f2ff';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const surface = currentTheme?.surface || 'rgba(255,255,255,0.06)';

  const [stops, setStops] = useState([]);
  const [plan, setPlan] = useState(null);
  const [picked, setPicked] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!event?.id || !event?.city) return undefined;
    // Only worth showing while you're in it or it's winding down/just ended.
    const { phase } = getEventPhase(event, { checkedIn });
    if (phase === 'pre_event') return undefined;

    (async () => {
      try {
        await loadViewerAge(undefined).catch(() => {});
        const today = new Date().toISOString().slice(0, 10);
        const { data } = await supabase
          .from('events')
          .select('id, title, description, category, event_date, event_time, end_date, end_time, date_time, lat, lon, vibe_count, going, cover_url, media, media_urls, city, min_age, age_restriction')
          .eq('city', event.city)
          .gte('event_date', today)
          .neq('id', event.id)
          .neq('is_cancelled', true)
          .neq('is_deleted', true)
          .limit(40);
        if (!alive) return;

        const candidates = filterByViewerAge(data || [], viewerAgeSync(), e => `${e.title || ''} ${e.description || ''}`);
        const opts = { now: Date.now(), userLat: event.lat ?? event.latitude, userLon: event.lon ?? event.longitude };
        const next = suggestNextStops(event, candidates, opts, 3);
        setStops(next);
        // If the top two suggestions clash tonight, surface the plan line.
        if (next.length >= 2) setPlan(resolveClashes([next[0].event, next[1].event], opts));
      } catch { /* silent — discovery is best-effort */ }
    })();
    return () => { alive = false; };
  }, [event?.id, event?.city, checkedIn]);

  if (!stops.length) return null;

  // Runtime require dodges the EventDetailScreen ↔ card import cycle.
  const DetailModal = picked ? require('../screens/EventDetailScreen').EventDetailScreen : null;

  return (
    <View style={[s.wrap, { backgroundColor: surface, borderColor: `${primary}30` }]}>
      <View style={s.head}>
        <View style={[s.icon, { backgroundColor: `${primary}18`, borderColor: `${primary}35` }]}>
          <Feather name="arrow-right-circle" size={16} color={primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: textColor }]}>Continue the night</Text>
          <Text style={[s.sub, { color: muted }]}>Where to go after this one</Text>
        </View>
      </View>

      {plan && (plan.type === 'both' || plan.type === 'pick') && (
        <View style={[s.planLine, { borderColor: `${primary}20`, backgroundColor: `${primary}08` }]}>
          <Feather name={plan.type === 'both' ? 'check-circle' : 'git-branch'} size={12} color={primary} />
          <Text style={[s.planText, { color: muted }]} numberOfLines={2}>{plan.reason}</Text>
        </View>
      )}

      {stops.map(({ event: e, distanceKm, reasons }) => (
        <TouchableOpacity
          key={e.id}
          style={[s.row, { borderColor: `${primary}18` }]}
          onPress={() => setPicked(e)}
          activeOpacity={0.85}
        >
          <View style={{ flex: 1 }}>
            <Text style={[s.name, { color: textColor }]} numberOfLines={1}>{e.title}</Text>
            <Text style={[s.meta, { color: muted }]} numberOfLines={1}>
              {[
                e.event_time ? e.event_time.slice(0, 5) : null,
                distanceKm != null ? `${distanceKm < 1 ? '<1' : Math.round(distanceKm)} km` : null,
                ...(reasons || []).slice(0, 1),
              ].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Feather name="arrow-up-right" size={16} color={primary} />
        </TouchableOpacity>
      ))}

      {DetailModal && (
        <DetailModal event={picked} visible={!!picked} onClose={() => setPicked(null)} onAuthRequired={onAuthRequired} />
      )}
    </View>
  );
};

const s = StyleSheet.create({
  wrap: { marginHorizontal: 14, marginVertical: 8, borderRadius: 18, borderWidth: 1, padding: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 12 },
  icon: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14.5, fontWeight: '900' },
  sub: { fontSize: 11.5, fontWeight: '500', marginTop: 1 },
  planLine: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 10 },
  planText: { fontSize: 12, fontWeight: '600', flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 13, paddingVertical: 10, paddingHorizontal: 12, marginTop: 8 },
  name: { fontSize: 13.5, fontWeight: '800' },
  meta: { fontSize: 11.5, fontWeight: '500', marginTop: 2 },
});

export default ContinueTheNightCard;
