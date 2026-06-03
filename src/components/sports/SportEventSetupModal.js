/**
 * SportEventSetupModal
 *
 * Allows event hosts to configure their event as a competitive sport event.
 * Step 1: Choose sport type
 * Step 2: Choose format (league, knockout, group stage, etc.)
 * Step 3: Add teams / athletes
 * Step 4: Schedule fixtures (optional auto-generate)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal, View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  SPORT_REGISTRY, SPORT_KEYS, SportConfig,
  TeamManager, AthleteManager, MatchManager,
} from '../../services/sportsEngine';
import { MembershipManager, ClubManager } from '../../services/clubEngine';
import { useBackClose } from '../../hooks/useBackClose';

const FORMATS = [
  { key: 'league',       label: 'League',         icon: 'list',      desc: 'All teams play each other. Points table decides winner.' },
  { key: 'knockout',     label: 'Knockout / Cup',  icon: 'git-merge', desc: 'Lose and you are out. Single or double elimination.' },
  { key: 'group_stage',  label: 'Groups + Knockout', icon: 'layers',  desc: 'Group stage then knockout rounds (e.g. World Cup style).' },
  { key: 'round_robin',  label: 'Round Robin',     icon: 'rotate-cw', desc: 'Everyone plays everyone once.' },
  { key: 'single',       label: 'Single Match',    icon: 'target',    desc: 'One-off match or event.' },
];

export const SportEventSetupModal = ({
  visible, onClose, eventId, onSetupComplete,
  primary = "#00f2ff", bg = "#0d1112", textColor = '#fff', muted = 'rgba(255,255,255,0.5)',
}) => {
  useBackClose(visible, onClose);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState(null);

  // Step 1
  const [sportType, setSportType] = useState('soccer');
  // Step 2
  const [format, setFormat] = useState('league');
  const [winPts, setWinPts] = useState('3');
  const [drawPts, setDrawPts] = useState('1');
  const [lossPts, setLossPts] = useState('0');
  const [periods, setPeriods] = useState('');
  // Step 3 — teams
  const [teams, setTeams] = useState([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamColor, setNewTeamColor] = useState("#00f2ff");
  const [clubSearchQuery, setClubSearchQuery] = useState('');
  const [clubSearchResults, setClubSearchResults] = useState([]);
  const [searchingClubs, setSearchingClubs] = useState(false);
  const [selectedClub, setSelectedClub] = useState(null);
  // Step 4 — fixtures
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [startDate, setStartDate] = useState('');

  const sportMeta = SPORT_REGISTRY[sportType] || SPORT_REGISTRY.other;

  // Stamp (or clear) the match crest on the parent event. The engine reads the
  // freshly-persisted teams/fixture from the DB and rebuilds the card (crests +
  // any score), so we call it after each team add/remove/fixture write.
  const syncMatchCard = () => MatchManager.syncEventMatchCard(eventId);

  const load = useCallback(async () => {
    if (!eventId) return;
    const cfg = await SportConfig.get(eventId);
    if (cfg) {
      setExisting(cfg);
      setSportType(cfg.sport_type || 'soccer');
      setFormat(cfg.format || 'league');
      setWinPts(String(cfg.win_points ?? 3));
      setDrawPts(String(cfg.draw_points ?? 1));
      setLossPts(String(cfg.loss_points ?? 0));
    }
    const teamsData = await TeamManager.list(eventId);
    setTeams(teamsData);
  }, [eventId]);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  const searchClubs = async (q) => {
    setClubSearchQuery(q);
    if (!q.trim()) {
      setClubSearchResults([]);
      return;
    }
    setSearchingClubs(true);
    try {
      const results = await ClubManager.search(q, sportType);
      setClubSearchResults(results || []);
    } catch (e) {
      console.warn('Error searching clubs:', e);
    } finally {
      setSearchingClubs(false);
    }
  };

  const handleSelectClub = (club) => {
    setSelectedClub(club);
    setNewTeamName(club.name);
    setNewTeamColor(club.colors?.[0] || "#00f2ff");
    setClubSearchQuery('');
    setClubSearchResults([]);
  };

  const handleAddTeam = async () => {
    if (!newTeamName.trim()) return;
    setSaving(true);
    try {
      const teamData = {
        name: newTeamName.trim(),
        color1: newTeamColor,
        short_name: selectedClub?.short_name || newTeamName.trim().slice(0, 3).toUpperCase(),
      };
      if (selectedClub) {
        teamData.club_id = selectedClub.id;
        teamData.logo_url = selectedClub.logo_url || null;
        try {
          const roster = await MembershipManager.getRoster(selectedClub.id);
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
      const team = await TeamManager.create(eventId, teamData);
      const next = [...teams, team];
      setTeams(next);
      syncMatchCard(next);
      setNewTeamName('');
      setSelectedClub(null);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally { setSaving(false); }
  };

  const handleRemoveTeam = async (teamId) => {
    setSaving(true);
    try {
      await TeamManager.delete(teamId);
      const next = teams.filter(t => t.id !== teamId);
      setTeams(next);
      syncMatchCard(next);
    } finally { setSaving(false); }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await SportConfig.upsert(eventId, {
        sport_type: sportType,
        format,
        win_points: parseInt(winPts) || 3,
        draw_points: parseInt(drawPts) || 1,
        loss_points: parseInt(lossPts) || 0,
        periods: parseInt(periods) || sportMeta.default_periods || 2,
      });
      setStep(3);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally { setSaving(false); }
  };

  const handleGenerateFixtures = async () => {
    if (teams.length < 2) {
      Alert.alert('Need teams', 'Add at least 2 teams before generating fixtures.');
      return;
    }
    setSaving(true);
    try {
      const fixtures = format === 'knockout'
        ? MatchManager.generateKnockout(teams, startDate || null)
        : MatchManager.generateRoundRobin(teams, startDate || null);
      await MatchManager.bulkCreateFixtures(eventId, fixtures);
      await syncMatchCard(teams);
      Alert.alert('Done!', `${fixtures.length} fixtures generated.`);
      onSetupComplete?.();
      onClose();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally { setSaving(false); }
  };

  const COLORS = ["#00f2ff","#10b981","#f97316","#ef4444","#8b5cf6","#ec4899","#f59e0b","#3b82f6","#84cc16","#06b6d4","#a78bfa","#34d399"];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' }}>
        <View style={[se.sheet, { backgroundColor: bg, borderColor: `${primary}25` }]}>
          <View style={[se.pill, { backgroundColor: `${primary}50` }]} />

          {/* Header */}
          <View style={se.header}>
            <View>
              <Text style={{ color: primary, fontWeight: '900', fontSize: 16 }}>🏆 SPORT SETUP</Text>
              <Text style={{ color: muted, fontSize: 11 }}>Step {step} of 4</Text>
            </View>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={textColor} /></TouchableOpacity>
          </View>

          {/* Progress */}
          <View style={{ height: 3, backgroundColor: `${primary}20`, marginHorizontal: 20, borderRadius: 2, marginBottom: 14 }}>
            <View style={{ height: 3, width: `${(step / 4) * 100}%`, backgroundColor: primary, borderRadius: 2 }} />
          </View>

          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">

            {/* STEP 1: Sport type */}
            {step === 1 && (
              <View style={{ padding: 20 }}>
                <Text style={{ color: textColor, fontWeight: '900', fontSize: 15, marginBottom: 14 }}>What sport is this event?</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {SPORT_KEYS.map(key => {
                    const s = SPORT_REGISTRY[key];
                    const active = sportType === key;
                    return (
                      <TouchableOpacity key={key} onPress={() => setSportType(key)}
                        style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, borderWidth: 1.5,
                                 borderColor: active ? (s.color || primary) : `${primary}25`,
                                 backgroundColor: active ? `${s.color || primary}20` : 'transparent',
                                 flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 14 }}>{s.icon}</Text>
                        <Text style={{ color: active ? (s.color || primary) : muted, fontWeight: '800', fontSize: 12 }}>{s.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {sportMeta.disciplines && (
                  <View style={{ marginTop: 16, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: `${primary}20`, backgroundColor: `${primary}06` }}>
                    <Text style={{ color: muted, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>DISCIPLINES INCLUDED</Text>
                    <Text style={{ color: textColor, fontSize: 12, lineHeight: 18 }}>
                      {(sportMeta.disciplines || []).join(' · ')}
                    </Text>
                  </View>
                )}

                <TouchableOpacity onPress={() => setStep(2)}
                  style={{ marginTop: 20, backgroundColor: primary, paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}>
                  <Text style={{ color: '#000', fontWeight: '900', fontSize: 14 }}>NEXT →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 2: Format + rules */}
            {step === 2 && (
              <View style={{ padding: 20 }}>
                <Text style={{ color: textColor, fontWeight: '900', fontSize: 15, marginBottom: 14 }}>Competition Format</Text>

                {FORMATS.map(f => {
                  const active = format === f.key;
                  return (
                    <TouchableOpacity key={f.key} onPress={() => setFormat(f.key)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 8, borderRadius: 14, borderWidth: 1.5,
                               borderColor: active ? primary : `${primary}20`,
                               backgroundColor: active ? `${primary}10` : 'transparent' }}>
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: active ? `${primary}25` : `${primary}10`, alignItems: 'center', justifyContent: 'center' }}>
                        <Feather name={f.icon} size={16} color={active ? primary : muted} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: active ? primary : textColor, fontWeight: '800', fontSize: 13 }}>{f.label}</Text>
                        <Text style={{ color: muted, fontSize: 11, marginTop: 1 }}>{f.desc}</Text>
                      </View>
                      {active && <Feather name="check-circle" size={18} color={primary} />}
                    </TouchableOpacity>
                  );
                })}

                {/* Points system */}
                <Text style={{ color: muted, fontSize: 11, fontWeight: '700', marginTop: 14, marginBottom: 8 }}>POINTS SYSTEM</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[
                    { label: 'Win', value: winPts, setter: setWinPts },
                    { label: 'Draw', value: drawPts, setter: setDrawPts },
                    { label: 'Loss', value: lossPts, setter: setLossPts },
                  ].map(({ label, value, setter }) => (
                    <View key={label} style={{ flex: 1 }}>
                      <Text style={{ color: muted, fontSize: 10, fontWeight: '700', textAlign: 'center', marginBottom: 4 }}>{label}</Text>
                      <TextInput
                        style={[se.numInput, { color: textColor, borderColor: `${primary}30` }]}
                        value={value} onChangeText={setter} keyboardType="numeric" maxLength={2}
                      />
                    </View>
                  ))}
                </View>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
                  <TouchableOpacity onPress={() => setStep(1)} style={{ flex: 1, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: `${primary}30`, alignItems: 'center' }}>
                    <Text style={{ color: muted, fontWeight: '800' }}>← Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSaveConfig} disabled={saving}
                    style={{ flex: 2, backgroundColor: primary, paddingVertical: 13, borderRadius: 14, alignItems: 'center' }}>
                    {saving ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#000', fontWeight: '900', fontSize: 14 }}>SAVE & NEXT →</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* STEP 3: Teams */}
            {step === 3 && (
              <View style={{ padding: 20 }}>
                <Text style={{ color: textColor, fontWeight: '900', fontSize: 15, marginBottom: 4 }}>
                  {sportMeta.team_sport ? 'Add Teams' : 'Add Athletes / Participants'}
                </Text>
                <Text style={{ color: muted, fontSize: 12, marginBottom: 14 }}>
                  {teams.length} added · You can add more later from the event dashboard
                </Text>

                {/* Existing teams */}
                {teams.map(t => (
                  <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginBottom: 6, borderRadius: 12, borderWidth: 1, borderColor: `${primary}15`, backgroundColor: `${primary}05` }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: t.color1 || primary, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 11 }}>{(t.short_name || t.name)[0]}</Text>
                    </View>
                    <Text style={{ color: textColor, fontWeight: '700', fontSize: 13, flex: 1 }}>{t.name}</Text>
                    <TouchableOpacity onPress={() => handleRemoveTeam(t.id)}>
                      <Feather name="trash-2" size={14} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Add team form */}
                <View style={{ marginTop: 8 }}>
                  {sportMeta.team_sport && (
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
                        <ScrollView style={{ maxHeight: 120, marginTop: 6, borderRadius: 10, borderWidth: 1, borderColor: `${primary}20`, backgroundColor: bg }}>
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

                  <TextInput
                    style={[se.input, { color: textColor, borderColor: `${primary}30`, marginBottom: 8 }]}
                    placeholder={sportMeta.team_sport ? 'Team name...' : 'Athlete / participant name...'}
                    placeholderTextColor={muted}
                    value={newTeamName}
                    onChangeText={setNewTeamName}
                  />
                  <Text style={{ color: muted, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>TEAM COLOUR</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {COLORS.map(c => (
                        <TouchableOpacity key={c} onPress={() => setNewTeamColor(c)}
                          style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c,
                                   borderWidth: newTeamColor === c ? 3 : 0, borderColor: '#fff' }} />
                      ))}
                    </View>
                  </ScrollView>
                  <TouchableOpacity onPress={handleAddTeam} disabled={!newTeamName.trim() || saving}
                    style={{ paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: primary, backgroundColor: `${primary}15`, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                    <Feather name="plus" size={14} color={primary} />
                    <Text style={{ color: primary, fontWeight: '800', fontSize: 12 }}>Add {sportMeta.team_sport ? 'Team' : 'Athlete'}</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
                  <TouchableOpacity onPress={() => setStep(2)} style={{ flex: 1, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: `${primary}30`, alignItems: 'center' }}>
                    <Text style={{ color: muted, fontWeight: '800' }}>← Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setStep(4)}
                    style={{ flex: 2, backgroundColor: primary, paddingVertical: 13, borderRadius: 14, alignItems: 'center' }}>
                    <Text style={{ color: '#000', fontWeight: '900', fontSize: 14 }}>NEXT →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* STEP 4: Fixtures */}
            {step === 4 && (
              <View style={{ padding: 20 }}>
                <Text style={{ color: textColor, fontWeight: '900', fontSize: 15, marginBottom: 4 }}>Generate Fixtures</Text>
                <Text style={{ color: muted, fontSize: 12, marginBottom: 16 }}>
                  {teams.length} teams · {format === 'league' ? `${Math.max(0, teams.length - 1)} matchdays` : 'Knockout draw'}
                </Text>

                <TouchableOpacity onPress={() => setAutoGenerate(v => !v)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: autoGenerate ? primary : `${primary}20`, backgroundColor: autoGenerate ? `${primary}10` : 'transparent', marginBottom: 12 }}>
                  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: autoGenerate ? primary : muted, backgroundColor: autoGenerate ? primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {autoGenerate && <Feather name="check" size={11} color="#000" />}
                  </View>
                  <View>
                    <Text style={{ color: autoGenerate ? primary : textColor, fontWeight: '800', fontSize: 13 }}>Auto-generate fixtures</Text>
                    <Text style={{ color: muted, fontSize: 11 }}>Round-robin based on teams added</Text>
                  </View>
                </TouchableOpacity>

                {autoGenerate && (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={{ color: muted, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>START DATE (optional)</Text>
                    <TextInput
                      style={[se.input, { color: textColor, borderColor: `${primary}30` }]}
                      placeholder="YYYY-MM-DD" placeholderTextColor={muted}
                      value={startDate} onChangeText={setStartDate}
                    />
                    <Text style={{ color: muted, fontSize: 10, marginTop: 4 }}>Fixtures will be spaced 7 days apart from this date.</Text>
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <TouchableOpacity onPress={() => setStep(3)} style={{ flex: 1, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: `${primary}30`, alignItems: 'center' }}>
                    <Text style={{ color: muted, fontWeight: '800' }}>← Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={autoGenerate ? handleGenerateFixtures : () => { onSetupComplete?.(); onClose(); }}
                    disabled={saving}
                    style={{ flex: 2, backgroundColor: primary, paddingVertical: 13, borderRadius: 14, alignItems: 'center' }}>
                    {saving ? <ActivityIndicator color="#000" />
                      : <Text style={{ color: '#000', fontWeight: '900', fontSize: 14 }}>
                          {autoGenerate ? '🎲 GENERATE FIXTURES' : '✅ FINISH SETUP'}
                        </Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const se = StyleSheet.create({
  sheet:    { height: '90%', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, paddingTop: 10, overflow: 'hidden' },
  pill:     { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  header:   { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, marginBottom: 8, justifyContent: 'space-between' },
  input:    { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13 },
  numInput: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, fontSize: 18, fontWeight: '900', textAlign: 'center' },
});

export default SportEventSetupModal;
