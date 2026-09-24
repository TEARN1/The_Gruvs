import { directionsUrl, directionsFallbackUrl } from '../src/utils/directions';

const konka = { lat: -26.2485, lng: 27.8546, label: 'Konka Soweto' };
const me = { lat: -26.2041, lng: 28.0473 };

describe('directions — hand off to a real navigation app', () => {
  it('builds an Apple Maps route on iOS', () => {
    const url = directionsUrl(konka, me, 'ios');
    expect(url).toContain('maps.apple.com');
    expect(url).toContain('daddr=-26.2485,27.8546');
    expect(url).toContain('saddr=-26.2041,28.0473');
  });

  it('uses the geo: scheme on Android so the user picks their own nav app', () => {
    const url = directionsUrl(konka, me, 'android');
    expect(url.startsWith('geo:-26.2485,27.8546')).toBe(true);
    expect(url).toContain(encodeURIComponent('Konka Soweto'));
  });

  it('builds a Google Maps directions link on web', () => {
    const url = directionsUrl(konka, me, 'web');
    expect(url).toContain('google.com/maps/dir/');
    expect(url).toContain('destination=-26.2485,27.8546');
    expect(url).toContain('origin=-26.2041,28.0473');
    expect(url).toContain('travelmode=driving');
  });

  it('omits the origin when we have no fix — the maps app knows better than we do', () => {
    const url = directionsUrl(konka, null, 'web');
    expect(url).toContain('destination=');
    expect(url).not.toContain('origin=');
  });

  it('carries the travel mode, and ignores a bogus one', () => {
    expect(directionsUrl(konka, me, 'web', 'walking')).toContain('travelmode=walking');
    expect(directionsUrl(konka, me, 'web', 'teleport')).toContain('travelmode=driving');
    expect(directionsUrl(konka, me, 'ios', 'walking')).toContain('dirflg=w');
    expect(directionsUrl(konka, me, 'ios', 'transit')).toContain('dirflg=r');
  });

  it('accepts lon or lng, since events carry both spellings', () => {
    const url = directionsUrl({ lat: 1, lon: 2 }, null, 'web');
    expect(url).toContain('destination=1,2');
  });

  it('refuses to build a link to nowhere', () => {
    expect(directionsUrl(null, me, 'web')).toBeNull();
    expect(directionsUrl({ lat: 1 }, me, 'web')).toBeNull();
    expect(directionsUrl({ lat: 'abc', lng: 'def' }, me, 'web')).toBeNull();
  });

  it('always has a web fallback for a device with no maps app', () => {
    expect(directionsFallbackUrl(konka, me)).toContain('google.com/maps/dir/');
  });
});
