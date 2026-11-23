/**
 * AdFlywheel — Contextual event/service ad unit.
 * Surfaces based on: current path intent, time of day, nearby events, identity mode.
 * Celebrity mode: ads suppressed (read-only gallery users don't see promotions).
 * Ghost mode: ads shown but not personalized (no userId passed to impression tracker).
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Platform,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { SmartImage } from './SmartImage';
import { useTheme } from '../context/ThemeContext';
import { useIdentity } from '../context/IdentityContext';
import { supabase } from '../services/supabase';
import { adSlotActive } from '../constants/adConfig';
import { getPartnerCampaign } from '../constants/partnerSpotlight';
import { SecurityService } from '../services/securityService';
import { PartnerService } from '../services/partnerService';

const intentToAdType = (intent) => {
  if (!intent) return null;
  if (intent === 'going_home')   return 'service';
  if (intent === 'service_run')  return 'service';
  if (intent === 'attending')    return 'event';
  if (intent === 'exploring')    return 'event';
  return null;
};

export const AdFlywheel = ({ intentTag, eventId, onNavigateToEvent, onNavigateToServices, slot = 'feed' }) => {
  const { currentTheme } = useTheme();
  const { identityMode } = useIdentity();
  const primary    = currentTheme?.primary   || "#00f2ff";
  const textColor  = currentTheme?.text       || "#ffffff";
  const muted      = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  const [ad, setAd]           = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const fadeAnim              = useRef(new Animated.Value(0)).current;

  const selectAd = useCallback(async () => {
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

    // Fallback: surface our premier partner campaigns (The Resident Crew & TEARN's Excellence)
    const partner = getPartnerCampaign(intentTag === 'going_home' ? 'accommodation' : null);
    if (partner) {
      setAd(partner);
      PartnerService.logImpression(partner.partner_key, slot);
      fadeIn();
    }
  }, [intentTag, slot]);

  useEffect(() => {
    if (identityMode === 'celebrity' || !adSlotActive(slot)) return;
    selectAd();
  }, [intentTag, eventId, identityMode, selectAd, slot]);

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
    if (ad.partner_key && ad.cta_url) {
      PartnerService.logClickAndOpen(ad.partner_key, ad.cta_url, slot);
    } else if (ad.cta_url) {
      SecurityService.safeOpenURL(ad.cta_url);
    } else if (ad.type === 'event' && onNavigateToEvent && ad.event_id) {
      onNavigateToEvent({ id: ad.event_id });
    } else if ((ad.type === 'service' || ad.type === 'gig') && onNavigateToServices) {
      onNavigateToServices();
    }
  };

  if (dismissed || !ad || identityMode === 'celebrity' || !adSlotActive(slot)) return null;

  const adColor = ad.color || primary;
  const imageUri = ad.image_url || ad.image || ad.cover_url;

  return (
    <Animated.View style={[styles.wrap, { opacity: fadeAnim, borderColor: `${adColor}45`, backgroundColor: '#0b1013' }]}>
      {/* 3D Visual Hero Area if image is available */}
      {imageUri ? (
        <View style={styles.imageContainer}>
          <SmartImage source={imageUri} style={styles.heroImage} resizeMode="cover" />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(11,16,19,0.55)' }]} />
          {/* Top Badge & Close */}
          <View style={styles.imageTopRow}>
            <View style={[styles.badge, { backgroundColor: `${adColor}25`, borderColor: `${adColor}60` }]}>
              <Feather name={ad.icon || 'zap'} size={11} color={adColor} style={{ marginRight: 4 }} />
              <Text style={[styles.badgeText, { color: adColor }]}>{ad.badge || 'PROMOTED'}</Text>
            </View>
            <TouchableOpacity onPress={handleDismiss} style={styles.dismissCircleBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Feather name="x" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.noImageTopRow}>
          <View style={[styles.badge, { backgroundColor: `${adColor}22`, borderColor: `${adColor}50` }]}>
            <Feather name={ad.icon || 'zap'} size={11} color={adColor} style={{ marginRight: 4 }} />
            <Text style={[styles.badgeText, { color: adColor }]}>{ad.badge || 'PROMOTED'}</Text>
          </View>
          <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Feather name="x" size={14} color={muted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Main Content Body */}
      <View style={styles.body}>
        {ad.tagline && (
          <Text style={[styles.tagline, { color: adColor }]}>{ad.tagline.toUpperCase()}</Text>
        )}
        <Text style={[styles.headline, { color: textColor }]}>{ad.headline}</Text>
        <Text style={[styles.subline, { color: muted }]}>{ad.subline}</Text>

        <TouchableOpacity
          onPress={handleCta}
          style={[styles.ctaBtn, { backgroundColor: adColor, shadowColor: adColor }]}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>{ad.cta || 'Explore Now'}</Text>
          <Feather name="arrow-up-right" size={14} color="#000" />
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <Text style={[styles.sponsoredLabel, { color: muted }]}>Official Partner · The Gruvs Flywheel</Text>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 22,
    borderWidth: 1.5,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
      transform: 'translateZ(0)',
    } : {}),
  },
  imageContainer: {
    width: '100%',
    height: 160,
    position: 'relative',
    overflow: 'hidden',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  imageTopRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  noImageTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  dismissCircleBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 1,
  },
  body: {
    padding: 16,
    gap: 8,
  },
  tagline: {
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  headline: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.2,
    lineHeight: 23,
  },
  subline: {
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '500',
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  ctaText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  sponsoredLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.4,
    opacity: 0.6,
  },
});
