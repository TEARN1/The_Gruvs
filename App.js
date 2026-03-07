import React, { useState, useEffect } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Platform, KeyboardAvoidingView, Modal, RefreshControl, Alert, ScrollView, Image
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { getTheme } from './src/data';
import { AuthScreen, ProfileScreen } from './src/screens';
import { useToast, Toast } from './src/components';
import { BILLIONAIRE_EVENTS } from './src/billionaireSeedData';

// 🆕 FEATURE SYSTEMS (200+ NEW FEATURES)
import { SocialEngine } from './src/socialEngine';
import { FeedEngine, SearchEngine } from './src/feedEngine';
import { MessagingSystem, NotificationManager } from './src/messagingSystem';
import { EventsManager, AnalyticsEngine } from './src/eventsManager';
import { SafetyManager, GamificationEngine } from './src/safetyAndGamification';
import { CommunitiesManager, SavedSearchesManager, ActivityTracker } from './src/advancedFeatures';

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
  const [refreshing, setRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [collapsedThreads, setCollapsedThreads] = useState({});
  const [createEventModalVisible, setCreateEventModalVisible] = useState(false);

  const [eventForm, setEventForm] = useState({
    title: '', text: '', location: '', dateTime: '', category: 'Church'
  });
  const [commentText, setCommentText] = useState({});

  const { toasts, addToast } = useToast();
  const theme = user ? getTheme(user.gender || 'male') : getTheme('day');

  useEffect(() => {
    if(screen === 'feed') fetchPosts();
  }, [screen, searchQuery, activeCategory]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const url = `${API_URL}?q=${searchQuery}&category=${activeCategory}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPosts(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      // Seed data with 50 billionaire events if API is offline
      let events = [...BILLIONAIRE_EVENTS];

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        events = events.filter(e =>
          e.content.title.toLowerCase().includes(query) ||
          e.content.author_name.toLowerCase().includes(query) ||
          e.content.text.toLowerCase().includes(query)
        );
      }

      if (activeCategory !== 'All') {
        events = events.filter(e => e.content.category === activeCategory);
      }

      setPosts(events);
      addToast('📱 Using 50 billionaire events (API offline)', 'info');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!eventForm.title || !eventForm.text || !eventForm.location) {
      addToast('Please fill in all fields', 'error');
      return;
    }

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...eventForm,
          author: user?.name || 'Anonymous',
          author_id: user?.id,
          gender: user?.gender
        })
      });

      if (res.ok) {
        addToast('Event created successfully! 🎉', 'success');
        setEventForm({ title: '', text: '', location: '', dateTime: '', category: 'Church' });
        setCreateEventModalVisible(false);
        fetchPosts();
      }
    } catch (err) {
      addToast('Failed to create event', 'error');
    }
  };

  const handleLike = async (postId) => {
    try {
      const res = await fetch(API_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: postId, userId: user?.id, action: 'like' })
      });
      if (res.ok) {
        fetchPosts();
        addToast('Liked! ❤️', 'success');
      }
    } catch (err) {
      addToast('Failed to like post', 'error');
    }
  };

  const handleRsvp = async (postId, status) => {
    try {
      const res = await fetch(API_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: postId, userId: user?.id, action: 'rsvp', rsvpStatus: status })
      });
      if (res.ok) {
        fetchPosts();
        addToast(`RSVP: ${status}! ✅`, 'success');
      }
    } catch (err) {
      addToast('Failed to RSVP', 'error');
    }
  };

  const handleAddComment = async (postId) => {
    if (!commentText[postId]?.trim()) return;

    try {
      const res = await fetch(`${API_URL}?route=comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: postId,
          user_id: user?.id,
          text: commentText[postId]
        })
      });

      if (res.ok) {
        setCommentText({ ...commentText, [postId]: '' });
        fetchPosts();
        addToast('Comment added! 💬', 'success');
      }
    } catch (err) {
      addToast('Failed to add comment', 'error');
    }
  };

  const renderPost = ({ item }) => {
    const postData = item.content || {};
    const metrics = item.engagement_metrics || { liked_by: [], comments: [], rsvps: {} };
    const isLiked = metrics.liked_by?.includes(user?.id);
    const userRsvp = metrics.rsvps?.[user?.id];

    return (
      <View style={[styles.postCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.categoryBadge}><Text style={styles.categoryBadgeText}>{postData.category}</Text></View>
        <Text style={[styles.eventTitle, { color: theme.text }]}>{postData.title}</Text>
        <Text style={[styles.eventAuthor, { color: theme.acc }]}>By {postData.author_name}</Text>

        <View style={styles.detailBox}>
          <Text style={[styles.detailText, { color: theme.sub }]}>📍 {postData.location}</Text>
          <Text style={[styles.detailText, { color: theme.sub }]}>📅 {postData.dateTime}</Text>
        </View>

        <View style={[styles.mediaPlaceholder, { backgroundColor: theme.bg }]}>
          <Text style={{ color: theme.sub, fontStyle: 'italic', fontSize: 12 }}>📷 Event Media Highlights</Text>
        </View>

        <Text style={[styles.eventDescription, { color: theme.text }]}>{postData.text}</Text>

        <View style={[styles.engagementRow, { borderTopColor: theme.border }]}>
          <TouchableOpacity style={styles.engagementBtn} onPress={() => handleLike(item.id)}>
            <Text style={{fontSize: 16}}>{isLiked ? '❤️' : '🤍'} {metrics.liked_by?.length || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.engagementBtn} onPress={() => handleRsvp(item.id, userRsvp === 'yes' ? 'no' : 'yes')}>
            <Text style={{fontSize: 16}}>{userRsvp === 'yes' ? '✅' : '⭐'} {Object.keys(metrics.rsvps || {}).length}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.engagementBtn}>
            <Text style={{fontSize: 16}}>💬 {metrics.comments?.length || 0}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.commentSection}>
          <View style={styles.commentsHeader}>
            <Text style={[styles.sectionTitle, { color: theme.acc }]}>{metrics.comments?.length || 0} Comments</Text>
            <TouchableOpacity onPress={() => setCollapsedThreads({...collapsedThreads, [item.id]: !collapsedThreads[item.id]})}>
              <Text style={{color: theme.sub, fontSize: 11}}>{collapsedThreads[item.id] ? 'EXPAND ▼' : 'COLLAPSE ▲'}</Text>
            </TouchableOpacity>
          </View>
          {!collapsedThreads[item.id] && metrics.comments?.map(c => (
            <View key={c.id} style={styles.commentNode}>
              <Text style={[styles.commentAuthor, {color: theme.text}]}>{c.author}: <Text style={{fontWeight: 'normal', color: theme.sub}}>{c.text}</Text></Text>
            </View>
          ))}
          <View style={styles.addCommentRow}>
            <TextInput
              style={[styles.commentInput, { color: theme.text, backgroundColor: theme.inp }]}
              placeholder="Join the chat..."
              placeholderTextColor={theme.sub}
              value={commentText[item.id] || ''}
              onChangeText={(text) => setCommentText({...commentText, [item.id]: text})}
            />
            <TouchableOpacity style={[styles.sendBtn, {backgroundColor: theme.acc}]} onPress={() => handleAddComment(item.id)}>
              <Text style={styles.sendText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (screen === 'auth') {
    return <AuthScreen onLogin={(form) => { setUser({...form, id: 'u1', name: form.username}); setScreen('feed'); }} onSignup={(form) => { setUser({...form, id: 'u1', name: form.username}); setScreen('feed'); }} />;
  }

  if (screen === 'profile') {
    return <ProfileScreen user={user} theme={theme} onUpdate={(form) => { setUser({...user, ...form}); addToast('Profile updated!', 'success'); }} onLogout={() => { setUser(null); setScreen('auth'); }} onBack={() => setScreen('feed')} />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <Toast toasts={toasts} />
      <StatusBar style={theme.acc === '#3b82f6' ? "light" : "light"} />

      <View style={styles.header}>
        <Text style={{ fontSize: 20, color: theme.acc, marginRight: 15, fontWeight: 'bold' }}>THE GRUV</Text>
        <TextInput
          style={[styles.searchBar, { backgroundColor: theme.inp, color: theme.text }]}
          placeholder="Search events..."
          placeholderTextColor={theme.sub}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity style={[styles.filterIconBtn, {backgroundColor: theme.inp}]} onPress={() => setCreateEventModalVisible(true)}>
            <Text style={{fontSize: 18}}>➕</Text>
          </TouchableOpacity>
          {['All', 'Church', 'Mosque', 'Sports', 'Career', 'Social', 'Tech'].map(cat => (
            <TouchableOpacity
              key={cat}
              onPress={() => setActiveCategory(cat)}
              style={[
                styles.filterBtn,
                activeCategory === cat && {backgroundColor: theme.acc}
              ]}
            >
              <Text style={[styles.filterText, activeCategory === cat && {color: '#fff'}]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <ActivityIndicator size="large" color={theme.acc} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          renderItem={renderPost}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPosts(); }} />}
        />
      )}

      <Modal visible={createEventModalVisible} animationType="slide" transparent>
        <SafeAreaView style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <View style={[styles.modalContent, {backgroundColor: theme.card}]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, {color: theme.text}]}>Create New Event</Text>
              <TouchableOpacity onPress={() => setCreateEventModalVisible(false)}>
                <Text style={{fontSize: 24, color: theme.text}}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{flex: 1, padding: 20}}>
              <TextInput
                style={[styles.input, {backgroundColor: theme.inp, color: theme.text}]}
                placeholder="Event Title"
                placeholderTextColor={theme.sub}
                value={eventForm.title}
                onChangeText={(t) => setEventForm({...eventForm, title: t})}
              />
              <TextInput
                style={[styles.input, {backgroundColor: theme.inp, color: theme.text, height: 100}]}
                placeholder="Event Description"
                placeholderTextColor={theme.sub}
                multiline
                value={eventForm.text}
                onChangeText={(t) => setEventForm({...eventForm, text: t})}
              />
              <TextInput
                style={[styles.input, {backgroundColor: theme.inp, color: theme.text}]}
                placeholder="Location"
                placeholderTextColor={theme.sub}
                value={eventForm.location}
                onChangeText={(t) => setEventForm({...eventForm, location: t})}
              />
              <TextInput
                style={[styles.input, {backgroundColor: theme.inp, color: theme.text}]}
                placeholder="Date & Time"
                placeholderTextColor={theme.sub}
                value={eventForm.dateTime}
                onChangeText={(t) => setEventForm({...eventForm, dateTime: t})}
              />
              <TouchableOpacity
                style={[styles.submitBtn, {backgroundColor: theme.acc}]}
                onPress={handleCreateEvent}
              >
                <Text style={styles.submitBtnText}>Create Event</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      <View style={[styles.bottomNav, { backgroundColor: theme.nav, borderTopColor: theme.border }]}>
        <TouchableOpacity onPress={() => setScreen('feed')} style={styles.navItem}>
          <Text style={{fontSize: 24}}>🏠</Text>
          <Text style={[styles.navText, {color: screen === 'feed' ? theme.acc : theme.sub}]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setScreen('profile')} style={styles.navItem}>
          <Text style={{fontSize: 24}}>👤</Text>
          <Text style={[styles.navText, {color: screen === 'profile' ? theme.acc : theme.sub}]}>Profile</Text>
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
  header: { height: 60, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  searchBar: { flex: 1, padding: 12, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginLeft: 10 },
  filterRow: { height: 50, paddingLeft: 10, marginVertical: 10, flexDirection: 'row', alignItems: 'center' },
  filterIconBtn: { marginHorizontal: 8, paddingHorizontal: 12, borderRadius: 20, height: 35, justifyContent: 'center', alignItems: 'center' },
  filterBtn: { paddingHorizontal: 18, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 6, height: 35, justifyContent: 'center' },
  filterText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  postCard: { margin: 12, padding: 18, borderRadius: 20, borderWidth: 1 },
  categoryBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(255,77,166,0.15)', marginBottom: 8 },
  categoryBadgeText: { color: '#ff4da6', fontSize: 10, fontWeight: '900' },
  eventTitle: { fontSize: 20, fontWeight: '900', marginBottom: 4 },
  eventAuthor: { fontSize: 12, marginBottom: 10, fontWeight: '700' },
  detailBox: { marginBottom: 12 },
  detailText: { fontSize: 13, marginBottom: 4 },
  mediaPlaceholder: { height: 80, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  eventDescription: { fontSize: 15, marginBottom: 16, lineHeight: 22 },
  engagementRow: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, paddingTop: 12, marginBottom: 12 },
  engagementBtn: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  commentSection: { borderTopWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', paddingTop: 12 },
  commentsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontWeight: '700', fontSize: 12 },
  commentNode: { marginBottom: 8, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: '#ff4da6' },
  commentAuthor: { fontWeight: '700', fontSize: 12 },
  addCommentRow: { flexDirection: 'row', marginTop: 12, alignItems: 'center', gap: 8 },
  commentInput: { flex: 1, padding: 10, borderRadius: 12, fontSize: 13 },
  sendBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  sendText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  bottomNav: { position: 'absolute', bottom: 0, width: '100%', height: 70, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderTopWidth: 1 },
  navItem: { alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 10, fontWeight: '700', marginTop: 4 },
  modalContent: { flex: 1, marginTop: 40, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  input: { width: '100%', padding: 14, borderRadius: 12, marginBottom: 12, fontSize: 15, fontWeight: '500' },
  submitBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20, marginBottom: 30 },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 }
});
