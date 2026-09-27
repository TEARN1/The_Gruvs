describe('FxService', () => {
  let originalFetch;
  let FxService;
  let AsyncStorage;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    // Re-require AsyncStorage and FxService to ensure they share the same mock registry
    AsyncStorage = require('@react-native-async-storage/async-storage');
    await AsyncStorage.clear();

    FxService = require('../src/services/fxService').FxService;
  });

  it('performs network fetch on first call and caches the results', async () => {
    const mockRates = { ZAR: 1, USD: 0.054, EUR: 0.050 };
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ result: 'success', rates: mockRates }),
      })
    );

    const rates = await FxService.getRates();
    expect(rates).not.toBeNull();
    expect(rates.rates).toEqual(mockRates);
    expect(rates.base).toBe('ZAR');

    // Verify written to storage
    const cached = await AsyncStorage.getItem('gruvs_fx_rates_v1');
    expect(cached).not.toBeNull();
    const parsed = JSON.parse(cached);
    expect(parsed.rates).toEqual(mockRates);
  });

  it('uses cached rates if fresh', async () => {
    const cachedRates = {
      base: 'ZAR',
      rates: { USD: 0.06 },
      ts: Date.now(), // fresh
    };
    await AsyncStorage.setItem('gruvs_fx_rates_v1', JSON.stringify(cachedRates));

    global.fetch = jest.fn(); // should not be called

    const rates = await FxService.getRates();
    expect(rates.rates.USD).toBe(0.06);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('falls back to stale cache on network failure', async () => {
    const staleRates = {
      base: 'ZAR',
      rates: { USD: 0.05 },
      ts: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days old (stale)
    };
    await AsyncStorage.setItem('gruvs_fx_rates_v1', JSON.stringify(staleRates));

    // Force network fetch to fail
    global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));

    const rates = await FxService.getRates();
    expect(rates).not.toBeNull();
    expect(rates.rates.USD).toBe(0.05); // returns stale cache
  });

  it('rateTo returns correct rates', async () => {
    const mockRates = { ZAR: 1, USD: 0.05, EUR: 0.04 };
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ result: 'success', rates: mockRates }),
      })
    );

    await FxService.getRates();

    expect(FxService.rateTo('ZAR')).toBe(1);
    expect(FxService.rateTo('USD')).toBe(0.05);
    expect(FxService.rateTo('EUR')).toBe(0.04);
    expect(FxService.rateTo('XYZ')).toBe(1); // fallback for invalid code
    expect(FxService.rateTo(null)).toBe(1);
  });
});
