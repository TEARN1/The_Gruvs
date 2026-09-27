/**
 * giftAdService — persistence for the Tiered Gift System (pure rules live in
 * giftAdEngine; this is the thin DB layer).
 *
 * Redemption goes through a SECURITY DEFINER RPC (redeem_ad_gift) so the cost
 * and unlocked scope are read SERVER-SIDE from ad_gift_tiers — a client can't
 * claim a Crown's reach for a Spark's price. The RPC checks + deducts
 * profiles.vibe_coins and writes the ad_tokens row atomically.
 */
import { supabase } from './supabase';
import { giftById } from '../constants/giftTiers';
import { bestTokenForScope } from './giftAdEngine';

/** Active (unexpired) ad tokens the user holds. [] on any failure. */
export async function getActiveAdTokens(userId) {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('ad_tokens')
      .select('id, gift_id, reach, radius_km, audience_cap, issued_at, expires_at')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false });
    if (error) throw error;
    // Normalise to the shape giftAdEngine expects.
    return (data || []).map(t => ({
      id: t.id, giftId: t.gift_id, reach: t.reach,
      radiusKm: t.radius_km, audienceCap: t.audience_cap,
      issuedAt: t.issued_at, expiresAt: t.expires_at,
    }));
  } catch (e) {
    console.warn('[giftAds] getActiveAdTokens failed:', e.message);
    return [];
  }
}

/** The strongest active token that covers `scope`, or null if none / not unlocked. */
export async function getAdAccess(userId, scope) {
  const tokens = await getActiveAdTokens(userId);
  return bestTokenForScope(tokens, scope);
}

/**
 * Redeem a gift for advertising access. Server checks affordability + scope.
 * @returns {{ ok:boolean, token?:object, error?:string }}
 */
export async function redeemGiftForAds(userId, giftId) {
  const gift = giftById(giftId);
  if (!userId || !gift) return { ok: false, error: 'Invalid gift.' };
  try {
    const { data, error } = await supabase.rpc('redeem_ad_gift', { p_gift_id: giftId });
    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('insufficient') || msg.includes('coins')) {
        return { ok: false, error: `Not enough vibe coins — you need ${gift.coinCost}.` };
      }
      if (msg.includes('does not exist') || msg.includes('function') || msg.includes('relation')) {
        return { ok: false, error: 'Gifting isn’t set up yet — run the ad_gifts SQL on Supabase.' };
      }
      throw error;
    }
    const t = Array.isArray(data) ? data[0] : data;
    return {
      ok: true,
      token: t && {
        id: t.id, giftId: t.gift_id, reach: t.reach,
        radiusKm: t.radius_km, audienceCap: t.audience_cap,
        issuedAt: t.issued_at, expiresAt: t.expires_at,
      },
    };
  } catch (e) {
    return { ok: false, error: e.message || 'Could not redeem gift. Try again.' };
  }
}

export default { getActiveAdTokens, getAdAccess, redeemGiftForAds };
