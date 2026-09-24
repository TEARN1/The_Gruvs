/**
 * CurrencyPicker — manual override for the display currency.
 *
 * Currency is auto-set from the viewer's GPS location; this lets them pick a
 * different one (which then sticks and isn't overridden by location). Prices
 * only change symbol/format — amounts are never converted.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useCurrency } from '../context/CurrencyContext';
import { CURRENCIES } from '../constants/currencies';

export const CurrencyPicker = ({ primary = '#00f2ff', textColor = '#fff', muted = 'rgba(255,255,255,0.55)' }) => {
  const { currency, setCurrency } = useCurrency();
  const list = Object.values(CURRENCIES);

  return (
    <View style={cp.wrap}>
      <View style={cp.headerRow}>
        <Feather name="dollar-sign" size={14} color={primary} />
        <Text style={[cp.title, { color: textColor }]}>Currency</Text>
        <Text style={[cp.code, { color: muted }]}>{currency.code}</Text>
      </View>
      <Text style={[cp.hint, { color: muted }]}>
        Auto-set from your location. Tap to override — prices show the local symbol only (amounts aren't converted).
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2, paddingRight: 8 }}>
        {list.map((c) => {
          const active = currency.code === c.code;
          return (
            <TouchableOpacity
              key={c.code}
              onPress={() => setCurrency(c.code)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`${c.name} (${c.code})`}
              accessibilityState={{ selected: active }}
              style={[cp.chip, { backgroundColor: active ? primary : `${primary}10`, borderColor: active ? primary : `${primary}28` }]}
            >
              <Text style={{ color: active ? '#000' : textColor, fontSize: 15, fontWeight: '900' }} numberOfLines={1}>{c.symbol}</Text>
              <Text style={{ color: active ? '#000' : muted, fontSize: 9, fontWeight: '800', marginTop: 2 }} numberOfLines={1}>{c.code}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const cp = StyleSheet.create({
  wrap: { marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4 },
  title: { fontSize: 14, fontWeight: '900' },
  code: { fontSize: 10, fontWeight: '700', marginLeft: 'auto' },
  hint: { fontSize: 11, marginBottom: 10, lineHeight: 15 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, borderWidth: 1, alignItems: 'center', minWidth: 54 },
});

export default CurrencyPicker;