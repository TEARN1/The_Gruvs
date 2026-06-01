/**
 * PlayerProfileModal — a player's full career page (the "FIFA card").
 *
 * Glass/water FUT-style card (OVR, photo, club, position, nationality) plus the
 * career timeline (clubs by season), season-by-season stats with ratings, recent
 * scout ratings, and a follow button. Backed by TalentEngine.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';
import { GlassView } from './GlassView';
import { LiquidBackground } from './LiquidBackground';
import { AnimatedCounter } from './Motion';
import { haptics } from '../utils/haptics';
import { TalentEngine, playerOVR } from '../services/talentEngine';

const IS_WEB = Platform.OS === 'web';

const StatPill = ({ label, value, color }) => (
  <View style={st.statPill}>
    <AnimatedCounter value={value} style={[st.statValue, { color }]} />
    <Text style={st.statLabel}>{label}</Text>
  </View>
);

const SectionTitle = ({ children, muted }) => (
  <Text style={[st.sectionTitle, { color: muted }]}>{children}</Text>
);

export const PlayerProfileModal = ({ visible, playerId, onClose }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface    || '#1a1f21';

  const [loading, setLoading] = useState(true);
  const [player, setPlayer]   = useState(null);
  const [career, setCareer]   = useState({ spells: [], seasons: [] });
  const [ratings, setRatings] = useState([]);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const load = useCallback(async () => {
    if (!playerId) return;
    setLoading(true);
    try {
      const [p, c, r, isF] = await Promise.all([
        TalentEngine.getPlayer(playerId),
        TalentEngine.getCareer(playerId),
        TalentEngine.getRecentRatings(playerId),
        TalentEngine.isFollowing(playerId, user?.id),
      ]);
      setPlayer(p); setCareer(c); setRatings(r || []); setFollowing(isF);
    } catch { /* best-effort */ }
    finally { setLoading(false); }
  }, [playerId, user?.id]);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  const handleFollow = async () => {
    if (!user) { toast.show('Sign in to follow players', 'info'); return; }
    if (followBusy) return;
    setFollowBusy(true);
    const next = !following;
    setFollowing(next);
    setPlayer(p => p ? { ...p, follower_count: Math.max(0, (p.follower_count || 0) + (next ? 1 : -1)) } : p);
    next ? haptics.success() : haptics.light();
    const result = await TalentEngine.toggleFollow(playerId, user.id, following);
    setFollowing(result);
    setFollowBusy(false);
  };

  const ovr = playerOVR(player);
  const flag = (player?.nationality || '').toUpperCase();
  const clubName = player?.current_club?.name || player?.current_club?.short_name;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[st.root, { backgroundColor: bg }]}>
        <LiquidBackground intensity={0.9} />

        {/* Header */}
        <View style={st.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={st.headerBtn}>
            <Feather name="x" size={22} color={textColor} />
          </TouchableOpacity>
          <Text style={[st.headerTitle, { color: textColor }]}>Player</Text>
          <View style={st.headerBtn} />
        </View>

        {loading ? (
          <View style={st.center}><ActivityIndicator color={primary} size="large" /></View>
        ) : !player ? (
          <View style={st.center}>
            <Feather name="user-x" size={40} color={muted} />
            <Text style={{ color: muted, marginTop: 12 }}>Player not found</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>

            {/* ── FIFA / FUT card ───────────────────────────────── */}
            <GlassView glow intensity={1.2} style={st.futCard}>
              <View style={st.futTopRow}>
                <View style={st.futOvrCol}>
                  <Text style={[st.futOvr, { color: primary }]}>{ovr}</Text>
                  <Text style={[st.futPos, { color: textColor }]}>
                    {(player.primary_position || player.sport_type || 'PLR').slice(0, 3).toUpperCase()}
                  </Text>
                  {flag ? <Text style={st.futFlag}>{flag}</Text> : null}
                  {clubName ? <Text style={[st.futClub, { color: muted }]} numberOfLines={1}>{clubName}</Text> : null}
                </View>
                <View style={st.futPhotoWrap}>
                  {player.photo_url
                    ? <Image source={{ uri: player.photo_url }} style={st.futPhoto} />
                    : <View style={[st.futPhoto, { backgroundColor: `${primary}20`, alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ fontSize: 40, fontWeight: '900', color: primary }}>{(player.full_name || '?')[0].toUpperCase()}</Text>
                      </View>
                  }
                </View>
              </View>

              <Text style={[st.futName, { color: textColor }]} numberOfLines={1}>
                {player.known_as || player.full_name}
                {player.is_verified && <Text>  <Feather name="check-circle" size={15} color={primary} /></Text>}
              </Text>

              {/* Stat line */}
              <View style={st.futStats}>
                <StatPill label="GOALS"  value={player.career_goals || 0}   color={primary} />
                <StatPill label="ASSIST" value={player.career_assists || 0} color={primary} />
                <StatPill label="APPS"   value={player.career_apps || 0}    color={primary} />
                <StatPill label="RATING" value={Math.round((player.career_rating || 0) * 10) / 10} color={primary} />
              </View>
            </GlassView>

            {/* Meta row */}
            <View style={st.metaRow}>
              {player.age != null && <MetaChip icon="calendar" text={`${player.age} yrs`} muted={muted} primary={primary} />}
              {player.region ? <MetaChip icon="map-pin" text={player.region} muted={muted} primary={primary} /> : null}
              <MetaChip icon="users" text={`${player.follower_count || 0} followers`} muted={muted} primary={primary} />
            </View>

            {/* Actions */}
            <View style={st.actions}>
              <TouchableOpacity
                style={[st.followBtn, { backgroundColor: following ? 'transparent' : primary, borderColor: primary }]}
                onPress={handleFollow}
                disabled={followBusy}
                activeOpacity={0.85}
              >
                <Feather name={following ? 'check' : 'plus'} size={16} color={following ? primary : '#000'} />
                <Text style={[st.followText, { color: following ? primary : '#000' }]}>
                  {following ? 'Following' : 'Follow Player'}
                </Text>
              </TouchableOpacity>
              {user && player.user_id == null && (
                <TouchableOpacity
                  style={[st.claimBtn, { borderColor: `${primary}50` }]}
                  onPress={async () => {
                    const ok = await TalentEngine.claimPlayer(playerId, user.id);
                    if (ok) { toast.show('Player profile claimed — it’s yours now', 'success'); load(); }
                    else toast.show('Could not claim this profile', 'error');
                  }}
                >
                  <Feather name="award" size={15} color={primary} />
                  <Text style={[st.claimText, { color: primary }]}>This is me</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ── Career timeline (clubs by season) ─────────────── */}
            {career.spells.length > 0 && (
              <>
                <SectionTitle muted={muted}>CAREER</SectionTitle>
                {career.spells.map((s, i) => (
                  <GlassView key={s.id || i} sheen={false} style={st.row}>
                    {s.club?.logo_url
                      ? <Image source={{ uri: s.club.logo_url }} style={st.crest} />
                      : <View style={[st.crest, { backgroundColor: `${primary}18`, alignItems: 'center', justifyContent: 'center' }]}>
                          <Feather name="shield" size={16} color={primary} />
                        </View>}
                    <View style={{ flex: 1 }}>
                      <Text style={[st.rowTitle, { color: textColor }]} numberOfLines={1}>
                        {s.club?.name || s.club_name || 'Club'}
                      </Text>
                      <Text style={[st.rowSub, { color: muted }]} numberOfLines={1}>
                        {[s.season?.name, s.position, s.shirt_number ? `#${s.shirt_number}` : null].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    {s.is_current && (
                      <View style={[st.nowBadge, { backgroundColor: `${primary}20` }]}>
                        <Text style={[st.nowText, { color: primary }]}>NOW</Text>
                      </View>
                    )}
                  </GlassView>
                ))}
              </>
            )}

            {/* ── Season-by-season stats ────────────────────────── */}
            {career.seasons.length > 0 && (
              <>
                <SectionTitle muted={muted}>BY SEASON</SectionTitle>
                <GlassView sheen={false} style={{ padding: 0, overflow: 'hidden' }}>
                  <View style={[st.tableHead, { borderBottomColor: `${primary}20` }]}>
                    <Text style={[st.th, { color: muted, flex: 2 }]}>Season</Text>
                    <Text style={[st.th, { color: muted }]}>Apps</Text>
                    <Text style={[st.th, { color: muted }]}>Gls</Text>
                    <Text style={[st.th, { color: muted }]}>Ast</Text>
                    <Text style={[st.th, { color: muted }]}>Rtg</Text>
                  </View>
                  {career.seasons.map((ss, i) => (
                    <View key={ss.id || i} style={[st.tr, i % 2 ? { backgroundColor: 'rgba(255,255,255,0.03)' } : null]}>
                      <Text style={[st.td, { color: textColor, flex: 2 }]} numberOfLines={1}>
                        {ss.season?.name || ss.competition?.name || '—'}
                      </Text>
                      <Text style={[st.td, { color: textColor }]}>{ss.appearances || 0}</Text>
                      <Text style={[st.td, { color: primary, fontWeight: '900' }]}>{ss.goals || 0}</Text>
                      <Text style={[st.td, { color: textColor }]}>{ss.assists || 0}</Text>
                      <Text style={[st.td, { color: textColor }]}>{ss.avg_rating ? Number(ss.avg_rating).toFixed(1) : '—'}</Text>
                    </View>
                  ))}
                </GlassView>
              </>
            )}

            {/* ── Recent scout ratings ──────────────────────────── */}
            {ratings.length > 0 && (
              <>
                <SectionTitle muted={muted}>RECENT RATINGS</SectionTitle>
                {ratings.map((r, i) => (
                  <View key={i} style={[st.ratingRow, { borderBottomColor: `${primary}10` }]}>
                    <Text style={[st.ratingNum, { color: primary }]}>{Number(r.rating).toFixed(1)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[st.rowTitle, { color: textColor }]}>@{r.rater?.username || 'scout'}</Text>
                      {r.note ? <Text style={[st.rowSub, { color: muted }]} numberOfLines={2}>{r.note}</Text> : null}
                    </View>
                  </View>
                ))}
              </>
            )}

            {career.spells.length === 0 && career.seasons.length === 0 && (
              <Text style={{ color: muted, textAlign: 'center', marginTop: 24, fontSize: 13 }}>
                No career history yet — appearances and goals will show here as this player features in events.
              </Text>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const MetaChip = ({ icon, text, muted, primary }) => (
  <View style={[st.metaChip, { borderColor: `${primary}25` }]}>
    <Feather name={icon} size={11} color={muted} />
    <Text style={[st.metaChipText, { color: muted }]}>{text}</Text>
  </View>
);

const st = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 54 : 36, paddingBottom: 10 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },

  futCard: { padding: 18, marginBottom: 14 },
  futTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  futOvrCol: { alignItems: 'center', width: 64 },
  futOvr: { fontSize: 40, fontWeight: '900', lineHeight: 42 },
  futPos: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  futFlag: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.6)', marginTop: 6 },
  futClub: { fontSize: 9, fontWeight: '700', marginTop: 2, maxWidth: 64, textAlign: 'center' },
  futPhotoWrap: { flex: 1, alignItems: 'center' },
  futPhoto: { width: 110, height: 110, borderRadius: 14 },
  futName: { fontSize: 22, fontWeight: '900', textAlign: 'center', marginTop: 12, letterSpacing: 0.3 },
  futStats: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },

  statPill: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.45)', letterSpacing: 0.8, marginTop: 2 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14, justifyContent: 'center' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  metaChipText: { fontSize: 11, fontWeight: '700' },

  actions: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  followBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 13, borderRadius: 24, borderWidth: 1.5 },
  followText: { fontWeight: '900', fontSize: 14 },
  claimBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 24, borderWidth: 1 },
  claimText: { fontWeight: '800', fontSize: 13 },

  sectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4, marginBottom: 10, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 8 },
  crest: { width: 34, height: 34, borderRadius: 8 },
  rowTitle: { fontSize: 14, fontWeight: '800' },
  rowSub: { fontSize: 11, marginTop: 2 },
  nowBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  nowText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },

  tableHead: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1 },
  th: { flex: 1, fontSize: 10, fontWeight: '800', letterSpacing: 0.4, textAlign: 'center' },
  tr: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center' },
  td: { flex: 1, fontSize: 12, fontWeight: '700', textAlign: 'center' },

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  ratingNum: { fontSize: 22, fontWeight: '900', width: 44, textAlign: 'center' },
});

export default PlayerProfileModal;
