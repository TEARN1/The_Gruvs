import React, { useState, useEffect } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Platform, KeyboardAvoidingView, useColorScheme
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Logic for API URL
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
const API_URL = (Platform.OS === 'web' && !BASE_URL) ? '/api/events' : `${BASE_URL}/api/events`;

const CATEGORIES = ['General', 'Music', 'Tech', 'Art', 'Sports'];

export default function App() {
  const colorScheme = useColorScheme(); // 'light' or 'dark'
  const isDark = colorScheme === 'dark';
  const theme = isDark ? darkTheme : lightTheme;

  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('User123');
  const [selectedCategory, setSelectedCategory] = useState('General');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await fetch(API_URL);
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } catch (err) {
      console.warn('Failed to fetch posts', err);
    } finally {
      setLoading(false);
    }
  };

  const createPost = async () => {
    if (!content.trim()) return;

    const newPost = {
      id: Date.now().toString(),
      text: content.trim(),
      author: author,
      category: selectedCategory,
      going_count: 0,
      created_at: new Date().toISOString()
    };

    setPosts(prev => [newPost, ...prev]);
    setContent('');

    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPost)
      });
    } catch (err) {
      console.warn('Sync failed');
    }
  };

  const toggleRSVP = async (id, isGoing) => {
    // Optimistic UI update
    setPosts(prev => prev.map(p =>
      p.id === id ? { ...p, going_count: (p.going_count || 0) + (isGoing ? -1 : 1), user_going: !isGoing } : p
    ));

    try {
      await fetch(API_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, increment: !isGoing })
      });
    } catch (err) {
      console.warn('RSVP failed');
    }
  };

  const deletePost = async (id) => {
    setPosts(prev => prev.filter(p => p.id !== id));
    try {
      await fetch(`${API_URL}?id=${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Delete sync failed');
    }
  };

  const renderPost = ({ item }) => (
    <View style={[styles.postCard, { backgroundColor: theme.card }]}>
      <View style={styles.postHeader}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{item.author?.[0].toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.authorName, { color: theme.text }]}>{item.author || 'Anonymous'}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.timestamp}>{new Date(item.created_at || Date.now()).toLocaleDateString()}</Text>
            <View style={styles.tag}><Text style={styles.tagText}>{item.category || 'General'}</Text></View>
          </View>
        </View>
      </View>
      <Text style={[styles.postContent, { color: theme.text }]}>{item.text}</Text>

      <View style={styles.postFooter}>
        <TouchableOpacity
          style={[styles.rsvpBtn, item.user_going && styles.rsvpBtnActive]}
          onPress={() => toggleRSVP(item.id, item.user_going)}
        >
          <Text style={[styles.rsvpBtnText, item.user_going && styles.rsvpBtnTextActive]}>
            {item.user_going ? '✅ Going' : '⭐ RSVP'} ({item.going_count || 0})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => deletePost(item.id)} style={styles.deleteBtn}>
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Text style={styles.logo}>THE GRUVS</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          renderItem={renderPost}
          contentContainerStyle={styles.feed}
          ListHeaderComponent={
            <View style={[styles.inputContainer, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
              <View style={styles.categoryRow}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setSelectedCategory(cat)}
                    style={[styles.catTab, selectedCategory === cat && styles.catTabActive]}
                  >
                    <Text style={[styles.catTabText, selectedCategory === cat && styles.catTabTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Post an event..."
                placeholderTextColor={isDark ? '#888' : '#aaa'}
                multiline
                value={content}
                onChangeText={setContent}
              />
              <TouchableOpacity style={styles.postBtn} onPress={createPost}>
                <Text style={styles.postBtnText}>Post Event</Text>
              </TouchableOpacity>
            </View>
          }
          ListEmptyComponent={
            loading ? <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 50 }} /> :
            <Text style={styles.emptyText}>No events yet. Host the first one!</Text>
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const lightTheme = {
  background: '#f9fafb',
  card: '#ffffff',
  text: '#111827',
  border: '#e5e7eb'
};

const darkTheme = {
  background: '#0f172a',
  card: '#1e293b',
  text: '#f8fafc',
  border: '#334155'
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 60, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1 },
  logo: { fontSize: 22, fontWeight: '900', color: '#6366f1', letterSpacing: 2 },
  feed: { paddingBottom: 20 },
  inputContainer: { padding: 15, marginBottom: 10, borderBottomWidth: 1 },
  categoryRow: { flexDirection: 'row', marginBottom: 15, flexWrap: 'wrap' },
  catTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, backgroundColor: '#eee', marginRight: 8, marginBottom: 5 },
  catTabActive: { backgroundColor: '#6366f1' },
  catTabText: { fontSize: 12, color: '#666' },
  catTabTextActive: { color: '#fff', fontWeight: 'bold' },
  input: { fontSize: 18, minHeight: 60, textAlignVertical: 'top', marginBottom: 10 },
  postBtn: { backgroundColor: '#6366f1', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  postBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  postCard: { padding: 15, marginBottom: 10, marginHorizontal: 10, borderRadius: 12, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#6366f133', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatarText: { fontWeight: 'bold', color: '#6366f1' },
  authorName: { fontWeight: 'bold', fontSize: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  timestamp: { color: '#64748b', fontSize: 12, marginRight: 10 },
  tag: { backgroundColor: '#6366f111', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagText: { fontSize: 10, color: '#6366f1', fontWeight: 'bold' },
  postContent: { fontSize: 16, lineHeight: 24, marginBottom: 15 },
  postFooter: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#64748b22', paddingTop: 12, justifyContent: 'space-between', alignItems: 'center' },
  rsvpBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  rsvpBtnActive: { backgroundColor: '#10b981' },
  rsvpBtnText: { color: '#475569', fontWeight: 'bold' },
  rsvpBtnTextActive: { color: '#fff' },
  deleteBtn: { padding: 5 },
  deleteText: { color: '#ef4444', fontSize: 12, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#64748b', fontSize: 16 }
});
