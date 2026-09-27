// Search: relevance ranking + typo tolerance. Locks in: best MATCH beats most
// likes, one typo still finds it, upcoming beats finished, non-matches drop.
import {
  editDistance, fuzzyTokenMatch, eventRelevance, rankEventResults, rankUserResults,
} from '../src/utils/searchRelevance';

const NOW = Date.now();
const tomorrow = new Date(NOW + 86400000).toISOString().slice(0, 10);
const lastMonth = new Date(NOW - 30 * 86400000).toISOString().slice(0, 10);

describe('editDistance (Damerau-Levenshtein)', () => {
  it('measures edits including transpositions', () => {
    expect(editDistance('amapiano', 'amapiano')).toBe(0);
    expect(editDistance('amapaino', 'amapiano')).toBe(1); // transposition = 1 edit
    expect(editDistance('brai', 'braai')).toBe(1);        // missing letter
    expect(editDistance('cat', 'dog', 2)).toBe(3);        // capped early-exit
  });
});

describe('fuzzyTokenMatch', () => {
  it('substring hits are exact; typos within tolerance still hit', () => {
    expect(fuzzyTokenMatch('Amapiano Night', 'amapiano')).toEqual({ hit: true, exact: true });
    expect(fuzzyTokenMatch('Amapiano Night', 'amapaino').hit).toBe(true);
    expect(fuzzyTokenMatch('Amapiano Night', 'amapaino').exact).toBe(false);
  });
  it('short tokens get NO fuzz (avoids "car"→"cat" nonsense)', () => {
    expect(fuzzyTokenMatch('cat cafe', 'car').hit).toBe(false);
  });
});

describe('eventRelevance / rankEventResults', () => {
  const ev = (over) => ({ id: 'x', title: '', vibe_count: 0, event_date: tomorrow, ...over });

  it('best MATCH beats most likes: title hit outranks a famous description hit', () => {
    const titleHit = ev({ id: 'a', title: 'Amapiano Grooves', vibe_count: 2 });
    const famousDescHit = ev({ id: 'b', title: 'Random Party', description: 'some amapiano maybe', vibe_count: 5000 });
    const out = rankEventResults('amapiano', [famousDescHit, titleHit], NOW);
    expect(out[0].id).toBe('a');
  });

  it('a typo still finds the event', () => {
    const out = rankEventResults('amapaino', [ev({ id: 'a', title: 'Amapiano Grooves' })], NOW);
    expect(out).toHaveLength(1);
  });

  it('upcoming beats finished at equal match quality', () => {
    const up = ev({ id: 'up', title: 'Jazz Night', event_date: tomorrow });
    const past = ev({ id: 'past', title: 'Jazz Night', event_date: lastMonth });
    const out = rankEventResults('jazz', [past, up], NOW);
    expect(out[0].id).toBe('up');
  });

  it('non-matches are dropped, null-safe', () => {
    expect(rankEventResults('amapiano', [ev({ id: 'a', title: 'Chess Club' })], NOW)).toHaveLength(0);
    expect(rankEventResults('', [ev({ title: 'x' })], NOW)).toHaveLength(0);
    expect(rankEventResults('q', null, NOW)).toEqual([]);
    expect(eventRelevance('q', null)).toBe(0);
  });

  it('exact title outranks prefix outranks substring', () => {
    const exact = ev({ id: 'exact', title: 'Braai' });
    const prefix = ev({ id: 'prefix', title: 'Braai Day Special' });
    const sub = ev({ id: 'sub', title: 'The Big Braai Day' });
    const out = rankEventResults('braai', [sub, prefix, exact], NOW);
    expect(out.map(e => e.id)).toEqual(['exact', 'prefix', 'sub']);
  });
});

describe('rankUserResults', () => {
  it('exact username beats famous bio-mention; fame is only a tiebreak', () => {
    const out = rankUserResults('thandi', [
      { id: 'b', username: 'djmax', bio: 'booked by thandi events', vibe_score: 90000 },
      { id: 'a', username: 'thandi', vibe_score: 3 },
    ]);
    expect(out[0].id).toBe('a');
  });

  it('typo on a username still finds them; non-matches drop', () => {
    expect(rankUserResults('thandii', [{ id: 'a', username: 'thandi' }])).toHaveLength(1);
    expect(rankUserResults('zzzz', [{ id: 'a', username: 'thandi' }])).toHaveLength(0);
  });
});
