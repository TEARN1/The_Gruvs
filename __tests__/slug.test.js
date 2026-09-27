import { slugify, eventPath, idFromPath, eventUrl } from '../src/utils/slug';

describe('slugify', () => {
  it('makes a URL-safe, readable slug', () => {
    expect(slugify('Amapiano Sunset!')).toBe('amapiano-sunset');
    expect(slugify('Rock & Roll Night')).toBe('rock-and-roll-night');
    expect(slugify('  Café  Rouge  ')).toBe('cafe-rouge');
  });

  it('never leaves a chopped half-word in a URL', () => {
    const s = slugify('the very long name of an extremely elaborate event', 20);
    expect(s.length).toBeLessThanOrEqual(20);
    expect(s.endsWith('-')).toBe(false);
    expect(s).not.toMatch(/-\w{0,2}$/); // no dangling fragment
  });

  it('handles a title with no usable characters', () => {
    expect(slugify('!!!')).toBe('');
  });
});

describe('eventPath', () => {
  const event = { id: '8f3c1a9e-1234-4567-8901-abcdefabcdef', title: 'Amapiano Sunset', address: 'Konka', city: 'Soweto' };

  it('builds a human, shareable URL that keeps the id', () => {
    expect(eventPath(event)).toBe('/e/amapiano-sunset-konka-soweto-8f3c1a9e');
  });

  it('round-trips back to the id', () => {
    expect(idFromPath(eventPath(event))).toBe('8f3c1a9e');
  });

  // An untitled event must still get a valid unique URL, never a broken one.
  it('degrades gracefully with no title', () => {
    const p = eventPath({ id: '8f3c1a9e-1234' });
    expect(p).toBe('/e/8f3c1a9e');
    expect(idFromPath(p)).toBe('8f3c1a9e');
  });

  it('never produces a path for a missing event', () => {
    expect(eventPath(null)).toBe('/');
    expect(idFromPath('/nonsense')).toBeNull();
  });

  it('builds a full URL for sharing', () => {
    expect(eventUrl(event)).toBe('https://thegruvs.com/e/amapiano-sunset-konka-soweto-8f3c1a9e');
  });

  // Was `event.address || event.venue` — `venue` (bare) is never a real event
  // column, so venue_name (what's actually shown everywhere in the app) never
  // reached the URL. It's the field that should win when both exist.
  it('prefers venue_name over address when both are set', () => {
    const e = { id: '8f3c1a9e-abc', title: 'Amapiano Sunset', venue_name: 'Konka Rooftop', address: '123 Some Street', city: 'Soweto' };
    expect(eventPath(e)).toBe('/e/amapiano-sunset-konka-rooftop-soweto-8f3c1a9e');
  });

  it('falls back to address when venue_name is absent', () => {
    const e = { id: '8f3c1a9e-abc', title: 'Amapiano Sunset', address: 'Konka', city: 'Soweto' };
    expect(eventPath(e)).toBe('/e/amapiano-sunset-konka-soweto-8f3c1a9e');
  });

  // PostEventModal writes the literal string 'See poster' into `address` for a
  // poster-mode event with no address entered. That placeholder must never
  // leak into a public URL as if it were a real venue name.
  it('never lets the poster-mode placeholder address leak into the URL', () => {
    const e = { id: '8f3c1a9e-abc', title: 'Amapiano Sunset', address: 'See poster', city: 'Soweto' };
    expect(eventPath(e)).toBe('/e/amapiano-sunset-soweto-8f3c1a9e');
  });

  it('still uses venue_name even when address is the placeholder', () => {
    const e = { id: '8f3c1a9e-abc', title: 'Amapiano Sunset', venue_name: 'Konka', address: 'See poster', city: 'Soweto' };
    expect(eventPath(e)).toBe('/e/amapiano-sunset-konka-soweto-8f3c1a9e');
  });
});
