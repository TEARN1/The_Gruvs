import { parseZoneTags, formatZoneNote, calculateDetourNavigation } from '../src/services/mapZones';

describe('mapZones — civic impact, detour & pointsman layer', () => {
  it('parses structured traffic, detour, pointsman and geometry tags', () => {
    const raw = '[TRAFFIC: Heavy Delay (+25m)] [DETOUR: 11th Ave bypass] [POINTSMAN: police] [ROUTE_GEO: 28.01, -26.15; 28.02, -26.16] Major road closed for township marathon';
    const parsed = parseZoneTags(raw);

    expect(parsed.traffic).toBe('Heavy Delay (+25m)');
    expect(parsed.detour).toBe('11th Ave bypass');
    expect(parsed.pointsman).toBe('police');
    expect(parsed.routeCoords).toEqual([
      [28.01, -26.15],
      [28.02, -26.16],
    ]);
    expect(parsed.cleanNote).toBe('Major road closed for township marathon');
  });

  it('handles notes without special tags gracefully', () => {
    const raw = 'Street tent erected for memorial service';
    const parsed = parseZoneTags(raw);

    expect(parsed.traffic).toBeNull();
    expect(parsed.detour).toBeNull();
    expect(parsed.pointsman).toBeNull();
    expect(parsed.routeCoords).toBeNull();
    expect(parsed.cleanNote).toBe('Street tent erected for memorial service');
  });

  it('formats structured zone notes cleanly including coordinates', () => {
    const note = formatZoneNote({
      note: 'Avoid area if heading north',
      traffic: 'Gridlock / Road Closed',
      detour: 'Take M1 South',
      pointsman: 'volunteer',
      routeCoords: [[28.04, -26.20], [28.05, -26.21]],
    });

    expect(note).toContain('[TRAFFIC: Gridlock / Road Closed]');
    expect(note).toContain('[DETOUR: Take M1 South]');
    expect(note).toContain('[POINTSMAN: volunteer]');
    expect(note).toContain('[ROUTE_GEO: 28.040000,-26.200000;28.050000,-26.210000]');
    expect(note).toContain('Avoid area if heading north');
  });

  it('calculates 1-tap navigation URLs for Google Maps and Waze', () => {
    const nav = calculateDetourNavigation({
      lat: -26.2041,
      lon: 28.0473,
      detourCoords: [[28.0450, -26.2000], [28.0480, -26.2010]],
    });

    expect(nav.googleMapsUrl).toContain('destination=-26.2041,28.0473');
    expect(nav.googleMapsUrl).toContain('waypoints=');
    expect(nav.wazeUrl).toContain('ll=-26.2041,28.0473');
  });
});
