import { REACTION_LIST } from '../src/constants/CategoryConfig';

// Keys actually referenced across the app. If any of these stops existing in
// REACTION_LIST, a reaction would render as its raw key (e.g. "heart") instead
// of an emoji — the exact bug this guards against.
const REACTPICKER_KEYS = ['fire', 'heart', 'hype', 'crown', 'gem', 'rocket', 'wave', 'star', 'goat', '100', 'magic', 'drip'];
const EVENT_REACTION_KEYS = ['fire', 'heart', 'hype', 'gem', 'star', 'laugh', 'magic', 'crown'];

describe('REACTION_LIST integrity', () => {
  it('every entry has a key, emoji and label', () => {
    REACTION_LIST.forEach(r => {
      expect(typeof r.key).toBe('string');
      expect(r.key.length).toBeGreaterThan(0);
      expect(typeof r.emoji).toBe('string');
      expect(r.emoji.length).toBeGreaterThan(0);
      expect(typeof r.label).toBe('string');
    });
  });

  it('has no duplicate keys', () => {
    const keys = REACTION_LIST.map(r => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('reaction key → emoji mapping (the "heart" bug guard)', () => {
  const EMOJI_MAP = Object.fromEntries(REACTION_LIST.map(r => [r.key, r.emoji]));

  it('maps every ReactPicker signature key to an emoji', () => {
    REACTPICKER_KEYS.forEach(k => {
      expect(EMOJI_MAP[k]).toBeDefined();
      expect(EMOJI_MAP[k]).not.toBe(k); // must be an emoji, not the raw key text
    });
  });

  it('maps every EventReactions key to an emoji', () => {
    EVENT_REACTION_KEYS.forEach(k => {
      expect(EMOJI_MAP[k]).toBeDefined();
    });
  });

  it('maps "heart" to ❤️ specifically', () => {
    expect(EMOJI_MAP['heart']).toBe('❤️');
  });
});
