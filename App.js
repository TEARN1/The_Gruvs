import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Platform, KeyboardAvoidingView, Modal, RefreshControl,
  ScrollView, Animated, Share, ActivityIndicator, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
const API_URL = (Platform.OS === 'web' && !BASE_URL) ? '/api/events' : `${BASE_URL}/api/events`;
const CATS = ['All', 'Workshop', 'Networking', 'Party', 'Conference', 'Meetup'];
const GENDERS = [
  { value: 'male', label: 'Male 👨', accent: '#3b82f6' },
  { value: 'female', label: 'Female 👩', accent: '#ff4da6' },
  { value: 'other', label: 'Other 🌈', accent: '#8855ff' },
  { value: 'prefer_not', label: 'Prefer Not 🤐', accent: '#777' },
];
const THEMES = {
  day: { bg: '#f9fafb', card: '#fff', text: '#111', sub: '#666', border: '#ddd', nav: '#fff', acc: '#ff4da6', inp: '#eee', it: '#111' },
  male: { bg: '#050510', card: '#12122a', text: '#fff', sub: '#aaa', border: '#3b82f6', nav: '#0a0a1a', acc: '#3b82f6', inp: '#1e1e3a', it: '#fff' },
  female: { bg: '#120008', card: '#2a001a', text: '#fff', sub: '#ffb3d9', border: '#ff4da6', nav: '#1a000d', acc: '#ff4da6', inp: '#200010', it: '#fff' },
  other: { bg: '#080013', card: '#140a2d', text: '#fff', sub: '#c4b3ff', border: '#8855ff', nav: '#0d0025', acc: '#8855ff', inp: '#1a1035', it: '#fff' },
  prefer_not: { bg: '#111', card: '#222', text: '#eee', sub: '#888', border: '#555', nav: '#1a1a1a', acc: '#777', inp: '#2a2a2a', it: '#eee' },
};
const getTheme = (g) => THEMES[g] || THEMES.day;

// ─── Toast System ───────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((msg, type = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);
  return { toasts, addToast };
}
function Toast({ toasts }) {
  const colors = { success: '#10b981', error: '#ef4444', info: '#3b82f6', warning: '#f59e0b' };
  return (
    <View style={{ position: 'absolute', top: 60, right: 15, zIndex: 9999 }}>
      {toasts.map(t => (
        <View key={t.id} style={[styles.toast, { backgroundColor: colors[t.type] || colors.success }]}>
          <Text style={styles.toastText}>{t.msg}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Confirm Dialog ─────────────────────────────────────────────────────────
function ConfirmDialog({ visible, title, message, onConfirm, onCancel, danger }) {
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.dlgOverlay}>
        <View style={styles.dlgBox}>
          <Text style={styles.dlgTitle}>{title}</Text>
          <Text style={styles.dlgMsg}>{message}</Text>
          <View style={styles.dlgRow}>
            <TouchableOpacity style={styles.dlgCancel} onPress={onCancel}><Text style={{ color: '#666', fontWeight: '600' }}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.dlgConfirm, danger && { backgroundColor: '#ef4444' }]} onPress={onConfirm}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Report Modal ───────────────────────────────────────────────────────────
const REASONS = ['Spam', 'Offensive language', 'Harassment', 'False information', 'Other'];
function ReportModal({ visible, onSubmit, onCancel }) {
  const [reason, setReason] = useState('');
  return (
    <Modal transparent animationType="slide" visible={visible}>
      <View style={styles.dlgOverlay}>
        <View style={styles.dlgBox}>
          <Text style={styles.dlgTitle}>🚩 Report Content</Text>
          {REASONS.map(r => (
            <TouchableOpacity key={r} style={[styles.reasonBtn, reason === r && { backgroundColor: '#ff4444', borderColor: '#ff4444' }]} onPress={() => setReason(r)}>
              <Text style={{ color: reason === r ? '#fff' : '#333', fontWeight: '600' }}>{r}</Text>
            </TouchableOpacity>
          ))}
          <View style={[styles.dlgRow, { marginTop: 15 }]}>
            <TouchableOpacity style={styles.dlgCancel} onPress={onCancel}><Text style={{ color: '#666' }}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.dlgConfirm, { backgroundColor: '#ff4444' }]} onPress={() => { if (reason) { onSubmit(reason); setReason(''); } }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Submit Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState('auth');
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '', confirm: '', gender: '' });
  const [theme, setTheme] = useState(getTheme('day'));
  const [eventForm, setEventForm] = useState({ title: '', text: '', location: '', dateTime: '', guests: '', category: 'Meetup', eventType: 'physical', imageUrl: '', rsvpEnabled: true });
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [commentInputs, setCommentInputs] = useState({});
  const [editingComment, setEditingComment] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [collapsedThreads, setCollapsedThreads] = useState(false);
  const [profileEdit, setProfileEdit] = useState(false);
  const [profileForm, setProfileForm] = useState({});
  const [menuOpen, setMenuOpen] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const { toasts, addToast } = useToast();
  const searchTimer = useRef(null);

  useEffect(() => { if (screen === 'feed') fetchPosts(); }, [screen, activeCategory]);
  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (screen === 'feed') searchTimer.current = setTimeout(fetchPosts, 350);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  const fetchPosts = async () => {
    try {
      const r = await fetch(`${API_URL}?q=${encodeURIComponent(search)}&category=${activeCategory}`);
      if (r.ok) setPosts(await r.json());
    } catch (e) { console.error(e); } finally { setRefreshing(false); }
  };

  // ─── Auth ────────────────────────────────────────────────────────────────
  const handleLogin = () => {
    if (!authForm.username.trim() || !authForm.password.trim()) return addToast('Username and password required', 'error');
    const u = { id: `u_${Date.now()}`, name: authForm.username.trim(), gender: authForm.gender || 'male', email: authForm.email, created_at: new Date().toISOString() };
    setUser(u); setTheme(getTheme(u.gender));
    setAuthForm({ username: '', email: '', password: '', confirm: '', gender: '' });
    setScreen('feed'); addToast(`Welcome back, ${u.name}! 👋`);
  };
  const handleSignup = () => {
    if (!authForm.username.trim()) return addToast('Username is required', 'error');
    if (!authForm.email.includes('@')) return addToast('Valid email is required', 'error');
    if (authForm.password.length < 8) return addToast('Password must be 8+ characters', 'error');
    if (authForm.password !== authForm.confirm) return addToast('Passwords do not match', 'error');
    if (!authForm.gender) return addToast('Please select a gender', 'error');
    const u = { id: `u_${Date.now()}`, name: authForm.username.trim(), gender: authForm.gender, email: authForm.email, bio: '', created_at: new Date().toISOString() };
    setUser(u); setTheme(getTheme(u.gender));
    setAuthForm({ username: '', email: '', password: '', confirm: '', gender: '' });
    setScreen('feed'); addToast(`Welcome to The Gruv, ${u.name}! 🎉`, 'success');
  };
  const handleLogout = () => { setUser(null); setTheme(getTheme('day')); setPosts([]); setScreen('auth'); };

  // ─── Events ──────────────────────────────────────────────────────────────
  const submitEvent = async () => {
    if (!eventForm.title.trim() || !eventForm.text.trim()) return addToast('Title and description required', 'error');
    setLoading(true);
    try {
      const method = editingEvent ? 'PUT' : 'POST';
      const body = editingEvent
        ? { id: editingEvent.id, userId: user.id, ...eventForm }
        : { ...eventForm, author: user.name, author_id: user.id, gender: user.gender };
      const r = await fetch(API_URL, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (r.ok) {
        setModalVisible(false); setEditingEvent(null);
        setEventForm({ title: '', text: '', location: '', dateTime: '', guests: '', category: 'Meetup', eventType: 'physical', imageUrl: '', rsvpEnabled: true });
        fetchPosts(); addToast(editingEvent ? '✏️ Event updated!' : '🎉 Event posted!');
      } else addToast('Failed to save event', 'error');
    } catch (e) { addToast('Network error', 'error'); } finally { setLoading(false); }
  };
  const deleteEvent = async (id) => {
    try {
      const r = await fetch(`${API_URL}?id=${id}&userId=${user.id}`, { method: 'DELETE' });
      if (r.ok) { fetchPosts(); addToast('Event deleted', 'info'); } else addToast('Delete failed', 'error');
    } catch (e) { addToast('Network error', 'error'); }
  };
  const handleLike = async (id) => {
    try {
      await fetch(API_URL, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, userId: user.id, action: 'like' }) });
      fetchPosts();
    } catch (e) { console.warn(e); }
  };
  const handleRSVP = async (id, status) => {
    try {
      await fetch(API_URL, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, userId: user.id, action: 'rsvp', rsvpStatus: status }) });
      fetchPosts();
    } catch (e) { console.warn(e); }
  };
  const submitReport = async (targetId, reason) => {
    try {
      await fetch(API_URL, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: targetId, userId: user.id, action: 'report', reason }) });
      addToast('Report submitted, thank you', 'info'); setReportTarget(null);
    } catch (e) { addToast('Could not submit report', 'error'); }
  };

  // ─── Comments ────────────────────────────────────────────────────────────
  const submitComment = async (postId, parentId = null) => {
    const text = (commentInputs[postId] || '').trim(); if (!text) return;
    try {
      await fetch(API_URL, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: postId, userId: user.id, action: 'comment', comment: text, author_name: user.name, parentId }) });
      setCommentInputs(p => ({ ...p, [postId]: '' })); setReplyingTo(null); fetchPosts();
    } catch (e) { addToast('Could not post comment', 'error'); }
  };
  const likeComment = async (postId, commentId) => {
    try {
      await fetch(API_URL, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: postId, userId: user.id, action: 'like_comment', commentId }) });
      fetchPosts();
    } catch (e) { console.warn(e); }
  };
  const deleteComment = async (postId, commentId) => {
    try {
      await fetch(API_URL, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: postId, userId: user.id, action: 'delete_comment', commentId }) });
      fetchPosts(); addToast('Comment deleted', 'info');
    } catch (e) { addToast('Could not delete comment', 'error'); }
  };

  const shareEvent = async (item) => {
    try { await Share.share({ message: `Check out "${item.content?.title}" on The Gruv!`, url: `https://the-gruvs.vercel.app` }); }
    catch (e) { addToast('Link copied!'); }
  };

  // ─── Render Comments ─────────────────────────────────────────────────────
  const renderComments = (postId, all, parentId = null, depth = 0) => {
    if (collapsedThreads && depth > 0) return null;
    return all.filter(c => c.parentId === parentId).map(c => (
      <View key={c.id} style={[styles.commentNode, { marginLeft: depth > 0 ? 18 : 0, borderLeftColor: theme.acc }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            {editingComment?.id === c.id
              ? <TextInput style={[styles.commentInput, { color: theme.it, marginBottom: 6 }]} value={editingComment.text} onChangeText={t => setEditingComment(p => ({ ...p, text: t }))} autoFocus />
              : <Text style={[styles.commentAuthor, { color: theme.text }]}>{c.author}: <Text style={{ fontWeight: 'normal', color: theme.sub }}>{c.text}</Text></Text>
            }
          </View>
          <TouchableOpacity onPress={() => setMenuOpen(menuOpen === `c_${c.id}` ? null : `c_${c.id}`)} style={{ paddingLeft: 8 }}>
            <Text style={{ color: theme.sub, fontSize: 18 }}>⋯</Text>
          </TouchableOpacity>
        </View>
        {menuOpen === `c_${c.id}` && (
          <View style={[styles.dropMenu, { backgroundColor: theme.card }]}>
            {c.author === user.name && editingComment?.id !== c.id && (
              <TouchableOpacity style={styles.dropItem} onPress={() => { setEditingComment({ id: c.id, postId, text: c.text }); setMenuOpen(null); }}>
                <Text style={{ color: theme.text }}>✏️ Edit</Text>
              </TouchableOpacity>
            )}
            {editingComment?.id === c.id && (
              <>
                <TouchableOpacity style={styles.dropItem} onPress={async () => {
                  await fetch(API_URL, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: postId, userId: user.id, action: 'edit_comment', commentId: c.id, text: editingComment.text }) });
                  setEditingComment(null); fetchPosts(); addToast('Comment updated');
                }}><Text style={{ color: '#10b981' }}>✅ Save</Text></TouchableOpacity>
                <TouchableOpacity style={styles.dropItem} onPress={() => setEditingComment(null)}><Text style={{ color: '#888' }}>Cancel</Text></TouchableOpacity>
              </>
            )}
            {c.author === user.name && (
              <TouchableOpacity style={styles.dropItem} onPress={() => { setMenuOpen(null); setConfirm({ title: 'Delete comment?', message: 'This cannot be undone.', danger: true, onConfirm: () => { deleteComment(postId, c.id); setConfirm(null); } }); }}>
                <Text style={{ color: '#ef4444' }}>🗑️ Delete</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.dropItem} onPress={() => { setMenuOpen(null); setReportTarget({ id: postId, commentId: c.id }); }}>
              <Text style={{ color: '#f59e0b' }}>🚩 Report</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.commentActions}>
          <TouchableOpacity onPress={() => likeComment(postId, c.id)}><Text style={[styles.actionText, { color: theme.acc }]}>❤️ {c.likes || 0}</Text></TouchableOpacity>
          <TouchableOpacity style={{ marginLeft: 14 }} onPress={() => setReplyingTo({ postId, commentId: c.id })}><Text style={[styles.actionText, { color: theme.acc }]}>💬 Reply</Text></TouchableOpacity>
        </View>
        {renderComments(postId, all, c.id, depth + 1)}
      </View>
    ));
  };

  // ─── Render Event Card ───────────────────────────────────────────────────
  const renderPost = ({ item }) => {
    const d = item.content || {};
    const m = item.engagement_metrics || { liked_by: [], comments: [], rsvps: {} };
    const isLiked = (m.liked_by || []).includes(user.id);
    const likes = (m.liked_by || []).length;
    const rsvp = m.rsvps?.[user.id];
    const isOwner = item.owner_id === user.id || d.author_name === user.name;
    const rsvpLabels = { going: '✓ GOING', maybe: '? MAYBE', not_going: '✗ NOT GOING' };

    return (
      <View style={[styles.postCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eventTitle, { color: theme.text }]}>{d.title}</Text>
            <Text style={[styles.eventAuthor, { color: theme.acc }]}>By {d.author_name} · {d.category}</Text>
          </View>
          <TouchableOpacity onPress={() => setMenuOpen(menuOpen === item.id ? null : item.id)} style={{ padding: 8 }}>
            <Text style={{ color: theme.sub, fontSize: 20 }}>⋯</Text>
          </TouchableOpacity>
        </View>

        {/* Three-dot popup */}
        {menuOpen === item.id && (
          <View style={[styles.dropMenu, { backgroundColor: theme.card, right: 0 }]}>
            <TouchableOpacity style={styles.dropItem} onPress={() => { shareEvent(item); setMenuOpen(null); }}><Text style={{ color: theme.text }}>📤 Share</Text></TouchableOpacity>
            {isOwner && (
              <>
                <TouchableOpacity style={styles.dropItem} onPress={() => {
                  setEditingEvent(item);
                  setEventForm({ title: d.title, text: d.text, location: d.location, dateTime: d.dateTime, guests: d.guests || '', category: d.category, eventType: d.eventType || 'physical', imageUrl: d.imageUrl || '', rsvpEnabled: m.rsvpEnabled !== false });
                  setModalVisible(true); setMenuOpen(null);
                }}><Text style={{ color: theme.text }}>✏️ Edit</Text></TouchableOpacity>
                <TouchableOpacity style={styles.dropItem} onPress={() => { setMenuOpen(null); setConfirm({ title: 'Delete Event?', message: `"${d.title}" will be permanently removed.`, danger: true, onConfirm: () => { deleteEvent(item.id); setConfirm(null); } }); }}>
                  <Text style={{ color: '#ef4444' }}>🗑️ Delete</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={styles.dropItem} onPress={() => { setMenuOpen(null); setReportTarget({ id: item.id }); }}><Text style={{ color: '#f59e0b' }}>🚩 Report</Text></TouchableOpacity>
          </View>
        )}

        {d.location ? <Text style={styles.detailText}>📍 {d.location}</Text> : null}
        {d.dateTime ? <Text style={styles.detailText}>📅 {d.dateTime}</Text> : null}
        {d.imageUrl ? <Text style={[styles.detailText, { color: theme.acc }]}>🖼️ Image: {d.imageUrl.slice(0, 40)}...</Text> : null}
        <Text style={[styles.eventDesc, { color: theme.text }]}>{d.text}</Text>

        {/* Like */}
        <TouchableOpacity style={[styles.likeBtn, isLiked && { backgroundColor: '#ff4da6' }]} onPress={() => handleLike(item.id)}>
          <Text style={[styles.likeBtnText, isLiked && { color: '#fff' }]}>❤️ {likes} {likes === 1 ? 'Like' : 'Likes'}</Text>
        </TouchableOpacity>

        {/* RSVP */}
        {m.rsvpEnabled !== false && (
          <View style={styles.rsvpRow}>
            {['going', 'maybe', 'not_going'].map(s => (
              <TouchableOpacity key={s} style={[styles.rsvpBtn, rsvp === s && { backgroundColor: theme.acc }]} onPress={() => {
                if (s === 'not_going') setConfirm({ title: "Can't make it?", message: "Confirm you're not going?", danger: false, onConfirm: () => { handleRSVP(item.id, s); setConfirm(null); } });
                else handleRSVP(item.id, s);
              }}>
                <Text style={styles.rsvpText}>{rsvpLabels[s]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Comments */}
        <View style={[styles.commentSection, { borderTopColor: theme.border }]}>
          <View style={styles.commentsHeader}>
            <Text style={[styles.sectionTitle, { color: theme.acc }]}>{(m.comments || []).length} Comments</Text>
            <TouchableOpacity onPress={() => setCollapsedThreads(!collapsedThreads)}>
              <Text style={{ color: '#888', fontSize: 10 }}>{collapsedThreads ? '⬆ Expand' : '⬇ Collapse'}</Text>
            </TouchableOpacity>
          </View>
          {(m.comments || []).length === 0 && <Text style={{ color: '#666', fontSize: 12, textAlign: 'center', marginVertical: 8 }}>💬 No comments yet. Be the first!</Text>}
          {renderComments(item.id, m.comments || [])}
          {replyingTo?.postId === item.id && (
            <Text style={{ color: theme.acc, fontSize: 11, marginBottom: 4 }}>↳ Replying · <Text style={{ color: '#888' }} onPress={() => setReplyingTo(null)}>Cancel</Text></Text>
          )}
          <View style={styles.addCommentRow}>
            <TextInput style={[styles.commentInput, { color: theme.it, backgroundColor: theme.inp, flex: 1 }]}
              placeholder={replyingTo?.postId === item.id ? 'Write a reply...' : 'Add a comment...'}
              placeholderTextColor="#888" value={commentInputs[item.id] || ''}
              onChangeText={t => setCommentInputs(p => ({ ...p, [item.id]: t }))} />
            <TouchableOpacity style={[styles.sendBtn, { backgroundColor: theme.acc }]} onPress={() => submitComment(item.id, replyingTo?.postId === item.id ? replyingTo.commentId : null)}>
              <Text style={styles.sendText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // ─── Auth Screen ─────────────────────────────────────────────────────────
  if (screen === 'auth') {
    const isSignup = authMode === 'signup';
    const selectedGender = GENDERS.find(g => g.value === authForm.gender);
    const previewAcc = selectedGender?.accent || '#ff4da6';
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#f9fafb' }]}>
        <Toast toasts={toasts} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.authContainer}>
          <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }}>
            <Text style={[styles.logo, { color: previewAcc, marginBottom: 6 }]}>THE GRUV</Text>
            <Text style={styles.tagline}>YOUR EVENTS · YOUR TRIBE</Text>
            <View style={[styles.authCard, { borderColor: previewAcc }]}>
              <Text style={styles.authCardTitle}>{isSignup ? 'Create Account' : 'Welcome Back'}</Text>
              <TextInput style={styles.authInput} placeholder="Username" autoCapitalize="none" value={authForm.username} onChangeText={t => setAuthForm(p => ({ ...p, username: t }))} />
              {isSignup && <TextInput style={styles.authInput} placeholder="Email" keyboardType="email-address" autoCapitalize="none" value={authForm.email} onChangeText={t => setAuthForm(p => ({ ...p, email: t }))} />}
              <TextInput style={styles.authInput} placeholder="Password" secureTextEntry value={authForm.password} onChangeText={t => setAuthForm(p => ({ ...p, password: t }))} />
              {isSignup && <TextInput style={styles.authInput} placeholder="Confirm Password" secureTextEntry value={authForm.confirm} onChangeText={t => setAuthForm(p => ({ ...p, confirm: t }))} />}
              {isSignup && (
                <View style={{ width: '100%', marginBottom: 15 }}>
                  <Text style={{ color: '#555', fontWeight: '700', marginBottom: 8 }}>Select Gender</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {GENDERS.map(g => (
                      <TouchableOpacity key={g.value} onPress={() => setAuthForm(p => ({ ...p, gender: g.value }))}
                        style={[styles.genderBtn, { borderColor: g.accent, backgroundColor: authForm.gender === g.value ? g.accent : 'transparent' }]}>
                        <Text style={{ color: authForm.gender === g.value ? '#fff' : g.accent, fontWeight: '700', fontSize: 12 }}>{g.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              <TouchableOpacity style={[styles.mainBtn, { backgroundColor: previewAcc, width: '100%', marginTop: 8 }]} onPress={isSignup ? handleSignup : handleLogin}>
                <Text style={styles.mainBtnText}>{isSignup ? 'SIGN UP' : 'LOGIN'}</Text>
              </TouchableOpacity>
              {!isSignup && (
                <TouchableOpacity style={{ marginTop: 12 }} onPress={() => addToast('Password reset coming soon', 'info')}>
                  <Text style={{ color: previewAcc, textDecorationLine: 'underline', fontSize: 13 }}>Forgot Password?</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={{ marginTop: 14 }} onPress={() => { setAuthMode(isSignup ? 'login' : 'signup'); setAuthForm({ username: '', email: '', password: '', confirm: '', gender: '' }); }}>
                <Text style={{ color: '#555', fontSize: 13 }}>
                  {isSignup ? 'Already have an account? ' : "Don't have an account? "}
                  <Text style={{ color: previewAcc, fontWeight: '700' }}>{isSignup ? 'LOGIN' : 'SIGN UP'}</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ─── Profile Screen ───────────────────────────────────────────────────────
  if (screen === 'profile') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <Toast toasts={toasts} />
        <ScrollView contentContainerStyle={{ padding: 25, paddingBottom: 100 }}>
          <TouchableOpacity onPress={() => setScreen('feed')} style={{ marginBottom: 20 }}>
            <Text style={{ color: theme.acc, fontSize: 15 }}>← Back to Feed</Text>
          </TouchableOpacity>
          <View style={{ alignItems: 'center', marginBottom: 30 }}>
            <View style={[styles.avatar, { backgroundColor: theme.acc }]}><Text style={{ color: '#fff', fontSize: 32, fontWeight: '900' }}>{user?.name?.[0]?.toUpperCase()}</Text></View>
            <Text style={[styles.profileName, { color: theme.text }]}>{user?.name}</Text>
            <Text style={{ color: theme.sub, fontSize: 13 }}>{user?.email}</Text>
            {user?.bio ? <Text style={{ color: theme.sub, marginTop: 6, textAlign: 'center' }}>{user.bio}</Text> : null}
          </View>
          {!profileEdit ? (
            <View style={{ gap: 12 }}>
              <TouchableOpacity style={[styles.mainBtn, { backgroundColor: theme.acc }]} onPress={() => { setProfileForm({ bio: user.bio || '', email: user.email || '', gender: user.gender }); setProfileEdit(true); }}>
                <Text style={styles.mainBtnText}>✏️ EDIT PROFILE</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.mainBtn, { backgroundColor: '#ef4444' }]} onPress={() => setConfirm({ title: 'Logout?', message: 'Are you sure you want to logout?', danger: true, onConfirm: () => { handleLogout(); setConfirm(null); } })}>
                <Text style={styles.mainBtnText}>LOGOUT</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={[styles.sectionTitle, { color: theme.acc, marginBottom: 10 }]}>Edit Profile</Text>
              <TextInput style={[styles.authInput, { backgroundColor: theme.inp, color: theme.it }]} placeholder="Email" value={profileForm.email} onChangeText={t => setProfileForm(p => ({ ...p, email: t }))} />
              <TextInput style={[styles.authInput, { backgroundColor: theme.inp, color: theme.it, height: 80 }]} placeholder="Bio" multiline value={profileForm.bio} onChangeText={t => setProfileForm(p => ({ ...p, bio: t }))} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 }}>
                {GENDERS.map(g => (
                  <TouchableOpacity key={g.value} onPress={() => setProfileForm(p => ({ ...p, gender: g.value }))}
                    style={[styles.genderBtn, { borderColor: g.accent, backgroundColor: profileForm.gender === g.value ? g.accent : 'transparent' }]}>
                    <Text style={{ color: profileForm.gender === g.value ? '#fff' : g.accent, fontWeight: '700', fontSize: 12 }}>{g.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity style={[styles.mainBtn, { flex: 1, backgroundColor: '#10b981' }]} onPress={() => {
                  setUser(p => ({ ...p, ...profileForm })); setTheme(getTheme(profileForm.gender));
                  setProfileEdit(false); addToast('Profile saved! ✅');
                }}><Text style={styles.mainBtnText}>SAVE CHANGES</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.mainBtn, { flex: 1, backgroundColor: '#888' }]} onPress={() => setProfileEdit(false)}>
                  <Text style={styles.mainBtnText}>CANCEL</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
        <ConfirmDialog visible={!!confirm} title={confirm?.title} message={confirm?.message} danger={confirm?.danger} onConfirm={confirm?.onConfirm} onCancel={() => setConfirm(null)} />
      </SafeAreaView>
    );
  }

  // ─── Feed Screen ─────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar style="light" />
      <Toast toasts={toasts} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setScreen('feed')}><Text style={[styles.logo, { color: theme.acc, fontSize: 18 }]}>THE GRUV</Text></TouchableOpacity>
        <TextInput style={[styles.searchBar, { backgroundColor: theme.inp, color: theme.it, flex: 1 }]}
          placeholder="🔍 Search events..." placeholderTextColor="#888" value={search} onChangeText={setSearch} />
        <TouchableOpacity onPress={() => setScreen('profile')}>
          <View style={[styles.avatarSm, { backgroundColor: theme.acc }]}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>{user?.name?.[0]?.toUpperCase()}</Text>
          </View>
        </TouchableOpacity>
      </View>
      {/* Category filter */}
      <View style={{ height: 50, paddingLeft: 12, marginBottom: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {CATS.map(c => (
            <TouchableOpacity key={c} onPress={() => setActiveCategory(c)} style={[styles.filterBtn, activeCategory === c && { backgroundColor: theme.acc }]}>
              <Text style={[styles.filterText, activeCategory === c && { color: '#fff' }]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      {/* Posts */}
      <FlatList data={posts} keyExtractor={i => i.id.toString()} renderItem={renderPost}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListEmptyComponent={<View style={{ alignItems: 'center', marginTop: 80 }}><Text style={{ color: '#666', fontSize: 16 }}>No events yet!</Text><Text style={{ color: '#444', fontSize: 12, marginTop: 8 }}>Tap + to create the first event ✨</Text></View>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPosts(); }} tintColor={theme.acc} />} />
      {/* FAB */}
      <TouchableOpacity style={[styles.fab, { backgroundColor: theme.acc, shadowColor: theme.acc }]} onPress={() => { setEditingEvent(null); setEventForm({ title: '', text: '', location: '', dateTime: '', guests: '', category: 'Meetup', eventType: 'physical', imageUrl: '', rsvpEnabled: true }); setModalVisible(true); }}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
      {/* Bottom Nav */}
      <View style={[styles.bottomNav, { backgroundColor: theme.nav }]}>
        <TouchableOpacity onPress={() => setScreen('feed')} style={styles.navItem}>
          <Text style={[styles.navIcon, screen === 'feed' && { color: theme.acc }]}>🏠</Text>
          <Text style={[styles.navText, screen === 'feed' && { color: theme.acc }]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setEditingEvent(null); setModalVisible(true); }} style={styles.navItem}>
          <Text style={[styles.navIcon, { color: theme.acc }]}>✏️</Text>
          <Text style={[styles.navText, { color: theme.acc }]}>Post</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setScreen('profile')} style={styles.navItem}>
          <Text style={[styles.navIcon, screen === 'profile' && { color: theme.acc }]}>👤</Text>
          <Text style={[styles.navText, { color: theme.sub }]}>{user?.name}</Text>
        </TouchableOpacity>
      </View>

      {/* Event Modal */}
      <Modal animationType="slide" transparent visible={modalVisible}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.modalContent, { backgroundColor: theme.bg, borderColor: theme.acc }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={styles.modalTitle}>{editingEvent ? '✏️ EDIT EVENT' : '🎉 NEW EVENT'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={{ color: '#888', fontSize: 24 }}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TextInput style={styles.modalInput} placeholder="Event Title *" placeholderTextColor="#666" value={eventForm.title} onChangeText={t => setEventForm(p => ({ ...p, title: t }))} />
              {/* Physical/Online Toggle */}
              <View style={{ flexDirection: 'row', marginBottom: 14, gap: 10 }}>
                {['physical', 'online'].map(et => (
                  <TouchableOpacity key={et} style={[styles.toggleBtn, eventForm.eventType === et && { backgroundColor: theme.acc }]} onPress={() => setEventForm(p => ({ ...p, eventType: et }))}>
                    <Text style={{ color: eventForm.eventType === et ? '#fff' : '#888', fontWeight: '700', fontSize: 12 }}>{et === 'physical' ? '📍 Physical' : '🌐 Online'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={styles.modalInput} placeholder={eventForm.eventType === 'online' ? 'Meeting URL *' : 'Location / Venue *'} placeholderTextColor="#666" value={eventForm.location} onChangeText={t => setEventForm(p => ({ ...p, location: t }))} />
              <TextInput style={styles.modalInput} placeholder="Date & Time (e.g. Fri Mar 7 @ 8pm)" placeholderTextColor="#666" value={eventForm.dateTime} onChangeText={t => setEventForm(p => ({ ...p, dateTime: t }))} />
              <TextInput style={[styles.modalInput, { height: 80 }]} placeholder="Description *" placeholderTextColor="#666" multiline value={eventForm.text} onChangeText={t => setEventForm(p => ({ ...p, text: t }))} />
              <TextInput style={styles.modalInput} placeholder="Image URL (optional)" placeholderTextColor="#666" value={eventForm.imageUrl} onChangeText={t => setEventForm(p => ({ ...p, imageUrl: t }))} />
              {/* Category */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {CATS.filter(c => c !== 'All').map(c => (
                  <TouchableOpacity key={c} onPress={() => setEventForm(p => ({ ...p, category: c }))} style={[styles.filterBtn, eventForm.category === c && { backgroundColor: theme.acc }]}>
                    <Text style={[styles.filterText, eventForm.category === c && { color: '#fff' }]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {/* RSVP Toggle */}
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }} onPress={() => setEventForm(p => ({ ...p, rsvpEnabled: !p.rsvpEnabled }))}>
                <View style={[styles.checkbox, eventForm.rsvpEnabled && { backgroundColor: theme.acc, borderColor: theme.acc }]}>
                  {eventForm.rsvpEnabled && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
                </View>
                <Text style={{ color: theme.text || '#fff', marginLeft: 10, fontWeight: '600' }}>Enable RSVP for this event</Text>
              </TouchableOpacity>
              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={{ color: '#888', padding: 10 }}>CANCEL</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.mainBtn, { flex: 1, marginLeft: 16 }]} onPress={submitEvent} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.mainBtnText}>{editingEvent ? 'SAVE CHANGES' : 'POST EVENT'}</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <ConfirmDialog visible={!!confirm} title={confirm?.title} message={confirm?.message} danger={confirm?.danger} onConfirm={confirm?.onConfirm} onCancel={() => setConfirm(null)} />
      <ReportModal visible={!!reportTarget} onSubmit={(reason) => submitReport(reportTarget?.id, reason)} onCancel={() => setReportTarget(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  authContainer: { flex: 1, justifyContent: 'center', padding: 20 },
  logo: { fontSize: 26, fontWeight: '900', letterSpacing: 7 },
  tagline: { color: '#aaa', fontSize: 11, letterSpacing: 4, marginBottom: 30 },
  authCard: { width: '100%', backgroundColor: '#fff', borderRadius: 24, borderWidth: 2, padding: 25, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
  authCardTitle: { fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 20, textAlign: 'center' },
  authInput: { width: '100%', backgroundColor: '#f0f0f0', padding: 14, borderRadius: 14, marginBottom: 13, fontSize: 15, color: '#111' },
  genderBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 2 },
  mainBtn: { backgroundColor: '#ff4da6', padding: 15, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  mainBtnText: { color: '#fff', fontWeight: '800', letterSpacing: 1, fontSize: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15, height: 65 },
  searchBar: { padding: 11, borderRadius: 14, fontSize: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  avatar: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarSm: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  profileName: { fontSize: 22, fontWeight: '900', marginBottom: 4 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', marginRight: 9, height: 36, justifyContent: 'center' },
  filterText: { color: '#bbb', fontSize: 12, fontWeight: '700' },
  postCard: { margin: 14, padding: 20, borderRadius: 24, borderWidth: 1.5, position: 'relative' },
  eventTitle: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  eventAuthor: { fontSize: 12, marginBottom: 10, fontWeight: '600' },
  detailText: { color: '#888', fontSize: 13, marginBottom: 4 },
  eventDesc: { fontSize: 15, marginBottom: 14, lineHeight: 22, marginTop: 8 },
  likeBtn: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,77,166,0.1)', marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,77,166,0.25)' },
  likeBtnText: { color: '#ff4da6', fontWeight: '700', fontSize: 13 },
  rsvpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, gap: 6 },
  rsvpBtn: { flex: 1, padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  rsvpText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  commentSection: { borderTopWidth: 0.5, paddingTop: 14 },
  commentsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontWeight: '800', fontSize: 13 },
  commentNode: { marginBottom: 12, paddingLeft: 12, borderLeftWidth: 2 },
  commentAuthor: { fontWeight: '700', fontSize: 13, marginBottom: 2 },
  commentActions: { flexDirection: 'row', marginTop: 5 },
  actionText: { fontSize: 11, fontWeight: '700' },
  addCommentRow: { flexDirection: 'row', marginTop: 10, alignItems: 'center', gap: 8 },
  commentInput: { padding: 11, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', fontSize: 13 },
  sendBtn: { padding: 11, borderRadius: 14 },
  sendText: { color: '#fff', fontWeight: '700' },
  fab: { position: 'absolute', bottom: 95, right: 24, width: 62, height: 62, borderRadius: 31, justifyContent: 'center', alignItems: 'center', elevation: 10, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  fabIcon: { color: '#fff', fontSize: 36, fontWeight: '200', marginTop: -3 },
  bottomNav: { position: 'absolute', bottom: 0, width: '100%', height: 78, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderTopWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  navItem: { alignItems: 'center' },
  navIcon: { fontSize: 24, color: '#555' },
  navText: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1.5, padding: 25, maxHeight: '92%' },
  modalTitle: { fontSize: 22, color: '#fff', fontWeight: '900', letterSpacing: 2 },
  modalInput: { backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff', padding: 14, borderRadius: 14, marginBottom: 13, fontSize: 15 },
  toggleBtn: { flex: 1, padding: 11, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#888', alignItems: 'center', justifyContent: 'center' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5, marginBottom: 20 },
  dropMenu: { position: 'absolute', right: 8, top: 40, borderRadius: 14, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 10, zIndex: 100, minWidth: 150, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  dropItem: { padding: 13, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.07)' },
  toast: { marginBottom: 8, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, minWidth: 220, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, elevation: 8 },
  toastText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  dlgOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 25 },
  dlgBox: { backgroundColor: '#fff', borderRadius: 22, padding: 24, width: '100%', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, elevation: 15 },
  dlgTitle: { fontSize: 18, fontWeight: '900', color: '#111', marginBottom: 10 },
  dlgMsg: { fontSize: 14, color: '#555', marginBottom: 20, lineHeight: 20 },
  dlgRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  dlgCancel: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12, backgroundColor: '#f0f0f0' },
  dlgConfirm: { paddingHorizontal: 22, paddingVertical: 11, borderRadius: 12, backgroundColor: '#ff4da6' },
  reasonBtn: { padding: 12, borderRadius: 12, borderWidth: 2, borderColor: '#ddd', marginBottom: 8 },
});
