/**
 * TutorialOverlay — Animated fullscreen step-by-step tutorial viewer.
 * Pulls the active tutorial from TutorialContext and renders it as a modal.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions, ScrollView, Platform,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { useTutorial } from '../context/TutorialContext';
import { useTheme } from '../context/ThemeContext';

const { width: SW, height: SH } = Dimensions.get('window');

// ── Step Visual Illustration ──────────────────────────────────────────────────
const StepVisual = ({ visualKey, color, textColor, muted }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Maps each visual key to an icon cluster
  const VISUALS = {
    welcome:       { primary: 'zap',          secondary: ['home', 'compass', 'user'] },
    city:          { primary: 'map-pin',       secondary: ['map', 'navigation', 'globe'] },
    tabs:          { primary: 'layout',        secondary: ['home', 'compass', 'calendar'] },
    feed:          { primary: 'home',          secondary: ['heart', 'bookmark', 'message-circle'] },
    stats:         { primary: 'bar-chart-2',   secondary: ['trending-up', 'check-circle', 'star'] },
    filters:       { primary: 'filter',        secondary: ['sliders', 'tag', 'list'] },
    trending:      { primary: 'trending-up',   secondary: ['zap', 'fire', 'award'] },
    vibe:          { primary: 'heart',         secondary: ['zap', 'trending-up', 'users'] },
    save:          { primary: 'bookmark',      secondary: ['calendar', 'bell', 'clock'] },
    share:         { primary: 'share-2',       secondary: ['send', 'link', 'users'] },
    echoes:        { primary: 'message-circle',secondary: ['send', 'heart', 'at-sign'] },
    reactions:     { primary: 'zap',           secondary: ['heart', 'star', 'thumbs-up'] },
    write_echo:    { primary: 'edit-2',        secondary: ['send', 'at-sign', 'message-circle'] },
    checkin:       { primary: 'check-circle',  secondary: ['map-pin', 'users', 'award'] },
    live_map:      { primary: 'map',           secondary: ['map-pin', 'eye', 'users'] },
    rewards:       { primary: 'award',         secondary: ['star', 'zap', 'trending-up'] },
    explore:       { primary: 'compass',       secondary: ['search', 'map', 'filter'] },
    search:        { primary: 'search',        secondary: ['type', 'tag', 'zap'] },
    join_route:    { primary: 'users',         secondary: ['navigation', 'map-pin', 'clock'] },
    create_route:  { primary: 'plus-circle',   secondary: ['navigation', 'users', 'award'] },
    routes:        { primary: 'navigation',    secondary: ['users', 'map', 'map-pin'] },
    profile:       { primary: 'user',          secondary: ['star', 'award', 'camera'] },
    edit_profile:  { primary: 'edit-2',        secondary: ['camera', 'type', 'map-pin'] },
    score:         { primary: 'star',          secondary: ['trending-up', 'award', 'zap'] },
    modes:         { primary: 'shield',        secondary: ['eye', 'eye-off', 'user'] },
    viper:         { primary: 'eye',           secondary: ['users', 'trending-up', 'globe'] },
    celebrity:     { primary: 'eye-off',       secondary: ['shield', 'lock', 'slash'] },
    biz:           { primary: 'briefcase',     secondary: ['bar-chart-2', 'target', 'globe'] },
    store:         { primary: 'layout',        secondary: ['image', 'package', 'globe'] },
    finance:       { primary: 'dollar-sign',   secondary: ['trending-up', 'pie-chart', 'credit-card'] },
    ecosystem:     { primary: 'globe',         secondary: ['link-2', 'users', 'star'] },
    campaign:      { primary: 'target',        secondary: ['users', 'zap', 'dollar-sign'] },
    templates:     { primary: 'file-text',     secondary: ['zap', 'copy', 'check-circle'] },
    targeting:     { primary: 'users',         secondary: ['sliders', 'map-pin', 'activity'] },
    phases:        { primary: 'clock',         secondary: ['zap', 'sun', 'moon'] },
    contextual:    { primary: 'zap',           secondary: ['eye', 'target', 'bell'] },
    ad_phases:     { primary: 'layers',        secondary: ['clock', 'zap', 'star'] },
    adfree:        { primary: 'eye-off',       secondary: ['shield', 'check-circle', 'slash'] },
    calendar:      { primary: 'calendar',      secondary: ['clock', 'bell', 'check-circle'] },
    conflicts:     { primary: 'alert-circle',  secondary: ['calendar', 'clock', 'zap'] },
    share_cal:     { primary: 'share-2',       secondary: ['calendar', 'users', 'send'] },
    alerts:        { primary: 'bell',          secondary: ['check-circle', 'zap', 'calendar'] },
    reminders:     { primary: 'clock',         secondary: ['bell', 'calendar', 'check-circle'] },
    notif_settings:{ primary: 'settings',      secondary: ['bell', 'toggle-right', 'sliders'] },
  };

  const icons = VISUALS[visualKey] || { primary: 'zap', secondary: ['star', 'users'] };

  return (
    <View style={sv.container}>
      {/* Outer pulse ring */}
      <Animated.View style={[sv.outerRing, { borderColor: `${color}18`, transform: [{ scale: pulseAnim }] }]} />
      {/* Mid ring */}
      <View style={[sv.midRing, { borderColor: `${color}30` }]} />
      {/* Main icon circle */}
      <View style={[sv.mainCircle, { backgroundColor: `${color}18`, borderColor: `${color}40` }]}>
        <Feather name={icons.primary} size={52} color={color} />
      </View>
      {/* Satellite icons */}
      {icons.secondary.map((icon, i) => {
        const angle = (i / icons.secondary.length) * Math.PI * 2 - Math.PI / 2;
        const radius = 90;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        return (
          <View key={icon} style={[sv.satellite, {
            transform: [{ translateX: x }, { translateY: y }],
            backgroundColor: `${color}12`,
            borderColor: `${color}25`,
          }]}>
            <Feather name={icon} size={16} color={color} style={{ opacity: 0.7 }} />
          </View>
        );
      })}
    </View>
  );
};

const sv = StyleSheet.create({
  container: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  outerRing: { position: 'absolute', width: 210, height: 210, borderRadius: 105, borderWidth: 1 },
  midRing:   { position: 'absolute', width: 160, height: 160, borderRadius: 80,  borderWidth: 1 },
  mainCircle:{ width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  satellite: { position: 'absolute', width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});

// ── Progress Dots ─────────────────────────────────────────────────────────────
const ProgressDots = ({ total, current, color, muted }) => (
  <View style={pd.row}>
    {Array.from({ length: total }, (_, i) => (
      <View key={i} style={[pd.dot, {
        backgroundColor: i === current ? color : `${muted}40`,
        width: i === current ? 20 : 6,
      }]} />
    ))}
  </View>
);
const pd = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  dot: { height: 6, borderRadius: 3 },
});

// ── Main Overlay ──────────────────────────────────────────────────────────────
export const TutorialOverlay = () => {
  const { activeTutorial, closeTutorial, markCompleted } = useTutorial();
  const { currentTheme } = useTheme();

  const primary   = currentTheme?.primary    || "#00f2ff";
  const bg        = currentTheme?.background || "#0d1112";
  const textColor = currentTheme?.text       || "#ffffff";
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  const [step, setStep] = useState(0);

  const slideAnim  = useRef(new Animated.Value(0)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const scaleAnim  = useRef(new Animated.Value(0.92)).current;

  const tutorial = activeTutorial?.tutorial;
  const color    = tutorial?.color || primary;
  const steps    = tutorial?.steps || [];
  const current  = steps[step] || {};

  // Open animation
  useEffect(() => {
    if (activeTutorial) {
      setStep(activeTutorial.startStep || 0);
      slideAnim.setValue(0);
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.92);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 12, useNativeDriver: true }),
      ]).start();
    }
  }, [activeTutorial]);

  const animateStep = useCallback((direction) => {
    const outVal = direction === 'next' ? -SW : SW;
    const inVal  = direction === 'next' ? SW : -SW;
    Animated.timing(slideAnim, { toValue: outVal, duration: 180, useNativeDriver: true }).start(() => {
      slideAnim.setValue(inVal);
      Animated.spring(slideAnim, { toValue: 0, tension: 90, friction: 14, useNativeDriver: true }).start();
    });
  }, [slideAnim]);

  const goNext = useCallback(() => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    if (step < steps.length - 1) {
      animateStep('next');
      setStep(s => s + 1);
    } else {
      markCompleted(tutorial.id);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.9, duration: 250, useNativeDriver: true }),
      ]).start(closeTutorial);
    }
  }, [step, steps.length, animateStep, markCompleted, tutorial, closeTutorial]);

  const goPrev = useCallback(() => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    if (step > 0) {
      animateStep('prev');
      setStep(s => s - 1);
    }
  }, [step, animateStep]);

  const handleSkip = useCallback(() => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    markCompleted(tutorial?.id);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 200, useNativeDriver: true }),
    ]).start(closeTutorial);
  }, [markCompleted, tutorial, closeTutorial]);

  if (!activeTutorial) return null;

  const isLast = step === steps.length - 1;

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleSkip}>
      {/* Backdrop */}
      <Animated.View style={[tov.backdrop, { opacity: fadeAnim }]} />

      <Animated.View style={[tov.sheet, {
        backgroundColor: bg,
        borderColor: `${color}30`,
        opacity: fadeAnim,
        transform: [{ scale: scaleAnim }],
      }]}>
        {/* Top bar */}
        <View style={tov.topBar}>
          <View style={[tov.categoryBadge, { backgroundColor: `${color}15`, borderColor: `${color}30` }]}>
            <Feather name={tutorial.icon} size={11} color={color} />
            <Text style={[tov.categoryText, { color }]}>{tutorial.category.toUpperCase()}</Text>
          </View>
          <TouchableOpacity onPress={handleSkip} style={tov.skipBtn} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
            <Text style={[tov.skipText, { color: muted }]}>SKIP</Text>
            <Feather name="x" size={14} color={muted} />
          </TouchableOpacity>
        </View>

        {/* Visual + content (slides) */}
        <Animated.View style={[tov.slideArea, { transform: [{ translateX: slideAnim }] }]}>
          {/* Illustration */}
          <View style={tov.visualWrap}>
            <StepVisual visualKey={current.visual} color={color} textColor={textColor} muted={muted} />
          </View>

          {/* Text content */}
          <ScrollView
            contentContainerStyle={tov.contentArea}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Step counter */}
            <Text style={[tov.stepCounter, { color }]}>
              MOVE {step + 1} OF {steps.length}
            </Text>

            {/* Title */}
            <Text style={[tov.stepTitle, { color: textColor }]}>{current.title}</Text>

            {/* Body */}
            <Text style={[tov.stepBody, { color: muted }]}>{current.body}</Text>

            {/* Tip box */}
            {current.tip && (
              <View style={[tov.tipBox, { borderColor: `${color}30`, backgroundColor: `${color}08` }]}>
                <View style={[tov.tipIcon, { backgroundColor: `${color}20` }]}>
                  <Feather name="zap" size={12} color={color} />
                </View>
                <Text style={[tov.tipText, { color: muted }]}>{current.tip}</Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>

        {/* Bottom nav */}
        <View style={[tov.bottomNav, { borderTopColor: `${color}15` }]}>
          <ProgressDots total={steps.length} current={step} color={color} muted={muted} />

          <View style={tov.navBtns}>
            {step > 0 ? (
              <TouchableOpacity onPress={goPrev} style={[tov.prevBtn, { borderColor: `${color}30` }]}>
                <Feather name="arrow-left" size={16} color={color} />
                <Text style={[tov.prevText, { color }]}>Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1 }} />
            )}

            <TouchableOpacity
              onPress={goNext}
              style={[tov.nextBtn, { backgroundColor: color }]}
              activeOpacity={0.85}
            >
              {isLast ? (
                <>
                  <Feather name="check" size={16} color="#000" />
                  <Text style={tov.nextText}>DONE</Text>
                </>
              ) : (
                <>
                  <Text style={tov.nextText}>NEXT</Text>
                  <Feather name="arrow-right" size={16} color="#000" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
};

const tov = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.82)',
  },
  sheet: {
    position: 'absolute',
    left: 16, right: 16,
    top: SH * 0.06,
    bottom: SH * 0.06,
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  skipBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  skipText: { fontSize: 11, fontWeight: '700' },

  slideArea: { flex: 1 },
  visualWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },

  contentArea: { paddingHorizontal: 24, paddingBottom: 20 },
  stepCounter: { fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 10 },
  stepTitle:   { fontSize: 22, fontWeight: '900', lineHeight: 28, marginBottom: 12 },
  stepBody:    { fontSize: 14, lineHeight: 22, marginBottom: 20 },

  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  tipIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  tipText: { flex: 1, fontSize: 12, lineHeight: 18 },

  bottomNav: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    borderTopWidth: 1,
  },
  navBtns: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  prevBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
  },
  prevText: { fontSize: 13, fontWeight: '800' },
  nextBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  nextText: { color: '#000', fontSize: 14, fontWeight: '900' },
});
