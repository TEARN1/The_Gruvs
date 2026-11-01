/**
 * clipEventSuggest.js — which event a new clip should be tagged to by default.
 *
 * Only 1 of the first 10 reels was tagged to an event, and an untagged clip
 * has no RSVP button, so it can never send anyone to the event it shows. The
 * picker used to start on "None". Now it starts on the event the person is
 * most likely filming:
 *   1. the event they opened "Add a clip" from,
 *   2. else the event they checked into most recently (the query only asks for
 *      the last 12 hours),
 *   3. else an event they host or RSVP'd to that is on today.
 * They can still switch to another event or to None.
 */

const todayISO = (now = new Date()) => {
  const d = new Date(now.getTime() - now.getTimezoneOffset() * 60000); // local date, not UTC
  return d.toISOString().slice(0, 10);
};

const dayOf = (e) => String(e?.event_date || '').slice(0, 10);

/**
 * @param {{ preset?: object, checkins?: object[], authored?: object[], rsvped?: object[], now?: Date }} input
 *   checkins: events from the user's recent check-ins, newest first.
 * @returns {{ list: object[], suggested: object|null }}
 */
export function rankTaggableEvents({ preset = null, checkins = [], authored = [], rsvped = [], now = new Date() } = {}) {
  const today = todayISO(now);
  const byId = new Map();
  const add = (e) => { if (e?.id && !byId.has(e.id)) byId.set(e.id, e); };
  add(preset);
  checkins.forEach(add);
  authored.forEach(add);
  rsvped.forEach(add);

  const suggested = (preset?.id && byId.get(preset.id))
    || checkins.find((e) => e?.id)
    || [...authored, ...rsvped].find((e) => e?.id && dayOf(e) === today)
    || null;

  const list = Array.from(byId.values()).sort((a, b) => {
    if (suggested && a.id === suggested.id) return -1;
    if (suggested && b.id === suggested.id) return 1;
    const at = dayOf(a) === today, bt = dayOf(b) === today;
    if (at !== bt) return at ? -1 : 1;
    return dayOf(b).localeCompare(dayOf(a));
  });

  return { list, suggested: suggested ? byId.get(suggested.id) : null };
}

export default rankTaggableEvents;
