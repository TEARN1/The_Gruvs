import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const useShimmer = () => {
  const anim = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 0.6,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0.2,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return anim;
};

const Block = ({ primary, style }) => {
  const opacity = useShimmer();
  return (
    <Animated.View
      style={[
        styles.block,
        { backgroundColor: primary + '26', opacity },
        style,
      ]}
    />
  );
};

// ─── SkeletonCard ─────────────────────────────────────────────────────────────
export const SkeletonCard = ({ primary: primaryProp }) => {
  const { currentTheme } = useTheme();
  const primary = primaryProp || currentTheme?.primary || "#00f2ff";
  const surface = currentTheme?.surface || "#131a1c";

  return (
    // Items 78-79: contain layout, accessible loading state
    <View
      style={[
        styles.card,
        { backgroundColor: surface },
        Platform.OS === 'web' ? { contain: 'layout style' } : {},
      ]}
      accessibilityLabel="Loading event"
      accessibilityRole="progressbar"
      {...(Platform.OS === 'web' ? { 'aria-busy': 'true' } : {})}
    >
      {/* Cover image area */}
      <Block primary={primary} style={styles.cardImage} />
      <View style={styles.cardBody}>
        {/* Title */}
        <Block primary={primary} style={styles.cardTitleFull} />
        <Block primary={primary} style={styles.cardTitleShort} />
        {/* Meta row */}
        <View style={styles.cardMeta}>
          <Block primary={primary} style={styles.cardMetaChip} />
          <Block primary={primary} style={styles.cardMetaChip} />
        </View>
        {/* Venue */}
        <Block primary={primary} style={styles.cardVenue} />
        {/* Footer */}
        <View style={styles.cardFooter}>
          <Block primary={primary} style={styles.cardAvatar} />
          <Block primary={primary} style={styles.cardFooterText} />
          <Block primary={primary} style={styles.cardBtn} />
        </View>
      </View>
    </View>
  );
};

// ─── SkeletonProfile ──────────────────────────────────────────────────────────
export const SkeletonProfile = ({ primary: primaryProp }) => {
  const { currentTheme } = useTheme();
  const primary = primaryProp || currentTheme?.primary || "#00f2ff";
  const surface = currentTheme?.surface || "#131a1c";

  return (
    <View style={[styles.profileWrapper, { backgroundColor: surface }]}>
      {/* Avatar circle */}
      <Block primary={primary} style={styles.profileAvatar} />
      {/* Name bar */}
      <Block primary={primary} style={styles.profileName} />
      {/* Bio bars */}
      <Block primary={primary} style={styles.profileBio1} />
      <Block primary={primary} style={styles.profileBio2} />
      {/* Stats row */}
      <View style={styles.profileStats}>
        <Block primary={primary} style={styles.profileStat} />
        <Block primary={primary} style={styles.profileStat} />
        <Block primary={primary} style={styles.profileStat} />
      </View>
    </View>
  );
};

// ─── SkeletonCalendar ─────────────────────────────────────────────────────────
export const SkeletonCalendar = ({ primary: primaryProp }) => {
  const { currentTheme } = useTheme();
  const primary = primaryProp || currentTheme?.primary || "#00f2ff";
  const surface = currentTheme?.surface || "#131a1c";

  const dots = Array.from({ length: 35 }); // 7 cols × 5 rows
  const cols = 7;

  return (
    <View style={[styles.calWrapper, { backgroundColor: surface }]}>
      {/* Day header labels */}
      <View style={styles.calDayRow}>
        {Array.from({ length: 7 }).map((_, i) => (
          <Block
            key={`h${i}`}
            primary={primary}
            style={styles.calDayLabel}
          />
        ))}
      </View>

      {/* 7×5 dot grid */}
      <View style={styles.calGrid}>
        {dots.map((_, i) => (
          <Block key={`d${i}`} primary={primary} style={styles.calDot} />
        ))}
      </View>

      {/* 3 list item rows below grid */}
      {[1, 2, 3].map((n) => (
        <View key={`li${n}`} style={styles.calListItem}>
          <Block primary={primary} style={styles.calListDot} />
          <View style={styles.calListText}>
            <Block primary={primary} style={styles.calListTitle} />
            <Block primary={primary} style={styles.calListSub} />
          </View>
        </View>
      ))}
    </View>
  );
};

// ─── SkeletonExplore ──────────────────────────────────────────────────────────
export const SkeletonExplore = ({ primary: primaryProp }) => {
  const { currentTheme } = useTheme();
  const primary = primaryProp || currentTheme?.primary || "#00f2ff";
  const surface = currentTheme?.surface || "#131a1c";

  const smallCards = Array.from({ length: 4 });

  return (
    <View style={{ backgroundColor: surface }}>
      {/* Large hero rectangle */}
      <Block primary={primary} style={styles.exploreHero} />

      {/* Row 1 — 2 small cards */}
      <View style={styles.exploreRow}>
        {smallCards.slice(0, 2).map((_, i) => (
          <View key={`r1c${i}`} style={styles.exploreSmallCard}>
            <Block primary={primary} style={styles.exploreSmallImage} />
            <Block primary={primary} style={styles.exploreSmallTitle} />
            <Block primary={primary} style={styles.exploreSmallSub} />
          </View>
        ))}
      </View>

      {/* Row 2 — 2 small cards */}
      <View style={styles.exploreRow}>
        {smallCards.slice(2, 4).map((_, i) => (
          <View key={`r2c${i}`} style={styles.exploreSmallCard}>
            <Block primary={primary} style={styles.exploreSmallImage} />
            <Block primary={primary} style={styles.exploreSmallTitle} />
            <Block primary={primary} style={styles.exploreSmallSub} />
          </View>
        ))}
      </View>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  block: {
    borderRadius: 8,
  },

  // SkeletonCard
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  cardImage: {
    width: '100%',
    height: 200,
    borderRadius: 0,
  },
  cardBody: {
    padding: 14,
  },
  cardTitleFull: {
    height: 18,
    borderRadius: 9,
    marginBottom: 8,
    width: '80%',
  },
  cardTitleShort: {
    height: 14,
    borderRadius: 7,
    marginBottom: 12,
    width: '55%',
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  cardMetaChip: {
    height: 24,
    borderRadius: 12,
    width: 72,
  },
  cardVenue: {
    height: 13,
    borderRadius: 6,
    width: '65%',
    marginBottom: 14,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  cardFooterText: {
    height: 12,
    borderRadius: 6,
    flex: 1,
  },
  cardBtn: {
    height: 32,
    borderRadius: 16,
    width: 72,
  },

  // SkeletonProfile
  profileWrapper: {
    padding: 20,
    alignItems: 'center',
    borderRadius: 18,
  },
  profileAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: 14,
  },
  profileName: {
    height: 20,
    borderRadius: 10,
    width: 140,
    marginBottom: 12,
  },
  profileBio1: {
    height: 13,
    borderRadius: 6,
    width: 220,
    marginBottom: 8,
  },
  profileBio2: {
    height: 13,
    borderRadius: 6,
    width: 170,
    marginBottom: 18,
  },
  profileStats: {
    flexDirection: 'row',
    gap: 20,
  },
  profileStat: {
    height: 40,
    borderRadius: 10,
    width: 64,
  },

  // SkeletonCalendar
  calWrapper: {
    padding: 16,
    borderRadius: 18,
  },
  calDayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  calDayLabel: {
    height: 12,
    borderRadius: 6,
    width: (SCREEN_WIDTH - 64) / 7,
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 18,
  },
  calDot: {
    width: (SCREEN_WIDTH - 64 - 4 * 6) / 7,
    height: (SCREEN_WIDTH - 64 - 4 * 6) / 7,
    borderRadius: 20,
  },
  calListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  calListDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  calListText: {
    flex: 1,
    gap: 6,
  },
  calListTitle: {
    height: 14,
    borderRadius: 7,
    width: '70%',
  },
  calListSub: {
    height: 11,
    borderRadius: 5,
    width: '45%',
  },

  // SkeletonExplore
  exploreHero: {
    width: '100%',
    height: 220,
    borderRadius: 18,
    marginBottom: 16,
  },
  exploreRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  exploreSmallCard: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  exploreSmallImage: {
    width: '100%',
    height: 110,
    borderRadius: 14,
    marginBottom: 8,
  },
  exploreSmallTitle: {
    height: 14,
    borderRadius: 7,
    width: '80%',
    marginBottom: 6,
  },
  exploreSmallSub: {
    height: 11,
    borderRadius: 5,
    width: '55%',
  },
});
