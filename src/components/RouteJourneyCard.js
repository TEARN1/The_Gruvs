import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { GlassView } from './GlassView';
import { useTheme } from '../context/ThemeContext';

export const RouteJourneyCard = ({ route, onPress }) => {
  const { currentTheme } = useTheme();
  const primary = currentTheme?.primary || '#00f2ff';

  // Mocking the dots for the route line
  const steps = route.steps || [
    { title: 'The Sky Deck', icon: 'glass-wine' },
    { title: 'Warehouse IX', icon: 'music' },
    { title: 'Newtown Hub', icon: 'map-marker' },
  ];

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <GlassView style={styles.container}>
        <View style={styles.header}>
          <View style={[styles.badge, { backgroundColor: route.color || primary }]}>
            <Text style={styles.badgeText}>TRENDING JOURNEY</Text>
          </View>
          <Text style={styles.vibeCount}>🔥 {route.vibe_score || '2.4k'} Vibe Score</Text>
        </View>

        <Text style={styles.title}>{route.title || 'Jozi Nightowl Route'}</Text>
        <Text style={styles.description} numberOfLines={2}>
            {route.description || 'The definitive path through the best deep-house and underground spots this weekend.'}
        </Text>

        <View style={styles.pathContainer}>
            <View style={[styles.line, { backgroundColor: route.color || primary, opacity: 0.3 }]} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stepsScroll}>
                {steps.map((step, i) => (
                    <View key={i} style={styles.stepItem}>
                        <View style={[styles.dot, { backgroundColor: route.color || primary }]}>
                            <MaterialCommunityIcons name={step.icon} size={14} color="#000" />
                        </View>
                        <Text style={styles.stepTitle} numberOfLines={1}>{step.title}</Text>
                    </View>
                ))}
            </ScrollView>
        </View>

        <View style={styles.footer}>
            <View style={styles.authorRow}>
                <Image source={{ uri: route.author_avatar || 'https://i.pravatar.cc/50' }} style={styles.authorAvatar} />
                <Text style={styles.authorName}>by @{route.author || 'VibeKing'}</Text>
            </View>
            <TouchableOpacity style={[styles.joinBtn, { borderColor: route.color || primary }]}>
                <Text style={[styles.joinText, { color: route.color || primary }]}>JOIN ROUTE</Text>
            </TouchableOpacity>
        </View>
      </GlassView>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, marginHorizontal: 16, marginBottom: 20, borderRadius: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 8, fontWeight: '900', color: '#000' },
  vibeCount: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 'bold' },
  title: { color: 'white', fontSize: 20, fontWeight: '900', marginBottom: 6, letterSpacing: 0.5 },
  description: { color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 18, marginBottom: 20 },
  pathContainer: { marginBottom: 20, position: 'relative' },
  line: { position: 'absolute', top: 12, left: 15, right: 15, height: 2, zIndex: 0 },
  stepsScroll: { gap: 20 },
  stepItem: { alignItems: 'center', width: 80, zIndex: 1 },
  dot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  stepTitle: { color: 'white', fontSize: 9, fontWeight: 'bold' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 15 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  authorAvatar: { width: 24, height: 24, borderRadius: 12 },
  authorName: { color: 'white', fontSize: 11, fontWeight: '700' },
  joinBtn: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 },
  joinText: { fontSize: 10, fontWeight: '900' },
});
