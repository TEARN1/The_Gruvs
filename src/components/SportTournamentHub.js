/**
 * SportTournamentHub — Universal Sports, Squad & Tournament Networking Hub.
 *
 * Connects athletes, teams, and tournament organizers across all sports:
 *   • Team Creation & Squad Rosters
 *   • Universal Tournament Brackets (Top 32, Top 16, Top 8, Round-Robin)
 *   • Fair Play & Legitimacy Verification (Dual Captain Confirmation / Truth Protocol)
 *   • Squad Challenges & Free Agent Recruitment Board
 */
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { ControlledGlitterBurst } from './ControlledGlitterBurst';
import { haptics } from '../utils/haptics';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';

const SPORT_CATEGORIES = [
  { key: 'soccer', label: 'Soccer / Football', icon: '⚽', color: '#10b981' },
  { key: 'basketball', label: 'Basketball', icon: '🏀', color: '#f97316' },
  { key: 'padel', label: 'Padel / Tennis', icon: '🎾', color: '#a3e635' },
  { key: 'netball', label: 'Netball', icon: '🏐', color: '#ec4899' },
  { key: 'rugby', label: 'Rugby 7s', icon: '🏉', color: '#f59e0b' },
  { key: 'esports', label: 'Esports & Gaming', icon: '🎮', color: '#8b5cf6' },
  { key: 'running', label: 'Running Club', icon: '🏃', color: '#06b6d4' },
];

const INITIAL_TOURNAMENTS = [
  {
    id: 'tourn_1',
    title: 'Johannesburg 5-a-Side Super Cup',
    sport: 'soccer',
    format: 'Top 32 Knockout',
    entryFee: 'R 250 / team',
    prizePool: 'R 15,000 + Trophy',
    venue: 'Discovery Soccer Park, Illovo',
    teamsRegistered: 28,
    teamsMax: 32,
    status: 'filling',
    date: 'Saturday, 14:00',
    verified: true,
  },
  {
    id: 'tourn_2',
    title: 'Kasi Street Padel Open',
    sport: 'padel',
    format: 'Top 16 Championship',
    entryFee: 'R 180 / duo',
    prizePool: 'R 8,000',
    venue: 'Virgin Active Rooftop, Rosebank',
    teamsRegistered: 16,
    teamsMax: 16,
    status: 'live',
    date: 'Sunday, 11:00',
    verified: true,
  },
  {
    id: 'tourn_3',
    title: 'Midnight 3v3 Hoops Slam',
    sport: 'basketball',
    format: 'Top 16 Knockout',
    entryFee: 'Free Entry',
    prizePool: 'R 5,000 + Sneaker Drop',
    venue: 'Braamfontein Youth Courts',
    teamsRegistered: 12,
    teamsMax: 16,
    status: 'filling',
    date: 'Friday, 20:00',
    verified: true,
  },
];

const INITIAL_TEAMS = [
  {
    id: 'team_1',
    name: 'Soweto City Stars',
    sport: 'soccer',
    captain: 'Kagiso M.',
    suburb: 'Diepkloof',
    membersCount: 8,
    winRate: '78%',
    vibeRating: 'Fair Play Elite',
    fairVerified: true,
  },
  {
    id: 'team_2',
    name: 'Jozi Dribblers',
    sport: 'soccer',
    captain: 'Lethabo Z.',
    suburb: 'Braamfontein',
    membersCount: 7,
    winRate: '65%',
    vibeRating: 'Verified Squad',
    fairVerified: true,
  },
  {
    id: 'team_3',
    name: 'Apex Padel Aces',
    sport: 'padel',
    captain: 'Thabo D.',
    suburb: 'Rosebank',
    membersCount: 4,
    winRate: '82%',
    vibeRating: 'Fair Play Elite',
    fairVerified: true,
  },
];

export function SportTournamentHub({
  visible,
  onClose,
  primary = '#00f2ff',
  bg = '#080b0d',
  textColor = '#fff',
  muted = 'rgba(255,255,255,0.55)',
}) {
  const { user } = useAuth();
  const { show: toast } = useToast();

  const [activeTab, setActiveTab] = useState('tournaments'); // 'tournaments' | 'teams' | 'bracket' | 'fairplay'
  const [selectedSport, setSelectedSport] = useState('soccer');
  const [tournaments, setTournaments] = useState(INITIAL_TOURNAMENTS);
  const [teams, setTeams] = useState(INITIAL_TEAMS);

  // New team modal states
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamSuburb, setTeamSuburb] = useState('');
  const [teamSquadSize, setTeamSquadSize] = useState('7');
  const [glitterFx, setGlitterFx] = useState(0);

  // Match confirmation state (Fair Play Truth Protocol)
  const [scoreTeamA, setScoreTeamA] = useState('3');
  const [scoreTeamB, setScoreTeamB] = useState('2');
  const [dualConfirmed, setDualConfirmed] = useState(false);

  // Live Ticker & Predictions
  const [tickerMatches, setTickerMatches] = useState([
    {
      id: 'm1',
      teamA: 'Soweto City Stars',
      teamB: 'Jozi Dribblers',
      scoreA: 3,
      scoreB: 2,
      minute: "84'",
      status: 'LIVE',
      events: [
        { min: "82'", text: "GOAL! Sipho header into top right corner (3-2) ⚽" },
        { min: "65'", text: "Yellow card for tackle on edge of box 🟨" },
        { min: "44'", text: "GOAL! Jozi Dribblers equalizer via penalty (2-2) ⚽" },
      ],
    },
    {
      id: 'm2',
      teamA: 'Diepkloof Padel Aces',
      teamB: 'Rosebank Smashers',
      scoreA: 2,
      scoreB: 1,
      minute: 'Set 3 (5-4)',
      status: 'MATCH POINT',
      events: [
        { min: 'Set 3', text: 'Break point won by Diepkloof Aces 🎾' },
      ],
    },
  ]);
  const [predictions, setPredictions] = useState({});
  const [predictionGlitters, setPredictionGlitters] = useState({});

  const filteredTournaments = useMemo(() => {
    return tournaments.filter((t) => t.sport === selectedSport);
  }, [tournaments, selectedSport]);

  const filteredTeams = useMemo(() => {
    return teams.filter((t) => t.sport === selectedSport);
  }, [teams, selectedSport]);

  const handleCreateTeam = () => {
    if (!teamName.trim()) {
      toast('Please enter a team name', 'info');
      return;
    }
    const newTeam = {
      id: `team_${Date.now()}`,
      name: teamName.trim(),
      sport: selectedSport,
      captain: user?.user_metadata?.full_name || 'You',
      suburb: teamSuburb.trim() || 'Johannesburg',
      membersCount: parseInt(teamSquadSize, 10) || 7,
      winRate: '100% (New)',
      vibeRating: 'Captain Verified',
      fairVerified: true,
    };

    setTeams((prev) => [newTeam, ...prev]);
    setShowCreateTeam(false);
    setTeamName('');
    setTeamSuburb('');
    try { haptics.success(); } catch {}
    setGlitterFx(Date.now());
    toast(`${newTeam.name} squad registered!`, 'success');
  };

  const handleConfirmScore = () => {
    try { haptics.success(); } catch {}
    setDualConfirmed(true);
    setGlitterFx(Date.now());
    toast('Score Verified by Both Captains! Table Updated.', 'success');
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <View style={[styles.sheet, { backgroundColor: 'rgba(10,14,16,0.98)', borderColor: `${primary}35` }]}>
          {/* Header */}
          <View style={styles.headRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Text style={{ fontSize: 18 }}>🏆</Text>
                <Text style={[styles.title, { color: textColor }]}>Sports & Tournament Hub</Text>
              </View>
              <Text style={[styles.sub, { color: muted }]}>
                Create squads, enter Top 32 tournaments, and verify fair play
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.closeBtn}>
              <Feather name="x" size={18} color={muted} />
            </TouchableOpacity>
          </View>

          {/* Sport Categories Strip */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {SPORT_CATEGORIES.map((sport) => {
              const active = selectedSport === sport.key;
              return (
                <TouchableOpacity
                  key={sport.key}
                  onPress={() => setSelectedSport(sport.key)}
                  style={[
                    styles.sportPill,
                    {
                      borderColor: active ? sport.color : 'rgba(255,255,255,0.12)',
                      backgroundColor: active ? `${sport.color}20` : 'rgba(255,255,255,0.03)',
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 14 }}>{sport.icon}</Text>
                  <Text style={[styles.sportPillText, { color: active ? sport.color : textColor }]}>
                    {sport.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Main Navigation Tabs */}
          <View style={styles.tabBar}>
            {[
              { key: 'tournaments', label: 'Tournaments', icon: 'award' },
              { key: 'teams', label: 'Squads', icon: 'users' },
              { key: 'bracket', label: 'Bracket', icon: 'git-merge' },
              { key: 'fairplay', label: 'Fair Play', icon: 'shield' },
              { key: 'ticker', label: 'Live Ticker', icon: 'activity' },
              { key: 'predictions', label: 'Predictions', icon: 'target' },
            ].map((t) => {
              const active = activeTab === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => setActiveTab(t.key)}
                  style={[
                    styles.tabBtn,
                    {
                      borderColor: active ? primary : 'transparent',
                      borderBottomWidth: active ? 2 : 0,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Feather name={t.icon} size={12} color={active ? primary : muted} />
                  <Text style={[styles.tabBtnText, { color: active ? primary : muted }]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 20 }}>
            {/* TAB 1: TOURNAMENTS */}
            {activeTab === 'tournaments' && (
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.sectionTitle, { color: muted }]}>ACTIVE & UPCOMING COMPETITIONS</Text>
                  <TouchableOpacity
                    onPress={() => toast('Tournament hosting opened for verified clubs & organizers!', 'info')}
                    style={[styles.smallActionBtn, { borderColor: `${primary}40`, backgroundColor: `${primary}15` }]}
                  >
                    <Feather name="plus" size={12} color={primary} />
                    <Text style={{ color: primary, fontSize: 11, fontWeight: '800' }}>Host Cup</Text>
                  </TouchableOpacity>
                </View>

                {filteredTournaments.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={{ fontSize: 32 }}>🏆</Text>
                    <Text style={{ color: textColor, fontWeight: '800', fontSize: 14 }}>
                      No active {selectedSport} tournaments today
                    </Text>
                    <Text style={{ color: muted, fontSize: 12, textAlign: 'center' }}>
                      Be the first organizer to post a cup in your area!
                    </Text>
                  </View>
                ) : (
                  filteredTournaments.map((tourn) => (
                    <View key={tourn.id} style={[styles.tournCard, { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(15,22,25,0.96)' }]}>
                      <View style={styles.tournCardHead}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.tournTitle, { color: textColor }]}>{tourn.title}</Text>
                            {tourn.verified && <Feather name="check-circle" size={13} color="#10b981" />}
                          </View>
                          <Text style={{ color: muted, fontSize: 11, marginTop: 2 }}>{tourn.venue} · {tourn.date}</Text>
                        </View>
                        <View style={[styles.formatBadge, { borderColor: `${primary}45`, backgroundColor: `${primary}15` }]}>
                          <Text style={{ color: primary, fontSize: 10, fontWeight: '900' }}>{tourn.format}</Text>
                        </View>
                      </View>

                      <View style={styles.tournDetailsRow}>
                        <View style={styles.tournDetailItem}>
                          <Text style={{ color: muted, fontSize: 10, fontWeight: '700' }}>PRIZE POOL</Text>
                          <Text style={{ color: '#f59e0b', fontSize: 13, fontWeight: '900' }}>{tourn.prizePool}</Text>
                        </View>
                        <View style={styles.tournDetailItem}>
                          <Text style={{ color: muted, fontSize: 10, fontWeight: '700' }}>ENTRY FEE</Text>
                          <Text style={{ color: textColor, fontSize: 13, fontWeight: '800' }}>{tourn.entryFee}</Text>
                        </View>
                        <View style={styles.tournDetailItem}>
                          <Text style={{ color: muted, fontSize: 10, fontWeight: '700' }}>SPOTS</Text>
                          <Text style={{ color: '#10b981', fontSize: 13, fontWeight: '900' }}>
                            {tourn.teamsRegistered}/{tourn.teamsMax} Full
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        onPress={() => {
                          try { haptics.medium(); } catch {}
                          toast(`Squad entry submitted for ${tourn.title}!`, 'success');
                        }}
                        style={[styles.enterCupBtn, { backgroundColor: primary }]}
                        activeOpacity={0.8}
                      >
                        <Feather name="shield" size={14} color="#000" />
                        <Text style={{ color: '#000', fontWeight: '900', fontSize: 12 }}>
                          Enter Team Into Cup
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* TAB 2: SQUADS & TEAMS */}
            {activeTab === 'teams' && (
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.sectionTitle, { color: muted }]}>REGISTERED TEAMS & FREE AGENTS</Text>
                  <TouchableOpacity
                    onPress={() => setShowCreateTeam(true)}
                    style={[styles.smallActionBtn, { borderColor: '#10b981', backgroundColor: '#10b98120' }]}
                  >
                    <Feather name="user-plus" size={12} color="#10b981" />
                    <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '800' }}>Create Squad</Text>
                  </TouchableOpacity>
                </View>

                {showCreateTeam && (
                  <View style={[styles.createTeamForm, { borderColor: `${primary}50`, backgroundColor: 'rgba(20,28,32,0.98)' }]}>
                    <Text style={{ color: textColor, fontSize: 14, fontWeight: '900' }}>Register New Squad</Text>
                    <TextInput
                      value={teamName}
                      onChangeText={setTeamName}
                      placeholder="Squad Name (e.g. Diepkloof Warriors)"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      style={[styles.input, { color: textColor }]}
                    />
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TextInput
                        value={teamSuburb}
                        onChangeText={setTeamSuburb}
                        placeholder="Home Suburb (e.g. Soweto)"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        style={[styles.input, { flex: 1, color: textColor }]}
                      />
                      <TextInput
                        value={teamSquadSize}
                        onChangeText={setTeamSquadSize}
                        placeholder="Players"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        keyboardType="numeric"
                        style={[styles.input, { width: 80, color: textColor }]}
                      />
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      <TouchableOpacity
                        onPress={handleCreateTeam}
                        style={[styles.formActionBtn, { backgroundColor: primary }]}
                      >
                        <Text style={{ color: '#000', fontWeight: '900', fontSize: 12 }}>Save Squad</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setShowCreateTeam(false)}
                        style={[styles.formActionBtn, { borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'transparent', borderWidth: 1 }]}
                      >
                        <Text style={{ color: muted, fontWeight: '800', fontSize: 12 }}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {filteredTeams.map((team) => (
                  <View key={team.id} style={[styles.teamCard, { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(15,22,25,0.96)' }]}>
                    <View style={styles.teamCardRow}>
                      <View style={[styles.teamAvatarWrap, { borderColor: `${primary}40`, backgroundColor: `${primary}15` }]}>
                        <Feather name="shield" size={18} color={primary} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Text style={[styles.teamName, { color: textColor }]}>{team.name}</Text>
                          {team.fairVerified && <Feather name="check" size={13} color="#10b981" />}
                        </View>
                        <Text style={{ color: muted, fontSize: 11 }}>
                          Captain: {team.captain} · {team.suburb} · {team.membersCount} Players
                        </Text>
                      </View>
                      <View style={styles.teamStatsBadge}>
                        <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '900' }}>{team.winRate} Win</Text>
                        <Text style={{ color: muted, fontSize: 9 }}>{team.vibeRating}</Text>
                      </View>
                    </View>

                    <View style={styles.teamActionsRow}>
                      <TouchableOpacity
                        onPress={() => toast(`Challenge sent to ${team.name}!`, 'info')}
                        style={[styles.teamActionBtn, { borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.04)' }]}
                      >
                        <Feather name="zap" size={12} color={primary} />
                        <Text style={{ color: textColor, fontSize: 11, fontWeight: '800' }}>Challenge Match</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => toast(`Roster request sent to Captain ${team.captain}!`, 'success')}
                        style={[styles.teamActionBtn, { borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.04)' }]}
                      >
                        <Feather name="user-check" size={12} color="#10b981" />
                        <Text style={{ color: textColor, fontSize: 11, fontWeight: '800' }}>Join Roster</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* TAB 3: TOP 32 BRACKET */}
            {activeTab === 'bracket' && (
              <View style={{ gap: 12 }}>
                <Text style={[styles.sectionTitle, { color: muted }]}>LIVE TOURNAMENT BRACKET SEEDING</Text>
                <View style={[styles.bracketCard, { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(15,22,25,0.96)' }]}>
                  <View style={styles.bracketRoundHead}>
                    <Text style={{ color: primary, fontSize: 12, fontWeight: '900' }}>ROUND OF 32 (KNOCKOUT)</Text>
                    <Text style={{ color: muted, fontSize: 11 }}>Match 1 of 16</Text>
                  </View>

                  {/* Seeded match row */}
                  <View style={styles.matchFixture}>
                    <View style={styles.matchTeamRow}>
                      <Text style={{ color: textColor, fontWeight: '800', fontSize: 13, flex: 1 }}>
                        1. Soweto City Stars
                      </Text>
                      <Text style={{ color: primary, fontWeight: '900', fontSize: 15 }}>3</Text>
                    </View>
                    <View style={[styles.fixtureDivider, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
                    <View style={styles.matchTeamRow}>
                      <Text style={{ color: textColor, fontWeight: '800', fontSize: 13, flex: 1 }}>
                        16. Jozi Dribblers
                      </Text>
                      <Text style={{ color: muted, fontWeight: '900', fontSize: 15 }}>2</Text>
                    </View>
                  </View>

                  <View style={styles.bracketFooter}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Feather name="check-circle" size={12} color="#10b981" />
                      <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '700' }}>
                        Dual-Captain Verified
                      </Text>
                    </View>
                    <Text style={{ color: muted, fontSize: 11 }}>Advancing to Quarter-Finals ›</Text>
                  </View>
                </View>
              </View>
            )}

            {/* TAB 4: FAIR PLAY PROTOCOL */}
            {activeTab === 'fairplay' && (
              <View style={{ gap: 12 }}>
                <Text style={[styles.sectionTitle, { color: muted }]}>
                  TRUTH PROTOCOL FOR SPORTS — NO FAKE RESULTS
                </Text>
                <View style={[styles.fairPlayCard, { borderColor: '#10b98150', backgroundColor: 'rgba(16,185,129,0.08)' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Feather name="shield" size={18} color="#10b981" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: textColor, fontSize: 14, fontWeight: '900' }}>
                        Dual Captain Score Confirmation
                      </Text>
                      <Text style={{ color: muted, fontSize: 11, marginTop: 1 }}>
                        Results only lock into the official table once BOTH team captains confirm the score.
                      </Text>
                    </View>
                  </View>

                  {/* Dual Confirm Box */}
                  <View style={styles.scoreInputBox}>
                    <View style={{ alignItems: 'center', flex: 1 }}>
                      <Text style={{ color: textColor, fontSize: 12, fontWeight: '800' }}>Soweto Stars</Text>
                      <TextInput
                        value={scoreTeamA}
                        onChangeText={setScoreTeamA}
                        keyboardType="numeric"
                        style={[styles.scoreInput, { color: primary }]}
                      />
                      <Text style={{ color: '#10b981', fontSize: 10, fontWeight: '700' }}>Captain A: Approved ✓</Text>
                    </View>

                    <Text style={{ color: muted, fontSize: 20, fontWeight: '900' }}>VS</Text>

                    <View style={{ alignItems: 'center', flex: 1 }}>
                      <Text style={{ color: textColor, fontSize: 12, fontWeight: '800' }}>Jozi Dribblers</Text>
                      <TextInput
                        value={scoreTeamB}
                        onChangeText={setScoreTeamB}
                        keyboardType="numeric"
                        style={[styles.scoreInput, { color: textColor }]}
                      />
                      <Text style={{ color: dualConfirmed ? '#10b981' : '#f59e0b', fontSize: 10, fontWeight: '700' }}>
                        {dualConfirmed ? 'Captain B: Approved ✓' : 'Awaiting Captain B'}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={handleConfirmScore}
                    disabled={dualConfirmed}
                    style={[styles.confirmScoreBtn, { backgroundColor: dualConfirmed ? '#10b981' : primary }]}
                    activeOpacity={0.8}
                  >
                    <Feather name={dualConfirmed ? 'check-circle' : 'lock'} size={15} color="#000" />
                    <Text style={{ color: '#000', fontWeight: '900', fontSize: 13 }}>
                      {dualConfirmed ? 'Score Locked & Verified' : 'Confirm & Validate Match Score'}
                    </Text>
                    <ControlledGlitterBurst trigger={glitterFx} count={14} radius={38} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* TAB 5: LIVE MATCH TICKER */}
            {activeTab === 'ticker' && (
              <View style={{ gap: 12 }}>
                <Text style={[styles.sectionTitle, { color: muted }]}>LIVE MINUTE-BY-MINUTE TOURNAMENT TICKER</Text>
                {tickerMatches.map(match => (
                  <View key={match.id} style={[styles.teamCard, { borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(15,22,25,0.96)', padding: 14 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
                        <Text style={{ color: '#10b981', fontWeight: '900', fontSize: 11 }}>{match.status} · {match.minute}</Text>
                      </View>
                      <Text style={{ color: muted, fontSize: 10 }}>Match ID: #{match.id}</Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
                      <Text style={{ color: textColor, fontWeight: '900', fontSize: 14, flex: 1 }}>{match.teamA}</Text>
                      <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, backgroundColor: `${primary}20`, borderWidth: 1, borderColor: `${primary}45` }}>
                        <Text style={{ color: primary, fontWeight: '950', fontSize: 16 }}>{match.scoreA} - {match.scoreB}</Text>
                      </View>
                      <Text style={{ color: textColor, fontWeight: '900', fontSize: 14, flex: 1, textAlign: 'right' }}>{match.teamB}</Text>
                    </View>

                    {/* Timeline events */}
                    <View style={{ gap: 4, marginTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 8 }}>
                      {match.events.map((ev, i) => (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ color: primary, fontWeight: '800', fontSize: 10.5 }}>{ev.min}</Text>
                          <Text style={{ color: muted, fontSize: 11, flex: 1 }}>{ev.text}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* TAB 6: SPECTATOR PREDICTIONS */}
            {activeTab === 'predictions' && (
              <View style={{ gap: 12 }}>
                <Text style={[styles.sectionTitle, { color: muted }]}>SPECTATOR BRACKET PREDICTIONS</Text>
                <View style={[styles.fairPlayCard, { borderColor: '#8b5cf650', backgroundColor: 'rgba(139,92,246,0.08)' }]}>
                  <Text style={{ color: textColor, fontSize: 13, fontWeight: '900' }}>Pick Matchup Winners · Win Coins 🎯</Text>
                  <Text style={{ color: muted, fontSize: 11 }}>Lock your prediction before the final whistle. Correct picks earn 50 Coins!</Text>
                </View>

                {tickerMatches.map(m => {
                  const picked = predictions[m.id];
                  return (
                    <View key={m.id} style={[styles.teamCard, { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(15,22,25,0.96)', padding: 14 }]}>
                      <Text style={{ color: muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }}>MATCH PREDICTION</Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                        <TouchableOpacity
                          onPress={() => {
                            setPredictionGlitters(prev => ({ ...prev, [`${m.id}_A`]: Date.now() }));
                            setPredictions(prev => ({ ...prev, [m.id]: m.teamA }));
                            toast(`Prediction locked: ${m.teamA} to win! 🎯`, 'success');
                          }}
                          style={[
                            styles.teamActionBtn,
                            {
                              flex: 1,
                              backgroundColor: picked === m.teamA ? `${primary}30` : 'rgba(255,255,255,0.05)',
                              borderColor: picked === m.teamA ? primary : 'rgba(255,255,255,0.12)',
                              position: 'relative',
                            },
                          ]}
                        >
                          <Text style={{ color: picked === m.teamA ? primary : textColor, fontWeight: '800', fontSize: 11 }}>
                            {m.teamA} (2.1x)
                          </Text>
                          <ControlledGlitterBurst trigger={predictionGlitters[`${m.id}_A`]} count={10} radius={26} colors={[primary, '#fff']} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => {
                            setPredictionGlitters(prev => ({ ...prev, [`${m.id}_B`]: Date.now() }));
                            setPredictions(prev => ({ ...prev, [m.id]: m.teamB }));
                            toast(`Prediction locked: ${m.teamB} to win! 🎯`, 'success');
                          }}
                          style={[
                            styles.teamActionBtn,
                            {
                              flex: 1,
                              backgroundColor: picked === m.teamB ? `${primary}30` : 'rgba(255,255,255,0.05)',
                              borderColor: picked === m.teamB ? primary : 'rgba(255,255,255,0.12)',
                              position: 'relative',
                            },
                          ]}
                        >
                          <Text style={{ color: picked === m.teamB ? primary : textColor, fontWeight: '800', fontSize: 11 }}>
                            {m.teamB} (1.9x)
                          </Text>
                          <ControlledGlitterBurst trigger={predictionGlitters[`${m.id}_B`]} count={10} radius={26} colors={[primary, '#fff']} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.80)',
    justifyContent: 'flex-end',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } : {}),
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '92%',
    padding: 18,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    gap: 12,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
  },
  sub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 4,
  },
  sportPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  sportPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.10)',
    gap: 12,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  tournCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  tournCardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  tournTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  formatBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  tournDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 8,
    borderRadius: 12,
  },
  tournDetailItem: {
    alignItems: 'center',
  },
  enterCupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 19,
  },
  createTeamForm: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  input: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 10,
    fontSize: 13,
  },
  formActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamCard: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  teamCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamAvatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamName: {
    fontSize: 13,
    fontWeight: '800',
  },
  teamStatsBadge: {
    alignItems: 'flex-end',
  },
  teamActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  teamActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  bracketCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  bracketRoundHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchFixture: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  matchTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fixtureDivider: {
    height: 1,
    width: '100%',
  },
  bracketFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fairPlayCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  scoreInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 12,
    borderRadius: 14,
  },
  scoreInput: {
    width: 50,
    height: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  confirmScoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 22,
    position: 'relative',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 6,
  },
});

export default SportTournamentHub;
