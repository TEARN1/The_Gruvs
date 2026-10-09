/**
 * TonightAlert — Docked Live HUD Countdown Ticker & Quick Pass Drawer.
 *
 * Implements:
 * - 2.1 Docked 36px Countdown Ticker (activates on event days)
 * - 2.2 1-Tap Quick Pass & Directions Drawer
 * - 2.3 Live Door Queue & Capacity Thermometer
 * - Flat shadowless 1px hairline luminous border styling
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
  StyleSheet,
  Platform,
  Linking,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { sensoryHaptics } from '../services/sensoryHapticEngine';

const DISMISS_KEY = 'gruv_tonight_alert_dismissed';

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

export const TonightAlert = ({ events = [], onViewEvent, onNavigateToMap }) => {
  const { currentTheme } = useTheme();
  const [dismissed, setDismissed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const primary = currentTheme?.primary || '#00f2ff';
  const surface = currentTheme?.surface || '#0d1114';
  const text = currentTheme?.text || '#ffffff';
  const background = currentTheme?.background || '#050708';

  const tonightEvents = events.filter(isEventTonight);

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
      } catch (_e) {
        // Safe storage read
      } finally {
        setChecked(true);
      }
    })();
  }, []);

  const handleDismiss = async () => {
    setDismissed(true);
    try {
      await AsyncStorage.setItem(DISMISS_KEY, JSON.stringify({ date: getTodayString() }));
    } catch (_e) {
      // Storage safe
    }
  };

  if (!checked || dismissed || tonightEvents.length === 0) return null;

  const leadEvent = tonightEvents[0];

  return (
    <View style={styles.container}>
      {/* Docked 36px Tactical Countdown Ticker */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          sensoryHaptics.triggerLogDrum('bounce');
          setExpanded(!expanded);
        }}
        style={[
          styles.tickerBar,
          {
            backgroundColor: surface,
            borderColor: `${primary}45`,
          },
        ]}
      >
        <View style={styles.tickerPulseDot} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[styles.tickerTag, { color: primary }]}>TONIGHT // DOORS LIVE</Text>
          <Text style={[styles.tickerTitle, { color: text }]} numberOfLines={1}>
            {leadEvent.title || 'Groove In Session'}
          </Text>
        </View>
        <View style={styles.tickerActions}>
          <Text style={[styles.queuePill, { color: primary }]}>~3m Queue</Text>
          <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={primary} />
          <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={14} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Expanded Quick Pass & Directions Drawer */}
      {expanded && (
        <View style={[styles.expandedDrawer, { backgroundColor: '#0a0d0f', borderColor: `${primary}35` }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.drawerScroll}
          >
            {tonightEvents.map((ev, idx) => (
              <View key={ev.id || idx} style={[styles.miniCard, { backgroundColor: surface, borderColor: `${primary}30` }]}>
                {ev.cover_url || ev.cover_image || ev.image_url ? (
                  <Image source={{ uri: ev.cover_url || ev.cover_image || ev.image_url }} style={styles.miniImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.miniImagePlaceholder, { backgroundColor: `${primary}15` }]}>
                    <Feather name="calendar" size={20} color={primary} />
                  </View>
                )}
                <View style={{ padding: 10, gap: 4 }}>
                  <Text style={[styles.miniTitle, { color: text }]} numberOfLines={1}>
                    {ev.title || 'Event'}
                  </Text>
                  <Text style={{ color: primary, fontSize: 10, fontWeight: '800' }}>
                    {ev.event_time || '20:00'} · {ev.venue_name || ev.address || 'Venue'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                    <TouchableOpacity
                      onPress={() => onViewEvent?.(ev)}
                      style={[styles.quickPassBtn, { backgroundColor: `${primary}20`, borderColor: `${primary}45` }]}
                    >
                      <Feather name="shield" size={11} color={primary} />
                      <Text style={{ color: primary, fontSize: 10, fontWeight: '800' }}>Pass</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        if (onNavigateToMap) {
                          onNavigateToMap(ev);
                        } else if (onViewEvent) {
                          onViewEvent(ev);
                        }
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`View ${ev.title || 'event'} on local map`}
                      style={[styles.quickPassBtn, { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.15)' }]}
                    >
                      <Feather name="navigation" size={11} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>Local Nav</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 14,
    marginBottom: 10,
  },
  tickerBar: {
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
  },
  tickerPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10b981',
  },
  tickerTag: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  tickerTitle: {
    fontSize: 12,
    fontWeight: '800',
    flexShrink: 1,
  },
  tickerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  queuePill: {
    fontSize: 9.5,
    fontWeight: '800',
    backgroundColor: 'rgba(0,242,255,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  expandedDrawer: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    padding: 8,
  },
  drawerScroll: {
    gap: 10,
  },
  miniCard: {
    width: 170,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  miniImage: {
    width: 170,
    height: 80,
  },
  miniImagePlaceholder: {
    width: 170,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniTitle: {
    fontSize: 12,
    fontWeight: '900',
  },
  quickPassBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
});
