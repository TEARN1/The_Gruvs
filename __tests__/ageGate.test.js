/**
 * ageGate — the one legal hard restriction. Under-age users can't RSVP/Touch
 * Down at age-restricted Gruvs; unknown age fails OPEN (don't lock adults out);
 * non-restricted events are always allowed.
 */
import { computeAge, profileAge, checkEventAge } from '../src/utils/ageGate';

const yearsAgo = (n) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d.toISOString().slice(0, 10);
};

describe('computeAge', () => {
  it('computes whole years from a DOB', () => {
    expect(computeAge(yearsAgo(20))).toBe(20);
    expect(computeAge(yearsAgo(17))).toBe(17);
  });
  it('returns null for missing/invalid', () => {
    expect(computeAge(null)).toBeNull();
    expect(computeAge('not-a-date')).toBeNull();
  });
  it('does not count a birthday that has not happened yet this year', () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    d.setDate(d.getDate() + 2); // birthday is in 2 days → still 17
    expect(computeAge(d.toISOString().slice(0, 10))).toBe(17);
  });
});

describe('profileAge fallbacks', () => {
  it('prefers birth_date, falls back to age then birth_year', () => {
    expect(profileAge({ birth_date: yearsAgo(25) })).toBe(25);
    expect(profileAge({ age: 30 })).toBe(30);
    expect(profileAge({ birth_year: new Date().getFullYear() - 22 })).toBe(22);
    expect(profileAge({})).toBeNull();
  });
});

describe('checkEventAge', () => {
  it('allows when the event has no age restriction', () => {
    expect(checkEventAge({ birth_date: yearsAgo(15) }, { age_restriction: 0 }).allowed).toBe(true);
    expect(checkEventAge({ birth_date: yearsAgo(15) }, {}).allowed).toBe(true);
  });

  it('blocks an under-age user from an 18+ Gruv', () => {
    const r = checkEventAge({ birth_date: yearsAgo(16) }, { age_restriction: 18 });
    expect(r.allowed).toBe(false);
    expect(r.requiredAge).toBe(18);
    expect(r.userAge).toBe(16);
    expect(r.reason).toMatch(/18/);
  });

  it('allows an of-age user', () => {
    expect(checkEventAge({ birth_date: yearsAgo(21) }, { age_restriction: 18 }).allowed).toBe(true);
    expect(checkEventAge({ birth_date: yearsAgo(18) }, { age_restriction: 18 }).allowed).toBe(true);
  });

  it('fails OPEN when age is unknown (no DOB) and flags it', () => {
    const r = checkEventAge({}, { age_restriction: 18 });
    expect(r.allowed).toBe(true);
    expect(r.unknownAge).toBe(true);
  });
});
