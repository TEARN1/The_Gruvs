/**
 * SuggestedFollows — "who to follow" card strip for the feed.
 *
 * A horizontal rail of people you don't follow yet, ranked by the
 * suggested_follows RPC (mutuals) with a vibe_score fallback. Each card is a
 * tappable mini-profile with a one-tap Follow. Self-contained: it fetches,
 * follows, and opens profiles on its own — drop <SuggestedFollows /> anywhere.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { thumb } from '../utils/storageThumb';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useIdentity } from '../context/IdentityContext';
import { supabase } from '../services/supabase';
import { resilientRead } from '../utils/resilience';
import { haptics } from '../utils/haptics';
import { ViberProfileModal } from './ViberProfileModal';
import { GlitterBurst } from './GlitterBurst';
import { rankPeople } from '../services/peopleScore';

const AV_COLORS = ['#8b5cf6', '#ec4899', '#f97316', '#10b981', '#3b82f6', '#f59e0b', '#06b6d4', '#a78bfa'];
const avatarBg = (name = '') => AV_COLORS[(name.charCodeAt(0) || 0) % AV_COLORS.length];

export const SuggestedFollows = ({ onNavigateToEvent }) => {
  const { currentTheme } = useTheme();
  const { user, profile } = useAuth();
  const { applyProfilePrivacy } = useIdentity();
  const primary   = currentTheme?.primary    || '#00f2ff';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.55)';
  const surface   = currentTheme?.surface    || '#131a1c';

  const [people, setPeople]   = useState([]);
  const [followed, setFollowed] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId]   = useState(null);
  const [followFx, setFollowFx] = useState({ id: null, t: 0 });

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    let followingIds = new Set();
    let blockedIds = new Set();
    try {
      const [{ data }, { data: blocks }] = await Promise.all([
        supabase.from('follows').select('following_id').eq('follower_id', user.id),
        // Block is ABSOLUTE — never SUGGEST someone the viewer blocked (B-sweep 2).
        supabase.from('user_blocks').select('blocked_id').eq('blocker_id', user.id),
      ]);
      followingIds = new Set((data || []).map(r => r.following_id));
      blockedIds = new Set((blocks || []).map(r => r.blocked_id));
    } catch { /* ignore */ }

    // identity_mode/is_beacon_active are needed to honor ghost/incognito privacy.
    const cols = 'id, username, display_name, avatar_url, is_verified, vibe_score, bio, career_title, interests, is_online, last_seen, social_integrity_score, lat, lon, identity_mode, is_beacon_active';
    // Privacy is ABSOLUTE (like block): a ghost is anonymised, an incognito user
    // (celebrity mode, no beacon) is DROPPED — never suggest someone who chose to
    // be hidden, with their real identity. Runs before ranking.
    const privacy = (list) => (list || [])
      .filter(p => !blockedIds.has(p.id))
      .map(p => applyProfilePrivacy(p, p.id))
      .filter(Boolean);
    // F5 — rank people by RELEVANCE (shared interests, mutuals, proximity,
    // recency, trust), not by fame. The viewer context feeds personScore.
    const viewer = { id: user.id, interests: profile?.interests, lat: profile?.lat, lon: profile?.lon };
    const scored = await resilientRead(
      async () => {
        const { data, error } = await supabase.rpc('suggested_follows', { p_user: user.id, p_limit: 14 });
        if (error) throw error;
        if (!data?.length) return [];
        const ids = data.map(r => r.suggested_id);
        const { data: profiles, error: pErr } = await supabase.from('profiles').select(cols).in('id', ids);
        if (pErr) throw pErr;
        const withMutuals = privacy(profiles)
          .map(p => ({ ...p, mutual_count: data.find(r => r.suggested_id === p.id)?.mutual_count || 0 }));
        const extras = new Map(withMutuals.map(p => [p.id, { mutualCount: p.mutual_count }]));
        return rankPeople(viewer, withMutuals, extras);
      },
      async () => {
        // Fallback pool is fetched by vibe_score (a cheap oversample), but the
        // ORDER shown is personScore — fame is a pool heuristic, not a ranking.
        const { data, error } = await supabase.from('profiles').select(cols)
          .neq('id', user.id).order('vibe_score', { ascending: false }).limit(28);
        if (error) throw error;
        return rankPeople(viewer, privacy(data).map(p => ({ ...p, mutual_count: 0 }))).slice(0, 14);
      },
      async () => [],
      [],
      'SuggestedFollows.load',
    );
    setPeople((scored || []).filter(p => p.id !== user.id && !followingIds.has(p.id)));
    setLoading(false);
  }, [user, profile, applyProfilePrivacy]);

  useEffect(() => { load(); }, [load]);

  const follow = useCallback(async (id) => {
    if (!user) return;
    try { haptics.select?.(); } catch {}
    setFollowed(prev => new Set(prev).add(id));
    setFollowFx({ id, t: Date.now() }); // sparkle on follow
    try {
      // RPC is the reliable, RLS-proof primary path; fall back to a direct upsert.
      let { error } = await supabase.rpc('follow_user', { p_follower_id: user.id, p_following_id: id });
      if (error) {
        ({ error } = await supabase.from('follows')
          .upsert({ follower_id: user.id, following_id: id }, { onConflict: 'follower_id,following_id', ignoreDuplicates: true }));
      }
      // resolved (not thrown) errors must be surfaced so the optimistic add reverts
      if (error && !/duplicate|already exists|unique/i.test(error.message || '')) throw error;
    } catch {
      setFollowed(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  }, [user]);

  if (!user) return null;
  if (!loading && people.length === 0) return null;

  return (
    <View style={sf.wrap}>
      <View style={sf.header}>
        <Feather name="user-plus" size={15} color={primary} />
        <Text style={[sf.title, { color: textColor }]}>Suggested for you</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={primary} style={{ marginVertical: 26 }} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 12, paddingBottom: 4 }}>
          {people.map(p => {
            const isFollowed = followed.has(p.id);
            const name = p.display_name || p.username || 'Viber';
            const sub = p.career_title || p.bio
              || (p.mutual_count > 0 ? `${p.mutual_count} mutual${p.mutual_count !== 1 ? 's' : ''}` : 'On The Gruvs');
            return (
              <View key={p.id} style={[sf.card, { backgroundColor: surface, borderColor: `${primary}22` }]}>
                <TouchableOpacity activeOpacity={0.85} onPress={() => { try { haptics.light?.(); } catch {} setOpenId(p.id); }} style={{ alignItems: 'center' }}>
                  {p.avatar_url
                    ? <Image source={{ uri: thumb.avatarLg(p.avatar_url) }} style={[sf.avatar, { borderColor: `${primary}40` }]} />
                    : <View style={[sf.avatar, { backgroundColor: avatarBg(name), alignItems: 'center', justifyContent: 'center', borderColor: `${primary}40` }]}>
                        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 26 }}>{name[0].toUpperCase()}</Text>
                      </View>}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 9, maxWidth: 120 }}>
                    <Text style={[sf.name, { color: textColor }]} numberOfLines={1}>{name}</Text>
                    {p.is_verified && <Feather name="check-circle" size={12} color={primary} />}
                  </View>
                  <Text style={[sf.sub, { color: muted }]} numberOfLines={2}>{sub}</Text>
                </TouchableOpacity>
                <View style={{ position: 'relative', alignSelf: 'stretch' }}>
                <TouchableOpacity
                  onPress={() => { if (!isFollowed) follow(p.id); }}
                  activeOpacity={0.85}
                  style={[sf.followBtn, isFollowed
                    ? { backgroundColor: 'transparent', borderColor: muted }
                    : { backgroundColor: primary, borderColor: primary }]}
                >
                  {isFollowed && <Feather name="check" size={12} color={muted} />}
                  <Text style={{ color: isFollowed ? muted : '#000', fontWeight: '900', fontSize: 12 }}>
                    {isFollowed ? 'Following' : '+ Follow'}
                  </Text>
                </TouchableOpacity>
                <GlitterBurst trigger={followFx.id === p.id ? followFx.t : 0} size={110} />
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <ViberProfileModal
        visible={!!openId}
        userId={openId}
        onClose={() => setOpenId(null)}
        onNavigateToEvent={onNavigateToEvent}
      />
    </View>
  );
};

const sf = StyleSheet.create({
  wrap: { marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, marginBottom: 10 },
  title: { fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
  card: { width: 150, borderRadius: 18, borderWidth: 1, padding: 14, alignItems: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2 },
  name: { fontSize: 14, fontWeight: '900' },
  sub: { fontSize: 11, textAlign: 'center', marginTop: 3, lineHeight: 15, minHeight: 30 },
  followBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1, alignSelf: 'stretch' },
});

export default SuggestedFollows;