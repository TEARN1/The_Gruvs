/**
 * sessionReminders — "My Agenda": per-session opt-in on an event's schedule.
 *
 * Sibling to ReminderManager (dataFlow.js), same shape, one level more
 * specific: ReminderManager reminds you the whole event is starting;
 * this reminds you a SPECIFIC session on the schedule is starting, the way
 * a conference app lets you build a personal agenda across parallel tracks.
 *
 * `sessionIdx` keys into event.schedule[] (array index) — the same identity
 * EventScheduleSection.js already uses to attach polls to a slot, so no new
 * id scheme was introduced. `sessionTime` is the resolved absolute timestamp
 * the caller computes from event.event_date + (slot.day-1) days at
 * slot.time — stored so the DB dispatcher (dispatch_reminders(), see
 * supabase/queries/event_info_and_session_reminders.sql) never has to parse
 * schedule JSON.
 *
 * Delivery: a pg_cron job (gruvs-session-reminders, every 5 min) calls
 * dispatch_reminders() server-side, which inserts into `notifications` for
 * any selection within 15 minutes of session_time. This module only manages
 * the selection rows — it does not send anything itself.
 */
import { supabase } from './supabase';
import { logError } from '../utils/logError';

export const SessionReminders = {
  /** True if the user has this session added to their agenda. */
  async isSelected(userId, eventId, sessionIdx) {
    if (!userId || !eventId) return false;
    try {
      const { data } = await supabase
        .from('event_session_selections')
        .select('id')
        .eq('user_id', userId).eq('event_id', eventId).eq('session_idx', sessionIdx)
        .maybeSingle();
      return !!data;
    } catch { return false; }
  },

  /** All of this user's selected session indices for one event, as a Set. */
  async getMySelections(userId, eventId) {
    if (!userId || !eventId) return new Set();
    try {
      const { data } = await supabase
        .from('event_session_selections')
        .select('session_idx')
        .eq('user_id', userId).eq('event_id', eventId);
      return new Set((data || []).map((r) => r.session_idx));
    } catch { return new Set(); }
  },

  /**
   * Add or remove a session from the user's agenda. `sessionTime` is only
   * needed when adding (a past session is silently accepted but the
   * dispatcher's own `session_time > now()` guard means it will just never
   * fire a reminder — added to the agenda for visibility purposes only).
   * @returns {Promise<boolean>} the new selected state, for optimistic UI.
   */
  async toggle(userId, eventId, sessionIdx, sessionTime) {
    if (!userId || !eventId || sessionIdx == null) return false;
    try {
      const already = await this.isSelected(userId, eventId, sessionIdx);
      if (already) {
        await supabase.from('event_session_selections').delete()
          .eq('user_id', userId).eq('event_id', eventId).eq('session_idx', sessionIdx);
        return false;
      }
      const { error } = await supabase.from('event_session_selections').insert({
        user_id: userId, event_id: eventId, session_idx: sessionIdx,
        session_time: sessionTime,
      });
      if (error) throw error;
      return true;
    } catch (e) {
      logError('SessionReminders.toggle', e, { eventId, sessionIdx });
      return false;
    }
  },
};

export default SessionReminders;
