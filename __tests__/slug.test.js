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
});
