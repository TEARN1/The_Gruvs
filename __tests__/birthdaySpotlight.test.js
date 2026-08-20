// birthdaySpotlight — cross-user birthday reads must go through RPCs that
// return only a distance/match, never another user's raw birth_date or year
// (see supabase/queries/birthday_privacy.sql).

let mockRpcCalls = [];
let mockRpcResponse = { data: [], error: null };

jest.mock('../src/services/supabase', () => ({
  supabase: {
    rpc: (name, args) => {
      mockRpcCalls.push({ name, args });
      return Promise.resolve(mockRpcResponse);
    },
  },
}));

jest.mock('../src/utils/resilience', () => ({
  isSchemaMiss: (e) => e?.message === 'schema-miss',
}));

import { peopleWithBirthdayToday, myBirthdayTwins } from '../src/services/birthdaySpotlight';

describe('birthdaySpotlight', () => {
  beforeEach(() => {
    mockRpcCalls = [];
    mockRpcResponse = { data: [], error: null };
  });

  it('peopleWithBirthdayToday calls the birthdays_nearby RPC and never exposes birth_date/year', async () => {
    mockRpcResponse = {
      data: [{ id: 'u1', username: 'a', display_name: 'A', avatar_url: null, city: 'Cape Town', distance_km: 3.2 }],
      error: null,
    };
    const rows = await peopleWithBirthdayToday({ centerLat: -33.9, centerLon: 18.4, radiusKm: 50 });
    expect(mockRpcCalls[0].name).toBe('birthdays_nearby');
    expect(rows).toHaveLength(1);
    for (const row of rows) {
      expect(row).not.toHaveProperty('birth_date');
      expect(row).not.toHaveProperty('birth_year');
    }
  });

  it('myBirthdayTwins calls the birthday_twins RPC and never exposes birth_date/year', async () => {
    mockRpcResponse = {
      data: [{ id: 'u2', username: 'b', display_name: 'B', avatar_url: null, city: 'Joburg', distance_km: null }],
      error: null,
    };
    const rows = await myBirthdayTwins('me-1');
    expect(mockRpcCalls[0].name).toBe('birthday_twins');
    expect(mockRpcCalls[0].args.p_user_id).toBe('me-1');
    for (const row of rows) {
      expect(row).not.toHaveProperty('birth_date');
      expect(row).not.toHaveProperty('birth_year');
    }
  });

  it('degrades gracefully (empty array) when the RPC is not migrated yet', async () => {
    mockRpcResponse = { data: null, error: new Error('schema-miss') };
    expect(await peopleWithBirthdayToday({})).toEqual([]);
    expect(await myBirthdayTwins('me-1')).toEqual([]);
  });

  it('myBirthdayTwins short-circuits without a userId (no RPC call)', async () => {
    const rows = await myBirthdayTwins(null);
    expect(rows).toEqual([]);
    expect(mockRpcCalls).toHaveLength(0);
  });
});
