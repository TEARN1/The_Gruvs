/**
 * partnerService.js — Partner telemetry, conversion tracking & smart context triggers.
 *
 * Tracks:
 *   - Impressions (viewing partner banners/cards)
 *   - Clicks (tapping CTAs)
 *   - Conversions & Referrals (passing referral tokens)
 *
 * Delivers:
 *   - Auto-generated partner referral links (e.g. ?ref=thegruvs)
 *   - 1-click promo code copy helper
 *   - Distance-aware stay recommendation engine (if event > 25km away)
 */
import { SecurityService } from './securityService';
import { track } from '../utils/analytics';

export const PartnerService = {
  /**
   * Log an impression for partner campaign analytics
   */
  async logImpression(partnerKey, slot = 'feed', userId = null) {
    if (!partnerKey) return;
    try {
      track('partner_impression', {
        partnerKey: String(partnerKey).slice(0, 40),
        slot: String(slot).slice(0, 30),
      });
    } catch (_) {
      // Best-effort telemetry; never interrupt app execution
    }
  },

  /**
   * Log a click and open partner URL with referral token
   */
  async logClickAndOpen(partnerKey, url, slot = 'feed', userId = null) {
    if (!url) return;
    try {
      track('partner_click', {
        partnerKey: String(partnerKey).slice(0, 40),
        slot: String(slot).slice(0, 30),
      });
    } catch (_) {}

    // Append clean referral parameter
    const sep = url.includes('?') ? '&' : '?';
    const finalUrl = `${url}${sep}ref=thegruvs&src=mobile_app`;
    await SecurityService.safeOpenURL(finalUrl);
  },

  /**
   * Determine if an event is far enough to warrant suggesting The Resident Crew
   */
  shouldSuggestStays(distanceKm) {
    return typeof distanceKm === 'number' && distanceKm > 20;
  },

  /**
   * Official partner promo codes
   */
  getPromoCode(partnerKey) {
    if (partnerKey === 'theresidentcrew') {
      return { code: 'THEGRUVS10', discount: '10% OFF stays' };
    }
    return null;
  }
};
