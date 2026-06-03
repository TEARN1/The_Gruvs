/**
 * CurrencyContext — picks the display currency from the viewer's GPS location
 * and exposes a `format()` helper used everywhere prices are shown.
 *
 * Resolution order (best-effort, non-blocking):
 *   1. a cached / manually-chosen currency (instant, offline-safe)
 *   2. the GPS country code → its local currency
 *   3. default ZAR
 *
 * "Symbol/format only": the amount is never converted — we just stamp the
 * right symbol and grouping onto the same number.
 */
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CURRENCIES, DEFAULT_CURRENCY, currencyForCountry, formatPrice, setActiveCurrency } from '../constants/currencies';
import { LocationService } from '../services/locationService';

const STORAGE_KEY = 'gruvs_currency';
const MANUAL_KEY = 'gruvs_currency_manual'; // '1' once the user picks one explicitly

const CurrencyContext = createContext(null);

export const CurrencyProvider = ({ children }) => {
  const [currency, setCurrencyState] = useState(DEFAULT_CURRENCY);
  const manualRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1. Restore the cached / manual choice for an instant, offline-safe start.
      try {
        const [saved, manual] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(MANUAL_KEY),
        ]);
        if (manual === '1') manualRef.current = true;
        if (saved && CURRENCIES[saved] && !cancelled) setCurrencyState(CURRENCIES[saved]);
      } catch { /* ignore */ }

      // 2. A manual choice always wins — don't override it from GPS.
      if (manualRef.current) return;

      // 3. Refresh from GPS country in the background.
      try {
        const cc = await LocationService.getCountryCode();
        if (cc && !cancelled && !manualRef.current) {
          const cur = currencyForCountry(cc);
          setCurrencyState(cur);
          AsyncStorage.setItem(STORAGE_KEY, cur.code).catch(() => {});
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Explicit user override (from a settings picker). Sticks across sessions and
  // stops GPS from changing it back.
  const setCurrency = useCallback((code) => {
    const cur = CURRENCIES[code] || DEFAULT_CURRENCY;
    manualRef.current = true;
    setCurrencyState(cur);
    AsyncStorage.setItem(STORAGE_KEY, cur.code).catch(() => {});
    AsyncStorage.setItem(MANUAL_KEY, '1').catch(() => {});
  }, []);

  // Keep the module-global in sync so the non-hook `money()` helper formats in
  // the same currency as the context.
  useEffect(() => { setActiveCurrency(currency); }, [currency]);

  const format = useCallback((amount, opts) => formatPrice(amount, currency, opts), [currency]);

  return (
    <CurrencyContext.Provider value={{ currency, symbol: currency.symbol, format, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
};

// Falls back to plain ZAR formatting if used outside a provider, so any price
// render is safe even before the tree is wired up.
export const useCurrency = () => useContext(CurrencyContext) || {
  currency: DEFAULT_CURRENCY,
  symbol: DEFAULT_CURRENCY.symbol,
  format: (amount, opts) => formatPrice(amount, DEFAULT_CURRENCY, opts),
  setCurrency: () => {},
};

export default CurrencyContext;