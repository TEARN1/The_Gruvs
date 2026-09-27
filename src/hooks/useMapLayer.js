/**
 * useMapLayer — one optional map layer: is it on, what's its data, and how does
 * it load itself the first time you ask for it.
 *
 * MapScreen carried 42 useState calls, and five of them were the same shape
 * written out five times: a boolean, an array, and a toggle that lazily fetched
 * once, gated on sign-in, and toasted when the result was empty (fog, crew,
 * nearby vibers, stays, trails). Same bug surface copied five ways — a missing
 * auth gate or a refetch-on-every-toggle only had to be fixed in one of them to
 * look fixed.
 *
 * Lazy by design: these layers hit the network, and most sessions never turn
 * most of them on. Nothing loads until someone actually asks.
 */
import { useState, useCallback, useRef } from 'react';

/**
 * @param {object}   opts
 * @param {Function} opts.fetch          async () => rows. Called at most once
 *                                       per session unless `reload` is used.
 * @param {boolean}  [opts.requiresAuth] gate the toggle behind sign-in
 * @param {object}   [opts.user]         current user (presence = signed in)
 * @param {Function} [opts.onAuthRequired] prompt to sign in
 * @param {string}   [opts.emptyMessage] toasted when a load returns nothing
 * @param {Function} [opts.toast]        (msg, kind) => void
 */
export function useMapLayer({
  fetch,
  requiresAuth = false,
  user = null,
  onAuthRequired,
  emptyMessage,
  toast,
  initial = [],
  // Not every layer's payload is an array — Fog of the City returns
  // { points, passport } — so "did this come back empty" is the caller's call.
  isEmpty = (rows) => !rows || rows.length === 0,
} = {}) {
  const [on, setOn] = useState(false);
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  // Whether we've already fetched, tracked separately from data.length: a layer
  // that legitimately has zero rows must not refetch on every single toggle.
  const loadedRef = useRef(false);
  const inflightRef = useRef(false);

  const load = useCallback(async () => {
    if (!fetch || inflightRef.current) return;
    inflightRef.current = true;
    setLoading(true);
    try {
      const rows = (await fetch()) ?? initial;
      setData(rows);
      loadedRef.current = true;
      if (emptyMessage && isEmpty(rows)) toast?.(emptyMessage, 'info');
    } catch {
      // A failed load must not mark the layer loaded — the next toggle retries.
      loadedRef.current = false;
    } finally {
      inflightRef.current = false;
      setLoading(false);
    }
  }, [fetch, emptyMessage, toast, isEmpty, initial]);

  const toggle = useCallback(async () => {
    if (requiresAuth && !user) { onAuthRequired?.(); return; }
    const next = !on;
    setOn(next);
    if (next && !loadedRef.current) await load();
  }, [on, load, requiresAuth, user, onAuthRequired]);

  /** Force a refresh next time (e.g. the viewport moved somewhere new). */
  const invalidate = useCallback(() => { loadedRef.current = false; }, []);

  /** Refresh now, but only if the layer is actually visible. */
  const refreshIfOn = useCallback(async () => {
    if (!on) { loadedRef.current = false; return; }
    loadedRef.current = false;
    await load();
  }, [on, load]);

  return { on, setOn, data, setData, loading, toggle, load, invalidate, refreshIfOn };
}

export default useMapLayer;
