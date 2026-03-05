import React, { useState, useEffect } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Platform, KeyboardAvoidingView, ScrollView
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
const API_URL = (Platform.OS === 'web' && !BASE_URL) ? '/api/events' : `${BASE_URL}/api/events`;

// Simulate User Session
const CURRENT_USER = { id: 'u1', name: 'Alex', gender: 'male' }; // Change to 'female' to see Pink Glass theme

export default function App() {
  const [content, setContent] = useState('');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCommentPost, setActiveCommentPost] = useState(null);
  const [commentText, setCommentText] = useState('');

  const theme = CURRENT_USER.gender === 'male' ? maleGlassTheme : femaleGlassTheme;

  useEffect(() => { fetchPosts(); }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await fetch(API_URL);
      if (res.ok) setPosts(await res.json());
    } catch (err) { console.warn(err); } finally { setLoading(false); }
  };

  const createPost = async () => {
    if (!content.trim()) return;
    const newPost = {
      text: content.trim(),
      author: CURRENT_USER.name,
      author_id: CURRENT_USER.id,
      gender: CURRENT_USER.gender,
      created_at: new Date().toISOString()
    };
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPost)
      });
      if (res.ok) fetchPosts();
      setContent('');
    } catch (err) { console.warn(err); }
  };

  const handleLike = async (id) => {
    try {
      await fetch(API_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, userId: CURRENT_USER.id, action: 'like' })
      });
      fetchPosts();
    } catch (err) { console.warn(err); }
  };

  const addComment = async (id) => {
    if (!commentText.trim()) return;
    try {
      await fetch(API_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'comment', comment: commentText, author: CURRENT_USER.name })
      });
      setCommentText('');
      setActiveCommentPost(null);
      fetchPosts();
    } catch (err) { console.warn(err); }
  };

  const deletePost = async (id) => {
    try {
      const res = await fetch(`${API_URL}?id=${id}&userId=${CURRENT_USER.id}`, { method: 'DELETE' });
      if (res.ok) setPosts(p => p.filter(x => x.id !== id));
      else alert("You can't delete someone else's post!");
    } catch (err) { console.warn(err); }
  };

  const renderPost = ({ item }) => {
    const postTheme = item.gender === 'male' ? maleGlassTheme : femaleGlassTheme;
    const hasLiked = (item.likes || []).includes(CURRENT_USER.id);

    return (
      <View style={[styles.postCard, { backgroundColor: postTheme.card, borderColor: postTheme.border }]}>
        <View style={styles.postHeader}>
          <View style={[styles.avatar, { backgroundColor: postTheme.accent }]}><Text style={styles.avatarText}>{item.author?.[0]}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.authorName, { color: postTheme.text }]}>{item.author}</Text>
            <Text style={[styles.timestamp, { color: postTheme.subtext }]}>{new Date(item.created_at).toLocaleDateString()}</Text>
          </View>
          {item.author_id === CURRENT_USER.id && (
            <TouchableOpacity onPress={() => deletePost(item.id)}><Text style={styles.deleteX}>✕</Text></TouchableOpacity>
          )}
        </View>

        <Text style={[styles.postContent, { color: postTheme.text }]}>{item.text}</Text>

        <View style={styles.footer}>
          <TouchableOpacity onPress={() => handleLike(item.id)} style={styles.action}>
            <Text style={{ color: hasLiked ? '#ff4444' : postTheme.subtext }}>{hasLiked ? '❤️' : '🤍'} {item.likes?.length || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveCommentPost(item.id)} style={styles.action}>
            <Text style={{ color: postTheme.subtext }}>💬 {item.comments?.length || 0}</Text>
          </TouchableOpacity>
        </View>

        {activeCommentPost === item.id && (
          <View style={styles.commentInputRow}>
            <TextInput
              style={[styles.smallInput, { color: postTheme.text, borderColor: postTheme.border }]}
              placeholder="Write a comment..."
              value={commentText}
              onChangeText={setCommentText}
            />
            <TouchableOpacity onPress={() => addComment(item.id)}><Text style={{ color: postTheme.accent }}>Send</Text></TouchableOpacity>
          </View>
        )}

        {item.comments?.length > 0 && (
          <View style={styles.commentsList}>
            {item.comments.slice(0, 2).map(c => (
              <Text key={c.id} style={[styles.commentText, { color: postTheme.subtext }]}>
                <Text style={{ fontWeight: 'bold' }}>{c.author}:</Text> {c.text}
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <View style={styles.topHeader}><Text style={[styles.logo, { color: theme.accent }]}>THE GRUVS</Text></View>

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          renderItem={renderPost}
          ListHeaderComponent={
            <View style={[styles.inputBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <TextInput
                placeholder="What's on your mind?"
                placeholderTextColor={theme.subtext}
                style={[styles.mainInput, { color: theme.text }]}
                multiline
                value={content}
                onChangeText={setContent}
              />
              <TouchableOpacity style={[styles.postBtn, { backgroundColor: theme.accent }]} onPress={createPost}>
                <Text style={styles.postBtnText}>Post</Text>
              </TouchableOpacity>
            </View>
          }
          ListEmptyComponent={loading && <ActivityIndicator color={theme.accent} />}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const maleGlassTheme = {
  background: '#000000',
  card: 'rgba(25, 25, 25, 0.8)',
  border: 'rgba(100, 100, 255, 0.2)',
  text: '#ffffff',
  subtext: '#888',
  accent: '#3b82f6'
};

const femaleGlassTheme = {
  background: '#1a000d',
  card: 'rgba(50, 0, 25, 0.7)',
  border: 'rgba(255, 100, 200, 0.3)',
  text: '#ffffff',
  subtext: '#ffb3d9',
  accent: '#ff4da6'
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  topHeader: { height: 60, justifyContent: 'center', alignItems: 'center' },
  logo: { fontSize: 24, fontWeight: '900', letterSpacing: 4 },
  inputBox: { margin: 15, padding: 15, borderRadius: 20, borderWidth: 1 },
  mainInput: { fontSize: 18, minHeight: 60, textAlignVertical: 'top' },
  postBtn: { padding: 10, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  postBtnText: { color: '#fff', fontWeight: 'bold' },
  postCard: { margin: 10, padding: 15, borderRadius: 25, borderWidth: 1 },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: { width: 35, height: 35, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatarText: { color: '#fff', fontWeight: 'bold' },
  authorName: { fontWeight: 'bold' },
  timestamp: { fontSize: 10 },
  deleteX: { color: '#ff4444', fontSize: 18, padding: 5 },
  postContent: { fontSize: 16, marginBottom: 15, lineHeight: 22 },
  footer: { flexDirection: 'row', borderTopWidth: 0.5, borderColor: '#444', paddingTop: 10 },
  action: { marginRight: 20 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  smallInput: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 5, marginRight: 10, fontSize: 12 },
  commentsList: { marginTop: 10, borderTopWidth: 0.2, borderColor: '#555', paddingTop: 5 },
  commentText: { fontSize: 12, marginBottom: 2 }
});
