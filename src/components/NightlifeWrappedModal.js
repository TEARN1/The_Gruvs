import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, Share, Animated, Dimensions,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { GlassView } from './GlassView';
import { useTheme } from '../context/ThemeContext';
import { buildWrappedShareText } from '../utils/nightlifeWrapped';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export function NightlifeWrappedModal({ visible, onClose, wrappedData, primary }) {
  const { currentTheme } = useTheme();
  const [slideIdx, setSlideIdx] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const bg = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const surface = currentTheme?.surface || '#1a1f21';

  useEffect(() => {
    if (visible) {
      setSlideIdx(0);
      fadeAnim.setValue(1);
    }
  }, [visible]);

  if (!wrappedData) return null;

  const handleNext = () => {
    if (slideIdx < 3) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
        setSlideIdx(prev => prev + 1);
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      });
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (slideIdx > 0) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
        setSlideIdx(prev => prev - 1);
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      });
    }
  };

  const handleShare = () => {
    Share.share({ message: buildWrappedShareText(wrappedData) }).catch(() => {});
  };

  const renderSlideContent = () => {
    switch (slideIdx) {
      case 0:
        return (
          <View style={s.slideContainer}>
            <View style={[s.iconBg, { backgroundColor: `${primary}15` }]}>
              <Feather name="award" size={54} color={primary} />
            </View>
            <Text style={[s.yearTitle, { color: primary }]}>{wrappedData.year}</Text>
            <Text style={[s.mainTitle, { color: textColor }]}>NIGHTLIFE{'\n'}WRAPPED</Text>
            <Text style={[s.subtitle, { color: muted }]}>
              Your year in review, 100% verified.{'\n'}No inflated numbers. Just real vibes.
            </Text>
          </View>
        );
      case 1:
        return (
          <View style={s.slideContainer}>
            <Text style={[s.slideHeader, { color: primary }]}>THE STATS</Text>
            <Text style={[s.headlineText, { color: textColor }]}>{wrappedData.headline}</Text>

            <View style={s.statsGrid}>
              <View style={[s.statCard, { backgroundColor: `${surface}80`, borderColor: `${primary}20` }]}>
                <Text style={[s.statNum, { color: primary }]}>{wrappedData.total}</Text>
                <Text style={[s.statSub, { color: textColor }]}>Nights Out</Text>
              </View>

              <View style={[s.statCard, { backgroundColor: `${surface}80`, borderColor: `${primary}20` }]}>
                <Text style={[s.statNum, { color: primary }]}>{wrappedData.venueCount}</Text>
                <Text style={[s.statSub, { color: textColor }]}>Venues Visited</Text>
              </View>

              <View style={[s.statCard, { backgroundColor: `${surface}80`, borderColor: `${primary}20` }]}>
                <Text style={[s.statNum, { color: primary }]}>{wrappedData.cityCount}</Text>
                <Text style={[s.statSub, { color: textColor }]}>Cities Conquered</Text>
              </View>
            </View>
          </View>
        );
      case 2:
        return (
          <View style={s.slideContainer}>
            <Text style={[s.slideHeader, { color: primary }]}>YOUR FAVORITES</Text>

            <View style={{ width: '100%', gap: 20, marginTop: 20 }}>
              {wrappedData.topVenue && (
                <View style={[s.favRow, { backgroundColor: `${surface}80`, borderColor: `${primary}15` }]}>
                  <View style={[s.favIcon, { backgroundColor: `${primary}15` }]}>
                    <Feather name="map-pin" size={20} color={primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: muted, fontSize: 11, fontWeight: '700' }}>HOME BASE</Text>
                    <Text style={{ color: textColor, fontSize: 16, fontWeight: '900' }}>{wrappedData.topVenue.name}</Text>
                    <Text style={{ color: primary, fontSize: 12, fontWeight: '700', marginTop: 1 }}>{wrappedData.topVenue.count} touch downs</Text>
                  </View>
                </View>
              )}

              {wrappedData.topScene && (
                <View style={[s.favRow, { backgroundColor: `${surface}80`, borderColor: `${primary}15` }]}>
                  <View style={[s.favIcon, { backgroundColor: `${primary}15` }]}>
                    <Feather name="zap" size={20} color={primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: muted, fontSize: 11, fontWeight: '700' }}>YOUR SCENE</Text>
                    <Text style={{ color: textColor, fontSize: 16, fontWeight: '900' }}>{wrappedData.topScene.name.toUpperCase()}</Text>
                  </View>
                </View>
              )}

              {wrappedData.busiestMonth && wrappedData.busiestMonth.count > 0 && (
                <View style={[s.favRow, { backgroundColor: `${surface}80`, borderColor: `${primary}15` }]}>
                  <View style={[s.favIcon, { backgroundColor: `${primary}15` }]}>
                    <Feather name="calendar" size={20} color={primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: muted, fontSize: 11, fontWeight: '700' }}>BIGGEST MONTH</Text>
                    <Text style={{ color: textColor, fontSize: 16, fontWeight: '900' }}>{wrappedData.busiestMonth.name}</Text>
                    <Text style={{ color: primary, fontSize: 12, fontWeight: '700', marginTop: 1 }}>{wrappedData.busiestMonth.count} check-ins</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        );
      case 3:
        return (
          <View style={s.slideContainer}>
            <Text style={[s.slideHeader, { color: primary }]}>READY TO SHARE?</Text>

            <GlassView style={[s.shareCard, { borderColor: `${primary}35` }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Feather name="award" size={18} color={primary} />
                <Text style={{ color: textColor, fontWeight: '900', fontSize: 14 }}>{wrappedData.year} WRAPPED</Text>
              </View>
              <Text style={{ color: primary, fontSize: 16, fontWeight: '950', lineHeight: 22 }}>
                {wrappedData.headline}
              </Text>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 14 }}>
                <View>
                  <Text style={{ color: textColor, fontSize: 15, fontWeight: '900' }}>{wrappedData.total}</Text>
                  <Text style={{ color: muted, fontSize: 9, fontWeight: '800' }}>Nights</Text>
                </View>
                <View>
                  <Text style={{ color: textColor, fontSize: 15, fontWeight: '900' }}>{wrappedData.venueCount}</Text>
                  <Text style={{ color: muted, fontSize: 9, fontWeight: '800' }}>Venues</Text>
                </View>
                <View>
                  <Text style={{ color: textColor, fontSize: 15, fontWeight: '900' }}>{wrappedData.cityCount}</Text>
                  <Text style={{ color: muted, fontSize: 9, fontWeight: '800' }}>Cities</Text>
                </View>
              </View>
            </GlassView>

            <TouchableOpacity style={[s.shareBtn, { backgroundColor: primary }]} onPress={handleShare}>
              <Feather name="share-2" size={16} color="#000" />
              <Text style={s.shareBtnText}>Share Story Recap</Text>
            </TouchableOpacity>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[s.overlay, { backgroundColor: bg }]}>
        {/* Story Progress Indicators */}
        <View style={s.progressRow}>
          {[0, 1, 2, 3].map(idx => (
            <View key={idx} style={s.progressBarBg}>
              <View
                style={[
                  s.progressBarFill,
                  {
                    backgroundColor: primary,
                    width: idx < slideIdx ? '100%' : idx === slideIdx ? '100%' : '0%',
                    opacity: idx === slideIdx ? 1.0 : idx < slideIdx ? 0.4 : 0.0,
                  }
                ]}
              />
            </View>
          ))}
        </View>

        {/* Header Close */}
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={24} color={textColor} />
          </TouchableOpacity>
        </View>

        {/* Interactive Tap Zones */}
        <View style={s.tapOverlay}>
          <TouchableOpacity style={s.leftTap} onPress={handlePrev} activeOpacity={1} />
          <TouchableOpacity style={s.rightTap} onPress={handleNext} activeOpacity={1} />
        </View>

        {/* Content Container */}
        <Animated.View style={[s.content, { opacity: fadeAnim }]}>
          {renderSlideContent()}
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, paddingVertical: 20, justifyContent: 'space-between' },
  progressRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginTop: 12, zIndex: 100 },
  progressBarBg: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 2 },
  header: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, zIndex: 100 },

  tapOverlay: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', zIndex: 50 },
  leftTap: { flex: 1, height: '100%' },
  rightTap: { flex: 1, height: '100%' },

  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30, zIndex: 60 },
  slideContainer: { alignItems: 'center', width: '100%', gap: 12 },

  iconBg: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  yearTitle: { fontSize: 24, fontWeight: '950', letterSpacing: 3 },
  mainTitle: { fontSize: 34, fontWeight: '900', textAlign: 'center', letterSpacing: 2, lineHeight: 40 },
  subtitle: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 10 },

  slideHeader: { fontSize: 11, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' },
  headlineText: { fontSize: 20, fontWeight: '900', textAlign: 'center', lineHeight: 26, marginVertical: 14 },
  statsGrid: { width: '100%', gap: 12, marginTop: 10 },
  statCard: { padding: 16, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
  statNum: { fontSize: 32, fontWeight: '950' },
  statSub: { fontSize: 12, fontWeight: '800', marginTop: 2, opacity: 0.8 },

  favRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 16, borderWidth: 1 },
  favIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  shareCard: { width: '100%', padding: 22, borderRadius: 24, borderWidth: 1.5, marginTop: 20 },
  shareBtn: { height: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginTop: 30 },
  shareBtnText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
});
