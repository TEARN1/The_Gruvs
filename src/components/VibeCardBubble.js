/**
 * VibeCardBubble — the rich, in-chat render of a shared "Vibe Card".
 *
 * When someone taps Share Gruv → Vibe Card, the message arrives as
 * message_type 'vibe_card'. Instead of showing the plain fallback text, this
 * renders a live identity card for that user: avatar, handle + verified, tier
 * (from the earned vibe-score ladder) with progress to the next tier, vibe
 * score, crew size, city and member-since. It reads the sender's CURRENT
 * profile, so the card is always fresh — reputation earned by showing up.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { supabase } from '../services/supabase';
import { SmartImage } from './SmartImage';
import { getVibeLevel } from '../utils/vibeLevel';

const memberSince = (ts) => {
  if (!ts) return null;
  try { return new Date(ts).getFullYear(); } catch { return null; }
};

export function VibeCardBubble({ userId, primary, textColor, muted, onPress }) {
  const [p, setP] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!userId) { setLoading(false); return; }
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, vibe_score, is_verified, followers_count, city, bio, created_at')
          .eq('id', userId)
          .single();
        if (alive) setP(data);
      } catch { /* keep null → minimal card */ }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [userId]);

  if (loading) {
    return (
      <View style={[s.card, { borderColor: `${primary}30`, minHeight: 90, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={primary} />
      </View>
    );
  }

  const handle = p?.username ? `${p.username}` : (p?.display_name || 'A Viber');
  const score = Number(p?.vibe_score) || 0;
  const level = getVibeLevel(score);
  const crew = Number(p?.followers_count) || 0;
  const year = memberSince(p?.created_at);

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[s.card, { borderColor: `${level.color}55`, backgroundColor: `${level.color}0f` }]}>
      {/* Header: avatar + handle + verified + tier pill */}
      <View style={s.headerRow}>
        {p?.avatar_url
          ? <SmartImage source={p.avatar_url} style={s.avatar} />
          : <View style={[s.avatar, { backgroundColor: `${primary}22`, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: primary, fontWeight: '900', fontSize: 18 }}>{(p?.username || '?').slice(0, 1).toUpperCase()}</Text>
            </View>}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={[s.handle, { color: textColor }]} numberOfLines={1}>{handle}</Text>
            {p?.is_verified && <Feather name="check-circle" size={14} color={primary} />}
          </View>
          {p?.display_name ? <Text style={[s.sub, { color: muted }]} numberOfLines={1}>{p.display_name}</Text> : null}
        </View>
        <View style={[s.tierPill, { backgroundColor: `${level.color}22`, borderColor: level.color }]}>
          <Text style={{ color: level.color, fontSize: 10, fontWeight: '900' }}>{level.name}</Text>
        </View>
      </View>

      {/* Score + progress to next tier */}
      <View style={{ marginTop: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
          <Text style={[s.score, { color: level.color }]}>{score.toLocaleString()}</Text>
          <Text style={[s.sub, { color: muted, marginBottom: 3 }]}>vibe pts</Text>
        </View>
        <View style={[s.track, { backgroundColor: `${level.color}22` }]}>
          <View style={[s.fill, { width: `${level.progress}%`, backgroundColor: level.color }]} />
        </View>
        {level.next
          ? <Text style={[s.hint, { color: muted }]}>{level.toNext.toLocaleString()} pts to {level.next}</Text>
          : <Text style={[s.hint, { color: level.color }]}>Top tier — Legend status</Text>}
      </View>

      {/* Facts row */}
      <View style={s.factsRow}>
        {crew > 0 && (
          <View style={s.fact}><Feather name="users" size={11} color={muted} /><Text style={[s.factText, { color: muted }]}>{crew.toLocaleString()} crew</Text></View>
        )}
        {p?.city ? (
          <View style={s.fact}><Feather name="map-pin" size={11} color={muted} /><Text style={[s.factText, { color: muted }]} numberOfLines={1}>{p.city}</Text></View>
        ) : null}
        {year && (
          <View style={s.fact}><Feather name="calendar" size={11} color={muted} /><Text style={[s.factText, { color: muted }]}>Since {year}</Text></View>
        )}
      </View>

      {p?.bio ? <Text style={[s.bio, { color: muted }]} numberOfLines={2}>{p.bio}</Text> : null}

      <View style={s.footer}>
        <Text style={[s.footerText, { color: primary }]}>View profile</Text>
        <Feather name="chevron-right" size={14} color={primary} />
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 12, width: 260 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  handle: { fontSize: 15, fontWeight: '900' },
  sub: { fontSize: 11, fontWeight: '600' },
  tierPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  score: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  track: { height: 5, borderRadius: 3, marginTop: 6, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3 },
  hint: { fontSize: 10, fontWeight: '700', marginTop: 5 },
  factsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  factText: { fontSize: 11, fontWeight: '700' },
  bio: { fontSize: 11, marginTop: 8, lineHeight: 15 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  footerText: { fontSize: 12, fontWeight: '900' },
});
