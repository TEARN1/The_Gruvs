import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Animated, Image,
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
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rollTextAnim = useRef(new Animated.Value(0)).current;

  const bg = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  useEffect(() => {
    if (visible) {
      setRolledEvent(null);
      setConfettiActive(false);
      setRolling(false);
    }
  }, [visible]);

  const handleRoll = () => {
    if (rolling) return;
    setRolling(true);
    setRolledEvent(null);
    setConfettiActive(false);

    // Filter events by selected category
    const candidates = events.filter(e => {
      if (selectedCat === 'all') return true;
      return e.category === selectedCat || (Array.isArray(e.categories) && e.categories.includes(selectedCat));
    });

    if (candidates.length === 0) {
      setTimeout(() => {
        setRolling(false);
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
      }, 800);
      return;
    }

    // Start pulsating animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 150, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 150, useNativeDriver: true }),
      ]),
      { iterations: 6 }
    ).start();

    // Cycle through titles visually
    let counter = 0;
    const interval = setInterval(() => {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
      const tempEvent = candidates[Math.floor(Math.random() * candidates.length)];
      setRolledEvent(tempEvent);
      counter++;
      if (counter > 12) {
        clearInterval(interval);
        // Pick final event
        const finalEvent = candidates[Math.floor(Math.random() * candidates.length)];
        setRolledEvent(finalEvent);
        setRolling(false);
        setConfettiActive(true);
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      }
    }, 120);
  };

  const cats = ['all', 'music', 'nightlife', 'sport', 'art', 'food', 'culture', 'wellness'];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <GlassView style={[s.container, { backgroundColor: `${bg}FA` }]}>
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
            No plans tonight? Pick a preference and let roulette find your next destination.
          </Text>

          {/* Category Chips */}
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
                    !active && { borderColor: `${color}40`, backgroundColor: `${color}05` }
                  ]}
                >
                  <Text style={[s.catText, { color: active ? '#000' : color }]}>
                    {c === 'all' ? 'Surprise Me' : config?.label || c}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Spinner Box */}
          <View style={[s.spinnerBox, { borderColor: `${primary}30`, backgroundColor: `${bg}80` }]}>
            {rolledEvent ? (
              <View style={s.resultWrap}>
                {rolledEvent.media?.[0]?.url && (
                  <Image source={{ uri: rolledEvent.media[0].url }} style={s.resultImg} />
                )}
                <Text style={[s.resultTitle, { color: textColor }]} numberOfLines={2}>
                  {rolledEvent.title}
                </Text>
                <View style={s.resultMeta}>
                  <Feather name="map-pin" size={12} color={primary} />
                  <Text style={{ color: muted, fontSize: 12 }}>{rolledEvent.venue_name || 'Nearby'}</Text>
                </View>
              </View>
            ) : (
              <View style={s.emptySpinner}>
                <Feather name="shuffle" size={32} color={`${primary}60`} style={s.spinIcon} />
                <Text style={{ color: muted, fontSize: 13 }}>Roll the roulette to start</Text>
              </View>
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
                    <Feather name="play" size={16} color="#000" />
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
  spinnerBox: { height: 180, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative' },
  emptySpinner: { alignItems: 'center', gap: 8 },
  spinIcon: { marginBottom: 4 },
  resultWrap: { alignItems: 'center', padding: 16, gap: 6 },
  resultImg: { width: 44, height: 44, borderRadius: 22, marginBottom: 4 },
  resultTitle: { fontSize: 15, fontWeight: '900', textAlign: 'center', paddingHorizontal: 20 },
  resultMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actions: { alignItems: 'center', gap: 10, width: '100%', marginTop: 6 },
  rollBtn: { height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' },
  rollBtnText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
  viewBtn: { height: 44, borderRadius: 22, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%' },
  viewBtnText: { fontWeight: '800', fontSize: 13 },
});
