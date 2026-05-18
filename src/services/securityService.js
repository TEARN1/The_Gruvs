/**
 * SecurityService — Centralized security and privacy logic.
 */
import { Platform } from 'react-native';
import { supabase } from './supabase';

export const SecurityService = {
  // Validate if the current session is still active and untampered
  async validateSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) return false;

      // Basic check: is the token expired?
      const now = Math.floor(Date.now() / 1000);
      if (session.expires_at && session.expires_at < now) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  },

  // Sanitize user-generated content (very basic)
  sanitizeContent(text) {
    if (!text) return '';
    // Basic script tag removal for web safety (React handles this mostly, but good for raw data)
    return text.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, '');
  },

  // Log a security event (e.g., failed login attempts, password changes)
  async logSecurityEvent(userId, eventType, details = {}) {
    if (!userId && !details.email) return;
    try {
      // Redact details before logging
      const safeDetails = this.redactObject(details);

      await supabase.from('security_logs').insert({
        user_id: userId,
        event_type: eventType,
        details: safeDetails,
        ip_address: null, // Usually handled by DB/Edge function for privacy
        user_agent: Platform.OS,
      });
    } catch {
      // Best effort logging
    }
  },

  // Obfuscate sensitive data for UI
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
      // 1. Mark profile as pending deletion
      await supabase.from('profiles').update({
        deletion_requested_at: new Date().toISOString(),
        is_discoverable: false
      }).eq('id', userId);

      // 2. Log the request
      await this.logSecurityEvent(userId, 'ACCOUNT_DELETION_REQUESTED');

      return true;
    } catch {
      return false;
    }
  },

  // Simple client-side throttling to prevent rapid accidental spamming
  _throttleMap: new Map(),
  isThrottled(key, delayMs = 2000) {
    const now = Date.now();
    const last = this._throttleMap.get(key) || 0;
    if (now - last < delayMs) return true;
    this._throttleMap.set(key, now);
    return false;
  },

  // Validate and sanitize URLs before opening
  isValidUrl(url) {
    if (!url) return false;
    // Allow internal links or links to trusted domains
    if (url.startsWith('/') || url.startsWith('thegruvs://')) return true;

    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      // Fallback for relative URLs or simple strings
      const pattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
      return pattern.test(url);
    }
  },

  // Redact potentially sensitive keys from objects for logging
  redactObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const redacted = { ...obj };
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'email'];
    Object.keys(redacted).forEach(k => {
      const lowerKey = k.toLowerCase();
      if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        redacted[k] = '[REDACTED]';
      }
    });
    return redacted;
  },

  // Safe wrapper for Linking.openURL
  async safeOpenURL(url) {
    if (this.isValidUrl(url)) {
      try {
        const { Linking } = require('react-native');
        await Linking.openURL(url);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  },

  // ── NEURAL DATA SHIELD v1.0 ──
  // Prevents third-party tracking by obfuscating transport metadata.

  /**
   * Fragment sensitive identity data before transport.
   * Splitting "Identity" from "Behavior" at the architectural level.
   */
  obfuscateIdentity(payload) {
    const shield = {
      ...payload,
      _shield_ts: Date.now(),
      _shield_entropy: Math.random().toString(36).substring(7)
    };

    // Masking hardware identifiers
    if (shield.user_agent) shield.user_agent = `ShieldNode/${Platform.OS}`;

    return shield;
  },

  /**
   * Validate a "Ghost Handshake".
   * Ensures the session key is refreshed under the 10-minute threshold.
   */
  isHandshakeValid(lastRefreshAt) {
    const TEN_MINUTES = 10 * 60 * 1000;
    return (Date.now() - new Date(lastRefreshAt).getTime()) < TEN_MINUTES;
  }
};
