/**
 * TournamentGovernancePanel — teams elect the officials who control a
 * tournament's data (results editor, log keeper, fixtures, disciplinary, head
 * organiser). You vote with a team you own; when ≥ threshold distinct teams back
 * a candidate, they're granted the role. Stand for a position, or back another.
 *
 * Backed by TournamentEngine + 30_tournament_governance.sql.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, Image, ActivityIndicator, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';
import { GlassView } from './GlassView';
import { LiquidBackground } from './LiquidBackground';
import { ClubCreateModal } from './ClubCreateModal';
import { haptics } from '../utils/haptics';
import { TournamentEngine, TOURNAMENT_ROLES } from '../services/tournamentEngine';

export const TournamentGovernancePanel = ({ visible, competitionId, onClose }) => {
  const { currentTheme } = useTheme();
  const { user, profile } = useAuth();
  const toast = useToast();

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface    || '#1a1f21';

  const [comp, setComp]         = useState(null);
  const [officials, setOfficials] = useState({});  // role -> official
  const [standings, setStandings] = useState({});  // role -> [{candidate, votes}]
  const [myVotes, setMyVotes]   = useState({});    // role -> candidate_id
  const [myTeams, setMyTeams]   = useState([]);
  const [teamId, setTeamId]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [clubModalOpen, setClubModalOpen] = useState(false);

  const threshold = comp?.vote_threshold || 5;

  const load = useCallback(async () => {
    if (!competitionId) return;
    setLoading(true);
    try {
      const [c, offs, teams] = await Promise.all([
        TournamentEngine.getCompetition(competitionId),
        TournamentEngine.getOfficials(competitionId),
        TournamentEngine.getMyTeams(user?.id),
      ]);
      setComp(c);
      setOfficials(Object.fromEntries((offs || []).map(o => [o.role, o])));
      setMyTeams(teams || []);
      const club = teams?.[0]?.id || null;
      setTeamId(prev => prev || club);

      const stMap = {}; const voteMap = {};
      await Promise.all(TOURNAMENT_ROLES.map(async (r) => {
        stMap[r.key] = await TournamentEngine.getRoleStandings(competitionId, r.key);
        if (club) voteMap[r.key] = await TournamentEngine.getMyVote(competitionId, r.key, teamId || club);
      }));
      setStandings(stMap); setMyVotes(voteMap);
    } finally {
      setLoading(false);
    }
  }, [competitionId, user?.id]);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  const doVote = async (role, candidateId, candidateName) => {
    if (!user) { toast.show('Sign in to vote', 'info'); return; }
    if (!teamId) { toast.show('You need a team (club) to vote', 'info'); return; }
    haptics.medium();
    const res = await TournamentEngine.castRoleVote({ competitionId, role, candidateId, clubId: teamId });
    if (res.ok) {
      haptics.success();
      toast.show(res.elected ? `${candidateName} elected!` : `Vote cast (${res.leader_votes}/${res.threshold})`, 'success');
      load();
    } else {
      toast.show(res.error?.includes('NOT_TEAM_REP') ? 'Only a team owner can vote' : 'Could not vote', 'error');
    }
  };

  const standForRole = (role) => {
    if (!user) { toast.show('Sign in to stand', 'info'); return; }
    doVote(role, user.id, profile?.username || 'You');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[g.root, { backgroundColor: bg }]}>
        <LiquidBackground intensity={0.8} />

        <View style={g.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={g.headerBtn}>
            <Feather name="x" size={22} color={textColor} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={[g.title, { color: textColor }]} numberOfLines={1}>{comp?.name || 'Tournament'}</Text>
            <Text style={[g.sub, { color: muted }]}>Elect the officials · {threshold} teams to win a seat</Text>
          </View>
          <View style={g.headerBtn} />
        </View>

        {loading ? (
          <View style={g.center}><ActivityIndicator color={primary} size="large" /></View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
            {/* Team selector */}
            {myTeams.length > 0 ? (
              <>
                <Text style={[g.section, { color: muted }]}>VOTE AS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 14 }}>
                  {myTeams.map(t => (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => { haptics.select(); setTeamId(t.id); load(); }}
                      style={[g.teamChip, { backgroundColor: teamId === t.id ? primary : `${primary}12`, borderColor: teamId === t.id ? primary : `${primary}30` }]}
                    >
                      <Text style={{ color: teamId === t.id ? '#000' : primary, fontWeight: '800', fontSize: 12 }}>{t.short_name || t.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : (
              <GlassView sheen={false} style={{ padding: 12, marginBottom: 14 }}>
                <Text style={{ color: muted, fontSize: 12, marginBottom: 10 }}>To vote you need a team. Create your club and you'll get a vote on every position.</Text>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 11, borderRadius: 12, backgroundColor: primary }}
                  onPress={() => { haptics.select(); setClubModalOpen(true); }}
                >
                  <Feather name="plus" size={15} color="#000" />
                  <Text style={{ color: '#000', fontWeight: '900', fontSize: 13 }}>Create your club</Text>
                </TouchableOpacity>
              </GlassView>
            )}

            {/* Roles */}
            {TOURNAMENT_ROLES.map(r => {
              const official = officials[r.key];
              const list = standings[r.key] || [];
              const myVote = myVotes[r.key];
              return (
                <GlassView key={r.key} style={g.roleCard}>
                  <View style={g.roleHead}>
                    <View style={[g.roleIcon, { backgroundColor: `${primary}18` }]}>
                      <Feather name={r.icon} size={16} color={primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[g.roleTitle, { color: textColor }]}>{r.label}</Text>
                      <Text style={[g.roleBlurb, { color: muted }]}>{r.blurb}</Text>
                    </View>
                  </View>

                  {/* Elected holder */}
                  {official?.user ? (
                    <View style={[g.electedBadge, { borderColor: `${primary}40`, backgroundColor: `${primary}12` }]}>
                      <Feather name="check-circle" size={13} color={primary} />
                      <Text style={[g.electedText, { color: primary }]}>@{official.user.username} elected · {official.votes_at_election} teams</Text>
                    </View>
                  ) : (
                    <Text style={[g.vacant, { color: muted }]}>Open seat — needs {threshold} team votes</Text>
                  )}

                  {/* Candidates / standings */}
                  {list.map(c => {
                    const mine = myVote === c.candidate_id;
                    const progress = Math.min(100, Math.round((c.votes / threshold) * 100));
                    return (
                      <TouchableOpacity
                        key={c.candidate_id}
                        activeOpacity={0.85}
                        onPress={() => doVote(r.key, c.candidate_id, c.candidate?.username || 'candidate')}
                        style={[g.candRow, { borderColor: mine ? primary : `${primary}20` }]}
                      >
                        <View style={[g.progress, { width: `${progress}%`, backgroundColor: mine ? `${primary}30` : 'rgba(255,255,255,0.05)' }]} />
                        {c.candidate?.avatar_url
                          ? <Image source={{ uri: c.candidate.avatar_url }} style={g.candAvatar} />
                          : <View style={[g.candAvatar, { backgroundColor: `${primary}25`, alignItems: 'center', justifyContent: 'center' }]}>
                              <Text style={{ color: primary, fontWeight: '900', fontSize: 11 }}>{(c.candidate?.username || '?')[0].toUpperCase()}</Text>
                            </View>}
                        <Text style={[g.candName, { color: textColor }]} numberOfLines={1}>@{c.candidate?.username || 'candidate'}{mine ? ' · your vote' : ''}</Text>
                        <Text style={[g.candVotes, { color: primary }]}>{c.votes}/{threshold}</Text>
                      </TouchableOpacity>
                    );
                  })}

                  {/* Stand for this position */}
                  {user && (
                    <TouchableOpacity style={[g.standBtn, { borderColor: `${primary}40` }]} onPress={() => standForRole(r.key)}>
                      <Feather name="flag" size={13} color={primary} />
                      <Text style={[g.standText, { color: primary }]}>Stand for {r.label}</Text>
                    </TouchableOpacity>
                  )}
                </GlassView>
              );
            })}

            <Text style={{ color: muted, fontSize: 11, textAlign: 'center', marginTop: 14 }}>
              Open ballot for trust — every team's vote is visible. A new candidate who passes {threshold} replaces the holder.
            </Text>
          </ScrollView>
        )}

        <ClubCreateModal
          visible={clubModalOpen}
          onClose={() => setClubModalOpen(false)}
          onCreated={() => { setClubModalOpen(false); load(); }}
        />
      </View>
    </Modal>
  );
};

const g = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 54 : 36, paddingBottom: 10 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '900' },
  sub: { fontSize: 10, fontWeight: '700', marginTop: 1 },
  section: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8 },
  teamChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  roleCard: { padding: 14, marginBottom: 12 },
  roleHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  roleIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  roleTitle: { fontSize: 15, fontWeight: '900' },
  roleBlurb: { fontSize: 11, marginTop: 1 },
  electedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 8 },
  electedText: { fontSize: 12, fontWeight: '800' },
  vacant: { fontSize: 11, fontStyle: 'italic', marginBottom: 8 },
  candRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 12, borderWidth: 1, marginBottom: 6, overflow: 'hidden', position: 'relative' },
  progress: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  candAvatar: { width: 26, height: 26, borderRadius: 13 },
  candName: { flex: 1, fontSize: 13, fontWeight: '700' },
  candVotes: { fontSize: 13, fontWeight: '900' },
  standBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1, marginTop: 4 },
  standText: { fontSize: 12, fontWeight: '800' },
});

export default TournamentGovernancePanel;
