import React, { useState, useEffect } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Platform, KeyboardAvoidingView, Modal, RefreshControl, Alert, ScrollView, Image
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
const API_URL = (Platform.OS === 'web' && !BASE_URL) ? '/api/events' : `${BASE_URL}/api/events`;

export default function App() {
  const [screen, setScreen] = useState('auth');
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if(screen === 'feed') fetchPosts(); }, [screen]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await fetch(API_URL);
      if (res.ok) setPosts(await res.json());
    } catch (err) {
      setPosts([{ id: '1', content: { title: 'Joburg Rooftop Jazz', author_name: 'Vibe Central', text: 'Smooth jazz with a view of the skyline.', category: 'Live' } }]);
    } finally { setLoading(false); }
  };

  if (screen === 'auth') {
    return (
      <View style={styles.authPage}>
        <StatusBar style="light" />
        <View style={styles.authGlassCard}>
          <View style={styles.boltCircle}><Text style={styles.boltIcon}>⚡</Text></View>
          <Text style={styles.mainTitle}>The Gruv</Text>
          <Text style={styles.subTitle}>Find Your Frequency.</Text>
          <Text style={styles.authDesc}>Join the movement. Curate your vibe, find your crew, and unlock exclusive drops.</Text>
          <TouchableOpacity style={styles.joinBtn} onPress={() => { setUser({id: 'u1', name: 'Alex', gender: 'male'}); setScreen('feed'); }}><Text style={styles.joinBtnText}>Join the Gruv</Text></TouchableOpacity>
          <TouchableOpacity style={styles.lookBtn} onPress={() => { setUser(null); setScreen('feed'); }}><Text style={styles.lookBtnText}>Just Looking Around</Text></TouchableOpacity>
          <Text style={styles.legalText}>By continuing, you agree to our Terms & Privacy Policy.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.dashboard}>
      <StatusBar style="light" />

      {/* LEFT SIDEBAR NAVIGATION */}
      <View style={styles.sidebar}>
        {['🏠', '🔍', '💬', '⚡', '🎁', '👥', '🔒', '💳', '➕', '👤', '⬅'].map((icon, idx) => (
          <TouchableOpacity key={idx} style={[styles.navIconContainer, idx === 0 && styles.navActive]}>
            <Text style={styles.navIcon}>{icon}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <SafeAreaView style={styles.mainContent}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* TOP SEARCH BAR */}
          <View style={styles.searchContainer}>
            <TextInput style={styles.searchBar} placeholder="Search events, vibes, people..." placeholderTextColor="#888" />
            <TouchableOpacity style={styles.filterBtn}><Text style={{fontSize: 18}}>⛛</Text></TouchableOpacity>
          </View>

          {/* STORIES SECTION */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storiesRow}>
            <TouchableOpacity style={styles.addStoryCard}>
              <View style={styles.storyAddBtn}><Text style={{color: '#fff'}}>+</Text></View>
              <Text style={styles.storyText}>Add Story</Text>
            </TouchableOpacity>
            <View style={styles.storyCard}><Image source={{uri: 'https://via.placeholder.com/100'}} style={styles.storyImg}/></View>
          </ScrollView>

          {/* DAILY VIBE CHECK (GAMIFICATION) */}
          <View style={styles.vibeCheckCard}>
            <View style={styles.vibeHeader}>
              <Text style={styles.vibeTitle}>⚡ Daily Vibe Check</Text>
              <Text style={styles.vibeTimer}>Resets in 12h</Text>
            </View>
            <View style={styles.progressRow}><Text style={styles.taskText}>Like 3 Events</Text><View style={styles.progressBar}><View style={[styles.progressFill, {width: '0%'}]}/></View><Text style={styles.countText}>0/3</Text></View>
            <View style={styles.progressRow}><Text style={styles.taskText}>Share a Vibe</Text><View style={styles.progressBar}><View style={[styles.progressFill, {width: '0%'}]}/></View><Text style={styles.countText}>0/1</Text></View>
            <View style={styles.progressRow}><Text style={styles.taskText}>RSVP to an Event</Text><View style={styles.progressBar}><View style={[styles.progressFill, {width: '0%'}]}/></View><Text style={styles.countText}>0/1</Text></View>
            <TouchableOpacity style={styles.leaderboardBtn}><Text style={styles.leaderboardText}>📊 View Leaderboard</Text></TouchableOpacity>
          </View>

          {/* MAIN LIVE EVENT CARD */}
          <FlatList
            data={posts}
            keyExtractor={item => item.id}
            renderItem={({item}) => (
              <View style={styles.liveCard}>
                <View style={styles.liveHeader}>
                  <Text style={styles.liveTag}>LIVE</Text>
                  <View style={styles.authorRow}>
                    <Image source={{uri: 'https://via.placeholder.com/40'}} style={styles.miniAvatar}/>
                    <View>
                      <Text style={styles.authorName}>Vibe Central <Text style={styles.followText}>Follow</Text></Text>
                      <Text style={styles.postTime}>2h</Text>
                    </View>
                  </View>
                  <View style={styles.liveActions}>
                    <TouchableOpacity style={styles.actionBtn}><Text>🔖</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.aiBtn}><Text>🤖</Text></TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.liveTitle}>{item.content.title}</Text>
                <Text style={styles.liveDesc}>{item.content.text}</Text>
                <TouchableOpacity style={styles.chatBubble}><Text>💬</Text></TouchableOpacity>
              </View>
            )}
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  dashboard: { flex: 1, backgroundColor: '#4a148c', flexDirection: 'row' },
  sidebar: { width: 70, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', paddingTop: 50 },
  navIconContainer: { width: 45, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  navActive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  navIcon: { fontSize: 22, color: '#fff' },
  mainContent: { flex: 1, paddingHorizontal: 20 },
  searchContainer: { flexDirection: 'row', marginTop: 20, marginBottom: 25 },
  searchBar: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', padding: 15, borderRadius: 20, color: '#fff' },
  filterBtn: { marginLeft: 15, justifyContent: 'center' },
  storiesRow: { marginBottom: 30 },
  addStoryCard: { width: 90, height: 140, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  storyAddBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#ff4da6', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  storyText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  storyCard: { width: 90, height: 140, borderRadius: 20, borderWidth: 2, borderColor: '#ff4da6', overflow: 'hidden' },
  storyImg: { width: '100%', height: '100%' },
  vibeCheckCard: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 20, borderRadius: 25, marginBottom: 30, marginHorizontal: 20 },
  vibeHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  vibeTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  vibeTimer: { color: '#aaa', fontSize: 12 },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  taskText: { color: '#fff', fontSize: 12, flex: 1 },
  progressBar: { flex: 2, height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, marginHorizontal: 15 },
  progressFill: { height: '100%', backgroundColor: '#ff4da6', borderRadius: 3 },
  countText: { color: '#aaa', fontSize: 10 },
  leaderboardBtn: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 12, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  leaderboardText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  liveCard: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 35, padding: 25, borderWidth: 1, borderColor: 'rgba(255,77,166,0.3)', marginHorizontal: 20 },
  liveHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  liveTag: { color: '#ff4da6', fontWeight: 'bold', fontSize: 10, marginRight: 15 },
  authorRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  miniAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  authorName: { color: '#fff', fontWeight: 'bold' },
  followText: { color: '#3b82f6', fontSize: 12, fontWeight: 'bold' },
  postTime: { color: '#888', fontSize: 10 },
  liveActions: { flexDirection: 'row' },
  actionBtn: { padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)' },
  aiBtn: { marginLeft: 15, width: 40, height: 40, borderRadius: 20, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' },
  liveTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 10 },
  liveDesc: { color: '#ccc', fontSize: 16, marginBottom: 20 },
  chatBubble: { position: 'absolute', bottom: 20, right: 20, width: 50, height: 50, borderRadius: 25, backgroundColor: '#ff4da6', justifyContent: 'center', alignItems: 'center' },
  authPage: { flex: 1, backgroundColor: '#4a148c', justifyContent: 'center', padding: 25 },
  authGlassCard: { backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 40, padding: 40, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' },
  boltCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 25 },
  boltIcon: { fontSize: 40, color: '#fff' },
  mainTitle: { fontSize: 42, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  subTitle: { fontSize: 18, color: '#fff', opacity: 0.8, marginBottom: 30 },
  authDesc: { color: '#fff', textAlign: 'center', fontSize: 14, opacity: 0.7, lineHeight: 20, marginBottom: 40 },
  joinBtn: { width: '100%', backgroundColor: '#ff4da6', padding: 18, borderRadius: 20, alignItems: 'center', shadowColor: '#ff4da6', shadowOpacity: 0.5, shadowRadius: 10 },
  joinBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  lookBtn: { width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: 18, borderRadius: 20, alignItems: 'center', marginTop: 15 },
  lookBtnText: { color: '#fff', fontWeight: '600' },
  legalText: { color: '#fff', fontSize: 10, opacity: 0.4, marginTop: 30 }
});
