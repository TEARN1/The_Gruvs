import React, { useState, useEffect } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Platform, KeyboardAvoidingView, Modal, RefreshControl, Alert, ScrollView, Image
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Sidebar } from './src/components/Sidebar';
import { FeedScreen, ProfileScreen } from './src/screens';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
const API_URL = (Platform.OS === 'web' && !BASE_URL) ? '/api/events' : `${BASE_URL}/api/events`;

export default function App() {
  const [screen, setScreen] = useState('auth');
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeScreen, setActiveScreen] = useState('feed');

  // New Deep Purple Premium Theme
  const theme = {
    background: '#310a5d', // Deepest purple
    sidebarBg: '#4b168c', // Lighter purple sidebar
    card: 'rgba(75, 22, 140, 0.4)', // Glassy purple
    text: '#ffffff',
    subText: 'rgba(255, 255, 255, 0.7)',
    accent: '#ff4da6', // Pink
    yellow: '#ffcc00',
    red: '#ef4444',
    border: 'rgba(255, 255, 255, 0.1)',
    glass: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(10px)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
    }
  };

  useEffect(() => {
    if (user && screen === 'feed') fetchPosts();
  }, [user, screen]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await fetch(API_URL);
      if (res.ok) setPosts(await res.json());
    } catch (err) {
      // Mock data for UI development
      setPosts([
        {
          id: '1',
          type: 'event',
          content: {
            title: 'Neon Nights Festival',
            author_name: 'Sarah',
            text: 'The vibe is insane! 🔥',
            location: 'Century City, Cape Town',
            distance: '1253.3 km away',
            lineup: 'Pro Players',
            tags: ['Competitive', 'High Energy', 'gaming', 'esports', 'anime'],
            price: 'R50'
          },
          engagement_metrics: { likes: 110, comments: 1, reposts: 1 }
        }
      ]);
    } finally { setLoading(false); }
  };

  const handleLogout = () => {
    setUser(null);
    setScreen('auth');
  };

  if (screen === 'auth') {
    return (
      <View style={[styles.authPage, { backgroundColor: theme.sidebarBg }]}>
        <StatusBar style="light" />
        <View style={styles.authGlassCard}>
          <View style={styles.boltCircle}><Text style={styles.boltIcon}>⚡</Text></View>
          <Text style={styles.mainTitle}>The Gruv</Text>
          <Text style={styles.subTitle}>Find Your Frequency.</Text>
          <TouchableOpacity style={[styles.joinBtn, { backgroundColor: theme.accent }]} onPress={() => { setUser({ id: 'u1', name: 'User', gender: 'male' }); setScreen('app'); }}>
            <Text style={styles.joinBtnText}>Join the Gruv</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <View style={styles.mainLayout}>
        <Sidebar
          activeScreen={activeScreen}
          onNavigate={setActiveScreen}
          onLogout={handleLogout}
          theme={theme}
        />

        <View style={styles.contentArea}>
          {activeScreen === 'feed' && (
            <View style={styles.screenWrapper}>
              <View style={styles.searchHeader}>
                <View style={styles.searchContainer}>
                  <Text style={styles.searchIcon}>🔍</Text>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search events, vibes, people..."
                    placeholderTextColor="rgba(255,255,255,0.5)"
                  />
                </View>
                <TouchableOpacity style={styles.filterBtn}>
                  <Text style={styles.filterIcon}>▽</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.scrollContent}>
                {posts.map(post => (
                  post.type === 'event' ? (
                    <EventCard key={post.id} post={post} theme={theme} />
                  ) : (
                    <SocialPost key={post.id} post={post} theme={theme} />
                  )
                ))}
              </ScrollView>
            </View>
          )}

          {activeScreen === 'profile' && (
            <ProfileScreen
              user={user}
              theme={{ bg: theme.background, acc: theme.accent, card: theme.card, text: theme.text, sub: theme.subText, inp: 'rgba(255,255,255,0.1)', it: theme.text }}
              onLogout={handleLogout}
              onBack={() => setActiveScreen('feed')}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainLayout: { flex: 1, flexDirection: 'row' },
  contentArea: { flex: 1, height: '100%' },
  screenWrapper: { flex: 1, padding: 25 },
  authPage: { flex: 1, justifyContent: 'center', padding: 25 },
  authGlassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 40,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  boltCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 25 },
  boltIcon: { fontSize: 40, color: '#fff' },
  mainTitle: { fontSize: 42, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  subTitle: { fontSize: 18, color: '#fff', opacity: 0.8, marginBottom: 30 },
  joinBtn: { width: '100%', padding: 18, borderRadius: 20, alignItems: 'center' },
  joinBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },

  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 15
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    paddingHorizontal: 20,
    height: 55,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchIcon: { fontSize: 18, marginRight: 15, opacity: 0.5 },
  searchInput: { flex: 1, color: '#fff', fontSize: 16 },
  filterBtn: {
    width: 55,
    height: 55,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filterIcon: { color: '#fff', fontSize: 20 },
  scrollContent: { paddingBottom: 50 },
  postCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 25,
    padding: 0,
    marginBottom: 25,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  }
});
