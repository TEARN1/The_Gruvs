// Mock supabase so importing tournamentEngine doesn't spin up the real client.
jest.mock('../src/services/supabase', () => ({ supabase: {} }));

import { TOURNAMENT_ROLES } from '../src/services/tournamentEngine';

// The RPC cast_role_vote (30_tournament_governance.sql) only accepts these role
// keys; if the client and DB drift, every governance vote silently fails.
const RPC_ALLOWED = ['results_editor', 'log_keeper', 'fixtures_manager', 'disciplinary', 'head_organizer'];

describe('TOURNAMENT_ROLES (governance positions)', () => {
  it('every role has a key, label, blurb and icon', () => {
    TOURNAMENT_ROLES.forEach(r => {
      expect(typeof r.key).toBe('string');
      expect(r.label.length).toBeGreaterThan(0);
      expect(r.blurb.length).toBeGreaterThan(0);
      expect(r.icon.length).toBeGreaterThan(0);
    });
  });

  it('has no duplicate keys', () => {
    const keys = TOURNAMENT_ROLES.map(r => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every client role key is accepted by the cast_role_vote RPC', () => {
    TOURNAMENT_ROLES.forEach(r => expect(RPC_ALLOWED).toContain(r.key));
  });

  it('covers the five high-stakes positions', () => {
    expect(TOURNAMENT_ROLES.map(r => r.key).sort()).toEqual([...RPC_ALLOWED].sort());
  });
});
