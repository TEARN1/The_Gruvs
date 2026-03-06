import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Platform, KeyboardAvoidingView, Modal, RefreshControl, ScrollView, Image
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { getTheme, ALL_CATEGORIES } from './src/data';
import { AuthScreen, ProfileScreen } from './src/screens';
import { ConfirmDialog, Toast, useToast } from './src/components';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
const API_URL = (Platform.OS === 'web' && !BASE_URL) ? '/api/events' : `${BASE_URL}/api/events`;

// MASTER TAXONOMY (3000+ Types Ready)
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

  const [eventForm, setEventForm] = useState({ title: '', text: '', location: '', dateTime: '', guests: '', category: 'Social' });
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [userLocation, setUserLocation] = useState(null);

  const { toasts, addToast } = useToast();
  const [confirmDialog, setConfirmDialog] = useState({ visible: false });

  const theme = getTheme(user?.gender || 'day');

  useEffect(() => {
    if (screen === 'feed') {
      requestLocation();
      fetchPosts();
    }
  }, [screen, searchQuery, activeCategory]);

  const requestLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        addToast("Location blocks access to Nearby filter.", "info");
        return;
      }
      let location = await Location.getCurrentPositionAsync({});
      setUserLocation(location.coords);
    } catch (e) {
      console.warn(e);
    }
  };

  const fetchPosts = async () => {
    try {
      let url = `${API_URL}?q=${searchQuery}&category=${activeCategory}`;
      if (activeCategory === 'Near Me' && userLocation) {
        url += `&lat=${userLocation.latitude}&lng=${userLocation.longitude}`;
      }
      const res = await fetch(url);
      if (res.ok) setPosts(await res.json());
    } catch (err) { console.error(err); } finally { setRefreshing(false); }
  };

  const createEvent = async () => {
    if (!eventForm.title.trim() || !eventForm.text.trim()) {
      addToast("Fields missing.", "error");
      return;
    }

    // Optimistic UI updates
    const tempPost = {
      id: 'temp_' + Date.now(),
      content: { ...eventForm, author_name: user.name, author_id: user.id },
      engagement_metrics: { liked_by: [], comments: [], rsvps: {} }
    };
    setPosts(prev => [tempPost, ...prev]);

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...eventForm, author: user.name, author_id: user.id, gender: user.gender, coords: userLocation })
      });
      if (res.ok) {
        setEventForm({ title: '', text: '', location: '', dateTime: '', guests: '', category: 'Social' });
        setModalVisible(false);
        addToast("Event posted!", "success");
        fetchPosts();
      }
    } catch (err) { console.warn(err); addToast("Failed to post event.", "error"); fetchPosts(); }
  };

  const handleLogin = (form) => {
    setUser({ id: 'user_' + Date.now(), name: form.username || 'User', email: form.email, gender: 'male', interests: [] });
    setScreen('feed');
    addToast("Welcome back!", "success");
  };

  const handleSignup = (form) => {
    setUser({ id: 'user_' + Date.now(), name: form.username || 'User', email: form.email, gender: form.gender || 'other', interests: form.interests });
    setScreen('feed');
    addToast("Account created!", "success");
  };

  const handleRSVP = async (postId, status) => {
    if (!user) return addToast("Please sign in to interact", "warning");
    try {
      await fetch(API_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: postId, userId: user.id, action: 'rsvp', rsvpStatus: status })
      });
      fetchPosts();
      addToast(`Status updated to ${status.replace('_', ' ')}`, "success");
    } catch (err) { console.warn(err); addToast("Failed to update status", "error"); }
  };

  const submitComment = async (postId) => {
    if (!user) return addToast("Sign in to comment", "warning");
    if (!commentText.trim()) return;
    try {
      await fetch(API_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: postId, action: 'comment', author_name: user.name, comment: commentText, parentId: replyingTo?.commentId || null })
      });
      setCommentText('');
      setReplyingTo(null);
      fetchPosts();
      addToast("Added to live chat!", "success");
    } catch (err) { console.warn(err); addToast("Failed to post comment", "error"); }
  };

  const renderPost = ({ item }) => {
    const postData = item.content || {};
    const metrics = item.engagement_metrics || { liked_by: [], comments: [], rsvps: {} };
    const userRsvp = user ? metrics.rsvps?.[user.id] : null;

    return (
      <View style={[styles.postCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.categoryBadge}><Text style={styles.categoryBadgeText}>{postData.category || 'Event'}</Text></View>
        <Text style={[styles.eventTitle, { color: theme.text }]}>{postData.title}</Text>
        <Text style={[styles.eventAuthor, { color: theme.acc }]}>By {postData.author_name}</Text>
        <View style={styles.detailBox}>
          <Text style={[styles.detailText, { color: theme.sub }]}>📍 {postData.location}</Text>
          <Text style={[styles.detailText, { color: theme.sub }]}>📅 {postData.dateTime}</Text>
        </View>
        <Text style={[styles.eventDescription, { color: theme.text }]}>{postData.text}</Text>

        <View style={styles.mediaPlaceholder}>
          <Text style={{ color: '#888', fontStyle: 'italic', fontSize: 12 }}>📷 Event Media Highlights</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rsvpScroll}>
          {[
            { id: 'preparing', icon: '📝', label: 'PREPARING' },
            { id: 'going', icon: '🚗', label: 'ON WAY' },
            { id: 'at_event', icon: '📍', label: 'AT EVENT' },
            { id: 'departing', icon: '👋', label: 'LEAVING' },
            { id: 'attended', icon: '⭐', label: 'ATTENDED' }
          ].map(s => (
            <TouchableOpacity key={s.id} style={[styles.rsvpBtn, userRsvp === s.id && { backgroundColor: theme.acc, borderColor: theme.acc }]} onPress={() => handleRSVP(item.id, s.id)}>
              <Text style={[styles.rsvpBtnText, userRsvp === s.id && { color: '#fff' }]}>{s.icon} {s.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.commentSection}>
          <View style={styles.commentsHeader}>
            <Text style={[styles.sectionTitle, { color: theme.acc, fontWeight: 'bold' }]}>{metrics.comments?.length || 0} Comments & Live Chat</Text>
            <TouchableOpacity onPress={() => setCollapsedThreads(!collapsedThreads)}><Text style={{ color: theme.sub, fontSize: 11, fontWeight: 'bold' }}>{collapsedThreads ? 'EXPAND  ▼' : 'COLLAPSE  ▲'}</Text></TouchableOpacity>
          </View>

          {!collapsedThreads && metrics.comments?.map((c, idx) => (
            <View key={c.id || idx} style={[styles.commentNode, { borderColor: theme.border }]}>
              <Text style={[styles.commentAuthor, { color: theme.text }]}>{c.author}</Text>
              <Text style={{ color: theme.sub, fontSize: 13 }}>{c.text}</Text>
            </View>
          ))}

          <View style={styles.addCommentRow}>
            <TextInput style={[styles.commentInput, { color: theme.text, backgroundColor: theme.inp }]} placeholder="Join the chat..." placeholderTextColor={theme.sub} value={replyingTo?.postId === item.id ? commentText : (replyingTo ? '' : commentText)} onChangeText={t => { setCommentText(t); if (!replyingTo || replyingTo.postId !== item.id) setReplyingTo({ postId: item.id }); }} />
            <TouchableOpacity style={[styles.sendBtn, { backgroundColor: theme.acc }]} onPress={() => submitComment(item.id)}><Text style={styles.sendText}>Send</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (screen === 'auth') {
    return (
      <View style={{ flex: 1 }}>
        <AuthScreen onLogin={handleLogin} onSignup={handleSignup} />
        <Toast toasts={toasts} />
        <TouchableOpacity style={{ position: 'absolute', top: 50, right: 30, backgroundColor: 'rgba(0,0,0,0.1)', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 }} onPress={() => { setUser(null); setScreen('feed'); }}>
          <Text style={{ color: '#555', fontWeight: 'bold' }}>ENTER AS VISITOR →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (screen === 'profile') {
    return (
      <View style={{ flex: 1 }}>
        <ProfileScreen user={user} theme={theme} onUpdate={(f) => { setUser({ ...user, ...f }); addToast("Profile updated!", "success"); }} onLogout={() => { setUser(null); setScreen('auth'); }} onBack={() => setScreen('feed')} />
        <Toast toasts={toasts} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <TextInput style={[styles.searchBar, { backgroundColor: theme.inp, color: theme.it, borderColor: theme.border }]} placeholder="Search events..." placeholderTextColor={theme.sub} value={searchQuery} onChangeText={setSearchQuery} />
      </View>

      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            onPress={() => setActiveCategory('Near Me')}
            style={[styles.filterBtn, activeCategory === 'Near Me' && { backgroundColor: theme.acc }]}
          >
            <Text style={[styles.filterText, activeCategory === 'Near Me' && { color: '#fff' }]}>📍 Near Me</Text>
          </TouchableOpacity>
          {ALL_CATEGORIES.slice(0, 15).map(cat => (
            <TouchableOpacity key={cat} onPress={() => setActiveCategory(cat)} style={[styles.filterBtn, activeCategory === cat && { backgroundColor: theme.acc }]}><Text style={[styles.filterText, activeCategory === cat && { color: '#fff' }]}>{cat}</Text></TouchableOpacity>
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

      {user && <TouchableOpacity style={[styles.fab, { backgroundColor: theme.acc }]} onPress={() => setModalVisible(true)}><Text style={styles.fabIcon}>+</Text></TouchableOpacity>}

      <View style={[styles.bottomNav, { backgroundColor: theme.nav, borderTopColor: theme.border }]}>
        <TouchableOpacity onPress={() => setScreen('feed')} style={styles.navItem}><Text style={[styles.navIcon, screen === 'feed' && { color: theme.acc }]}>🏠</Text><Text style={[styles.navText, screen === 'feed' && { color: theme.acc }]}>Home</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => { if (user) setScreen('profile'); else setScreen('auth'); }} style={styles.navItem}><Text style={[styles.navIcon, screen === 'profile' && { color: theme.acc }]}>👤</Text><Text style={[styles.navText, screen === 'profile' && { color: theme.acc }]}>{user ? 'Profile' : 'Sign In'}</Text></TouchableOpacity>
      </View>

      <Modal animationType="slide" transparent visible={modalVisible}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior="padding" style={[styles.modalContent, { backgroundColor: theme.bg, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>POST NEW EVENT</Text>
            <TextInput style={[styles.modalInput, { backgroundColor: theme.inp, color: theme.it }]} placeholder="Event Title *" placeholderTextColor={theme.sub} value={eventForm.title} onChangeText={t => setEventForm({ ...eventForm, title: t })} />
            <TextInput style={[styles.modalInput, { backgroundColor: theme.inp, color: theme.it }]} placeholder="Location / Venue *" placeholderTextColor={theme.sub} value={eventForm.location} onChangeText={t => setEventForm({ ...eventForm, location: t })} />
            <TextInput style={[styles.modalInput, { backgroundColor: theme.inp, color: theme.it }]} placeholder="Date & Time *" placeholderTextColor={theme.sub} value={eventForm.dateTime} onChangeText={t => setEventForm({ ...eventForm, dateTime: t })} />
            <TextInput style={[styles.modalInput, { backgroundColor: theme.inp, color: theme.it, height: 80 }]} placeholder="Description *" placeholderTextColor={theme.sub} multiline value={eventForm.text} onChangeText={t => setEventForm({ ...eventForm, text: t })} />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={{ color: theme.sub, fontWeight: 'bold' }}>CANCEL</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.postBtn, { backgroundColor: theme.acc }]} onPress={createEvent}><Text style={{ color: '#fff', fontWeight: 'bold' }}>SAVE EVENT</Text></TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Toast toasts={toasts} />
      <ConfirmDialog {...confirmDialog} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  authWrapper: { flex: 1, backgroundColor: '#f0f2f5' },
  authCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 25 },
  glassCard: {
    width: '100%',
    padding: 35,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: '#ff4da6', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10
  },
  authLogo: { fontSize: 32, fontWeight: '900', color: '#ff4da6', textAlign: 'center', letterSpacing: 10 },
  authTagline: { fontSize: 10, color: '#666', textAlign: 'center', marginBottom: 30, letterSpacing: 2 },
  glassInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
    fontSize: 16,
    color: '#000'
  },
  genderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  genderBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', marginHorizontal: 5 },
  maleActive: { backgroundColor: '#3b82f6' },
  femaleActive: { backgroundColor: '#ff4da6' },
  genderText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  glowBtn: {
    backgroundColor: '#ff4da6',
    padding: 18,
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: '#ff4da6',
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 12
  },
  glowBtnText: { color: '#fff', fontWeight: '900', letterSpacing: 2 },
  switchBtn: { marginTop: 20, alignItems: 'center' },
  switchText: { fontSize: 10, color: '#888', fontWeight: 'bold' },
  header: { height: 60, paddingHorizontal: 20, justifyContent: 'center' },
  searchBar: { padding: 12, borderRadius: 15, borderWidth: 1 },
  filterRow: { height: 50, paddingLeft: 15, marginVertical: 10 },
  filterBtn: { paddingHorizontal: 16, borderRadius: 20, backgroundColor: 'rgba(128,128,128,0.1)', marginRight: 10, height: 38, justifyContent: 'center' },
  filterText: { color: '#888', fontSize: 13, fontWeight: 'bold' },
  postCard: { margin: 15, padding: 20, borderRadius: 25, borderWidth: 1.5, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  categoryBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(128,128,128,0.15)', marginBottom: 10 },
  categoryBadgeText: { color: '#888', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  eventTitle: { fontSize: 24, fontWeight: '900', marginBottom: 4 },
  eventAuthor: { fontSize: 13, marginBottom: 12, fontWeight: '700' },
  detailBox: { marginBottom: 15, backgroundColor: 'rgba(128,128,128,0.05)', padding: 12, borderRadius: 12 },
  detailText: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  eventDescription: { fontSize: 16, marginBottom: 20, lineHeight: 24 },
  mediaPlaceholder: { height: 120, backgroundColor: 'rgba(128,128,128,0.1)', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(128,128,128,0.2)', borderStyle: 'dashed' },
  rsvpScroll: { flexDirection: 'row', marginBottom: 20 },
  rsvpBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(128,128,128,0.08)', alignItems: 'center', marginRight: 8, borderWidth: 1, borderColor: 'transparent' },
  rsvpBtnText: { color: '#888', fontSize: 11, fontWeight: '800' },
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
