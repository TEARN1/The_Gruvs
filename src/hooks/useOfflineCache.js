import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'gruv_cache_';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * useOfflineCache
 *
 * @param {string} key       — cache key (will be prefixed with 'gruv_cache_')
 * @param {Function} fetcher — async function that returns fresh data
 * @param {Array} deps       — dependency array that triggers re-fetch (like useEffect)
 * @param {Object} options   — { ttl: number (ms) }
 *
 * @returns {{ data, loading, refresh, isStale }}
 */
export const useOfflineCache = (key, fetcher, deps = [], options = {}) => {
  const ttl = options.ttl ?? DEFAULT_TTL;
  const storageKey = CACHE_PREFIX + key;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadCache = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      if (raw) {
        const { payload, timestamp } = JSON.parse(raw);
        const age = Date.now() - timestamp;
        if (mountedRef.current) {
          setData(payload);
          setIsStale(age > ttl);
        }
        return { payload, stale: age > ttl };
      }
    } catch {
      // ignore cache read errors
    }
    return null;
  }, [storageKey, ttl]);

  const saveCache = useCallback(async (payload) => {
    try {
      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify({ payload, timestamp: Date.now() })
      );
    } catch {
      // ignore cache write errors
    }
  }, [storageKey]);

  const fetchFresh = useCallback(async () => {
    try {
      const fresh = await fetcher();
      if (mountedRef.current) {
        setData(fresh);
        setIsStale(false);
        setLoading(false);
      }
      await saveCache(fresh);
    } catch {
      // On fetch error: keep cached data and mark stale
      if (mountedRef.current) {
        setIsStale(true);
        setLoading(false);
      }
    }
  }, [fetcher, saveCache]);

  const refresh = useCallback(async () => {
    if (mountedRef.current) setLoading(true);
    await fetchFresh();
  }, [fetchFresh]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (mountedRef.current) setLoading(true);

      // 1. Immediately show cached data
      await loadCache();

      // 2. Fetch fresh data in background
      if (!cancelled) {
        await fetchFresh();
      }
    };

    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, refresh, isStale };
};
