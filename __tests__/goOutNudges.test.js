/**
 * GoOutNudges — registry integrity + fillNudge/pickNudge contracts.
 * The hard rule under test: a nudge NEVER renders with missing/fabricated data.
 */
import { GO_OUT_NUDGES, NUDGE_CAT, fillNudge, pickNudge } from '../src/constants/GoOutNudges';

describe('GO_OUT_NUDGES registry integrity', () => {
  it('has 100 nudges with unique ids', () => {
    expect(GO_OUT_NUDGES).toHaveLength(100);
    const ids = new Set(GO_OUT_NUDGES.map(n => n.id));
    expect(ids.size).toBe(100);
  });

  it('every nudge has a valid category, body, cta and route', () => {
    const cats = new Set(Object.values(NUDGE_CAT));
    const routes = new Set(['host', 'explore', 'event', 'map', 'beacon']);
    for (const n of GO_OUT_NUDGES) {
      expect(cats.has(n.cat)).toBe(true);
      expect(typeof n.body).toBe('string');
      expect(n.body.length).toBeGreaterThan(0);
      expect(typeof n.cta).toBe('string');
      expect(routes.has(n.route)).toBe(true);
    }
  });

  it('every {placeholder} in a body is declared in needs', () => {
    for (const n of GO_OUT_NUDGES) {
      const placeholders = [...n.body.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
      for (const p of placeholders) {
        expect(n.needs || []).toContain(p);
      }
    }
  });
});

describe('fillNudge', () => {
  const dynamic = GO_OUT_NUDGES.find(n => n.needs?.includes('city'));

  it('returns null when required data is missing/empty', () => {
    expect(fillNudge(dynamic, {})).toBeNull();
    expect(fillNudge(dynamic, { city: '' })).toBeNull();
    expect(fillNudge(dynamic, { city: null })).toBeNull();
  });

  it('interpolates real data into the body', () => {
    const filled = fillNudge(dynamic, { city: 'Durban', count: 7 });
    expect(filled.body).toContain('Durban');
    expect(filled.body).not.toMatch(/\{city\}/);
  });

  it('passes static nudges through untouched', () => {
    const s = GO_OUT_NUDGES.find(n => !n.needs);
    expect(fillNudge(s, {}).body).toBe(s.body);
  });
});

describe('pickNudge', () => {
  it('never returns a dynamic nudge when its data is absent', () => {
    for (let i = 0; i < 50; i++) {
      const n = pickNudge({ nearbyCount: 0, data: {} });
      expect(n.body).not.toMatch(/\{\w+\}/); // no unfilled placeholders, ever
    }
  });

  it('skips recently shown ids', () => {
    const recentIds = new Set(GO_OUT_NUDGES.slice(0, 50).map(n => n.id));
    for (let i = 0; i < 25; i++) {
      const n = pickNudge({ recentIds, data: {} });
      expect(recentIds.has(n.id)).toBe(false);
    }
  });

  it('weights hosting harder late in the month for non-hosts', () => {
    // statistical: with hostedThisMonth=false on day 25, host nudges dominate vs day 5
    const countHosts = (dayOfMonth) => {
      let hosts = 0;
      for (let i = 0; i < 400; i++) {
        const n = pickNudge({ hostedThisMonth: false, dayOfMonth, data: {} });
        if (n.cat === 'host') hosts++;
      }
      return hosts;
    };
    expect(countHosts(25)).toBeGreaterThan(countHosts(5));
  });

  it('falls back to a static nudge when everything is recent', () => {
    const recentIds = new Set(GO_OUT_NUDGES.map(n => n.id));
    const n = pickNudge({ recentIds, data: {} });
    expect(n).toBeTruthy();
    expect(n.needs || []).toHaveLength(0);
  });
});