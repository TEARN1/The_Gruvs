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

export default { sanitizeSearch, isUuid };
