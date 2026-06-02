import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const TIERS = [
  { label: 'Royal',    min: 10000, color: "#f5c518", icon: '👑' },
  { label: 'Platinum', min: 2000,  color: "#a5f3fc", icon: '💎' },
  { label: 'Gold',     min: 500,   color: "#fbbf24", icon: '🥇' },
  { label: 'Silver',   min: 100,   color: "#94a3b8", icon: '🥈' },
  { label: 'Bronze',   min: 0,     color: "#cd7f32", icon: '🥉' },
];

export const getTierInfo = (score = 0) => {
  return TIERS.find(t => score >= t.min) || TIERS[TIERS.length - 1];
};

export const RoyalTierBadge = ({ score = 0, size = 'small' }) => {
  const { currentTheme } = useTheme();
  const tier = getTierInfo(score);
  const isLarge = size === 'large';

  if (isLarge) {
    return (
      <View style={[
        rtb.largeBadge,
        {
          backgroundColor: `${tier.color}18`,
          borderColor: tier.color,
        },
      ]}>
        <Text style={rtb.largeIcon}>{tier.icon}</Text>
        <View>
          <Text style={[rtb.largeTierLabel, { color: tier.color }]}>
            {tier.label.toUpperCase()} TIER
          </Text>
          <Text style={[rtb.largeScore, { color: tier.color }]}>
            {score.toLocaleString()} vibe pts
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[
      rtb.smallBadge,
      {
        backgroundColor: `${tier.color}20`,
        borderColor: tier.color,
      },
    ]}>
      <Text style={rtb.smallIcon}>{tier.icon}</Text>
      <Text style={[rtb.smallLabel, { color: tier.color }]}>{tier.label}</Text>
    </View>
  );
};

const rtb = StyleSheet.create({
  smallBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  smallIcon: { fontSize: 12 },
  smallLabel: { fontSize: 11, fontWeight: '800' },

  largeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  largeIcon: { fontSize: 36 },
  largeTierLabel: { fontSize: 15, fontWeight: '900', letterSpacing: 1.5 },
  largeScore: { fontSize: 12, fontWeight: '700', marginTop: 3 },
});
