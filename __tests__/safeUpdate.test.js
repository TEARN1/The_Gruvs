import { pick, stripPrivileged, CLUB_EDITABLE, PLAYER_EDITABLE } from '../src/utils/safeUpdate';

describe('pick — whitelist', () => {
  it('keeps only allowed columns', () => {
    const out = pick({ name: 'FC Soweto', city: 'Soweto', junk: 1 }, CLUB_EDITABLE);
    expect(out).toEqual({ name: 'FC Soweto', city: 'Soweto' });
  });

  // The whole point: a malicious client can't self-verify or steal ownership.
  it('DROPS a privilege-escalation attempt on clubs', () => {
    const attack = { name: 'FC Soweto', owner_id: 'attacker', is_verified: true, members_count: 999999 };
    const out = pick(attack, CLUB_EDITABLE);
    expect(out).toEqual({ name: 'FC Soweto' });
    expect(out.owner_id).toBeUndefined();
    expect(out.is_verified).toBeUndefined();
    expect(out.members_count).toBeUndefined();
  });

  it('DROPS a player self-verify / stat-inflation attempt', () => {
    const attack = { known_as: 'The Kid', is_verified: true, career_goals: 500, user_id: 'someone-else' };
    const out = pick(attack, PLAYER_EDITABLE);
    expect(out).toEqual({ known_as: 'The Kid' });
  });

  it('ignores undefined and non-objects safely', () => {
    expect(pick(null, CLUB_EDITABLE)).toEqual({});
    expect(pick({ name: undefined }, CLUB_EDITABLE)).toEqual({});
  });
});

describe('stripPrivileged — denylist safety net', () => {
  it('removes identity, verification, counters and stats', () => {
    const out = stripPrivileged({
      display_name: 'Team A', logo_url: 'x.png',
      id: 'z', owner_id: 'me', is_verified: true, status: 'approved',
      members_count: 10, career_goals: 5, vibe_score: 9000, created_at: 'now',
    });
    expect(out).toEqual({ display_name: 'Team A', logo_url: 'x.png' });
  });

  it('catches privileged fields by pattern, not just an exact list', () => {
    const out = stripPrivileged({ ok: 1, is_banned: true, total_count: 5, trust_score: 1, has_badge: true });
    expect(out).toEqual({ ok: 1 });
  });

  it('never throws on junk', () => {
    expect(stripPrivileged(null)).toEqual({});
    expect(stripPrivileged('nope')).toEqual({});
  });
});
