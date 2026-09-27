/**
 * BusinessTrendPanel — Drop rule 38: "what's trending near you" for businesses.
 *
 * Real market intel from REAL data (no fabricated signals): upcoming events in
 * the business's city over the next 14 days, ranked by the canonical
 * heatScore, aggregated into (a) the categories The Crowd is into this week
 * and (b) the hottest individual nights. This is what a business plans stock,
 * staffing and Missions around.
 *
 * Tier hook: every tier sees the category pulse (taste of the intel);
 * the hottest-events breakdown is part of Advanced Reads (Pro+).
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { LocationService } from '../services/locationService';
import { heatScore } from '../utils/heatScore';
import { can } from '../services/businessEntitlements';

export const BusinessTrendPanel = ({ tier, primary = '#00f2ff', textColor = '#fff', muted = 'rgba(255,255,255,0.55)', surface = '#131a1c' }) => {
  const { profile } = useAuth();
  const [cats, setCats] = useState([]);   // [{ cat, share }]
  const [hot, setHot] = useState([]);     // top events
  const [city, setCity] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const c = profile?.city || LocationService.getCached()?.city || null;
        if (alive) setCity(c);
        const today = new Date().toISOString().slice(0, 10);
        const horizon = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
        let q = supabase.from('events')
          .select('id, title, venue_name, category, event_date, event_time, vibe_count, going, created_at, city')
          .gte('event_date', today).lte('event_date', horizon)
          .is('deleted_at', null).neq('status', 'cancelled')
          .limit(120);
        if (c) q = q.ilike('city', `%${c}%`);
        const { data, error } = await q;
        if (error || !alive) return;
        const rows = (data || []).map(e => ({ e, h: Math.max(0, heatScore(e)) })).filter(x => x.h > 0);
        if (!rows.length) { setCats([]); setHot([]); return; }

        // Category pulse — share of total heat per category.
        const byCat = new Map();
        let total = 0;
        rows.forEach(({ e, h }) => {
          const cat = (e.category || 'other').toLowerCase();
          byCat.set(cat, (byCat.get(cat) || 0) + h);
          total += h;
        });
        const top = [...byCat.entries()]
          .sort((a, b) => b[1] - a[1]).slice(0, 5)
          .map(([cat, h]) => ({ cat, share: Math.round((h / total) * 100) }));

        if (alive) {
          setCats(top);
          setHot(rows.sort((a, b) => b.h - a.h).slice(0, 3).map(x => x.e));
        }
      } catch { /* intel is enhancement — never break the dashboard */ }
    })();
    return () => { alive = false; };
  }, [profile?.city]);

  if (!cats.length) return null; // no signal → no panel (never fabricate)

  const advanced = can(tier, 'advancedReads');

  return (
    <View style={[bt.card, { backgroundColor: surface, borderColor: `${primary}20` }]}>
      <View style={bt.headRow}>
        <Feather name="trending-up" size={13} color={primary} />
        <Text style={[bt.head, { color: textColor }]}>
          What The Crowd is into {city ? `in ${city}` : 'near you'} — next 14 days
        </Text>
      </View>

      {/* Category pulse — every tier */}
      {cats.map(({ cat, share }) => (
        <View key={cat} style={bt.catRow}>
          <Text style={[bt.catName, { color: textColor }]} numberOfLines={1}>{cat}</Text>
          <View style={bt.track}>
            <View style={[bt.fill, { width: `${Math.max(4, share)}%`, backgroundColor: primary }]} />
          </View>
          <Text style={[bt.share, { color: muted }]}>{share}%</Text>
        </View>
      ))}

      {/* Hottest nights — Advanced Reads (Pro+) */}
      {advanced ? (
        hot.map(e => (
          <View key={e.id} style={bt.hotRow}>
            <Feather name="zap" size={11} color="#f59e0b" />
            <Text style={[bt.hotText, { color: muted }]} numberOfLines={1}>
              <Text style={{ color: textColor, fontWeight: '800' }}>{e.title}</Text>
              {e.venue_name ? `  ·  ${e.venue_name}` : ''}{e.event_date ? `  ·  ${e.event_date.slice(5)}` : ''}
            </Text>
          </View>
        ))
      ) : (
        <Text style={[bt.lockNote, { color: muted }]}>
          <Feather name="lock" size={10} color={muted} /> The hottest individual nights unlock with Pro (Advanced Reads).
        </Text>
      )}
    </View>
  );
};

const bt = StyleSheet.create({
  card:    { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 14, gap: 8 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 2 },
  head:    { fontSize: 13, fontWeight: '900', flex: 1 },
  catRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catName: { fontSize: 11, fontWeight: '700', width: 82, textTransform: 'capitalize' },
  track:   { flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  fill:    { height: '100%', borderRadius: 3 },
  share:   { fontSize: 10, fontWeight: '800', width: 32, textAlign: 'right' },
  hotRow:  { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2 },
  hotText: { fontSize: 11, flex: 1 },
  lockNote:{ fontSize: 10, fontWeight: '600', marginTop: 4 },
});
