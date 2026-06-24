import { findMemories } from '../src/utils/memories';

const NOW = Date.parse('2026-06-23T12:00:00Z');
// Same calendar day (Jun 23) in a prior year, at a safe midday UTC time.
const onThisDay = (yearsAgo) => `${2026 - yearsAgo}-06-23T20:00:00Z`;

describe('findMemories', () => {
  it('finds a Touch Down from this day a year ago', () => {
    const mem = findMemories([{ title: 'Taboo Fridays', venue_name: 'Taboo', checked_in_at: onThisDay(1) }], NOW);
    expect(mem).toHaveLength(1);
    expect(mem[0].yearsAgo).toBe(1);
    expect(mem[0].when).toBe('1 year ago today');
    expect(mem[0].title).toBe('Taboo Fridays');
  });

  it('ignores other days and same-year (not yet an anniversary)', () => {
    expect(findMemories([{ checked_in_at: '2025-06-22T20:00:00Z' }], NOW)).toHaveLength(0); // day before
    expect(findMemories([{ checked_in_at: '2026-06-23T01:00:00Z' }], NOW)).toHaveLength(0); // this year
  });

  it('sorts soonest (fewest years ago) first and pluralises', () => {
    const mem = findMemories([
      { venue_name: 'Kong', checked_in_at: onThisDay(3) },
      { venue_name: 'Taboo', checked_in_at: onThisDay(1) },
    ], NOW);
    expect(mem.map((x) => x.yearsAgo)).toEqual([1, 3]);
    expect(mem[1].when).toBe('3 years ago today');
  });

  it('falls back to venue name when there is no title', () => {
    const mem = findMemories([{ venue_name: 'Beach Bar', checked_in_at: onThisDay(2) }], NOW);
    expect(mem[0].title).toBe('Beach Bar');
  });

  it('is safe with junk / empty input', () => {
    expect(findMemories([])).toEqual([]);
    expect(findMemories(null, NOW)).toEqual([]);
    expect(findMemories([null, {}, { checked_in_at: 'nope' }], NOW)).toEqual([]);
  });
});
