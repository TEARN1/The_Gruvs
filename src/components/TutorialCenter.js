/**
 * TutorialCenter — Browsable hub of all tutorials.
 * Opens as a full-screen modal from ProfilePage or any entry point.
 * Groups tutorials by category, shows completion state, and lets users replay.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, TextInput, Dimensions, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTutorial, TUTORIALS, TUTORIAL_CATEGORIES } from '../context/TutorialContext';
import { useTheme } from '../context/ThemeContext';
import { GlassView } from './GlassView';

const { width: SW } = Dimensions.get('window');

// ── Category icon map ─────────────────────────────────────────────────────────
const CAT_ICONS = {
  'Tune In':              { icon: 'zap',       color: "#00f2ff" },
  'The Drop & Gruvs':     { icon: 'home',      color: "#ef4444" },
  'Scout & Discover':     { icon: 'compass',   color: "#f59e0b" },
  'Vibe Card & Identity': { icon: 'user',      color: "#06b6d4" },
  'Biz Hub & Missions':   { icon: 'briefcase', color: "#f59e0b" },
  'Lineup & Pings':       { icon: 'calendar',  color: "#10b981" },
  'Reels':                { icon: 'film',      color: "#ec4899" },
  'Social & Connections': { icon: 'users',     color: "#8b5cf6" },
  'Event Management':     { icon: 'settings',  color: "#00f2ff" },
};

// ── Tutorial Card ─────────────────────────────────────────────────────────────
const TutorialCard = ({ tutorial, isDone, onStart, primary, textColor, muted }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 80,  useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 120, useNativeDriver: true }),
    ]).start(() => onStart(tutorial.id));
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity onPress={handlePress} activeOpacity={1}>
        <GlassView style={[tc.card, { borderColor: isDone ? `${tutorial.color}40` : `${tutorial.color}20` }]}>
          {/* Done checkmark */}
          {isDone && (
            <View style={[tc.doneBadge, { backgroundColor: "#10b981" }]}>
              <Feather name="check" size={9} color="#fff" />
            </View>
          )}

          <View style={tc.cardInner}>
            {/* Icon */}
            <View style={[tc.iconWrap, { backgroundColor: `${tutorial.color}15`, borderColor: `${tutorial.color}30` }]}>
              <Feather name={tutorial.icon} size={22} color={tutorial.color} />
            </View>

            {/* Text */}
            <View style={{ flex: 1 }}>
              <Text style={[tc.cardTitle, { color: textColor }]}>{tutorial.title}</Text>
              <View style={tc.metaRow}>
                <Feather name="clock" size={10} color={muted} />
                <Text style={[tc.metaDuration, { color: muted }]}>{tutorial.duration}</Text>
                <View style={[tc.dot, { backgroundColor: muted }]} />
                <Text style={[tc.metaSteps, { color: muted }]}>{tutorial.steps.length} steps</Text>
              </View>
            </View>

            {/* CTA */}
            <View style={[tc.ctaBtn, { backgroundColor: `${tutorial.color}${isDone ? '15' : '20'}`, borderColor: `${tutorial.color}30` }]}>
              <Text style={[tc.ctaText, { color: tutorial.color }]}>{isDone ? 'REPLAY' : 'START'}</Text>
              <Feather name={isDone ? 'refresh-cw' : 'play'} size={10} color={tutorial.color} />
            </View>
          </View>
        </GlassView>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ── Category Section Header ───────────────────────────────────────────────────
const CategoryHeader = ({ category, count, doneCount, textColor, muted }) => {
  const meta = CAT_ICONS[category] || { icon: 'grid', color: "#00f2ff" };
  const pct  = count > 0 ? (doneCount / count) * 100 : 0;
  return (
    <View style={ch.row}>
      <View style={[ch.iconWrap, { backgroundColor: `${meta.color}15` }]}>
        <Feather name={meta.icon} size={14} color={meta.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[ch.title, { color: textColor }]}>{category}</Text>
        <Text style={[ch.sub, { color: muted }]}>{doneCount}/{count} completed</Text>
      </View>
      <View style={ch.progressWrap}>
        <View style={[ch.progressTrack, { backgroundColor: `${meta.color}15` }]}>
          <View style={[ch.progressFill, { width: `${pct}%`, backgroundColor: meta.color }]} />
        </View>
        <Text style={[ch.pct, { color: meta.color }]}>{Math.round(pct)}%</Text>
      </View>
    </View>
  );
};

const ch = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, marginTop: 6 },
  iconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 13, fontWeight: '900' },
  sub: { fontSize: 10, marginTop: 1 },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressTrack: { width: 60, height: 5, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  pct: { fontSize: 9, fontWeight: '900', width: 30, textAlign: 'right' },
});

// ── Overall Progress Banner ───────────────────────────────────────────────────
const ProgressBanner = ({ completed, total, primary, textColor, muted, onReset }) => {
  const pct  = total > 0 ? Math.round((completed / total) * 100) : 0;
  const fillW = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fillW, { toValue: pct / 100, duration: 800, useNativeDriver: false }).start();
  }, [pct]);

  return (
    <GlassView style={[pb.card, { borderColor: `${primary}25` }]}>
      <View style={pb.top}>
        <View>
          <Text style={[pb.label, { color: textColor }]}>Your Gruvs Academy Progress</Text>
          <Text style={[pb.sub, { color: muted }]}>{completed} of {total} moves locked in</Text>
        </View>
        <View style={[pb.pctBadge, { backgroundColor: `${primary}18` }]}>
          <Text style={[pb.pctText, { color: primary }]}>{pct}%</Text>
        </View>
      </View>

      <View style={pb.trackWrap}>
        <Animated.View style={[pb.fill, {
          width: fillW.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          backgroundColor: pct === 100 ? "#10b981" : primary,
        }]} />
      </View>

      {pct === 100 && (
        <View style={pb.completeRow}>
          <Feather name="award" size={13} color="#10b981" />
          <Text style={[pb.completeText, { color: "#10b981" }]}>Gruv Master — you know every move!</Text>
        </View>
      )}

      <TouchableOpacity onPress={onReset} style={pb.resetBtn}>
        <Feather name="refresh-cw" size={11} color={muted} />
        <Text style={[pb.resetText, { color: muted }]}>Reset progress</Text>
      </TouchableOpacity>
    </GlassView>
  );
};

const pb = StyleSheet.create({
  card: { padding: 16, borderRadius: 18, borderWidth: 1, marginBottom: 20 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  label: { fontSize: 15, fontWeight: '900' },
  sub: { fontSize: 11, marginTop: 3 },
  pctBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  pctText: { fontSize: 18, fontWeight: '900' },
  trackWrap: { height: 7, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
  fill: { height: '100%', borderRadius: 4 },
  completeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  completeText: { fontSize: 12, fontWeight: '800' },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  resetText: { fontSize: 10, fontWeight: '700' },
});

// ── Quick Start Cards (shown at top) ─────────────────────────────────────────
const QuickCard = ({ icon, label, color, onPress }) => (
  <TouchableOpacity onPress={onPress} style={[qc.card, { borderColor: `${color}25`, backgroundColor: `${color}08` }]} activeOpacity={0.8}>
    <View style={[qc.icon, { backgroundColor: `${color}18` }]}>
      <Feather name={icon} size={18} color={color} />
    </View>
    <Text style={[qc.label, { color }]}>{label}</Text>
  </TouchableOpacity>
);

const qc = StyleSheet.create({
  card: { width: (SW - 52) / 3, alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, gap: 8 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 10, fontWeight: '900', textAlign: 'center', letterSpacing: 0.3 },
});

// ── Main TutorialCenter ───────────────────────────────────────────────────────
export const TutorialCenter = ({ visible, onClose }) => {
  const { isCompleted, openTutorial, resetAll, completed } = useTutorial();
  const { currentTheme } = useTheme();

  const primary   = currentTheme?.primary    || "#00f2ff";
  const bg        = currentTheme?.background || "#0d1112";
  const textColor = currentTheme?.text       || "#ffffff";
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const slideAnim = useRef(new Animated.Value(50)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(50);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 40, duration: 200, useNativeDriver: true }),
    ]).start(onClose);
  };

  const handleStart = (id) => {
    handleClose();
    setTimeout(() => openTutorial(id), 260);
  };

  const handleReset = () => {
    resetAll();
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
  };

  // Filter tutorials
  const filtered = TUTORIALS.filter(t => {
    const matchCat = activeCategory === 'All' || t.category === activeCategory;
    const matchSearch = !search.trim() || t.title.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // Group by category
  const grouped = TUTORIAL_CATEGORIES.reduce((acc, cat) => {
    const items = filtered.filter(t => t.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  const categories = ['All', ...TUTORIAL_CATEGORIES];

  return (
    <Modal visible={visible} animationType="none" presentationStyle="overFullScreen" transparent onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' }}>
        <Animated.View style={[tcc.sheet, {
          backgroundColor: bg,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }]}>
          {/* Header */}
          <View style={[tcc.header, { borderBottomColor: `${primary}15` }]}>
            <TouchableOpacity onPress={handleClose} style={tcc.backBtn}>
              <Feather name="x" size={20} color={textColor} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[tcc.headerTitle, { color: textColor }]}>Gruvs Academy</Text>
              <Text style={[tcc.headerSub, { color: primary }]}>Master every move in The Gruvs</Text>
            </View>
            <View style={[tcc.badge, { backgroundColor: `${primary}18` }]}>
              <Text style={[tcc.badgeText, { color: primary }]}>{completed.length}/{TUTORIALS.length}</Text>
            </View>
          </View>

          {/* Search */}
          <View style={[tcc.searchWrap, { borderBottomColor: `${primary}10` }]}>
            <View style={[tcc.searchBar, { borderColor: `${primary}25`, backgroundColor: `${primary}06` }]}>
              <Feather name="search" size={16} color={muted} />
              <TextInput
                style={[tcc.searchInput, { color: textColor }]}
                value={search}
                onChangeText={setSearch}
                placeholder="Search the Academy..."
                placeholderTextColor={muted}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Feather name="x" size={14} color={muted} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Category tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[tcc.catBar, { borderBottomColor: `${primary}10` }]}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 10 }}
          >
            {categories.map(cat => {
              const isActive = cat === activeCategory;
              const catMeta = CAT_ICONS[cat];
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {} setActiveCategory(cat); }}
                  style={[tcc.catChip, {
                    backgroundColor: isActive ? `${catMeta?.color || primary}20` : 'transparent',
                    borderColor:     isActive ? `${catMeta?.color || primary}50` : `${primary}20`,
                  }]}
                >
                  {catMeta && <Feather name={catMeta.icon} size={11} color={isActive ? catMeta.color : muted} />}
                  <Text style={[tcc.catChipText, { color: isActive ? (catMeta?.color || primary) : muted }]}>
                    {cat === 'All' ? 'All Tutorials' : cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Content */}
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Quick start (only on All + no search) */}
            {activeCategory === 'All' && !search && (
              <>
                <Text style={[tcc.sectionLabel, { color: textColor }]}>Quick Start</Text>
                <View style={tcc.quickRow}>
                  <QuickCard icon="zap"       label="Tune In"   color="#00f2ff" onPress={() => handleStart('welcome')} />
                  <QuickCard icon="home"       label="The Drop" color="#ef4444" onPress={() => handleStart('the_drop')} />
                  <QuickCard icon="briefcase"  label="Biz Hub"  color="#f59e0b" onPress={() => handleStart('business_intro')} />
                </View>

                {/* Overall progress */}
                <ProgressBanner
                  completed={completed.length}
                  total={TUTORIALS.length}
                  primary={primary}
                  textColor={textColor}
                  muted={muted}
                  onReset={handleReset}
                />
              </>
            )}

            {/* Tutorial groups */}
            {Object.entries(grouped).map(([cat, items]) => {
              const doneCount = items.filter(t => isCompleted(t.id)).length;
              return (
                <View key={cat} style={{ marginBottom: 8 }}>
                  <CategoryHeader
                    category={cat}
                    count={items.length}
                    doneCount={doneCount}
                    textColor={textColor}
                    muted={muted}
                  />
                  {items.map(tutorial => (
                    <TutorialCard
                      key={tutorial.id}
                      tutorial={tutorial}
                      isDone={isCompleted(tutorial.id)}
                      onStart={handleStart}
                      primary={primary}
                      textColor={textColor}
                      muted={muted}
                    />
                  ))}
                  <View style={[tcc.divider, { backgroundColor: `${primary}10` }]} />
                </View>
              );
            })}

            {filtered.length === 0 && (
              <View style={tcc.empty}>
                <Feather name="search" size={36} color={muted} />
                <Text style={[tcc.emptyText, { color: muted }]}>No Academy moves match "{search}"</Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const tc = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, marginBottom: 10, padding: 14, position: 'relative' },
  cardInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  cardTitle: { fontSize: 13, fontWeight: '900', marginBottom: 5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaDuration: { fontSize: 10 },
  dot: { width: 3, height: 3, borderRadius: 1.5, opacity: 0.4 },
  metaSteps: { fontSize: 10 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  ctaText: { fontSize: 9, fontWeight: '900' },
  doneBadge: { position: 'absolute', top: 10, right: 10, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
});

const tcc = StyleSheet.create({
  sheet: {
    flex: 1,
    marginTop: Platform.OS === 'ios' ? 50 : 30,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '900' },
  headerSub: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginTop: 2 },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  badgeText: { fontSize: 13, fontWeight: '900' },

  searchWrap: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14 },

  catBar: { flexGrow: 0, borderBottomWidth: 1 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  catChipText: { fontSize: 11, fontWeight: '800' },

  sectionLabel: { fontSize: 13, fontWeight: '900', letterSpacing: 0.5, marginBottom: 12 },
  quickRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },

  divider: { height: 1, marginVertical: 16 },

  empty: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14 },
});
