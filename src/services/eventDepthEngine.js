/**
 * The Gruvs — Event Depth Engine (generic)
 *
 * The cross-event-type fixture/schedule generator, lifted from
 * sportsEngine.js's MatchManager.generateRoundRobin/generateKnockout
 * (originally soccer-only, writing to sport_matches) and generalized to
 * write program_slots so ANY event type (music sets, conference sessions,
 * hackathon demo slots, market stall windows — not just sport) gets the
 * same scheduling depth. See ROADMAP.md §1/§2.
 *
 * Scope of this file: schedule generation only (who plays/appears when).
 * Score submission, live timeline, and ranking recompute for the generic
 * engine are separate, not-yet-built pieces (ROADMAP.md Phase 1, items
 * 74-84 and 54-65) — bye auto-advance below only flips slot status, it does
 * NOT write live_timeline or ranking_entries yet.
 */

import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Pure generators — no I/O, easy to unit test. `participants` items only need
// an `id`; everything else about them is irrelevant to scheduling.
// ─────────────────────────────────────────────────────────────────────────────

/** Generate a full round-robin schedule for all participants in an event. */
export function generateRoundRobin(participants, baseDate, config = {}) {
  const slots = [];
  const n = participants.length;
  const totalRounds = n % 2 === 0 ? n - 1 : n;
  const arr = [...participants];
  if (n % 2 !== 0) arr.push(null); // bye placeholder

  const dayStep = config.dayStep ?? 7;

  for (let round = 0; round < totalRounds; round++) {
    for (let m = 0; m < arr.length / 2; m++) {
      const home = arr[m];
      const away = arr[arr.length - 1 - m];
      if (home && away) {
        const startsAt = baseDate ? new Date(baseDate) : null;
        if (startsAt) startsAt.setDate(startsAt.getDate() + round * dayStep);
        slots.push({
          round: `Round ${round + 1}`,
          slot_number: m + 1,
          home_ref: home.id,
          away_ref: away.id,
          starts_at: startsAt ? startsAt.toISOString() : null,
          status: 'scheduled',
        });
      }
    }
    // Rotate participants (keep first fixed) — standard round-robin scheduling.
    arr.splice(1, 0, arr.pop());
  }
  return slots;
}

/** Generate a single-elimination knockout bracket for all participants in an event. */
export function generateKnockout(participants, baseDate, config = {}) {
  const slots = [];
  const n = participants.length;
  if (n === 0) return [];
  let p = 2;
  let totalRounds = 1;
  while (p < n) { p *= 2; totalRounds++; }

  const dayStep = config.dayStep ?? 7;
  const getRoundName = (r, total) => {
    if (r === total) return 'Final';
    if (r === total - 1) return 'Semifinals';
    if (r === total - 2) return 'Quarterfinals';
    return `Round of ${Math.pow(2, total - r + 1)}`;
  };

  for (let r = 1; r <= totalRounds; r++) {
    const slotCount = p / Math.pow(2, r);
    for (let m = 1; m <= slotCount; m++) {
      let homeRef = null;
      let awayRef = null;

      if (r === 1) {
        homeRef = participants[2 * (m - 1)]?.id || null;
        awayRef = participants[2 * (m - 1) + 1]?.id || null;
      }

      const startsAt = baseDate ? new Date(baseDate) : null;
      if (startsAt) startsAt.setDate(startsAt.getDate() + (r - 1) * dayStep);

      slots.push({
        round: getRoundName(r, totalRounds),
        slot_number: m,
        home_ref: homeRef,
        away_ref: awayRef,
        starts_at: startsAt ? startsAt.toISOString() : null,
        status: 'scheduled',
      });
    }
  }
  return slots;
}

// ─────────────────────────────────────────────────────────────────────────────
// ProgramSlotManager — writes generated schedules to public.program_slots.
// ─────────────────────────────────────────────────────────────────────────────

export const ProgramSlotManager = {
  async listSlots(eventId, options = {}) {
    let q = supabase.from('program_slots')
      .select(`*, home:home_ref(id, display_name, photo_url), away:away_ref(id, display_name, photo_url)`)
      .eq('event_id', eventId)
      .order('slot_number', { ascending: true });
    if (options.status) q = q.eq('status', options.status);
    if (options.round) q = q.eq('round', options.round);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  /**
   * Bulk-insert a generated schedule (from generateRoundRobin/generateKnockout)
   * into program_slots. Round-1 byes (a slot with only one side filled) are
   * auto-completed — same behaviour as sportsEngine.js's bulkCreateFixtures —
   * but this only flips status to 'completed', it does not touch
   * live_timeline/ranking_entries (not built for the generic engine yet).
   */
  async bulkCreateSlots(eventId, slots) {
    const rows = slots.map(s => ({ event_id: eventId, ...s }));
    const { data, error } = await supabase.from('program_slots').insert(rows).select();
    if (error) throw error;

    const byes = (data || []).filter(
      s => s.slot_number != null && s.round === (data.find(x => x.slot_number === 1)?.round)
        && ((s.home_ref && !s.away_ref) || (!s.home_ref && s.away_ref))
    );
    for (const bye of byes) {
      await supabase.from('program_slots')
        .update({ status: 'completed' })
        .eq('id', bye.id);
    }

    const { data: refetched, error: refetchError } = await supabase.from('program_slots')
      .select(`*, home:home_ref(id, display_name, photo_url), away:away_ref(id, display_name, photo_url)`)
      .eq('event_id', eventId)
      .order('slot_number', { ascending: true });
    if (refetchError) throw refetchError;
    return refetched || [];
  },

  async deleteAllForEvent(eventId) {
    const { error } = await supabase.from('program_slots').delete().eq('event_id', eventId);
    if (error) throw error;
  },
};

export default { generateRoundRobin, generateKnockout, ProgramSlotManager };
