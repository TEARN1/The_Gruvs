import { throttleAsync, preventDoubleTap, normalizeSyncPayload } from '../src/utils/monkeyHelpers';
import { SecurityService } from '../src/services/securityService';

// Mock Supabase to avoid initialization error warnings
jest.mock('../src/services/supabase', () => {
  return {
    supabase: {
      auth: {
        getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      },
      from: jest.fn(() => ({})),
    },
  };
});

describe('Monkey Testing & Safety Utilities', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('throttleAsync', () => {
    it('allows a single call to execute and blocks concurrent calls', async () => {
      let resolveFn;
      const asyncJob = jest.fn(() => new Promise((resolve) => {
        resolveFn = resolve;
      }));

      const throttled = throttleAsync(asyncJob, 500);

      // Trigger first call
      const promise1 = throttled('call-1');
      // Trigger second call immediately while first is running
      const promise2 = throttled('call-2');

      expect(asyncJob).toHaveBeenCalledTimes(1);
      expect(asyncJob).toHaveBeenCalledWith('call-1');

      // Second call should report throttled status
      const res2 = await promise2;
      expect(res2).toEqual({ throttled: true });

      // Resolve the first call
      resolveFn('done-1');
      const res1 = await promise1;
      expect(res1).toEqual({ throttled: false, result: 'done-1' });
    });

    it('allows call execution again after the cooldown timer expires', async () => {
      const asyncJob = jest.fn((val) => Promise.resolve(val));
      const throttled = throttleAsync(asyncJob, 500);

      const res1 = await throttled('A');
      expect(res1).toEqual({ throttled: false, result: 'A' });

      // Call B immediately (still in cooldown)
      const res2 = await throttled('B');
      expect(res2).toEqual({ throttled: true });

      // Fast-forward cooldown timer
      jest.advanceTimersByTime(501);

      // Call C (cooldown expired)
      const res3 = await throttled('C');
      expect(res3).toEqual({ throttled: false, result: 'C' });
      expect(asyncJob).toHaveBeenCalledTimes(2);
    });
  });

  describe('preventDoubleTap', () => {
    it('throttles double clicks within the specified delay window', () => {
      const handler = jest.fn();
      const click = preventDoubleTap(handler, 300);

      click('first');
      click('second'); // within 300ms, should be ignored

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith('first');

      // Move time forward past delay
      jest.advanceTimersByTime(301);

      click('third');
      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith('third');
    });
  });

  describe('normalizeSyncPayload', () => {
    it('returns default fallback values for null, undefined, or empty payloads', () => {
      const fallback = normalizeSyncPayload(null);
      expect(fallback.id).toBe('unknown');
      expect(fallback.profile.username).toBe('Anonymous');
      expect(fallback.gps.lat).toBe(0);
      expect(fallback.gps.lng).toBe(0);

      const fallbackUndefined = normalizeSyncPayload(undefined);
      expect(fallbackUndefined.profile.username).toBe('Anonymous');
    });

    it('corrects invalid GPS coordinates to boundaries', () => {
      const payload = {
        id: '123',
        gps: { lat: 120, lng: -250 } // out of bounds
      };
      const normalized = normalizeSyncPayload(payload);
      expect(normalized.gps.lat).toBe(90); // max lat
      expect(normalized.gps.lng).toBe(-180); // min lng
    });

    it('coerces string representations of lat/lng numbers', () => {
      const payload = {
        gps: { lat: '45.123', lng: '-12.456' }
      };
      const normalized = normalizeSyncPayload(payload);
      expect(normalized.gps.lat).toBe(45.123);
      expect(normalized.gps.lng).toBe(-12.456);
    });

    it('provides fallback text for missing username and invalid timestamps', () => {
      const payload = {
        profile: { username: '', avatar_url: 'http://pic' },
        updated_at: 'not-a-valid-date-string'
      };
      const normalized = normalizeSyncPayload(payload);
      expect(normalized.profile.username).toBe('Anonymous');
      expect(normalized.profile.avatar_url).toBe('http://pic');
      // Should fall back to current time ISO string
      expect(new Date(normalized.updated_at).getTime()).not.toBeNaN();
    });
  });

  describe('Security Input Stress (Monkey Checks)', () => {
    it('properly validates and sanitizes malicious script tags and prototype pollution', () => {
      const maliciousPayload = {
        username: '<script>alert(1)</script>hacker',
        __proto__: { isAdmin: true },
        nested: {
          constructor: { prototype: { poll: 'polluted' } }
        }
      };

      // 1. Sanitize payload prototype pollution
      const cleanPayload = SecurityService.sanitizePayload(maliciousPayload);
      expect(cleanPayload.username).toBe('<script>alert(1)</script>hacker');
      expect(cleanPayload.isAdmin).toBeUndefined();
      expect(Object.prototype.hasOwnProperty.call(cleanPayload, '__proto__')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(cleanPayload.nested, 'constructor')).toBe(false);

      // 2. Sanitize specific text fields against XSS injection
      const xssSanitized = SecurityService.sanitizeContent(cleanPayload.username);
      expect(xssSanitized).toBe('hacker');
    });

    it('gracefully handles large input streams without crashing the validator', () => {
      const largeInput = 'a'.repeat(10000); // 10KB input
      expect(() => {
        SecurityService.validateTextInput(largeInput, { minLen: 1, maxLen: 50 });
      }).toThrow('is too long');
    });

    it('handles database injection characters safely', () => {
      const sqlInjectionPattern = "' OR 1=1; DROP TABLE users; --";
      const sanitized = SecurityService.sanitizeContent(sqlInjectionPattern);
      // No tags or scripts present, stays as is or gets safe
      expect(sanitized).toBe(sqlInjectionPattern);

      const scriptSql = "<script>delete</script>' OR 1=1;";
      expect(SecurityService.sanitizeContent(scriptSql)).toBe("' OR 1=1;");
    });
  });
});
