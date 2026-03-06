import React, { useState, useEffect } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Platform, KeyboardAvoidingView, Modal, RefreshControl, Alert, ScrollView, Image
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { getTheme } from './src/data';
import { AuthScreen, ProfileScreen } from './src/screens';
import { useToast, Toast } from './src/components';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
const API_URL = (Platform.OS === 'web' && !BASE_URL) ? '/api/events' : `${BASE_URL}/api/events`;

const MASTER_CATEGORIES = [
  'All', 'Church', 'Mosque', 'Temple', 'Synagogue', 'Bible Study', 'Youth Ministry', 'Prayer Group', 'Revival',
  'Football', 'Basketball', 'Soccer', 'Running', 'Cycling', 'Yoga'
];

export default function App() {
  const [screen, setScreen] = useState('auth');
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [collapsedThreads, setCollapsedThreads] = useState(false);

  const [eventForm, setEventForm] = useState({ title: '', text: '', location: '', dateTime: '', guests: '', category: 'Church' });
  const [commentText, setCommentText] = useState('');

  const theme = user?.gender === 'female' ? femaleTheme : (user?.gender === 'male' ? maleTheme : dayTheme);

  useEffect(() => { if(screen === 'feed') fetchPosts(); }, [screen, searchQuery, activeCategory]);

  const fetchPosts = async () => {
    try {
      const url = `${API_URL}?q=${searchQuery}&category=${activeCategory}`;
      const res = await fetch(url);
      if (res.ok) setPosts(await res.json());
    } catch (err) {
      // Seed data if API is offline
      setPosts([{
        id: '1', content: { title: 'Sunday Revival', author_name: 'Mark', text: 'Join us for a powerful session!', category: 'Revival', location: 'Grace Hall', dateTime: 'Tonight at 7 PM' },
        engagement_metrics: { liked_by: [], comments: [{id: 'c1', author: 'Sarah', text: 'I will be there!'}], rsvps: {} }
      }]);
    }
  };

  const renderPost = ({ item }) => {
    const postData = item.content || {};
    const metrics = item.engagement_metrics || { liked_by: [], comments: [], rsvps: {} };

    return (
      <View style={[styles.postCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <View style={styles.categoryBadge}><Text style={styles.categoryBadgeText}>{postData.category}</Text></View>
        <Text style={[styles.eventTitle, { color: theme.text }]}>{postData.title}</Text>
        <Text style={styles.eventAuthor}>By {postData.author_name}</Text>

        <View style={styles.detailBox}>
          <Text style={styles.detailText}>📍 {postData.location}</Text>
          <Text style={styles.detailText}>📅 {postData.dateTime}</Text>
        </View>

        <View style={styles.mediaPlaceholder}>
          <Text style={{ color: '#888', fontStyle: 'italic', fontSize: 12 }}>📷 Event Media Highlights (Max 15 Images, 3 Vids)</Text>
        </View>

        <Text style={[styles.eventDescription, { color: theme.text }]}>{postData.text}</Text>

        <View style={styles.commentSection}>
          <View style={styles.commentsHeader}>
            <Text style={[styles.sectionTitle, { color: theme.accent }]}>{metrics.comments?.length || 0} Comments & Live Chat</Text>
            <TouchableOpacity onPress={() => setCollapsedThreads(!collapsedThreads)}><Text style={{color: '#888', fontSize: 11}}>{collapsedThreads ? 'EXPAND  ▼' : 'COLLAPSE  ▲'}</Text></TouchableOpacity>
          </View>
          {!collapsedThreads && metrics.comments?.map(c => (
            <View key={c.id} style={styles.commentNode}><Text style={[styles.commentAuthor, {color: theme.text}]}>{c.author}: <Text style={{fontWeight: 'normal', color: '#888'}}>{c.text}</Text></Text></View>
          ))}
          <View style={styles.addCommentRow}>
            <TextInput style={[styles.commentInput, { color: theme.text }]} placeholder="Join the chat... (Recordings, Stickers, Links)" placeholderTextColor="#888" />
            <TouchableOpacity style={[styles.sendBtn, {backgroundColor: theme.accent}]}><Text style={styles.sendText}>Send</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (screen === 'auth') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#f0f2f5', justifyContent: 'center', padding: 25 }]}>
        <View style={styles.glassCard}>
          <Text style={styles.authLogo}>THE GRUV</Text>
          <TouchableOpacity style={styles.glowBtn} onPress={() => { setUser({id: 'u1', name: 'Alex', gender: 'male'}); setScreen('feed'); }}>
            <Text style={styles.glowBtnText}>ENTER THE ENGINE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{marginTop: 20, alignItems: 'center'}} onPress={() => { setUser(null); setScreen('feed'); }}>
            <Text style={{color: '#ff4da6', fontWeight: 'bold'}}>CONTINUE AS VISITOR →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={{fontSize: 20, color: theme.accent, marginRight: 15}}>🔍</Text>
        <TextInput style={[styles.searchBar, { backgroundColor: theme.card }]} placeholder="Search events..." placeholderTextColor="#888" value={searchQuery} onChangeText={setSearchQuery} />
      </View>

      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity style={styles.filterIconBtn}><Text style={{fontSize: 18}}>📍</Text></TouchableOpacity>
          {MASTER_CATEGORIES.map(cat => (
            <TouchableOpacity key={cat} onPress={() => setActiveCategory(cat)} style={[styles.filterBtn, activeCategory === cat && {backgroundColor: theme.accent}]}>
              <Text style={styles.filterText}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList data={posts} keyExtractor={item => item.id} renderItem={renderPost} contentContainerStyle={{ paddingBottom: 100 }} />

      <View style={[styles.bottomNav, { backgroundColor: theme.navBg, borderTopColor: theme.cardBorder }]}>
        <TouchableOpacity onPress={() => setScreen('feed')} style={styles.navItem}>
          <Text style={{fontSize: 24, color: theme.accent}}>🏠</Text>
          <Text style={[styles.navText, {color: theme.accent}]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setScreen('profile')} style={styles.navItem}>
          <Text style={{fontSize: 24, color: '#888'}}>👤</Text>
          <Text style={styles.navText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const dayTheme = { background: '#f9fafb', card: '#fff', text: '#111', cardBorder: '#ddd', navBg: '#fff', accent: '#ff4da6' };
const maleTheme = { background: '#000', card: 'rgba(30,30,35,0.9)', text: '#fff', cardBorder: '#ff4da6', navBg: '#070718', accent: '#ff4da6' };
const femaleTheme = { background: '#1a000d', card: 'rgba(60,10,30,0.8)', text: '#fff', cardBorder: '#000', navBg: '#1a000d', accent: '#ff4da6' };

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 60, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
  searchBar: { flex: 1, padding: 12, borderRadius: 15, color: '#fff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  filterRow: { height: 50, paddingLeft: 15, marginVertical: 10, flexDirection: 'row', alignItems: 'center' },
  filterIconBtn: { marginRight: 10 },
  filterBtn: { paddingHorizontal: 18, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', marginRight: 10, height: 35, justifyContent: 'center' },
  filterText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  glassCard: { width: '100%', padding: 35, borderRadius: 35, backgroundColor: 'rgba(255, 255, 255, 0.8)', borderWidth: 1.5, borderColor: 'rgba(255, 255, 255, 0.5)', elevation: 10 },
  authLogo: { fontSize: 32, fontWeight: '900', color: '#ff4da6', textAlign: 'center', letterSpacing: 10, marginBottom: 40 },
  glowBtn: { backgroundColor: '#ff4da6', padding: 18, borderRadius: 18, alignItems: 'center', shadowColor: '#ff4da6', shadowOpacity: 0.8, shadowRadius: 15 },
  glowBtnText: { color: '#fff', fontWeight: '900', letterSpacing: 2 },
  postCard: { margin: 15, padding: 20, borderRadius: 25, borderWidth: 1.5 },
  categoryBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(255,77,166,0.15)', marginBottom: 6 },
  categoryBadgeText: { color: '#ff4da6', fontSize: 10, fontWeight: '900' },
  eventTitle: { fontSize: 24, fontWeight: 'bold' },
  eventAuthor: { color: '#ff4da6', fontSize: 12, marginBottom: 10, fontWeight: '600' },
  detailBox: { marginBottom: 12 },
  detailText: { color: '#888', fontSize: 13 },
  mediaPlaceholder: { height: 100, backgroundColor: 'rgba(128,128,128,0.1)', borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderStyle: 'dashed', borderWidth: 1, borderColor: '#444' },
  eventDescription: { fontSize: 16, marginBottom: 20, lineHeight: 24 },
  commentSection: { borderTopWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', paddingTop: 15 },
  commentsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  commentNode: { marginBottom: 10, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: '#ff4da6' },
  commentAuthor: { fontWeight: 'bold', fontSize: 13 },
  addCommentRow: { flexDirection: 'row', marginTop: 15, alignItems: 'center' },
  commentInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 15 },
  sendBtn: { marginLeft: 10, padding: 12, borderRadius: 15 },
  sendText: { color: '#fff', fontWeight: 'bold' },
  bottomNav: { position: 'absolute', bottom: 0, width: '100%', height: 80, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderTopWidth: 1.5 },
  navItem: { alignItems: 'center' },
  navText: { fontSize: 10, fontWeight: '600', marginTop: 4 }
});
