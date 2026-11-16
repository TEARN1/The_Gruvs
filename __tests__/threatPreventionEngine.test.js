import { ThreatPreventionEngine } from '../src/services/threatPreventionEngine';
import { ExcellencyService, DEFAULT_EXCELLENCY_COURSES } from '../src/services/excellencyService';

describe('ThreatPreventionEngine', () => {
  describe('Input Sanitization & Safe Analysis', () => {
    it('passes clean inputs without false positives', () => {
      const res = ThreatPreventionEngine.analyze('Amapiano Night at Groove Lounge', { field: 'title' });
      expect(res.isSafe).toBe(true);
      expect(res.threatLevel).toBe('NONE');
      expect(res.sanitized).toBe('Amapiano Night at Groove Lounge');
    });

    it('passes safe primitives (null, numbers, booleans)', () => {
      expect(ThreatPreventionEngine.analyze(null).isSafe).toBe(true);
      expect(ThreatPreventionEngine.analyze(12345).isSafe).toBe(true);
      expect(ThreatPreventionEngine.analyze(true).isSafe).toBe(true);
    });
  });

  describe('XSS & Script Injection Prevention', () => {
    it('detects and blocks <script> tag injections', () => {
      const payload = '<script>alert("hacked")</script>Party Tonight';
      const res = ThreatPreventionEngine.analyze(payload, { field: 'description' });
      expect(res.isSafe).toBe(false);
      expect(res.threatType).toBe('CROSS_SITE_SCRIPTING');
      expect(res.threatLevel).toBe('CRITICAL');

      expect(() => {
        ThreatPreventionEngine.guard(payload);
      }).toThrow(/Security Shield/);
    });

    it('detects and blocks event-based inline XSS (onerror, onload)', () => {
      const payload = '<img src="x" onerror="alert(1)">';
      const res = ThreatPreventionEngine.analyze(payload);
      expect(res.isSafe).toBe(false);
      expect(res.threatType).toBe('CROSS_SITE_SCRIPTING');
    });

    it('detects and blocks javascript: pseudo-protocol URIs', () => {
      const payload = 'javascript:document.location="http://attacker.com"';
      const res = ThreatPreventionEngine.analyze(payload);
      expect(res.isSafe).toBe(false);
      expect(res.threatType).toBe('CROSS_SITE_SCRIPTING');
    });
  });

  describe('SQL & PostgREST Grammar Injection Prevention', () => {
    it('detects SQL injection patterns', () => {
      const payload = "Groove' OR 1=1--";
      const res = ThreatPreventionEngine.analyze(payload);
      expect(res.isSafe).toBe(false);
      expect(res.threatType).toBe('SQL_INJECTION');
    });

    it('detects and neutralizes PostgREST condition breakout injections', () => {
      const payload = 'normal),or(is_admin.eq.true';
      const res = ThreatPreventionEngine.analyze(payload, { strict: true });
      expect(res.isSafe).toBe(false);
      expect(res.threatType).toBe('POSTGREST_GRAMMAR_INJECTION');
    });

    it('escapes mild PostgREST metacharacters in low-strict mode', () => {
      const payload = 'Kasi, Lounge & Bar';
      const res = ThreatPreventionEngine.analyze(payload, { strict: false });
      expect(res.sanitized).toBe('Kasi Lounge & Bar');
    });
  });

  describe('Prototype Pollution & Privilege Escalation', () => {
    it('blocks prototype pollution keys (__proto__, constructor)', () => {
      const payload = JSON.parse('{"title": "Event", "__proto__": {"isAdmin": true}}');
      const res = ThreatPreventionEngine.analyze(payload);
      expect(res.isSafe).toBe(false);
      expect(res.threatType).toBe('PROTOTYPE_POLLUTION');
    });

    it('blocks client attempts to directly mutate privileged columns (is_admin, resident_trust_tier)', () => {
      const payload = { username: 'attacker', is_admin: true };
      const res = ThreatPreventionEngine.analyze(payload, { strict: true });
      expect(res.isSafe).toBe(false);
      expect(res.threatType).toBe('PRIVILEGE_ESCALATION');
    });

    it('drops privileged keys silently in non-strict mode without crashing', () => {
      const payload = { username: 'viber', resident_trust_tier: 'verified', bio: 'Hey' };
      const res = ThreatPreventionEngine.analyze(payload, { strict: false });
      expect(res.isSafe).toBe(true);
      expect(res.sanitized.username).toBe('viber');
      expect(res.sanitized.resident_trust_tier).toBeUndefined();
    });
  });

  describe('Domain-Specific Pillar Integrity Checks', () => {
    it('The Gruvs: enforces coordinate boundary sanity (-90 to 90)', () => {
      expect(() => {
        ThreatPreventionEngine.analyze({ latitude: 195.0, longitude: 28.0 }, { pillar: 'thegruvs' });
      }).toThrow(/Latitude must be between -90 and 90/);
    });

    it('The Gruvs: enforces non-negative ticket pricing', () => {
      expect(() => {
        ThreatPreventionEngine.analyze({ price: -50 }, { pillar: 'thegruvs' });
      }).toThrow(/Price cannot be negative/);
    });

    it('The Resident: validates seat capacity bounds', () => {
      expect(() => {
        ThreatPreventionEngine.analyze({ available_seats: -2 }, { pillar: 'theresident' });
      }).toThrow(/Available seats cannot be negative/);
    });

    it('The Resident: validates booking date chronology (check_out >= check_in)', () => {
      expect(() => {
        ThreatPreventionEngine.analyze({
          check_in: '2026-11-10',
          check_out: '2026-11-05',
        }, { pillar: 'theresident' });
      }).toThrow(/Check-out date must be on or after check-in date/);
    });

    it('Excellency: validates course progress percentage limits (0 to 100)', () => {
      expect(() => {
        ThreatPreventionEngine.analyze({ progress_percent: 150 }, { pillar: 'excellency' });
      }).toThrow(/Progress must be between 0 and 100/);
    });
  });

  describe('ExcellencyService Integration', () => {
    it('returns default masterclasses when DB is offline', async () => {
      const courses = await ExcellencyService.getCourses();
      expect(courses.length).toBeGreaterThanOrEqual(3);
      expect(courses[0].id).toBe('ex-1');
      expect(courses[0].title).toContain('Sound Engineering');
    });

    it('guards course enrollment against injection attempts', async () => {
      await expect(
        ExcellencyService.enroll('<script>alert("exploit")</script>', 'user-123')
      ).rejects.toThrow(/Security Shield/);
    });

    it('handles valid course enrollment gracefully', async () => {
      const res = await ExcellencyService.enroll('ex-1', 'user-123');
      expect(res.success).toBe(true);
      expect(res.course_id).toBe('ex-1');
    });
  });
});
