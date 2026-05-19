import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

const OPTIONS = [
  { value: 'any',     label: 'Any time' },
  { value: 'today',   label: 'Today' },
  { value: 'weekend', label: 'Weekend' },
  { value: 'week',    label: 'This week' },
  { value: 'month',   label: 'This month' },
  { value: 'year',    label: 'This Year' },
];

export const dateFilterToRange = (value) => {
  const now = new Date();

  const toISO = (d) => d.toISOString().split('T')[0];

  if (value === 'any' || !value) return null;

  if (value === 'today') {
    const today = toISO(now);
    return { from: today, to: today };
  }

  if (value === 'weekend') {
    const day = now.getDay(); // 0=Sun,6=Sat
    const daysUntilSat = day === 6 ? 0 : (6 - day);
    const sat = new Date(now);
    sat.setDate(now.getDate() + daysUntilSat);
    const sun = new Date(sat);
    sun.setDate(sat.getDate() + 1);
    return { from: toISO(sat), to: toISO(sun) };
  }

  if (value === 'week') {
    const end = new Date(now);
    end.setDate(now.getDate() + 7);
    return { from: toISO(now), to: toISO(end) };
  }

  if (value === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: toISO(start), to: toISO(end) };
  }

  if (value === 'year') {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    return { from: toISO(start), to: toISO(end) };
  }

  return null;
};

export const DateFilterStrip = ({ value = 'any', onChange }) => {
  const { currentTheme } = useTheme();

  const primary = currentTheme?.primary || '#00f2ff';
  const surface = currentTheme?.surface || '#131a1c';
  const text = currentTheme?.text || '#ffffff';
  const background = currentTheme?.background || '#0d1112';

  const handleSelect = (optionValue) => {
    const range = dateFilterToRange(optionValue);
    onChange(optionValue, range);
  };

  return (
    <View style={[styles.wrapper, { backgroundColor: background }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {OPTIONS.map((option) => {
          const isActive = value === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => handleSelect(option.value)}
              activeOpacity={0.75}
              style={[
                styles.pill,
                {
                  backgroundColor: isActive ? primary : surface,
                  borderColor: isActive ? primary : primary + '30',
                },
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: isActive ? background : text + 'cc' },
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingVertical: 10,
  },
  scrollContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
