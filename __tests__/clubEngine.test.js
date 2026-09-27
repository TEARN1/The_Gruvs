/**
 * clubEngine — AwardManager.getCategoriesForEvent()
 * Pure logic only — no Supabase calls.
 * Guards: correct category set returned per event type.
 */
import { AwardManager } from '../src/services/clubEngine';

// Mock supabase so the module loads without network
jest.mock('../src/services/supabase', () => ({
  supabase: {},
  isSupabaseEnabled: false,
}));

describe('AwardManager.getCategoriesForEvent', () => {
  const testCases = [
    // Sport categories
    { category: 'sport',       firstKey: 'player_of_tournament' },
    { category: 'soccer',      firstKey: 'player_of_tournament' },
    { category: 'rugby',       firstKey: 'player_of_tournament' },
    { category: 'basketball',  firstKey: 'player_of_tournament' },
    { category: 'cricket',     firstKey: 'player_of_tournament' },
    { category: 'tennis',      firstKey: 'player_of_tournament' },
    // Music categories
    { category: 'music',       firstKey: 'best_performance' },
    { category: 'festival',    firstKey: 'best_performance' },
    { category: 'rave',        firstKey: 'best_performance' },
    // Hackathon categories
    { category: 'hackathon',   firstKey: 'best_project' },
    { category: 'competition', firstKey: 'best_project' },
    { category: 'esports',     firstKey: 'best_project' },
    // Universal fallback
    { category: 'conference',  firstKey: 'participant_of_year' },
    { category: 'workshop',    firstKey: 'participant_of_year' },
    { category: 'food',        firstKey: 'participant_of_year' },
    { category: undefined,     firstKey: 'participant_of_year' },
    { category: null,          firstKey: 'participant_of_year' },
  ];

  testCases.forEach(({ category, firstKey }) => {
    it(`returns correct categories for "${category}"`, () => {
      const cats = AwardManager.getCategoriesForEvent(category);
      expect(Array.isArray(cats)).toBe(true);
      expect(cats.length).toBeGreaterThan(0);
      expect(cats[0].key).toBe(firstKey);
    });
  });

  it('every category has key, label, and icon', () => {
    const allLists = [
      AwardManager.SPORT_CATEGORIES,
      AwardManager.MUSIC_CATEGORIES,
      AwardManager.HACKATHON_CATEGORIES,
      AwardManager.UNIVERSAL_CATEGORIES,
    ];
    allLists.forEach(list => {
      list.forEach(cat => {
        expect(typeof cat.key).toBe('string');
        expect(cat.key.length).toBeGreaterThan(0);
        expect(typeof cat.label).toBe('string');
        expect(typeof cat.icon).toBe('string');
      });
    });
  });

  it('has no duplicate keys within any list', () => {
    const allLists = [
      AwardManager.SPORT_CATEGORIES,
      AwardManager.MUSIC_CATEGORIES,
      AwardManager.HACKATHON_CATEGORIES,
      AwardManager.UNIVERSAL_CATEGORIES,
    ];
    allLists.forEach(list => {
      const keys = list.map(c => c.key);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });

  it('is case-insensitive for category matching', () => {
    const upper = AwardManager.getCategoriesForEvent('SOCCER');
    const lower = AwardManager.getCategoriesForEvent('soccer');
    expect(upper).toEqual(lower);
  });
});
