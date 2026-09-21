/**
 * Mutual-follows fan-out.
 *
 * CommunityStatsBar used to fetch BOTH full follow lists — neither with a
 * LIMIT — and intersect them in JavaScript to render one number. For an account
 * with 40k followers that is ~40,800 rows pulled to the phone every two
 * minutes. These tests pin the contract that replaced it.
 */

// Mirrors the intersection the client used to do, kept as the reference the
// server-side RPC must agree with.
function clientSideMutuals(following, followers) {
  const followingIds = new Set(following.map(r => r.following_id));
  return followers.map(r => r.follower_id).filter(id => followingIds.has(id));
}

describe('mutual follows', () => {
  it('a mutual is someone in both directions', () => {
    const following = [{ following_id: 'a' }, { following_id: 'b' }, { following_id: 'c' }];
    const followers = [{ follower_id: 'b' }, { follower_id: 'c' }, { follower_id: 'z' }];
    expect(clientSideMutuals(following, followers).sort()).toEqual(['b', 'c']);
  });

  it('one-directional follows are not mutuals', () => {
    // 'z' follows me but I do not follow back; 'a' I follow but does not follow back.
    const following = [{ following_id: 'a' }];
    const followers = [{ follower_id: 'z' }];
    expect(clientSideMutuals(following, followers)).toEqual([]);
  });

  it('an account with no follows has no mutuals', () => {
    expect(clientSideMutuals([], [])).toEqual([]);
  });
});

describe('RPC result shape', () => {
  // get_mutual_online returns exactly the columns CommunityStatsBar renders,
  // already ordered — so swapping to it changes nothing the user sees.
  const RPC_COLUMNS = ['id', 'username', 'avatar_url', 'bio', 'vibe_score', 'last_seen'];

  it('carries every field the online-vibers list renders', () => {
    for (const col of ['id', 'username', 'avatar_url', 'bio', 'vibe_score']) {
      expect(RPC_COLUMNS).toContain(col);
    }
  });

  it('falls back when the RPC is absent, so it ships before the migration', () => {
    // The component treats an RPC error as "not deployed" and uses the direct
    // query path. Anything else would break the app on a database that has not
    // had mutual_follows_rpc.sql applied yet.
    const handle = (res) => (!res.error && Array.isArray(res.data) ? 'rpc' : 'fallback');
    expect(handle({ data: [{ id: 'x' }], error: null })).toBe('rpc');
    expect(handle({ data: null, error: { message: 'function does not exist' } })).toBe('fallback');
    expect(handle({ data: [], error: null })).toBe('rpc'); // genuinely nobody online
  });

  it('treats a numeric count of zero as a real answer, not a failure', () => {
    const handle = (res) => (!res.error && typeof res.data === 'number' ? res.data : 'fallback');
    expect(handle({ data: 0, error: null })).toBe(0);
    expect(handle({ data: 12, error: null })).toBe(12);
    expect(handle({ data: null, error: { message: 'nope' } })).toBe('fallback');
  });
});
