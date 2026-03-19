import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ImageBackground, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ACCENT, GOLD, THEME } from '../theme';

const TIERS = [
  'Ivory Park', 'Midrand', 'Johannesburg', 'Gauteng', 'South Africa', 'Africa', 'The Globe'
];

// Mock algorithm data
const HAPPENINGS_MOCK = {
  'Ivory Park': [
    { id: 'h1', title: 'Top Shisanyama Sunday', venue: 'Bafana Bafana Meat', score: 98, img: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=400&auto=format&fit=crop' },
    { id: 'h2', title: 'Street Bash 011', venue: 'Zone 4', score: 85, img: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=400&auto=format&fit=crop' }
  ],
  'Midrand': [
    { id: 'h3', title: 'Tech Founder Mixer', venue: 'Mall of Africa', score: 92, img: 'https://images.unsplash.com/photo-1515169067868-5387ec446487?q=80&w=400&auto=format&fit=crop' },
    { id: 'h4', title: 'Amapiano Rooftop', venue: 'Cubana', score: 88, img: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=400&auto=format&fit=crop' }
  ],
  'Johannesburg': [
    { id: 'h5', title: 'Braam Block Party', venue: 'Braamfontein', score: 99, img: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=400&auto=format&fit=crop' }
  ],
  'The Globe': [
    { id: 'h6', title: 'Tomorrowland Core', venue: 'Tulum, MX', score: 100, img: 'https://images.unsplash.com/photo-1533174000202-659af2614a10?q=80&w=400&auto=format&fit=crop' }
  ]
};

export default function TheHappenings() {
  const [activeTier, setActiveTier] = useState('Ivory Park');
  
  const events = HAPPENINGS_MOCK[activeTier] || HAPPENINGS_MOCK['Midrand'];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <MaterialCommunityIcons name="lightning-bolt" size={20} color={GOLD} />
          <Text style={styles.title}>The Happenings</Text>
        </View>
        <Text style={styles.subtitle}>Top 10 real-time</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tierScroll}>
        {TIERS.map(tier => (
          <TouchableOpacity 
            key={tier} 
            style={[styles.tierTab, activeTier === tier && styles.tierTabActive]}
            onPress={() => setActiveTier(tier)}
          >
            <Text style={[styles.tierText, activeTier === tier && styles.tierTextActive]}>{tier}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardScroll} snapToInterval={170} decelerationRate="fast">
        {events.map((ev, index) => (
          <View key={ev.id} style={styles.eventCard}>
            <ImageBackground source={{ uri: ev.img }} style={styles.cardImg} imageStyle={styles.cardImgInner}>
              <View style={styles.overlay}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>#{index + 1}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.eventTitle} numberOfLines={2}>{ev.title}</Text>
                  <Text style={styles.eventVenue} numberOfLines={1}>{ev.venue}</Text>
                  <View style={styles.scoreRow}>
                    <Ionicons name="flame" size={12} color="#ff4500" />
                    <Text style={styles.scoreText}>{ev.score} Gruv Score</Text>
                  </View>
                </View>
              </View>
            </ImageBackground>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  subtitle: {
    color: THEME.sub,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  tierScroll: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 15
  },
  tierTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: '#1e1e3f'
  },
  tierTabActive: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderColor: GOLD,
  },
  tierText: {
    color: THEME.sub,
    fontSize: 13,
    fontWeight: '600'
  },
  tierTextActive: {
    color: GOLD,
    fontWeight: '800'
  },
  cardScroll: {
    paddingHorizontal: 16,
    gap: 12
  },
  eventCard: {
    width: 160,
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardImg: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  cardImgInner: {
    borderRadius: 16,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'space-between',
    padding: 12
  },
  rankBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  rankText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 12
  },
  cardInfo: {
    gap: 4
  },
  eventTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18
  },
  eventVenue: {
    color: '#d1d5db',
    fontSize: 11,
    fontWeight: '500'
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4
  },
  scoreText: {
    color: '#ff4500',
    fontSize: 10,
    fontWeight: '800'
  }
});
