import React, { useState, useEffect } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Platform, KeyboardAvoidingView, Modal, RefreshControl, Alert, ScrollView, Image, Share
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

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
  const [collapsedThreads, setCollapsedThreads] = useState({});
  const [commentText, setCommentText] = useState({});

  const theme = user?.gender === 'female' ? femaleTheme : (user?.gender === 'male' ? maleTheme : dayTheme);

  useEffect(() => { if(screen === 'feed') fetchPosts(); }, [screen, searchQuery, activeCategory]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const url = `${API_URL}?q=${searchQuery}&category=${activeCategory}`;
      const res = await fetch(url);
      if (res.ok) setPosts(await res.json());
    } catch (err) {
      setPosts([{ id: '1', content: { title: 'Joburg Rooftop Jazz', author_name: 'Vibe Central', text: 'Smooth jazz with a view of the skyline. 🎷', category: 'Live', location: 'The Leonardo, Sandton', dateTime: 'Tonight at 7 PM' }, engagement_metrics: { liked_by: ['u1'], comments: [{id: 'c1', author: 'Mark', text: 'Will there be food trucks too?'}], rsvps: {} } }]);
    } finally { setLoading(false); }
  };

  const handleAuth = () => {
    setUser({ id: 'u1', name: 'Alex', gender: 'male' });
    setScreen('feed');
  };

  const renderPost = ({ item }) => {
    const d = item.content || {};
    const m = item.engagement_metrics || { liked_by: [], comments: [], rsvps: {} };
    const isCollapsed = collapsedThreads[item.id];

    return (
      <View style={[styles.postCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <View style={styles.cardHeader}>
          <Text style={styles.liveTag}>LIVE</Text>
          <View style={styles.authorRow}>
            <Image source={{uri: 'https://via.placeholder.com/40'}} style={styles.avatarMini} />
            <View>
              <Text style={styles.authorName}>{d.author_name} <Text style={styles.followText}>Follow</Text></Text>
              <Text style={styles.postTime}>2h</Text>
            </View>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity><Text style={{fontSize: 18}}>🔖</Text></TouchableOpacity>
            <TouchableOpacity style={styles.aiBtn}><Text>🤖</Text></TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.eventTitle, { color: theme.text }]}>{d.title}</Text>
        <Text style={[styles.eventDesc, { color: theme.text }]}>{d.text}</Text>
        <Text style={styles.detailText}>📅 {d.dateTime}</Text>
        <Text style={styles.detailText}>📍 {d.location}</Text>

        <View style={styles.mediaHighlights}>
          <Text style={styles.mediaHighlightsText}>📷 Media Highlights (Max 15 Img, 3 Vid)</Text>
        </View>

        <View style={styles.commentSection}>
          <View style={styles.commentsHeader}>
            <Text style={[styles.sectionTitle, { color: theme.accent }]}>{m.comments?.length || 0} Comments & Live Chat</Text>
            <TouchableOpacity onPress={() => setCollapsedThreads({...collapsedThreads, [item.id]: !isCollapsed})}><Text style={styles.collapseText}>{isCollapsed ? 'EXPAND  ▼' : 'COLLAPSE  ▲'}</Text></TouchableOpacity>
          </View>
          {!isCollapsed && m.comments?.map(c => (
            <View key={c.id} style={styles.commentNode}><Text style={[styles.commentAuthor, {color: theme.text}]}>{c.author}: <Text style={{fontWeight: 'normal', color: '#888'}}>{c.text}</Text></Text></View>
          ))}
          <View style={styles.commentInputRow}>
            <TextInput style={[styles.commentInput, { backgroundColor: '#141430', color: '#fff' }]} placeholder="Join the chat..." placeholderTextColor="#94a3b8" />
            <TouchableOpacity style={[styles.sendBtn, {backgroundColor: theme.accent}]}><Text style={{color: '#fff', fontWeight: 'bold'}}>Send</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (screen === 'auth') {
    return (
      <View style={styles.authPage}>
        <StatusBar style="light" />
        <View style={styles.authGlassCard}>
          <View style={styles.boltCircle}><Text style={styles.boltIcon}>⚡</Text></View>
          <Text style={styles.mainTitle}>The Gruvs</Text>
          <Text style={styles.subTitle}>Find Your Frequency.</Text>
          <Text style={styles.authDesc}>Join the movement. Curate your vibe, find your crew, and unlock exclusive drops.</Text>
          <TouchableOpacity style={styles.joinBtn} onPress={handleAuth}><Text style={styles.joinBtnText}>Join the Gruvs</Text></TouchableOpacity>
          <TouchableOpacity style={styles.lookBtn} onPress={() => { setUser(null); setScreen('feed'); }}><Text style={styles.lookBtnText}>Just Looking Around</Text></TouchableOpacity>
          <Text style={styles.legalText}>By continuing, you agree to our Terms & Privacy Policy.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.dashboard}>
      <StatusBar style="light" />
      <View style={styles.sidebar}>
        {['🏠', '🔍', '💬', '⚡', '🎁', '👥', '🔒', '💳', '➕', '👤', '⬅'].map((icon, idx) => (
          <TouchableOpacity key={idx} style={[styles.sideIconContainer, idx === 0 && styles.sideActive]}>
            <Text style={styles.sideIcon}>{icon}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <SafeAreaView style={styles.mainArea}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.topHeader}>
            <View style={styles.searchBox}>
              <TextInput style={styles.searchBar} placeholder="Search events, vibes, people..." placeholderTextColor="#888" />
              <TouchableOpacity style={styles.filterBtn}><Text style={{fontSize: 18}}>🎛️</Text></TouchableOpacity>
            </View>

            <View style={styles.catRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity style={styles.nearMeBtn}><Text style={styles.nearMeText}>📍 Near Me</Text></TouchableOpacity>
                {MASTER_CATEGORIES.map(cat => (
                  <TouchableOpacity key={cat} onPress={() => setActiveCategory(cat)} style={[styles.catChip, activeCategory === cat && {backgroundColor: theme.accent}]}>
                    <Text style={styles.catText}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <FlatList data={posts} keyExtractor={item => item.id} renderItem={renderPost} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const dayTheme = { background: '#f9fafb', card: '#fff', text: '#111', cardBorder: '#ddd', navBg: '#fff', accent: '#ff4da6' };
const maleTheme = { background: '#050510', card: 'rgba(30,30,35,0.9)', text: '#fff', cardBorder: '#ff4da6', navBg: '#070718', accent: '#ff4da6' };
const femaleTheme = { background: '#1a000d', card: 'rgba(60,10,30,0.8)', text: '#fff', cardBorder: '#000', navBg: '#1a000d', accent: '#ff4da6' };

const styles = StyleSheet.create({
  dashboard: { flex: 1, backgroundColor: '#310a5d', flexDirection: 'row' },
  sidebar: { width: 70, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', paddingTop: 20 },
  sideIconContainer: { width: 45, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  sideActive: { backgroundColor: 'rgba(255,77,166,0.3)' },
  sideIcon: { fontSize: 22, color: '#fff' },
  mainArea: { flex: 1 },
  topHeader: { padding: 20 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingHorizontal: 15 },
  searchBar: { flex: 1, height: 50, color: '#fff' },
  catRow: { marginTop: 15, flexDirection: 'row' },
  nearMeBtn: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', marginRight: 10 },
  nearMeText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  catChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 10 },
  catText: { color: '#ccc', fontSize: 13, fontWeight: 'bold' },
  postCard: { margin: 15, padding: 25, borderRadius: 35, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  liveTag: { color: '#94a3b8', fontWeight: 'bold', fontSize: 10, marginRight: 15 },
  authorRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatarMini: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  authorName: { color: '#fff', fontWeight: 'bold' },
  followText: { color: '#3b82f6', fontSize: 12 },
  headerIcons: { flexDirection: 'row', gap: 15 },
  aiBtn: { width: 35, height: 35, borderRadius: 18, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' },
  eventTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 10 },
  eventDesc: { fontSize: 16, color: '#ccc', marginBottom: 20 },
  detailText: { color: '#94a3b8', fontSize: 14, marginBottom: 5 },
  mediaHighlights: { height: 100, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#444', marginBottom: 20 },
  mediaHighlightsText: { color: '#888', fontStyle: 'italic', fontSize: 12 },
  commentSection: { borderTopWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', paddingTop: 15 },
  commentsHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  sectionTitle: { fontWeight: 'bold', fontSize: 14 },
  collapseText: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold' },
  commentNode: { marginBottom: 15, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: '#3b82f6' },
  commentAuthor: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  commentInput: { flex: 1, height: 45, borderRadius: 15, paddingHorizontal: 15 },
  sendBtn: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 15 },
  authPage: { flex: 1, backgroundColor: '#310a5d', justifyContent: 'center', padding: 25 },
  authGlassCard: { width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 40, padding: 40, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  boltCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255, 255, 255, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 25 },
  boltIcon: { fontSize: 40, color: '#fff' },
  mainTitle: { fontSize: 48, fontWeight: '900', color: '#fff', marginBottom: 5 },
  subTitle: { fontSize: 20, color: '#fff', opacity: 0.8, marginBottom: 30 },
  authDesc: { color: '#fff', textAlign: 'center', fontSize: 14, opacity: 0.6, lineHeight: 22, marginBottom: 40 },
  joinBtn: { width: '100%', backgroundColor: '#ff4da6', padding: 18, borderRadius: 20, alignItems: 'center' },
  joinBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  lookBtn: { width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', padding: 18, borderRadius: 20, alignItems: 'center', marginTop: 15 },
  lookBtnText: { color: '#fff', fontWeight: '600' },
  legalText: { color: '#fff', fontSize: 10, opacity: 0.3, marginTop: 30 }
});
