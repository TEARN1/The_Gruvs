import { MatchManager } from '../src/services/sportsEngine';
import { supabase } from '../src/services/supabase';

// Mock Supabase client
jest.mock('../src/services/supabase', () => {
  const mockSingle = jest.fn();
  const mockMaybeSingle = jest.fn();
  const mockSelect = jest.fn(() => ({ single: mockSingle, maybeSingle: mockMaybeSingle }));
  const mockUpdate = jest.fn(() => ({ select: mockSelect, eq: jest.fn(() => ({ select: mockSelect })) }));
  const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle, eq: jest.fn(() => ({ maybeSingle: mockMaybeSingle })) }));
  
  return {
    supabase: {
      from: jest.fn((table) => ({
        select: mockSelect,
        update: mockUpdate,
        eq: mockEq,
      })),
    },
  };
});

describe('MatchManager - generateKnockout', () => {
  it('returns empty array when no teams are provided', () => {
    const fixtures = MatchManager.generateKnockout([], '2026-06-01T00:00:00.000Z');
    expect(fixtures).toEqual([]);
  });

  it('generates a correct bracket structure for 4 teams', () => {
    const teams = [
      { id: 't1', name: 'Team 1' },
      { id: 't2', name: 'Team 2' },
      { id: 't3', name: 'Team 3' },
      { id: 't4', name: 'Team 4' },
    ];
    const fixtures = MatchManager.generateKnockout(teams, '2026-06-01T00:00:00.000Z');
    
    // For 4 teams: p=4, round 1 (semifinals) has 2 matches, round 2 (final) has 1 match. Total = 3.
    expect(fixtures.length).toBe(3);
    
    // Semifinals (Round 1)
    expect(fixtures[0].round).toBe('Semifinals');
    expect(fixtures[0].round_number).toBe(1);
    expect(fixtures[0].match_number).toBe(1);
    expect(fixtures[0].home_team_id).toBe('t1');
    expect(fixtures[0].away_team_id).toBe('t2');

    expect(fixtures[1].round).toBe('Semifinals');
    expect(fixtures[1].round_number).toBe(1);
    expect(fixtures[1].match_number).toBe(2);
    expect(fixtures[1].home_team_id).toBe('t3');
    expect(fixtures[1].away_team_id).toBe('t4');

    // Final (Round 2)
    expect(fixtures[2].round).toBe('Final');
    expect(fixtures[2].round_number).toBe(2);
    expect(fixtures[2].match_number).toBe(1);
    expect(fixtures[2].home_team_id).toBeNull();
    expect(fixtures[2].away_team_id).toBeNull();
    
    // Weekly scheduling check
    const r1Date = new Date(fixtures[0].scheduled_at);
    const r2Date = new Date(fixtures[2].scheduled_at);
    const diffDays = (r2Date - r1Date) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(7);
  });
});
