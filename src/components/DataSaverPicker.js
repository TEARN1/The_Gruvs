/**
 * DataSaverPicker — the Auto / On / Off choice for video data saving, shared by
 * Settings and the Reels controls so both always show the same state.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DataSaver, useDataSaver } from '../utils/dataSaver';

const OPTIONS = [
  { key: 'auto', label: 'Auto', sub: 'Save data on mobile data' },
  { key: 'on', label: 'On', sub: 'Videos wait for a tap' },
  { key: 'off', label: 'Off', sub: 'Always play and preload' },
];

export const DataSaverPicker = ({ primary, textColor, muted }) => {
  const { mode, active } = useDataSaver();
  return (
    <View>
      <View style={ds.row} accessibilityRole="radiogroup" accessibilityLabel="Data saver">
        {OPTIONS.map((o) => {
          const on = mode === o.key;
          return (
            <TouchableOpacity
              key={o.key}
              onPress={() => DataSaver.setMode(o.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Data saver ${o.label}: ${o.sub}`}
              style={[ds.chip, { borderColor: on ? primary : `${primary}30`, backgroundColor: on ? `${primary}22` : 'transparent' }]}
            >
              <Text style={[ds.label, { color: on ? primary : textColor }]}>{o.label}</Text>
              <Text style={[ds.sub, { color: muted }]} numberOfLines={2}>{o.sub}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[ds.note, { color: muted }]}>
        {active
          ? 'Saving data now: videos show a cover and play when you tap, and nothing downloads ahead.'
          : 'Videos play by themselves. On an iPhone or a computer the app can’t tell mobile data from Wi-Fi, so pick On to be sure.'}
      </Text>
    </View>
  );
};

const ds = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 10 },
  label: { fontSize: 14, fontWeight: '800' },
  sub: { fontSize: 11, marginTop: 2, lineHeight: 15 },
  note: { fontSize: 11.5, lineHeight: 16, marginTop: 10 },
});

export default DataSaverPicker;
