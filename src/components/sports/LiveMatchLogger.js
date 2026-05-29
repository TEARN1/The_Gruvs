/**
 * LiveMatchLogger
 *
 * Real-time match management panel for event hosts.
 * - Score controls (+ / -)
 * - Match event logging (goals, cards, subs, tries, etc.)
 * - Match status controls (kick off, half-time, full time)
 * - Commentary posting
 * - Adapts to sport type via SPORT_REGISTRY
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, Modal, ActivityIndicator, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  MatchManager, MatchEventManager, CommentaryManager,
  StatsManager, SportConfig, SPORT_REGISTRY,
} from '../../services/sportsEngine';
import { useAuth } from '../../context/AuthContext';

const EVENT_ICONS = {
  goal: '⚽', own_goal: '😅', yellow_card: '🟨', red_card: '🟥',
  substitution: '🔄', penalty_kick: '🥅', penalty_miss: '❌',
  try: '🏉', conversion: '🎯', drop_goal: '🏈',
  basket_2pt: '🏀', basket_3pt: '💫', free_throw: '🎯',
  wicket: '🏏', boundary_4: '4️⃣', boundary_6: '6️⃣',
  ace: '🎾', foul: '🚨', ko: '🥊', tko: '🏳️',
  injury: '🩹', var_review: '📺', substitution_on: '↑', substitution_off: '↓',
  point: '🔵', whistle: '📣',
};

function ScoreDisplay({ match, sportMeta, primary, textColor, muted, onHomeChange, onAwayChange }) {
  const homeName = match.home_team?.short_name || match.home_team?.name || 'Home';
  const awayName = match.away_team?.short_name || match.away_team?.name || 'Away';

  return (
    <View style={[lm.scoreboard, { borderColor: `${primary}30` }]}>
      {/* Home */}
      <View style={lm.teamScoreBlock}>
        <Text style={[lm.teamScoreName, { color: textColor }]} numberOfLines={1}>{homeName}</Text>
        <View style={lm.scoreControls}>
          <TouchableOpacity style={[lm.scoreBtn, { backgroundColor: `${primary}20` }]}
            onPress={() => onHomeChange(-1)}>
            <Feather name="minus" size={16} color={primary} />
          </TouchableOpacity>
          <Text style={[lm.scoreNum, { color: primary }]}>{match.home_score || 0}</Text>
          <TouchableOpacity style={[lm.scoreBtn, { backgroundColor: primary }]}
            onPress={() => onHomeChange(1)}>
            <Feather name="plus" size={16} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Center */}
      <View style={lm.scoreCenter}>
        <Text style={[lm.scoreDash, { color: muted }]}>VS</Text>
        <View style={[lm.statusPill, {
          backgroundColor: match.status === 'live' ? '#ef4444' :
                           match.status === 'half_time' ? '#f59e0b' :
                           match.status === 'completed' ? '#10b981' : `${primary}20`,
        }]}>
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>
            {match.status === 'live' ? `${match.current_minute || 0}'` :
             match.status === 'half_time' ? 'HT' :
             match.status === 'completed' ? 'FT' :
             match.status === 'scheduled' ? 'SOON' : match.status?.toUpperCase()}
          </Text>
        </View>
        <Text style={{ color: muted, fontSize: 10 }}>
          {sportMeta.period_label} {match.current_period || 1}
        </Text>
      </View>

      {/* Away */}
      <View style={lm.teamScoreBlock}>
        <Text style={[lm.teamScoreName, { color: textColor }]} numberOfLines={1}>{awayName}</Text>
        <View style={lm.scoreControls}>
          <TouchableOpacity style={[lm.scoreBtn, { backgroundColor: `${primary}20` }]}
            onPress={() => onAwayChange(-1)}>
            <Feather name="minus" size={16} color={primary} />
          </TouchableOpacity>
          <Text style={[lm.scoreNum, { color: primary }]}>{match.away_score || 0}</Text>
          <TouchableOpacity style={[lm.scoreBtn, { backgroundColor: primary }]}
            onPress={() => onAwayChange(1)}>
            <Feather name="plus" size={16} color="#000" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export const LiveMatchLogger = ({
  matchId, eventId, visible, onClose,
  primary = '#00f2ff', bg = '#0d1112', textColor = '#fff', muted = 'rgba(255,255,255,0.5)',
}) => {
  const [match, setMatch] = useState(null);
  const [config, setConfig] = useState(null);
  const [events, setEvents] = useState([]);
  const [commentary, setCommentary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Event log form
  const [logForm, setLogForm] = useState({ type: '', team: 'home', playerName: '', minute: '', assistName: '' });
  const [commentText, setCommentText] = useState('');
  const [tab, setTab] = useState('score'); // score|events|commentary|result

  const load = useCallback(async () => {
    if (!matchId) return;
    try {
      const [matchData, configData, eventsData, commData] = await Promise.all([
        MatchManager.getMatch(matchId),
        SportConfig.get(eventId),
        MatchEventManager.list(matchId),
        CommentaryManager.list(matchId, 30),
      ]);
      setMatch(matchData);
      setConfig(configData);
      setEvents(eventsData);
      setCommentary(commData);
    } catch (e) {
      console.warn('[LiveMatchLogger] load error:', e.message);
    } finally {
      setLoading(false);
    }
  }, [matchId, eventId]);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  // Realtime
  useEffect(() => {
    if (!visible || !matchId) return;
    const unsub = CommentaryManager.subscribeToMatch(matchId, (entry) => {
      setCommentary(prev => [...prev, entry]);
    });
    return unsub;
  }, [visible, matchId]);

  const sportMeta = SPORT_REGISTRY[config?.sport_type] || SPORT_REGISTRY.soccer;
  const { user: authUser } = useAuth();

  const handleScoreChange = async (side, delta) => {
    if (!match) return;
    const newHome = Math.max(0, match.home_score + (side === 'home' ? delta : 0));
    const newAway = Math.max(0, match.away_score + (side === 'away' ? delta : 0));
    setSaving(true);
    try {
      const updated = await MatchManager.updateScore(matchId, newHome, newAway, match.current_minute);
      setMatch(prev => ({ ...prev, ...updated }));
    } finally { setSaving(false); }
  };

  const handleKickOff = async () => {
    setSaving(true);
    try {
      const updated = await MatchManager.kickOff(matchId);
      setMatch(prev => ({ ...prev, ...updated }));
    } finally { setSaving(false); }
  };

  const handleHalfTime = async () => {
    setSaving(true);
    try {
      const updated = match.status === 'half_time'
        ? await MatchManager.resumeFromHalfTime(matchId)
        : await MatchManager.setHalfTime(matchId);
      setMatch(prev => ({ ...prev, ...updated }));
    } finally { setSaving(false); }
  };

  const handleFullTime = async () => {
    Alert.alert('End Match', `Confirm final score: ${match.home_team?.name || 'Home'} ${match.home_score} – ${match.away_score} ${match.away_team?.name || 'Away'}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm Full Time', style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            const updated = await MatchManager.submitResult(
              matchId, match.home_score, match.away_score,
              { home_team_id: match.home_team_id, away_team_id: match.away_team_id }
            );
            setMatch(prev => ({ ...prev, ...updated }));
            await StatsManager.recomputeTopScorers(eventId);
          } finally { setSaving(false); }
        },
      },
    ]);
  };

  const handleLogEvent = async () => {
    if (!logForm.type) return;
    const isHome = logForm.team === 'home';
    const teamId = isHome ? match.home_team_id : match.away_team_id;
    setSaving(true);
    try {
      const entry = {
        event_type: logForm.type,
        team_id: teamId,
        player_name: logForm.playerName.trim() || null,
        assist_name: logForm.assistName.trim() || null,
        minute: logForm.minute ? parseInt(logForm.minute, 10) : match.current_minute || null,
        period: match.current_period || 1,
        score_home: match.home_score,
        score_away: match.away_score,
      };

      const logged = await MatchEventManager.log(matchId, eventId, entry);
      setEvents(prev => [...prev, logged]);

      // Auto-increment score for scoring events
      const isGoalType = ['goal', 'try', 'basket_2pt', 'basket_3pt'].includes(logForm.type);
      if (isGoalType) {
        const newHome = match.home_score + (isHome ? 1 : 0);
        const newAway = match.away_score + (!isHome ? 1 : 0);
        const updated = await MatchManager.updateScore(matchId, newHome, newAway, entry.minute);
        setMatch(prev => ({ ...prev, ...updated }));

        // Post auto commentary
        await CommentaryManager.post(matchId, eventId, authUser?.id || null, {
          minute: entry.minute,
          type: 'goal',
          body: `${EVENT_ICONS[logForm.type] || '⚽'} GOAL! ${logForm.playerName || 'Player'} (${isHome ? match.home_team?.name : match.away_team?.name}) — ${newHome}–${newAway}`,
        });
      }

      setLogForm({ type: '', team: 'home', playerName: '', minute: String(match.current_minute || ''), assistName: '' });
    } finally { setSaving(false); }
  };

  const handlePostCommentary = async () => {
    if (!commentText.trim()) return;
    setSaving(true);
    try {
      const entry = await CommentaryManager.post(matchId, eventId, authUser?.id || null, {
        minute: match.current_minute,
        type: 'update',
        body: commentText.trim(),
      });
      setCommentary(prev => [...prev, entry]);
      setCommentText('');
    } finally { setSaving(false); }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[lm.overlay]}>
        <View style={[lm.sheet, { backgroundColor: bg, borderColor: `${primary}25` }]}>
          <View style={[lm.pill, { backgroundColor: `${primary}50` }]} />

          {/* Header */}
          <View style={lm.header}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: primary, fontWeight: '900', fontSize: 16 }}>
                {sportMeta.icon} MATCH CONTROL
              </Text>
              <Text style={{ color: muted, fontSize: 11 }}>
                {match?.home_team?.name || '?'} vs {match?.away_team?.name || '?'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={textColor} /></TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={primary} size="large" />
            </View>
          ) : !match ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: muted }}>Match not found.</Text>
            </View>
          ) : (
            <>
              {/* Scoreboard */}
              <ScoreDisplay
                match={match} sportMeta={sportMeta} primary={primary} textColor={textColor} muted={muted}
                onHomeChange={(d) => handleScoreChange('home', d)}
                onAwayChange={(d) => handleScoreChange('away', d)}
              />

              {/* Status buttons */}
              <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 }}>
                {match.status === 'scheduled' && (
                  <TouchableOpacity style={[lm.statusBtn, { backgroundColor: '#10b981', flex: 1 }]} onPress={handleKickOff}>
                    <Feather name="play" size={14} color="#fff" />
                    <Text style={lm.statusBtnText}>Kick Off</Text>
                  </TouchableOpacity>
                )}
                {match.status === 'live' && (
                  <TouchableOpacity style={[lm.statusBtn, { backgroundColor: '#f59e0b', flex: 1 }]} onPress={handleHalfTime}>
                    <Feather name="pause" size={14} color="#fff" />
                    <Text style={lm.statusBtnText}>Half Time</Text>
                  </TouchableOpacity>
                )}
                {match.status === 'half_time' && (
                  <TouchableOpacity style={[lm.statusBtn, { backgroundColor: '#10b981', flex: 1 }]} onPress={handleHalfTime}>
                    <Feather name="play" size={14} color="#fff" />
                    <Text style={lm.statusBtnText}>2nd Half</Text>
                  </TouchableOpacity>
                )}
                {['live', 'half_time'].includes(match.status) && (
                  <TouchableOpacity style={[lm.statusBtn, { backgroundColor: '#ef4444', flex: 1 }]} onPress={handleFullTime}>
                    <Feather name="square" size={14} color="#fff" />
                    <Text style={lm.statusBtnText}>Full Time</Text>
                  </TouchableOpacity>
                )}
                {saving && <ActivityIndicator color={primary} style={{ alignSelf: 'center' }} />}
              </View>

              {/* Tabs */}
              <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: `${primary}15`, marginBottom: 2 }}>
                {[
                  { key: 'events', label: 'Log Event', icon: 'edit-2' },
                  { key: 'commentary', label: 'Commentary', icon: 'message-circle' },
                  { key: 'timeline', label: 'Timeline', icon: 'clock' },
                ].map(t => {
                  const active = tab === t.key;
                  return (
                    <TouchableOpacity key={t.key} onPress={() => setTab(t.key)}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: active ? primary : 'transparent' }}>
                      <Feather name={t.icon} size={12} color={active ? primary : muted} />
                      <Text style={{ color: active ? primary : muted, fontSize: 11, fontWeight: '800' }}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">

                {/* LOG EVENT TAB */}
                {tab === 'events' && (
                  <View style={{ padding: 16, gap: 10 }}>
                    <Text style={{ color: muted, fontSize: 11, fontWeight: '700', marginBottom: 2 }}>EVENT TYPE</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {(sportMeta.event_types || []).map(type => {
                          const active = logForm.type === type;
                          return (
                            <TouchableOpacity key={type}
                              onPress={() => setLogForm(f => ({ ...f, type }))}
                              style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: active ? primary : `${primary}30`, backgroundColor: active ? `${primary}20` : 'transparent', flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              <Text style={{ fontSize: 12 }}>{EVENT_ICONS[type] || '🔵'}</Text>
                              <Text style={{ color: active ? primary : muted, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' }}>
                                {type.replace(/_/g, ' ')}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>

                    {/* Team selector */}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {['home', 'away'].map(side => (
                        <TouchableOpacity key={side} onPress={() => setLogForm(f => ({ ...f, team: side }))}
                          style={{ flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignItems: 'center',
                                   borderColor: logForm.team === side ? primary : `${primary}25`,
                                   backgroundColor: logForm.team === side ? `${primary}18` : 'transparent' }}>
                          <Text style={{ color: logForm.team === side ? primary : muted, fontWeight: '800', fontSize: 12 }}>
                            {side === 'home' ? match.home_team?.name || 'Home' : match.away_team?.name || 'Away'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Player + minute */}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TextInput
                        style={[lm.input, { flex: 1, color: textColor, borderColor: `${primary}30` }]}
                        placeholder="Player name" placeholderTextColor={muted}
                        value={logForm.playerName}
                        onChangeText={v => setLogForm(f => ({ ...f, playerName: v }))}
                      />
                      <TextInput
                        style={[lm.input, { width: 70, color: textColor, borderColor: `${primary}30`, textAlign: 'center' }]}
                        placeholder="Min'" placeholderTextColor={muted}
                        value={logForm.minute}
                        onChangeText={v => setLogForm(f => ({ ...f, minute: v }))}
                        keyboardType="numeric"
                      />
                    </View>

                    {/* Assist (for goals) */}
                    {['goal', 'try'].includes(logForm.type) && (
                      <TextInput
                        style={[lm.input, { color: textColor, borderColor: `${primary}25` }]}
                        placeholder="Assist by (optional)" placeholderTextColor={muted}
                        value={logForm.assistName}
                        onChangeText={v => setLogForm(f => ({ ...f, assistName: v }))}
                      />
                    )}

                    <TouchableOpacity
                      onPress={handleLogEvent}
                      disabled={!logForm.type || saving}
                      style={{ paddingVertical: 13, borderRadius: 12, backgroundColor: logForm.type ? primary : `${primary}30`, alignItems: 'center' }}>
                      <Text style={{ color: logForm.type ? '#000' : muted, fontWeight: '900', fontSize: 13 }}>
                        {saving ? 'Logging...' : `LOG ${(logForm.type || 'EVENT').replace(/_/g, ' ').toUpperCase()}`}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* COMMENTARY TAB */}
                {tab === 'commentary' && (
                  <View style={{ padding: 16 }}>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                      <TextInput
                        style={[lm.input, { flex: 1, color: textColor, borderColor: `${primary}30` }]}
                        placeholder="Add commentary..." placeholderTextColor={muted}
                        value={commentText}
                        onChangeText={setCommentText}
                        multiline
                      />
                      <TouchableOpacity
                        onPress={handlePostCommentary}
                        disabled={!commentText.trim() || saving}
                        style={{ width: 44, backgroundColor: commentText.trim() ? primary : `${primary}20`, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
                        <Feather name="send" size={16} color={commentText.trim() ? '#000' : muted} />
                      </TouchableOpacity>
                    </View>

                    {commentary.map((c, i) => (
                      <View key={c.id || i} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                        <Text style={{ color: primary, fontSize: 11, fontWeight: '900', minWidth: 28 }}>
                          {c.minute ? `${c.minute}'` : '—'}
                        </Text>
                        <Text style={{ color: textColor, fontSize: 12, flex: 1, lineHeight: 18 }}>{c.body}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* TIMELINE TAB */}
                {tab === 'timeline' && (
                  <View style={{ padding: 16 }}>
                    {events.length === 0 ? (
                      <Text style={{ color: muted, fontSize: 13, textAlign: 'center', paddingVertical: 20 }}>No events logged yet.</Text>
                    ) : [...events].reverse().map((e, i) => (
                      <View key={e.id || i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${primary}15` }}>
                        <Text style={{ fontSize: 18 }}>{EVENT_ICONS[e.event_type] || '🔵'}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: textColor, fontWeight: '700', fontSize: 12 }}>
                            {e.event_type.replace(/_/g, ' ').toUpperCase()}
                            {e.player_name ? ` — ${e.player_name}` : ''}
                          </Text>
                          {e.assist_name && <Text style={{ color: muted, fontSize: 11 }}>Assist: {e.assist_name}</Text>}
                          {(e.score_home != null && e.score_away != null) && (
                            <Text style={{ color: primary, fontSize: 11, fontWeight: '700' }}>
                              {e.score_home}–{e.score_away}
                            </Text>
                          )}
                        </View>
                        <Text style={{ color: muted, fontSize: 11 }}>
                          {e.minute != null ? `${e.minute}'` : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={{ height: 32 }} />
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const lm = StyleSheet.create({
  overlay:     { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' },
  sheet:       { height: '92%', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, paddingTop: 10, overflow: 'hidden' },
  pill:        { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 },
  scoreboard:  { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  teamScoreBlock: { flex: 1, alignItems: 'center', gap: 8 },
  teamScoreName: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
  scoreControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scoreBtn:    { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  scoreNum:    { fontSize: 32, fontWeight: '900', minWidth: 40, textAlign: 'center' },
  scoreCenter: { alignItems: 'center', gap: 4 },
  scoreDash:   { fontSize: 11, fontWeight: '900' },
  statusPill:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, justifyContent: 'center' },
  statusBtnText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  input:       { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
});

export default LiveMatchLogger;
