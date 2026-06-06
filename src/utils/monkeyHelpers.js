/**
 * Utility helpers to protect UI/actions against user double-tapping,
 * and data synchronization against corrupted/null-value payloads.
 */

/**
 * Throttles an asynchronous function to ensure that multiple calls
 * during its execution are ignored. A cooldown period can also be set.
 * 
 * @param {Function} fn - The asynchronous function to execute.
 * @param {number} cooldownMs - Cooldown time in ms after execution finishes.
 * @returns {Function} - Throttled function.
 */
function throttleAsync(fn, cooldownMs = 300) {
  let isExecuting = false;
  return async function (...args) {
    if (isExecuting) {
      return { throttled: true };
    }
    isExecuting = true;
    try {
      const result = await fn(...args);
      return { throttled: false, result };
    } catch (error) {
      return { throttled: false, error };
    } finally {
      if (cooldownMs > 0) {
        setTimeout(() => {
          isExecuting = false;
        }, cooldownMs);
      } else {
        isExecuting = false;
      }
    }
  };
}

/**
 * Prevents double-taps on rapid touch events.
 * 
 * @param {Function} fn - The event handler to wrap.
 * @param {number} delayMs - Delay threshold in ms.
 * @returns {Function} - Double-tap protected function.
 */
function preventDoubleTap(fn, delayMs = 500) {
  let lastTap = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastTap < delayMs) {
      return;
    }
    lastTap = now;
    return fn(...args);
  };
}

/**
 * Normalizes sync payloads by ensuring all critical fields exist and match
 * expected schemas/types. If they are missing or malformed, default fallback
 * values are seamlessly provided to prevent UI-level red screens.
 * 
 * @param {Object} payload - The sync payload received from the server/peer.
 * @returns {Object} - The normalized payload.
 */
function normalizeSyncPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return {
      id: 'unknown',
      profile: { username: 'Anonymous', avatar_url: '' },
      gps: { lat: 0, lng: 0 },
      updated_at: new Date().toISOString(),
      metadata: {}
    };
  }

  // Normalize ID
  const id = (payload.id && typeof payload.id === 'string') ? payload.id : 'unknown';

  // Normalize Profile
  const rawProfile = payload.profile || {};
  const username = (rawProfile.username && typeof rawProfile.username === 'string' && rawProfile.username.trim().length > 0)
    ? rawProfile.username.trim()
    : 'Anonymous';
  const avatar_url = (rawProfile.avatar_url && typeof rawProfile.avatar_url === 'string')
    ? rawProfile.avatar_url
    : '';

  // Normalize GPS Coordinates
  const rawGps = payload.gps || {};
  let lat = 0;
  let lng = 0;
  if (typeof rawGps.lat === 'number' && !isNaN(rawGps.lat)) {
    lat = Math.max(-90, Math.min(90, rawGps.lat));
  } else if (typeof rawGps.lat === 'string') {
    const parsed = parseFloat(rawGps.lat);
    if (!isNaN(parsed)) lat = Math.max(-90, Math.min(90, parsed));
  }

  if (typeof rawGps.lng === 'number' && !isNaN(rawGps.lng)) {
    lng = Math.max(-180, Math.min(180, rawGps.lng));
  } else if (typeof rawGps.lng === 'string') {
    const parsed = parseFloat(rawGps.lng);
    if (!isNaN(parsed)) lng = Math.max(-180, Math.min(180, parsed));
  }

  // Normalize timestamps
  let updated_at = new Date().toISOString();
  if (payload.updated_at && typeof payload.updated_at === 'string') {
    const parsedTime = Date.parse(payload.updated_at);
    if (!isNaN(parsedTime)) {
      updated_at = new Date(parsedTime).toISOString();
    }
  }

  // Normalize metadata
  const metadata = (payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata))
    ? payload.metadata
    : {};

  return {
    id,
    profile: { username, avatar_url },
    gps: { lat, lng },
    updated_at,
    metadata
  };
}

module.exports = {
  throttleAsync,
  preventDoubleTap,
  normalizeSyncPayload
};
