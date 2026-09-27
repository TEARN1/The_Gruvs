/**
 * hostStats — a host's track record, for the "Reliable host" badge.
 *
 * Surfaces the Truth Score (utils/hostScore) on the event page: does this host
 * actually deliver what they promise? It's the one signal WhatsApp/Facebook
 * Events can't show, because they have no verified attendance.
 *
 * Deliberately honest about sparsity: hostReliability returns confident:false
 * (and reliabilityLabel returns '') until there are 3+ judged events, so the
 * badge simply does not appear for a new host — no history is shown as neutral,
 * never invented, never as a black mark.
 */
import { supabase } from './supabase';
import { logError } from '../utils/logError';
import { hostReliability, reliabilityLabel } from '../utils/hostScore';

const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * @returns {Promise<{ label:string, rel:{score,confident,sample,delivered} }>}
 */
export async function getHostReliability(hostId) {
  const empty = { label: '', rel: { score: 0.5, confident: false, sample: 0, delivered: 0 } };
  if (!hostId) return empty;
  try {
    // Their past events — only fields the Truth Score reads. `going` is the
    // denormalised RSVP count.
    //
    // Verified presence is NOT a column on `events`. This used to select
    // `here_count`, which is defined in no migration and never existed, so the
    // query 400'd and EVERY host silently scored as having no history — the
    // Truth Score was inert. `checkin_count` is not on events either (it
    // belongs to event_analytics_snapshots), so the real source is a count of
    // live_checkins rows per event.
    const { data, error } = await supabase
      .from('events')
      .select('id, event_date, going, status')
      .eq('author_id', hostId)
      .lt('event_date', todayStr())
      .order('event_date', { ascending: true })
      .limit(50);
    if (error) throw error;
    if (!data?.length) return empty;

    // One round trip for all of them, then tally per event locally — a
    // per-event count query would be 50 requests to render one badge.
    const ids = data.map(e => e.id);
    const { data: checkins } = await supabase
      .from('live_checkins')
      .select('event_id')
      .in('event_id', ids);
    const hereByEvent = new Map();
    for (const c of checkins || []) {
      hereByEvent.set(c.event_id, (hereByEvent.get(c.event_id) || 0) + 1);
    }

    const past = data.map((e) => ({
      is_past: true,
      status: e.status,
      rsvp_count: Number(e.going) || 0,
      checkin_count: hereByEvent.get(e.id) || 0,
    }));

    const rel = hostReliability(past);
    return { label: reliabilityLabel(rel), rel };
  } catch (e) {
    logError('HostStats.reliability', e, { hostId });
    return empty;
  }
}

export default { getHostReliability };
