import fs from 'fs';
import path from 'path';
import { LAYER_GROUPS, groupLayerIds, applyGroupVisibility } from '../src/constants/mapLayers';

describe('mapLayers — toggle groups', () => {
  it('every id a group toggles is a layer LiveMap actually creates', () => {
    // The whole point of the registry: a typo'd layer id used to be invisible
    // (MapLibre throws, the call site swallows it, the layer never shows). This
    // reads the real layer ids out of LiveMap and holds the groups to them.
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'LiveMap.js'), 'utf8');
    const declared = new Set([...src.matchAll(/\bid:\s*'([a-z0-9-]+)'/gi)].map((m) => m[1]));

    expect(declared.size).toBeGreaterThan(10); // sanity: the regex found layers at all
    const missing = groupLayerIds().filter((id) => !declared.has(id));
    expect(missing).toEqual([]);
  });

  it('turns a group on, and turns its inverse layers off', () => {
    const calls = [];
    const map = {
      getLayer: () => true,
      setLayoutProperty: (id, _prop, value) => calls.push([id, value]),
    };
    applyGroupVisibility(map, 'heat', true);

    expect(calls).toContainEqual(['events-heat', 'visible']);
    // Heat and clustered pins are two readings of the same data — never both.
    expect(calls).toContainEqual(['ev-cluster', 'none']);
    expect(calls).toContainEqual(['ev-dot', 'none']);
  });

  it('restores the inverse layers when the group goes off', () => {
    const calls = [];
    const map = { getLayer: () => true, setLayoutProperty: (id, _p, v) => calls.push([id, v]) };
    applyGroupVisibility(map, 'heat', false);
    expect(calls).toContainEqual(['events-heat', 'none']);
    expect(calls).toContainEqual(['ev-dot', 'visible']);
  });

  it('skips layers the style does not have yet instead of throwing', () => {
    const map = { getLayer: () => false, setLayoutProperty: () => { throw new Error('no such layer'); } };
    expect(() => applyGroupVisibility(map, 'crew', true)).not.toThrow();
  });

  it('survives a style mid-swap where the layer exists but the set throws', () => {
    const map = { getLayer: () => true, setLayoutProperty: () => { throw new Error('style not done'); } };
    expect(() => applyGroupVisibility(map, 'stays', true)).not.toThrow();
  });

  it('is a no-op for an unknown group or a missing map', () => {
    expect(applyGroupVisibility(null, 'heat', true)).toBe(false);
    expect(applyGroupVisibility({ getLayer: () => true, setLayoutProperty: () => {} }, 'nope', true)).toBe(false);
  });

  it('covers every toggleable layer the map exposes', () => {
    expect(Object.keys(LAYER_GROUPS).sort()).toEqual(['crew', 'heat', 'mine', 'nearby', 'stays', 'trails']);
  });
});
