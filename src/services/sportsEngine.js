/**
 * The Gruvs — SportsEngine
 *
 * Universal sports data management for every competitive event type.
 * Handles: soccer, rugby, basketball, cricket, athletics, tennis,
 *          boxing, volleyball, netball, swimming, golf, motorsport,
 *          cycling, esports, chess, darts — and any custom sport.
 *
 * Architecture:
 *   SportConfig  — event-level sport type + rules
 *   TeamManager  — CRUD for teams, rosters
 *   MatchManager — fixture creation, live scoring, result submission
 *   TableManager — league table reads + manual recompute trigger
 *   StatsManager — top performers, player stats, records
 *   MediaManager — match photos/videos
 *   CommentaryManager — live text commentary
 *   FollowerManager   — follow tournament, choose favourite team
 */

import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────────────────────
// SPORT REGISTRY — drives UI rendering and scoring rules per sport
// ─────────────────────────────────────────────────────────────────────────────

export const SPORT_REGISTRY = {
  soccer: {
    name: 'Soccer / Football', icon: '⚽', color: '#10b981',
    team_sport: true, individual_sport: false,
    scoring_unit: 'goals', default_periods: 2, period_label: 'Half',
    period_duration: 45, extra_time: true, penalties: true,
    event_types: ['goal','own_goal','yellow_card','red_card','substitution','penalty_kick','penalty_miss','var_review','free_kick','corner','offside','injury'],
    table_columns: ['P','W','D','L','GF','GA','GD','Pts'],
    stats_categories: ['top_scorers','top_assists','clean_sheets','most_goals_conceded'],
    match_data_template: { home_shots: 0, away_shots: 0, home_possession: 50, away_possession: 50, home_corners: 0, away_corners: 0 },
  },
  rugby: {
    name: 'Rugby Union', icon: '🏉', color: '#f59e0b',
    team_sport: true, individual_sport: false,
    scoring_unit: 'points', default_periods: 2, period_label: 'Half',
    period_duration: 40, extra_time: true, penalties: false,
    event_types: ['try','conversion','penalty_kick','drop_goal','yellow_card','red_card','scrum','lineout'],
    table_columns: ['P','W','D','L','PF','PA','PD','BP','Pts'],
    stats_categories: ['top_try_scorers','top_point_scorers'],
    match_data_template: { home_tries: 0, away_tries: 0, home_conversions: 0, away_conversions: 0, home_penalties: 0, away_penalties: 0, home_drop_goals: 0, away_drop_goals: 0 },
  },
  basketball: {
    name: 'Basketball', icon: '🏀', color: '#f97316',
    team_sport: true, individual_sport: false,
    scoring_unit: 'points', default_periods: 4, period_label: 'Quarter',
    period_duration: 10, extra_time: true, penalties: false,
    event_types: ['basket_2pt','basket_3pt','free_throw','foul','technical_foul','timeout','substitution'],
    table_columns: ['P','W','L','PF','PA','PD','Pts'],
    stats_categories: ['top_scorers','top_rebounders','top_assist'],
    match_data_template: { q1_home: 0, q1_away: 0, q2_home: 0, q2_away: 0, q3_home: 0, q3_away: 0, q4_home: 0, q4_away: 0 },
  },
  cricket: {
    name: 'Cricket', icon: '🏏', color: '#84cc16',
    team_sport: true, individual_sport: false,
    scoring_unit: 'runs', default_periods: 2, period_label: 'Innings',
    period_duration: 0, extra_time: false, penalties: false,
    event_types: ['wicket','boundary_4','boundary_6','wide','no_ball','leg_bye','bye','run_out'],
    table_columns: ['P','W','L','T','NR','Pts','NRR'],
    stats_categories: ['top_batsmen','top_bowlers','top_wicket_takers'],
    match_data_template: {
      innings1: { team_id: null, total: 0, wickets: 0, overs: 0, extras: 0, batsmen: [], bowlers: [] },
      innings2: { team_id: null, total: 0, wickets: 0, overs: 0, extras: 0, batsmen: [], bowlers: [] },
    },
  },
  athletics: {
    name: 'Athletics', icon: '🏃', color: '#06b6d4',
    team_sport: false, individual_sport: true,
    scoring_unit: 'time/distance/height', default_periods: 1, period_label: 'Round',
    disciplines: ['100m','200m','400m','800m','1500m','3000m','5000m','10000m','110m Hurdles','400m Hurdles','3000m Steeplechase','High Jump','Long Jump','Triple Jump','Pole Vault','Shot Put','Discus','Javelin','Hammer','Decathlon','Heptathlon','4×100m Relay','4×400m Relay','Marathon','Half Marathon','5km Road Race'],
    event_types: ['sprint_start','finish','false_start','dq','pb','record'],
    stats_categories: ['event_results','personal_bests','records'],
  },
  tennis: {
    name: 'Tennis', icon: '🎾', color: '#a3e635',
    team_sport: false, individual_sport: true,
    scoring_unit: 'sets', default_periods: 3, period_label: 'Set',
    event_types: ['ace','double_fault','winner','unforced_error','break_point','tiebreak'],
    stats_categories: ['aces','winners','unforced_errors','break_points'],
    match_data_template: { sets: [], current_set: 1, player1_service: true },
  },
  boxing: {
    name: 'Boxing / MMA', icon: '🥊', color: '#ef4444',
    team_sport: false, individual_sport: true,
    scoring_unit: 'rounds', default_periods: 12, period_label: 'Round',
    period_duration: 3,
    event_types: ['knockdown','ko','tko','submission','point_deduction','low_blow','clinch'],
    stats_categories: ['knockdowns','punches_thrown','punches_landed'],
    match_data_template: { weight_class: '', rounds_completed: 0, judge_scores: [] },
  },
  volleyball: {
    name: 'Volleyball', icon: '🏐', color: '#8b5cf6',
    team_sport: true, individual_sport: false,
    scoring_unit: 'sets', default_periods: 5, period_label: 'Set',
    event_types: ['point','ace_serve','spike','block','substitution'],
    table_columns: ['P','W','L','SW','SL','SR','Pts'],
    match_data_template: { sets: [] },
  },
  netball: {
    name: 'Netball', icon: '🥅', color: '#ec4899',
    team_sport: true, individual_sport: false,
    scoring_unit: 'goals', default_periods: 4, period_label: 'Quarter',
    period_duration: 15,
    event_types: ['goal','substitution','injury_time'],
    table_columns: ['P','W','D','L','GF','GA','GD','Pts'],
    stats_categories: ['top_scorers'],
  },
  swimming: {
    name: 'Swimming', icon: '🏊', color: '#0ea5e9',
    team_sport: false, individual_sport: true,
    scoring_unit: 'time',
    disciplines: ['50m Freestyle','100m Freestyle','200m Freestyle','400m Freestyle','800m Freestyle','1500m Freestyle','50m Backstroke','100m Backstroke','200m Backstroke','50m Breaststroke','100m Breaststroke','200m Breaststroke','50m Butterfly','100m Butterfly','200m Butterfly','200m IM','400m IM','4×100m Freestyle Relay','4×200m Freestyle Relay','4×100m Medley Relay'],
    event_types: ['heat_result','false_start','dq','pb','record'],
    stats_categories: ['event_results','records'],
  },
  golf: {
    name: 'Golf', icon: '⛳', color: '#16a34a',
    team_sport: false, individual_sport: true,
    scoring_unit: 'strokes', default_periods: 4, period_label: 'Round',
    event_types: ['eagle','birdie','par','bogey','double_bogey','hole_in_one','lost_ball'],
    stats_categories: ['leaderboard','eagles','birdies','fairways_hit','greens_in_reg'],
    match_data_template: { rounds: [], par: 72, holes: 18 },
  },
  motorsport: {
    name: 'Motorsport', icon: '🏎️', color: '#dc2626',
    team_sport: false, individual_sport: true,
    scoring_unit: 'time/position',
    event_types: ['fastest_lap','pit_stop','safety_car','collision','retirement','dnf','pole_position'],
    stats_categories: ['race_results','qualifying','championship_standings','fastest_laps'],
    match_data_template: { race_laps: 0, qualifying: [], race_results: [] },
  },
  cycling: {
    name: 'Cycling', icon: '🚴', color: '#0891b2',
    team_sport: false, individual_sport: true,
    scoring_unit: 'time',
    disciplines: ['Road Race','Time Trial','Criterium','Hill Climb','Track Sprint','Track Pursuit','BMX'],
    stats_categories: ['general_classification','points_classification','mountain_classification'],
  },
  esports: {
    name: 'Esports', icon: '🕹️', color: '#7c3aed',
    team_sport: true, individual_sport: true,
    scoring_unit: 'match_wins',
    disciplines: ['FIFA','Fortnite','Valorant','CS:GO','League of Legends','PUBG','Rocket League','Tekken','Mortal Kombat','Call of Duty'],
    event_types: ['round_win','ace','clutch','mvp'],
    table_columns: ['P','W','L','GW','GL','Pts'],
    stats_categories: ['top_fraggers','most_wins','mvp_awards'],
  },
  chess: {
    name: 'Chess', icon: '♟️', color: '#374151',
    team_sport: false, individual_sport: true,
    scoring_unit: 'points',
    event_types: ['win','draw','loss','timeout','resignation'],
    stats_categories: ['standings','rating_performance'],
  },
  darts: {
    name: 'Darts', icon: '🎯', color: '#be185d',
    team_sport: false, individual_sport: true,
    scoring_unit: 'legs',
    event_types: ['checkout','180','high_finish','9_darter'],
    stats_categories: ['averages','checkouts','180s'],
  },
  other: {
    name: 'Other Sport', icon: '🏅', color: '#64748b',
    team_sport: true, individual_sport: true,
    scoring_unit: 'points',
    event_types: ['point','win','loss','draw'],
    stats_categories: ['standings','results'],
  },
};

export const SPORT_KEYS = Object.keys(SPORT_REGISTRY);

// ─────────────────────────────────────────────────────────────────────────────
// SPORT CONFIG
// ─────────────────────────────────────────────────────────────────────────────

export const SportConfig = {
  async get(eventId) {
    const { data } = await supabase
      .from('event_sport_config')
      .select('*')
      .eq('event_id', eventId)
      .maybeSingle();
    return data;
  },

  async upsert(eventId, config) {
    const { data, error } = await supabase
      .from('event_sport_config')
      .upsert({ event_id: eventId, ...config, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  sportMeta(sportType) {
    return SPORT_REGISTRY[sportType] || SPORT_REGISTRY.other;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TEAM MANAGER
// ─────────────────────────────────────────────────────────────────────────────

export const TeamManager = {
  async list(eventId) {
    const { data } = await supabase
      .from('sport_teams')
      .select('*, sport_groups(name)')
      .eq('event_id', eventId)
      .order('position', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true });
    return data || [];
  },

  async create(eventId, team) {
    const { data, error } = await supabase
      .from('sport_teams')
      .insert({ event_id: eventId, ...team })
      .select()
      .single();
    if (error) throw error;
    // Ensure league table row exists
    await supabase.from('sport_league_table')
      .upsert({ event_id: eventId, team_id: data.id, group_id: team.group_id || null },
               { onConflict: 'event_id,team_id' });
    return data;
  },

  async update(teamId, updates) {
    const { data, error } = await supabase
      .from('sport_teams')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', teamId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(teamId) {
    await supabase.from('sport_teams').delete().eq('id', teamId);
  },

  async addPlayer(teamId, player) {
    const { data: team } = await supabase
      .from('sport_teams').select('players').eq('id', teamId).single();
    const players = Array.isArray(team?.players) ? team.players : [];
    const newPlayer = { id: Date.now().toString(), ...player };
    await supabase.from('sport_teams')
      .update({ players: [...players, newPlayer] })
      .eq('id', teamId);
    return newPlayer;
  },

  async removePlayer(teamId, playerId) {
    const { data: team } = await supabase
      .from('sport_teams').select('players').eq('id', teamId).single();
    const players = (team?.players || []).filter(p => p.id !== playerId);
    await supabase.from('sport_teams').update({ players }).eq('id', teamId);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ATHLETE MANAGER (individual sports)
// ─────────────────────────────────────────────────────────────────────────────

export const AthleteManager = {
  async list(eventId, groupId = null) {
    let q = supabase.from('sport_athletes').select('*').eq('event_id', eventId);
    if (groupId) q = q.eq('group_id', groupId);
    const { data } = await q.order('seed', { ascending: true, nullsFirst: false }).order('name');
    return data || [];
  },

  async create(eventId, athlete) {
    const { data, error } = await supabase
      .from('sport_athletes')
      .insert({ event_id: eventId, ...athlete })
      .select().single();
    if (error) throw error;
    return data;
  },

  async update(athleteId, updates) {
    const { data, error } = await supabase
      .from('sport_athletes').update(updates).eq('id', athleteId).select().single();
    if (error) throw error;
    return data;
  },

  async delete(athleteId) {
    await supabase.from('sport_athletes').delete().eq('id', athleteId);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MATCH MANAGER
// ─────────────────────────────────────────────────────────────────────────────

export const MatchManager = {
  async listFixtures(eventId, options = {}) {
    let q = supabase.from('sport_matches')
      .select(`*,
        home_team:home_team_id(id, name, short_name, logo_url, color1),
        away_team:away_team_id(id, name, short_name, logo_url, color1),
        sport_groups(name)
      `)
      .eq('event_id', eventId)
      .order('round_number', { ascending: true })
      .order('match_number', { ascending: true });

    if (options.status) q = q.eq('status', options.status);
    if (options.round) q = q.eq('round', options.round);
    const { data } = await q;
    return data || [];
  },

  async getMatch(matchId) {
    const { data } = await supabase.from('sport_matches')
      .select(`*,
        home_team:home_team_id(id, name, short_name, logo_url, color1, players),
        away_team:away_team_id(id, name, short_name, logo_url, color1, players),
        home_athlete:home_athlete_id(*),
        away_athlete:away_athlete_id(*)
      `)
      .eq('id', matchId)
      .single();
    return data;
  },

  async create(eventId, fixture) {
    const { data, error } = await supabase
      .from('sport_matches')
      .insert({ event_id: eventId, ...fixture })
      .select().single();
    if (error) throw error;
    return data;
  },

  async bulkCreateFixtures(eventId, fixtures) {
    const rows = fixtures.map(f => ({ event_id: eventId, ...f }));
    const { data, error } = await supabase
      .from('sport_matches').insert(rows).select();
    if (error) throw error;
    return data || [];
  },

  /** Generate a full round-robin fixture list for all teams in an event */
  generateRoundRobin(teams, baseDate, config = {}) {
    const fixtures = [];
    const n = teams.length;
    const totalRounds = n % 2 === 0 ? n - 1 : n;
    const teamsArr = [...teams];
    if (n % 2 !== 0) teamsArr.push(null); // bye placeholder

    for (let round = 0; round < totalRounds; round++) {
      for (let match = 0; match < teamsArr.length / 2; match++) {
        const home = teamsArr[match];
        const away = teamsArr[teamsArr.length - 1 - match];
        if (home && away) {
          const matchDate = baseDate ? new Date(baseDate) : null;
          if (matchDate) matchDate.setDate(matchDate.getDate() + round * 7);
          fixtures.push({
            round: `Matchday ${round + 1}`,
            round_number: round + 1,
            match_number: match + 1,
            home_team_id: home.id,
            away_team_id: away.id,
            scheduled_at: matchDate ? matchDate.toISOString() : null,
            status: 'scheduled',
          });
        }
      }
      // Rotate teams (keep first fixed)
      teamsArr.splice(1, 0, teamsArr.pop());
    }
    return fixtures;
  },

  async kickOff(matchId) {
    const { data, error } = await supabase
      .from('sport_matches')
      .update({ status: 'live', started_at: new Date().toISOString(), current_minute: 0 })
      .eq('id', matchId).select().single();
    if (error) throw error;
    return data;
  },

  async updateScore(matchId, homeScore, awayScore, minute = null) {
    const updates = {
      home_score: homeScore,
      away_score: awayScore,
      updated_at: new Date().toISOString(),
    };
    if (minute !== null) updates.current_minute = minute;
    const { data, error } = await supabase
      .from('sport_matches').update(updates).eq('id', matchId).select().single();
    if (error) throw error;
    return data;
  },

  async submitResult(matchId, homeScore, awayScore, options = {}) {
    const result =
      homeScore > awayScore ? 'home_win' :
      awayScore > homeScore ? 'away_win' : 'draw';

    const updates = {
      status: 'completed',
      home_score: homeScore,
      away_score: awayScore,
      result,
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...options,
    };

    if (result === 'home_win') updates.winner_team_id = options.home_team_id;
    else if (result === 'away_win') updates.winner_team_id = options.away_team_id;

    const { data, error } = await supabase
      .from('sport_matches').update(updates).eq('id', matchId).select().single();
    if (error) throw error;
    // Trigger: auto-recomputes league table via DB trigger
    return data;
  },

  async manualRecomputeTable(eventId) {
    const { error } = await supabase.rpc('recompute_league_table', { p_event_id: eventId });
    if (error) throw error;
  },

  async updateMatchData(matchId, matchData) {
    const { data, error } = await supabase
      .from('sport_matches')
      .update({ match_data: matchData, updated_at: new Date().toISOString() })
      .eq('id', matchId).select().single();
    if (error) throw error;
    return data;
  },

  async setHalfTime(matchId) {
    const { data } = await supabase
      .from('sport_matches')
      .update({ status: 'half_time', current_period: 1 })
      .eq('id', matchId).select().single();
    return data;
  },

  async resumeFromHalfTime(matchId) {
    const { data } = await supabase
      .from('sport_matches')
      .update({ status: 'live', current_period: 2 })
      .eq('id', matchId).select().single();
    return data;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MATCH EVENT MANAGER
// ─────────────────────────────────────────────────────────────────────────────

export const MatchEventManager = {
  async list(matchId) {
    const { data } = await supabase
      .from('sport_match_events')
      .select('*')
      .eq('match_id', matchId)
      .order('minute', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });
    return data || [];
  },

  async log(matchId, eventId, eventData) {
    const { data, error } = await supabase
      .from('sport_match_events')
      .insert({ match_id: matchId, event_id: eventId, ...eventData })
      .select().single();
    if (error) throw error;
    return data;
  },

  async delete(eventItemId) {
    await supabase.from('sport_match_events').delete().eq('id', eventItemId);
  },

  /** Helper: log a goal and auto-increment score */
  async logGoal(matchId, eventId, team, playerName, minute, isHomeTeam) {
    const match = await MatchManager.getMatch(matchId);
    const newHomeScore = match.home_score + (isHomeTeam ? 1 : 0);
    const newAwayScore = match.away_score + (!isHomeTeam ? 1 : 0);

    await Promise.all([
      this.log(matchId, eventId, {
        event_type: 'goal', team_id: team?.id, player_name: playerName,
        minute, score_home: newHomeScore, score_away: newAwayScore,
      }),
      MatchManager.updateScore(matchId, newHomeScore, newAwayScore, minute),
    ]);

    return { homeScore: newHomeScore, awayScore: newAwayScore };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// INDIVIDUAL RESULTS MANAGER
// ─────────────────────────────────────────────────────────────────────────────

export const IndividualResultsManager = {
  async list(eventId, discipline = null) {
    let q = supabase.from('sport_individual_results')
      .select('*, sport_athletes(name, bib_number, photo_url, nationality, sport_teams(name, logo_url))')
      .eq('event_id', eventId)
      .order('finish_position', { ascending: true, nullsFirst: false })
      .order('result_score', { ascending: true });
    if (discipline) q = q.eq('discipline', discipline);
    const { data } = await q;
    return data || [];
  },

  async submit(eventId, result) {
    const { data, error } = await supabase
      .from('sport_individual_results')
      .insert({ event_id: eventId, ...result })
      .select().single();
    if (error) throw error;
    return data;
  },

  async bulkSubmit(eventId, results) {
    const rows = results.map(r => ({ event_id: eventId, ...r }));
    const { data, error } = await supabase
      .from('sport_individual_results').insert(rows).select();
    if (error) throw error;
    return data || [];
  },

  async update(resultId, updates) {
    const { data, error } = await supabase
      .from('sport_individual_results').update(updates).eq('id', resultId).select().single();
    if (error) throw error;
    return data;
  },

  /** Get disciplines for an event */
  async getDisciplines(eventId) {
    const { data } = await supabase
      .from('sport_individual_results')
      .select('discipline')
      .eq('event_id', eventId)
      .not('discipline', 'is', null);
    return [...new Set((data || []).map(r => r.discipline))].sort();
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LEAGUE TABLE MANAGER
// ─────────────────────────────────────────────────────────────────────────────

export const TableManager = {
  async get(eventId, groupId = null) {
    let q = supabase.from('sport_league_table')
      .select('*, sport_teams(id, name, short_name, logo_url, color1, color2)')
      .eq('event_id', eventId)
      .order('position', { ascending: true });
    if (groupId) q = q.eq('group_id', groupId);
    const { data } = await q;
    return data || [];
  },

  async recompute(eventId) {
    return MatchManager.manualRecomputeTable(eventId);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// STATS / TOP PERFORMERS
// ─────────────────────────────────────────────────────────────────────────────

export const StatsManager = {
  async getTopPerformers(eventId, category = null) {
    let q = supabase.from('sport_top_performers')
      .select('*').eq('event_id', eventId)
      .order('position', { ascending: true });
    if (category) q = q.eq('category', category);
    const { data } = await q;
    return data || [];
  },

  async upsertPerformer(eventId, performer) {
    const { data, error } = await supabase
      .from('sport_top_performers')
      .upsert({ event_id: eventId, ...performer, updated_at: new Date().toISOString() })
      .select().single();
    if (error) throw error;
    return data;
  },

  /** Recompute top scorers from match events */
  async recomputeTopScorers(eventId) {
    const { data: events } = await supabase
      .from('sport_match_events')
      .select('player_name, team_id, sport_teams(name)')
      .eq('event_id', eventId)
      .in('event_type', ['goal', 'try', 'basket_2pt', 'basket_3pt']);

    if (!events?.length) return;

    const scorerMap = {};
    events.forEach(e => {
      const key = e.player_name;
      if (!key) return;
      if (!scorerMap[key]) scorerMap[key] = { player_name: key, team_id: e.team_id, value: 0, position: 0 };
      scorerMap[key].value++;
    });

    const sorted = Object.values(scorerMap).sort((a, b) => b.value - a.value);
    sorted.forEach((s, i) => { s.position = i + 1; });

    // Delete old + insert fresh
    await supabase.from('sport_top_performers')
      .delete().eq('event_id', eventId).eq('category', 'top_scorers');
    if (sorted.length > 0) {
      await supabase.from('sport_top_performers')
        .insert(sorted.map(s => ({ event_id: eventId, category: 'top_scorers', ...s })));
    }

    return sorted;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// COMMENTARY
// ─────────────────────────────────────────────────────────────────────────────

export const CommentaryManager = {
  async list(matchId, limit = 50) {
    const { data } = await supabase
      .from('sport_live_commentary')
      .select('*, profiles(username, avatar_url)')
      .eq('match_id', matchId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data || []).reverse();
  },

  async post(matchId, eventId, authorId, entry) {
    const { data, error } = await supabase
      .from('sport_live_commentary')
      .insert({ match_id: matchId, event_id: eventId, author_id: authorId, ...entry })
      .select().single();
    if (error) throw error;
    return data;
  },

  subscribeToMatch(matchId, onUpdate) {
    const ch = supabase.channel(`commentary:${matchId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sport_live_commentary', filter: `match_id=eq.${matchId}` },
        payload => onUpdate(payload.new)
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SPORT MEDIA
// ─────────────────────────────────────────────────────────────────────────────

export const SportMediaManager = {
  async list(eventId, matchId = null) {
    let q = supabase.from('sport_media')
      .select('*, profiles(username, avatar_url)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (matchId) q = q.eq('match_id', matchId);
    const { data } = await q;
    return data || [];
  },

  async upload(eventId, uploaderId, mediaData) {
    const { data, error } = await supabase
      .from('sport_media')
      .insert({ event_id: eventId, uploader_id: uploaderId, ...mediaData })
      .select().single();
    if (error) throw error;
    return data;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// FOLLOWER MANAGER
// ─────────────────────────────────────────────────────────────────────────────

export const SportFollowerManager = {
  async follow(eventId, userId, teamId = null) {
    const { error } = await supabase.from('sport_event_followers')
      .upsert({ event_id: eventId, user_id: userId, team_id: teamId },
               { onConflict: 'event_id,user_id' });
    return !error;
  },

  async unfollow(eventId, userId) {
    await supabase.from('sport_event_followers')
      .delete().eq('event_id', eventId).eq('user_id', userId);
  },

  async isFollowing(eventId, userId) {
    const { data } = await supabase.from('sport_event_followers')
      .select('id, team_id').eq('event_id', eventId).eq('user_id', userId).maybeSingle();
    return data;
  },

  async getFollowerCount(eventId) {
    const { count } = await supabase.from('sport_event_followers')
      .select('id', { count: 'exact', head: true }).eq('event_id', eventId);
    return count || 0;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// REALTIME MATCH SUBSCRIPTION
// ─────────────────────────────────────────────────────────────────────────────

export function subscribeToLiveMatch(matchId, { onScore, onEvent, onStatus }) {
  const ch = supabase.channel(`live_match:${matchId}`)
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'sport_matches', filter: `id=eq.${matchId}` },
      payload => {
        if (onScore && (payload.new.home_score !== payload.old?.home_score || payload.new.away_score !== payload.old?.away_score)) {
          onScore(payload.new);
        }
        if (onStatus && payload.new.status !== payload.old?.status) {
          onStatus(payload.new.status, payload.new);
        }
      }
    )
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'sport_match_events', filter: `match_id=eq.${matchId}` },
      payload => onEvent?.(payload.new)
    )
    .subscribe();
  return () => supabase.removeChannel(ch);
}

export default {
  SPORT_REGISTRY, SPORT_KEYS,
  SportConfig, TeamManager, AthleteManager, MatchManager,
  MatchEventManager, IndividualResultsManager, TableManager,
  StatsManager, CommentaryManager, SportMediaManager, SportFollowerManager,
  subscribeToLiveMatch,
};
