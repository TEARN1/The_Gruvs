/**
 * AdFlywheel — Contextual event/service ad unit.
 * Surfaces based on: current path intent, time of day, nearby events, identity mode.
 * Celebrity mode: ads suppressed (read-only gallery users don't see promotions).
 * Ghost mode: ads shown but not personalized (no userId passed to impression tracker).
 */
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useIdentity } from '../context/IdentityContext';
import { supabase } from '../services/supabase';

const SAMPLE_ADS = [];



const intentToAdType = (intent) => {
  if (!intent) return null;
  if (intent === 'going_home')   return 'service';
  if (intent === 'service_run')  return 'service';
  if (intent === 'attending')    return 'event';
  if (intent === 'exploring')    return 'event';
  return null;
};

export const AdFlywheel = ({ intentTag, eventId, onNavigateToEvent, onNavigateToServices }) => {
  const { currentTheme } = useTheme();
  const { identityMode } = useIdentity();
  const primary    = currentTheme?.primary   || '#00f2ff';
  const bg         = currentTheme?.background || '#0d1112';
  const textColor  = currentTheme?.text       || '#ffffff';
  const muted      = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  const [ad, setAd]           = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const fadeAnim              = useRef(new Animated.Value(0)).current;

  // Celebrity mode: no ads
  if (identityMode === 'celebrity') return null;

  useEffect(() => {
    selectAd();
  }, [intentTag, eventId]);

  const selectAd = async () => {
    // Removed demo mode fallback. Real ads required.

    // Try to fetch a contextual ad from Supabase
    try {
      const preferredType = intentToAdType(intentTag);
      const { data } = await supabase
        .from('contextual_ads')
        .select('*')
        .eq('active', true)
        .order('priority', { ascending: false })
        .limit(5);

      if (data && data.length > 0) {
        const filtered = preferredType
          ? data.filter(a => a.type === preferredType) || data
          : data;
        setAd(filtered[Math.floor(Math.random() * filtered.length)]);
        fadeIn();
        return;
      }
    } catch (_) {}

    // No real ads available — hide the unit
  };

  const fadeIn = () => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  };

  const handleDismiss = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setDismissed(true));
  };

  const handleCta = () => {
    if (!ad) return;
    if (ad.type === 'event' && onNavigateToEvent && ad.event_id) {
      onNavigateToEvent({ id: ad.event_id });
    } else if ((ad.type === 'service' || ad.type === 'gig') && onNavigateToServices) {
      onNavigateToServices();
    }
  };

  if (dismissed || !ad) return null;

  const adColor = ad.color || primary;

  return (
    <Animated.View style={[styles.wrap, { opacity: fadeAnim, borderColor: `${adColor}30`, backgroundColor: `${adColor}08` }]}>
      <View style={[styles.badge, { backgroundColor: `${adColor}22` }]}>
        <Text style={[styles.badgeText, { color: adColor }]}>{ad.badge || 'PROMOTED'}</Text>
      </View>

      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: `${adColor}20` }]}>
          <Feather name={ad.icon || 'zap'} size={20} color={adColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headline, { color: textColor }]}>{ad.headline}</Text>
          <Text style={[styles.subline, { color: muted }]}>{ad.subline}</Text>
        </View>
        <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Feather name="x" size={14} color={muted} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={handleCta}
        style={[styles.ctaBtn, { backgroundColor: adColor }]}
        activeOpacity={0.8}
      >
        <Text style={styles.ctaText}>{ad.cta || 'View'}</Text>
        <Feather name="arrow-right" size={12} color="#000" />
      </TouchableOpacity>

      <Text style={[styles.sponsoredLabel, { color: muted }]}>Sponsored · The Gruvs AdFlywheel</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 10,
  },
  badgeText: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headline: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  subline:  { fontSize: 11, opacity: 0.8 },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  ctaText: { color: '#000', fontSize: 12, fontWeight: '900' },
  sponsoredLabel: { fontSize: 8, textAlign: 'right', opacity: 0.5 },
});
