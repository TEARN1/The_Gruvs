import {
  emptyFC, eventsToGeoJSON, zonesToGeoJSON, zonesToMarkersGeoJSON,
  pointsToGeoJSON, crewToGeoJSON, lineGeoJSON, buildGeometry, drawGeoJSON, trailsToGeoJSON,
} from '../src/utils/mapGeoJSON';

describe('mapGeoJSON — shared by the web and native renderers', () => {
  it('drops events with no coordinates instead of emitting broken features', () => {
    const fc = eventsToGeoJSON([
      { id: 'a', title: 'Has coords', lat: -26.2, lon: 28.0 },
      { id: 'b', title: 'No coords' },
    ]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].geometry.coordinates).toEqual([28.0, -26.2]);
  });

  it('accepts either lat/lon or the legacy latitude/longitude pair', () => {
    const fc = eventsToGeoJSON([{ id: 'a', latitude: -26.2, longitude: 28.0 }]);
    expect(fc.features[0].geometry.coordinates).toEqual([28.0, -26.2]);
  });

  it('keeps a real zero here-count rather than falling back to going', () => {
    // The heat and hot-pin layers read `here`. If a live 0 fell through to the
    // static `going` number, a dead venue would render as busy — exactly the
    // promoter spin the Truth Protocol exists to replace.
    const fc = eventsToGeoJSON([{ id: 'a', lat: 1, lon: 2, here_count: 0, going: 90 }]);
    expect(fc.features[0].properties.here).toBe(0);
  });

  it('falls back to going only when there is no live count at all', () => {
    const fc = eventsToGeoJSON([{ id: 'a', lat: 1, lon: 2, going: 12 }]);
    expect(fc.features[0].properties.here).toBe(12);
  });

  it('marks declared zones as dashed and clamps severity to 1..3', () => {
    const fc = zonesToGeoJSON([
      { id: 'z1', kind: 'road_closed', status: 'declared', severity: 99, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } },
      { id: 'z2', kind: 'road_closed', status: 'confirmed', severity: -5, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } },
      { id: 'z3', kind: 'road_closed', status: 'confirmed', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } },
    ]);
    expect(fc.features[0].properties.dashed).toBe(1);
    expect(fc.features[0].properties.severity).toBe(3);
    expect(fc.features[1].properties.dashed).toBe(0);
    expect(fc.features[1].properties.severity).toBe(1);
    // Missing (or 0) severity means "unset" and reads as the middle value, not
    // as the quietest — an unrated closure shouldn't render as barely-there.
    expect(fc.features[2].properties.severity).toBe(2);
  });

  it('skips zones with no geometry', () => {
    expect(zonesToGeoJSON([{ id: 'z', kind: 'road_closed' }]).features).toHaveLength(0);
  });

  it('labels only the two ends of a road closure', () => {
    const fc = zonesToMarkersGeoJSON([
      { kind: 'road_closed', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1], [2, 2]] } },
      { kind: 'route', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } }, // not a closure
    ]);
    expect(fc.features.map((f) => f.properties.label)).toEqual(['ENTRY', 'EXIT']);
    expect(fc.features[1].geometry.coordinates).toEqual([2, 2]);
  });

  it('counts a crew pin from an explicit count or from the people list', () => {
    const fc = crewToGeoJSON([
      { lat: 1, lng: 2, count: 5 },
      { lat: 1, lng: 2, people: [{}, {}, {}] },
    ]);
    expect(fc.features[0].properties.count).toBe(5);
    expect(fc.features[1].properties.count).toBe(3);
  });

  it('needs two points before it will draw a line', () => {
    expect(lineGeoJSON([[0, 0]])).toEqual(emptyFC());
    expect(lineGeoJSON([[0, 0], [1, 1]]).features).toHaveLength(1);
  });

  it('closes a polygon back to its first point, and refuses an unclosable one', () => {
    expect(buildGeometry('polygon', [[0, 0], [1, 1]])).toBeNull(); // needs 3+
    const poly = buildGeometry('polygon', [[0, 0], [1, 1], [2, 0]]);
    expect(poly.type).toBe('Polygon');
    expect(poly.coordinates[0]).toHaveLength(4);
    expect(poly.coordinates[0][3]).toEqual([0, 0]);
    expect(buildGeometry('line', [[0, 0], [1, 1]])).toEqual({ type: 'LineString', coordinates: [[0, 0], [1, 1]] });
    expect(buildGeometry('line', [[0, 0]])).toBeNull();
  });

  it('shows the in-progress trace as vertices plus the line so far', () => {
    const fc = drawGeoJSON('line', [[0, 0], [1, 1]]);
    expect(fc.features.filter((f) => f.geometry.type === 'Point')).toHaveLength(2);
    expect(fc.features.filter((f) => f.geometry.type === 'LineString')).toHaveLength(1);
    expect(drawGeoJSON(null, [[0, 0]])).toEqual(emptyFC());
  });

  it('carries how many people made a flow, so line weight can be honest', () => {
    const fc = trailsToGeoJSON([
      { from: { lat: 1, lng: 2 }, to: { lat: 3, lng: 4 }, people: 12 },
      { from: { lat: 1, lng: 2 }, to: { lat: 3, lng: 4 } }, // unknown -> 0, not a guess
    ]);
    expect(fc.features[0].properties.people).toBe(12);
    expect(fc.features[1].properties.people).toBe(0);
  });

  it('is null-safe across the board', () => {
    expect(eventsToGeoJSON().features).toEqual([]);
    expect(zonesToGeoJSON().features).toEqual([]);
    expect(pointsToGeoJSON(null).features).toEqual([]);
    expect(crewToGeoJSON(undefined).features).toEqual([]);
  });
});
