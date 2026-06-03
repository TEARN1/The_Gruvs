/**
 * fxService — free, keyless foreign-exchange rates for display conversion.
 *
 * Prices are stored in ZAR, so we fetch ZAR-based rates and convert for the
 * viewer's currency. Source: open.er-api.com (free, no API key, daily refresh).
 * Rates are cached 24h in AsyncStorage so it's instant and works offline; if a
 * fetch fails we fall back to the last cached rates, or to rate 1 (i.e. the
 * "symbol only, no conversion" behaviour) so prices never break.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'gruvs_fx_rates_v1';
const TTL_MS = 24 * 60 * 60 * 1000; // 24h
const ENDPOINT = 'https://open.er-api.com/v6/latest/ZAR';

let _rates = null; // { base:'ZAR', rates:{ USD: 0.054, ... }, ts }

export const FxService = {
  /** Load rates (cache-first, then network). Returns the rates object or null. */
  async getRates() {
    if (_rates && Date.now() - _rates.ts < TTL_MS) return _rates;

    // Cache (keep even if stale as a fallback).
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached && cached.rates) {
          _rates = cached;
          if (Date.now() - cached.ts < TTL_MS) return _rates; // fresh enough
        }
      }
    } catch { /* ignore corrupt cache */ }

    // Network refresh.
    try {
      const res = await fetch(ENDPOINT);
      const json = await res.json();
      if (json && json.result === 'success' && json.rates) {
        _rates = { base: 'ZAR', rates: json.rates, ts: Date.now() };
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(_rates)).catch(() => {});
      }
    } catch { /* offline — keep stale cache if any */ }

    return _rates;
  },

  /** ZAR → target rate from the last-loaded rates (1 if unknown / same / not loaded). */
  rateTo(code) {
    if (!code || code === 'ZAR') return 1;
    const r = _rates && _rates.rates && _rates.rates[code];
    return (typeof r === 'number' && r > 0) ? r : 1;
  },
};

export default FxService;