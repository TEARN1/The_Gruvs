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
      setLoading(true);
      const res = await fetch(API_URL);
      if (res.ok) setPosts(await res.json());
    } catch (err) { console.error(err); } finally { setLoading(false); setRefreshing(false); }
  };

  const createPost = async () => {
    if (!form.title || !form.text) return;
    const newPost = {
      ...form,
      author: CURRENT_USER.name,
      author_id: CURRENT_USER.id,
      gender: CURRENT_USER.gender
    };
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPost)
      });
      if (res.ok) {
        fetchPosts();
        setModalVisible(false);
        setForm({ title: '', text: '', location: '', dateTime: '', guests: '' });
      }
    } catch (err) { console.warn(err); }
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

    // Day/Night Logic: Pink borders on Black, Black borders on Pink
    const cardStyle = {
      backgroundColor: 'rgba(255, 100, 200, 0.12)', // Glass Pink Effect
      borderColor: CURRENT_USER.gender === 'male' ? '#ff4da6' : '#000',
      borderWidth: 1.5
    };

    return (
      <View style={[styles.postCard, cardStyle]}>
        <View style={styles.postHeader}>
          <Text style={styles.eventTitle}>{postData.title}</Text>
          {item.owner_id === CURRENT_USER.id && (
            <TouchableOpacity onPress={() => deletePost(item.id)}><Text style={styles.deleteX}>✕</Text></TouchableOpacity>
          )}
        </View>
        <Text style={styles.eventAuthor}>By {postData.author_name}</Text>

        <View style={styles.detailBox}>
          <Text style={styles.detailText}>📍 {postData.location}</Text>
          <Text style={styles.detailText}>📅 {postData.dateTime}</Text>
        </View>

        <Text style={styles.eventDescription}>{postData.text}</Text>

        {postData.guests && (
          <Text style={styles.guestText}>✨ Featured: {postData.guests}</Text>
        )}

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

      <FlatList
        data={posts}
        keyExtractor={item => item.id}
        renderItem={renderPost}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPosts(); }} tintColor="#ff4da6" />}
        ListEmptyComponent={!loading && <Text style={styles.empty}>No events found</Text>}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <View style={[styles.bottomNav, { backgroundColor: theme.card }]}>
        <TouchableOpacity onPress={() => fetchPosts()} style={styles.navItem}>
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>
      </View>

      <Modal animationType="slide" transparent={true} visible={modalVisible}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior="padding" style={[styles.modalContent, { backgroundColor: theme.background, borderColor: '#ff4da6' }]}>
            <Text style={styles.modalTitle}>Add Event</Text>
            <TextInput style={styles.modalInput} placeholder="Event Name" placeholderTextColor="#888" value={form.title} onChangeText={t => setForm({...form, title: t})} />
            <TextInput style={styles.modalInput} placeholder="Venue / Location" placeholderTextColor="#888" value={form.location} onChangeText={t => setForm({...form, location: t})} />
            <TextInput style={styles.modalInput} placeholder="Date & Time" placeholderTextColor="#888" value={form.dateTime} onChangeText={t => setForm({...form, dateTime: t})} />
            <TextInput style={styles.modalInput} placeholder="Guests" placeholderTextColor="#888" value={form.guests} onChangeText={t => setForm({...form, guests: t})} />
            <TextInput style={[styles.modalInput, { height: 80 }]} placeholder="Description" placeholderTextColor="#888" multiline value={form.text} onChangeText={t => setForm({...form, text: t})} />

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={{color: '#fff', padding: 10}}>Cancel</Text></TouchableOpacity>
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
  deleteX: { color: '#ff4b4b', fontSize: 20 },
  eventAuthor: { color: '#ff4da6', fontSize: 12, marginBottom: 12 },
  detailBox: { marginBottom: 12 },
  detailText: { color: '#ccc', fontSize: 14, marginBottom: 4 },
  eventDescription: { color: '#fff', fontSize: 16, lineHeight: 22, marginBottom: 15 },
  guestText: { color: '#ff4da6', fontSize: 13, fontStyle: 'italic', marginBottom: 10 },
  postFooter: { flexDirection: 'row', borderTopWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', paddingTop: 10 },
  footerStat: { color: '#fff', marginRight: 20 },
  fab: { position: 'absolute', bottom: 90, right: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: '#ff4da6', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  fabIcon: { color: '#fff', fontSize: 30 },
  bottomNav: { position: 'absolute', bottom: 0, width: '100%', height: 70, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderTopWidth: 0.5, borderColor: '#333' },
  navItem: { alignItems: 'center' },
  navIcon: { fontSize: 24 },
  navText: { color: '#ff4da6', fontSize: 10, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 25, borderWidth: 1, padding: 25 },
  modalTitle: { fontSize: 22, color: '#fff', fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  modalInput: { backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff', padding: 12, borderRadius: 12, marginBottom: 12 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  postBtn: { backgroundColor: '#ff4da6', padding: 12, borderRadius: 12, flex: 1, alignItems: 'center', marginLeft: 20 },
  empty: { color: '#444', textAlign: 'center', marginTop: 100 }
});
