/**
 * affiliate — turn outbound links (tickets, rides, stays) into revenue links.
 *
 * The cheapest money there is: zero payment rail, zero handling. When a user
 * taps "Get Passes" we route through the partner's affiliate program so a sale
 * pays a commission. Until you actually sign a program, this is a NO-OP — the
 * original URL is returned untouched (RAILS_CONNECTED.affiliate stays false and
 * ref codes are blank), so nothing breaks pre-revenue.
 *
 * To switch on: (1) sign the partner program, (2) set its refCode below,
 * (3) flip RAILS_CONNECTED.affiliate = true in MonetizationRegistry.js.
 */
import { RAILS_CONNECTED } from '../constants/MonetizationRegistry';

// Partner → how to recognise its links + how to attach your referral.
// hosts: substrings matched against the URL host. param/refCode: the query the
// program expects. Fill refCode once you have an account; blank = skip (no-op).
export const AFFILIATE_PARTNERS = [
  // ── SA ticketing ──
  { id: 'quicket',     hosts: ['quicket.co.za'],            param: 'ref',         refCode: '' },
  { id: 'webtickets',  hosts: ['webtickets.co.za'],         param: 'ref',         refCode: '' },
  { id: 'howler',      hosts: ['howler.co.za'],             param: 'ref',         refCode: '' },
  { id: 'computicket', hosts: ['computicket.com'],          param: 'affiliate',   refCode: '' },
  // ── Ride home / transport ──
  { id: 'bolt',        hosts: ['bolt.eu', 'b.olt.me'],      param: 'referral',    refCode: '' },
  { id: 'uber',        hosts: ['uber.com'],                 param: 'promo',       refCode: '' },
];

const hostOf = (url) => {
  try { return new URL(url).host.toLowerCase(); }
  catch { const m = String(url).match(/^[a-z]+:\/\/([^/?#]+)/i); return m ? m[1].toLowerCase() : ''; }
};

const matchPartner = (url) => {
  const host = hostOf(url);
  if (!host) return null;
  return AFFILIATE_PARTNERS.find(p => p.hosts.some(h => host.includes(h))) || null;
};

/**
 * Returns the affiliate-tagged URL if the rail is live, the link matches a
 * partner, and that partner has a ref code set — otherwise the original URL.
 */
export function affiliateUrl(url) {
  if (!url || typeof url !== 'string') return url;
  if (!RAILS_CONNECTED.affiliate) return url;           // rail off → untouched
  const partner = matchPartner(url);
  if (!partner || !partner.refCode) return url;          // no partner / no code → untouched
  try {
    const u = new URL(url);
    if (!u.searchParams.has(partner.param)) u.searchParams.set(partner.param, partner.refCode);
    return u.toString();
  } catch {
    // Fallback for environments without URL: only append if it's clearly safe.
    const sep = url.includes('?') ? '&' : '?';
    return url.includes(`${partner.param}=`) ? url : `${url}${sep}${partner.param}=${encodeURIComponent(partner.refCode)}`;
  }
}

/** True if this URL is one we have (or could have) an affiliate deal on. */
export const isAffiliateLink = (url) => !!matchPartner(url);

export default { affiliateUrl, isAffiliateLink, AFFILIATE_PARTNERS };
