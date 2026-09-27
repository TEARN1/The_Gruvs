import { countryFromLocale, getRegion, getDateOrder } from '../src/utils/region';

describe('region', () => {
  it('derives the country from the device locale', () => {
    // jsdom/node report an en-US-ish locale by default in CI
    const c = countryFromLocale();
    expect(c === null || /^[A-Z]{2}$/.test(c)).toBe(true);
  });

  it('always yields a usable region, never null', () => {
    const r = getRegion();
    expect(r.country).toMatch(/^[A-Z]{2}$/);
    expect(['DMY', 'MDY']).toContain(r.dateOrder);
  });

  // Day-first is the world default; month-first is a US peculiarity. Defaulting
  // the other way would silently corrupt dates for most of the planet.
  it('exposes a date order', () => {
    expect(['DMY', 'MDY']).toContain(getDateOrder());
  });
});
