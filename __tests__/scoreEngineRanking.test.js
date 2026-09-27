// F1 — ONE event-ranking pipeline. These tests lock in the rules eventScore
// absorbed from the retired utils/ranking rankFeed (over→0, LIVE boost,
// verified presence, new-host rescue, per-host anti-monopoly) so the single
// ranker can never silently lose them again.

// Mock supabase so importing the data-flow layer doesn't spin up the real client.
jest.mock('../src/services/supabase', () => ({ supabase: {}, isSupabaseEnabled: false }));

import { ScoreEngine } from '../src/services/dataFlow';
import { heatScore } from '../src/utils/heatScore';

const iso = (d) => d.toISOString();
// LOCAL date + LOCAL time — eventScore parses `${date}T${time}` as local, so
// fixtures must never mix a UTC date with local hours (flaky near midnight).
const dateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const timeStr = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const NOW = Date.now();
const hoursFromNow = (h) => new Date(NOW + h * 3600000);

const ev = (over = {}) => ({
  id: 'e1',
  created_at: iso(hoursFromNow(-5)),
  event_date: dateStr(hoursFromNow(6)),
  event_time: timeStr(hoursFromNow(6)),
  vibe_count: 5,
  going: 5,
  category: 'music',
  author_id: 'host1',
  ...over,
});

describe('ScoreEngine.eventScore — F1 absorbed rules', () => {
  it('a finished event scores exactly 0 (never ranked)', () => {
    const over = ev({
      event_date: dateStr(hoursFromNow(-72)),
      event_time: '20:00',
    });
    expect(ScoreEngine.eventScore(over)).toBe(0);
  });

  it('a multi-day event is NOT killed while end_date is still ahead', () => {
    const festival = ev({
      event_date: dateStr(hoursFromNow(-30)),   // started yesterday
      end_date: dateStr(hoursFromNow(30)),      // runs until tomorrow
    });
    expect(ScoreEngine.eventScore(festival)).toBeGreaterThan(0);
  });

  it('LIVE now outranks the identical event still hours away', () => {
    const live = ev({ event_date: dateStr(hoursFromNow(-1)), event_time: timeStr(hoursFromNow(-1)) });
    const later = ev({ event_date: dateStr(hoursFromNow(30)), event_time: timeStr(hoursFromNow(30)) });
    expect(ScoreEngine.eventScore(live)).toBeGreaterThan(ScoreEngine.eventScore(later));
  });

  it('verified presence (Touch Downs) lifts an event over its likes-only twin', () => {
    // 48h ahead with the default time — immune to UTC/local midnight skew.
    const base = { event_date: dateStr(hoursFromNow(48)), event_time: '20:00' };
    const withPeople = ScoreEngine.eventScore(ev({ ...base, here_count: 25 }));
    const without = ScoreEngine.eventScore(ev({ ...base, here_count: 0 }));
    // people physically in the room are a real, material signal
    expect(withPeople).toBeGreaterThan(without);
    expect(withPeople - without).toBeGreaterThan(40); // log1p(25)*18 ≈ 58, × trust ≥ 0.8
  });

  it("new-host rescue: a first-time host's event never scores below the floor", () => {
    const rookie = ev({ host_event_count: 0, vibe_count: 0, going: 0, created_at: iso(hoursFromNow(-200)) });
    expect(ScoreEngine.eventScore(rookie)).toBeGreaterThanOrEqual(30 * 0.8); // floor × min trust multiplier
  });
});

describe('ScoreEngine.diversify — per-host anti-monopoly', () => {
  const item = (id, host, score, category = 'music') => ({ id, author_id: host, category, _heatScore: score });

  it('a prolific host cannot own the top of the feed', () => {
    const input = [
      item('h1a', 'hogger', 100), item('h1b', 'hogger', 99), item('h1c', 'hogger', 98),
      item('h1d', 'hogger', 97), item('o1', 'other', 40, 'art'), item('o2', 'other2', 35, 'sport'),
    ];
    const out = ScoreEngine.diversify(input, { maxPerHost: 2 });
    const topFour = out.slice(0, 4).map(e => e.author_id);
    // beyond 2, the hogger's events are hard-demoted behind other hosts
    expect(topFour.filter(h => h === 'hogger').length).toBeLessThanOrEqual(3);
    expect(out).toHaveLength(6); // demoted, never deleted
  });
});

describe('canonical heatScore — momentum', () => {
  it('a new event catching fire beats an old one coasting on equal volume', () => {
    const rising = { event_date: dateStr(hoursFromNow(6)), vibe_count: 30, going: 10, created_at: iso(hoursFromNow(-2)) };
    const coasting = { event_date: dateStr(hoursFromNow(6)), vibe_count: 30, going: 10, created_at: iso(hoursFromNow(-200)) };
    expect(heatScore(rising, NOW)).toBeGreaterThan(heatScore(coasting, NOW));
  });

  it('ScoreEngine.heatScore never leaks -Infinity into a displayed number', () => {
    const over = { event_date: dateStr(hoursFromNow(-100)), event_time: '20:00', vibe_count: 50 };
    expect(ScoreEngine.heatScore(over)).toBe(0);
  });
});
