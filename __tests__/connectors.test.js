/**
 * Connectors — the four wires that make the tournament flow walkable.
 * These assert the *logic* of each connector against a chainable Supabase mock:
 *   1. createClub              (guards + payload)
 *   2/3. competitions          (getMyCompetitions + createCompetition defaults)
 *   4. MatchEventManager.log    (auto-links athlete_id from a tagged player name)
 */
import { MatchEventManager } from '../src/services/sportsEngine';
import { TournamentEngine } from '../src/services/tournamentEngine';
import { supabase, __mock, __reset, __setResult } from '../src/services/supabase';

// A chainable query-builder mock: every filter returns `this`, terminals
// (single/maybeSingle) and bare awaits resolve to per-table configured results,
// and inserts/updates + every call are recorded for assertions.
jest.mock('../src/services/supabase', () => {
  const state = { results: {}, captured: {}, calls: {} };
  const rec = (table, method, args) => {
    if (!state.calls[table]) state.calls[table] = [];
    state.calls[table].push({ method, args });
  };
  const makeBuilder = (table) => {
    const b = {};
    const chain = (method) => (...args) => { rec(table, method, args); return b; };
    Object.assign(b, {
      select: chain('select'),
      delete: chain('delete'),
      eq: chain('eq'),
      ilike: chain('ilike'),
      not: chain('not'),
      limit: chain('limit'),
      order: chain('order'),
      insert: (...args) => { rec(table, 'insert', args); state.captured[table] = { ...(state.captured[table] || {}), insert: args[0] }; return b; },
      update: (...args) => { rec(table, 'update', args); state.captured[table] = { ...(state.captured[table] || {}), update: args[0] }; return b; },
      single: () => Promise.resolve(state.results[table]?.single ?? { data: null, error: null }),
      maybeSingle: () => Promise.resolve(state.results[table]?.maybeSingle ?? { data: null, error: null }),
      then: (resolve) => resolve(state.results[table]?.list ?? { data: null, error: null }),
    });
    return b;
  };
  const fromFn = jest.fn((t) => makeBuilder(t));
  return {
    supabase: { from: fromFn },
    __mock: state,
    __reset: () => { state.results = {}; state.captured = {}; state.calls = {}; fromFn.mockClear(); },
    __setResult: (table, kind, value) => { state.results[table] = { ...(state.results[table] || {}), [kind]: value }; },
  };
});

beforeEach(() => __reset());

describe('Connector 4 — match logging links athlete_id', () => {
  it('auto-resolves athlete_id from player_name when only a name is logged', async () => {
    __setResult('sport_athletes', 'maybeSingle', { data: { id: 'ath-9' } });
    __setResult('sport_match_events', 'single', { data: { id: 'evt-1' }, error: null });

    await MatchEventManager.log('m1', 'e1', { event_type: 'goal', player_name: '  Sipho  ' });

    expect(__mock.captured.sport_match_events.insert.athlete_id).toBe('ath-9');
    // looked up under the right event, with a trimmed name
    const eq = __mock.calls.sport_athletes.find(c => c.method === 'eq');
    expect(eq.args).toEqual(['event_id', 'e1']);
    const ilike = __mock.calls.sport_athletes.find(c => c.method === 'ilike');
    expect(ilike.args).toEqual(['name', 'Sipho']);
  });

  it('does not look up a player when athlete_id is already provided', async () => {
    __setResult('sport_match_events', 'single', { data: { id: 'evt-2' }, error: null });

    await MatchEventManager.log('m1', 'e1', { event_type: 'goal', athlete_id: 'pre', player_name: 'X' });

    expect(__mock.captured.sport_match_events.insert.athlete_id).toBe('pre');
    expect(supabase.from.mock.calls.flat()).not.toContain('sport_athletes');
  });

  it('leaves athlete_id unset when the named player is not a tagged athlete', async () => {
    __setResult('sport_athletes', 'maybeSingle', { data: null });
    __setResult('sport_match_events', 'single', { data: { id: 'evt-3' }, error: null });

    await MatchEventManager.log('m1', 'e1', { event_type: 'goal', player_name: 'Ghost' });

    expect(__mock.captured.sport_match_events.insert.athlete_id).toBeUndefined();
  });
});

describe('Connector 1 — createClub', () => {
  it('returns null without inserting when name or owner is missing', async () => {
    expect(await TournamentEngine.createClub({ name: '', ownerId: 'u1' })).toBeNull();
    expect(await TournamentEngine.createClub({ name: 'X' })).toBeNull();
    expect(supabase.from.mock.calls.flat()).not.toContain('clubs');
  });

  it('inserts an owned, active club with sensible defaults', async () => {
    __setResult('clubs', 'single', { data: { id: 'club-1', name: 'AmaZulu FC' } });

    const club = await TournamentEngine.createClub({ name: '  AmaZulu FC  ', ownerId: 'u1', category: 'music', city: 'Durban' });

    expect(club.id).toBe('club-1');
    expect(__mock.captured.clubs.insert).toMatchObject({
      owner_id: 'u1', name: 'AmaZulu FC', category: 'music', city: 'Durban', country: 'ZA', is_active: true,
    });
  });
});

describe('Connector 2/3 — competitions', () => {
  it('getMyCompetitions returns [] when no user is given', async () => {
    expect(await TournamentEngine.getMyCompetitions()).toEqual([]);
  });

  it("getMyCompetitions returns the organiser's competitions", async () => {
    __setResult('competitions', 'list', { data: [{ id: 'c1', name: 'League' }] });
    expect(await TournamentEngine.getMyCompetitions('u1')).toEqual([{ id: 'c1', name: 'League' }]);
  });

  it('createCompetition defaults sport_type to "general" and skips the season when unnamed', async () => {
    __setResult('competitions', 'single', { data: { id: 'comp-1', name: 'League' } });

    const comp = await TournamentEngine.createCompetition({ name: 'League', organizerId: 'u1' });

    expect(comp.id).toBe('comp-1');
    expect(__mock.captured.competitions.insert.sport_type).toBe('general');
    expect(__mock.captured.seasons).toBeUndefined();
  });

  it('createCompetition keeps an explicit sport_type and seeds the first season', async () => {
    __setResult('competitions', 'single', { data: { id: 'comp-2', name: 'Cup' } });

    await TournamentEngine.createCompetition({ name: 'Cup', sport_type: 'soccer', organizerId: 'u1', seasonName: '2025/26' });

    expect(__mock.captured.competitions.insert.sport_type).toBe('soccer');
    expect(__mock.captured.seasons.insert).toMatchObject({ competition_id: 'comp-2', name: '2025/26', is_current: true });
  });
});
