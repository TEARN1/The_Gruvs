/**
 * TabBar.js — Mobile bottom floating glass dock navigation with drag-to-scrub.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  useWindowDimensions,
  PanResponder,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TABS } from './navigationConfig';

export const TabBar = ({
  currentTab,
  onTabChange,
  primary,
  muted,
  bg,
  textColor = '#fff',
  unreadCount = 0,
  unreadDMCount = 0,
}) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const indicatorAnim = useRef(new Animated.Value(0)).current;

  // Measure the BAR, not the window. The bar is 94% wide, capped at 520px and centred.
  const [bar, setBar] = useState(() => {
    const w = Math.min(width * 0.94, 520);
    return { x: (width - w) / 2, w };
  });
  const BAR_PAD = 6;
  const tabWidth = Math.max(1, (bar.w - BAR_PAD * 2) / TABS.length);
  // Too narrow for every label (small phones): show the active tab's only.
  const compactLabels = tabWidth < 42;

  useEffect(() => {
    const index = TABS.findIndex((t) => t.key === currentTab);
    if (index < 0) return;
    const maxX = Math.max(BAR_PAD, bar.w - BAR_PAD - (tabWidth - 4));
    const target = Math.min(maxX, Math.max(BAR_PAD, BAR_PAD + index * tabWidth + 2));
    if (!isNaN(target)) {
      Animated.spring(indicatorAnim, {
        toValue: target,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    }
  }, [currentTab, tabWidth, bar.w, indicatorAnim]);

  // Drag-to-scrub across tabs
  const currentTabRef = useRef(currentTab);
  currentTabRef.current = currentTab;
  const scrubToX = useCallback(
    (pageX) => {
      let idx = Math.floor((pageX - bar.x - BAR_PAD) / tabWidth);
      idx = Math.max(0, Math.min(TABS.length - 1, idx));
      const key = TABS[idx].key;
      if (key !== currentTabRef.current) {
        try {
          Haptics.selectionAsync();
        } catch {}
        onTabChange(key);
      }
    },
    [tabWidth, bar.x, onTabChange]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
        onPanResponderGrant: (e) => scrubToX(e.nativeEvent.pageX),
        onPanResponderMove: (e) => scrubToX(e.nativeEvent.pageX),
      }),
    [scrubToX]
  );

  return (
    <View
      style={[styles.tabBarContainer, { paddingBottom: Math.max(insets.bottom, 14) }]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.tabBar,
          {
            // Solid, not see-through: feed cards showing through the bar made
            // the tabs hard to read.
            borderColor: `${primary}55`,
            backgroundColor: bg || '#0d1112',
          },
        ]}
        {...panResponder.panHandlers}
        onLayout={(e) => {
          const { x, width: w } = e.nativeEvent.layout;
          if (Math.abs(w - bar.w) > 0.5 || Math.abs(x - bar.x) > 0.5) setBar({ x, w });
        }}
      >
        <Animated.View
          style={[
            styles.indicator,
            {
              backgroundColor: `${primary}20`,
              borderColor: `${primary}50`,
              shadowColor: primary,
              shadowRadius: 12,
              shadowOpacity: 0.35,
              width: Math.max(0, tabWidth - 4),
              transform: [{ translateX: indicatorAnim }],
            },
          ]}
        />
        {TABS.map((tab) => {
          const isActive = currentTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => onTabChange(tab.key)}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
            >
              <View style={styles.tabIconWrap}>
                {/* Inactive tabs used the muted colour AND 65% opacity on top,
                    about a third of full strength: too faint on a phone outdoors. */}
                <Feather
                  name={tab.icon}
                  size={isActive ? 21 : 19}
                  color={isActive ? primary : textColor}
                  style={{ opacity: isActive ? 1 : 0.82 }}
                />
                {tab.key === 'notifications' && unreadCount > 0 && (
                  <View
                    style={[styles.unreadBadge, { backgroundColor: '#ef4444' }]}
                    accessibilityLabel={`${unreadCount} unread notifications`}
                  >
                    <Text style={styles.unreadBadgeText} maxFontSizeMultiplier={1.2}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
                {tab.key === 'chats' && (unreadDMCount > 0 || unreadCount > 0) && (
                  <View
                    style={[
                      styles.unreadBadge,
                      { backgroundColor: unreadDMCount > 0 ? primary : '#ef4444' },
                    ]}
                    accessibilityLabel={
                      unreadDMCount > 0
                        ? `${unreadDMCount} unread messages`
                        : `${unreadCount} unread notifications`
                    }
                  >
                    <Text
                      style={[
                        styles.unreadBadgeText,
                        { color: unreadDMCount > 0 ? '#000' : '#fff' },
                      ]}
                      maxFontSizeMultiplier={1.2}
                    >
                      {unreadDMCount > 0
                        ? unreadDMCount > 99
                          ? '99+'
                          : unreadDMCount
                        : unreadCount > 99
                        ? '99+'
                        : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
              {(!compactLabels || isActive) && (
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: isActive ? primary : textColor,
                      fontWeight: isActive ? '900' : '700',
                      opacity: isActive ? 1 : 0.82,
                    },
                  ]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.2}
                >
                  {tab.label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export default TabBar;

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '94%',
    maxWidth: 520,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    position: 'relative',
    paddingHorizontal: 6,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }
      : {}),
  },
  indicator: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    borderRadius: 24,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    zIndex: 2,
  },
  tabIconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 9.5,
    letterSpacing: 0.3,
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
});
