/**
 * directions — actually get someone from where they are to the Gruv.
 *
 * The map drew a straight line from you to the venue and called it "the way
 * there". It goes through buildings, over the M1 and across the Jukskei. The
 * "Take me there" button closed the sheet and told you to follow it.
 *
 * Real turn-by-turn is a solved problem that every phone already ships, for
 * free, with live traffic and no API key — so hand off to it rather than
 * pretending to be a navigation app. Pure URL building, so it's testable
 * without a device.
 */

const num = (n) => (Number.isFinite(Number(n)) ? Number(n) : null);

/**
 * Build the best directions URL for a platform.
 *
 * @param {object} dest    {lat, lon|lng, label}
 * @param {object} [origin] {lat, lon|lng} — omitted means "from where I am now",
 *                          which every maps app resolves better than we can.
 * @param {string} [platform] 'ios' | 'android' | 'web'
 * @param {string} [mode]  'driving' | 'walking' | 'transit'
 * @returns {string|null} null when the destination has no usable coordinates.
 */
export function directionsUrl(dest, origin = null, platform = 'web', mode = 'driving') {
  const dLat = num(dest?.lat);
  const dLng = num(dest?.lng ?? dest?.lon);
  if (dLat == null || dLng == null) return null;

  const oLat = num(origin?.lat);
  const oLng = num(origin?.lng ?? origin?.lon);
  const hasOrigin = oLat != null && oLng != null;
  const label = String(dest?.label || '').trim();

  if (platform === 'ios') {
    // Apple Maps. Leaving saddr off means "current location", which is more
    // accurate than the last fix we happen to be holding.
    const p = [`daddr=${dLat},${dLng}`];
    if (hasOrigin) p.push(`saddr=${oLat},${oLng}`);
    p.push(`dirflg=${{ driving: 'd', walking: 'w', transit: 'r' }[mode] || 'd'}`);
    return `http://maps.apple.com/?${p.join('&')}`;
  }

  if (platform === 'android') {
    // The geo: scheme lets the user pick whichever nav app they actually use
    // (Google Maps, Waze, Organic Maps) instead of us choosing for them.
    const q = label ? `${dLat},${dLng}(${encodeURIComponent(label)})` : `${dLat},${dLng}`;
    return `geo:${dLat},${dLng}?q=${q}`;
  }

  const p = [
    'api=1',
    `destination=${dLat},${dLng}`,
    `travelmode=${['driving', 'walking', 'transit'].includes(mode) ? mode : 'driving'}`,
  ];
  if (hasOrigin) p.push(`origin=${oLat},${oLng}`);
  return `https://www.google.com/maps/dir/?${p.join('&')}`;
}

/**
 * Android's geo: scheme opens a chooser but can't carry a travel mode, and on a
 * device with no maps app installed it resolves to nothing. This is the web URL
 * to fall back to when opening the primary one fails.
 */
export function directionsFallbackUrl(dest, origin = null, mode = 'driving') {
  return directionsUrl(dest, origin, 'web', mode);
}

export default { directionsUrl, directionsFallbackUrl };
