/**
 * EcosystemUniverseBar — The 3-Pillar Unified Ecosystem Navigation Bar.
 *
 * Unites:
 *   1. 👑 The Gruvs (Nightlife, Events, Vibe Radar)
 *   2. 🏡 The Resident Crew (Verified Crash Pads, Stays & Safe Lifts)
 *   3. 🏛️ Excellency Academy (Audio Engineering, Craft & Masterclasses)
 *
 * Keeps users in one contiguous universe with 1-tap instant portal switching.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { ECOSYSTEM_APPS } from '../constants/ecosystemApps';
import { cyberAudio } from '../utils/cyberAudio';
import { EcosystemPortalModal } from './EcosystemPortalModal';
import { CommunityStatsBar } from './CommunityStatsBar';

export function EcosystemUniverseBar({
  activeAppId = 'thegruvs',
  onSelectApp,
  primary = '#00f2ff',
  textColor = '#fff',
  muted = 'rgba(255,255,255,0.6)',
  showMutuals = true,
}) {
  const [portalApp, setPortalApp] = useState(null);
  const { width } = useWindowDimensions();
  const isCompact = width < 370;

  const handlePress = (app) => {
    cyberAudio.play('telemetryTick');
    if (app.id === 'thegruvs') {
      onSelectApp?.(app.id);
    } else {
      // Open in-app ecosystem portal (never eject user out of app)
      setPortalApp(app);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.barCard, { borderColor: `${primary}25` }]}>
        {/* Outer Corner Reticles */}
        <View style={[styles.reticle, styles.tl, { borderColor: primary }]} />
        <View style={[styles.reticle, styles.tr, { borderColor: primary }]} />
        <View style={[styles.reticle, styles.bl, { borderColor: primary }]} />
        <View style={[styles.reticle, styles.br, { borderColor: primary }]} />

        {ECOSYSTEM_APPS.map((app) => {
          const isActive = activeAppId === app.id;
          return (
            <TouchableOpacity
              key={app.id}
              onPress={() => handlePress(app)}
              style={[
                styles.tabBtn,
                isActive && {
                  backgroundColor: `${app.color}18`,
                  borderColor: `${app.color}65`,
                  shadowColor: app.color,
                  shadowOpacity: 0.5,
                  shadowRadius: 8,
                },
              ]}
              activeOpacity={0.82}
            >
              <Feather name={app.icon} size={14} color={isActive ? app.color : textColor} />
              <View style={styles.textWrap}>
                <Text
                  style={[
                    styles.tabTitle,
                    { color: isActive ? app.color : textColor },
                  ]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.2}
                >
                  {app.name.replace('The ', '')}
                </Text>
                {!isCompact && (
                  <Text style={[styles.tabSub, { color: muted }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                    {app.id === 'thegruvs' ? 'Nightlife' : app.id === 'theresident' ? 'Stays' : 'Audio'}
                  </Text>
                )}
              </View>
              {isActive && (
                <View style={[styles.activeDot, { backgroundColor: app.color }]} />
              )}
            </TouchableOpacity>
          );
        })}

        {showMutuals && (
          <View style={styles.mutualsWrap}>
            <CommunityStatsBar variant="pill" />
          </View>
        )}
      </View>

      {/* In-App Ecosystem Portal (The Resident & Excellency inside The Gruvs) */}
      <EcosystemPortalModal
        visible={!!portalApp}
        app={portalApp}
        onClose={() => setPortalApp(null)}
        primary={primary}
        textColor={textColor}
        muted={muted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 14,
    marginVertical: 6,
    zIndex: 40,
  },
  barCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 5,
    borderRadius: 18,
    borderWidth: 1.5,
    backgroundColor: 'rgba(10, 14, 16, 0.94)',
    position: 'relative',
    ...(Platform.OS === 'web'
      ? { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }
      : {}),
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  textWrap: {
    alignItems: 'flex-start',
  },
  tabTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  tabSub: {
    fontSize: 8,
    fontWeight: '700',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginLeft: 2,
  },
  mutualsWrap: {
    marginLeft: 2,
  },
  reticle: {
    position: 'absolute',
    width: 6,
    height: 6,
  },
  tl: { top: 2, left: 2, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
  tr: { top: 2, right: 2, borderTopWidth: 1.5, borderRightWidth: 1.5 },
  bl: { bottom: 2, left: 2, borderBottomWidth: 1.5, borderLeftWidth: 1.5 },
  br: { bottom: 2, right: 2, borderBottomWidth: 1.5, borderRightWidth: 1.5 },
});
