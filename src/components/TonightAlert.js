import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { GlassView } from './GlassView';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DISMISS_KEY = 'gruv_tonight_alert_dismissed';

const isTonightWindow = () => {
  const now = new Date();
  const hours = now.getHours();
  return hours >= 15 && hours <= 23;
};

const getTodayString = () => new Date().toISOString().split('T')[0];

const isEventTonight = (event) => {
  if (!event) return false;
  const today = getTodayString();
  const eventDate =
    event.event_date ||
    event.date ||
    (event.starts_at ? event.starts_at.split('T')[0] : null);
  return eventDate === today;
};

export const TonightAlert = ({ events = [], onViewEvent }) => {
  const { currentTheme } = useTheme();
  const [dismissed, setDismissed] = useState(false);
  const [checked, setChecked] = useState(false);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const primary = currentTheme?.primary || "#00f2ff";
  const surface = currentTheme?.surface || "#131a1c";
  const text = currentTheme?.text || "#ffffff";
  const background = currentTheme?.background || "#0d1112";

  // Check if already dismissed today
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DISMISS_KEY);
        if (raw) {
          const { date } = JSON.parse(raw);
          if (date === getTodayString()) {
            setDismissed(true);
          }
        }
      } catch {
        // ignore
      } finally {
        setChecked(true);
      }
    })();
  }, []);

  // Pulsing glow animation
  useEffect(() => {
    if (dismissed || !checked) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [dismissed, checked, pulseAnim]);

  // Fade in on mount
  useEffect(() => {
    if (!dismissed && checked) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [dismissed, checked, fadeAnim]);

  const handleDismiss = useCallback(async () => {
    try {
      await AsyncStorage.setItem(
        DISMISS_KEY,
        JSON.stringify({ date: getTodayString() })
      );
    } catch {
      // ignore
    }
    setDismissed(true);
  }, []);

  if (!checked || dismissed) return null;
  if (!isTonightWindow()) return null;

  const tonightEvents = events.filter(isEventTonight);
  if (tonightEvents.length === 0) return null;

  const glowColor = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [primary + '40', primary + 'cc'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Animated.View
        style={[
          styles.glowBorder,
          {
            borderColor: glowColor,
            shadowColor: primary,
          },
        ]}
      >
        <GlassView style={[styles.card, { backgroundColor: surface }]} glow>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={[styles.label, { color: primary }]}>
                🌙 HAPPENING TONIGHT
              </Text>
              <Text style={[styles.countText, { color: text + 'aa' }]}>
                {tonightEvents.length}{' '}
                {tonightEvents.length === 1 ? 'event' : 'events'} near you
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleDismiss}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Feather name="x" size={20} color={text + '80'} />
            </TouchableOpacity>
          </View>

          {/* Horizontal event mini-cards */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.eventScroll}
          >
            {tonightEvents.map((event, idx) => (
              <TouchableOpacity
                key={event.id || idx}
                onPress={() => onViewEvent && onViewEvent(event)}
                activeOpacity={0.8}
                style={[styles.miniCard, { backgroundColor: background }]}
              >
                {/* TODO(v6): remove cover_image/image_url fallbacks after migration */}
                {event.cover_url || event.cover_image || event.image_url ? (
                  <Image
                    source={{ uri: event.cover_url || event.cover_image || event.image_url }}
                    style={styles.miniImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.miniImagePlaceholder,
                      { backgroundColor: primary + '20' },
                    ]}
                  >
                    <Feather name="calendar" size={22} color={primary} />
                  </View>
                )}
                <View style={styles.miniInfo}>
                  <Text
                    style={[styles.miniTitle, { color: text }]}
                    numberOfLines={2}
                  >
                    {event.title || event.name || 'Event'}
                  </Text>
                  {(event.venue || event.location) && (
                    <Text
                      style={[styles.miniVenue, { color: text + '80' }]}
                      numberOfLines={1}
                    >
                      <Feather name="map-pin" size={10} color={primary} />{' '}
                      {event.venue || event.location}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </GlassView>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  glowBorder: {
    borderRadius: 20,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
  card: {
    borderRadius: 18,
    padding: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerLeft: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  countText: {
    fontSize: 12,
    fontWeight: '500',
  },
  eventScroll: {
    gap: 12,
    paddingRight: 4,
  },
  miniCard: {
    width: 130,
    borderRadius: 12,
    overflow: 'hidden',
  },
  miniImage: {
    width: 130,
    height: 80,
  },
  miniImagePlaceholder: {
    width: 130,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniInfo: {
    padding: 8,
  },
  miniTitle: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    marginBottom: 3,
  },
  miniVenue: {
    fontSize: 10,
    fontWeight: '500',
  },
});
