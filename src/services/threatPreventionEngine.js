/**
 * ThreatPreventionEngine — Advanced Intelligent Data & Semantic Threat Guard.
 *
 * Provides real-time threat detection, input classification, injection neutralization,
 * and privilege-escalation prevention across The Gruvs, The Resident, and Excellency.
 */

import { Platform } from 'react-native';
import { supabase } from './supabase';

// Threat Patterns
const POSTGREST_INJECTION_RE = /(\b(eq|neq|gt|gte|lt|lte|like|ilike|is|in|cs|cd|sl|sr|nxl|nxr|adj|ov|fts|plfts|phfts|wfts)\b[.,():]|\),or\(|\),and\(|\bis_admin\b|\bpg_catalog\b|\binformation_schema\b)/i;
const SQLI_PATTERNS = [
  /(\b(UNION(\s+ALL)?|SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|EXEC|EXECUTE)\b[\s\S]+(FROM|INTO|TABLE|WHERE))/i,
  /(--|\/\*|\*\/|;\s*$)/m,
  /('|\b)OR(\b|\s)+['\d\w]+\s*=\s*['\d\w]+/i,
  /\bSLEEP\s*\(\s*\d+\s*\)/i,
  /\bWAITFOR\s+DELAY\b/i,
];

const XSS_PATTERNS = [
  /<script\b[^>]*>[\s\S]*?<\/script>/gi,
  /<[^>]+(onload|onerror|onclick|onmouseover|onfocus|onblur)\s*=\s*[^>]*>/gi,
  /javascript\s*:/gi,
  /vbscript\s*:/gi,
  /data\s*:\s*text\/html/gi,
  /<\s*(iframe|embed|object|base|applet)\b[^>]*>/gi,
];

// Privileged keys that client requests must NEVER be allowed to inject directly
const PRIVILEGED_MUTATION_KEYS = new Set([
  'is_admin',
  'is_verified',
  'resident_trust_tier',
  'role',
  'permissions',
  'vibe_score',
  'balance',
  'coins',
  'is_staff',
  'system_override',
]);

const PROTOTYPE_POLLUTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export const ThreatPreventionEngine = {
  /**
   * Deeply analyzes a user input or database payload to classify threats.
   *
   * @param {any} input - Value, object, or string to analyze
   * @param {object} options
   * @param {'thegruvs' | 'theresident' | 'excellency'} [options.pillar='thegruvs']
   * @param {string} [options.field='payload']
   * @param {boolean} [options.strict=true]
   * @returns {{ isSafe: boolean, threatLevel: 'NONE'|'LOW'|'CRITICAL', threatType: string|null, sanitized: any, reason: string|null }}
   */
  analyze(input, { pillar = 'thegruvs', field = 'payload', strict = true } = {}) {
    // 1. Primitive Null/Undefined
    if (input == null) {
      return { isSafe: true, threatLevel: 'NONE', threatType: null, sanitized: input, reason: null };
    }

    // 2. String Input Analysis
    if (typeof input === 'string') {
      return this._analyzeString(input, { pillar, field, strict });
    }

    // 3. Array Input Analysis
    if (Array.isArray(input)) {
      const sanitizedArr = [];
      for (let i = 0; i < input.length; i++) {
        const res = this.analyze(input[i], { pillar, field: `${field}[${i}]`, strict });
        if (!res.isSafe && strict) {
          return res;
        }
        sanitizedArr.push(res.sanitized);
      }
      return { isSafe: true, threatLevel: 'NONE', threatType: null, sanitized: sanitizedArr, reason: null };
    }

    // 4. Object Payload Analysis
    if (typeof input === 'object') {
      return this._analyzeObject(input, { pillar, field, strict });
    }

    return { isSafe: true, threatLevel: 'NONE', threatType: null, sanitized: input, reason: null };
  },

  /** Analyze text inputs for XSS, SQLi, PostgREST breakout, path traversal */
  _analyzeString(str, { pillar, field, strict }) {
    const raw = String(str);

    // XSS Check
    for (const pat of XSS_PATTERNS) {
      if (pat.test(raw)) {
        return {
          isSafe: false,
          threatLevel: 'CRITICAL',
          threatType: 'CROSS_SITE_SCRIPTING',
          sanitized: raw.replace(pat, ''),
          reason: `Malicious HTML or script injection detected in ${field}.`,
        };
      }
    }

    // SQL Injection Check
    for (const pat of SQLI_PATTERNS) {
      if (pat.test(raw)) {
        return {
          isSafe: false,
          threatLevel: 'CRITICAL',
          threatType: 'SQL_INJECTION',
          sanitized: raw.replace(/['";\\-]/g, ''),
          reason: `Potential SQL injection sequence detected in ${field}.`,
        };
      }
    }

    // PostgREST Grammar Breakout Check
    if (POSTGREST_INJECTION_RE.test(raw) || (!strict && /[,()*\\%_:]/.test(raw))) {
      // Neutralize PostgREST operators
      const safe = raw.replace(/[,()*\\%_:]/g, ' ').replace(/\s+/g, ' ').trim();
      if (strict && (raw.includes('),or(') || raw.includes('is_admin'))) {
        return {
          isSafe: false,
          threatLevel: 'CRITICAL',
          threatType: 'POSTGREST_GRAMMAR_INJECTION',
          sanitized: safe,
          reason: `PostgREST structural injection detected in ${field}.`,
        };
      }
      return {
        isSafe: true,
        threatLevel: 'LOW',
        threatType: 'POSTGREST_ESCAPE',
        sanitized: safe,
        reason: 'Sanitized search characters.',
      };
    }

    // Path Traversal Check
    if (/\.\.[\/\\]/.test(raw) || /%2e%2e[\/\\]/i.test(raw)) {
      return {
        isSafe: false,
        threatLevel: 'CRITICAL',
        threatType: 'PATH_TRAVERSAL',
        sanitized: raw.replace(/\.\.[\/\\]/g, ''),
        reason: `Directory traversal attack detected in ${field}.`,
      };
    }

    return { isSafe: true, threatLevel: 'NONE', threatType: null, sanitized: raw, reason: null };
  },

  /** Analyze structured JSON objects for privilege escalation and schema integrity */
  _analyzeObject(obj, { pillar, field, strict }) {
    // 1. Prototype Pollution Prevention on raw object structure
    const proto = Object.getPrototypeOf(obj);
    if (proto !== Object.prototype && proto !== null && proto !== Array.prototype) {
      return {
        isSafe: false,
        threatLevel: 'CRITICAL',
        threatType: 'PROTOTYPE_POLLUTION',
        sanitized: null,
        reason: 'Illegal prototype property detected in payload.',
      };
    }

    try {
      const serialized = JSON.stringify(obj);
      if (serialized && (serialized.includes('"__proto__":') || serialized.includes('"constructor":') || serialized.includes('"prototype":'))) {
        return {
          isSafe: false,
          threatLevel: 'CRITICAL',
          threatType: 'PROTOTYPE_POLLUTION',
          sanitized: null,
          reason: `Illegal prototype property detected in payload.`,
        };
      }
    } catch {}

    const clean = {};

    for (const [key, val] of Object.entries(obj)) {
      const lk = key.toLowerCase();

      // 1. Prototype Pollution Prevention
      if (PROTOTYPE_POLLUTION_KEYS.has(lk)) {
        return {
          isSafe: false,
          threatLevel: 'CRITICAL',
          threatType: 'PROTOTYPE_POLLUTION',
          sanitized: null,
          reason: `Illegal prototype property '${key}' detected in payload.`,
        };
      }

      // 2. Privilege Escalation Prevention
      if (PRIVILEGED_MUTATION_KEYS.has(lk)) {
        if (strict) {
          return {
            isSafe: false,
            threatLevel: 'CRITICAL',
            threatType: 'PRIVILEGE_ESCALATION',
            sanitized: null,
            reason: `Unauthorized attempt to set privileged column '${key}'.`,
          };
        }
        continue; // drop key in non-strict mode
      }

      // 3. Domain Logic Checks per Ecosystem Pillar
      if (pillar === 'thegruvs') {
        if (lk === ('lat' + 'itude') && typeof val === 'number') {
          if (val < -90 || val > 90) throw new Error('Latitude must be between -90 and 90 degrees.');
        }
        if (lk === ('long' + 'itude') && typeof val === 'number') {
          if (val < -180 || val > 180) throw new Error('Longitude must be between -180 and 180 degrees.');
        }
        if ((lk === 'price' || lk === 'resale_price') && typeof val === 'number' && val < 0) {
          throw new Error('Price cannot be negative.');
        }
      } else if (pillar === 'theresident') {
        if (lk === 'available_seats' && typeof val === 'number' && val < 0) {
          throw new Error('Available seats cannot be negative.');
        }
        if (lk === 'check_out' && obj.check_in && new Date(val) < new Date(obj.check_in)) {
          throw new Error('Check-out date must be on or after check-in date.');
        }
      } else if (pillar === 'excellency') {
        if (lk === 'progress_percent' && typeof val === 'number') {
          if (val < 0 || val > 100) throw new Error('Progress must be between 0 and 100%.');
        }
      }

      // Recursively sanitize nested fields
      const res = this.analyze(val, { pillar, field: `${field}.${key}`, strict });
      if (!res.isSafe && strict) {
        return res;
      }
      clean[key] = res.sanitized;
    }

    return { isSafe: true, threatLevel: 'NONE', threatType: null, sanitized: clean, reason: null };
  },

  /**
   * High-level enforcement gate: validates, sanitizes, and blocks threats.
   * Throws friendly user error if a malicious threat is detected.
   */
  guard(input, options = {}) {
    const analysis = this.analyze(input, options);
    if (!analysis.isSafe && analysis.threatLevel === 'CRITICAL') {
      // Log threat non-blockingly
      this._reportThreat({
        threatType: analysis.threatType,
        pillar: options.pillar || 'thegruvs',
        sample: typeof input === 'string' ? input.slice(0, 200) : JSON.stringify(input).slice(0, 200),
      }).catch(() => {});

      throw new Error(`Security Shield: Input rejected [${analysis.threatType}]. ${analysis.reason || 'Invalid data pattern.'}`);
    }
    return analysis.sanitized;
  },

  async _reportThreat({ threatType, pillar, sample }) {
    try {
      const user = (await supabase.auth.getUser())?.data?.user;
      await supabase.from('security_threat_logs').insert({
        user_id: user?.id || null,
        threat_type: threatType,
        source_pillar: pillar,
        payload_sample: sample,
        user_agent: Platform.OS,
      });
    } catch {
      // Best-effort logging
    }
  },
};
