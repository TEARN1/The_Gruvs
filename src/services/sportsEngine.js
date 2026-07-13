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
import { MatchCache, withCache } from './offlineCache';

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
  // ── Racket Sports ──────────────────────────────────────────────────────────
  badminton: {
    name: 'Badminton', icon: '🏸', color: '#f97316',
    team_sport: false, individual_sport: true,
    scoring_unit: 'games', default_periods: 3, period_label: 'Game',
    event_types: ['point','smash','ace_serve','fault','net_cord'],
    stats_categories: ['top_points','win_loss'],
    match_data_template: { games: [] },
  },
  table_tennis: {
    name: 'Table Tennis', icon: '🏓', color: '#06b6d4',
    team_sport: false, individual_sport: true,
    scoring_unit: 'games', default_periods: 5, period_label: 'Game',
    event_types: ['point','smash','serve_ace','edge'],
    stats_categories: ['top_scorers','win_loss'],
    match_data_template: { games: [] },
  },
  squash: {
    name: 'Squash', icon: '🎾', color: '#84cc16',
    team_sport: false, individual_sport: true,
    scoring_unit: 'games', default_periods: 5, period_label: 'Game',
    event_types: ['point','tin','out','let','stroke'],
    stats_categories: ['win_loss','rally_counts'],
  },
  // ── Combat Sports ──────────────────────────────────────────────────────────
  wrestling: {
    name: 'Wrestling', icon: '🤼', color: '#dc2626',
    team_sport: false, individual_sport: true,
    scoring_unit: 'points', default_periods: 3, period_label: 'Period',
    period_duration: 2,
    event_types: ['takedown','reversal','escape','near_fall','pin','technical_fall','dq'],
    stats_categories: ['standings','pin_falls','tech_falls'],
    match_data_template: { weight_class: '', style: 'freestyle' },
  },
  judo: {
    name: 'Judo / Martial Arts', icon: '🥋', color: '#1d4ed8',
    team_sport: false, individual_sport: true,
    scoring_unit: 'points',
    disciplines: ['Judo','Karate','Taekwondo','Jiu-Jitsu','Muay Thai','Kickboxing','Sambo'],
    event_types: ['ippon','waza_ari','yuko','penalty','ko','submission','point'],
    stats_categories: ['results','gold_medals','standings'],
    match_data_template: { weight_class: '', discipline: 'Judo' },
  },
  fencing: {
    name: 'Fencing', icon: '🤺', color: '#64748b',
    team_sport: false, individual_sport: true,
    scoring_unit: 'touches',
    disciplines: ['Foil','Épée','Sabre'],
    event_types: ['touch','double_touch','penalty'],
    stats_categories: ['standings','touch_counts'],
  },
  // ── Water Sports ───────────────────────────────────────────────────────────
  water_polo: {
    name: 'Water Polo', icon: '🤽', color: '#0ea5e9',
    team_sport: true, individual_sport: false,
    scoring_unit: 'goals', default_periods: 4, period_label: 'Quarter',
    period_duration: 8,
    event_types: ['goal','penalty_goal','exclusion','brutality'],
    table_columns: ['P','W','D','L','GF','GA','GD','Pts'],
    stats_categories: ['top_scorers','clean_sheets'],
  },
  rowing: {
    name: 'Rowing / Canoe', icon: '🚣', color: '#0891b2',
    team_sport: false, individual_sport: true,
    scoring_unit: 'time',
    disciplines: ['Single Scull','Double Scull','Quad Scull','Coxless Pair','Coxless Four','Eight','Kayak K1','Kayak K2','Kayak K4','Canoe C1','Canoe C2'],
    event_types: ['heat_result','semi_result','final_result','record'],
    stats_categories: ['event_results','records'],
  },
  surfing: {
    name: 'Surfing', icon: '🏄', color: '#06b6d4',
    team_sport: false, individual_sport: true,
    scoring_unit: 'points',
    disciplines: ['Shortboard','Longboard','Bodyboard','SUP','Skimboard'],
    event_types: ['wave_score','ride_end','priority_lost'],
    stats_categories: ['heat_results','final_standings'],
    match_data_template: { heat_size: 30, waves_per_surfer: 2 },
  },
  // ── Target & Precision Sports ──────────────────────────────────────────────
  archery: {
    name: 'Archery', icon: '🏹', color: '#92400e',
    team_sport: false, individual_sport: true,
    scoring_unit: 'points',
    disciplines: ['Recurve','Compound','Barebow','Traditional','Field Archery','3D Archery'],
    event_types: ['arrow_score','10_bullseye','9_score','miss'],
    stats_categories: ['results','gold_medals','total_scores'],
  },
  shooting: {
    name: 'Shooting', icon: '🎯', color: '#374151',
    team_sport: false, individual_sport: true,
    scoring_unit: 'points',
    disciplines: ['10m Air Rifle','10m Air Pistol','25m Rapid Fire Pistol','50m Rifle','50m Pistol','Trap','Skeet','Double Trap'],
    event_types: ['shot_score','bullseye','miss'],
    stats_categories: ['results','qualification_scores'],
  },
  snooker: {
    name: 'Snooker / Billiards / Pool', icon: '🎱', color: '#166534',
    team_sport: false, individual_sport: true,
    scoring_unit: 'frames',
    disciplines: ['Snooker','English Billiards','Pool','9-Ball','8-Ball','10-Ball'],
    event_types: ['frame_win','century_break','maximum_break','foul','miss'],
    stats_categories: ['frames_won','centuries','highest_break'],
    match_data_template: { frames_needed: 5 },
  },
  bowls: {
    name: 'Lawn Bowls / Bowling', icon: '🎳', color: '#0d9488',
    team_sport: false, individual_sport: true,
    scoring_unit: 'points',
    disciplines: ['Lawn Bowls','10-Pin Bowling','Indoor Bowls','Crown Green Bowls'],
    event_types: ['point','end_won','strike','spare','gutter'],
    stats_categories: ['results','averages'],
  },
  // ── Horse & Motor ──────────────────────────────────────────────────────────
  equestrian: {
    name: 'Equestrian / Horse Racing', icon: '🏇', color: '#7c3aed',
    team_sport: false, individual_sport: true,
    scoring_unit: 'position/time',
    disciplines: ['Flat Racing','Hurdles','Steeplechase','Show Jumping','Dressage','Cross Country','Polo'],
    event_types: ['race_result','fall','disqualified','scratched','photo_finish'],
    stats_categories: ['race_results','jockey_standings','trainer_standings'],
    match_data_template: { race_distance: '', surface: 'turf', runners: [] },
  },
  // ── Field & Team Sports ────────────────────────────────────────────────────
  hockey: {
    name: 'Hockey (Field)', icon: '🏑', color: '#16a34a',
    team_sport: true, individual_sport: false,
    scoring_unit: 'goals', default_periods: 4, period_label: 'Quarter',
    period_duration: 15,
    event_types: ['goal','penalty_corner','penalty_stroke','yellow_card','red_card'],
    table_columns: ['P','W','D','L','GF','GA','GD','Pts'],
    stats_categories: ['top_scorers','clean_sheets'],
  },
  handball: {
    name: 'Handball', icon: '🤾', color: '#f97316',
    team_sport: true, individual_sport: false,
    scoring_unit: 'goals', default_periods: 2, period_label: 'Half',
    period_duration: 30,
    event_types: ['goal','penalty_goal','yellow_card','red_card','2min_suspension'],
    table_columns: ['P','W','D','L','GF','GA','GD','Pts'],
    stats_categories: ['top_scorers','saves'],
  },
  american_football: {
    name: 'American Football', icon: '🏈', color: '#7c3aed',
    team_sport: true, individual_sport: false,
    scoring_unit: 'points', default_periods: 4, period_label: 'Quarter',
    period_duration: 15,
    event_types: ['touchdown','extra_point','two_point_conv','field_goal','safety','turnover','sack'],
    table_columns: ['P','W','L','T','PF','PA','Pts'],
    stats_categories: ['top_scorers','passing_yards','rushing_yards'],
    match_data_template: { q1_home: 0, q1_away: 0, q2_home: 0, q2_away: 0, q3_home: 0, q3_away: 0, q4_home: 0, q4_away: 0 },
  },
  baseball: {
    name: 'Baseball / Softball', icon: '⚾', color: '#dc2626',
    team_sport: true, individual_sport: false,
    scoring_unit: 'runs', default_periods: 9, period_label: 'Inning',
    event_types: ['run','hit','home_run','strikeout','walk','out','error','stolen_base'],
    table_columns: ['P','W','L','GB','Pct'],
    stats_categories: ['batting_average','home_runs','rbi','era'],
    match_data_template: { innings: [] },
  },
  // ── Endurance & Multi-Sport ────────────────────────────────────────────────
  triathlon: {
    name: 'Triathlon / Duathlon', icon: '🏊', color: '#0891b2',
    team_sport: false, individual_sport: true,
    scoring_unit: 'time',
    disciplines: ['Sprint Triathlon','Olympic Triathlon','Half Iron','Full Iron','Duathlon','Aquathlon'],
    event_types: ['swim_split','bike_split','run_split','t1_transition','t2_transition','finish'],
    stats_categories: ['overall_results','age_group_results','split_times'],
    match_data_template: { segments: ['swim','t1','bike','t2','run'] },
  },
  cross_country: {
    name: 'Cross Country / Trail', icon: '🌲', color: '#166534',
    team_sport: false, individual_sport: true,
    scoring_unit: 'time/position',
    disciplines: ['5km','10km','Half Marathon','Marathon','Ultra Marathon','Trail Run','Obstacle Course'],
    event_types: ['finish','dnf','dns','checkpoint_split'],
    stats_categories: ['results','age_group','checkpoint_times'],
  },
  // ── Winter Sports ──────────────────────────────────────────────────────────
  ice_hockey: {
    name: 'Ice Hockey', icon: '🏒', color: '#0ea5e9',
    team_sport: true, individual_sport: false,
    scoring_unit: 'goals', default_periods: 3, period_label: 'Period',
    period_duration: 20,
    event_types: ['goal','power_play_goal','short_handed_goal','penalty','fight','major_penalty'],
    table_columns: ['GP','W','L','OTL','GF','GA','Pts'],
    stats_categories: ['top_scorers','top_assists','goalie_save_pct'],
  },
  // ── Gymnastics & Dance Sport ───────────────────────────────────────────────
  gymnastics: {
    name: 'Gymnastics / Cheerleading', icon: '🤸', color: '#ec4899',
    team_sport: false, individual_sport: true,
    scoring_unit: 'points',
    disciplines: ['Artistic Gymnastics','Rhythmic Gymnastics','Trampolining','Acrobatic Gymnastics','Cheerleading','Aerobics'],
    event_types: ['score','deduction','execution_score','difficulty_score','bonus'],
    stats_categories: ['results','difficulty_scores','execution_scores'],
    match_data_template: { apparatus: '', difficulty: 0, execution: 0, bonus: 0 },
  },
  weightlifting: {
    name: 'Weightlifting / Powerlifting', icon: '🏋️', color: '#6366f1',
    team_sport: false, individual_sport: true,
    scoring_unit: 'kg',
    disciplines: ['Snatch','Clean & Jerk','Squat','Bench Press','Deadlift','Total','Powerlifting Total'],
    event_types: ['good_lift','no_lift','world_record','national_record','personal_best'],
    stats_categories: ['results','weight_classes','records'],
    match_data_template: { weight_class: '', attempts: [] },
  },
  // ── Mind Sports ────────────────────────────────────────────────────────────
  poker: {
    name: 'Poker / Card Games', icon: '🃏', color: '#92400e',
    team_sport: false, individual_sport: true,
    scoring_unit: 'chips/points',
    disciplines: ["Texas Hold'em",'Omaha','Seven Card Stud','Razz','Blackjack','Bridge','Scrabble'],
    event_types: ['hand_win','bust','rebuy','all_in','final_table'],
    stats_categories: ['chip_counts','eliminations','final_standings'],
  },
  // ── Other ─────────────────────────────────────────────────────────────────
  rugby_sevens: {
    name: 'Rugby Sevens', icon: '🏉', color: '#d97706',
    team_sport: true, individual_sport: false,
    scoring_unit: 'points', default_periods: 2, period_label: 'Half',
    period_duration: 7,
    event_types: ['try','conversion','penalty_kick','yellow_card','red_card'],
    table_columns: ['P','W','D','L','PF','PA','PD','BP','Pts'],
    stats_categories: ['top_try_scorers','top_point_scorers'],
  },
  kabaddi: {
    name: 'Kabaddi / Indigenous Sports', icon: '🤸', color: '#f59e0b',
    team_sport: true, individual_sport: false,
    scoring_unit: 'points', default_periods: 2, period_label: 'Half',
    period_duration: 20,
    event_types: ['raid_point','tackle_point','bonus_point','super_raid','super_tackle','do_or_die'],
    table_columns: ['P','W','D','L','PF','PA','Pts'],
    stats_categories: ['top_raiders','top_defenders'],
  },
  sepak_takraw: {
    name: 'Sepak Takraw / Petanque', icon: '⚽', color: '#10b981',
    team_sport: true, individual_sport: false,
    scoring_unit: 'sets',
    disciplines: ['Sepak Takraw Regu','Sepak Takraw Doubles','Petanque Singles','Petanque Doubles','Petanque Triples'],
    event_types: ['point','set_win'],
    stats_categories: ['standings','results'],
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
    // Re-sync the match cover so a renamed team / new logo isn't stale.
    await MatchManager.syncEventMatchCard(data?.event_id);
    return data;
  },

  async delete(teamId) {
    try {
      const { error } = await supabase.from('sport_teams').delete().eq('id', teamId);
      if (error) throw error;
    } catch (err) {
      console.error('Error deleting team:', err);
      throw err;
    }
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
    try {
      const { error } = await supabase.from('sport_athletes').delete().eq('id', athleteId);
      if (error) throw error;
    } catch (err) {
      console.error('Error deleting athlete:', err);
      throw err;
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MATCH MANAGER
// ─────────────────────────────────────────────────────────────────────────────

export const MatchManager = {
  async listFixtures(eventId, options = {}) {
    let q = supabase.from('sport_matches')
      .select(`*, home_team:home_team_id(id, name, short_name, logo_url, color1), away_team:away_team_id(id, name, short_name, logo_url, color1), sport_groups(name)`)
      .eq('event_id', eventId)
      .order('round_number', { ascending: true })
      .order('match_number', { ascending: true });

    if (options.status) q = q.eq('status', options.status);
    if (options.round) q = q.eq('round', options.round);
    const { data } = await q;
    return data || [];
  },

  async getMatch(matchId) {
    return withCache(
      () => MatchCache.getMatch(matchId),
      () => MatchCache.getMatchStale(matchId),
      async () => {
        const { data } = await supabase.from('sport_matches')
          .select(`*, home_team:home_team_id(id, name, short_name, logo_url, color1, players), away_team:away_team_id(id, name, short_name, logo_url, color1, players), home_athlete:home_athlete_id(*), away_athlete:away_athlete_id(*)`)
          .eq('id', matchId)
          .single();
        return data;
      },
      (d) => MatchCache.saveMatch(matchId, d),
    );
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

    // Check for byes in Round 1 and auto-complete them
    const byes = (data || []).filter(
      m => m.round_number === 1 && ((m.home_team_id && !m.away_team_id) || (!m.home_team_id && m.away_team_id))
    );
    for (const match of byes) {
      const homeScore = match.home_team_id ? 1 : 0;
      const awayScore = match.away_team_id ? 1 : 0;
      await this.submitResult(match.id, homeScore, awayScore, {
        home_team_id: match.home_team_id,
        away_team_id: match.away_team_id,
        home_athlete_id: match.home_athlete_id,
        away_athlete_id: match.away_athlete_id
      });
    }

    const { data: refetched } = await supabase.from('sport_matches')
      .select(`*, home_team:home_team_id(id, name, short_name, logo_url, color1), away_team:away_team_id(id, name, short_name, logo_url, color1), sport_groups(name)`)
      .eq('event_id', eventId)
      .order('round_number', { ascending: true })
      .order('match_number', { ascending: true });
    return refetched || [];
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

  /** Generate a single-elimination knockout tournament bracket */
  generateKnockout(teams, baseDate, config = {}) {
    const fixtures = [];
    const n = teams.length;
    if (n === 0) return [];
    let p = 2;
    let totalRounds = 1;
    while (p < n) { p *= 2; totalRounds++; }

    const getRoundName = (r, total) => {
      if (r === total) return 'Final';
      if (r === total - 1) return 'Semifinals';
      if (r === total - 2) return 'Quarterfinals';
      return `Round of ${Math.pow(2, total - r + 1)}`;
    };

    for (let r = 1; r <= totalRounds; r++) {
      const matchCount = p / Math.pow(2, r);
      for (let m = 1; m <= matchCount; m++) {
        let homeTeamId = null;
        let awayTeamId = null;

        if (r === 1) {
          homeTeamId = teams[2 * (m - 1)]?.id || null;
          awayTeamId = teams[2 * (m - 1) + 1]?.id || null;
        }

        const scheduledAt = baseDate ? new Date(baseDate) : null;
        if (scheduledAt) scheduledAt.setDate(scheduledAt.getDate() + (r - 1) * 7);

        fixtures.push({
          round: getRoundName(r, totalRounds),
          round_number: r,
          match_number: m,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          scheduled_at: scheduledAt ? scheduledAt.toISOString() : null,
          status: 'scheduled',
        });
      }
    }

    return fixtures;
  },

  async kickOff(matchId) {
    const { data, error } = await supabase
      .from('sport_matches')
      .update({ status: 'live', started_at: new Date().toISOString(), current_minute: 0 })
      .eq('id', matchId).select().single();
    if (error) throw error;
    await this.syncEventMatchCard(data?.event_id); // flip the cover to LIVE at kickoff
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

    // Keep the event's match cover score in step with the live fixture
    await this.syncEventMatchCard(data?.event_id);

    // Auto-update the league table on every score change — no manual "Recalc"
    // needed. Best-effort: silently ignored until recompute_league_table is
    // deployed (supabase/queries/FIX_COMPETITION_ENGINE.sql).
    if (data?.event_id) {
      try { await supabase.rpc('recompute_league_table', { p_event_id: data.event_id }); } catch { /* RPC not live yet */ }
    }

    // Check for auto-end conditions
    const match = await this.getMatch(matchId);
    if (match) {
      const ended = await this.checkAndAutoEndMatch(match, homeScore, awayScore);
      if (ended) {
        return this.getMatch(matchId);
      }
    }
    return data;
  },

  // Keep the parent event's denormalised match_card (crest + score + status)
  // in sync with its live fixture, for two-team head-to-head events. Self-heals:
  // clears the card if the line-up isn't exactly two teams. Best-effort — a
  // missing events.match_card column is simply ignored.
  async syncEventMatchCard(eventId) {
    if (!eventId) return;
    try {
      const { data: teams } = await supabase
        .from('sport_teams')
        .select('id, name, logo_url, color1, position')
        .eq('event_id', eventId)
        .order('position', { ascending: true, nullsFirst: false })
        .limit(3);
      if (!teams || teams.length !== 2) {
        await supabase.from('events').update({ match_card: null }).eq('id', eventId);
        return;
      }
      const { data: matches } = await supabase
        .from('sport_matches')
        .select('home_team_id, away_team_id, home_score, away_score, home_score_pens, away_score_pens, status, scheduled_at')
        .eq('event_id', eventId)
        .limit(2);
      const m = (matches && matches.length === 1) ? matches[0] : null;
      const crest = (t) => ({ id: t.id, name: t.name, logo_url: t.logo_url || null, color: t.color1 || null });
      const byId = (id) => teams.find(t => t.id === id);
      let homeT = m ? byId(m.home_team_id) : null;
      let awayT = m ? byId(m.away_team_id) : null;
      if (!homeT || !awayT) { homeT = teams[0]; awayT = teams[1]; }
      const card = { home: crest(homeT), away: crest(awayT) };
      if (m) {
        card.status = m.status || null;
        card.scheduled_at = m.scheduled_at || null;
        // Only surface a score once the match is live/done — a scheduled match
        // shows VS + a kickoff countdown, not a misleading 0–0.
        if (m.status === 'live' || m.status === 'completed' || m.status === 'half_time') {
          card.home_score = m.home_score ?? 0;
          card.away_score = m.away_score ?? 0;
          if (m.home_score_pens != null && m.away_score_pens != null) {
            card.home_score_pens = m.home_score_pens;
            card.away_score_pens = m.away_score_pens;
          }
        }
      }
      await supabase.from('events').update({ match_card: card }).eq('id', eventId);
    } catch { /* best-effort denormalisation */ }
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

    if (result === 'home_win') {
      updates.winner_team_id = options.home_team_id || null;
      updates.winner_athlete_id = options.home_athlete_id || null;
    } else if (result === 'away_win') {
      updates.winner_team_id = options.away_team_id || null;
      updates.winner_athlete_id = options.away_athlete_id || null;
    }

    const { data: updatedMatch, error } = await supabase
      .from('sport_matches').update(updates).eq('id', matchId).select().single();
    if (error) throw error;

    // Auto-advance bracket if event format is knockout
    if (updatedMatch) {
      const { data: config } = await supabase
        .from('event_sport_config')
        .select('format')
        .eq('event_id', updatedMatch.event_id)
        .maybeSingle();

      if (config?.format === 'knockout') {
        const nextRound = updatedMatch.round_number + 1;
        const nextMatchNum = Math.floor((updatedMatch.match_number - 1) / 2) + 1;
        const isHome = (updatedMatch.match_number % 2 !== 0);

        const { data: nextMatch } = await supabase
          .from('sport_matches')
          .select('id')
          .eq('event_id', updatedMatch.event_id)
          .eq('round_number', nextRound)
          .eq('match_number', nextMatchNum)
          .maybeSingle();

        if (nextMatch) {
          const updateData = {};
          if (updatedMatch.winner_team_id) {
            updateData[isHome ? 'home_team_id' : 'away_team_id'] = updatedMatch.winner_team_id;
          }
          if (updatedMatch.winner_athlete_id) {
            updateData[isHome ? 'home_athlete_id' : 'away_athlete_id'] = updatedMatch.winner_athlete_id;
          }
          if (Object.keys(updateData).length > 0) {
            await supabase
              .from('sport_matches')
              .update({ ...updateData, updated_at: new Date().toISOString() })
              .eq('id', nextMatch.id);
          }
        }
      }
    }

    await this.syncEventMatchCard(updatedMatch?.event_id);

    return updatedMatch;
  },

  async checkAndAutoEndMatch(match, homeScore, awayScore) {
    if (match.status === 'completed') return false;

    const { data: config } = await supabase
      .from('event_sport_config')
      .select('*')
      .eq('event_id', match.event_id)
      .maybeSingle();

    if (!config) return false;

    const sportMeta = SPORT_REGISTRY[config.sport_type];
    if (!sportMeta) return false;

    if (sportMeta.scoring_unit === 'sets' || sportMeta.scoring_unit === 'games') {
      const maxPeriods = config.periods || sportMeta.default_periods || 3;
      const targetSetsToWin = Math.ceil(maxPeriods / 2);

      if (homeScore >= targetSetsToWin || awayScore >= targetSetsToWin) {
        await this.submitResult(match.id, homeScore, awayScore, {
          home_team_id: match.home_team_id,
          away_team_id: match.away_team_id,
          home_athlete_id: match.home_athlete_id,
          away_athlete_id: match.away_athlete_id
        });
        return true;
      }
    }
    return false;
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
    await this.syncEventMatchCard(data?.event_id);
    return data;
  },

  async resumeFromHalfTime(matchId) {
    const { data } = await supabase
      .from('sport_matches')
      .update({ status: 'live', current_period: 2 })
      .eq('id', matchId).select().single();
    await this.syncEventMatchCard(data?.event_id);
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
    const payload = { match_id: matchId, event_id: eventId, ...eventData };

    // Connector: if logged by name only, link it to the tagged player so the
    // career rollup trigger fires (sport_match_events.athlete_id →
    // sport_athletes.player_id → players.career_*). No UI change needed.
    if (!payload.athlete_id && payload.player_name) {
      try {
        const { data: ath } = await supabase
          .from('sport_athletes')
          .select('id')
          .eq('event_id', eventId)
          .ilike('name', payload.player_name.trim())
          .not('player_id', 'is', null)
          .limit(1)
          .maybeSingle();
        if (ath?.id) payload.athlete_id = ath.id;
      } catch { /* best-effort linkage */ }
    }

    const { data, error } = await supabase
      .from('sport_match_events')
      .insert(payload)
      .select().single();
    if (error) throw error;

    // Check for KO / TKO / Submission and auto-end combat sports matches
    if (['ko', 'tko', 'submission'].includes(eventData.event_type)) {
      const match = await MatchManager.getMatch(matchId);
      if (match && match.status !== 'completed') {
        const isHomeWinner = eventData.team_id === match.home_team_id || eventData.athlete_id === match.home_athlete_id;
        const newHomeScore = isHomeWinner ? 1 : 0;
        const newAwayScore = isHomeWinner ? 0 : 1;
        await MatchManager.submitResult(matchId, newHomeScore, newAwayScore, {
          home_team_id: match.home_team_id,
          away_team_id: match.away_team_id,
          home_athlete_id: match.home_athlete_id,
          away_athlete_id: match.away_athlete_id
        });
      }
    }

    return data;
  },

  async delete(eventItemId) {
    try {
      const { error } = await supabase.from('sport_match_events').delete().eq('id', eventItemId);
      if (error) throw error;
    } catch (err) {
      console.error('Error deleting match event:', err);
      throw err;
    }
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
    const cacheKey = groupId ? `${eventId}:${groupId}` : eventId;
    return withCache(
      () => MatchCache.getLeagueTable(cacheKey),
      () => MatchCache.getLeagueTableStale(cacheKey),
      async () => {
        let q = supabase.from('sport_league_table')
          .select('*, sport_teams(id, name, short_name, logo_url, color1, color2)')
          .eq('event_id', eventId)
          .order('position', { ascending: true });
        if (groupId) q = q.eq('group_id', groupId);
        const { data } = await q;
        return data || [];
      },
      (d) => MatchCache.saveLeagueTable(cacheKey, d),
    );
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
    return withCache(
      () => MatchCache.getCommentary(matchId),
      () => MatchCache.getCommentaryStale(matchId),
      async () => {
        const { data } = await supabase
          .from('sport_live_commentary')
          .select('*, profiles(username, avatar_url)')
          .eq('match_id', matchId)
          .order('created_at', { ascending: false })
          .limit(limit);
        return (data || []).reverse();
      },
      (d) => MatchCache.saveCommentary(matchId, d),
    );
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
    try {
      const { error } = await supabase.from('sport_event_followers')
        .delete().eq('event_id', eventId).eq('user_id', userId);
      if (error) throw error;
    } catch (err) {
      console.error('Error unfollowing event:', err);
      throw err;
    }
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
