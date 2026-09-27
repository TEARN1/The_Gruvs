/**
 * GO-OUT NUDGES — rotating motivational pop-ups that push users to HOST, NETWORK,
 * and ATTEND real events. Growth thesis: we don't cap content (post unlimited);
 * we fight inertia. Every nudge ends in a single action (host / explore / view).
 *
 * Dynamic {placeholders} are filled from LIVE data (never fabricated) via fillNudge():
 *   {city} {country} {event} {count} {minutes} {distance} {name}
 * A nudge that `needs` data it doesn't get is skipped by pickNudge — so a user with
 * no nearby events never sees an empty "0 events near you" message.
 */

export const NUDGE_CAT = {
  HOST: 'host',          // host an event (monthly host motivation)
  NETWORK: 'network',    // go meet people
  DISCOVER: 'discover',  // hottest events near you / in your country (dynamic)
  GO_OUT: 'go_out',      // stop scrolling, go experience, FOMO
  CREW: 'crew',          // go with friends
  IDENTITY: 'identity',  // be seen, you're a Viber
  SPECIAL: 'special',    // weekend / payday / birthday / new month
};

// cta is the primary button label; route is where it sends them.
export const GO_OUT_NUDGES = [
  // ── HOST (20) ──────────────────────────────────────────────────────────────
  { id: 1,  cat: 'host', body: "Your city's missing your Gruv. Host one this month.", cta: 'Create event', route: 'host' },
  { id: 2,  cat: 'host', body: 'Hosts run the Kingdom. When’s your next move?', cta: 'Host now', route: 'host' },
  { id: 3,  cat: 'host', body: "You've been to {count} events — time to throw your own.", cta: 'Host an event', route: 'host', needs: ['count'] },
  { id: 4,  cat: 'host', body: 'Every legend started with one party. Start yours.', cta: 'Create', route: 'host' },
  { id: 5,  cat: 'host', body: '30 days, 0 events hosted. Change that today.', cta: 'Host', route: 'host' },
  { id: 6,  cat: 'host', body: "The best night in {city} could be yours. Make it.", cta: 'Create event', route: 'host', needs: ['city'] },
  { id: 7,  cat: 'host', body: "Don't wait for the vibe. Be the vibe. Host.", cta: 'Host now', route: 'host' },
  { id: 8,  cat: 'host', body: 'Your followers want to see YOU host.', cta: 'Create event', route: 'host' },
  { id: 9,  cat: 'host', body: 'Hosting earns you Sovereign status. Claim it.', cta: 'Host', route: 'host' },
  { id: 10, cat: 'host', body: 'One event a month keeps you on the map.', cta: 'Create', route: 'host' },
  { id: 11, cat: 'host', body: 'Turn your idea into a Gruv tonight.', cta: 'Host', route: 'host' },
  { id: 12, cat: 'host', body: '{city} needs more hosts like you.', cta: 'Create event', route: 'host', needs: ['city'] },
  { id: 13, cat: 'host', body: 'Imagine 100 people pulling up to your event.', cta: 'Host now', route: 'host' },
  { id: 14, cat: 'host', body: 'You bring people together. Make it official.', cta: 'Create', route: 'host' },
  { id: 15, cat: 'host', body: 'Empty calendar? Fill it with your own Gruv.', cta: 'Host', route: 'host' },
  { id: 16, cat: 'host', body: 'Be the reason your crew goes out this weekend.', cta: 'Create event', route: 'host' },
  { id: 17, cat: 'host', body: 'Hosting is the fastest way to grow your name.', cta: 'Host now', route: 'host' },
  { id: 18, cat: 'host', body: 'From attendee to host. Level up this month.', cta: 'Create', route: 'host' },
  { id: 19, cat: 'host', body: "The mic's open. Throw the event only you can.", cta: 'Host', route: 'host' },
  { id: 20, cat: 'host', body: 'Your monthly Gruv is overdue. Let’s go.', cta: 'Create event', route: 'host' },

  // ── NETWORK (15) ───────────────────────────────────────────────────────────
  { id: 21, cat: 'network', body: 'The right connection is one event away.', cta: 'Find events', route: 'explore' },
  { id: 22, cat: 'network', body: 'Your network = your net worth. Go meet people.', cta: 'Explore', route: 'explore' },
  { id: 23, cat: 'network', body: 'Nobody networks from the couch. Get out.', cta: 'See events', route: 'explore' },
  { id: 24, cat: 'network', body: 'Shake hands tonight, not just screens.', cta: 'Find a Gruv', route: 'explore' },
  { id: 25, cat: 'network', body: 'The plug you need is at an event near you.', cta: 'Explore now', route: 'explore' },
  { id: 26, cat: 'network', body: 'Real ones meet in real life. Go.', cta: "See what's on", route: 'explore' },
  { id: 27, cat: 'network', body: 'Opportunities wear faces. Go see them.', cta: 'Find events', route: 'explore' },
  { id: 28, cat: 'network', body: 'Your next collab is in the crowd tonight.', cta: 'Explore', route: 'explore' },
  { id: 29, cat: 'network', body: 'Stop DMing. Start meeting.', cta: 'Find events', route: 'explore' },
  { id: 30, cat: 'network', body: 'Business cards beat blue ticks. Network IRL.', cta: 'See events', route: 'explore' },
  { id: 31, cat: 'network', body: '{count} people are out near you right now. Join them.', cta: 'Explore', route: 'explore', needs: ['count'] },
  { id: 32, cat: 'network', body: "Meet someone new this week — there's a Gruv for that.", cta: 'Find events', route: 'explore' },
  { id: 33, cat: 'network', body: 'Your circle grows where the music plays.', cta: 'Explore now', route: 'explore' },
  { id: 34, cat: 'network', body: 'Walk in a stranger, walk out with a connect.', cta: 'See events', route: 'explore' },
  { id: 35, cat: 'network', body: "The room you're not in is where it's happening.", cta: 'Find a Gruv', route: 'explore' },

  // ── DISCOVER (20) — mostly dynamic ─────────────────────────────────────────
  { id: 36, cat: 'discover', body: '🔥 {event} is heating up in {city}. Don’t miss it.', cta: 'View', route: 'event', needs: ['event', 'city'] },
  { id: 37, cat: 'discover', body: '{count} events near you tonight. Pick one.', cta: 'Explore', route: 'explore', needs: ['count'] },
  { id: 38, cat: 'discover', body: 'The hottest Gruv in {country} right now — tap to see.', cta: 'See it', route: 'explore', needs: ['country'] },
  { id: 39, cat: 'discover', body: "Something's turning up {minutes} min from you.", cta: 'Find it', route: 'explore', needs: ['minutes'] },
  { id: 40, cat: 'discover', body: '{city} is alive tonight. Are you out?', cta: 'Explore', route: 'explore', needs: ['city'] },
  { id: 41, cat: 'discover', body: 'Trending now in {country}: {event}.', cta: 'View event', route: 'event', needs: ['country', 'event'] },
  { id: 42, cat: 'discover', body: 'Your area has {count} Gruvs this weekend.', cta: 'See all', route: 'explore', needs: ['count'] },
  { id: 43, cat: 'discover', body: 'People are checking in near you. Go vibe.', cta: 'Explore now', route: 'explore' },
  { id: 44, cat: 'discover', body: '{event} is filling up fast. Grab your spot.', cta: 'RSVP', route: 'event', needs: ['event'] },
  { id: 45, cat: 'discover', body: "Don't read about it tomorrow. Be there tonight.", cta: 'Find events', route: 'explore' },
  { id: 46, cat: 'discover', body: "The map's lit up around you. Take a look.", cta: 'Open map', route: 'map' },
  { id: 47, cat: 'discover', body: '{count} of your follows are going out tonight.', cta: 'See where', route: 'explore', needs: ['count'] },
  { id: 48, cat: 'discover', body: 'Rising fast in {city}: {event}.', cta: 'View', route: 'event', needs: ['city', 'event'] },
  { id: 49, cat: 'discover', body: 'Best vibes in {country} are happening now.', cta: 'Explore', route: 'explore', needs: ['country'] },
  { id: 50, cat: 'discover', body: "There's a Gruv {distance} from you starting soon.", cta: 'See it', route: 'explore', needs: ['distance'] },
  { id: 51, cat: 'discover', body: "Tonight's energy in {city} is unmatched. Pull up.", cta: 'Explore', route: 'explore', needs: ['city'] },
  { id: 52, cat: 'discover', body: '{event} just crossed 100 RSVPs. Join them.', cta: 'RSVP now', route: 'event', needs: ['event'] },
  { id: 53, cat: 'discover', body: 'Your weekend plan is one tap away.', cta: 'Find events', route: 'explore' },
  { id: 54, cat: 'discover', body: 'The streets are talking. {event} is the move.', cta: 'View', route: 'event', needs: ['event'] },
  { id: 55, cat: 'discover', body: 'Hot right now near you 👇', cta: 'Explore', route: 'explore' },

  // ── GO_OUT (20) ────────────────────────────────────────────────────────────
  { id: 56, cat: 'go_out', body: "You've been scrolling a while. Go live it.", cta: 'Find events', route: 'explore' },
  { id: 57, cat: 'go_out', body: "The best memories aren't made indoors.", cta: 'Explore', route: 'explore' },
  { id: 58, cat: 'go_out', body: 'Put the phone down — after you RSVP.', cta: 'Find a Gruv', route: 'explore' },
  { id: 59, cat: 'go_out', body: 'When did you last go out? Tonight fixes that.', cta: 'See events', route: 'explore' },
  { id: 60, cat: 'go_out', body: 'Life happens outside. Go catch it.', cta: 'Explore now', route: 'explore' },
  { id: 61, cat: 'go_out', body: 'Your future self will thank you for going out.', cta: 'Find events', route: 'explore' },
  { id: 62, cat: 'go_out', body: 'FOMO is real. So is this event near you.', cta: 'View', route: 'explore' },
  { id: 63, cat: 'go_out', body: 'Say yes to one night out this week.', cta: 'Explore', route: 'explore' },
  { id: 64, cat: 'go_out', body: 'Great stories start with "we went out."', cta: 'Find a Gruv', route: 'explore' },
  { id: 65, cat: 'go_out', body: "The vibe doesn't come to you. Go to it.", cta: 'See events', route: 'explore' },
  { id: 66, cat: 'go_out', body: 'One night out > a hundred scrolls.', cta: 'Explore', route: 'explore' },
  { id: 67, cat: 'go_out', body: "Don't let the weekend pass you by.", cta: 'Find events', route: 'explore' },
  { id: 68, cat: 'go_out', body: 'Tonight could be the one you remember.', cta: "See what's on", route: 'explore' },
  { id: 69, cat: 'go_out', body: "Get dressed. There's somewhere to be.", cta: 'Explore', route: 'explore' },
  { id: 70, cat: 'go_out', body: 'You deserve a night out. Go claim it.', cta: 'Find a Gruv', route: 'explore' },
  { id: 71, cat: 'go_out', body: "The city's calling. Answer it.", cta: 'Explore now', route: 'explore' },
  { id: 72, cat: 'go_out', body: 'Bored? There’s a cure — {count} of them near you.', cta: 'See events', route: 'explore', needs: ['count'] },
  { id: 73, cat: 'go_out', body: 'Make tonight count. Find your Gruv.', cta: 'Explore', route: 'explore' },
  { id: 74, cat: 'go_out', body: 'Sunsets hit different at an event. Go.', cta: 'Find events', route: 'explore' },
  { id: 75, cat: 'go_out', body: 'Less waiting, more vibing. Step out.', cta: 'Explore', route: 'explore' },

  // ── CREW (10) ──────────────────────────────────────────────────────────────
  { id: 76, cat: 'crew', body: 'Tag your crew and pull up together.', cta: 'Find events', route: 'explore' },
  { id: 77, cat: 'crew', body: 'A night out is better with the squad.', cta: 'Explore', route: 'explore' },
  { id: 78, cat: 'crew', body: 'Your friends are waiting for someone to plan it. Be that one.', cta: 'Host', route: 'host' },
  { id: 79, cat: 'crew', body: 'Round up the crew — there’s a Gruv for you all.', cta: 'See events', route: 'explore' },
  { id: 80, cat: 'crew', body: 'Who are you pulling up with this weekend?', cta: 'Find events', route: 'explore' },
  { id: 81, cat: 'crew', body: 'Make it a group thing. Invite your people.', cta: 'Explore', route: 'explore' },
  { id: 82, cat: 'crew', body: 'The crew that Gruvs together, stays together.', cta: 'Find a Gruv', route: 'explore' },
  { id: 83, cat: 'crew', body: "Don't go alone — bring the whole movement.", cta: 'See events', route: 'explore' },
  { id: 84, cat: 'crew', body: 'Plan the link-up. Start with an event.', cta: 'Explore', route: 'explore' },
  { id: 85, cat: 'crew', body: 'Your group chat needs a plan. Here’s one.', cta: 'Find events', route: 'explore' },

  // ── IDENTITY (10) ──────────────────────────────────────────────────────────
  { id: 86, cat: 'identity', body: 'Put yourself out there. Light your beacon.', cta: 'Go live', route: 'beacon' },
  { id: 87, cat: 'identity', body: "Be seen tonight. The Kingdom's watching.", cta: 'Explore', route: 'explore' },
  { id: 88, cat: 'identity', body: "Real Vibers don't watch from home.", cta: 'Find events', route: 'explore' },
  { id: 89, cat: 'identity', body: 'Your presence is the party. Show up.', cta: 'Explore now', route: 'explore' },
  { id: 90, cat: 'identity', body: 'Build your name — one event at a time.', cta: 'Find a Gruv', route: 'explore' },
  { id: 91, cat: 'identity', body: "You're not a spectator. You're a Sovereign.", cta: 'Host', route: 'host' },
  { id: 92, cat: 'identity', body: 'Show the city who you are. Go out.', cta: 'Explore', route: 'explore' },
  { id: 93, cat: 'identity', body: 'Your vibe deserves an audience. Find one.', cta: 'See events', route: 'explore' },
  { id: 94, cat: 'identity', body: 'Step into the room. Own it.', cta: 'Find events', route: 'explore' },
  { id: 95, cat: 'identity', body: 'Legends are seen, not scrolled.', cta: 'Explore', route: 'explore' },

  // ── SPECIAL (5) — time-aware ───────────────────────────────────────────────
  { id: 96,  cat: 'special', body: "It's the weekend — {city} is waiting.", cta: 'Explore', route: 'explore', needs: ['city'] },
  { id: 97,  cat: 'special', body: 'Payday + a Gruv near you = sorted.', cta: 'Find events', route: 'explore' },
  { id: 98,  cat: 'special', body: "🎂 Someone's birthday is coming — throw them a Gruv.", cta: 'Host', route: 'host' },
  { id: 99,  cat: 'special', body: 'New month, new movement. Host your first Gruv.', cta: 'Create event', route: 'host' },
  { id: 100, cat: 'special', body: "Month's almost over and you haven't gone out. Fix it tonight.", cta: 'Explore', route: 'explore' },
];

// ── Interpolation ────────────────────────────────────────────────────────────
// Returns null if a required placeholder is missing → caller skips the nudge.
export function fillNudge(nudge, data = {}) {
  const needs = nudge.needs || [];
  for (const key of needs) {
    if (data[key] === undefined || data[key] === null || data[key] === '') return null;
  }
  const body = nudge.body.replace(/\{(\w+)\}/g, (_, k) => (data[k] != null ? String(data[k]) : ''));
  return { ...nudge, body };
}

// ── Selector ─────────────────────────────────────────────────────────────────
// ctx: { hostedThisMonth, nearbyCount, country, city, topEvent, isWeekend,
//        dayOfMonth, recentIds:Set, data:{...placeholders} }
// Strategy: bias toward the action the user most needs right now, but keep it
// fresh by skipping recently-shown ids and any dynamic nudge whose data is absent.
export function pickNudge(ctx = {}) {
  const {
    hostedThisMonth = true, nearbyCount = 0, isWeekend = false,
    dayOfMonth = 1, recentIds = new Set(), data = {},
  } = ctx;

  // Weighted category priority for THIS user, right now.
  const weights = {
    host: hostedThisMonth ? 1 : (dayOfMonth >= 20 ? 6 : 3), // push hosting, harder late-month
    discover: nearbyCount > 0 ? 5 : 0,                       // only if real events exist
    network: 2, go_out: 3, crew: 2, identity: 1,
    special: isWeekend ? 4 : 1,
  };

  // Build the eligible pool (fresh + data-satisfiable), category-weighted.
  const pool = [];
  for (const n of GO_OUT_NUDGES) {
    if (recentIds.has(n.id)) continue;
    const filled = fillNudge(n, data);
    if (!filled) continue;                 // skip dynamic nudges missing data
    const w = weights[n.cat] ?? 1;
    for (let i = 0; i < w; i++) pool.push(filled);
  }
  if (pool.length === 0) {
    // Everything recent/unsatisfiable — fall back to any static nudge.
    const statics = GO_OUT_NUDGES.filter(n => !(n.needs && n.needs.length));
    return statics[Math.floor(Math.random() * statics.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}