/**
 * SportManagementPanel
 *
 * Full live sport-event control panel for organizers.
 * Shown in the ⚙️ Manage tab of EventDetailScreen when the event
 * category is a sport type (soccer, basketball, rugby, athletics, etc.).
 *
 * Tabs:
 *   Teams     — create/edit teams, add players to roster
 *   Fixtures  — create matches, update live scores
 *   Scoreboard — live league table
 *   Commentary — post live match commentary
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { SPORT_REGISTRY, TeamManager, MatchManager, TableManager, CommentaryManager } from '../services/sportsEngine';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';
import { EventFollowButton } from './EventFollowButton';
import { AwardCeremonyPanel } from './AwardCeremonyPanel';

// ── Helpers ───────────────────────────────────────────────────────────────────

const Row = ({ children, style }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}>
    {children}
  </View>
);

const Pill = ({ label, active, onPress, color }) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18, borderWidth: 1,
      backgroundColor: active ? `${color}22` : 'transparent',
      borderColor: active ? color : `${color}35`,
    }}
  >
    <Text style={{ color: active ? color : `${color}70`, fontSize: 12, fontWeight: '700' }}>{label}</Text>
  </TouchableOpacity>
);

const ActionBtn = ({ icon, label, onPress, color, loading }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={loading}
    style={{
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: `${color}18`, borderRadius: 10, borderWidth: 1,
      borderColor: `${color}35`, paddingHorizontal: 12, paddingVertical: 8,
    }}
  >
    {loading
      ? <ActivityIndicator size="small" color={color} />
      : <Feather name={icon} size={14} color={color} />}
    <Text style={{ color, fontSize: 12, fontWeight: '700' }}>{label}</Text>
  </TouchableOpacity>
);

const Field = ({ label, value, onChangeText, placeholder, color, textColor, numeric }) => (
  <View style={{ marginBottom: 10 }}>
    {label ? <Text style={{ color: `${textColor}70`, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 3 }}>{label.toUpperCase()}</Text> : null}
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={`${textColor}35`}
      keyboardType={numeric ? 'numeric' : 'default'}
      style={{
        backgroundColor: `${color}08`, borderRadius: 8, borderWidth: 1,
        borderColor: `${color}20`, paddingHorizontal: 10, height: 40,
        color: textColor, fontSize: 14,
      }}
    />
  </View>
);

// ── Teams Tab ─────────────────────────────────────────────────────────────────

const TeamsTab = ({ event, sportMeta, primary, textColor, muted }) => {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ name: '', short_name: '', color1: primary, club_id: null });
  const [clubSearchQuery, setClubSearchQuery] = useState('');
  const [clubSearchResults, setClubSearchResults] = useState([]);
  const [searchingClubs, setSearchingClubs] = useState(false);
  const [selectedClub, setSelectedClub] = useState(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try { setTeams(await TeamManager.list(event.id)); } catch { }
    setLoading(false);
  }, [event.id]);

  useEffect(() => { load(); }, [load]);

  const searchClubs = async (q) => {
    setClubSearchQuery(q);
    if (!q.trim()) {
      setClubSearchResults([]);
      return;
    }
    setSearchingClubs(true);
    try {
      const { ClubManager: LocalClubManager } = require('../services/clubEngine');
      const results = await LocalClubManager.search(q, event?.sport_type || event?.category);
      setClubSearchResults(results || []);
    } catch (e) {
      console.warn('Error searching clubs:', e);
    } finally {
      setSearchingClubs(false);
    }
  };

  const handleSelectClub = (club) => {
    setSelectedClub(club);
    setForm(p => ({
      ...p,
      club_id: club.id,
      name: club.name,
      short_name: club.short_name || club.name.slice(0, 3).toUpperCase()
    }));
    setClubSearchQuery('');
    setClubSearchResults([]);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.show('Enter a team name', 'error');
    setLoading(true);
    try {
      const teamData = { ...form };
      if (selectedClub) {
        teamData.club_id = selectedClub.id;
        teamData.logo_url = selectedClub.logo_url || null;
        try {
          const { MembershipManager: LocalMembershipManager } = require('../services/clubEngine');
          const roster = await LocalMembershipManager.getRoster(selectedClub.id);
          if (roster && roster.length > 0) {
            teamData.players = roster.map(m => ({
              id: m.profiles?.id || m.user_id,
              name: m.profiles?.display_name || m.profiles?.username || m.display_name,
              number: m.jersey_number || '',
              position: m.position || '',
              photo_url: m.profiles?.avatar_url || m.photo_url || null,
            }));
          }
        } catch (rosterErr) {
          console.warn('Failed to load roster from club:', rosterErr);
        }
      }

      if (editTarget) {
        await TeamManager.update(editTarget.id, teamData);
        toast.show('Team updated', 'success');
      } else {
        await TeamManager.create(event.id, teamData);
        toast.show('Team added', 'success');
      }
      setAdding(false);
      setSelectedClub(null);
      load();
    } catch (e) { toast.show(e.message || 'Error', 'error'); }
    setLoading(false);
  };

  const handleDelete = (id) => {
    Alert.alert('Remove Team', 'Remove this team from the event?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await TeamManager.delete(id); load(); } },
    ]);
  };

  if (loading) return <ActivityIndicator color={primary} style={{ marginTop: 20 }} />;

  return (
    <View>
      <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ color: textColor, fontWeight: '900', fontSize: 15 }}>
          {sportMeta?.team_sport ? 'Teams' : 'Athletes'} ({teams.length})
        </Text>
        <ActionBtn icon="plus" label="Add" onPress={() => { setForm({ name: '', short_name: '', color1: primary, club_id: null }); setSelectedClub(null); setEditTarget(null); setAdding(true); }} color={primary} />
      </Row>

      {teams.length === 0 && (
        <View style={{ alignItems: 'center', paddingVertical: 28 }}>
          <Text style={{ fontSize: 32 }}>{sportMeta?.icon || '🏆'}</Text>
          <Text style={{ color: muted, marginTop: 8, fontSize: 13 }}>No teams yet — add your first</Text>
        </View>
      )}

      {teams.map(team => (
        <View key={team.id} style={{ borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8, borderColor: `${team.color1 || primary}30`, backgroundColor: `${team.color1 || primary}08` }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: team.color1 || primary }} />
              <Text style={{ color: textColor, fontWeight: '800', fontSize: 14 }}>{team.name}</Text>
              {team.short_name ? <Text style={{ color: muted, fontSize: 12 }}>({team.short_name})</Text> : null}
            </Row>
            <Row>
              <TouchableOpacity onPress={() => { setForm({ name: team.name, short_name: team.short_name || '', color1: team.color1 || primary, club_id: team.club_id || null }); setEditTarget(team); setSelectedClub(team.club_id ? { id: team.club_id, name: team.name } : null); setAdding(true); }} style={{ padding: 5 }}>
                <Feather name="edit-2" size={14} color={muted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(team.id)} style={{ padding: 5 }}>
                <Feather name="trash-2" size={14} color="#ef4444" />
              </TouchableOpacity>
            </Row>
          </Row>
          {Array.isArray(team.players) && team.players.length > 0 && (
            <Text style={{ color: muted, fontSize: 11, marginTop: 4 }}>
              {team.players.length} player{team.players.length !== 1 ? 's' : ''} rostered
            </Text>
          )}
        </View>
      ))}

      <Modal visible={adding} animationType="slide" transparent onRequestClose={() => setAdding(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' }}>
            <View style={{ backgroundColor: "#0d1112", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 }}>
              <Row style={{ justifyContent: 'space-between', marginBottom: 14 }}>
                <Text style={{ color: textColor, fontWeight: '900', fontSize: 16 }}>{editTarget ? 'Edit' : 'Add'} Team</Text>
                <TouchableOpacity onPress={() => setAdding(false)}><Feather name="x" size={20} color={muted} /></TouchableOpacity>
              </Row>
              <Field label="Team Name *" value={form.name} onChangeText={v => setForm(p => ({ ...p, name: v }))} placeholder="Team name" color={primary} textColor={textColor} />
              <Field label="Short Name" value={form.short_name} onChangeText={v => setForm(p => ({ ...p, short_name: v }))} placeholder="e.g. FCB" color={primary} textColor={textColor} />
              
              {/* Search Global Clubs */}
              {sportMeta?.team_sport && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ color: muted, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>LINK TO REGISTERED CLUB (OPTIONAL)</Text>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', borderWidth: 1, borderColor: `${primary}30`, borderRadius: 10, paddingHorizontal: 10, height: 40, backgroundColor: `${primary}05` }}>
                    <Feather name="search" size={14} color={muted} />
                    <TextInput
                      style={{ flex: 1, color: textColor, fontSize: 13 }}
                      placeholder="Search clubs on The Gruvs..."
                      placeholderTextColor={`${textColor}35`}
                      value={clubSearchQuery}
                      onChangeText={searchClubs}
                    />
                    {searchingClubs && <ActivityIndicator size="small" color={primary} />}
                  </View>

                  {clubSearchResults.length > 0 && (
                    <ScrollView style={{ maxHeight: 120, marginTop: 6, borderRadius: 10, borderWidth: 1, borderColor: `${primary}20`, backgroundColor: "#0d1112" }}>
                      {clubSearchResults.map(club => (
                        <TouchableOpacity key={club.id} onPress={() => handleSelectClub(club)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderBottomWidth: 1, borderBottomColor: `${primary}10` }}>
                          {club.logo_url
                            ? <Image source={{ uri: club.logo_url }} style={{ width: 24, height: 24, borderRadius: 12 }} />
                            : <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: `${primary}20`, alignItems: 'center', justifyContent: 'center' }}><Feather name="shield" size={12} color={primary} /></View>
                          }
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: textColor, fontSize: 12, fontWeight: '800' }}>{club.name}</Text>
                            {club.city && <Text style={{ color: muted, fontSize: 10 }}>{club.city}</Text>}
                          </View>
                          {club.is_verified && <Feather name="check-circle" size={12} color={primary} />}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}

                  {selectedClub && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: primary, backgroundColor: `${primary}15` }}>
                      <Feather name="link" size={14} color={primary} />
                      <Text style={{ color: textColor, fontSize: 12, fontWeight: '700', flex: 1 }}>Linked: {selectedClub.name}</Text>
                      <TouchableOpacity onPress={() => setSelectedClub(null)}>
                        <Feather name="x" size={14} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
              
              <TouchableOpacity onPress={handleSave} style={{ backgroundColor: primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 6 }}>
                <Text style={{ color: '#000', fontWeight: '900', fontSize: 15 }}>Save Team</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

// ── Fixtures Tab ──────────────────────────────────────────────────────────────

const FixturesTab = ({ event, sportMeta, primary, textColor, muted }) => {
  const [teams, setTeams] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ home_team_id: '', away_team_id: '', round: 'Round 1', scheduled_at: '' });
  const [scoring, setScoring] = useState(null); // { fixture, homeScore, awayScore }
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, f] = await Promise.all([TeamManager.list(event.id), MatchManager.listFixtures(event.id)]);
      setTeams(t);
      setFixtures(f);
    } catch { }
    setLoading(false);
  }, [event.id]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.home_team_id || !form.away_team_id) return toast.show('Select both teams', 'error');
    if (form.home_team_id === form.away_team_id) return toast.show('Teams must be different', 'error');
    try {
      await MatchManager.create(event.id, { ...form, status: 'scheduled' });
      toast.show('Fixture created', 'success');
      setAdding(false);
      load();
    } catch (e) { toast.show(e.message || 'Error', 'error'); }
  };

  const handleUpdateScore = async () => {
    if (!scoring) return;
    try {
      const { fixture, homeScore, awayScore } = scoring;
      await MatchManager.updateScore(fixture.id, parseInt(homeScore) || 0, parseInt(awayScore) || 0);
      toast.show('Score updated', 'success');
      setScoring(null);
      load();
    } catch (e) { toast.show(e.message || 'Error', 'error'); }
  };

  const teamName = (id) => teams.find(t => t.id === id)?.name || '?';

  const statusColor = (s) => ({ scheduled: muted, live: "#ef4444", completed: "#10b981", postponed: "#f59e0b" }[s] || muted);

  if (loading) return <ActivityIndicator color={primary} style={{ marginTop: 20 }} />;

  return (
    <View>
      <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ color: textColor, fontWeight: '900', fontSize: 15 }}>Fixtures ({fixtures.length})</Text>
        <ActionBtn icon="plus" label="Add Fixture" onPress={() => { setForm({ home_team_id: teams[0]?.id || '', away_team_id: teams[1]?.id || '', round: 'Round 1', scheduled_at: '' }); setAdding(true); }} color={primary} />
      </Row>

      {fixtures.length === 0 && teams.length < 2 && (
        <View style={{ alignItems: 'center', paddingVertical: 28 }}>
          <Text style={{ fontSize: 28 }}>🗓️</Text>
          <Text style={{ color: muted, marginTop: 8, fontSize: 13 }}>Add at least 2 teams first</Text>
        </View>
      )}

      {fixtures.map(fix => {
        const ht = fix.home_team?.name || teamName(fix.home_team_id);
        const at = fix.away_team?.name || teamName(fix.away_team_id);
        return (
          <View key={fix.id} style={{ borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8, borderColor: `${primary}20`, backgroundColor: `${primary}06` }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: textColor, fontWeight: '800', fontSize: 14 }}>
                  {ht} {fix.home_score ?? '–'} : {fix.away_score ?? '–'} {at}
                </Text>
                <Row style={{ marginTop: 4, gap: 8 }}>
                  <Text style={{ color: statusColor(fix.status), fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>{fix.status}</Text>
                  {fix.round ? <Text style={{ color: muted, fontSize: 11 }}>{fix.round}</Text> : null}
                </Row>
              </View>
              <TouchableOpacity
                onPress={() => setScoring({ fixture: fix, homeScore: String(fix.home_score ?? 0), awayScore: String(fix.away_score ?? 0) })}
                style={{ padding: 6 }}
              >
                <Feather name="edit" size={15} color={primary} />
              </TouchableOpacity>
            </Row>
          </View>
        );
      })}

      {/* Add Fixture Modal */}
      <Modal visible={adding} animationType="slide" transparent onRequestClose={() => setAdding(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' }}>
            <View style={{ backgroundColor: "#0d1112", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 }}>
              <Row style={{ justifyContent: 'space-between', marginBottom: 14 }}>
                <Text style={{ color: textColor, fontWeight: '900', fontSize: 16 }}>Add Fixture</Text>
                <TouchableOpacity onPress={() => setAdding(false)}><Feather name="x" size={20} color={muted} /></TouchableOpacity>
              </Row>
              <Text style={{ color: `${textColor}70`, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 }}>HOME TEAM</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                <Row style={{ gap: 6 }}>
                  {teams.map(t => (
                    <Pill key={t.id} label={t.name} active={form.home_team_id === t.id} onPress={() => setForm(p => ({ ...p, home_team_id: t.id }))} color={primary} />
                  ))}
                </Row>
              </ScrollView>
              <Text style={{ color: `${textColor}70`, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 }}>AWAY TEAM</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                <Row style={{ gap: 6 }}>
                  {teams.map(t => (
                    <Pill key={t.id} label={t.name} active={form.away_team_id === t.id} onPress={() => setForm(p => ({ ...p, away_team_id: t.id }))} color={primary} />
                  ))}
                </Row>
              </ScrollView>
              <Field label="Round" value={form.round} onChangeText={v => setForm(p => ({ ...p, round: v }))} placeholder="Round 1 / Group A" color={primary} textColor={textColor} />
              <TouchableOpacity onPress={handleCreate} style={{ backgroundColor: primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 4 }}>
                <Text style={{ color: '#000', fontWeight: '900', fontSize: 15 }}>Create Fixture</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Score update Modal */}
      {scoring && (
        <Modal visible animationType="fade" transparent onRequestClose={() => setScoring(null)}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', padding: 24 }}>
            <View style={{ backgroundColor: "#0d1112", borderRadius: 20, padding: 24, width: '100%' }}>
              <Text style={{ color: textColor, fontWeight: '900', fontSize: 16, marginBottom: 16, textAlign: 'center' }}>Update Score</Text>
              <Row style={{ justifyContent: 'center', gap: 20, marginBottom: 20 }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: muted, fontSize: 11, marginBottom: 4 }}>{scoring.fixture.home_team?.name || 'Home'}</Text>
                  <TextInput
                    value={scoring.homeScore}
                    onChangeText={v => setScoring(p => ({ ...p, homeScore: v }))}
                    keyboardType="numeric"
                    style={{ color: textColor, fontSize: 32, fontWeight: '900', textAlign: 'center', backgroundColor: `${primary}12`, borderRadius: 12, width: 70, paddingVertical: 8 }}
                  />
                </View>
                <Text style={{ color: muted, fontSize: 24, fontWeight: '900', alignSelf: 'center' }}>:</Text>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: muted, fontSize: 11, marginBottom: 4 }}>{scoring.fixture.away_team?.name || 'Away'}</Text>
                  <TextInput
                    value={scoring.awayScore}
                    onChangeText={v => setScoring(p => ({ ...p, awayScore: v }))}
                    keyboardType="numeric"
                    style={{ color: textColor, fontSize: 32, fontWeight: '900', textAlign: 'center', backgroundColor: `${primary}12`, borderRadius: 12, width: 70, paddingVertical: 8 }}
                  />
                </View>
              </Row>
              <Row style={{ justifyContent: 'center', gap: 10 }}>
                <TouchableOpacity onPress={() => setScoring(null)} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: `${primary}30`, alignItems: 'center' }}>
                  <Text style={{ color: muted, fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleUpdateScore} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: primary, alignItems: 'center' }}>
                  <Text style={{ color: '#000', fontWeight: '900' }}>Save Score</Text>
                </TouchableOpacity>
              </Row>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

// ── Scoreboard Tab ────────────────────────────────────────────────────────────

const ScoreboardTab = ({ event, sportMeta, primary, textColor, muted }) => {
  const [table, setTable] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try { setTable(await TableManager.get(event.id)); } catch { }
    setLoading(false);
  }, [event.id]);

  useEffect(() => { load(); }, [load]);

  const handleRecalc = async () => {
    try {
      await TableManager.recompute(event.id);
      toast.show('Table recalculated', 'success');
      load();
    } catch (e) { toast.show(e.message || 'Error', 'error'); }
  };

  const cols = sportMeta?.table_columns || ['P', 'W', 'L', 'Pts'];

  if (loading) return <ActivityIndicator color={primary} style={{ marginTop: 20 }} />;

  return (
    <View>
      <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ color: textColor, fontWeight: '900', fontSize: 15 }}>League Table</Text>
        <ActionBtn icon="refresh-cw" label="Recalc" onPress={handleRecalc} color={primary} />
      </Row>

      {/* Header */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 8, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: `${primary}20`, marginBottom: 4 }}>
        <Text style={{ color: muted, fontSize: 11, fontWeight: '700', flex: 1 }}>#  Team</Text>
        {cols.map(c => (
          <Text key={c} style={{ color: muted, fontSize: 11, fontWeight: '700', width: 28, textAlign: 'center' }}>{c}</Text>
        ))}
      </View>

      {table.length === 0 && (
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Text style={{ color: muted, fontSize: 13 }}>No table data yet</Text>
        </View>
      )}

      {table.map((row, i) => (
        <View key={row.team_id || i} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: `${primary}10` }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: i < 3 ? primary : muted, fontWeight: '900', fontSize: 13, width: 20 }}>{i + 1}</Text>
            <Text style={{ color: textColor, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>{row.team_name || row.sport_teams?.name || '—'}</Text>
          </View>
          {cols.map(c => {
            const key = c.toLowerCase();
            const val = row[key] ?? row[`stat_${key}`] ?? '—';
            return (
              <Text key={c} style={{ color: c === 'Pts' ? primary : textColor, fontSize: 13, fontWeight: c === 'Pts' ? '900' : '400', width: 28, textAlign: 'center' }}>
                {val}
              </Text>
            );
          })}
        </View>
      ))}
    </View>
  );
};

// ── Commentary Tab ────────────────────────────────────────────────────────────

const CommentaryTab = ({ event, primary, textColor, muted }) => {
  const [fixtures, setFixtures] = useState([]);
  const [activeFixtureId, setActiveFixtureId] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [minute, setMinute] = useState('');
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const toast = useToast();

  useEffect(() => {
    MatchManager.listFixtures(event.id)
      .then(f => { setFixtures(f); if (f.length) setActiveFixtureId(f[0].id); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [event.id]);

  const loadComments = useCallback(async () => {
    if (!activeFixtureId) return;
    try { setComments(await CommentaryManager.list(activeFixtureId)); } catch { }
  }, [activeFixtureId]);

  useEffect(() => { loadComments(); }, [loadComments]);

  const handlePost = async () => {
    if (!text.trim() || !activeFixtureId || !user?.id) return;
    setPosting(true);
    try {
      await CommentaryManager.post(
        activeFixtureId,
        event.id,
        user.id,
        {
          text: text.trim(),
          minute: parseInt(minute) || null,
          event_type: 'comment',
        }
      );
      setText('');
      setMinute('');
      loadComments();
    } catch (e) { toast.show(e.message || 'Error', 'error'); }
    setPosting(false);
  };

  if (loading) return <ActivityIndicator color={primary} style={{ marginTop: 20 }} />;
  if (!fixtures.length) return (
    <View style={{ alignItems: 'center', paddingVertical: 28 }}>
      <Text style={{ fontSize: 28 }}>💬</Text>
      <Text style={{ color: muted, marginTop: 8, fontSize: 13 }}>Add fixtures first to post commentary</Text>
    </View>
  );

  const activeFixture = fixtures.find(f => f.id === activeFixtureId);

  return (
    <View>
      {/* Fixture selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <Row style={{ gap: 6 }}>
          {fixtures.map(f => {
            const label = `${f.home_team?.name || '?'} vs ${f.away_team?.name || '?'}`;
            return (
              <Pill key={f.id} label={label} active={activeFixtureId === f.id} onPress={() => setActiveFixtureId(f.id)} color={primary} />
            );
          })}
        </Row>
      </ScrollView>

      {/* Post bar */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14, alignItems: 'flex-end' }}>
        <TextInput
          value={minute}
          onChangeText={setMinute}
          placeholder="Min"
          keyboardType="numeric"
          style={{ width: 52, backgroundColor: `${primary}08`, borderRadius: 8, borderWidth: 1, borderColor: `${primary}20`, color: textColor, paddingHorizontal: 8, height: 38, textAlign: 'center' }}
          placeholderTextColor={`${textColor}35`}
        />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={`Commentary for ${activeFixture?.home_team?.name || 'match'}…`}
          placeholderTextColor={`${textColor}35`}
          style={{ flex: 1, backgroundColor: `${primary}08`, borderRadius: 8, borderWidth: 1, borderColor: `${primary}20`, color: textColor, paddingHorizontal: 10, height: 38 }}
        />
        <TouchableOpacity
          onPress={handlePost}
          disabled={posting || !text.trim()}
          style={{ backgroundColor: primary, borderRadius: 8, paddingHorizontal: 12, height: 38, justifyContent: 'center', opacity: (!text.trim() || posting) ? 0.4 : 1 }}
        >
          {posting ? <ActivityIndicator size="small" color="#000" /> : <Feather name="send" size={16} color="#000" />}
        </TouchableOpacity>
      </View>

      {comments.map(c => (
        <View key={c.id} style={{ flexDirection: 'row', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: `${primary}10` }}>
          {c.minute != null && (
            <View style={{ backgroundColor: `${primary}20`, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, alignSelf: 'flex-start' }}>
              <Text style={{ color: primary, fontSize: 11, fontWeight: '900' }}>{c.minute}'</Text>
            </View>
          )}
          <Text style={{ color: textColor, fontSize: 13, flex: 1 }}>{c.text || c.body}</Text>
        </View>
      ))}
    </View>
  );
};

// ── SPORT CATEGORY MAP ────────────────────────────────────────────────────────

const SPORT_CATEGORIES = new Set([
  'sport','football','soccer','basketball','rugby','cricket','tennis','boxing','mma',
  'athletics','swimming','cycling','golf','volleyball','netball','hockey','baseball',
  'softball','tabletennis','badminton','squash','handball','polo','equestrian',
  'archery','judo','karate','taekwondo','kungfu','muaythai','bjj','capoeira',
  'kickboxing','fencing','rowing','kayaking','marathon','triathlon','crossfit',
  'weightlifting','powerlifting','gymnastics','parkour','skateboarding','surfing',
  'snowboarding','skiing','icehockey','esports_sport','sportsday','charity_run','fun_run',
]);

export const isSportCategory = (category) => SPORT_CATEGORIES.has(category?.toLowerCase());

// ── Main SportManagementPanel ─────────────────────────────────────────────────

export const SportManagementPanel = ({ event, primary, textColor, muted }) => {
  const sportType = event?.sport_type || event?.category?.toLowerCase() || 'soccer';
  const sportMeta = SPORT_REGISTRY[sportType] || SPORT_REGISTRY.other || { icon: '🏆', name: 'Sport', team_sport: true };
  const [tab, setTab] = useState('teams');

  if (!event?.id) return null;

  const TABS = [
    { key: 'teams',      label: sportMeta.team_sport ? 'Teams' : 'Athletes', icon: 'users' },
    { key: 'fixtures',   label: 'Fixtures',   icon: 'calendar' },
    { key: 'scoreboard', label: 'Table',       icon: 'bar-chart-2' },
    { key: 'commentary', label: 'Live',        icon: 'radio' },
    { key: 'awards',     label: 'Awards',      icon: 'award' },
    { key: 'media',      label: 'Media',       icon: 'image' },
  ];

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
      {/* Sport badge + follow button */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Text style={{ fontSize: 22 }}>{sportMeta.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>SPORT MANAGEMENT</Text>
          <Text style={{ color: textColor, fontSize: 15, fontWeight: '900' }}>{sportMeta.name}</Text>
        </View>
        <EventFollowButton eventId={event.id} isSport />
      </View>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
        <Row style={{ gap: 8 }}>
          {TABS.map(t => {
            const active = tab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => setTab(t.key)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, borderWidth: 1,
                  backgroundColor: active ? `${primary}20` : 'transparent',
                  borderColor: active ? primary : `${primary}30`,
                }}
              >
                <Feather name={t.icon} size={12} color={active ? primary : `${primary}60`} />
                <Text style={{ color: active ? primary : `${primary}60`, fontWeight: '700', fontSize: 12 }}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </Row>
      </ScrollView>

      {tab === 'teams'      && <TeamsTab      event={event} sportMeta={sportMeta} primary={primary} textColor={textColor} muted={muted} />}
      {tab === 'fixtures'   && <FixturesTab   event={event} sportMeta={sportMeta} primary={primary} textColor={textColor} muted={muted} />}
      {tab === 'scoreboard' && <ScoreboardTab event={event} sportMeta={sportMeta} primary={primary} textColor={textColor} muted={muted} />}
      {tab === 'commentary' && <CommentaryTab event={event} primary={primary} textColor={textColor} muted={muted} />}
      {tab === 'awards'     && <AwardCeremonyPanel event={event} />}
      {tab === 'media'      && <MediaTab      event={event} primary={primary} textColor={textColor} muted={muted} />}
    </View>
  );
};

// ── Media Tab ─────────────────────────────────────────────────────────────────
const MediaTab = ({ event, primary, textColor, muted }) => {
  const { user } = useAuth();
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liking, setLiking] = useState({});
  const [likedSet, setLikedSet] = useState(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('sport_media')
        .select('id, media_url, media_type, caption, minute, likes_count, uploader_id, profiles(username, avatar_url)')
        .eq('event_id', event.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(40);
      setMedia(data || []);

      if (user) {
        const { data: liked } = await supabase
          .from('sport_media_likes')
          .select('media_id')
          .eq('user_id', user?.id)
          .in('media_id', (data || []).map(m => m.id));
        setLikedSet(new Set((liked || []).map(l => l.media_id)));
      }
    } finally {
      setLoading(false);
    }
  }, [event.id, user?.id]);

  useEffect(() => { load(); }, [load]);

  const toggleLike = async (mediaId) => {
    if (!user) return;
    setLiking(l => ({ ...l, [mediaId]: true }));
    const isLiked = likedSet.has(mediaId);
    try {
      if (isLiked) {
        await supabase.from('sport_media_likes').delete()
          .eq('media_id', mediaId).eq('user_id', user?.id);
        setLikedSet(s => { const n = new Set(s); n.delete(mediaId); return n; });
        setMedia(m => m.map(x => x.id === mediaId ? { ...x, likes_count: Math.max(0, (x.likes_count || 1) - 1) } : x));
      } else {
        await supabase.from('sport_media_likes').insert({ media_id: mediaId, user_id: user?.id });
        setLikedSet(s => new Set([...s, mediaId]));
        setMedia(m => m.map(x => x.id === mediaId ? { ...x, likes_count: (x.likes_count || 0) + 1 } : x));
      }
    } catch { /* handle error */ }
    setLiking(l => ({ ...l, [mediaId]: false }));
  };

  if (loading) return <ActivityIndicator color={primary} style={{ marginTop: 32 }} />;

  if (!media.length) return (
    <View style={{ alignItems: 'center', paddingTop: 40, gap: 8 }}>
      <Feather name="image" size={32} color={muted} />
      <Text style={{ color: muted, fontSize: 13 }}>No match photos yet</Text>
    </View>
  );

  return (
    <View style={{ gap: 12 }}>
      {media.map(item => (
        <View key={item.id} style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: `${primary}08`, borderWidth: 1, borderColor: `${primary}20` }}>
          {item.media_url ? (
            <Image source={{ uri: item.media_url }} style={{ width: '100%', height: 200 }} resizeMode="cover" />
          ) : null}
          <View style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              {item.minute != null && (
                <Text style={{ color: primary, fontSize: 10, fontWeight: '900', marginBottom: 2 }}>{item.minute}'</Text>
              )}
              {item.caption ? (
                <Text style={{ color: textColor, fontSize: 13 }} numberOfLines={2}>{item.caption}</Text>
              ) : null}
              <Text style={{ color: muted, fontSize: 11, marginTop: 2 }}>@{item.profiles?.username || 'unknown'}</Text>
            </View>
            <TouchableOpacity
              onPress={() => toggleLike(item.id)}
              disabled={!!liking[item.id]}
              style={{ alignItems: 'center', gap: 3 }}
              accessibilityLabel={likedSet.has(item.id) ? 'Unlike' : 'Like'}
            >
              <Feather name="heart" size={20} color={likedSet.has(item.id) ? "#f43f5e" : muted} />
              <Text style={{ color: muted, fontSize: 11, fontWeight: '700' }}>{item.likes_count || 0}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
};
