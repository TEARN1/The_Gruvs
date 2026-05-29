/**
 * SportDashboard
 *
 * The master sport view for an event — shown when an event has sport config.
 * Tabs:
 *   Fixtures     — upcoming + completed matches
 *   Table        — league standings (team sport) or results (individual)
 *   Top Scorers  — performer leaderboards
 *   Gallery      — sport media (match photos)
 *
 * Host-only controls:
 *   → Open LiveMatchLogger for any scheduled/live match
 *   → Add match button
 *   → Open SportEventSetupModal to edit config
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Animated, RefreshControl, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import {
  SportConfig, TeamManager, MatchManager, StatsManager,
  SportMediaManager, SportFollowerManager, IndividualResultsManager,
  SPORT_REGISTRY, subscribeToLiveMatch,
} from '../../services/sportsEngine';
import { SportLeagueTable } from './SportLeagueTable';
import { LiveMatchLogger } from './LiveMatchLogger';
import { SportEventSetupModal } from './SportEventSetupModal';

const STATUS_COLORS = {
  scheduled: '#6366f1',
  live: '#ef4444',
  half_time: '#f59e0b',
  completed: '#10b981',
  postponed: '#64748b',
  cancelled: '#ef4444',
  abandoned: '#ef4444',
};

const STATUS_LABELS = {
  scheduled: 'Upcoming',
  live: '🔴 LIVE',
  half_time: '⏸ HT',
  completed: 'FT',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
};

function MatchCard({ match, onPress, isHost, primary, textColor, muted, bg }) {
  const home = match.home_team;
  const away = match.away_team;
  const isLive = match.status === 'live' || match.status === 'half_time';
  const isDone = match.status === 'completed';
  const statusColor = STATUS_COLORS[match.status] || '#6366f1';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.82}
      style={[mc.card, { backgroundColor: isLive ? `${statusColor}12` : `${primary}06`, borderColor: isLive ? `${statusColor}40` : `${primary}15` }]}>

      {/* Status bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={[mc.roundPill, { backgroundColor: `${primary}15` }]}>
          <Text style={{ color: muted, fontSize: 9, fontWeight: '800' }}>
            {match.round || `Match ${match.match_number || 1}`}
          </Text>
        </View>
        <View style={[mc.statusPill, { backgroundColor: `${statusColor}20`, borderColor: `${statusColor}40` }]}>
          <Text style={{ color: statusColor, fontSize: 10, fontWeight: '900' }}>
            {STATUS_LABELS[match.status] || match.status?.toUpperCase()}
          </Text>
        </View>
        {isHost && match.status !== 'completed' && (
          <TouchableOpacity onPress={onPress}
            style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: primary, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Feather name={isLive ? 'edit-2' : 'play'} size={10} color="#000" />
            <Text style={{ color: '#000', fontSize: 10, fontWeight: '900' }}>{isLive ? 'MANAGE' : 'START'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Teams + score */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Home team */}
        <View style={mc.teamBlock}>
          {home?.logo_url
            ? <Image source={{ uri: home.logo_url }} style={mc.teamLogo} />
            : <View style={[mc.teamLogo, { backgroundColor: home?.color1 || primary, alignItems: 'center', justifyContent: 'center', borderRadius: 22 }]}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>{(home?.short_name || home?.name || '?')[0]}</Text>
              </View>
          }
          <Text style={[mc.teamName, { color: textColor }]} numberOfLines={2}>{home?.name || 'Home'}</Text>
        </View>

        {/* Score */}
        <View style={mc.scoreBlock}>
          {isDone || isLive ? (
            <>
              <Text style={[mc.score, { color: isLive ? statusColor : textColor }]}>
                {match.home_score ?? 0} – {match.away_score ?? 0}
              </Text>
              {isLive && match.current_minute > 0 && (
                <Text style={{ color: statusColor, fontSize: 10, fontWeight: '700' }}>{match.current_minute}'</Text>
              )}
              {isDone && match.home_score_pens != null && (
                <Text style={{ color: muted, fontSize: 10 }}>({match.home_score_pens}–{match.away_score_pens} pens)</Text>
              )}
            </>
          ) : (
            <>
              <Text style={{ color: muted, fontSize: 12, fontWeight: '700' }}>
                {match.scheduled_at
                  ? new Date(match.scheduled_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
                  : 'TBA'}
              </Text>
              {match.scheduled_at && (
                <Text style={{ color: primary, fontSize: 11, fontWeight: '800' }}>
                  {new Date(match.scheduled_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              )}
            </>
          )}
          {match.venue_name && (
            <Text style={{ color: muted, fontSize: 9, textAlign: 'center' }} numberOfLines={1}>📍 {match.venue_name}</Text>
          )}
        </View>

        {/* Away team */}
        <View style={[mc.teamBlock, { alignItems: 'flex-end' }]}>
          {away?.logo_url
            ? <Image source={{ uri: away.logo_url }} style={mc.teamLogo} />
            : <View style={[mc.teamLogo, { backgroundColor: away?.color1 || '#6366f1', alignItems: 'center', justifyContent: 'center', borderRadius: 22 }]}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>{(away?.short_name || away?.name || '?')[0]}</Text>
              </View>
          }
          <Text style={[mc.teamName, { color: textColor, textAlign: 'right' }]} numberOfLines={2}>{away?.name || 'Away'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export const SportDashboard = ({ eventId, event, onNavigateToEvent, primary = '#00f2ff', bg = '#0d1112', textColor = '#fff', muted = 'rgba(255,255,255,0.5)' }) => {
  const { user } = useAuth();
  const [config, setConfig] = useState(null);
  const [fixtures, setFixtures] = useState([]);
  const [performers, setPerformers] = useState([]);
  const [media, setMedia] = useState([]);
  const [individualResults, setIndividualResults] = useState([]);
  const [disciplines, setDisciplines] = useState([]);
  const [activeDiscipline, setActiveDiscipline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('fixtures');
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [loggerVisible, setLoggerVisible] = useState(false);
  const [setupVisible, setSetupVisible] = useState(false);
  const [followData, setFollowData] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  const isHost = user?.id && event?.author_id === user.id;

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [cfg, fixtureData, perfData, mediaData] = await Promise.allSettled([
        SportConfig.get(eventId),
        MatchManager.listFixtures(eventId),
        StatsManager.getTopPerformers(eventId),
        SportMediaManager.list(eventId),
      ]);

      const configData = cfg.status === 'fulfilled' ? cfg.value : null;
      setConfig(configData);
      setFixtures(fixtureData.status === 'fulfilled' ? fixtureData.value : []);
      setPerformers(perfData.status === 'fulfilled' ? perfData.value : []);
      setMedia(mediaData.status === 'fulfilled' ? mediaData.value : []);

      const sportMeta = SPORT_REGISTRY[configData?.sport_type];
      if (sportMeta && !sportMeta.team_sport && sportMeta.individual_sport) {
        const [discList, results] = await Promise.allSettled([
          IndividualResultsManager.getDisciplines(eventId),
          IndividualResultsManager.list(eventId),
        ]);
        const discs = discList.status === 'fulfilled' ? discList.value : [];
        setDisciplines(discs);
        if (!activeDiscipline && discs.length) setActiveDiscipline(discs[0]);
        setIndividualResults(results.status === 'fulfilled' ? results.value : []);
      }

      if (user) {
        const fd = await SportFollowerManager.isFollowing(eventId, user.id);
        setFollowData(fd);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId, user?.id]);

  useEffect(() => { load(); }, [load]);

  const sportMeta = SPORT_REGISTRY[config?.sport_type] || SPORT_REGISTRY.other;
  const isTeamSport = sportMeta.team_sport;

  const handleFollow = async () => {
    if (!user) return;
    if (followData) {
      await SportFollowerManager.unfollow(eventId, user.id);
      setFollowData(null);
    } else {
      await SportFollowerManager.follow(eventId, user.id);
      setFollowData({ event_id: eventId, user_id: user.id });
    }
  };

  const filteredFixtures = filterStatus === 'all'
    ? fixtures
    : fixtures.filter(f => f.status === filterStatus);

  const liveMatches = fixtures.filter(f => f.status === 'live' || f.status === 'half_time');
  const upcomingMatches = fixtures.filter(f => f.status === 'scheduled').slice(0, 3);
  const recentResults = fixtures.filter(f => f.status === 'completed').slice(-3).reverse();

  if (loading) return (
    <View style={{ paddingVertical: 40, alignItems: 'center' }}>
      <ActivityIndicator color={primary} size="large" />
      <Text style={{ color: muted, fontSize: 12, marginTop: 8 }}>Loading sport data...</Text>
    </View>
  );

  if (!config) return (
    <View style={{ padding: 20, alignItems: 'center', gap: 12 }}>
      <Text style={{ fontSize: 32 }}>{sportMeta.icon}</Text>
      <Text style={{ color: textColor, fontWeight: '900', fontSize: 16, textAlign: 'center' }}>No sport configured yet</Text>
      <Text style={{ color: muted, fontSize: 13, textAlign: 'center' }}>Host can set up teams, fixtures and live scoring.</Text>
      {isHost && (
        <TouchableOpacity onPress={() => setSetupVisible(true)}
          style={{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, backgroundColor: primary }}>
          <Text style={{ color: '#000', fontWeight: '900', fontSize: 14 }}>🏆 Setup Sport Event</Text>
        </TouchableOpacity>
      )}
      <SportEventSetupModal visible={setupVisible} onClose={() => setSetupVisible(false)}
        eventId={eventId} onSetupComplete={() => { setSetupVisible(false); load(); }}
        primary={primary} bg={bg} textColor={textColor} muted={muted} />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* Sport header */}
      <View style={[sd.sportHeader, { backgroundColor: `${sportMeta.color || primary}12`, borderColor: `${sportMeta.color || primary}25` }]}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 22 }}>{sportMeta.icon}</Text>
            <Text style={{ color: sportMeta.color || primary, fontWeight: '900', fontSize: 15 }}>{sportMeta.name}</Text>
          </View>
          <Text style={{ color: muted, fontSize: 11, marginTop: 2 }}>
            {config.format?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} ·{' '}
            {fixtures.length} match{fixtures.length !== 1 ? 'es' : ''}
            {liveMatches.length > 0 ? ` · ${liveMatches.length} LIVE 🔴` : ''}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {user && (
            <TouchableOpacity onPress={handleFollow}
              style={[sd.actionBtn, { backgroundColor: followData ? `${primary}20` : primary, borderColor: primary }]}>
              <Feather name={followData ? 'bell-off' : 'bell'} size={13} color={followData ? primary : '#000'} />
              <Text style={{ color: followData ? primary : '#000', fontSize: 11, fontWeight: '800' }}>
                {followData ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          )}
          {isHost && (
            <TouchableOpacity onPress={() => setSetupVisible(true)}
              style={[sd.actionBtn, { backgroundColor: `${primary}15`, borderColor: `${primary}30` }]}>
              <Feather name="settings" size={13} color={primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Live match alert */}
      {liveMatches.map(m => (
        <TouchableOpacity key={m.id} onPress={() => { setSelectedMatch(m); setLoggerVisible(true); }}
          style={[sd.liveAlert, { borderColor: '#ef4444' }]}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' }} />
          <Text style={{ color: '#ef4444', fontWeight: '900', fontSize: 12, flex: 1 }}>
            🔴 LIVE: {m.home_team?.name} {m.home_score}–{m.away_score} {m.away_team?.name}
            {m.current_minute > 0 ? ` (${m.current_minute}')` : ''}
          </Text>
          <Feather name="chevron-right" size={14} color="#ef4444" />
        </TouchableOpacity>
      ))}

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ borderBottomWidth: 1, borderBottomColor: `${primary}15` }}
        contentContainerStyle={{ paddingHorizontal: 16 }}>
        {[
          { key: 'fixtures', label: 'Fixtures', icon: 'calendar' },
          isTeamSport ? { key: 'table', label: 'Table', icon: 'list' } : { key: 'results', label: 'Results', icon: 'award' },
          { key: 'scorers', label: 'Stats', icon: 'star' },
          { key: 'photos', label: 'Photos', icon: 'camera' },
        ].map(t => {
          const active = tab === t.key;
          return (
            <TouchableOpacity key={t.key} onPress={() => setTab(t.key)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 10, paddingHorizontal: 4, marginRight: 20, borderBottomWidth: 2, borderBottomColor: active ? primary : 'transparent' }}>
              <Feather name={t.icon} size={12} color={active ? primary : muted} />
              <Text style={{ color: active ? primary : muted, fontWeight: '800', fontSize: 12 }}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={primary} />}
      >

        {/* FIXTURES TAB */}
        {tab === 'fixtures' && (
          <View style={{ padding: 16 }}>
            {/* Filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'live', label: '🔴 Live' },
                  { key: 'scheduled', label: 'Upcoming' },
                  { key: 'completed', label: 'Results' },
                ].map(f => {
                  const active = filterStatus === f.key;
                  return (
                    <TouchableOpacity key={f.key} onPress={() => setFilterStatus(f.key)}
                      style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
                               borderColor: active ? primary : `${primary}25`,
                               backgroundColor: active ? `${primary}20` : 'transparent' }}>
                      <Text style={{ color: active ? primary : muted, fontWeight: '800', fontSize: 11 }}>{f.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {isHost && (
              <TouchableOpacity
                onPress={async () => {
                  const teams = await TeamManager.list(eventId);
                  if (teams.length < 2) { Alert.alert('Need teams', 'Add at least 2 teams in Sport Setup first.'); return; }
                  setSelectedMatch(null);
                  setLoggerVisible(true);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: `${primary}30`, backgroundColor: `${primary}08`, marginBottom: 12 }}>
                <Feather name="plus" size={14} color={primary} />
                <Text style={{ color: primary, fontWeight: '800', fontSize: 12 }}>Add / Edit Fixture</Text>
              </TouchableOpacity>
            )}

            {filteredFixtures.length === 0 ? (
              <View style={{ paddingVertical: 32, alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 32 }}>📅</Text>
                <Text style={{ color: muted, fontSize: 13, textAlign: 'center' }}>
                  No {filterStatus === 'all' ? '' : filterStatus} fixtures yet.
                </Text>
              </View>
            ) : filteredFixtures.map(m => (
              <MatchCard
                key={m.id}
                match={m}
                isHost={isHost}
                onPress={() => { setSelectedMatch(m); setLoggerVisible(true); }}
                primary={primary} textColor={textColor} muted={muted} bg={bg}
              />
            ))}
          </View>
        )}

        {/* TABLE TAB */}
        {tab === 'table' && (
          <View style={{ paddingTop: 8 }}>
            <SportLeagueTable
              eventId={eventId}
              primary={primary} bg={bg} textColor={textColor} muted={muted}
            />
          </View>
        )}

        {/* INDIVIDUAL RESULTS TAB */}
        {tab === 'results' && (
          <View style={{ padding: 16 }}>
            {/* Discipline selector */}
            {disciplines.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {disciplines.map(d => {
                    const active = activeDiscipline === d;
                    return (
                      <TouchableOpacity key={d} onPress={() => setActiveDiscipline(d)}
                        style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
                                 borderColor: active ? primary : `${primary}25`,
                                 backgroundColor: active ? `${primary}20` : 'transparent' }}>
                        <Text style={{ color: active ? primary : muted, fontWeight: '800', fontSize: 11 }}>{d}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            {/* Results table */}
            {/* Header */}
            <View style={{ flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: `${primary}20`, marginBottom: 4 }}>
              <Text style={{ width: 28, color: muted, fontSize: 10, fontWeight: '700' }}>#</Text>
              <Text style={{ flex: 1, color: muted, fontSize: 10, fontWeight: '700' }}>Athlete</Text>
              <Text style={{ width: 80, color: muted, fontSize: 10, fontWeight: '700', textAlign: 'right' }}>Result</Text>
              <Text style={{ width: 40, color: muted, fontSize: 10, fontWeight: '700', textAlign: 'right' }}>Status</Text>
            </View>

            {individualResults
              .filter(r => !activeDiscipline || r.discipline === activeDiscipline)
              .map((r, i) => {
                const athlete = r.sport_athletes;
                const resultText = r.result_time || (r.result_distance ? `${r.result_distance}m` : r.result_score != null ? String(r.result_score) : '—');
                return (
                  <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${primary}10` }}>
                    <Text style={{ width: 28, color: r.finish_position === 1 ? '#f59e0b' : muted, fontWeight: '900', fontSize: 12 }}>
                      {r.finish_position || i + 1}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: textColor, fontWeight: '700', fontSize: 12 }}>{athlete?.name || r.athlete_id}</Text>
                      {athlete?.nationality && <Text style={{ color: muted, fontSize: 10 }}>{athlete.nationality}</Text>}
                    </View>
                    <Text style={{ width: 80, color: r.is_personal_best ? '#f59e0b' : r.is_record ? primary : textColor, fontWeight: r.is_record ? '900' : '700', fontSize: 13, textAlign: 'right' }}>
                      {resultText}
                    </Text>
                    <Text style={{ width: 40, textAlign: 'right', fontSize: 10, fontWeight: '700',
                                   color: r.status === 'dq' ? '#ef4444' : r.status === 'pb' ? '#f59e0b' : muted }}>
                      {r.status?.toUpperCase() || ''}
                    </Text>
                  </View>
                );
              })}
          </View>
        )}

        {/* STATS TAB */}
        {tab === 'scorers' && (
          <View style={{ padding: 16 }}>
            {performers.length === 0 ? (
              <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                <Text style={{ color: muted, fontSize: 13 }}>No stats yet. Stats update after matches.</Text>
              </View>
            ) : (
              Object.entries(
                performers.reduce((acc, p) => {
                  if (!acc[p.category]) acc[p.category] = [];
                  acc[p.category].push(p);
                  return acc;
                }, {})
              ).map(([cat, items]) => (
                <View key={cat} style={{ marginBottom: 20 }}>
                  <Text style={{ color: primary, fontWeight: '900', fontSize: 12, letterSpacing: 0.5, marginBottom: 8 }}>
                    {cat.replace(/_/g, ' ').toUpperCase()}
                  </Text>
                  {items.slice(0, 8).map((p, i) => (
                    <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <Text style={{ color: i === 0 ? '#f59e0b' : muted, fontWeight: '900', width: 20, fontSize: 12 }}>{p.position}</Text>
                      {p.player_photo
                        ? <Image source={{ uri: p.player_photo }} style={{ width: 28, height: 28, borderRadius: 14 }} />
                        : <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: `${primary}20`, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: primary, fontSize: 11, fontWeight: '900' }}>{(p.player_name || '?')[0].toUpperCase()}</Text>
                          </View>
                      }
                      <Text style={{ color: textColor, fontWeight: '700', fontSize: 13, flex: 1 }}>{p.player_name}</Text>
                      <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: `${primary}20` }}>
                        <Text style={{ color: primary, fontWeight: '900', fontSize: 14 }}>{p.value}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ))
            )}
          </View>
        )}

        {/* PHOTOS TAB */}
        {tab === 'photos' && (
          <View style={{ padding: 16 }}>
            {media.length === 0 ? (
              <View style={{ paddingVertical: 32, alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 32 }}>📸</Text>
                <Text style={{ color: muted, fontSize: 13, textAlign: 'center' }}>No match photos yet. Upload from the event gallery.</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
                {media.map(m => (
                  <TouchableOpacity key={m.id} style={{ width: '32.5%', aspectRatio: 1, borderRadius: 6, overflow: 'hidden' }}>
                    <Image source={{ uri: m.media_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* LiveMatchLogger modal */}
      {selectedMatch && (
        <LiveMatchLogger
          matchId={selectedMatch.id}
          eventId={eventId}
          visible={loggerVisible}
          onClose={() => { setLoggerVisible(false); setSelectedMatch(null); load(true); }}
          primary={primary} bg={bg} textColor={textColor} muted={muted}
        />
      )}

      {/* SportEventSetupModal */}
      <SportEventSetupModal
        visible={setupVisible}
        onClose={() => setSetupVisible(false)}
        eventId={eventId}
        onSetupComplete={() => { setSetupVisible(false); load(); }}
        primary={primary} bg={bg} textColor={textColor} muted={muted}
      />
    </View>
  );
};

const sd = StyleSheet.create({
  sportHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, marginHorizontal: 16, marginVertical: 10, borderRadius: 16, borderWidth: 1 },
  actionBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  liveAlert:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, marginHorizontal: 16, marginBottom: 6, borderRadius: 12, borderWidth: 1.5, backgroundColor: 'rgba(239,68,68,0.06)' },
});

const mc = StyleSheet.create({
  card:       { marginBottom: 10, padding: 14, borderRadius: 16, borderWidth: 1 },
  roundPill:  { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  teamBlock:  { flex: 1, alignItems: 'center', gap: 6 },
  teamLogo:   { width: 44, height: 44 },
  teamName:   { fontSize: 12, fontWeight: '800', textAlign: 'center', lineHeight: 15 },
  scoreBlock: { flex: 0.8, alignItems: 'center', gap: 3 },
  score:      { fontSize: 26, fontWeight: '900' },
});

export default SportDashboard;
