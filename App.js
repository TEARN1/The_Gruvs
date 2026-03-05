import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Platform, KeyboardAvoidingView } from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Logic for API URL
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
const API_URL = (Platform.OS === 'web' && !BASE_URL) ? '/api/events' : `${BASE_URL}/api/events`;

export default function App() {
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('User123'); // Default for now
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

  const deletePost = async (id) => {
    setPosts(prev => prev.filter(p => p.id !== id));
    try {
      await fetch(`${API_URL}?id=${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Delete sync failed');
    }
  };

  const renderPost = ({ item }) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{item.author?.[0].toUpperCase()}</Text></View>
        <View>
          <Text style={styles.authorName}>{item.author || 'Anonymous'}</Text>
          <Text style={styles.timestamp}>{new Date(item.created_at || Date.now()).toLocaleDateString()}</Text>
        </View>
      </View>
      <Text style={styles.postContent}>{item.text}</Text>
      <View style={styles.postFooter}>
        <TouchableOpacity style={styles.footerAction}>
          <Text style={styles.footerActionText}>❤️ Like</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerAction}>
          <Text style={styles.footerActionText}>💬 Comment</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => deletePost(item.id)} style={styles.deleteBtn}>
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.logo}>THE GRUVS</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          renderItem={renderPost}
          contentContainerStyle={styles.feed}
          ListHeaderComponent={
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="What's happening?"
                multiline
                value={content}
                onChangeText={setContent}
              />
              <TouchableOpacity style={styles.postBtn} onPress={createPost}>
                <Text style={styles.postBtnText}>Post</Text>
              </TouchableOpacity>
            </View>
          }
          ListEmptyComponent={
            loading ? <ActivityIndicator size="large" color="#000" style={{ marginTop: 50 }} /> :
            <Text style={styles.emptyText}>No posts yet. Start the conversation!</Text>
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  header: {
    height: 60,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#ddd'
  },
  logo: { fontSize: 24, fontWeight: '900', color: '#1877f2', letterSpacing: 1 },
  feed: { paddingBottom: 20 },
  inputContainer: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderColor: '#ddd'
  },
  input: {
    fontSize: 18,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 10
  },
  postBtn: {
    backgroundColor: '#1877f2',
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center'
  },
  postBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  postCard: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  avatarText: { fontWeight: 'bold', color: '#666' },
  authorName: { fontWeight: 'bold', fontSize: 16 },
  timestamp: { color: '#65676b', fontSize: 12 },
  postContent: { fontSize: 16, lineHeight: 22, color: '#050505', marginBottom: 15 },
  postFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#eee',
    paddingTop: 10,
    justifyContent: 'space-between'
  },
  footerAction: { flexDirection: 'row', alignItems: 'center' },
  footerActionText: { color: '#65676b', fontWeight: '600' },
  deleteBtn: { padding: 5 },
  deleteText: { color: '#ff4444', fontWeight: 'bold', fontSize: 12 },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#65676b', fontSize: 16 }
});
