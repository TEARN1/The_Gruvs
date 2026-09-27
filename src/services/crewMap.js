/**
 * crewMap.js — "Crew Convergence": where the people you follow are heading.
 *
 * The forward-looking Path Map the founder always wanted — not a history of
 * dots, but tonight's INTENT: who among your crew marked "Going" where, so you
 * can plan where to meet. Deliberate presence (an RSVP is a chosen act), never
 * ambient GPS; only people you follow; grouped by event so a convergence
 * ("4 of your crew are landing on Braam") reads at a glance.
 */
import { supabase } from './supabase';

export async function getCrewPlans(userId) {
  if (!userId) return [];
  try {
    // People you follow.
    const { data: fData } = await supabase
      .from('follows').select('following_id').eq('follower_id', userId).limit(500);
    const ids = (fData || []).map((r) => r.following_id).filter(Boolean);
    if (!ids.length) return [];

    const today = new Date().toISOString().split('T')[0];

    // Their upcoming "Going" intent + the event + who they are.
    const { data } = await supabase
      .from('event_rsvps')
      .select('event_id, user_id, events!inner(id, title, latitude, longitude, lat, lon, event_date, deleted_at), profiles:user_id(id, username, avatar_url)')
      .in('user_id', ids)
      .eq('status', 'going')
      .gte('events.event_date', today)
      .limit(600);

    // Group by event → a convergence is simply an event with several of your crew.
    const byEvent = new Map();
    for (const r of data || []) {
      const e = r.events;
      if (!e || e.deleted_at) continue;
      const lat = e.lat ?? e.latitude, lng = e.lon ?? e.longitude;
      if (lat == null || lng == null) continue;
      if (!byEvent.has(e.id)) {
        byEvent.set(e.id, {
          eventId: e.id, title: e.title || 'Event',
          lat: Number(lat), lng: Number(lng),
          event_date: e.event_date, people: [],
        });
      }
      const p = r.profiles;
      if (p && !byEvent.get(e.id).people.some((x) => x.id === p.id)) {
        byEvent.get(e.id).people.push({ id: p.id, username: p.username, avatar_url: p.avatar_url });
      }
    }
    return [...byEvent.values()].sort((a, b) => b.people.length - a.people.length);
  } catch {
    return [];
  }
}
