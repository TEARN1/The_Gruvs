/**
 * dataSaver.js — should video wait for a tap instead of loading by itself?
 *
 * A reel averaged 5.3 MB, and the app quietly preloaded the next ones on any
 * connection. On prepaid data (about R79 a gigabyte in 2025) twenty swipes cost
 * a viewer roughly R8 before they had seen a single event.
 *
 * Modes, chosen in Settings → Data & video or the Reels controls:
 *   'auto' (default) — save data when the device says it is on mobile data,
 *                      has asked to save data (Android Data Saver / Lite mode),
 *                      or is on a very slow link.
 *   'on'             — always wait for a tap.
 *   'off'            — always play and preload.
 *
 * Browsers that say nothing about the connection (iPhone Safari, most desktops)
 * count as unmetered in 'auto'; the Settings copy tells people to pick 'on'.
 */
import { useEffect, useState } from 'react';
import { Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const DATA_SAVER_KEY = 'gruvs.dataSaver.mode';
export const DATA_SAVER_MODES = ['auto', 'on', 'off'];

let mode = 'auto';
let metered = false;
let started = false;
const listeners = new Set();

const snapshot = () => ({ mode, metered, active: mode === 'on' || (mode === 'auto' && metered) });
const emit = () => { const s = snapshot(); listeners.forEach((fn) => { try { fn(s); } catch { /* a bad listener must not stop the rest */ } }); };

/** navigator.connection → metered? Exported for tests. */
export function isMeteredWebConnection(conn) {
  if (!conn) return false;
  if (conn.saveData) return true;
  if (conn.type === 'cellular') return true;
  return ['slow-2g', '2g', '3g'].includes(conn.effectiveType);
}

const webConnection = () => (typeof navigator !== 'undefined' ? navigator.connection || navigator.mozConnection || navigator.webkitConnection : null);

async function readNativeMetered() {
  try {
    // Lazy so web bundles and tests never touch the native module.
    const Network = require('expo-network');
    const state = await Network.getNetworkStateAsync();
    return state?.type === Network.NetworkStateType.CELLULAR;
  } catch {
    return false;
  }
}

async function refreshMetered() {
  const next = Platform.OS === 'web' ? isMeteredWebConnection(webConnection()) : await readNativeMetered();
  if (next !== metered) { metered = next; emit(); }
}

function start() {
  if (started) return;
  started = true;
  AsyncStorage.getItem(DATA_SAVER_KEY)
    .then((saved) => { if (DATA_SAVER_MODES.includes(saved) && saved !== mode) { mode = saved; emit(); } })
    .catch(() => {});
  refreshMetered();
  if (Platform.OS === 'web') {
    const conn = webConnection();
    conn?.addEventListener?.('change', refreshMetered);
  } else {
    // No change events from expo-network here; re-check whenever the app comes back.
    AppState.addEventListener('change', (s) => { if (s === 'active') refreshMetered(); });
  }
}

export const DataSaver = {
  /** Synchronous best guess; correct once the saved mode has loaded. */
  isActive() { start(); return snapshot().active; },
  getMode() { start(); return mode; },
  isMetered() { start(); return metered; },
  async setMode(next) {
    if (!DATA_SAVER_MODES.includes(next)) return;
    start();
    mode = next;
    emit();
    try { await AsyncStorage.setItem(DATA_SAVER_KEY, next); } catch { /* the in-memory mode still applies this session */ }
  },
  subscribe(fn) { start(); listeners.add(fn); return () => listeners.delete(fn); },
  /** Test hook: forget module state. */
  _reset() { mode = 'auto'; metered = false; started = false; listeners.clear(); },
};

/** { mode, metered, active } — re-renders when any of them change. */
export function useDataSaver() {
  const [state, setState] = useState(() => { start(); return snapshot(); });
  useEffect(() => DataSaver.subscribe(setState), []);
  return state;
}

export default DataSaver;
