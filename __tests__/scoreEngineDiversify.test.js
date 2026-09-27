// Mock supabase so importing the data-flow layer doesn't spin up the real client.
jest.mock('../src/services/supabase', () => ({ supabase: {}, isSupabaseEnabled: false }));

import { ScoreEngine } from '../src/services/dataFlow';

const ev = (id, category, score, author_id = 'h1') => ({ id, category, author_id, _heatScore: score });

describe('ScoreEngine.diversify', () => {
  it('passes through arrays shorter than 3 untouched', () => {
    const input = [ev('a', 'music', 10), ev('b', 'art', 9)];
    expect(ScoreEngine.diversify(input)).toHaveLength(2);
    expect(ScoreEngine.diversify([])).toEqual([]);
  });

  it('returns every event exactly once (no drops, no dupes)', () => {
    const input = [
      ev('m1', 'music', 100), ev('m2', 'music', 98), ev('m3', 'music', 96),
      ev('a1', 'art', 95), ev('a2', 'art', 93), ev('a3', 'art', 91),
    ];
    const out = ScoreEngine.diversify(input);
    expect(out).toHaveLength(6);
    expect(new Set(out.map(e => e.id)).size).toBe(6);
  });

  it('breaks up same-category runs (no 3 identical categories up top)', () => {
    const input = [
      ev('m1', 'music', 100), ev('m2', 'music', 98), ev('m3', 'music', 96),
      ev('a1', 'art', 95), ev('a2', 'art', 93), ev('a3', 'art', 91),
    ];
    const out = ScoreEngine.diversify(input);
    const topThree = out.slice(0, 3).map(e => e.category);
    expect(new Set(topThree).size).toBeGreaterThan(1); // not all the same
  });

  it('still leads with the strongest event', () => {
    const input = [
      ev('m1', 'music', 100), ev('m2', 'music', 98),
      ev('a1', 'art', 95), ev('a2', 'art', 60),
    ];
    expect(ScoreEngine.diversify(input)[0].id).toBe('m1');
  });

  it('demotes already-seen events in favour of fresh ones (explore/exploit)', () => {
    const input = [
      ev('seen', 'music', 100), ev('fresh', 'music', 95),
      ev('x', 'art', 50), ev('y', 'food', 40),
    ];
    const out = ScoreEngine.diversify(input, { seenIds: new Set(['seen']) });
    expect(out.indexOf(out.find(e => e.id === 'fresh'))).toBeLessThan(
      out.indexOf(out.find(e => e.id === 'seen'))
    );
  });

  it('dwell-aware (Drop rule 15): a seen event they LINGERED on outranks one they skimmed past', () => {
    const input = [
      ev('skimmed', 'music', 100), ev('dwelled', 'art', 100),
      ev('x', 'food', 20), ev('y', 'sport', 10),
    ];
    const out = ScoreEngine.diversify(input, {
      seenIds: new Set(['skimmed', 'dwelled']),
      dwellById: new Map([
        ['skimmed', { dwellMs: 900, opened: false }],   // flicked past — a pass
        ['dwelled', { dwellMs: 15000, opened: false }], // stared at it — live interest
      ]),
    });
    expect(out.indexOf(out.find(e => e.id === 'dwelled'))).toBeLessThan(
      out.indexOf(out.find(e => e.id === 'skimmed'))
    );
  });

  it('dwell-aware: opening the detail counts as engagement even with low dwell', () => {
    const input = [
      ev('opened', 'music', 100), ev('skimmed', 'art', 100),
      ev('x', 'food', 20), ev('y', 'sport', 10),
    ];
    const out = ScoreEngine.diversify(input, {
      seenIds: new Set(['opened', 'skimmed']),
      dwellById: new Map([
        ['opened', { dwellMs: 500, opened: true }],
        ['skimmed', { dwellMs: 500, opened: false }],
      ]),
    });
    expect(out.indexOf(out.find(e => e.id === 'opened'))).toBeLessThan(
      out.indexOf(out.find(e => e.id === 'skimmed'))
    );
  });

  it('is deterministic for the same input', () => {
    const input = [
      ev('m1', 'music', 100), ev('m2', 'music', 98), ev('m3', 'music', 96),
      ev('a1', 'art', 95), ev('a2', 'art', 93),
    ];
    const a = ScoreEngine.diversify(input).map(e => e.id);
    const b = ScoreEngine.diversify(input).map(e => e.id);
    expect(a).toEqual(b);
  });
});