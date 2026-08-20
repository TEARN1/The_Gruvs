// Birth year privacy (supabase/migrations/20261124180000_birthday_privacy.sql):
// signed-in users cannot read birth_date, birth_year or age from profiles, so
// the app must read its own through get_my_profile() and never select them.

const fs = require('fs');
const path = require('path');

let mockRpcCalls = [];
let mockMe = { id: 'me-1', birth_date: '1995-01-01', age: 31, birth_year: 1995 };
const mockFrom = jest.fn();

jest.mock('../src/services/supabase', () => ({
  supabase: {
    rpc: (name, args) => {
      mockRpcCalls.push({ name, args });
      const result = name === 'get_my_profile' ? { data: mockMe, error: null } : { data: [], error: null };
      return Object.assign(Promise.resolve(result), { maybeSingle: () => Promise.resolve(result) });
    },
    from: (...a) => mockFrom(...a),
  },
}));

import { ownBirthDetails } from '../src/services/ownBirthDetails';
import { myBirthdayLeadUp } from '../src/services/birthdaySpotlight';

describe('birth year privacy', () => {
  beforeEach(() => {
    mockRpcCalls = [];
    mockFrom.mockReset();
  });

  it('reads the own birth details through get_my_profile, not the profiles table', async () => {
    expect(await ownBirthDetails('me-1')).toEqual({ birth_date: '1995-01-01', age: 31, birth_year: 1995 });
    expect(mockRpcCalls.map((c) => c.name)).toEqual(['get_my_profile']);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("never hands back someone else's row", async () => {
    expect(await ownBirthDetails('someone-else')).toBeNull();
  });

  it('the birthday lead-up reads the own date through get_my_profile', async () => {
    mockMe = { id: 'me-1', birth_date: '1995-12-31', age: 30, birth_year: 1995 };
    await myBirthdayLeadUp('me-1');
    expect(mockRpcCalls[0].name).toBe('get_my_profile');
    expect(mockFrom).not.toHaveBeenCalledWith('profiles');
  });

  it('no screen selects birth_date, birth_year or age from profiles', () => {
    const offenders = [];
    const walk = (dir) => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) walk(p);
        else if (/\.(js|jsx|ts|tsx)$/.test(f.name)) {
          const src = fs.readFileSync(p, 'utf8');
          for (const m of src.matchAll(/\.select\(\s*(['"`])([^'"`]*)\1/g)) {
            if (/\b(birth_date|birth_year|age)\b/.test(m[2])) offenders.push(`${path.relative(process.cwd(), p)}: ${m[2]}`);
          }
        }
      }
    };
    walk(path.join(__dirname, '..', 'src'));
    expect(offenders).toEqual([]);
  });
});
