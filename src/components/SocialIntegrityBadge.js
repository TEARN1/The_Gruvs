/**
 * SocialIntegrityBadge — Displays a user's trust/integrity tier.
 * Tiers: Bronze → Silver → Gold → Platinum
 * Sizes: 'small' (icon + pill) | 'large' (full card with bar + perks)
 */
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, Platform,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';

// ---------------------------------------------------------------------------
// Tier config
// ---------------------------------------------------------------------------
const TIERS = [
  {
    name: 'Bronze',
    min: 0,
    max: 39,
    color: "#cd7f32",
    perks: ['Basic marketplace access'],
    glow: false,
  },
  {
    name: 'Silver',
    min: 40,
    max: 65,
    color: "#C0C0C0",
    perks: ['Priority listing', '+10% visibility boost'],
    glow: false,
  },
  {
    name: 'Gold',
    min: 66,
    max: 85,
    color: "#FFD700",
    perks: ['Elite Service Node', 'Premium event access'],
    glow: false,
  },
  {
    name: 'Platinum',
    min: 86,
    max: 100,
    color: "#00f2ff",
    perks: ['Top 1% — Trusted Partner badge', 'Featured listing'],
    glow: true,
  },
];

const getTier = (score) =>
  TIERS.find(t => score >= t.min && score <= t.max) || TIERS[0];

// ---------------------------------------------------------------------------
// Platinum animated glow hook
// ---------------------------------------------------------------------------
const usePlatinumGlow = (active) => {
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const loopRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    loopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 900,
          useNativeDriver: false,
        }),
      ])
    );
    loopRef.current.start();
    return () => loopRef.current?.stop();
  }, [active]);

  return glowAnim;
};

// ---------------------------------------------------------------------------
// Small variant
// ---------------------------------------------------------------------------
const SmallBadge = ({ tier, score }) => (
  <View style={sm.row}>
    <Feather name="shield" size={18} color={tier.color} />
    <View style={[sm.pill, { backgroundColor: `${tier.color}20`, borderColor: `${tier.color}50` }]}>
      <Text style={[sm.score, { color: tier.color }]}>{score}</Text>
    </View>
  </View>
);

const sm = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pill: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 34,
    alignItems: 'center',
  },
  score: { fontSize: 12, fontWeight: '900' },
});

// ---------------------------------------------------------------------------
// Score bar
// ---------------------------------------------------------------------------
const ScoreBar = ({ score, color }) => {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: score,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [score]);

  const widthInterpolated = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={bar.track}>
      <Animated.View
        style={[bar.fill, { width: widthInterpolated, backgroundColor: color }]}
      />
    </View>
  );
};

const bar = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    width: '100%',
  },
  fill: { height: '100%', borderRadius: 4 },
});

// ---------------------------------------------------------------------------
// Large variant
// ---------------------------------------------------------------------------
const LargeBadge = ({ tier, score, primary }) => {
  const glowAnim = usePlatinumGlow(tier.glow);

  return (
    <Animated.View
      style={[
        lg.card,
        {
          borderColor: tier.glow
            ? tier.color
            : `${tier.color}30`,
          ...(tier.glow && Platform.OS !== 'web'
            ? {
                shadowColor: tier.color,
                shadowOpacity: glowAnim,
                shadowRadius: 18,
                elevation: 14,
              }
            : {}),
          ...(tier.glow && Platform.OS === 'web'
            ? { boxShadow: `0 0 24px ${tier.color}88` }
            : {}),
        },
      ]}
    >
      {/* Tier header */}
      <View style={lg.header}>
        <View style={lg.iconWrap}>
          <Feather name="shield" size={24} color={tier.color} />
          {tier.glow && (
            <Animated.View
              style={[
                lg.glowRing,
                { borderColor: tier.color, opacity: glowAnim },
              ]}
            />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[lg.tierName, { color: tier.color }]}>{tier.name}</Text>
          <Text style={[lg.tierSub, { color: 'rgba(255,255,255,0.45)' }]}>
            Social Integrity Score
          </Text>
        </View>
        <View style={[lg.scoreBubble, { backgroundColor: `${tier.color}20`, borderColor: `${tier.color}50` }]}>
          <Text style={[lg.scoreNum, { color: tier.color }]}>{score}</Text>
          <Text style={[lg.scoreOf, { color: `${tier.color}90` }]}>/100</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={{ marginVertical: 10 }}>
        <ScoreBar score={score} color={tier.color} />
        <View style={lg.barLabels}>
          <Text style={lg.barLabelText}>0</Text>
          <Text style={lg.barLabelText}>50</Text>
          <Text style={lg.barLabelText}>100</Text>
        </View>
      </View>

      {/* Perks */}
      <View style={lg.perksWrap}>
        <Text style={lg.perksTitle}>PERKS</Text>
        {tier.perks.map((perk, i) => (
          <View key={i} style={lg.perkRow}>
            <Feather name="check" size={13} color={tier.color} />
            <Text style={[lg.perkText, { color: 'rgba(255,255,255,0.8)' }]}>{perk}</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
};

const lg = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { position: 'relative', width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  glowRing: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    top: -2,
    left: -2,
  },
  tierName: { fontSize: 18, fontWeight: '900' },
  tierSub: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  scoreBubble: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 2,
  },
  scoreNum: { fontSize: 22, fontWeight: '900', lineHeight: 26 },
  scoreOf: { fontSize: 11, fontWeight: '700', paddingBottom: 2 },
  barLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  barLabelText: { fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: '700' },
  perksWrap: { marginTop: 6, gap: 6 },
  perksTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  perkText: { fontSize: 13, fontWeight: '600' },
});

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------
export const SocialIntegrityBadge = ({
  score = 0,
  size = 'small',
  showLabel = true,
  primary = "#00f2ff",
}) => {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  const tier = getTier(safeScore);

  if (size === 'large') {
    return <LargeBadge tier={tier} score={safeScore} primary={primary} />;
  }

  // Small
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <SmallBadge tier={tier} score={safeScore} />
      {showLabel && (
        <Text style={{ color: tier.color, fontSize: 12, fontWeight: '800' }}>
          {tier.name}
        </Text>
      )}
    </View>
  );
};
