/**
 * The Gruvs — EventManagementEngine
 *
 * Universal management layer for every non-sport event type.
 * Each event category gets its own management capabilities:
 *
 *  Music / Festival   → Lineup, Stages, Setlists, Now Playing
 *  Conference         → Sessions, Speakers, Rooms, Live Q&A
 *  Food & Markets     → Vendors, Stalls, Menu Items, Booth Map
 *  Workshop           → Facilitators, Materials, Progress Tracking
 *  Hackathon          → Teams, Projects, Judge Scoring, Leaderboard
 *  Networking         → Attendees, Tables, Connection Requests
 *  Film / Theatre     → Cast, Showtimes, Reviews
 *  Arts / Exhibition  → Artists, Works, Guided Tours
 *  Comedy             → Acts, Running Order, Set Times
 *  Charity / Gala     → Sponsors, Auction Items, Donation Tracker
 *  Party / Social     → Dress Code, Table Reservations, Guest List
 *  Gaming / Esports   → Handled by sportsEngine (esports type)
 *
 * Architecture mirrors sportsEngine — same patterns, different data.
 */

import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────────────────────
// EVENT TYPE MANAGEMENT CONFIG
// Defines what management features each category gets
// ─────────────────────────────────────────────────────────────────────────────

export const EVENT_MGMT_CONFIG = {
  // ── Music & Performance ────────────────────────────────────────────────────
  music: {
    label: 'Music Event',  icon: '🎵', color: '#8b5cf6',
    features: ['lineup','stages','setlist','live_updates','gallery'],
    lineup_roles: ['Headliner','Co-Headliner','Support Act','Opening Act','DJ','MC','Guest'],
    has_setlist: true,
    has_stages: true,
  },
  festival: {
    label: 'Festival', icon: '🎪', color: '#f59e0b',
    features: ['lineup','stages','setlist','vendors','live_updates','gallery'],
    lineup_roles: ['Headliner','Sub-Headliner','Support','Opening','DJ','Spoken Word','Dance'],
    has_setlist: true,
    has_stages: true,
    has_vendors: true,
  },
  standup: {
    label: 'Comedy / Stand-Up', icon: '🎙️', color: '#f59e0b',
    features: ['lineup','live_updates','gallery'],
    lineup_roles: ['Headliner','Feature','Opener','MC','Guest Spot'],
    has_setlist: false,
    has_stages: false,
  },
  dance: {
    label: 'Dance Event', icon: '💃', color: '#ec4899',
    features: ['lineup','stages','live_updates','gallery','judge_scores'],
    lineup_roles: ['Headliner','Guest Artist','Workshop Leader','Battle Competitor','Judge'],
    has_judge_scores: true,
  },
  film: {
    label: 'Film / Theatre', icon: '🎬', color: '#dc2626',
    features: ['lineup','sessions','live_updates','gallery'],
    lineup_roles: ['Director','Lead Actor','Supporting Actor','Writer','Producer','Cinematographer'],
    has_setlist: false,
    session_type: 'screening',
  },
  // ── Social & Charity ──────────────────────────────────────────────────────
  charity: {
    label: 'Charity / Fundraiser', icon: '❤️', color: '#10b981',
    features: ['speakers','sessions','live_updates','gallery'],
    has_speakers: true,
    has_sessions: true,
    session_types: ['talk','award','performance','ceremony'],
  },
  fundraiser: {
    label: 'Fundraiser', icon: '💰', color: '#10b981',
    features: ['speakers','sessions','live_updates','gallery'],
    has_speakers: true,
    has_sessions: true,
    session_types: ['talk','auction','award','ceremony'],
  },
  kids: {
    label: 'Kids & Family', icon: '👨‍👩‍👧', color: '#f59e0b',
    features: ['sessions','live_updates','gallery'],
    has_sessions: true,
    session_types: ['performance','workshop','break','ceremony'],
  },
  // ── Sport & Competition ───────────────────────────────────────────────────
  sport: {
    label: 'Sport Event', icon: '🏆', color: '#10b981',
    features: ['lineup','sessions','judge_scores','live_updates','gallery'],
    lineup_roles: ['Athlete','Captain','Coach','Referee','MC','Sponsor Rep'],
    has_sessions: true,
    has_judge_scores: true,
    session_types: ['match','semifinal','final','award','warm_up','break'],
  },
  esports: {
    label: 'Esports / Gaming', icon: '🎮', color: '#3b82f6',
    features: ['teams','sessions','judge_scores','live_updates','gallery'],
    has_teams: true,
    has_sessions: true,
    has_judge_scores: true,
    session_types: ['group_stage','quarterfinal','semifinal','final','show_match','award'],
  },
  football: {
    label: 'Football', icon: '⚽', color: '#10b981',
    features: ['lineup','sessions','live_updates','gallery'],
    lineup_roles: ['Goalkeeper','Defender','Midfielder','Striker','Captain','Substitute','Coach','Referee'],
    has_sessions: true,
    session_types: ['match','first_half','second_half','extra_time','penalty','award'],
  },
  basketball: {
    label: 'Basketball', icon: '🏀', color: '#f97316',
    features: ['lineup','sessions','live_updates','gallery'],
    lineup_roles: ['Point Guard','Shooting Guard','Small Forward','Power Forward','Center','Coach','Referee'],
    has_sessions: true,
    session_types: ['match','q1','q2','q3','q4','overtime','award'],
  },
  boxing: {
    label: 'Boxing / MMA', icon: '🥊', color: '#ef4444',
    features: ['lineup','sessions','judge_scores','live_updates','gallery'],
    lineup_roles: ['Fighter','Corner Coach','Referee','Ring Announcer','Judge','Promoter'],
    has_judge_scores: true,
    has_sessions: true,
    session_types: ['undercard','main_event','round','award'],
  },
  marathon: {
    label: 'Marathon / Run', icon: '🏃', color: '#f59e0b',
    features: ['sessions','judge_scores','live_updates','gallery'],
    has_sessions: true,
    has_judge_scores: true,
    session_types: ['registration','warm_up','race','finish','award'],
  },
  // ── Arts & Performance ────────────────────────────────────────────────────
  theatre: {
    label: 'Theatre / Play', icon: '🎭', color: '#7c3aed',
    features: ['lineup','sessions','live_updates','gallery'],
    lineup_roles: ['Lead Actor','Supporting Actor','Director','Stage Manager','Crew','Understudy'],
    has_sessions: true,
    session_types: ['rehearsal','show','matinee','evening','q_and_a'],
  },
  comedy: {
    label: 'Comedy Show', icon: '😂', color: '#f59e0b',
    features: ['lineup','live_updates','gallery'],
    lineup_roles: ['Headliner','Feature','Opener','MC','Guest Spot'],
  },
  poetry: {
    label: 'Poetry / Spoken Word', icon: '📝', color: '#7c3aed',
    features: ['lineup','sessions','live_updates','gallery'],
    lineup_roles: ['Poet','MC','Featured Artist','Open-Mic Performer'],
    has_sessions: true,
    session_types: ['open_mic','featured','workshop','q_and_a'],
  },
  fashion: {
    label: 'Fashion Show', icon: '👗', color: '#d946ef',
    features: ['lineup','stages','judge_scores','live_updates','gallery'],
    lineup_roles: ['Designer','Model','Stylist','Makeup Artist','Photographer','Brand','MC'],
    has_stages: true,
    has_judge_scores: true,
  },
  // ── Food & Drink Events ───────────────────────────────────────────────────
  food: {
    label: 'Food & Market', icon: '🍜', color: '#f97316',
    features: ['vendors','live_updates','gallery'],
    has_vendors: true,
    vendor_categories: ['Food','Drinks','Desserts','Street Food','Bakery','Vegan','Halaal','Traditional','International','Beverages'],
  },
  market: {
    label: 'Market / Expo', icon: '🛒', color: '#f97316',
    features: ['vendors','live_updates','gallery'],
    has_vendors: true,
    vendor_categories: ['Crafts','Fashion','Art','Jewellery','Books','Plants','Tech','Beauty','Food','Services'],
  },
  foodfestival: {
    label: 'Food Festival', icon: '🎪', color: '#f97316',
    features: ['vendors','lineup','sessions','live_updates','gallery'],
    has_vendors: true,
    has_sessions: true,
    lineup_roles: ['Celebrity Chef','Host','Judge','Demonstrator'],
    vendor_categories: ['Food','Street Food','Desserts','Drinks','Artisan','Traditional'],
    session_types: ['cook_off','demo','award','talk','tasting'],
  },
  braai: {
    label: 'Braai / BBQ', icon: '🔥', color: '#ef4444',
    features: ['vendors','judge_scores','live_updates','gallery'],
    has_vendors: true,
    has_judge_scores: true,
    vendor_categories: ['Meat Cuts','Sides','Drinks','Desserts'],
  },
  wine_tasting: {
    label: 'Wine & Spirits Tasting', icon: '🍷', color: '#be185d',
    features: ['vendors','sessions','judge_scores','live_updates','gallery'],
    has_vendors: true,
    has_sessions: true,
    has_judge_scores: true,
    vendor_categories: ['Red Wine','White Wine','Rosé','Spirits','Beer','Craft Drinks','Non-Alcoholic'],
    session_types: ['tasting','talk','masterclass','award','networking'],
  },
  // ── Community & Culture ───────────────────────────────────────────────────
  culture: {
    label: 'Culture & Heritage', icon: '🌍', color: '#f97316',
    features: ['lineup','sessions','live_updates','gallery'],
    has_sessions: true,
    lineup_roles: ['Cultural Ambassador','Speaker','Performer','Storyteller','Elder','MC'],
    session_types: ['performance','talk','storytelling','q_and_a','ceremony'],
  },
  community: {
    label: 'Community Event', icon: '🏘️', color: '#10b981',
    features: ['sessions','speakers','live_updates','gallery'],
    has_sessions: true,
    has_speakers: true,
    session_types: ['talk','workshop','activity','q_and_a','networking'],
  },
  religion: {
    label: 'Faith Event', icon: '🙏', color: '#a78bfa',
    features: ['lineup','sessions','live_updates'],
    lineup_roles: ['Preacher','Worship Leader','Choir','Guest Speaker','MC'],
    has_sessions: true,
    session_types: ['worship','sermon','prayer','testimony','altar_call','fellowship'],
  },
  gospel: {
    label: 'Gospel Concert', icon: '🙏', color: '#6366f1',
    features: ['lineup','stages','live_updates','gallery'],
    lineup_roles: ['Headliner','Choir','Worship Leader','Guest Artist','MC','Guest Speaker'],
    has_stages: true,
  },
  // ── Tech & Innovation ─────────────────────────────────────────────────────
  tech: {
    label: 'Tech Event', icon: '💻', color: '#3b82f6',
    features: ['sessions','speakers','live_updates','gallery'],
    has_sessions: true,
    has_speakers: true,
    session_types: ['keynote','talk','panel','demo','workshop','q_and_a','networking'],
  },
  startup: {
    label: 'Startup / Pitch Night', icon: '🚀', color: '#7c3aed',
    features: ['lineup','sessions','judge_scores','live_updates','gallery'],
    lineup_roles: ['Founder','Investor','Judge','Mentor','MC','Host'],
    has_sessions: true,
    has_judge_scores: true,
    session_types: ['pitch','panel','keynote','q_and_a','networking','award'],
  },
  hackathon: {
    label: 'Hackathon', icon: '⚡', color: '#3b82f6',
    features: ['teams','sessions','judge_scores','live_updates','gallery'],
    has_teams: true,
    has_judge_scores: true,
    has_sessions: true,
    session_types: ['workshop','demo','keynote','award'],
  },
  // ── Wellness & Lifestyle ──────────────────────────────────────────────────
  wellness: {
    label: 'Wellness / Mindfulness', icon: '🧘', color: '#10b981',
    features: ['sessions','speakers','live_updates'],
    has_sessions: true,
    has_speakers: true,
    session_types: ['workshop','talk','q_and_a'],
  },
  yoga: {
    label: 'Yoga / Fitness Class', icon: '🧘‍♀️', color: '#a78bfa',
    features: ['sessions','speakers','live_updates'],
    has_sessions: true,
    session_types: ['workshop','break'],
  },
  fitness: {
    label: 'Fitness / Bootcamp', icon: '💪', color: '#10b981',
    features: ['sessions','live_updates'],
    has_sessions: true,
    session_types: ['warm_up','circuit','cool_down','challenge','award'],
  },
  // ── Nightlife ─────────────────────────────────────────────────────────────
  nightlife: {
    label: 'Nightlife / Club', icon: '🌙', color: '#7c3aed',
    features: ['lineup','live_updates','gallery','guest_list'],
    lineup_roles: ['Resident DJ','Guest DJ','Headliner DJ','MC','Bartender Special'],
    has_setlist: true,
    has_stages: true,
  },
  party: {
    label: 'Party', icon: '🎉', color: '#ec4899',
    features: ['lineup','live_updates','gallery'],
    lineup_roles: ['DJ','MC','Performer','Host','Guest of Honour'],
  },
  // ── Travel & Outdoor ─────────────────────────────────────────────────────
  travel: {
    label: 'Travel / Group Trip', icon: '✈️', color: '#0ea5e9',
    features: ['sessions','speakers','live_updates'],
    has_sessions: true,
    session_types: ['departure','stop','activity','meal','accommodation','return'],
    lineup_roles: ['Tour Guide','Driver','Organiser','Guest Speaker'],
  },
  camping: {
    label: 'Camping / Outdoor', icon: '⛺', color: '#84cc16',
    features: ['sessions','vendors','live_updates','gallery'],
    has_sessions: true,
    has_vendors: true,
    session_types: ['activity','meal','workshop','campfire','sunrise','sunset'],
    vendor_categories: ['Food','Gear','Drinks','Crafts'],
  },
  // ── Business ─────────────────────────────────────────────────────────────
  biz: {
    label: 'Business / Networking', icon: '💼', color: '#6366f1',
    features: ['sessions','speakers','lineup','live_updates'],
    has_sessions: true,
    has_speakers: true,
    lineup_roles: ['Keynote Speaker','Panelist','Facilitator','Sponsor Rep','Exhibitor'],
  },
  conference: {
    label: 'Conference', icon: '🎤', color: '#4f46e5',
    features: ['sessions','speakers','live_updates','gallery'],
    has_sessions: true,
    has_speakers: true,
    session_types: ['keynote','talk','panel','workshop','breakout','q_and_a','networking','demo'],
  },
  workshop: {
    label: 'Workshop / Masterclass', icon: '🛠️', color: '#0891b2',
    features: ['speakers','sessions','live_updates'],
    has_sessions: true,
    has_speakers: true,
    session_types: ['workshop','demo','q_and_a'],
  },
  networking: {
    label: 'Networking', icon: '🤝', color: '#6366f1',
    features: ['speakers','sessions','live_updates'],
    has_speakers: true,
    has_sessions: true,
  },
  edu: {
    label: 'Education / Training', icon: '📚', color: '#0891b2',
    features: ['sessions','speakers','live_updates'],
    has_sessions: true,
    has_speakers: true,
    session_types: ['talk','workshop','breakout','q_and_a','demo'],
  },
  // ── Graduation / Ceremonies ───────────────────────────────────────────────
  graduation: {
    label: 'Graduation', icon: '🎓', color: '#f59e0b',
    features: ['lineup','sessions','live_updates','gallery'],
    lineup_roles: ['Graduate','Valedictorian','Dean','Guest Speaker','MC'],
    has_sessions: true,
    session_types: ['procession','speech','awards','ceremony','reception'],
  },
  wedding: {
    label: 'Wedding', icon: '💍', color: '#ec4899',
    features: ['lineup','sessions','vendors','live_updates','gallery'],
    lineup_roles: ['Bride','Groom','Best Man','Maid of Honour','Officiant','MC','DJ','Live Band'],
    has_sessions: true,
    has_vendors: true,
    session_types: ['ceremony','cocktail_hour','reception','speeches','first_dance','cake_cutting'],
    vendor_categories: ['Catering','Bar','Florist','Photographer','Cake','Decor'],
  },
  birthday: {
    label: 'Birthday Party', icon: '🎂', color: '#f59e0b',
    features: ['lineup','vendors','live_updates','gallery'],
    lineup_roles: ['Birthday Person','DJ','MC','Performer','Host'],
    has_vendors: true,
    vendor_categories: ['Catering','Cake','Bar','Decor','Entertainment'],
  },
  // ── Arts ─────────────────────────────────────────────────────────────────
  art: {
    label: 'Arts / Exhibition', icon: '🎨', color: '#f472b6',
    features: ['lineup','live_updates','gallery'],
    lineup_roles: ['Featured Artist','Guest Artist','Curator','Gallery Guide','Performer'],
    has_judge_scores: true,
  },
  // ── Default ───────────────────────────────────────────────────────────────
  default: {
    label: 'General Event', icon: '🎉', color: '#00f2ff',
    features: ['lineup','live_updates','gallery'],
    lineup_roles: ['Featured Guest','Host','Speaker','Performer','VIP'],
  },
};

export function getEventMgmtConfig(category) {
  return EVENT_MGMT_CONFIG[category] || EVENT_MGMT_CONFIG.default;
}

// ─────────────────────────────────────────────────────────────────────────────
// LINEUP MANAGER
// ─────────────────────────────────────────────────────────────────────────────

export const LineupManager = {
  async list(eventId) {
    const { data } = await supabase
      .from('event_lineup')
      .select('*')
      .eq('event_id', eventId)
      .order('set_date', { ascending: true, nullsFirst: true })
      .order('set_start', { ascending: true, nullsFirst: true })
      .order('position', { ascending: true });
    return data || [];
  },

  async create(eventId, item) {
    const { data, error } = await supabase
      .from('event_lineup')
      .insert({ event_id: eventId, ...item })
      .select().single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('event_lineup')
      .update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    await supabase.from('event_lineup').delete().eq('id', id);
  },

  async reorder(eventId, orderedIds) {
    const updates = orderedIds.map((id, i) =>
      supabase.from('event_lineup').update({ position: i }).eq('id', id)
    );
    await Promise.all(updates);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// STAGE MANAGER
// ─────────────────────────────────────────────────────────────────────────────

export const StageManager = {
  async list(eventId) {
    const { data } = await supabase
      .from('event_stages')
      .select('*')
      .eq('event_id', eventId)
      .order('position', { ascending: true });
    return data || [];
  },

  async create(eventId, stage) {
    const { data, error } = await supabase
      .from('event_stages')
      .insert({ event_id: eventId, ...stage })
      .select().single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('event_stages').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    await supabase.from('event_stages').delete().eq('id', id);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SETLIST MANAGER
// ─────────────────────────────────────────────────────────────────────────────

export const SetlistManager = {
  async list(eventId, lineupId = null) {
    let q = supabase.from('event_setlists')
      .select('*')
      .eq('event_id', eventId)
      .order('track_number', { ascending: true });
    if (lineupId) q = q.eq('lineup_id', lineupId);
    const { data } = await q;
    return data || [];
  },

  async create(eventId, item) {
    const { data, error } = await supabase
      .from('event_setlists')
      .insert({ event_id: eventId, ...item })
      .select().single();
    if (error) throw error;
    return data;
  },

  async markPlayed(id) {
    const { data, error } = await supabase
      .from('event_setlists')
      .update({ is_played: true, played_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async unmarkPlayed(id) {
    const { data, error } = await supabase
      .from('event_setlists')
      .update({ is_played: false, played_at: null })
      .eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    await supabase.from('event_setlists').delete().eq('id', id);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR MANAGER
// ─────────────────────────────────────────────────────────────────────────────

export const VendorManager = {
  async list(eventId) {
    const { data } = await supabase
      .from('event_vendors')
      .select('*')
      .eq('event_id', eventId)
      .order('stall_number', { ascending: true });
    return data || [];
  },

  async create(eventId, vendor) {
    const { data, error } = await supabase
      .from('event_vendors')
      .insert({ event_id: eventId, ...vendor })
      .select().single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('event_vendors').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async addMenuItem(vendorId, item) {
    const { data: vendor } = await supabase
      .from('event_vendors').select('menu_items').eq('id', vendorId).single();
    const menu = Array.isArray(vendor?.menu_items) ? vendor.menu_items : [];
    const newItem = { id: Date.now().toString(), available: true, ...item };
    await supabase.from('event_vendors')
      .update({ menu_items: [...menu, newItem] }).eq('id', vendorId);
    return newItem;
  },

  async toggleMenuItemAvailability(vendorId, itemId) {
    const { data: vendor } = await supabase
      .from('event_vendors').select('menu_items').eq('id', vendorId).single();
    const menu = (vendor?.menu_items || []).map(m =>
      m.id === itemId ? { ...m, available: !m.available } : m
    );
    await supabase.from('event_vendors').update({ menu_items: menu }).eq('id', vendorId);
  },

  async delete(id) {
    await supabase.from('event_vendors').delete().eq('id', id);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SESSION MANAGER (Conference / Workshop)
// ─────────────────────────────────────────────────────────────────────────────

export const SessionManager = {
  async list(eventId) {
    const { data } = await supabase
      .from('event_sessions')
      .select('*')
      .eq('event_id', eventId)
      .order('session_date', { ascending: true, nullsFirst: true })
      .order('start_time', { ascending: true, nullsFirst: true })
      .order('position', { ascending: true });
    return data || [];
  },

  async create(eventId, session) {
    const { data, error } = await supabase
      .from('event_sessions')
      .insert({ event_id: eventId, ...session })
      .select().single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('event_sessions').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async setLive(id, isLive) {
    const { data, error } = await supabase
      .from('event_sessions')
      .update({ is_live: isLive })
      .eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    await supabase.from('event_sessions').delete().eq('id', id);
  },

  subscribeToEvent(eventId, onChange) {
    const ch = supabase.channel(`sessions:${eventId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'event_sessions', filter: `event_id=eq.${eventId}` },
        () => onChange()
      ).subscribe();
    return () => supabase.removeChannel(ch);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SPEAKER MANAGER
// ─────────────────────────────────────────────────────────────────────────────

export const SpeakerManager = {
  async list(eventId) {
    const { data } = await supabase
      .from('event_speakers')
      .select('*')
      .eq('event_id', eventId)
      .order('is_keynote', { ascending: false })
      .order('position', { ascending: true });
    return data || [];
  },

  async create(eventId, speaker) {
    const { data, error } = await supabase
      .from('event_speakers')
      .insert({ event_id: eventId, ...speaker })
      .select().single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('event_speakers').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    await supabase.from('event_speakers').delete().eq('id', id);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TEAM MANAGER (Hackathon / Competition)
// ─────────────────────────────────────────────────────────────────────────────

export const HackTeamManager = {
  async list(eventId) {
    const { data } = await supabase
      .from('event_teams')
      .select('*')
      .eq('event_id', eventId)
      .order('score', { ascending: false, nullsFirst: false })
      .order('name', { ascending: true });
    return data || [];
  },

  async create(eventId, team) {
    const { data, error } = await supabase
      .from('event_teams')
      .insert({ event_id: eventId, ...team })
      .select().single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('event_teams').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async submitProject(id, projectData) {
    const { data, error } = await supabase
      .from('event_teams')
      .update({ ...projectData, submitted: true, submitted_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async setScore(id, score, judgeNotes = '') {
    const { data, error } = await supabase
      .from('event_teams')
      .update({ score, judge_notes: judgeNotes })
      .eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    await supabase.from('event_teams').delete().eq('id', id);
  },

  async getLeaderboard(eventId) {
    const { data } = await supabase
      .from('event_teams')
      .select('*')
      .eq('event_id', eventId)
      .not('score', 'is', null)
      .order('score', { ascending: false });
    return (data || []).map((t, i) => ({ ...t, position: i + 1 }));
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// JUDGE SCORE MANAGER
// ─────────────────────────────────────────────────────────────────────────────

export const JudgeScoreManager = {
  async list(eventId, participantId = null) {
    let q = supabase.from('event_judge_scores')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    if (participantId) q = q.eq('participant_id', participantId);
    const { data } = await q;
    return data || [];
  },

  async submit(eventId, scoreData) {
    const { data, error } = await supabase
      .from('event_judge_scores')
      .insert({ event_id: eventId, ...scoreData })
      .select().single();
    if (error) throw error;
    return data;
  },

  async getParticipantAverages(eventId) {
    const { data } = await supabase
      .from('event_judge_scores')
      .select('participant_id, participant_name, score')
      .eq('event_id', eventId);
    if (!data?.length) return [];
    const map = {};
    data.forEach(s => {
      if (!map[s.participant_id]) map[s.participant_id] = { name: s.participant_name, total: 0, count: 0 };
      map[s.participant_id].total += s.score;
      map[s.participant_id].count++;
    });
    return Object.entries(map)
      .map(([id, v]) => ({ participant_id: id, name: v.name, average: +(v.total / v.count).toFixed(2), count: v.count }))
      .sort((a, b) => b.average - a.average)
      .map((p, i) => ({ ...p, position: i + 1 }));
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LIVE UPDATES MANAGER (works for all event types)
// ─────────────────────────────────────────────────────────────────────────────

export const LiveUpdatesManager = {
  async list(eventId, limit = 30) {
    const { data } = await supabase
      .from('event_updates')
      .select('*, profiles(username, avatar_url)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data || []).reverse();
  },

  async post(eventId, authorId, body, type = 'general', mediaUrl = null) {
    const { data, error } = await supabase
      .from('event_updates')
      .insert({
        event_id: eventId,
        author_id: authorId,
        body,
        update_type: type,
        media_url: mediaUrl || null,
      })
      .select().single();
    if (error) throw error;
    return data;
  },

  async pin(id) {
    await supabase.from('event_updates').update({ is_pinned: true }).eq('id', id);
  },

  async unpin(id) {
    await supabase.from('event_updates').update({ is_pinned: false }).eq('id', id);
  },

  async delete(id) {
    await supabase.from('event_updates').delete().eq('id', id);
  },

  subscribe(eventId, onUpdate) {
    const ch = supabase.channel(`event_updates:${eventId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'event_updates', filter: `event_id=eq.${eventId}` },
        payload => onUpdate?.(payload.new)
      ).subscribe();
    return () => supabase.removeChannel(ch);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED FETCH — get all management data for an event at once
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchEventManagementData(eventId, category) {
  const cfg = getEventMgmtConfig(category);
  const features = cfg.features || [];
  const fetches = {};

  if (features.includes('lineup'))      fetches.lineup      = LineupManager.list(eventId);
  if (features.includes('stages'))      fetches.stages      = StageManager.list(eventId);
  if (features.includes('setlist'))     fetches.setlist     = SetlistManager.list(eventId);
  if (features.includes('vendors'))     fetches.vendors     = VendorManager.list(eventId);
  if (features.includes('sessions'))    fetches.sessions    = SessionManager.list(eventId);
  if (features.includes('speakers'))    fetches.speakers    = SpeakerManager.list(eventId);
  if (features.includes('teams'))       fetches.teams       = HackTeamManager.list(eventId);
  if (features.includes('judge_scores')) fetches.judgeScores = JudgeScoreManager.getParticipantAverages(eventId);
  if (features.includes('live_updates')) fetches.updates    = LiveUpdatesManager.list(eventId);

  const keys = Object.keys(fetches);
  const results = await Promise.allSettled(Object.values(fetches));
  const out = {};
  keys.forEach((k, i) => {
    out[k] = results[i].status === 'fulfilled' ? results[i].value : [];
  });
  return out;
}

export default {
  EVENT_MGMT_CONFIG, getEventMgmtConfig,
  LineupManager, StageManager, SetlistManager, VendorManager,
  SessionManager, SpeakerManager, HackTeamManager, JudgeScoreManager,
  LiveUpdatesManager, fetchEventManagementData,
};
