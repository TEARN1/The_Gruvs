import { packMasonry, aspectFor, hashId, eventImageUrl } from '../src/utils/masonry';

const ev = (id, extra = {}) => ({ id, title: `E${id}`, ...extra });

describe('hashId / aspectFor — deterministic layers', () => {
  it('same id always hashes the same', () => {
    expect(hashId('abc-123')).toBe(hashId('abc-123'));
    expect(hashId('abc-123')).not.toBe(hashId('abc-124'));
  });
  it('aspect is stable per event and varied across events', () => {
    const a = aspectFor(ev('e1'));
    expect(aspectFor(ev('e1'))).toBe(a); // stable
    const aspects = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(id => aspectFor(ev(id))));
    expect(aspects.size).toBeGreaterThan(1); // varied — the "layers"
  });
  it('posters lean taller', () => {
    expect(aspectFor(ev('x', { poster_mode: true }))).toBeGreaterThanOrEqual(1.25);
  });
});

describe('packMasonry', () => {
  it('splits into the requested number of columns, none empty for enough items', () => {
    const cols = packMasonry([ev(1), ev(2), ev(3), ev(4), ev(5), ev(6)], { columns: 2 });
    expect(cols).toHaveLength(2);
    expect(cols[0].length + cols[1].length).toBe(6);
    expect(cols[0].length).toBeGreaterThan(0);
    expect(cols[1].length).toBeGreaterThan(0);
  });

  it('keeps column heights balanced (shortest-column packing)', () => {
    const events = Array.from({ length: 40 }, (_, i) => ev(`id-${i}`));
    const cols = packMasonry(events, { columns: 2 });
    const height = (col) => col.reduce((s, it) => s + it.aspect + 0.18, 0);
    const diff = Math.abs(height(cols[0]) - height(cols[1]));
    expect(diff).toBeLessThan(1.6); // never wildly lopsided
  });

  it('skips items without an id and survives empty input', () => {
    expect(packMasonry([], { columns: 2 })).toEqual([[], []]);
    const cols = packMasonry([ev(null), ev('ok')], { columns: 2 });
    expect(cols[0].length + cols[1].length).toBe(1);
  });
});

describe('eventImageUrl', () => {
  it('prefers the first non-video media url', () => {
    expect(eventImageUrl({ media: [{ url: 'a.mp4' }, { url: 'b.jpg' }] })).toBe('b.jpg');
  });
  it('falls back media_urls → cover_url → cover_image → image_url → null', () => {
    expect(eventImageUrl({ media_urls: ['x.png'] })).toBe('x.png');
    expect(eventImageUrl({ cover_url: 'c.jpg' })).toBe('c.jpg');
    expect(eventImageUrl({ image_url: 'i.jpg' })).toBe('i.jpg');
    expect(eventImageUrl({})).toBeNull();
  });
});
