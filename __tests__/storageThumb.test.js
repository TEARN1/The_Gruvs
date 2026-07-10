/**
 * storageThumb — resized-image URL builder (routes our Supabase Storage objects
 * through the free weserv.nl resizer, since Supabase transforms are Pro-only).
 * Guards: non-Supabase URLs pass through, correct weserv params, no double-proxy.
 */
const SUPABASE_URL = 'https://abc123.supabase.co';
const { storageThumb, adaptiveThumb, thumb } = require('../src/utils/storageThumb');

const STORAGE_URL = `${SUPABASE_URL}/storage/v1/object/public/media/photo.jpg`;
const EXTERNAL_URL = 'https://images.unsplash.com/photo-123?w=400';
const PRAVATAR_URL  = 'https://i.pravatar.cc/150?img=3';

describe('storageThumb', () => {
  it('returns null/undefined unchanged', () => {
    expect(storageThumb(null, 80, 80)).toBeNull();
    expect(storageThumb(undefined, 80, 80)).toBeUndefined();
  });

  it('passes non-Supabase URLs through unchanged', () => {
    expect(storageThumb(EXTERNAL_URL, 400, 300)).toBe(EXTERNAL_URL);
    expect(storageThumb(PRAVATAR_URL, 80, 80)).toBe(PRAVATAR_URL);
  });

  it('routes Supabase storage URLs through weserv with resize params', () => {
    const result = storageThumb(STORAGE_URL, 400, 300);
    expect(result).toContain('images.weserv.nl');
    expect(result).toContain('w=400');
    expect(result).toContain('h=300');
    expect(result).toContain('output=webp');
    expect(result).toContain('q=70');
    // scheme-less source, no double https
    expect(result).toContain('url=abc123.supabase.co');
    expect(result).not.toContain('url=https');
  });

  it('uses custom quality when provided', () => {
    expect(storageThumb(STORAGE_URL, 200, 200, 50)).toContain('q=50');
  });

  it('omits width/height when not provided', () => {
    const result = storageThumb(STORAGE_URL, null, null);
    expect(result).not.toContain('w=');
    expect(result).not.toContain('h=');
    expect(result).toContain('images.weserv.nl');
  });

  it('does not double-proxy an already-resized URL', () => {
    const once = storageThumb(STORAGE_URL, 80, 80);
    const twice = storageThumb(once, 80, 80);
    expect(twice).toBe(once); // weserv URL passes straight through
  });
});

describe('thumb presets', () => {
  it('avatar targets 80px', () => expect(thumb.avatar(STORAGE_URL)).toContain('w=80'));
  it('avatarLg targets 200px', () => expect(thumb.avatarLg(STORAGE_URL)).toContain('w=200'));
  it('cover targets 800px', () => expect(thumb.cover(STORAGE_URL)).toContain('w=800'));
  it('thumbnail targets 300px', () => expect(thumb.thumbnail(STORAGE_URL)).toContain('w=300'));
  it('feed targets 900px at lower quality', () => {
    const r = thumb.feed(STORAGE_URL);
    expect(r).toContain('w=900');
    expect(r).toContain('q=62');
  });
});

describe('adaptiveThumb', () => {
  it('uses quality 70 on WiFi', () => expect(adaptiveThumb(STORAGE_URL, 400, 300, false)).toContain('q=70'));
  it('uses quality 45 on metered/cellular connection', () => expect(adaptiveThumb(STORAGE_URL, 400, 300, true)).toContain('q=45'));
});
