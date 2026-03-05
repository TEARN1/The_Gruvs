import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Platform, KeyboardAvoidingView, Modal, RefreshControl, Alert, ScrollView
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
const API_URL = (Platform.OS === 'web' && !BASE_URL) ? '/api/events' : `${BASE_URL}/api/events`;

const MASTER_CATEGORIES = [
  'All', 'Corporate & B2B', 'Social Milestones', 'Arts & Culture', 'Community & Public',
  'Sports & Fitness', 'Food & Lifestyle', 'Academic & Research', 'Hobbies & Collecting',
  'Trades & Industrial', 'Legal & Policy', 'Medical & Healthcare', 'Underground & Subculture',
  'Tech & Engineering', 'Spiritual & Occult', 'Early Childhood', 'Travel & Adventure',
  'Emergency Services', 'Finance & Insurance', 'Global Festivals', 'Hyper-Specific'
];

export default function App() {
  const [screen, setScreen] = useState('auth');
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [collapsedThreads, setCollapsedThreads] = useState(false);

  const [eventForm, setEventForm] = useState({ title: '', text: '', location: '', dateTime: '', guests: '', category: 'Social Milestones' });
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);

  const theme = user?.gender === 'female' ? femaleTheme : (user?.gender === 'male' ? maleTheme : dayTheme);

  useEffect(() => { if(screen === 'feed') fetchPosts(); }, [screen, searchQuery, activeCategory]);

  const fetchPosts = async () => {
    try {
      const url = `${API_URL}?q=${searchQuery}&category=${activeCategory}`;
      const res = await fetch(url);
      if (res.ok) setPosts(await res.json());
    } catch (err) { console.error(err); } finally { setRefreshing(false); }
  };

  const createEvent = async () => {
    if (!eventForm.title.trim() || !eventForm.text.trim()) return Alert.alert("Required", "Fields missing.");
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...eventForm, author: user.name, author_id: user.id, gender: user.gender })
      });
      if (res.ok) {
        setEventForm({ title: '', text: '', location: '', dateTime: '', guests: '', category: 'Social Milestones' });
        setModalVisible(false);
        fetchPosts();
      }
    } catch (err) { console.warn(err); }
  };

  const handleRSVP = async (postId, status) => {
    try {
      await fetch(API_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: postId, userId: user.id, action: 'rsvp', rsvpStatus: status })
      });
      fetchPosts();
    } catch (err) { console.warn(err); }
  };

  const renderPost = ({ item }) => {
    const postData = item.content || {};
    const metrics = item.engagement_metrics || { liked_by: [], comments: [], rsvps: {} };
    const userRsvp = metrics.rsvps?.[user.id];

    return (
      <View style={[styles.postCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <View style={styles.categoryBadge}><Text style={styles.categoryBadgeText}>{postData.category}</Text></View>
        <Text style={[styles.eventTitle, { color: theme.text }]}>{postData.title}</Text>
        <Text style={styles.eventAuthor}>By {postData.author_name}</Text>
        <View style={styles.detailBox}>
          <Text style={styles.detailText}>📍 {postData.location}</Text>
          <Text style={styles.detailText}>📅 {postData.dateTime}</Text>
        </View>
        <Text style={[styles.eventDescription, { color: theme.text }]}>{postData.text}</Text>

        <View style={styles.rsvpRow}>
          {['going', 'maybe', 'not_going'].map(s => (
            <TouchableOpacity key={s} style={[styles.rsvpBtn, userRsvp === s && {backgroundColor: theme.accent}]} onPress={() => handleRSVP(item.id, s)}>
              <Text style={styles.rsvpBtnText}>{s.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.commentSection}>
          <View style={styles.commentsHeader}>
            <Text style={[styles.sectionTitle, { color: theme.accent }]}>{metrics.comments?.length || 0} Comments</Text>
            <TouchableOpacity onPress={() => setCollapsedThreads(!collapsedThreads)}><Text style={{color: '#888', fontSize: 10}}>{collapsedThreads ? '[⬆ Expand]' : '[⬇ Collapse]'}</Text></TouchableOpacity>
          </View>
          <View style={styles.addCommentRow}>
            <TextInput style={[styles.commentInput, { color: theme.text }]} placeholder="Add comment..." placeholderTextColor="#888" value={replyingTo?.postId === item.id ? commentText : ''} onChangeText={setCommentText} />
            <TouchableOpacity style={[styles.sendBtn, {backgroundColor: theme.accent}]} onPress={() => {}}><Text style={styles.sendText}>Send</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (screen === 'auth') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: dayTheme.background, justifyContent: 'center', padding: 30 }]}>
        <Text style={[styles.logo, { color: '#ff4da6', marginBottom: 40, textAlign: 'center' }]}>THE GRUV</Text>
        <TouchableOpacity style={styles.mainBtn} onPress={() => { setUser({id: 'u1', name: 'Alex', gender: 'male'}); setScreen('feed'); }}><Text style={styles.mainBtnText}>ENTER THE ENGINE</Text></TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <TextInput style={[styles.searchBar, { backgroundColor: theme.card }]} placeholder="Search events..." placeholderTextColor="#888" value={searchQuery} onChangeText={setSearchQuery} />
      </View>

      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {MASTER_CATEGORIES.map(cat => (
            <TouchableOpacity key={cat} onPress={() => setActiveCategory(cat)} style={[styles.filterBtn, activeCategory === cat && {backgroundColor: theme.accent}]}><Text style={styles.filterText}>{cat}</Text></TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={posts}
        keyExtractor={item => item.id.toString()}
        renderItem={renderPost}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPosts(); }} tintColor="#ff4da6" />}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}><Text style={styles.fabIcon}>+</Text></TouchableOpacity>

      <View style={[styles.bottomNav, { backgroundColor: theme.navBg }]}>
        <TouchableOpacity onPress={() => setScreen('feed')} style={styles.navItem}><Text style={[styles.navIcon, screen === 'feed' && {color: theme.accent}]}>🏠</Text><Text style={[styles.navText, screen === 'feed' && {color: theme.accent}]}>Home</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setScreen('profile')} style={styles.navItem}><Text style={[styles.navIcon, screen === 'profile' && {color: theme.accent}]}>👤</Text><Text style={[styles.navText, screen === 'profile' && {color: theme.accent}]}>Profile</Text></TouchableOpacity>
      </View>

      <Modal animationType="slide" transparent visible={modalVisible}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior="padding" style={[styles.modalContent, { backgroundColor: theme.background, borderColor: theme.accent }]}>
            <Text style={styles.modalTitle}>POST NEW EVENT</Text>
            <TextInput style={styles.modalInput} placeholder="Event Title *" placeholderTextColor="#666" value={eventForm.title} onChangeText={t => setEventForm({...eventForm, title: t})} />
            <TextInput style={styles.modalInput} placeholder="Location / Venue *" placeholderTextColor="#666" value={eventForm.location} onChangeText={t => setEventForm({...eventForm, location: t})} />
            <TextInput style={styles.modalInput} placeholder="Date & Time *" placeholderTextColor="#666" value={eventForm.dateTime} onChangeText={t => setEventForm({...eventForm, dateTime: t})} />
            <TextInput style={[styles.modalInput, { height: 80 }]} placeholder="Description *" placeholderTextColor="#666" multiline value={eventForm.text} onChangeText={t => setEventForm({...eventForm, text: t})} />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={{color: '#888'}}>CANCEL</Text></TouchableOpacity>
              <TouchableOpacity style={styles.postBtn} onPress={createEvent}><Text style={{color: '#fff', fontWeight: 'bold'}}>SAVE EVENT</Text></TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const dayTheme = { background: '#f9fafb', card: '#fff', text: '#111', subtext: '#666', cardBorder: '#ddd', navBg: '#fff', accent: '#ff4da6' };
const maleTheme = { background: '#000', card: 'rgba(30,30,35,0.9)', text: '#fff', subtext: '#aaa', cardBorder: '#ff4da6', navBg: '#111', accent: '#ff4da6' };
const femaleTheme = { background: '#1a000d', card: 'rgba(60,10,30,0.8)', text: '#fff', subtext: '#ffb3d9', cardBorder: '#000', navBg: '#300', accent: '#ff4da6' };

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 60, paddingHorizontal: 20, justifyContent: 'center' },
  searchBar: { padding: 12, borderRadius: 15, color: '#fff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  filterRow: { height: 50, paddingLeft: 15, marginVertical: 10 },
  filterBtn: { paddingHorizontal: 18, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', marginRight: 10, height: 38, justifyContent: 'center' },
  filterText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  logo: { fontSize: 26, fontWeight: '900', letterSpacing: 8 },
  authContainer: { flex: 1, justifyContent: 'center', padding: 30, alignItems: 'center' },
  mainBtn: { backgroundColor: '#ff4da6', padding: 15, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  mainBtnText: { color: '#fff', fontWeight: 'bold', letterSpacing: 1 },
  postCard: { margin: 15, padding: 20, borderRadius: 25, borderWidth: 1.5 },
  categoryBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(255,77,166,0.15)', marginBottom: 6 },
  categoryBadgeText: { color: '#ff4da6', fontSize: 10, fontWeight: '900' },
  eventTitle: { fontSize: 24, fontWeight: 'bold' },
  eventAuthor: { color: '#ff4da6', fontSize: 12, marginBottom: 10, fontWeight: '600' },
  detailBox: { marginBottom: 12 },
  detailText: { color: '#888', fontSize: 13 },
  eventDescription: { fontSize: 16, marginBottom: 20, lineHeight: 24 },
  rsvpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  rsvpBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', marginHorizontal: 4 },
  rsvpBtnText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  commentsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  commentSection: { borderTopWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', paddingTop: 15 },
  commentNode: { marginBottom: 15, paddingLeft: 15, borderLeftWidth: 2 },
  commentAuthor: { fontWeight: 'bold', fontSize: 13, marginBottom: 2 },
  commentActions: { flexDirection: 'row', marginTop: 6 },
  actionText: { fontSize: 10, fontWeight: 'bold' },
  addCommentRow: { flexDirection: 'row', marginTop: 15, alignItems: 'center' },
  commentInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 15 },
  sendBtn: { marginLeft: 10, padding: 12, borderRadius: 15 },
  sendText: { color: '#fff', fontWeight: 'bold' },
  bottomNav: { position: 'absolute', bottom: 0, width: '100%', height: 80, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderTopWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  navItem: { alignItems: 'center' },
  navIcon: { fontSize: 26, color: '#666' },
  navText: { fontSize: 10, fontWeight: '600' },
  fab: { position: 'absolute', bottom: 100, right: 30, width: 65, height: 65, borderRadius: 33, backgroundColor: '#ff4da6', justifyContent: 'center', alignItems: 'center', elevation: 10 },
  fabIcon: { color: '#fff', fontSize: 38, fontWeight: '200' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 30, borderWidth: 1.5, padding: 30 },
  modalTitle: { fontSize: 26, color: '#fff', fontWeight: '900', marginBottom: 30, textAlign: 'center' },
  modalInput: { backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff', padding: 15, borderRadius: 15, marginBottom: 15 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  postBtn: { backgroundColor: '#ff4da6', padding: 15, borderRadius: 15, flex: 1, marginLeft: 20, alignItems: 'center' }
});
