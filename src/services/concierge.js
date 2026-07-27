/**
 * concierge.js — the "what should I do right now" brain.
 *
 * When the map shows a big impact zone near you that you have no interest in,
 * this turns disruption into discovery: it always has a good, REAL next move.
 * Rule-based (zero AI), first-match-wins, and — like GoOutNudge's pickNudge — it
 * skips any option whose data is missing, so it never fabricates and never says
 * nothing useful.
 *
 * Returns { kind, icon, title, body, cta, payload } or null.
 *   kind: 'openEvent' | 'roulette' | 'getHomeSafe'
 */
export async function pickConciergeMove({
  userId,
  nearbyEvents = [],
  excludeEventIds = [],   // e.g. the event whose closure triggered this
  now = new Date(),
}) {
  const hour = now.getHours();
  const late = hour >= 22 || hour < 4;

  // 1) A real nearby event you'd actually like — soonest + most social proof,
  //    not the disruptive one, not your own. The "still worth going out" move.
  const pick = nearbyEvents
    .filter((e) => e && e.id && !excludeEventIds.includes(e.id) && e.author_id !== userId)
    .sort((a, b) => (Number(b.going) || 0) - (Number(a.going) || 0))[0];
  if (pick) {
    const going = Number(pick.going) || 0;
    return {
      kind: 'openEvent', icon: 'zap',
      title: 'Not that one? Try this',
      body: `${pick.title || 'An event'} is happening near you${going ? ` — ${going} going` : ''}.`,
      cta: 'See it', payload: { eventId: pick.id },
    };
  }

  // 2) It's late and you're out — the safety move beats everything else.
  if (late) {
    return {
      kind: 'getHomeSafe', icon: 'life-buoy',
      title: 'Heading home soon?',
      body: 'Let someone you trust know your plan before you leave.',
      cta: 'Get home safe',
    };
  }

  // 3) Nothing's pulling you — let the night surprise you.
  return {
    kind: 'roulette', icon: 'compass',
    title: 'Nothing grabbing you?',
    body: 'Let the Vibe Roulette pick your next move.',
    cta: 'Spin it',
  };
}
