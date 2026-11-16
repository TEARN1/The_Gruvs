import { formatPrice, currencyForCountry, money, setActiveCurrency, setActiveRate, CURRENCIES, DEFAULT_CURRENCY } from '../src/constants/currencies';

describe('formatPrice (symbol/format only — never converts the number)', () => {
  it('whole numbers render with grouping and no decimals', () => {
    expect(formatPrice(1500, 'USD')).toBe('$1,500');
    expect(formatPrice(1500, 'ZAR')).toBe('R 1,500');
    expect(formatPrice(1500, 'NGN')).toBe('₦1,500');
    expect(formatPrice(1234567, 'USD')).toBe('$1,234,567');
  });

  it('keeps the same number — no FX conversion', () => {
    // 200 stays 200 in every currency, only the symbol changes.
    expect(formatPrice(200, 'USD')).toBe('$200');
    expect(formatPrice(200, 'ZAR')).toBe('R 200');
    expect(formatPrice(200, 'GBP')).toBe('£200');
  });

  it('fractional amounts show two decimals', () => {
    expect(formatPrice(1500.5, 'USD')).toBe('$1,500.50');
    expect(formatPrice(99.9, 'ZAR')).toBe('R 99.90');
  });

  it('forces decimals when asked', () => {
    expect(formatPrice(200, 'USD', { decimals: true })).toBe('$200.00');
  });

  it('handles 0, negatives and junk safely', () => {
    expect(formatPrice(0, 'ZAR')).toBe('R 0');
    expect(formatPrice(-50, 'USD')).toBe('-$50');
    expect(formatPrice('not a number', 'ZAR')).toBe('R 0');
  });
});

describe('currencyForCountry', () => {
  it('maps known countries', () => {
    expect(currencyForCountry('ZA').code).toBe('ZAR');
    expect(currencyForCountry('us').code).toBe('USD'); // case-insensitive
    expect(currencyForCountry('FR').code).toBe('EUR');
    expect(currencyForCountry('NG').code).toBe('NGN');
    expect(currencyForCountry('SN').code).toBe('XOF'); // CFA zone
  });

  // Since the platform went global, the default follows the device's region
  // (USD when the region is unknown), not a fixed ZAR.
  it('falls back to the device default for unknown / empty', () => {
    expect(currencyForCountry('ZZ')).toBe(DEFAULT_CURRENCY);
    expect(currencyForCountry(null)).toBe(DEFAULT_CURRENCY);
    expect(currencyForCountry(undefined)).toBe(DEFAULT_CURRENCY);
  });

  it('loads on a device whose region is not in the map', () => {
    // de-CH used to throw at import (DEFAULT_CURRENCY read before it existed).
    const original = Intl.DateTimeFormat;
    Intl.DateTimeFormat = () => ({ resolvedOptions: () => ({ locale: 'de-CH' }) });
    try {
      jest.isolateModules(() => {
        const mod = require('../src/constants/currencies');
        expect(mod.DEFAULT_CURRENCY.code).toBe('USD');
      });
    } finally {
      Intl.DateTimeFormat = original;
    }
  });
});

describe('money() follows the active currency', () => {
  afterEach(() => { setActiveCurrency(CURRENCIES.ZAR); setActiveRate(1); });

  it('formats in whatever currency is active', () => {
    setActiveCurrency('USD');
    expect(money(100)).toBe('$100');
    setActiveCurrency(CURRENCIES.EUR);
    expect(money(100)).toBe('€100');
  });
});

describe('money() converts via the active FX rate', () => {
  afterEach(() => { setActiveCurrency(CURRENCIES.ZAR); setActiveRate(1); });

  it('multiplies the stored (ZAR) amount by the ZAR→currency rate', () => {
    setActiveCurrency('USD');
    setActiveRate(0.05); // 200 ZAR → $10
    expect(money(200)).toBe('$10');
  });

  it('rate 1 = no conversion (symbol/format only fallback)', () => {
    setActiveCurrency('USD');
    setActiveRate(1);
    expect(money(200)).toBe('$200');
  });

  it('ignores a bogus rate (falls back to no conversion)', () => {
    setActiveCurrency('USD');
    setActiveRate(0);
    expect(money(200)).toBe('$200');
  });
});