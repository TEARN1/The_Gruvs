/**
 * ResidentTrustBadge — "Via The Resident" provenance pill.
 *
 * Renders when a profile carries resident_trust_tier ('trusted' | 'verified'),
 * the denormalised flag written by the res_sync_trust() RPC
 * (supabase/queries/resident_trust_bridge.sql). Pure + null-safe: on profiles
 * fetched without the column (or before the trust bridge is deployed) tier is
 * simply undefined and nothing renders — this can never error.
 *
 *   trusted  = complete Resident profile
 *   verified = complete + ID doc reviewed (also lifts profiles.is_verified)
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

const RESIDENT_GREEN = '#22c55e';

export const ResidentTrustBadge = ({ tier, size = 'small', style }) => {
  if (tier !== 'trusted' && tier !== 'verified') return null;

  const verified = tier === 'verified';
  const large = size === 'large';

  return (
    <View style={[rt.pill, large && rt.pillLarge, style]}>
      <Feather name={verified ? 'shield' : 'home'} size={large ? 12 : 9} color={RESIDENT_GREEN} />
      <Text style={[rt.text, large && rt.textLarge]}>
        {verified ? 'Verified via The Resident' : 'Trusted via The Resident'}
      </Text>
    </View>
  );
};

const rt = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
          backgroundColor: '#22c55e12', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3,
          borderWidth: 1, borderColor: '#22c55e40' },
  pillLarge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, gap: 6 },
  text:      { color: RESIDENT_GREEN, fontSize: 9, fontWeight: '900' },
  textLarge: { fontSize: 11 },
});
