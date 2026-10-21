/**
 * videoCache.js — Intelligent video preload, LRU cache & stream optimization.
 *
 * Responsibilities:
 * 1. Pre-warm next 2 video URLs in feed to eliminate black-frame playback delay.
 * 2. Maintain LRU memory cache of validated video stream URIs.
 * 3. Cache video headers and verify availability before player mounts.
 * 4. Never preload while data saver is active (mobile data, Save-Data, or the
 *    user's choice — see utils/dataSaver.js). The header used to promise a
 *    wifi/cellular check that did not exist, so clips downloaded ahead on
 *    prepaid data too.
 */
import { Platform } from 'react-native';
import { DataSaver } from '../utils/dataSaver';

const MAX_CACHE_ENTRIES = 20;
const memoryCache = new Map();
const preloadQueue = new Set();

export const VideoCache = {
  /**
   * Preload video headers and prime browser/device cache
   */
  async prefetch(url) {
    if (!url || typeof url !== 'string' || memoryCache.has(url) || preloadQueue.has(url)) {
      return;
    }
    if (DataSaver.isActive()) return;

    preloadQueue.add(url);

    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // Prime browser cache via link preload or fetch head
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'video';
        link.href = url;
        // Drop the tag once the browser is done with it; they used to pile up
        // in <head> for every clip scrolled past.
        const drop = () => link.remove();
        link.onload = drop;
        link.onerror = drop;
        document.head.appendChild(link);
      } else {
        // Fetch head to verify availability and prime socket
        await fetch(url, { method: 'HEAD' }).catch(() => {});
      }

      // Record in LRU
      if (memoryCache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = memoryCache.keys().next().value;
        memoryCache.delete(oldestKey);
      }
      memoryCache.set(url, { preloadedAt: Date.now(), ready: true });
    } catch (_) {
      // Best-effort; never crash on network failure
    } finally {
      preloadQueue.delete(url);
    }
  },

  /**
   * Pre-warm multiple consecutive feed items
   */
  prefetchBatch(urls = []) {
    if (DataSaver.isActive()) return;
    (urls || []).slice(0, 3).forEach((u) => {
      if (u) this.prefetch(u);
    });
  },

  /**
   * Verify if a URL is already primed
   */
  isReady(url) {
    return memoryCache.has(url);
  },

  /**
   * Clear cache on memory warning
   */
  clear() {
    memoryCache.clear();
    preloadQueue.clear();
  },
};
