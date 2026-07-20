/**
 * bootGuard.js — the earliest layer of defense, before any provider mounts.
 *
 * ErrorBoundary's in-session safe-mode escalation (see App.js) only helps if
 * the crash happens late enough for a boundary to exist and survives long
 * enough for the user to tap Reload. It can't help with a crash so early or
 * so fast that the tree never finishes mounting (a synchronous throw during
 * provider init, a font-load hang) — reload just repeats the exact same
 * crash, forever, with the user unable to do anything but watch it happen.
 *
 * This is the circuit breaker for THAT case: a small, persistent (not
 * sessionStorage — sessionStorage resets on tab close and doesn't exist on
 * native at all) rolling log of recent crash timestamps, read BEFORE the
 * first provider is constructed. If the app has crashed critically enough
 * times, recently enough, boot skips the normal tree entirely and renders a
 * minimal, dependency-free safe shell instead.
 *
 * Cross-platform via AsyncStorage (native storage on native, a localStorage
 * shim on web — same package already used elsewhere in this codebase, e.g.
 * src/components/GoOutNudge.js).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORE_KEY = 'gruvs_boot_crashes';
const MAX_LOGGED = 10;
const TRIP_THRESHOLD = 3;
const TRIP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

async function readTimestamps() {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((t) => typeof t === 'number') : [];
  } catch {
    return []; // storage unavailable — fail OPEN (never block boot on a storage error)
  }
}

/**
 * Call this from ErrorBoundary's `critical` catch — the one shared write
 * path every "the shell itself is broken" signal feeds into, so the
 * in-session safe-mode escalation and this boot-time breaker read the same
 * source of truth instead of two separate counters.
 */
export async function recordCriticalCrash() {
  try {
    const times = await readTimestamps();
    times.push(Date.now());
    while (times.length > MAX_LOGGED) times.shift();
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(times));
  } catch { /* logging must never itself crash the crash handler */ }
}

/**
 * Read at boot, before the first provider mounts. Returns true when the app
 * should skip its normal tree and render the minimal safe shell instead.
 */
export async function shouldEnterSafeMode() {
  const times = await readTimestamps();
  const cutoff = Date.now() - TRIP_WINDOW_MS;
  return times.filter((t) => t > cutoff).length >= TRIP_THRESHOLD;
}

/** Exit safe mode — call when the user taps "Exit safe mode" in the shell. */
export async function clearCrashLog() {
  try { await AsyncStorage.removeItem(STORE_KEY); } catch { /* best-effort */ }
}
