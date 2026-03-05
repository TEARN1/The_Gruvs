import React, { useState, useEffect } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Platform, KeyboardAvoidingView
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
const API_URL = (Platform.OS === 'web' && !BASE_URL) ? '/api/events' : `${BASE_URL}/api/events`;

// SESSION SIMULATION (Change 'male' to 'female' to see the Pink Glass theme)
const CURRENT_USER = { id: 'user_01', name: 'Alex', gender: 'male' };

export default function App() {
  const [content, setContent] = useState('');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentingOn, setCommentingOn] = useState(null);
  const [commentText, setCommentText] = useState('');

  const theme = CURRENT_USER.gender === 'male' ? maleGlassTheme : femaleGlassTheme;

  useEffect(() => { fetchPosts(); }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await fetch(API_URL);
      if (res.ok) setPosts(await res.json());
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const createPost = async () => {
    if (!content.trim()) return;
    const newPost = {
      text: content.trim(),
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
      if (res.ok) { fetchPosts(); setContent(''); }
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
        body: JSON.stringify({ id, userId: CURRENT_USER.id, action: 'comment', comment: commentText, author_name: CURRENT_USER.name })
      });
      setCommentText('');
      setCommentingOn(null);
      fetchPosts();
    } catch (err) { console.warn(err); }
  };

  const deletePost = async (id) => {
    try {
      const res = await fetch(`${API_URL}?id=${id}&userId=${CURRENT_USER.id}`, { method: 'DELETE' });
      if (res.ok) setPosts(p => p.filter(x => x.id !== id));
      else alert("You can't delete this post!");
    } catch (err) { console.warn(err); }
  };

  const renderPost = ({ item }) => {
    // BUG FIX: Handle data from the 'content' JSONB and 'engagement_metrics' blob
    const postData = item.content || {};
    const metrics = item.engagement_metrics || { liked_by: [], comments: [] };
    const postTheme = postData.gender === 'male' ? maleGlassTheme : femaleGlassTheme;
    const isLiked = (metrics.liked_by || []).includes(CURRENT_USER.id);

    return (
      <View style={[styles.postCard, { backgroundColor: postTheme.card, borderColor: postTheme.border }]}>
        <View style={styles.postHeader}>
          <View style={[styles.avatar, { backgroundColor: postTheme.accent }]}><Text style={styles.avatarText}>{postData.author_name?.[0]}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.authorName, { color: postTheme.text }]}>{postData.author_name}</Text>
            <Text style={[styles.timestamp, { color: postTheme.subtext }]}>{new Date(item.created_at).toLocaleDateString()}</Text>
          </View>
          {item.owner_id === CURRENT_USER.id && (
            <TouchableOpacity onPress={() => deletePost(item.id)}><Text style={styles.deleteBtn}>✕</Text></TouchableOpacity>
          )}
        </View>

        <Text style={[styles.postText, { color: postTheme.text }]}>{postData.text}</Text>

        <View style={styles.postFooter}>
          <TouchableOpacity onPress={() => handleLike(item.id)} style={styles.action}>
            <Text style={{ color: isLiked ? '#ff4b4b' : postTheme.subtext }}>{isLiked ? '❤️' : '🤍'} {metrics.liked_by?.length || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCommentingOn(item.id)} style={styles.action}>
            <Text style={{ color: postTheme.subtext }}>💬 {metrics.comments?.length || 0}</Text>
          </TouchableOpacity>
        </View>

        {commentingOn === item.id && (
          <View style={styles.commentInputRow}>
            <TextInput style={[styles.smallInput, { color: postTheme.text, borderColor: postTheme.border }]} placeholder="Comment..." value={commentText} onChangeText={setCommentText} />
            <TouchableOpacity onPress={() => addComment(item.id)}><Text style={{ color: postTheme.accent, fontWeight: 'bold' }}>Send</Text></TouchableOpacity>
          </View>
        )}

        {metrics.comments?.map(c => (
          <View key={c.id} style={styles.commentItem}>
            <Text style={[styles.commentText, { color: postTheme.subtext }]}><Text style={{ fontWeight: 'bold', color: postTheme.text }}>{c.author}: </Text>{c.text}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <View style={styles.header}><Text style={[styles.logo, { color: theme.accent }]}>THE GRUVS</Text></View>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          renderItem={renderPost}
          ListHeaderComponent={
            <View style={[styles.inputBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <TextInput placeholder="What's happening?" placeholderTextColor={theme.subtext} style={[styles.mainInput, { color: theme.text }]} multiline value={content} onChangeText={setContent} />
              <TouchableOpacity style={[styles.postBtn, { backgroundColor: theme.accent }]} onPress={createPost}><Text style={styles.postBtnText}>Post</Text></TouchableOpacity>
            </View>
          }
          ListEmptyComponent={loading ? <ActivityIndicator color={theme.accent} /> : null}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const maleGlassTheme = {
  background: '#000',
  card: 'rgba(30, 30, 35, 0.7)',
  border: 'rgba(255, 255, 255, 0.15)',
  text: '#fff',
  subtext: '#aaa',
  accent: '#3b82f6'
};

const femaleGlassTheme = {
  background: '#1a000d',
  card: 'rgba(60, 10, 30, 0.6)',
  border: 'rgba(255, 150, 200, 0.2)',
  text: '#fff',
  subtext: '#ffb3d9',
  accent: '#ff4da6'
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 60, justifyContent: 'center', alignItems: 'center' },
  logo: { fontSize: 24, fontWeight: '900', letterSpacing: 5 },
  inputBox: { margin: 15, padding: 15, borderRadius: 20, borderWidth: 1 },
  mainInput: { fontSize: 18, minHeight: 60, textAlignVertical: 'top' },
  postBtn: { padding: 12, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  postBtnText: { color: '#fff', fontWeight: 'bold' },
  postCard: { margin: 10, padding: 18, borderRadius: 25, borderWidth: 1 },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatarText: { color: '#fff', fontWeight: 'bold' },
  authorName: { fontWeight: 'bold', fontSize: 16 },
  timestamp: { fontSize: 10 },
  deleteBtn: { color: '#ff4b4b', fontSize: 18, padding: 5 },
  postText: { fontSize: 16, marginBottom: 15, lineHeight: 22 },
  postFooter: { flexDirection: 'row', borderTopWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', paddingTop: 12 },
  action: { marginRight: 25 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 15 },
  smallInput: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 8, marginRight: 10, fontSize: 14 },
  commentItem: { marginTop: 8, paddingLeft: 10 },
  commentText: { fontSize: 13 }
});
