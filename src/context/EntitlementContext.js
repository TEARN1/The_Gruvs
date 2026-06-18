/**
 * EntitlementContext — the app's runtime answer to "can this user use this?".
 *
 * Reads the user's tier from their profile (profiles.subscription_tier, mirrored
 * from the store/RevenueCat webhook later) and exposes can(featureKey). NO
 * payment SDK here — this is the gating layer; the rail just sets the column.
 *
 * BOOTSTRAP-SAFE: while MONETIZATION_LIVE is false, can() returns true for
 * everything, so the whole app stays free and unchanged until you flip the
 * master switch. Fail-open by design — a billing glitch must never lock a user
 * out of a feature they had.
 */
import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { MONETIZATION_LIVE } from '../constants/MonetizationRegistry';
import { TIERS, tierAllows } from '../constants/entitlements';

const EntitlementContext = createContext(null);

const normalizeTier = (raw) => {
  const t = String(raw || '').toLowerCase().trim();
  return Object.values(TIERS).includes(t) ? t : TIERS.FREE;
};

export const EntitlementProvider = ({ children }) => {
  const { profile } = useAuth();

  const value = useMemo(() => {
    const tier = normalizeTier(profile?.subscription_tier);
    const isBusiness = tier === TIERS.BIZ_STARTER || tier === TIERS.BIZ_PRO;
    const isPro = tier === TIERS.PRO || isBusiness;

    // The gate. While monetization is off, everything is allowed (free for all).
    const can = (featureKey) => (MONETIZATION_LIVE ? tierAllows(tier, featureKey) : true);

    return { tier, isPro, isBusiness, can, monetizationLive: MONETIZATION_LIVE };
  }, [profile?.subscription_tier]);

  return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>;
};

export const useEntitlement = () => {
  const ctx = useContext(EntitlementContext);
  // Safe default if used outside the provider (e.g. an isolated test render).
  if (!ctx) return { tier: TIERS.FREE, isPro: false, isBusiness: false, can: () => true, monetizationLive: false };
  return ctx;
};
