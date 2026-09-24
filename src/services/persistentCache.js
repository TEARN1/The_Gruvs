/**
 * persistentCache — the disk layer under dataFlow's in-memory cache.
 *
 * Why this exists: dataFlow's CACHE is a plain object. It is fast, but it dies
 * with the JS context — every reload, every tab eviction on mobile, every
 * return visit started completely cold and waited on the full round-trip chain
 * to Supabase. That is precisely the "it loads slowly EVERY time" complaint:
 * the service worker was caching the JS bundle, but nothing cached the *data*.
 *
 * The design constraint that shapes everything here: `cache.get()` in dataFlow
 * is SYNCHRONOUS, and ~85 call sites depend on that. So this module does not
 * try to make reads async. Instead it does one asynchronous read at startup and
 * pours the result back into the in-memory object. After that, every existing
 * synchronous read transparently hits warm data, with no caller changes at all.
 *
 * Writes go the other way: debounced, whole-snapshot, fire-and-forget.
 *
 * What is allowed on disk is deliberately narrow — see PERSIST_PREFIXES.
 */
import { Platform } from 'react-native';

// Bump when the SHAPE of a cached row changes. A deploy that changes what a
// feed row contains must invalidate old entries rather than render garbage
// from them — an old snapshot with a renamed field would otherwise paint a
// broken card and look like a bug in the new code.
const SCHEMA_VERSION = 1;

const DB_NAME = 'gruvs-cache';
const STORE = 'kv';
const RECORD_KEY = 'snapshot';
const ASYNC_STORAGE_KEY = '@gruvs/cache-snapshot';

// Serialized snapshots above this are dropped rather than written. The feed is
// worth caching; an unbounded pile of it is not. Oldest entries go first.
const MAX_BYTES = 2_000_000;

// Debounce so a burst of cache.set() during a feed load writes once, not 40x.
const WRITE_DEBOUNCE_MS = 1500;

/**
 * ONLY these key prefixes are ever written to disk, and the allowlist is
 * deliberate rather than convenient. Everything here is public, non-personal,
 * feed-shaped data — the stuff a cold open needs to paint something real.
 *
 * Notably NOT here, and not by accident:
 *   thread: / convos:   direct messages
 *   notifs: / profile: / follows: / saved:   personal account state
 *   nearby_vibers: / nearby_events:   location traces. This is a nightlife app
 *                   where location privacy is a safety property, not a
 *                   preference; a cache that leaves "where this person was on
 *                   Friday" on the device is not worth a faster paint.
 */
const PERSIST_PREFIXES = [
  'feed:',
  'event:',
  'trending:',
  'rising:',
  'happening_now',
  'this_week',
  'category_counts',
  'hot_event_ids',
];

const isPersistable = (key) => PERSIST_PREFIXES.some((p) => key.startsWith(p));

// ─────────────────────────────────────────────────────────────────────────────
// BACKENDS
// Web gets IndexedDB: async, off the main thread, and a quota measured in
// hundreds of MB rather than localStorage's ~5 MB. Native gets AsyncStorage,
// which is already a dependency. Either may be missing (SSR, jsdom in tests,
// a locked-down browser) — in which case this whole module degrades to exactly
// today's behaviour: memory only.
// ─────────────────────────────────────────────────────────────────────────────

const hasIDB = () => {
  try {
    return Platform.OS === 'web' && typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false; // some browsers throw on access in private mode
  }
};

function idbOpen() {
  return new Promise((resolve, reject) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, 1);
    } catch (e) {
      reject(e);
      return;
    }
    req.onupgradeneeded = () => {
      try {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      } catch { /* store already exists */ }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('idb blocked'));
  });
}

function idbGet() {
  return idbOpen().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const r = tx.objectStore(STORE).get(RECORD_KEY);
    r.onsuccess = () => { resolve(r.result || null); db.close(); };
    r.onerror = () => { reject(r.error); db.close(); };
  }));
}

function idbPut(value) {
  return idbOpen().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const r = tx.objectStore(STORE).put(value, RECORD_KEY);
    r.onsuccess = () => { resolve(); db.close(); };
    // QuotaExceededError lands here. A full disk must degrade to memory-only,
    // never throw into a render path.
    r.onerror = () => { reject(r.error); db.close(); };
  }));
}

function idbClear() {
  return idbOpen().then((db) => new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    const r = tx.objectStore(STORE).delete(RECORD_KEY);
    r.onsuccess = () => { resolve(); db.close(); };
    r.onerror = () => { resolve(); db.close(); }; // best effort
  }));
}

// AsyncStorage is required lazily so that web builds and the test environment
// never pay for it, and so a missing native module can't break module load.
function asyncStorage() {
  try {
    return require('@react-native-async-storage/async-storage').default || null;
  } catch {
    return null;
  }
}

const backend = {
  async read() {
    if (hasIDB()) return idbGet();
    const AS = asyncStorage();
    if (!AS) return null;
    const raw = await AS.getItem(ASYNC_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  async write(record) {
    if (hasIDB()) return idbPut(record);
    const AS = asyncStorage();
    if (!AS) return;
    return AS.setItem(ASYNC_STORAGE_KEY, JSON.stringify(record));
  },
  async clear() {
    if (hasIDB()) return idbClear();
    const AS = asyncStorage();
    if (!AS) return;
    return AS.removeItem(ASYNC_STORAGE_KEY);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

// Disabled entirely under test: 125 suites should not be racing a real
// IndexedDB, and the memory-only path is the behaviour they already assert.
const ENABLED = process.env.NODE_ENV !== 'test';

let currentOwner = null;   // user id this process's cache belongs to
let writeTimer = null;
let snapshotSource = null; // () => the live CACHE object in dataFlow

/**
 * Read the last snapshot off disk.
 *
 * Ownership: the feed is personalized (its cache keys embed the user id), so a
 * snapshot written by one account must never paint for another on a shared
 * device. A mismatch discards rather than merges. `null` owner (signed out) is
 * its own valid identity, not a wildcard.
 *
 * Returns the entries object to merge, or null. Never throws.
 */
export async function loadSnapshot(userId = null) {
  if (!ENABLED) return null;
  try {
    const rec = await backend.read();
    if (!rec || rec.v !== SCHEMA_VERSION) return null;
    if ((rec.owner ?? null) !== (userId ?? null)) return null;
    if (!rec.entries || typeof rec.entries !== 'object') return null;
    return rec.entries;
  } catch {
    return null; // unreadable snapshot is a cache miss, not an error
  }
}

/** Tell this module whose cache we're holding, and where to read it from. */
export function configurePersistence(userId, getSnapshot) {
  currentOwner = userId ?? null;
  snapshotSource = typeof getSnapshot === 'function' ? getSnapshot : null;
}

/**
 * Trim to the byte cap by dropping the oldest entries first. Returns the
 * record to write, or null when even a trimmed snapshot won't fit.
 */
function buildRecord(entries) {
  const keep = {};
  for (const k of Object.keys(entries)) {
    if (isPersistable(k) && entries[k] && entries[k].value !== undefined) keep[k] = entries[k];
  }
  // Nothing worth saving — don't spend a disk write on an empty snapshot.
  if (Object.keys(keep).length === 0) return null;

  let record = { v: SCHEMA_VERSION, owner: currentOwner, savedAt: Date.now(), entries: keep };
  let json = JSON.stringify(record);
  if (json.length <= MAX_BYTES) return record;

  // Oldest-first eviction until it fits.
  const byAge = Object.keys(keep).sort((a, b) => (keep[a].ts || 0) - (keep[b].ts || 0));
  for (const k of byAge) {
    delete keep[k];
    json = JSON.stringify({ ...record, entries: keep });
    if (json.length <= MAX_BYTES) break;
  }
  if (Object.keys(keep).length === 0) return null;
  return { v: SCHEMA_VERSION, owner: currentOwner, savedAt: Date.now(), entries: keep };
}

/**
 * Queue a write. Debounced, so a feed load's burst of sets costs one write.
 * Fire-and-forget by design: persistence is an optimisation, and a failure to
 * save must be invisible to the user.
 */
export function schedulePersist() {
  if (!ENABLED || !snapshotSource) return;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      const record = buildRecord(snapshotSource() || {});
      if (!record) return;
      backend.write(record).catch(() => {});
    } catch { /* never let cache persistence surface to the UI */ }
  }, WRITE_DEBOUNCE_MS);
  // Don't hold a Node/RN timer open just for a cache write.
  if (writeTimer && typeof writeTimer.unref === 'function') writeTimer.unref();
}

/**
 * Wipe disk. Called on sign-out — see clearAllCache in dataFlow.
 *
 * Cancelling the pending write FIRST is the point: a debounced write queued
 * moments before sign-out would otherwise land after the wipe and restore the
 * departing user's feed onto the device. Ownership resets to null for the same
 * reason — anything cached between sign-out and the next hydrate belongs to a
 * signed-out session, not to the account that just left.
 */
export async function wipeSnapshot() {
  if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
  currentOwner = null;
  if (!ENABLED) return;
  try { await backend.clear(); } catch { /* best effort */ }
}

export const __testing = { isPersistable, buildRecord, SCHEMA_VERSION, MAX_BYTES };
