import { SecurityService } from '../src/services/securityService';
import { supabase } from '../src/services/supabase';

// Mock Supabase
jest.mock('../src/services/supabase', () => {
  const mockInsert = jest.fn(() => Promise.resolve({ error: null }));
  const mockUpdate = jest.fn(() => ({
    eq: jest.fn(() => Promise.resolve({ error: null })),
  }));
  return {
    supabase: {
      auth: {
        getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
        signOut: jest.fn(() => Promise.resolve({ error: null })),
      },
      from: jest.fn(() => ({
        insert: mockInsert,
        update: mockUpdate,
      })),
    },
  };
});

describe('SecurityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sanitizeContent', () => {
    it('strips HTML <script> tags', () => {
      const input = 'Hello <script>alert("hack")</script> World!';
      expect(SecurityService.sanitizeContent(input)).toBe('Hello  World!');
    });

    it('strips inline HTML event handlers', () => {
      const input = '<img src="x" onerror="alert(1)" onload=\'console.log(2)\'/>';
      // onerror and onload attributes should be stripped
      const output = SecurityService.sanitizeContent(input);
      expect(output).not.toContain('onerror');
      expect(output).not.toContain('onload');
    });

    it('strips javascript: and vbscript: pseudo-protocols', () => {
      expect(SecurityService.sanitizeContent('javascript:alert(1)')).toBe('alert(1)');
      expect(SecurityService.sanitizeContent('vbscript:msgbox(1)')).toBe('msgbox(1)');
    });

    it('handles empty input gracefully', () => {
      expect(SecurityService.sanitizeContent('')).toBe('');
      expect(SecurityService.sanitizeContent(null)).toBe('');
    });
  });

  describe('redactObject', () => {
    it('redacts sensitive fields like password and token', () => {
      const obj = {
        username: 'user1',
        password: 'supersecretpassword',
        sessionToken: 'xyz123',
        normalProp: 'ok', // key containing no sensitive fragment
      };
      const redacted = SecurityService.redactObject(obj);
      expect(redacted.username).toBe('user1');
      expect(redacted.password).toBe('[REDACTED]');
      expect(redacted.sessionToken).toBe('[REDACTED]');
      expect(redacted.normalProp).toBe('ok');
    });

    it('redacts case-insensitively', () => {
      const obj = { PASSWORD: '123', APikey: 'abc' };
      const redacted = SecurityService.redactObject(obj);
      expect(redacted.PASSWORD).toBe('[REDACTED]');
      expect(redacted.APikey).toBe('[REDACTED]');
    });
  });

  describe('validateTextInput', () => {
    it('returns sanitized text if inside length constraints', () => {
      const output = SecurityService.validateTextInput('  Valid Text<script></script>  ', { minLen: 2, maxLen: 50 });
      expect(output).toBe('Valid Text');
    });

    it('throws error when length is below minimum', () => {
      expect(() => {
        SecurityService.validateTextInput('a', { minLen: 3, maxLen: 10 });
      }).toThrow('is too short');
    });

    it('throws error when length is above maximum', () => {
      expect(() => {
        SecurityService.validateTextInput('a'.repeat(20), { minLen: 1, maxLen: 10 });
      }).toThrow('is too long');
    });
  });

  describe('validatePrice', () => {
    it('allows FREE', () => {
      expect(SecurityService.validatePrice('FREE')).toBe('FREE');
    });

    it('returns formatted price string for valid numbers', () => {
      expect(SecurityService.validatePrice('45')).toBe('45.00');
      expect(SecurityService.validatePrice('99.99')).toBe('99.99');
    });

    it('throws for negative prices or extremely large prices', () => {
      expect(() => SecurityService.validatePrice('-5')).toThrow();
      expect(() => SecurityService.validatePrice('9999999')).toThrow('Price seems unreasonably high');
    });

    it('throws for invalid numeric input', () => {
      expect(() => SecurityService.validatePrice('abc')).toThrow();
    });
  });

  describe('rateLimitCheck', () => {
    it('allows requests within threshold and blocks when exceeded', () => {
      const key = 'user_login_attempt';
      // Allow 3 requests per 10 seconds
      for (let i = 0; i < 3; i++) {
        const check = SecurityService.rateLimitCheck(key, { maxPerWindow: 3, windowMs: 10000 });
        expect(check.allowed).toBe(true);
      }
      const checkBlocked = SecurityService.rateLimitCheck(key, { maxPerWindow: 3, windowMs: 10000 });
      expect(checkBlocked.allowed).toBe(false);
      expect(checkBlocked.message).toContain('Too many requests');
    });
  });

  describe('sanitizePayload', () => {
    it('removes dangerous prototype pollution keys', () => {
      const payload = {
        name: 'test',
        __proto__: { admin: true },
        nested: {
          constructor: { prototype: { hacked: true } },
          value: 1,
        },
      };
      const clean = SecurityService.sanitizePayload(payload);
      expect(clean.name).toBe('test');
      expect(Object.prototype.hasOwnProperty.call(clean, '__proto__')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(clean.nested, 'constructor')).toBe(false);
      expect(clean.nested.value).toBe(1);
    });
  });

  describe('spamScore', () => {
    it('scores low for normal text', () => {
      expect(SecurityService.spamScore('Hello, how are you today?')).toBe(0);
    });

    it('detects repeated characters', () => {
      expect(SecurityService.spamScore('aaaaaaa')).toBeGreaterThanOrEqual(0.4);
    });

    it('detects excessive capitalization', () => {
      expect(SecurityService.spamScore('HELLO THIS IS AN EXTREMELY URGENT MESSAGE')).toBeGreaterThanOrEqual(0.2);
    });
  });
});
