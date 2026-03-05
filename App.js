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

  // Comment Tree State
  const [replyingTo, setReplyingTo] = useState(null); // { postId, commentId }
  const [commentText, setCommentText] = useState('');

  const theme = CURRENT_USER.gender === 'male' ? maleGlassTheme : femaleGlassTheme;

  useEffect(() => { fetchPosts(); }, []);

  const fetchPosts = async () => {
    try {
      const res = await fetch(API_URL);
      if (res.ok) setPosts(await res.json());
    } catch (err) { console.error(err); } finally { setLoading(false); setRefreshing(false); }
  };

  const createPost = async () => {
    if (!form.title.trim() || !form.text.trim()) return;
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, author: CURRENT_USER.name, author_id: CURRENT_USER.id, gender: CURRENT_USER.gender })
      });
      if (res.ok) { setForm({ title: '', text: '', location: '', dateTime: '', guests: '' }); setModalVisible(false); fetchPosts(); }
    } catch (err) { console.warn(err); }
  };

  const submitComment = async (postId, parentId = null) => {
    if (!commentText.trim()) return;
    try {
      await fetch(API_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: postId, userId: CURRENT_USER.id, action: 'comment', comment: commentText, author_name: CURRENT_USER.name, parentId })
      });
      setCommentText('');
      setReplyingTo(null);
      fetchPosts();
    } catch (err) { console.warn(err); }
  };

  const likeComment = async (postId, commentId) => {
    try {
      await fetch(API_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: postId, action: 'like_comment', commentId })
      });
      fetchPosts();
    } catch (err) { console.warn(err); }
  };

  // RECURSIVE TREE RENDERER (Alignment with Tree Implementation Logic)
  const renderComments = (postId, allComments, parentId = null, depth = 0) => {
    return allComments
      .filter(c => c.parentId === parentId)
      .map(comment => (
        <View key={comment.id} style={[styles.commentNode, { marginLeft: depth > 0 ? 15 : 0, borderLeftWidth: depth > 0 ? 1 : 0 }]}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentAuthor}>{comment.author}</Text>
            <Text style={styles.commentTime}>{new Date(comment.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
          </View>
          <Text style={styles.commentBody}>{comment.text}</Text>
          <View style={styles.commentActions}>
            <TouchableOpacity onPress={() => likeComment(postId, comment.id)}>
              <Text style={styles.commentActionText}>👍 {comment.likes || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setReplyingTo({ postId, commentId: comment.id })} style={{marginLeft: 15}}>
              <Text style={styles.commentActionText}>Reply</Text>
            </TouchableOpacity>
          </View>
          {renderComments(postId, allComments, comment.id, depth + 1)}
        </View>
      ));
  };

  const renderPost = ({ item }) => {
    const postData = item.content || {};
    const metrics = item.engagement_metrics || { liked_by: [], comments: [] };
    const cardStyle = {
      backgroundColor: 'rgba(255, 100, 200, 0.12)',
      borderColor: CURRENT_USER.gender === 'male' ? '#ff4da6' : '#000',
      borderWidth: 1.5
    };

    return (
      <View style={[styles.postCard, cardStyle]}>
        <Text style={styles.eventTitle}>{postData.title || 'Untitled Event'}</Text>
        <Text style={styles.eventAuthor}>Hosted by {postData.author_name}</Text>
        <View style={styles.detailBox}>
          <Text style={styles.detailText}>📍 {postData.location || 'No location'}</Text>
          <Text style={styles.detailText}>📅 {postData.dateTime || 'No time set'}</Text>
        </View>
        <Text style={styles.eventDescription}>{postData.text}</Text>

        <View style={styles.commentSection}>
          <Text style={styles.sectionTitle}>Discussion Thread</Text>
          {renderComments(item.id, metrics.comments || [])}

          <View style={styles.addCommentRow}>
            <TextInput
              style={styles.commentInput}
              placeholder={replyingTo?.postId === item.id && replyingTo?.commentId ? "Write a reply..." : "Write a comment..."}
              placeholderTextColor="#888"
              value={replyingTo?.postId === item.id ? commentText : ""}
              onChangeText={setCommentText}
              onFocus={() => setReplyingTo(prev => prev?.commentId ? prev : { postId: item.id, commentId: null })}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={() => submitComment(item.id, replyingTo?.commentId)}>
              <Text style={styles.sendText}>Send</Text>
            </TouchableOpacity>
          </View>
          {replyingTo?.postId === item.id && replyingTo?.commentId && (
            <TouchableOpacity onPress={() => {setReplyingTo(null); setCommentText('');}}><Text style={styles.cancelReply}>Cancel Reply</Text></TouchableOpacity>
          )}
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
        keyExtractor={item => item.id.toString()}
        renderItem={renderPost}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPosts(); }} tintColor="#ff4da6" />}
      />
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}><Text style={styles.fabIcon}>+</Text></TouchableOpacity>
      <View style={[styles.bottomNav, { backgroundColor: theme.card }]}>
        <TouchableOpacity onPress={() => fetchPosts()} style={styles.navItem}>
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>
      </View>

      <Modal animationType="slide" transparent={true} visible={modalVisible}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior="padding" style={[styles.modalContent, { backgroundColor: theme.background, borderColor: '#ff4da6' }]}>
            <Text style={styles.modalTitle}>New Event</Text>
            <TextInput style={styles.modalInput} placeholder="Event Name" placeholderTextColor="#666" value={form.title} onChangeText={t => setForm({...form, title: t})} />
            <TextInput style={styles.modalInput} placeholder="Location" placeholderTextColor="#666" value={form.location} onChangeText={t => setForm({...form, location: t})} />
            <TextInput style={styles.modalInput} placeholder="Time" placeholderTextColor="#666" value={form.dateTime} onChangeText={t => setForm({...form, dateTime: t})} />
            <TextInput style={[styles.modalInput, { height: 80 }]} placeholder="Description" placeholderTextColor="#666" multiline value={form.text} onChangeText={t => setForm({...form, text: t})} />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={{color: '#fff', padding: 10}}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.postBtn} onPress={createPost}><Text style={{color: '#fff', fontWeight: 'bold'}}>Create</Text></TouchableOpacity>
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
  logo: { fontSize: 26, fontWeight: '900', letterSpacing: 8 },
  postCard: { margin: 15, padding: 20, borderRadius: 25 },
  eventTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  eventAuthor: { color: '#ff4da6', fontSize: 12, marginBottom: 10 },
  detailBox: { marginBottom: 10 },
  detailText: { color: '#ccc', fontSize: 13, marginBottom: 2 },
  eventDescription: { color: '#fff', fontSize: 15, lineHeight: 22, marginBottom: 15 },
  commentSection: { borderTopWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', paddingTop: 15 },
  sectionTitle: { color: '#ff4da6', fontSize: 14, fontWeight: 'bold', marginBottom: 12 },
  commentNode: { marginBottom: 12, paddingLeft: 12, borderLeftColor: 'rgba(255,255,255,0.1)' },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  commentAuthor: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  commentTime: { color: '#666', fontSize: 10 },
  commentBody: { color: '#ddd', fontSize: 13, lineHeight: 18 },
  commentActions: { flexDirection: 'row', marginTop: 4 },
  commentActionText: { color: '#ff4da6', fontSize: 11, fontWeight: '600' },
  addCommentRow: { flexDirection: 'row', marginTop: 15, alignItems: 'center' },
  commentInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff', padding: 10, borderRadius: 12, fontSize: 14 },
  sendBtn: { marginLeft: 10, backgroundColor: '#ff4da6', padding: 10, borderRadius: 12 },
  sendText: { color: '#fff', fontWeight: 'bold' },
  cancelReply: { color: '#888', fontSize: 10, marginTop: 5, textAlign: 'right' },
  fab: { position: 'absolute', bottom: 90, right: 25, width: 60, height: 60, borderRadius: 30, backgroundColor: '#ff4da6', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  fabIcon: { color: '#fff', fontSize: 30 },
  bottomNav: { position: 'absolute', bottom: 0, width: '100%', height: 70, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderTopWidth: 0.5, borderColor: '#222' },
  navItem: { alignItems: 'center' },
  navIcon: { fontSize: 24 },
  navText: { color: '#ff4da6', fontSize: 10, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 25, borderWidth: 1, padding: 25 },
  modalTitle: { fontSize: 22, color: '#fff', fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  modalInput: { backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff', padding: 12, borderRadius: 12, marginBottom: 12 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  postBtn: { backgroundColor: '#ff4da6', padding: 12, borderRadius: 12, flex: 1, alignItems: 'center', marginLeft: 20 },
});
