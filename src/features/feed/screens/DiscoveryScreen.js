import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, ScrollView, Dimensions, Platform, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons, Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useStore } from '../../../core/state/useStore';
import { ACCENT, THEME, GOLD } from '../../../core/theme';

const { width, height } = Dimensions.get('window');

const BLIP_COUNT = 15;

export default function DiscoveryScreen({ navigation }) {
  const { posts, user } = useStore();
  const radarAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const [activeVibe, setActiveVibe] = useState('All');
  const [nearbyEvents, setNearbyEvents] = useState([]);
  const { width: windowWidth } = useWindowDimensions();
  const isPC = Platform.OS === 'web' && windowWidth > 768;
  const contentWidth = isPC ? Math.min(windowWidth, 800) : windowWidth;

  const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  };

  const checkAuth = () => {
    if (!user || user.isVisitor) {
      navigation.navigate('Auth');
      return false;
    }
    return true;
  };

  useEffect(() => {
    // Radar sweep animation
    Animated.loop(
      Animated.timing(radarAnim, {
        toValue: 1,
        duration: 4000,
        useNativeDriver: true,
      })
    ).start();

    // Ambient pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 2000, useNativeDriver: true }),
      ])
    ).start();

    // Synchronize radar blips with the actual posts state from global store
    const displayPosts = (posts || []).slice(0, BLIP_COUNT);
    const seedBlips = displayPosts.map((e, index) => ({
      ...e,
      x: Math.random() * (contentWidth - 100) + 50,
      y: Math.random() * (Math.min(contentWidth, 400) - 100) + 50,
      delay: index * 500,
    }));
    setNearbyEvents(seedBlips);
  }, [posts, contentWidth]);

  const renderRadar = () => {
    const sweepRotate = radarAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    const radarSize = Math.min(contentWidth, 400);

    return (
      <View style={[styles.radarContainer, { width: contentWidth, height: radarSize }]} accessibilityLabel="Radar map showing nearby events" accessibilityRole="image">
        {/* Background Circles */}
        {[0.2, 0.4, 0.6, 0.8, 1].map((scale, i) => (
          <View key={i} style={[styles.radarCircle, { width: radarSize * 0.85 * scale, height: radarSize * 0.85 * scale, opacity: 0.1 }]} aria-hidden="true" />
        ))}
        
        {/* Axis Lines */}
        <View style={[styles.axisH, { width: radarSize * 0.85 }]} aria-hidden="true" />
        <View style={[styles.axisV, { height: radarSize * 0.85 }]} aria-hidden="true" />

        {/* Sweep */}
        <Animated.View style={[styles.sweep, { width: radarSize * 0.425, height: radarSize * 0.425, top: radarSize * 0.075, left: contentWidth * 0.5 - radarSize * 0.425, transform: [{ rotate: sweepRotate }] }]} aria-hidden="true">
          <View style={[styles.sweepGradient, { borderTopLeftRadius: radarSize }]} />
        </Animated.View>

        {/* Blips */}
        {nearbyEvents.map((ev, i) => (
          <RadarBlip key={ev.id} ev={ev} />
        ))}
      </View>
    );
  };

  const RadarBlip = ({ ev }) => {
    const blipVisible = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.sequence([
        Animated.delay(ev.delay),
        Animated.loop(
          Animated.sequence([
            Animated.timing(blipVisible, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.timing(blipVisible, { toValue: 0.6, duration: 1500, useNativeDriver: true }),
            Animated.timing(blipVisible, { toValue: 0, duration: 2000, useNativeDriver: true }),
          ])
        )
      ]).start();
    }, []);

    return (
      <Animated.View 
        style={[
          styles.blip, 
          { 
            left: ev.x, 
            top: ev.y,
            opacity: blipVisible,
            transform: [{ scale: blipVisible.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.2] }) }]
          }
        ]}
        accessibilityLabel={`Event: ${ev.title || ev.content?.title}`}
        accessibilityRole="button"
        onPress={() => {
          triggerHaptic('light');
          navigation.navigate('Pulse');
        }}
      >
        <View style={[styles.blipInner, { backgroundColor: (ev.category || ev.content?.category) === 'Tech' ? ACCENT : GOLD }]} />
        <View style={[styles.blipRing, { borderColor: (ev.category || ev.content?.category) === 'Tech' ? ACCENT : GOLD }]} />
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.contentWrapper, { maxWidth: 800, width: '100%', alignSelf: 'center' }]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title} accessibilityRole="header">Frequency Map</Text>
            <Text style={styles.subtitle}>Discovery Grid · 2km Radius</Text>
          </View>
          <TouchableOpacity
            style={styles.mapToggle}
            onPress={() => triggerHaptic()}
            accessibilityLabel="Filter layers"
            accessibilityRole="button"
          >
            <Feather name="layers" size={20} color={ACCENT} />
          </TouchableOpacity>
        </View>

        {renderRadar()}

        <View style={styles.controlPanel}>
          <Text style={styles.panelTitle} accessibilityRole="header">Tune Frequency</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.vibeScroll}
            accessibilityRole="tablist"
          >
            {['All', 'Underground', 'Tech', 'Amapiano', 'Luxury', 'Vocal'].map(vibe => (
              <TouchableOpacity
                key={vibe}
                style={[styles.vibeBtn, activeVibe === vibe && styles.vibeBtnActive]}
                onPress={() => {
                  triggerHaptic();
                  setActiveVibe(vibe);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeVibe === vibe }}
                accessibilityLabel={`${vibe} frequency filter`}
              >
                <Text style={[styles.vibeBtnText, activeVibe === vibe && { color: '#fff' }]}>{vibe}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.feedSummary}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle} accessibilityRole="header">Live Happenings</Text>
            <TouchableOpacity
              onPress={() => { triggerHaptic(Haptics.ImpactFeedbackStyle.Medium); navigation.navigate('Pulse'); }}
              accessibilityLabel="See all pulse events"
              accessibilityRole="button"
            >
              <Text style={styles.viewAll}>SEE PULSE →</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryScroll}>
            {nearbyEvents.map(ev => (
              <TouchableOpacity
                key={ev.id}
                style={styles.eventCard}
                onPress={() => { triggerHaptic(); navigation.navigate('Pulse'); }}
                accessibilityLabel={`Event: ${ev.title || ev.content?.title}, Category: ${ev.category || ev.content?.category}`}
                accessibilityRole="button"
              >
                <Text style={styles.eventCat}>{ev.category || ev.content?.category}</Text>
                <Text style={styles.eventTitle} numberOfLines={1}>{ev.title || ev.content?.title}</Text>
                <View style={styles.eventStats}>
                  <Ionicons name="flame" size={12} color={ACCENT} aria-hidden="true" />
                  <Text style={styles.eventStatText}>{Math.floor(Math.random() * 500 + 100)} active</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  contentWrapper: { flex: 1, paddingTop: Platform.OS === 'ios' ? 60 : 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 20 },
  title: { color: THEME.text, fontSize: 24, fontWeight: '900', letterSpacing: 0.5 },
  subtitle: { color: THEME.sub, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginTop: 4 },
  mapToggle: { width: 44, height: 44, borderRadius: 14, backgroundColor: THEME.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: THEME.cardBorder },
  
  radarContainer: { justifyContent: 'center', alignItems: 'center', position: 'relative' },
  radarCircle: { position: 'absolute', borderRadius: 1000, borderWidth: 1, borderColor: ACCENT },
  axisH: { position: 'absolute', height: 1, backgroundColor: 'rgba(255,77,166,0.05)' },
  axisV: { position: 'absolute', width: 1, backgroundColor: 'rgba(255,77,166,0.05)' },
  
  sweep: { position: 'absolute', overflow: 'hidden' },
  sweepGradient: { flex: 1, backgroundColor: 'rgba(255,77,166,0.1)', borderRightWidth: 4, borderRightColor: ACCENT, opacity: 0.3 },
  
  blip: { position: 'absolute', width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  blipInner: { 
    width: 8,
    height: 8,
    borderRadius: 4,
    ...Platform.select({
      web: { boxShadow: `0 0 10px ${ACCENT}` },
      default: { shadowColor: ACCENT, shadowOpacity: 0.8, shadowRadius: 8, elevation: 4 }
    })
  },
  blipRing: { position: 'absolute', width: 20, height: 20, borderRadius: 10, borderWidth: 1, opacity: 0.3 },

  controlPanel: { paddingHorizontal: 24, marginTop: 20 },
  panelTitle: { color: THEME.text, fontSize: 14, fontWeight: '800', textTransform: 'uppercase', marginBottom: 14, letterSpacing: 1 },
  vibeScroll: { gap: 10 },
  vibeBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.cardBorder },
  vibeBtnActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  vibeBtnText: { color: THEME.textDim, fontSize: 13, fontWeight: '700' },

  feedSummary: { marginTop: 30, paddingHorizontal: 24 },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  summaryTitle: { color: THEME.text, fontSize: 18, fontWeight: '800' },
  viewAll: { color: ACCENT, fontSize: 12, fontWeight: '800' },
  summaryScroll: { gap: 12, paddingBottom: 20 },
  eventCard: { width: 160, backgroundColor: THEME.card, padding: 16, borderRadius: 24, borderWidth: 1, borderColor: THEME.cardBorder, ...Platform.select({ web: { boxShadow: '0 4px 15px rgba(0,0,0,0.04)' }, default: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 } }) },
  eventCat: { color: THEME.sub, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
  eventTitle: { color: THEME.text, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  eventStats: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eventStatText: { color: ACCENT, fontSize: 11, fontWeight: '700' },
});
