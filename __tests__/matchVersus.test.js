import { parseMatchCard } from '../src/components/MatchVersus';

describe('parseMatchCard', () => {
  const card = { home: { name: 'Claude FC' }, away: { name: 'Gemini FC' } };

  it('returns null for empty / nullish input', () => {
    expect(parseMatchCard(null)).toBeNull();
    expect(parseMatchCard(undefined)).toBeNull();
    expect(parseMatchCard('')).toBeNull();
    expect(parseMatchCard(0)).toBeNull();
  });

  it('passes through a valid object with home + away', () => {
    expect(parseMatchCard(card)).toBe(card);
  });

  it('returns null when home or away is missing', () => {
    expect(parseMatchCard({ home: { name: 'A' } })).toBeNull();
    expect(parseMatchCard({ away: { name: 'B' } })).toBeNull();
    expect(parseMatchCard({})).toBeNull();
  });

  it('parses a JSON string (jsonb-as-text) into the object', () => {
    const parsed = parseMatchCard(JSON.stringify(card));
    expect(parsed).toEqual(card);
  });

  it('returns null for an invalid JSON string', () => {
    expect(parseMatchCard('{not json')).toBeNull();
  });

  it('returns null for a JSON string lacking home/away', () => {
    expect(parseMatchCard(JSON.stringify({ foo: 1 }))).toBeNull();
  });
});