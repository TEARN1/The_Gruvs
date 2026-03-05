import React, { useState, useEffect } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Platform, KeyboardAvoidingView, Modal, RefreshControl
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
const API_URL = (Platform.OS === 'web' && !BASE_URL) ? '/api/events' : `${BASE_URL}/api/events`;

const CURRENT_USER = { id: 'user_01', name: 'Alex', gender: 'male' };

export default function App() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({ title: '', text: '', location: '', dateTime: '', guests: '' });

  const theme = CURRENT_USER.gender === 'male' ? maleGlassTheme : femaleGlassTheme;

  useEffect(() => { fetchPosts(); }, []);

  const fetchPosts = async () => {
    try {
      const res = await fetch(API_URL);
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); setRefreshing(false); }
  };

  const createPost = async () => {
    if (!form.title.trim() || !form.text.trim()) return;

    const payload = {
      title: form.title,
      text: form.text,
      location: form.location,
      dateTime: form.dateTime,
      guests: form.guests,
      author: CURRENT_USER.name,
      author_id: CURRENT_USER.id,
      gender: CURRENT_USER.gender
    };

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setForm({ title: '', text: '', location: '', dateTime: '', guests: '' });
        setModalVisible(false);
        fetchPosts(); // Refresh feed immediately
      }
    } catch (err) { console.warn('Post failed', err); }
  };

  const deletePost = async (id) => {
    try {
      const res = await fetch(`${API_URL}?id=${id}&userId=${CURRENT_USER.id}`, { method: 'DELETE' });
      if (res.ok) fetchPosts();
    } catch (err) { console.warn(err); }
  };

  const renderPost = ({ item }) => {
    const postData = item.content || {};
    const metrics = item.engagement_metrics || { liked_by: [], comments: [] };

    // Day/Night Border Logic: Pink on Black, Black on Pink
    const cardStyle = {
      backgroundColor: 'rgba(255, 100, 200, 0.12)',
      borderColor: CURRENT_USER.gender === 'male' ? '#ff4da6' : '#000',
      borderWidth: 1.5
    };

    return (
      <View style={[styles.postCard, cardStyle]}>
        <View style={styles.postHeader}>
          <Text style={styles.eventTitle}>{postData.title || 'Untitled Event'}</Text>
          {item.owner_id === CURRENT_USER.id && (
            <TouchableOpacity onPress={() => deletePost(item.id)}><Text style={styles.deleteX}>✕</Text></TouchableOpacity>
          )}
        </View>
        <Text style={styles.eventAuthor}>Hosted by {postData.author_name}</Text>

        <View style={styles.detailBox}>
          <Text style={styles.detailText}>📍 {postData.location || 'No location'}</Text>
          <Text style={styles.detailText}>📅 {postData.dateTime || 'No time set'}</Text>
        </View>

        <Text style={styles.eventDescription}>{postData.text}</Text>

        {postData.guests ? (
          <Text style={styles.guestText}>✨ Guests: {postData.guests}</Text>
        ) : null}

        <View style={styles.postFooter}>
          <Text style={styles.footerStat}>❤️ {metrics.liked_by?.length || 0}</Text>
          <Text style={styles.footerStat}>💬 {metrics.comments?.length || 0}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <View style={styles.header}><Text style={[styles.logo, { color: '#ff4da6' }]}>THE GRUVS</Text></View>

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color="#ff4da6" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item.id.toString()}
          renderItem={renderPost}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPosts(); }} tintColor="#ff4da6" />
          }
          ListEmptyComponent={<Text style={styles.empty}>No events added yet. Tap + to start!</Text>}
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Navigation Bar */}
      <View style={[styles.bottomNav, { backgroundColor: theme.card }]}>
        <TouchableOpacity onPress={() => { setLoading(true); fetchPosts(); }} style={styles.navItem}>
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>
      </View>

      {/* Add Event Modal */}
      <Modal animationType="slide" transparent={true} visible={modalVisible}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.modalContent, { backgroundColor: theme.background, borderColor: '#ff4da6' }]}>
            <Text style={styles.modalTitle}>Post New Event</Text>
            <TextInput style={styles.modalInput} placeholder="Event Name" placeholderTextColor="#666" value={form.title} onChangeText={t => setForm({...form, title: t})} />
            <TextInput style={styles.modalInput} placeholder="Venue / Location" placeholderTextColor="#666" value={form.location} onChangeText={t => setForm({...form, location: t})} />
            <TextInput style={styles.modalInput} placeholder="Date & Time" placeholderTextColor="#666" value={form.dateTime} onChangeText={t => setForm({...form, dateTime: t})} />
            <TextInput style={styles.modalInput} placeholder="Featured Guests" placeholderTextColor="#666" value={form.guests} onChangeText={t => setForm({...form, guests: t})} />
            <TextInput style={[styles.modalInput, { height: 100 }]} placeholder="Event Description" placeholderTextColor="#666" multiline value={form.text} onChangeText={t => setForm({...form, text: t})} />

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelAction}><Text style={{color: '#888'}}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.postBtn} onPress={createPost}><Text style={{color: '#fff', fontWeight: 'bold'}}>Post Event</Text></TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const maleGlassTheme = { background: '#000', card: '#111' };
const femaleGlassTheme = { background: '#1a000d', card: '#300' };

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 60, justifyContent: 'center', alignItems: 'center' },
  logo: { fontSize: 28, fontWeight: '900', letterSpacing: 8 },
  postCard: { margin: 15, padding: 20, borderRadius: 25 },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eventTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  deleteX: { color: '#ff4b4b', fontSize: 20, padding: 5 },
  eventAuthor: { color: '#ff4da6', fontSize: 13, marginBottom: 12, fontWeight: '500' },
  detailBox: { marginBottom: 12 },
  detailText: { color: '#ccc', fontSize: 14, marginBottom: 4 },
  eventDescription: { color: '#fff', fontSize: 16, lineHeight: 22, marginBottom: 15 },
  guestText: { color: '#ff4da6', fontSize: 13, fontStyle: 'italic', marginBottom: 10 },
  postFooter: { flexDirection: 'row', borderTopWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', paddingTop: 12 },
  footerStat: { color: '#fff', marginRight: 25, fontSize: 14 },
  fab: { position: 'absolute', bottom: 90, right: 30, width: 64, height: 64, borderRadius: 32, backgroundColor: '#ff4da6', justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#ff4da6', shadowOpacity: 0.4, shadowRadius: 10 },
  fabIcon: { color: '#fff', fontSize: 36, fontWeight: '200' },
  bottomNav: { position: 'absolute', bottom: 0, width: '100%', height: 75, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderTopWidth: 0.5, borderColor: '#222' },
  navItem: { alignItems: 'center' },
  navIcon: { fontSize: 24, marginBottom: 4 },
  navText: { color: '#ff4da6', fontSize: 11, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 30, borderWidth: 1, padding: 25 },
  modalTitle: { fontSize: 24, color: '#fff', fontWeight: 'bold', marginBottom: 25, textAlign: 'center' },
  modalInput: { backgroundColor: 'rgba(255,255,255,0.06)', color: '#fff', padding: 15, borderRadius: 15, marginBottom: 12, fontSize: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 },
  cancelAction: { padding: 10 },
  postBtn: { backgroundColor: '#ff4da6', padding: 15, borderRadius: 15, flex: 1, alignItems: 'center', marginLeft: 20 },
  empty: { color: '#555', textAlign: 'center', marginTop: 120, fontSize: 16 }
});
