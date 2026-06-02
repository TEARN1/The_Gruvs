/**
 * ClubScreen — full club profile + roster management.
 *
 * Tabs:
 *   Overview   — club info, stats, recent events
 *   Roster     — active players/staff with roles
 *   Awards     — trophies won by the club
 *   History    — past events/seasons
 *
 * Accessible to anyone (read-only). Club owner sees edit + management controls.
 *
 * Usage (in navigation):
 *   navigation.navigate('Club', { clubId })
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, Alert, KeyboardAvoidingView,
  Platform, RefreshControl,
} from 'react-native';
import { SmartImage } from '../components/SmartImage';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { ClubManager, MembershipManager, AwardManager } from '../services/clubEngine';
import { NotificationService } from '../services/notificationService';
import { supabase } from '../services/supabase';
import { ErrorBoundary } from '../components/ErrorBoundary';

const ROLES = ['player','captain','vice_captain','coach','manager','assistant_coach','physio','analyst','admin','performer','speaker','member'];
const ROLE_ICONS = { player:'user', captain:'star', vice_captain:'star', coach:'briefcase', manager:'briefcase', admin:'shield', performer:'mic', speaker:'mic', member:'user' };

export const ClubScreen = ({ route, navigation, clubId: propClubId, onClose }) => {
  const clubId = propClubId || route?.params?.clubId;
  const { user } = useAuth();
  const { colors } = useTheme();
  const primary   = colors?.primary   || "#00f2ff";
  const bg        = colors?.background|| "#0d1112";
  const textColor = colors?.text      || '#fff';
  const muted     = colors?.muted     || 'rgba(255,255,255,0.5)';
  const surface   = colors?.surface   || "#1a1f21";

  const [club, setClub]         = useState(null);
  const [roster, setRoster]     = useState([]);
  const [awards, setAwards]     = useState([]);
  const [history, setHistory]   = useState([]);
  const [myMembership, setMyMembership] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab]           = useState('overview');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const isOwner = club?.owner_id === user?.id;

  const load = useCallback(async () => {
    if (!clubId) return;
    const [c, r, a, h, m] = await Promise.all([
      ClubManager.getById(clubId),
      MembershipManager.getRoster(clubId),
      AwardManager.listForUser(null).then(() => supabase.from('event_awards').select('*, events(title, event_date)').eq('recipient_club_id', clubId).eq('is_published', true).order('created_at', { ascending: false }).then(({ data }) => data || [])),
      ClubManager.getEventHistory(clubId),
      user ? MembershipManager.isMember(clubId, user.id) : null,
    ]);
    setClub(c);
    setRoster(r);
    setAwards(a);
    setHistory(h);
    setMyMembership(m);
    setLoading(false);
    setRefreshing(false);
  }, [clubId, user?.id]);

  useEffect(() => { load(); }, [load]);

  const searchUsers = async (q) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .ilike('username', `%${q}%`)
      .limit(10);
    setSearchResults(data || []);
    setSearching(false);
  };

  const handleInvite = async (inviteeId) => {
    try {
      await MembershipManager.invite(clubId, user.id, inviteeId, 'player');
      // Send in-app notification
      await NotificationService.send(inviteeId, {
        type: 'follow',
        title: `${club.name} invited you to join`,
        body: 'Tap to view and accept the invitation',
        eventId: null,
        actorId: user?.id,
      });
      Alert.alert('Invitation sent!');
      setInviteOpen(false);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const handleRemoveMember = (membership) => {
    Alert.alert('Remove member', `Remove ${membership.profiles?.username || 'this member'} from the club?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await MembershipManager.remove(membership.id); load(); } },
    ]);
  };

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={primary} />
    </View>
  );

  if (!club) return (
    <View style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: muted }}>Club not found</Text>
    </View>
  );

  const TABS = [
    { key: 'overview', label: 'Overview', icon: 'home' },
    { key: 'roster',   label: `Roster (${roster.length})`, icon: 'users' },
    { key: 'awards',   label: `Awards (${awards.length})`, icon: 'award' },
    { key: 'history',  label: 'History',  icon: 'clock' },
  ];

  return (
    <ErrorBoundary label="Club">
      <View style={{ flex: 1, backgroundColor: bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={primary} />}
      >
        {/* Banner */}
        <View style={s.banner}>
          {club.banner_url
            ? <SmartImage source={club.banner_url} style={StyleSheet.absoluteFill} resizeMode="cover" />
            : <View style={[StyleSheet.absoluteFill, { backgroundColor: `${primary}20` }]} />
          }
          <View style={s.bannerOverlay} />

          {/* Back */}
          <TouchableOpacity style={s.backBtn} onPress={() => onClose ? onClose() : navigation?.goBack()}>
            <Feather name="chevron-left" size={24} color="#fff" />
          </TouchableOpacity>

          {/* Logo + name */}
          <View style={s.clubHeader}>
            {club.logo_url
              ? <SmartImage source={club.logo_url} style={s.logo} />
              : (
                <View style={[s.logo, { backgroundColor: `${primary}30`, alignItems: 'center', justifyContent: 'center' }]}>
                  <Feather name="shield" size={32} color={primary} />
                </View>
              )
            }
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={s.clubName}>{club.name}</Text>
                {club.is_verified && <Feather name="check-circle" size={16} color={primary} />}
              </View>
              {club.short_name && <Text style={[s.clubShort, { color: primary }]}>{club.short_name}</Text>}
              <Text style={s.clubMeta}>{[club.sport_type, club.city, club.founded_year ? `Est. ${club.founded_year}` : null].filter(Boolean).join(' · ')}</Text>
            </View>
          </View>

          {/* Stats row */}
          <View style={s.statsRow}>
            {[
              { label: 'Members', value: club.members_count || 0 },
              { label: 'Events',  value: club.events_count || 0 },
              { label: 'Trophies', value: club.trophies_count || 0 },
            ].map(stat => (
              <View key={stat.label} style={s.statCell}>
                <Text style={[s.statValue, { color: primary }]}>{stat.value}</Text>
                <Text style={s.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Action buttons */}
        <View style={[s.actionRow, { borderBottomColor: `${primary}15` }]}>
          {isOwner && (
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: primary }]} onPress={() => setInviteOpen(true)}>
              <Feather name="user-plus" size={14} color="#000" />
              <Text style={[s.actionBtnText, { color: '#000' }]}>Invite Player</Text>
            </TouchableOpacity>
          )}
          {isOwner && (
            <TouchableOpacity style={[s.actionBtn, { borderColor: `${primary}40`, borderWidth: 1 }]} onPress={() => setEditOpen(true)}>
              <Feather name="edit-2" size={14} color={primary} />
              <Text style={[s.actionBtnText, { color: primary }]}>Edit Club</Text>
            </TouchableOpacity>
          )}
          {!isOwner && !myMembership && (
            <View style={[s.actionBtn, { borderColor: `${primary}30`, borderWidth: 1 }]}>
              <Feather name="info" size={14} color={muted} />
              <Text style={[s.actionBtnText, { color: muted }]}>Request membership from club admin</Text>
            </View>
          )}
          {myMembership && (
            <View style={[s.actionBtn, { backgroundColor: `${primary}15`, borderColor: `${primary}30`, borderWidth: 1 }]}>
              <Feather name="check" size={14} color={primary} />
              <Text style={[s.actionBtnText, { color: primary }]}>{myMembership.role}</Text>
            </View>
          )}
        </View>

        {/* Tab bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, paddingHorizontal: 16, paddingVertical: 12 }}>
          {TABS.map(t => {
            const active = tab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[s.tabChip, { backgroundColor: active ? primary : `${primary}12`, borderColor: active ? primary : `${primary}25` }]}
                onPress={() => setTab(t.key)}
              >
                <Feather name={t.icon} size={12} color={active ? '#000' : primary} />
                <Text style={[s.tabChipText, { color: active ? '#000' : primary }]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={{ paddingHorizontal: 16, paddingBottom: 40 }}>

          {/* ── Overview ─────────────────────────────────────────── */}
          {tab === 'overview' && (
            <View style={{ gap: 16 }}>
              {club.bio && <Text style={[s.bio, { color: textColor }]}>{club.bio}</Text>}
              {club.home_ground && (
                <View style={s.infoRow}>
                  <Feather name="map-pin" size={14} color={primary} />
                  <Text style={[s.infoText, { color: muted }]}>{club.home_ground}</Text>
                </View>
              )}
              {club.contact_email && (
                <View style={s.infoRow}>
                  <Feather name="mail" size={14} color={primary} />
                  <Text style={[s.infoText, { color: muted }]}>{club.contact_email}</Text>
                </View>
              )}
              {/* Recent events */}
              {history.slice(0, 3).map(t => (
                <View key={t.id} style={[s.historyCard, { backgroundColor: surface, borderColor: `${primary}20` }]}>
                  <Text style={[s.historyTitle, { color: textColor }]}>{t.events?.title || t.name}</Text>
                  {t.events?.event_date && (
                    <Text style={[s.historyMeta, { color: muted }]}>
                      {new Date(t.events.event_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  )}
                  <View style={s.resultRow}>
                    <Text style={{ color: primary, fontSize: 13, fontWeight: '800' }}>{t.won || 0}W</Text>
                    <Text style={{ color: muted, fontSize: 13 }}> / {t.drawn || 0}D / {t.lost || 0}L</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── Roster ───────────────────────────────────────────── */}
          {tab === 'roster' && (
            <View style={{ gap: 10 }}>
              {roster.length === 0 && (
                <View style={s.empty}>
                  <Feather name="users" size={32} color={muted} />
                  <Text style={[s.emptyText, { color: muted }]}>No members yet</Text>
                </View>
              )}
              {roster.map(m => (
                <View key={m.id} style={[s.memberCard, { backgroundColor: surface, borderColor: `${primary}20` }]}>
                  {m.profiles?.avatar_url
                    ? <SmartImage source={m.profiles.avatar_url} style={s.memberAvatar} />
                    : <View style={[s.memberAvatar, { backgroundColor: `${primary}20`, alignItems: 'center', justifyContent: 'center' }]}><Feather name="user" size={18} color={primary} /></View>
                  }
                  <View style={{ flex: 1 }}>
                    <Text style={[s.memberName, { color: textColor }]}>
                      {m.profiles?.display_name || m.profiles?.username || m.display_name}
                      {m.jersey_number ? <Text style={{ color: primary }}> #{m.jersey_number}</Text> : null}
                    </Text>
                    <Text style={[s.memberRole, { color: primary }]}>{m.role}{m.position ? ` · ${m.position}` : ''}</Text>
                    {m.season && <Text style={[s.memberSeason, { color: muted }]}>{m.season}</Text>}
                  </View>
                  {isOwner && (
                    <TouchableOpacity onPress={() => handleRemoveMember(m)} style={{ padding: 6 }}>
                      <Feather name="x" size={16} color={muted} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* ── Awards ───────────────────────────────────────────── */}
          {tab === 'awards' && (
            <View style={{ gap: 10 }}>
              {awards.length === 0 && (
                <View style={s.empty}>
                  <Text style={{ fontSize: 40 }}>🏆</Text>
                  <Text style={[s.emptyText, { color: muted }]}>No awards yet</Text>
                </View>
              )}
              {awards.map(a => (
                <View key={a.id} style={[s.awardCard, { backgroundColor: surface, borderColor: `${primary}30` }]}>
                  <Text style={s.awardIcon}>{a.award_icon || '🏆'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.awardLabel, { color: textColor }]}>{a.award_label}</Text>
                    <Text style={[s.awardEvent, { color: primary }]}>{a.events?.title}</Text>
                    {a.events?.event_date && (
                      <Text style={[s.awardDate, { color: muted }]}>
                        {new Date(a.events.event_date).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })}
                      </Text>
                    )}
                    {a.stat_value != null && (
                      <Text style={[s.awardStat, { color: primary }]}>{a.stat_value} {a.stat_label}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── History ──────────────────────────────────────────── */}
          {tab === 'history' && (
            <View style={{ gap: 10 }}>
              {history.length === 0 && (
                <View style={s.empty}>
                  <Feather name="clock" size={32} color={muted} />
                  <Text style={[s.emptyText, { color: muted }]}>No event history yet</Text>
                </View>
              )}
              {history.map(t => (
                <View key={t.id} style={[s.historyCard, { backgroundColor: surface, borderColor: `${primary}20` }]}>
                  <Text style={[s.historyTitle, { color: textColor }]}>{t.events?.title || t.name}</Text>
                  {t.events?.event_date && (
                    <Text style={[s.historyMeta, { color: muted }]}>
                      {new Date(t.events.event_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  )}
                  <View style={s.resultRow}>
                    <Text style={{ color: "#10b981", fontSize: 13, fontWeight: '800' }}>{t.won || 0}W</Text>
                    <Text style={{ color: muted, fontSize: 13 }}> / {t.drawn || 0}D / </Text>
                    <Text style={{ color: "#ef4444", fontSize: 13, fontWeight: '800' }}>{t.lost || 0}L</Text>
                    <Text style={{ color: primary, fontSize: 13, fontWeight: '900', marginLeft: 8 }}>{t.points || 0} pts</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Invite Player Modal ─────────────────────────────────── */}
      <Modal visible={inviteOpen} transparent animationType="slide" onRequestClose={() => setInviteOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setInviteOpen(false)} />
          <View style={[s.sheet, { backgroundColor: bg }]}>
            <Text style={[s.sheetTitle, { color: textColor }]}>Invite a Player</Text>
            <View style={[s.searchBox, { backgroundColor: surface, borderColor: `${primary}25` }]}>
              <Feather name="search" size={14} color={muted} />
              <TextInput
                style={[s.searchInput, { color: textColor }]}
                placeholder="Search by username..."
                placeholderTextColor={muted}
                value={searchQuery}
                onChangeText={q => { setSearchQuery(q); searchUsers(q); }}
                autoFocus
              />
              {searching && <ActivityIndicator size="small" color={primary} />}
            </View>
            {searchResults.map(u => (
              <TouchableOpacity
                key={u.id}
                style={[s.searchResult, { borderColor: `${primary}15` }]}
                onPress={() => handleInvite(u.id)}
              >
                {u.avatar_url
                  ? <SmartImage source={u.avatar_url} style={s.resultAvatar} />
                  : <View style={[s.resultAvatar, { backgroundColor: `${primary}20`, alignItems: 'center', justifyContent: 'center' }]}><Feather name="user" size={16} color={primary} /></View>
                }
                <View>
                  <Text style={[s.resultName, { color: textColor }]}>{u.display_name || u.username}</Text>
                  <Text style={[s.resultUsername, { color: muted }]}>@{u.username}</Text>
                </View>
                <Feather name="user-plus" size={16} color={primary} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            ))}
          </View>
        </KeyboardAvoidingView>
      </Modal>
      </View>
    </ErrorBoundary>
  );
};

const s = StyleSheet.create({
  banner:         { height: 220, justifyContent: 'flex-end' },
  bannerOverlay:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  backBtn:        { position: 'absolute', top: 48, left: 16, padding: 8, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20 },
  clubHeader:     { flexDirection: 'row', alignItems: 'flex-end', gap: 12, padding: 16 },
  logo:           { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  clubName:       { fontSize: 20, fontWeight: '900', color: '#fff' },
  clubShort:      { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  clubMeta:       { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  statsRow:       { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.4)', paddingVertical: 10 },
  statCell:       { flex: 1, alignItems: 'center' },
  statValue:      { fontSize: 18, fontWeight: '900' },
  statLabel:      { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  actionRow:      { flexDirection: 'row', gap: 10, padding: 16, borderBottomWidth: 1 },
  actionBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  actionBtnText:  { fontSize: 13, fontWeight: '800' },
  tabChip:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  tabChipText:    { fontSize: 12, fontWeight: '800' },
  bio:            { fontSize: 14, lineHeight: 21 },
  infoRow:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText:       { fontSize: 13 },
  memberCard:     { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 12 },
  memberAvatar:   { width: 44, height: 44, borderRadius: 22 },
  memberName:     { fontSize: 14, fontWeight: '800' },
  memberRole:     { fontSize: 12, fontWeight: '700', marginTop: 1 },
  memberSeason:   { fontSize: 10, marginTop: 1 },
  awardCard:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  awardIcon:      { fontSize: 30 },
  awardLabel:     { fontSize: 15, fontWeight: '900' },
  awardEvent:     { fontSize: 12, fontWeight: '700', marginTop: 2 },
  awardDate:      { fontSize: 11, marginTop: 1 },
  awardStat:      { fontSize: 13, fontWeight: '900', marginTop: 4 },
  historyCard:    { borderRadius: 14, borderWidth: 1, padding: 14, gap: 4 },
  historyTitle:   { fontSize: 14, fontWeight: '800' },
  historyMeta:    { fontSize: 12 },
  resultRow:      { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  empty:          { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText:      { fontSize: 13 },
  sheet:          { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, gap: 12, maxHeight: '75%' },
  sheetTitle:     { fontSize: 17, fontWeight: '900' },
  searchBox:      { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput:    { flex: 1, fontSize: 14 },
  searchResult:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
  resultAvatar:   { width: 38, height: 38, borderRadius: 19 },
  resultName:     { fontSize: 14, fontWeight: '700' },
  resultUsername: { fontSize: 12 },
});
