import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Animated, Image, Dimensions, Easing,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GlassView } from './GlassView';
import { useTheme } from '../context/ThemeContext';
import * as Haptics from 'expo-haptics';
import { GlitterBurst } from './GlitterBurst';
import { getCategoryColor, CATEGORY_CONFIG } from '../constants/CategoryConfig';

export const VibeRouletteModal = ({ visible, onClose, events, onSelectEvent, primary }) => {
  const { currentTheme } = useTheme();
  const [selectedCat, setSelectedCat] = useState('all');
  const [rolling, setRolling] = useState(false);
  const [rolledEvent, setRolledEvent] = useState(null);
  const [confettiActive, setConfettiActive] = useState(false);

  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const resultFadeAnim = useRef(new Animated.Value(0)).current;
  const timersRef = useRef([]);

  const bg = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  useEffect(() => {
    if (visible) {
      setRolledEvent(null);
      setConfettiActive(false);
      setRolling(false);
      rotateAnim.setValue(0);
      resultFadeAnim.setValue(0);
    }
    return () => {
      // Clean up timeouts on close
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current = [];
    };
  }, [visible]);

  const handleRoll = () => {
    if (rolling) return;
    setRolling(true);
    setRolledEvent(null);
    setConfettiActive(false);
    rotateAnim.setValue(0);
    resultFadeAnim.setValue(0);

    // Filter events by selected category
    const candidates = events.filter(e => {
      if (selectedCat === 'all') return true;
      return e.category === selectedCat || (Array.isArray(e.categories) && e.categories.includes(selectedCat));
    });

    if (candidates.length === 0) {
      setTimeout(() => {
        setRolling(false);
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {}
      }, 500);
      return;
    }

    // Pick winning event
    const finalEvent = candidates[Math.floor(Math.random() * candidates.length)];
    const winningCat = finalEvent.category || 'all';

    // Find slice index
    let sliceIdx = cats.indexOf(winningCat);
    if (sliceIdx === -1) sliceIdx = 0; // fallback to surprise index

    // Rotation math: land winning slice at the top (0 deg/12 o'clock pointer)
    // Target angle = 360 - (sliceIdx * 45) + (full spins * 360)
    const targetAngle = (4 * 360) + (360 - (sliceIdx * 45));

    // Clear any leftover timers
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];

    // Trigger haptic clicks slowing down quadratically matching the quad easing deceleration curve
    let currentDelay = 0;
    for (let i = 1; i <= 28; i++) {
      const step = 35 + Math.pow(i, 2.1) * 0.45;
      currentDelay += step;
      if (currentDelay >= 3800) break;

      const t = setTimeout(() => {
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
      }, currentDelay);
      timersRef.current.push(t);
    }

    // Spin animation
    Animated.parallel([
      Animated.timing(rotateAnim, {
        toValue: targetAngle,
        duration: 3800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 150, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 150, useNativeDriver: true }),
      ])
    ]).start(() => {
      setRolledEvent(finalEvent);
      setConfettiActive(true);
      setRolling(false);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}

      // Fade in the winning result card
      Animated.timing(resultFadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    });
  };

  const cats = ['all', 'music', 'nightlife', 'sport', 'art', 'food', 'culture', 'wellness'];

  const spin = rotateAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  const renderWheelSegments = () => {
    return cats.map((c, idx) => {
      const angle = idx * 45;
      const config = CATEGORY_CONFIG[c];
      const color = config?.color || primary;
      return (
        <View
          key={c}
          style={[
            s.segment,
            {
              transform: [
                { rotate: `${angle}deg` },
                { translateY: -64 }
              ]
            }
          ]}
        >
          <Feather name={config?.icon || 'shuffle'} size={14} color={color} />
          <Text style={[s.segmentText, { color }]} numberOfLines={1}>
            {c === 'all' ? 'SURPRISE' : (config?.label || c).toUpperCase()}
          </Text>
        </View>
      );
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <GlassView style={[s.container, { backgroundColor: `${bg}F2` }]}>
          {/* Header */}
          <View style={s.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name="compass" size={20} color={primary} />
              <Text style={[s.title, { color: primary }]}>Vibe Roulette</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={20} color={textColor} />
            </TouchableOpacity>
          </View>

          <Text style={[s.desc, { color: muted }]}>
            No plans tonight? Pick a category preference and spin the wheel to discover your next destination.
          </Text>

          {/* Category Preference Chips */}
          <View style={s.catRow}>
            {cats.map(c => {
              const active = selectedCat === c;
              const config = CATEGORY_CONFIG[c];
              const color = config?.color || primary;
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => !rolling && setSelectedCat(c)}
                  style={[
                    s.catPill,
                    active && { backgroundColor: color, borderColor: color },
                    !active && { borderColor: `${color}30`, backgroundColor: `${color}05` }
                  ]}
                >
                  <Text style={[s.catText, { color: active ? '#000' : color }]}>
                    {c === 'all' ? 'Surprise Me' : config?.label || c}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Gamified Wheel Spin Box */}
          <View style={[s.spinnerBox, { borderColor: `${primary}20`, backgroundColor: `${bg}50` }]}>
            <View style={s.wheelContainer}>
              <Animated.View style={[s.wheel, { borderColor: `${primary}35`, transform: [{ rotate: spin }] }]}>
                {renderWheelSegments()}
              </Animated.View>
              {/* Pointer Needle */}
              <View style={s.pointerContainer}>
                <Feather name="triangle" size={14} color={primary} style={{ transform: [{ rotate: '180deg' }] }} />
              </View>
            </View>

            {/* Fading Result overlay */}
            {rolledEvent && !rolling && (
              <Animated.View style={[s.resultOverlay, { backgroundColor: bg, opacity: resultFadeAnim }]}>
                <View style={s.resultWrap}>
                  {rolledEvent.cover_url || rolledEvent.media_urls?.[0] ? (
                    <Image source={{ uri: rolledEvent.cover_url || rolledEvent.media_urls[0] }} style={s.resultImg} />
                  ) : (
                    <View style={[s.resultImg, { backgroundColor: `${primary}15`, alignItems: 'center', justifyContent: 'center' }]}><Feather name="image" size={16} color={primary} /></View>
                  )}
                  <Text style={[s.resultTitle, { color: textColor }]} numberOfLines={1}>
                    {rolledEvent.title}
                  </Text>
                  <View style={s.resultMeta}>
                    <Feather name="map-pin" size={11} color={primary} />
                    <Text style={{ color: muted, fontSize: 11 }} numberOfLines={1}>{rolledEvent.venue_name || 'Nearby'}</Text>
                  </View>
                </View>
              </Animated.View>
            )}

            {confettiActive && <GlitterBurst />}
          </View>

          {/* Action Buttons */}
          <View style={s.actions}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }], width: '100%' }}>
              <TouchableOpacity
                style={[s.rollBtn, { backgroundColor: primary }]}
                onPress={handleRoll}
                disabled={rolling}
              >
                {rolling ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <Feather name="play" size={15} color="#000" />
                    <Text style={s.rollBtnText}>Spin the Wheel</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>

            {rolledEvent && !rolling && (
              <TouchableOpacity
                style={[s.viewBtn, { borderColor: primary }]}
                onPress={() => {
                  onSelectEvent(rolledEvent);
                  onClose();
                }}
              >
                <Text style={[s.viewBtnText, { color: primary }]}>Open Event Details</Text>
                <Feather name="arrow-right" size={14} color={primary} />
              </TouchableOpacity>
            )}
          </View>
        </GlassView>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  container: { width: Dimensions.get('window').width - 36, padding: 22, borderRadius: 24, gap: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase' },
  desc: { fontSize: 12, lineHeight: 18 },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 },
  catPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  catText: { fontSize: 11, fontWeight: '800' },
  
  spinnerBox: { height: 180, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative' },
  wheelContainer: { position: 'relative', width: 170, height: 170, alignItems: 'center', justifyContent: 'center' },
  wheel: { width: 154, height: 154, borderRadius: 77, borderWidth: 2, position: 'relative', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)' },
  segment: { position: 'absolute', alignItems: 'center', justifyContent: 'center', width: 70, height: 26 },
  segmentText: { fontSize: 6.5, fontWeight: '950', marginTop: 1, letterSpacing: 0.3 },
  pointerContainer: { position: 'absolute', top: -4, alignSelf: 'center', zIndex: 10 },

  resultOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 20 },
  resultWrap: { alignItems: 'center', padding: 16, gap: 4 },
  resultImg: { width: 48, height: 48, borderRadius: 24, marginBottom: 4 },
  resultTitle: { fontSize: 14, fontWeight: '900', textAlign: 'center', paddingHorizontal: 20 },
  resultMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  actions: { alignItems: 'center', gap: 10, width: '100%', marginTop: 6 },
  rollBtn: { height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' },
  rollBtnText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
  viewBtn: { height: 44, borderRadius: 22, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%' },
  viewBtnText: { fontWeight: '800', fontSize: 13 },
});
