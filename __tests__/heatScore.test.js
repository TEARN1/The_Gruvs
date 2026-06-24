import { heatScore, rankByHeat } from '../src/utils/heatScore';

const NOW = Date.parse('2026-06-23T20:00:00Z');
const ev = (over) => ({ event_date: '2026-06-23', event_time: '22:00', ...over });

describe('heatScore — Lineup heat', () => {
  it('verified presence (here) dominates raw buzz', () => {
    const presence = heatScore(ev({ here_count: 30, vibe_count: 0, going: 0 }), NOW);
    const allHype  = heatScore(ev({ here_count: 0, vibe_count: 500, going: 500 }), NOW);
    expect(presence).toBeGreaterThan(allHype);
  });

  it('a live/soon Gruv outranks a far-future one with equal signals', () => {
    const tonight = heatScore(ev({ here_count: 5, event_date: '2026-06-23' }), NOW);
    const nextMonth = heatScore(ev({ here_count: 5, event_date: '2026-07-30' }), NOW);
    expect(tonight).toBeGreaterThan(nextMonth);
  });

  it('finished events get sunk', () => {
    expect(heatScore(ev({ event_date: '2026-06-20', here_count: 50 }), NOW)).toBeLessThan(-100);
  });

  it('rankByHeat orders hottest first and drops finished', () => {
    const a = ev({ here_count: 2, event_date: '2026-06-23' });   // some presence tonight
    const b = ev({ here_count: 40, event_date: '2026-06-23' });  // packed tonight
    const c = ev({ here_count: 99, event_date: '2026-06-19' });  // huge but OVER
    const ranked = rankByHeat([a, b, c], NOW);
    expect(ranked[0]).toBe(b);          // packed tonight is #1
    expect(ranked).not.toContain(c);    // finished dropped
    expect(ranked).toHaveLength(2);
  });

  it('is null-safe', () => {
    expect(heatScore(null)).toBe(0);
    expect(rankByHeat(null, NOW)).toEqual([]);
    expect(rankByHeat([null, {}], NOW).length).toBeGreaterThanOrEqual(0);
  });
});
