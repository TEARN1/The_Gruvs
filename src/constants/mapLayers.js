/**
 * mapLayers — the map's layers as data, not as seven hand-written functions.
 *
 * LiveMap had a toggleHeat/toggleMine/toggleCrew/toggleNearby/toggleTrails/
 * toggleStays, each identical apart from a hardcoded array of layer ids, and
 * eleven near-identical effects pushing GeoJSON into a source by name. Every one
 * of those id strings was a silent failure waiting to happen: MapLibre throws on
 * an unknown layer, the call sites swallow it in a try/catch, and the layer just
 * quietly never appears.
 *
 * Declaring the groups once means a typo is catchable by a test instead of by a
 * user noticing their crew isn't on the map.
 *
 * Ordering note: this file describes VISIBILITY GROUPS and DATA BINDINGS only.
 * The paint specs stay in LiveMap where their add-order defines z-order —
 * moving those is a separate change with a real risk of silently reshuffling
 * what draws on top of what.
 */

/**
 * Toggle groups: which layer ids turn on/off together.
 * `inverse` layers turn OFF when the group turns ON — heat and clustered pins
 * are two readings of the same data, so showing both double-renders the crowd.
 */
export const LAYER_GROUPS = {
  heat:    { show: ['events-heat'], inverse: ['ev-cluster', 'ev-cluster-count', 'ev-glow', 'ev-hot', 'ev-dot'] },
  mine:    { show: ['mine-glow', 'mine-dot'] },
  crew:    { show: ['crew-ring', 'crew-dot', 'crew-count'] },
  nearby:  { show: ['nearby-glow', 'nearby-dot', 'nearby-text'] },
  trails:  { show: ['trails-line'] },
  stays:   { show: ['stays-glow', 'stays-dot', 'stays-icon'] },
};

/** Every layer id the groups reference — used to assert they all exist. */
export function groupLayerIds() {
  const ids = new Set();
  for (const g of Object.values(LAYER_GROUPS)) {
    (g.show || []).forEach((id) => ids.add(id));
    (g.inverse || []).forEach((id) => ids.add(id));
  }
  return [...ids];
}

/**
 * Apply a group's visibility to a live map instance.
 * Tolerant by design: a layer that isn't on the style yet (the map is still
 * loading, or a style swap dropped it) is skipped rather than throwing.
 */
export function applyGroupVisibility(map, groupName, on) {
  const group = LAYER_GROUPS[groupName];
  if (!map || !group) return false;
  const set = (id, visible) => {
    if (!map.getLayer || !map.getLayer(id)) return;
    try { map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none'); } catch { /* style mid-swap */ }
  };
  (group.show || []).forEach((id) => set(id, on));
  (group.inverse || []).forEach((id) => set(id, !on));
  return true;
}

export default { LAYER_GROUPS, groupLayerIds, applyGroupVisibility };
