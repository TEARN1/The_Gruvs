/**
 * storageThumb — Supabase Storage image transform URL builder.
 * Guards against: passing non-Supabase URLs through unchanged,
 * correct query param construction, quality/dimension presets.
 */

// storageThumb detects Supabase storage URLs by their *.supabase.* host + path
// (env-independent), so the test needs no EXPO_PUBLIC_* setup.
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

  it('appends transform params to Supabase storage URLs', () => {
    const result = storageThumb(STORAGE_URL, 400, 300);
    expect(result).toContain('width=400');
    expect(result).toContain('height=300');
    expect(result).toContain('resize=cover');
    expect(result).toContain('quality=75');
  });

  it('uses custom quality when provided', () => {
    const result = storageThumb(STORAGE_URL, 200, 200, 50);
    expect(result).toContain('quality=50');
  });

  it('omits width/height when not provided', () => {
    const result = storageThumb(STORAGE_URL, null, null);
    expect(result).not.toContain('width=');
    expect(result).not.toContain('height=');
    expect(result).toContain('resize=cover');
  });

  it('does not double-transform already-transformed URLs', () => {
    const once = storageThumb(STORAGE_URL, 80, 80);
    // The second call receives a URL with '?' already in it — passes through because
    // storageThumb checks for /storage/v1/object/public/ which is still present
    const twice = storageThumb(once, 80, 80);
    // Should not have duplicate params
    expect((twice.match(/width=/g) || []).length).toBe(1);
  });
});

describe('thumb presets', () => {
  it('avatar produces 80×80', () => {
    const r = thumb.avatar(STORAGE_URL);
    expect(r).toContain('width=80');
    expect(r).toContain('height=80');
  });

  it('avatarLg produces 200×200', () => {
    const r = thumb.avatarLg(STORAGE_URL);
    expect(r).toContain('width=200');
    expect(r).toContain('height=200');
  });

  it('cover produces 800×420', () => {
    const r = thumb.cover(STORAGE_URL);
    expect(r).toContain('width=800');
    expect(r).toContain('height=420');
  });

  it('thumbnail produces 300×200', () => {
    const r = thumb.thumbnail(STORAGE_URL);
    expect(r).toContain('width=300');
    expect(r).toContain('height=200');
  });
});

describe('adaptiveThumb', () => {
  it('uses quality 75 on WiFi', () => {
    const r = adaptiveThumb(STORAGE_URL, 400, 300, false);
    expect(r).toContain('quality=75');
  });

  it('uses quality 45 on metered/cellular connection', () => {
    const r = adaptiveThumb(STORAGE_URL, 400, 300, true);
    expect(r).toContain('quality=45');
  });
});
