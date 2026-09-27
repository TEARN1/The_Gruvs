/**
 * moderationQueue — admin-only client for the report→auto-hide review queue.
 * Thin wrapper over the admin-gated SECURITY DEFINER RPCs (get_moderation_queue
 * / moderate_content). All authority lives server-side; this just calls it.
 */
import { supabase } from './supabase';

/** Auto-hidden items awaiting review, most-recently-reported first. [] if none / not admin. */
export async function getModerationQueue() {
  try {
    const { data, error } = await supabase.rpc('get_moderation_queue');
    if (error) throw error;
    return (data || []).map(r => ({
      type: r.content_type,
      id: r.content_id,
      label: r.label,
      reports: Number(r.reports) || 0,
      lastReported: r.last_reported,
    }));
  } catch (e) {
    console.warn('[moderation] getModerationQueue failed:', e.message);
    return [];
  }
}

/** action: 'restore' (false alarm — un-hide) | 'remove' (confirmed — take down). */
export async function moderateContent(type, id, action) {
  if (!type || !id || !['restore', 'remove'].includes(action)) return false;
  try {
    const { error } = await supabase.rpc('moderate_content', { p_type: type, p_id: id, p_action: action });
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('[moderation] moderateContent failed:', e.message);
    return false;
  }
}

export default { getModerationQueue, moderateContent };
