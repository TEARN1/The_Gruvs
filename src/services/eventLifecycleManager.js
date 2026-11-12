/**
 * The Gruvs — Event Lifecycle Manager
 * Centralizes state and interaction across Pre-Event, Live Venue, and Post-Event phases.
 * Eliminates data silos so actions in one stage enrich the rest of the application.
 */

import { supabase, isSupabaseEnabled } from './supabase';
import { getEventPhase, PHASE_META } from '../utils/eventPhase';
import { lifecycleState } from '../utils/eventLifecycle';
import { logError } from '../utils/logError';
import { SmartAlertEngine } from './smartAlertEngine';

// Local in-memory caches for offline resilience & tests
const localStarredLineups = new Map(); // eventId -> Set of itemIds
const localFitChecks = new Map();      // eventId -> Array of fit check objects
const localPackingLists = new Map();   // `${eventId}:${category}` -> Array of packing items
const localStageRequests = new Map();  // eventId -> Array of song / Q&A requests
const localDiaries = new Map();        // `${eventId}:${userId}` -> diary object

export const EventLifecycleManager = {
  /**
   * Determine exact lifecycle stage and sub-window.
   */
  getPhase(event, options = {}) {
    if (!event) return { phase: 'pre_event', window: 'days_before', meta: PHASE_META.pre_event };
    const phaseInfo = getEventPhase(event, options);
    const state = lifecycleState(event, options.now || Date.now());
    return {
      ...phaseInfo,
      state,
      isLive: phaseInfo.phase === 'during_event' || state === 'live',
      isUpcoming: phaseInfo.phase === 'pre_event' || state === 'upcoming',
      isEnded: phaseInfo.phase === 'post_event' || state === 'ended' || state === 'recent',
      meta: PHASE_META[phaseInfo.phase] || PHASE_META.pre_event,
    };
  },

  // ── 1. Starred Lineup & Custom Schedule ──────────────────────────────────
  async starScheduleItem(eventId, itemId, itemData = {}, userId = 'anon') {
    if (!eventId || !itemId) return false;
    if (!localStarredLineups.has(eventId)) {
      localStarredLineups.set(eventId, new Set());
    }
    localStarredLineups.get(eventId).add(itemId);

    if (isSupabaseEnabled && userId && userId !== 'anon') {
      try {
        await supabase.from('event_schedule_bookmarks').upsert({
          event_id: eventId,
          schedule_item_id: itemId,
          user_id: userId,
          item_data: itemData,
        }, { onConflict: 'user_id,event_id,schedule_item_id' });
      } catch (e) {
        logError('EventLifecycleManager.starScheduleItem', e);
      }
    }
    return true;
  },

  async unstarScheduleItem(eventId, itemId, userId = 'anon') {
    if (!eventId || !itemId) return false;
    if (localStarredLineups.has(eventId)) {
      localStarredLineups.get(eventId).delete(itemId);
    }

    if (isSupabaseEnabled && userId && userId !== 'anon') {
      try {
        await supabase.from('event_schedule_bookmarks')
          .delete()
          .eq('event_id', eventId)
          .eq('schedule_item_id', itemId)
          .eq('user_id', userId);
      } catch (e) {
        logError('EventLifecycleManager.unstarScheduleItem', e);
      }
    }
    return true;
  },

  isItemStarred(eventId, itemId) {
    if (!eventId || !itemId || !localStarredLineups.has(eventId)) return false;
    return localStarredLineups.get(eventId).has(itemId);
  },

  async getStarredLineup(eventId, userId = 'anon') {
    if (!eventId) return [];
    if (localStarredLineups.has(eventId)) {
      return Array.from(localStarredLineups.get(eventId));
    }

    if (isSupabaseEnabled && userId && userId !== 'anon') {
      try {
        const { data } = await supabase
          .from('event_schedule_bookmarks')
          .select('schedule_item_id')
          .eq('event_id', eventId)
          .eq('user_id', userId);
        if (data) {
          const itemIds = data.map((r) => r.schedule_item_id);
          localStarredLineups.set(eventId, new Set(itemIds));
          return itemIds;
        }
      } catch (e) {
        logError('EventLifecycleManager.getStarredLineup', e);
      }
    }
    return [];
  },

  // ── 2. Fit Check Photo Rail & Submissions ────────────────────────────────
  async submitFitCheck(eventId, fitCheck) {
    if (!eventId || !fitCheck) return null;
    const entry = {
      id: fitCheck.id || `fit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      eventId,
      userId: fitCheck.userId || 'anon',
      userName: fitCheck.userName || 'Viber',
      userAvatar: fitCheck.userAvatar || null,
      photoUrl: fitCheck.photoUrl || '',
      caption: fitCheck.caption || '',
      likesCount: 0,
      createdAt: new Date().toISOString(),
    };

    if (!localFitChecks.has(eventId)) {
      localFitChecks.set(eventId, []);
    }
    localFitChecks.get(eventId).unshift(entry);

    if (isSupabaseEnabled) {
      try {
        await supabase.from('event_fit_checks').insert({
          event_id: eventId,
          user_id: entry.userId,
          user_name: entry.userName,
          photo_url: entry.photoUrl,
          caption: entry.caption,
          created_at: entry.createdAt,
        });
      } catch (e) {
        logError('EventLifecycleManager.submitFitCheck', e);
      }
    }
    return entry;
  },

  async getFitChecks(eventId) {
    if (!eventId) return [];
    if (localFitChecks.has(eventId) && localFitChecks.get(eventId).length > 0) {
      return localFitChecks.get(eventId);
    }

    if (isSupabaseEnabled) {
      try {
        const { data } = await supabase
          .from('event_fit_checks')
          .select('*')
          .eq('event_id', eventId)
          .order('created_at', { ascending: false })
          .limit(20);
        if (data && data.length > 0) {
          const normalized = data.map((d) => ({
            id: d.id,
            eventId: d.event_id,
            userId: d.user_id,
            userName: d.user_name || 'Viber',
            photoUrl: d.photo_url,
            caption: d.caption,
            likesCount: d.likes_count || 0,
            createdAt: d.created_at,
          }));
          localFitChecks.set(eventId, normalized);
          return normalized;
        }
      } catch (e) {
        logError('EventLifecycleManager.getFitChecks', e);
      }
    }

    // Default sample fit-checks for preview
    return [
      {
        id: 'sample_fit_1',
        eventId,
        userName: 'Lerato K.',
        photoUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400',
        caption: 'Ready for the vibe! All-black velvet drip ✨',
        likesCount: 24,
      },
      {
        id: 'sample_fit_2',
        eventId,
        userName: 'Sipho D.',
        photoUrl: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=400',
        caption: 'Sneaker check & retro jersey 🔥',
        likesCount: 18,
      },
    ];
  },

  // ── 3. Category-Tailored Packing Checklist ────────────────────────────────
  getPackingChecklist(category = 'music', eventId = 'global') {
    const cacheKey = `${eventId}:${category}`;
    if (localPackingLists.has(cacheKey)) {
      return localPackingLists.get(cacheKey);
    }

    const cat = String(category || '').toLowerCase();
    let baseItems = [
      { id: 'item_ticket', label: 'Digital Ticket / Barcode in app', checked: true, essential: true },
      { id: 'item_id', label: 'National ID / Driver License', checked: false, essential: true },
      { id: 'item_phone', label: 'Charged Phone + Power Bank', checked: false, essential: true },
      { id: 'item_card', label: 'Bank Card / Tap-to-Pay (Cashless)', checked: false, essential: false },
    ];

    if (cat.includes('outdoor') || cat.includes('festival')) {
      baseItems.push(
        { id: 'item_shades', label: 'Sunglasses & Sunscreen', checked: false },
        { id: 'item_blanket', label: 'Picnic Blanket / Camp Chair', checked: false },
        { id: 'item_cooler', label: 'Cooler Box Pass & Ice', checked: false }
      );
    } else if (cat.includes('sport') || cat.includes('soccer')) {
      baseItems.push(
        { id: 'item_scarf', label: 'Team Jersey or Scarf', checked: false },
        { id: 'item_sneakers', label: 'Turf Boots / Sneakers', checked: false },
        { id: 'item_water', label: 'Hydration / Energy Water', checked: false }
      );
    } else {
      baseItems.push(
        { id: 'item_jacket', label: 'Light Warm Jacket for late evening', checked: false },
        { id: 'item_mints', label: 'Breath mints & Lip balm', checked: false }
      );
    }

    localPackingLists.set(cacheKey, baseItems);
    return baseItems;
  },

  togglePackingItem(eventId, category, itemId, checked) {
    const cacheKey = `${eventId}:${category}`;
    const items = this.getPackingChecklist(category, eventId);
    const updated = items.map((item) => (item.id === itemId ? { ...item, checked } : item));
    localPackingLists.set(cacheKey, updated);
    return updated;
  },

  // ── 4. Live Q&A and DJ Track Requests ────────────────────────────────────
  async submitStageRequest(eventId, request) {
    if (!eventId || !request) return null;
    const entry = {
      id: request.id || `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      eventId,
      userId: request.userId || 'anon',
      userName: request.userName || 'Attendee',
      type: request.type || 'dj_song', // 'dj_song' | 'qa_question'
      title: request.title || request.text || '',
      artist: request.artist || '',
      upvotes: 1,
      hasUpvoted: true,
      createdAt: new Date().toISOString(),
    };

    if (!localStageRequests.has(eventId)) {
      localStageRequests.set(eventId, []);
    }
    localStageRequests.get(eventId).unshift(entry);

    if (isSupabaseEnabled) {
      try {
        await supabase.from('event_stage_requests').insert({
          event_id: eventId,
          user_id: entry.userId,
          user_name: entry.userName,
          request_type: entry.type,
          title: entry.title,
          artist: entry.artist,
          upvotes: entry.upvotes,
        });
      } catch (e) {
        logError('EventLifecycleManager.submitStageRequest', e);
      }
    }
    return entry;
  },

  async upvoteStageRequest(eventId, requestId, userId = 'anon') {
    if (!eventId || !requestId) return false;
    const list = localStageRequests.get(eventId) || [];
    const item = list.find((r) => r.id === requestId);
    if (item) {
      item.upvotes = (item.upvotes || 0) + 1;
      item.hasUpvoted = true;
    }

    if (isSupabaseEnabled) {
      try {
        await supabase.rpc('upvote_stage_request', { p_request_id: requestId, p_user_id: userId });
      } catch (e) {
        logError('EventLifecycleManager.upvoteStageRequest', e);
      }
    }
    return true;
  },

  async getStageRequests(eventId) {
    if (!eventId) return [];
    if (localStageRequests.has(eventId) && localStageRequests.get(eventId).length > 0) {
      return localStageRequests.get(eventId);
    }

    if (isSupabaseEnabled) {
      try {
        const { data } = await supabase
          .from('event_stage_requests')
          .select('*')
          .eq('event_id', eventId)
          .order('upvotes', { ascending: false })
          .limit(30);
        if (data && data.length > 0) {
          const list = data.map((d) => ({
            id: d.id,
            eventId: d.event_id,
            userId: d.user_id,
            userName: d.user_name || 'Viber',
            type: d.request_type || 'dj_song',
            title: d.title,
            artist: d.artist,
            upvotes: d.upvotes || 1,
            hasUpvoted: false,
          }));
          localStageRequests.set(eventId, list);
          return list;
        }
      } catch (e) {
        logError('EventLifecycleManager.getStageRequests', e);
      }
    }

    // Default stage starter requests
    return [
      {
        id: 'req_default_1',
        eventId,
        userName: 'Tshepo',
        type: 'dj_song',
        title: 'Tshwala Bam (Remix)',
        artist: 'TitoM & Yuppe',
        upvotes: 19,
        hasUpvoted: false,
      },
      {
        id: 'req_default_2',
        eventId,
        userName: 'Nandi',
        type: 'qa_question',
        title: 'What time does the surprise guest take the main stage?',
        artist: '',
        upvotes: 14,
        hasUpvoted: false,
      },
    ];
  },

  // ── 5. Post-Event Digital Diary & Memory Vault ───────────────────────────
  async getEventDiary(eventId, userId = 'anon') {
    const key = `${eventId}:${userId}`;
    if (localDiaries.has(key)) {
      return localDiaries.get(key);
    }

    const defaultDiary = {
      eventId,
      userId,
      ticketStamped: true,
      stampedDate: new Date().toLocaleDateString(),
      attendedSetsCount: (localStarredLineups.get(eventId) || new Set()).size,
      fitCheckCount: (localFitChecks.get(eventId) || []).length,
      personalNotes: '',
      peopleMet: 4,
      savedMemories: true,
    };

    localDiaries.set(key, defaultDiary);
    return defaultDiary;
  },

  async saveDiaryNotes(eventId, userId = 'anon', notes = '') {
    const key = `${eventId}:${userId}`;
    const diary = await this.getEventDiary(eventId, userId);
    diary.personalNotes = notes;
    localDiaries.set(key, diary);

    if (isSupabaseEnabled && userId && userId !== 'anon') {
      try {
        await supabase.from('user_event_diaries').upsert({
          event_id: eventId,
          user_id: userId,
          personal_notes: notes,
          updated_at: new Date().toISOString(),
        });
      } catch (e) {
        logError('EventLifecycleManager.saveDiaryNotes', e);
      }
    }
    return diary;
  },
};

export default EventLifecycleManager;
