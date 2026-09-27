import { summarizeCrewOut } from '../src/utils/crewOut';

const NOW = Date.parse('2026-06-23T23:00:00Z');
const ago = (mins) => new Date(NOW - mins * 60000).toISOString();

describe('summarizeCrewOut — who is out right now', () => {
  it('keeps only each friend latest live check-in', () => {
    const out = summarizeCrewOut([
      { user_id: 'a', checked_in_at: ago(120), events: { title: 'Old Spot' } },
      { user_id: 'a', checked_in_at: ago(20),  events: { title: 'Taboo' } },
    ], NOW);
    expect(out).toHaveLength(1);
    expect(out[0].venue).toBe('Taboo');
  });

  it('drops friends who went home (outside the live window)', () => {
    const out = summarizeCrewOut([
      { user_id: 'a', checked_in_at: ago(30) },        // still out
      { user_id: 'b', checked_in_at: ago(8 * 60) },    // 8h ago — home
    ], NOW);
    expect(out.map((r) => r.userId)).toEqual(['a']);
  });

  it('orders most-recently-out first', () => {
    const out = summarizeCrewOut([
      { user_id: 'a', checked_in_at: ago(90) },
      { user_id: 'b', checked_in_at: ago(5) },
      { user_id: 'c', checked_in_at: ago(40) },
    ], NOW);
    expect(out.map((r) => r.userId)).toEqual(['b', 'c', 'a']);
  });

  it('pulls username + venue from joined profiles/events', () => {
    const out = summarizeCrewOut([
      { user_id: 'a', checked_in_at: ago(10), profiles: { username: 'lindi' }, events: { venue_name: 'Era' } },
    ], NOW);
    expect(out[0].username).toBe('lindi');
    expect(out[0].venue).toBe('Era');
  });

  it('is robust to garbage rows and never leaks the sort key', () => {
    const out = summarizeCrewOut([null, {}, { user_id: 'x', checked_in_at: 'nope' }, { user_id: 'y', checked_in_at: ago(10) }], NOW);
    expect(out).toHaveLength(1);
    expect(out[0]).not.toHaveProperty('_t');
    expect(summarizeCrewOut(null, NOW)).toEqual([]);
  });
});
