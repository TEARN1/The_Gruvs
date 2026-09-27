// Mock the supabase client so importing talentEngine doesn't spin up the real
// auth client (its background token-refresh timer fires after teardown).
jest.mock('../src/services/supabase', () => ({ supabase: {} }));

import { playerOVR } from '../src/services/talentEngine';

describe('playerOVR (FIFA-style overall rating)', () => {
  it('is 0 for a missing player', () => {
    expect(playerOVR(null)).toBe(0);
    expect(playerOVR(undefined)).toBe(0);
  });

  it('derives OVR from average match rating when present', () => {
    expect(playerOVR({ career_rating: 8.0 })).toBe(79);  // round(8 * 9.9)
    expect(playerOVR({ career_rating: 5.0 })).toBe(50);  // round(5 * 9.9) = 49.5 → 50
  });

  it('caps at 99', () => {
    expect(playerOVR({ career_rating: 10 })).toBe(99);
    expect(playerOVR({ career_rating: 12 })).toBe(99);
  });

  it('falls back to a production-derived baseline with no ratings', () => {
    // 55 + min(25, goals*2) + min(10, floor(apps/3))
    expect(playerOVR({ career_goals: 0, career_apps: 0 })).toBe(55);
    expect(playerOVR({ career_goals: 5, career_apps: 9 })).toBe(68); // 55 + 10 + 3
  });

  it('never exceeds the unrated cap of 85', () => {
    expect(playerOVR({ career_goals: 100, career_apps: 100 })).toBeLessThanOrEqual(85);
  });
});
