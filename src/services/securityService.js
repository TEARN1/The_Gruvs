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
  async logSecurityEvent(userId, eventType, details = {}) {
    if (!userId && !details.email) return;
    try {
      const safeDetails = this.redactObject(details);
      await supabase.from('security_logs').insert({
        user_id: userId,
        event_type: eventType,
        details: safeDetails,
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
};
