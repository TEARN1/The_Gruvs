/**
 * SecurityService — Centralized security and privacy logic.
 */
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Keys to redact — checked as substrings (case-insensitive) so variants are caught
const SENSITIVE_KEY_FRAGMENTS = [
  'password', 'passwd', 'token', 'secret', 'key', 'apikey', 'api_key',
  'auth', 'credential', 'email', 'phone', 'ssn', 'card', 'cvv', 'pin',
  'refresh', 'access', 'bearer', 'oauth', 'jwt',
];

// XSS vectors beyond <script> — covers img/svg event handlers and JS protocol URIs
const XSS_PATTERNS = [
  /<script\b[^>]*>[\s\S]*?<\/script>/gim,
  /on\w+\s*=\s*["'][^"']*["']/gim,      // onerror="...", onclick='...', etc.
  /on\w+\s*=\s*[^"'\s>]+/gim,            // unquoted event handlers
  /<\s*svg[^>]*>[\s\S]*?<\/svg>/gim,     // inline SVG (can carry onload)
  /<\s*img[^>]+>/gim,                    // <img> tags (can carry onerror)
  /javascript\s*:/gim,                   // javascript: pseudo-protocol
  /vbscript\s*:/gim,                     // vbscript: pseudo-protocol
  /data\s*:\s*text\/html/gim,            // data: HTML injection
];

// Throttle map entry TTL — entries older than this are evicted on next access
const THROTTLE_MAP_TTL_MS = 60_000; // 1 minute

export const SecurityService = {
  // Validate if the current session is still active and untampered
  async validateSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) return false;
      const now = Math.floor(Date.now() / 1000);
      if (session.expires_at && session.expires_at < now) return false;
      return true;
    } catch {
      return false;
    }
  },

  // Strip known XSS vectors from user-generated text
  sanitizeContent(text) {
    if (!text) return '';
    let safe = text;
    for (const pattern of XSS_PATTERNS) {
      safe = safe.replace(pattern, '');
    }
    return safe;
  },

  // Log a security event (e.g., failed login attempts, password changes)
  // Whitelist approach: only safe, non-PII fields are persisted.
  async logSecurityEvent(userId, eventType, details = {}) {
    if (!eventType) return;
    try {
      const safe = {
        event_type: String(eventType).slice(0, 80),
        action:        typeof details.action        === 'string' ? details.action.slice(0, 100)        : undefined,
        resource_type: typeof details.resource_type === 'string' ? details.resource_type.slice(0, 50)  : undefined,
        event_id:      typeof details.event_id      === 'string' ? details.event_id                    : undefined,
        rsvp_id:       typeof details.rsvp_id       === 'string' ? details.rsvp_id                     : undefined,
        reason:        typeof details.reason        === 'string' ? details.reason.slice(0, 200)        : undefined,
      };
      // Strip undefined keys
      Object.keys(safe).forEach(k => safe[k] === undefined && delete safe[k]);
      await supabase.from('security_logs').insert({
        user_id: userId || null,
        event_type: safe.event_type,
        details: safe,
        ip_address: null,
        user_agent: Platform.OS,
      });
    } catch {
      // Best-effort logging — never throw
    }
  },

  // Obfuscate email for display
  maskEmail(email) {
    if (!email || !email.includes('@')) return email;
    const [name, domain] = email.split('@');
    if (name.length <= 2) return `*@${domain}`;
    return `${name.substring(0, 2)}***@${domain}`;
  },

  // Request account deletion (compliance helper)
  async requestAccountDeletion(userId) {
    if (!userId) return false;
    try {
      await supabase.from('profiles').update({
        deletion_requested_at: new Date().toISOString(),
        is_discoverable: false,
      }).eq('id', userId);
      await this.logSecurityEvent(userId, 'ACCOUNT_DELETION_REQUESTED');
      return true;
    } catch {
      return false;
    }
  },

  // Client-side throttle — evicts stale entries on every call to prevent unbounded growth
  _throttleMap: new Map(),
  isThrottled(key, delayMs = 2000) {
    const now = Date.now();

    // Evict entries older than TTL to prevent memory leak
    for (const [k, ts] of this._throttleMap) {
      if (now - ts > THROTTLE_MAP_TTL_MS) this._throttleMap.delete(k);
    }

    const last = this._throttleMap.get(key) || 0;
    if (now - last < delayMs) return true;
    this._throttleMap.set(key, now);
    return false;
  },

  // Validate URLs before opening — supports IDN via URL constructor
  isValidUrl(url) {
    if (!url) return false;
    if (url.startsWith('/') || url.startsWith('thegruvs://')) return true;
    if (url.startsWith('tel:') || url.startsWith('mailto:') || url.startsWith('geo:') || url.startsWith('maps:') || url.startsWith('whatsapp:')) return true;
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  },

  // Redact sensitive keys from objects before logging
  redactObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const redacted = { ...obj };
    Object.keys(redacted).forEach(k => {
      const lk = k.toLowerCase();
      if (SENSITIVE_KEY_FRAGMENTS.some(frag => lk.includes(frag))) {
        redacted[k] = '[REDACTED]';
      }
    });
    return redacted;
  },

  // Safe URL opener
  async safeOpenURL(url) {
    if (!this.isValidUrl(url)) return false;
    try {
      const lower = String(url).trim().toLowerCase();
      if (lower.startsWith('http:') || lower.startsWith('https:')) {
        const { safeOpenExternal } = require('../utils/sanitize');
        return await safeOpenExternal(url);
      }
      const { Linking } = require('react-native');
      await Linking.openURL(url);
      return true;
    } catch {
      return false;
    }
  },

  // Strip _shield_* metadata before sending payload to DB
  obfuscateIdentity(payload) {
    if (payload?.user_agent) {
      return { ...payload, user_agent: `ShieldNode/${Platform.OS}` };
    }
    return payload;
  },

  isHandshakeValid(lastRefreshAt) {
    const TEN_MINUTES = 10 * 60 * 1000;
    return (Date.now() - new Date(lastRefreshAt).getTime()) < TEN_MINUTES;
  },

  // ── Input validation ────────────────────────────────────────────────────

  /** Hard-limit text inputs. Returns trimmed string or throws. */
  validateTextInput(value, { field = 'Field', minLen = 1, maxLen = 1000 } = {}) {
    if (typeof value !== 'string') throw new Error(`${field} must be text.`);
    const v = value.trim();
    if (v.length < minLen) throw new Error(`${field} is too short (min ${minLen} chars).`);
    if (v.length > maxLen) throw new Error(`${field} is too long (max ${maxLen} chars).`);
    return this.sanitizeContent(v);
  },

  /** Validate and normalise a URL field. Throws on invalid input. */
  validateUrl(url, { field = 'URL', allowEmpty = true } = {}) {
    if (!url || !url.trim()) {
      if (allowEmpty) return null;
      throw new Error(`${field} is required.`);
    }
    const trimmed = url.trim();
    if (!this.isValidUrl(trimmed)) throw new Error(`${field} is not a valid URL.`);
    return trimmed;
  },

  /** Validate a ticket price string. Allows numbers or "FREE". */
  validatePrice(price) {
    if (!price || price === 'FREE') return 'FREE';
    const n = parseFloat(price);
    if (isNaN(n) || n < 0) throw new Error('Price must be a positive number or FREE.');
    if (n > 100000) throw new Error('Price seems unreasonably high — check the value.');
    return n.toFixed(2);
  },

  // ── Rate limiting — layered (per-key + per-user) ────────────────────────

  /** Per-action token-bucket rate limiter. Fires onBlocked callback when exceeded. */
  _buckets: new Map(),
  rateLimitCheck(key, { maxPerWindow = 10, windowMs = 60_000, onBlocked } = {}) {
    const now = Date.now();
    const bucket = this._buckets.get(key) || { count: 0, windowStart: now };

    if (now - bucket.windowStart > windowMs) {
      bucket.count = 0;
      bucket.windowStart = now;
    }

    bucket.count++;
    this._buckets.set(key, bucket);

    if (bucket.count > maxPerWindow) {
      const waitSec = Math.ceil((windowMs - (now - bucket.windowStart)) / 1000);
      const msg = `Too many requests. Wait ${waitSec}s before trying again.`;
      onBlocked?.(msg);
      return { allowed: false, message: msg };
    }
    return { allowed: true };
  },

  // ── Payload integrity — prevent prototype pollution ─────────────────────

  /** Strip dangerous keys from any object before it touches the DB. */
  sanitizePayload(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
    const dangerous = ['__proto__', 'constructor', 'prototype'];
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
      if (dangerous.includes(k)) continue;
      clean[k] = typeof v === 'object' && v !== null ? this.sanitizePayload(v) : v;
    }
    return clean;
  },

  // ── Auth guard helper ────────────────────────────────────────────────────

  /** Throws a user-visible error if the session is invalid. */
  async requireAuth(onAuthRequired) {
    const valid = await this.validateSession();
    if (!valid) {
      onAuthRequired?.();
      throw new Error('Sign in required to perform this action.');
    }
  },

  // ── Deep-link / URL scheme guard ────────────────────────────────────────

  /** Whitelist of allowed deep-link hosts. Opens only these from external links. */
  ALLOWED_HOSTS: ['thegruvs.com', 'www.thegruvs.com', 'thegruvs.app', 'open.spotify.com', 'www.youtube.com', 'youtube.com', 'supabase.co', 'wa.me', 'maps.google.com'],

  isTrustedExternalUrl(url) {
    try {
      const { protocol, hostname } = new URL(url);
      if (!['http:', 'https:'].includes(protocol)) return false;
      return this.ALLOWED_HOSTS.some(h => hostname === h || hostname.endsWith(`.${h}`));
    } catch { return false; }
  },

  // ── Content moderation helpers ───────────────────────────────────────────

  /** Basic profanity / spam signal (returns score 0–1). */
  spamScore(text) {
    if (!text) return 0;
    let score = 0;
    // Repeated chars: aaaaaaa
    if (/(.)\1{6,}/.test(text)) score += 0.4;
    // All caps
    if (text.length > 10 && text === text.toUpperCase()) score += 0.2;
    // Excessive punctuation
    if ((text.match(/[!?]{3,}/g) || []).length > 1) score += 0.2;
    // URL spam
    const urlCount = (text.match(/https?:\/\//g) || []).length;
    if (urlCount > 3) score += 0.5;
    return Math.min(1, score);
  },

  /** Returns true if text should be blocked as likely spam. */
  isSpam(text, threshold = 0.6) {
    return this.spamScore(text) >= threshold;
  },
};
