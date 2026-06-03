/**
 * sanitize — input hardening helpers.
 *
 * PostgREST's `.or()` / `.filter()` grammar treats  ,  (  )  and the dotted
 * `column.operator.value` form as structure. When raw user search text is
 * interpolated into one of those filter strings, a value like
 *   `x,is_admin.eq.true`  or  `x),or(...`
 * can inject extra conditions or break out of the intended group.
 *
 * sanitizeSearch() strips the characters that carry meaning in that grammar so
 * a search box can only ever search — never restructure the query. Normal text,
 * spaces, and accented letters are preserved; length is capped to avoid abuse.
 */
export function sanitizeSearch(input, maxLen = 80) {
  if (input == null) return '';
  return String(input)
    .slice(0, maxLen)
    // remove PostgREST filter structural characters + LIKE/escape metacharacters
    .replace(/[,()*\\%_:]/g, ' ')
    // collapse whitespace and trim
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Validate a value is a plain UUID before using it in a filter (defense in
 * depth for any id that isn't guaranteed to come from the session).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v) {
  return typeof v === 'string' && UUID_RE.test(v);
}

/**
 * Safe URL validation and opening wrapper.
 * Checks that the URL uses approved schemes (http, https, maps, mailto, tel)
 * and hostnames to protect against malicious redirects.
 */
export async function safeOpenURL(url) {
  const { Linking } = require('react-native');
  if (typeof url !== 'string') {
    console.warn('safeOpenURL: Input url must be a string.');
    return false;
  }

  const ALLOWED_SCHEMES = ['https:', 'http:', 'maps:', 'mailto:', 'tel:'];
  const ALLOWED_HOSTS = [
    'thegruvs.com',
    'www.thegruvs.com',
    'spotify.com',
    'open.spotify.com',
    'youtube.com',
    'www.youtube.com',
    'youtu.be',
    'google.com',
    'maps.google.com',
    'www.google.com',
    'twitter.com',
    'x.com',
  ];

  try {
    const parsed = new URL(url);
    if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
      console.warn(`safeOpenURL: Scheme ${parsed.protocol} is not allowed.`);
      return false;
    }

    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      const hostname = parsed.hostname.toLowerCase();
      const isAllowedHost = ALLOWED_HOSTS.some(allowed => 
        hostname === allowed || hostname.endsWith('.' + allowed)
      );
      if (!isAllowedHost) {
        console.warn(`safeOpenURL: Host ${hostname} is not whitelisted.`);
        return false;
      }
    }
  } catch (e) {
    const lower = url.toLowerCase();
    const hasAllowedScheme = ALLOWED_SCHEMES.some(scheme => lower.startsWith(scheme));
    if (!hasAllowedScheme) {
      console.warn('safeOpenURL: Invalid URL format or scheme.');
      return false;
    }
  }

  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return true;
    } else {
      console.warn('safeOpenURL: Scheme not supported by device:', url);
      return false;
    }
  } catch (err) {
    console.warn('safeOpenURL: Error opening URL:', err);
    return false;
  }
}

/**
 * Open a USER-SUPPLIED link (DM message, playlist URL, profile link). Unlike
 * safeOpenURL it doesn't host-whitelist (users legitimately share any site), but
 * it ONLY allows http/https/mailto/tel — blocking dangerous schemes like
 * javascript:, data:, file:, intent:, blob: that can run code or read local
 * files (especially on web). Returns true if it opened.
 */
export async function safeOpenExternal(url) {
  const { Linking } = require('react-native');
  if (typeof url !== 'string' || !url.trim()) return false;
  let raw = url.trim();
  // Default bare "domain.com/x" links to https rather than letting the platform
  // guess a scheme.
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) raw = `https://${raw}`;

  const ALLOWED = ['https:', 'http:', 'mailto:', 'tel:'];
  try {
    const proto = new URL(raw).protocol.toLowerCase();
    if (!ALLOWED.includes(proto)) {
      console.warn(`safeOpenExternal: blocked scheme ${proto}`);
      return false;
    }
  } catch {
    const lower = raw.toLowerCase();
    if (!ALLOWED.some((s) => lower.startsWith(s))) return false;
  }
  try { await Linking.openURL(raw); return true; }
  catch (e) { console.warn('safeOpenExternal: failed to open', e); return false; }
}

export default { sanitizeSearch, isUuid, safeOpenURL, safeOpenExternal };

