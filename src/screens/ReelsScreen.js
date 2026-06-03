/**
 * ReelsScreen — Short-form vertical video feed (TikTok/Reels style).
 * Features: snap-scroll, like/comment/share, follow from reel, mention tagging,
 * volume control, caption expand, duet/stitch concept, mute toggle, speed control,
 * progress bar, double-tap like, swipe-up details, hashtag discovery.
 */
import React, { useState, useRef, useCallback, useEffect, useMemo, memo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TouchableWithoutFeedback,
  Image, Dimensions, Platform, TextInput, Modal, ScrollView, KeyboardAvoidingView,
  Animated, ActivityIndicator, Share, Alert, RefreshControl, AppState,
  useWindowDimensions, BackHandler, PanResponder,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastNotification';
import { supabase } from '../services/supabase';
import { resilient } from '../utils/resilience';
import { haptics } from '../utils/haptics';
import { ViberProfileModal } from '../components/ViberProfileModal';
import { DirectMessageModal } from '../components/DirectMessageModal';
import { CreateReelModal } from '../components/CreateReelModal';
import {
  ReelsPreferences, ReelsObservers, ReelsRepository, ReelsAnalytics,
  PLAYBACK_SPEEDS, ASPECT_RATIOS, VISUAL_FILTERS
} from '../services/reelsDataFlow';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useBackClose } from '../hooks/useBackClose';

const IS_WEB = Platform.OS === 'web';
// Mobile fallback (used outside component for getItemLayout)
const { width: SW, height: SH } = Dimensions.get('window');

const avatarBg = (u = '') =>
  ["#0891b2", "#7c3aed", "#059669", "#d97706", "#db2777"][(u.charCodeAt(0) || 0) % 5];

const fmtCount = (n) => {
  if (!n) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
};

// ── Tab switcher bar ─────────────────────────────────────────────────────────
const ReelTabSwitcher = ({ absolute, insetsTop, onClose, hashtagFilter, setHashtagFilter, primary, tab, setTab }) => (
  <View style={[rs.tabBar, absolute && rs.tabBarAbsolute, { paddingTop: insetsTop }]}>
    {onClose && (
      <TouchableOpacity onPress={onClose} style={{ position: 'absolute', left: 16, top: insetsTop + 10 }}>
        <Feather name="x" size={22} color="#fff" />
      </TouchableOpacity>
    )}
    {hashtagFilter ? (
      <TouchableOpacity
        onPress={() => setHashtagFilter(null)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: `${primary}25`, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 14, borderWidth: 1, borderColor: `${primary}50` }}
      >
        <Text style={{ color: primary, fontWeight: '900', fontSize: 13 }}>{hashtagFilter}</Text>
        <Feather name="x" size={12} color={primary} />
      </TouchableOpacity>
    ) : (
      <>
        <TouchableOpacity onPress={() => setTab('foryou')}>
          <Text style={[rs.tabLabel, tab === 'foryou' && rs.tabActive]}>For You</Text>
          {tab === 'foryou' && <View style={[rs.tabUnderline, { backgroundColor: primary }]} />}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('following')}>
          <Text style={[rs.tabLabel, tab === 'following' && rs.tabActive]}>Following</Text>
          {tab === 'following' && <View style={[rs.tabUnderline, { backgroundColor: primary }]} />}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('trending')}>
          <Text style={[rs.tabLabel, tab === 'trending' && rs.tabActive]}>🔥 Trending</Text>
          {tab === 'trending' && <View style={[rs.tabUnderline, { backgroundColor: primary }]} />}
        </TouchableOpacity>
      </>
    )}
  </View>
);

// ── Skeleton reel card for loading state ──────────────────────────────────────
const ReelSkeleton = ({ primary, reelW, reelH }) => {
  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);
  return (
    <View style={{ width: reelW ?? SW, height: reelH ?? SH, backgroundColor: "#0a0a0a" }}>
      {/* right action bar placeholders */}
      <Animated.View style={{ position: 'absolute', right: 14, bottom: 150, alignItems: 'center', gap: 20, opacity: pulse }}>
        {[48, 36, 36, 36, 36].map((size, i) => (
          <View key={i} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `${primary}30` }} />
        ))}
      </Animated.View>
      {/* bottom caption placeholders */}
      <Animated.View style={{ position: 'absolute', left: 14, right: 80, bottom: 36, gap: 8, opacity: pulse }}>
        <View style={{ height: 12, width: '40%', borderRadius: 6, backgroundColor: `${primary}35` }} />
        <View style={{ height: 10, width: '70%', borderRadius: 5, backgroundColor: `${primary}20` }} />
        <View style={{ height: 10, width: '55%', borderRadius: 5, backgroundColor: `${primary}15` }} />
      </Animated.View>
    </View>
  );
};

// ── Reel manage sheet (own reels: edit caption / delete) ─────────────────────
const ReelManageSheet = ({ visible, reel, onClose, onDeleted, onCaptionUpdated, primary, bg, textColor, muted, surface, user }) => {
  useBackClose(visible, onClose);
  const [mode, setMode] = useState('menu'); // 'menu' | 'edit'
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (visible) {
      setMode('menu');
      setCaption(reel?.caption || '');
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 200 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 400, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible, reel?.id]);

  const handleDelete = () => {
    const doDelete = async () => {
      onClose();
      if (!user || reel.user_id !== user.id) return; // IDOR guard — never delete another user's reel
      try {
        await resilient(
          [
            () => supabase.from('reels').update({ is_deleted: true }).eq('id', reel.id).eq('user_id', user?.id),
            () => supabase.from('reels').delete().eq('id', reel.id).eq('user_id', user?.id),
          ],
          { attemptsPerTier: 3, baseMs: 400, label: 'ReelManageSheet.delete', fallbackValue: null }
        );
        onDeleted(reel.id);
      } catch { /* silent */ }
    };
    // RN-web's Alert.alert ignores button callbacks, so the Delete press never
    // fired on web. Use the browser confirm there; keep the native Alert on device.
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Delete this reel permanently? This cannot be undone.')) doDelete();
      return;
    }
    Alert.alert(
      'Delete Reel',
      'This will permanently remove your reel. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]
    );
  };

  const handleSaveCaption = async () => {
    if (saving) return;
    setSaving(true);
    if (!user || reel.user_id !== user.id) { setSaving(false); return; } // IDOR guard
    try {
      const cleanCaption = caption.trim().slice(0, 500); // max length guard
      await resilient(
        [
          () => supabase.from('reels').update({ caption: cleanCaption }).eq('id', reel.id).eq('user_id', user?.id),
          () => supabase.rpc('update_reel_caption', { p_reel_id: reel.id, p_caption: cleanCaption }),
        ],
        { attemptsPerTier: 3, baseMs: 400, label: 'ReelManageSheet.editCaption', fallbackValue: null }
      );
      onCaptionUpdated(reel.id, caption.trim());
      onClose();
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  if (!visible && !reel) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} />
      </TouchableWithoutFeedback>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <Animated.View style={[ms.sheet, { backgroundColor: bg, transform: [{ translateY: slideAnim }] }]}>
          <View style={[ms.handle, { backgroundColor: `${primary}40` }]} />

          {mode === 'menu' ? (
            <>
              <Text style={[ms.title, { color: textColor }]}>Manage Reel</Text>

              <TouchableOpacity style={[ms.row, { borderBottomColor: `${primary}12` }]} onPress={() => setMode('edit')}>
                <View style={[ms.iconWrap, { backgroundColor: `${primary}18` }]}>
                  <Feather name="edit-2" size={18} color={primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[ms.rowLabel, { color: textColor }]}>Edit Caption</Text>
                  <Text style={[ms.rowSub, { color: muted }]}>Update caption and hashtags</Text>
                </View>
                <Feather name="chevron-right" size={16} color={muted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[ms.row, { borderBottomColor: `${primary}12` }]}
                onPress={async () => {
                  onClose();
                  try { await Share.share({ message: `Check out my reel on The Gruvs!` }); } catch (err) { console.warn('Share error:', err); }
                }}
              >
                <View style={[ms.iconWrap, { backgroundColor: '#05966918' }]}>
                  <Feather name="share-2" size={18} color="#10b981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[ms.rowLabel, { color: textColor }]}>Share Reel</Text>
                  <Text style={[ms.rowSub, { color: muted }]}>Send to friends or other platforms</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={ms.row} onPress={handleDelete}>
                <View style={[ms.iconWrap, { backgroundColor: '#ef444418' }]}>
                  <Feather name="trash-2" size={18} color="#ef4444" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[ms.rowLabel, { color: "#ef4444" }]}>Delete Reel</Text>
                  <Text style={[ms.rowSub, { color: muted }]}>Permanently remove this reel</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={[ms.cancelBtn, { borderColor: `${primary}20` }]} onPress={onClose}>
                <Text style={{ color: muted, fontWeight: '800', fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <TouchableOpacity onPress={() => setMode('menu')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Feather name="arrow-left" size={20} color={textColor} />
                </TouchableOpacity>
                <Text style={[ms.title, { color: textColor, marginLeft: 12, marginBottom: 0 }]}>Edit Caption</Text>
              </View>
              <TextInput
                style={[ms.captionInput, { color: textColor, borderColor: `${primary}35`, backgroundColor: surface }]}
                value={caption}
                onChangeText={setCaption}
                multiline
                autoFocus
                maxLength={500}
                placeholder="Write a caption..."
                placeholderTextColor={muted}
              />
              <Text style={{ color: muted, fontSize: 11, textAlign: 'right', marginTop: 4, marginBottom: 16 }}>{caption.length}/500</Text>
              <TouchableOpacity
                style={[ms.saveBtn, { backgroundColor: saving ? `${primary}50` : primary }]}
                onPress={handleSaveCaption}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#000" />
                  : <Text style={{ color: '#000', fontWeight: '900', fontSize: 15 }}>Save Caption</Text>
                }
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
const ms = StyleSheet.create({
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 20, paddingBottom: 36 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 16, fontWeight: '900', marginBottom: 20, letterSpacing: 0.3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 15, fontWeight: '800' },
  rowSub: { fontSize: 12, marginTop: 2 },
  cancelBtn: { borderWidth: 1, borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  captionInput: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 14, lineHeight: 20, minHeight: 100, textAlignVertical: 'top' },
  saveBtn: { borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
});

// ── Comment sheet ─────────────────────────────────────────────────────────────
const CommentsSheet = ({ visible, onClose, reel, primary, bg, textColor, muted, surface, user }) => {
  useBackClose(visible, onClose);
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [commentLikes, setCommentLikes] = useState({}); // { [commentId]: { liked: bool, count: number } }

  useEffect(() => {
    if (!visible || !reel) return;
    setLoading(true);
    supabase
      .from('reel_comments')
      .select('id, body, created_at, like_count, profiles:user_id(id, username, avatar_url)')
      .eq('reel_id', reel.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(async ({ data }) => {
        const rows = data || [];
        setComments(rows);
        if (user && rows.length > 0) {
          const ids = rows.map(c => c.id);
          const { data: liked } = await supabase
            .from('reel_comment_likes')
            .select('comment_id')
            .eq('user_id', user?.id)
            .in('comment_id', ids);
          const likedSet = new Set((liked || []).map(l => l.comment_id));
          const state = {};
          rows.forEach(c => { state[c.id] = { liked: likedSet.has(c.id), count: c.like_count || 0 }; });
          setCommentLikes(state);
        }
      })
      .catch(() => {})
      .finally(() => { setLoading(false); });
  }, [visible, reel?.id]);

  const toggleCommentLike = async (commentId) => {
    if (!user) return;
    const prev = commentLikes[commentId] || { liked: false, count: 0 };
    const next = { liked: !prev.liked, count: prev.liked ? Math.max(0, prev.count - 1) : prev.count + 1 };
    setCommentLikes(s => ({ ...s, [commentId]: next }));
    try {
      if (prev.liked) {
        await supabase.from('reel_comment_likes').delete().eq('comment_id', commentId).eq('user_id', user?.id);
        await supabase.from('reel_comments').update({ like_count: next.count }).eq('id', commentId);
      } else {
        await supabase.from('reel_comment_likes').upsert({ comment_id: commentId, user_id: user?.id }, { onConflict: 'comment_id,user_id' });
        await supabase.from('reel_comments').update({ like_count: next.count }).eq('id', commentId);
      }
    } catch { /* handle error */ }
  };

  const sendComment = async () => {
    if (!body.trim() || !user) return;
    setSending(true);
    const text = body.trim();
    setBody('');
    try {
      const inserted = await resilient(
        [
          // Tier 1: insert + fetch profile
          async () => {
            const { error } = await supabase.from('reel_comments').insert({ reel_id: reel.id, user_id: user?.id, body: text });
            if (error) throw error;
            return true;
          },
          // Tier 2: upsert
          async () => {
            const { error } = await supabase.from('reel_comments').upsert({ reel_id: reel.id, user_id: user?.id, body: text, created_at: new Date().toISOString() });
            if (error) throw error;
            return true;
          },
          // Tier 3: RPC send comment
          async () => {
            const { error } = await supabase.rpc('add_reel_comment', { p_reel_id: reel.id, p_user_id: user?.id, p_body: text });
            if (error) throw error;
            return true;
          },
        ],
        { attemptsPerTier: 3, baseMs: 300, label: 'CommentsSheet.sendComment', fallbackValue: false }
      );
      if (inserted) {
        const { data } = await supabase
          .from('profiles').select('id, username, avatar_url').eq('id', user.id).single();
        setComments(prev => [{ id: Date.now(), body: text, created_at: new Date().toISOString(), profiles: data }, ...prev]);
      }
    } catch { /* comment send failed silently */ }
    finally { setSending(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={cs.backdrop} />
      </TouchableWithoutFeedback>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={cs.sheet}>
        <View style={[cs.sheetInner, { backgroundColor: bg }]}>
          <View style={[cs.sheetHandle, { backgroundColor: `${primary}30` }]} />
          <Text style={[cs.sheetTitle, { color: textColor }]}>Comments</Text>
          {loading ? (
            <ActivityIndicator color={primary} style={{ marginTop: 20 }} />
          ) : (
            <ScrollView style={{ maxHeight: SH * 0.45 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              {comments.length === 0 && (
                <Text style={[{ textAlign: 'center', color: muted, marginTop: 20, fontSize: 13 }]}>Be the first to comment</Text>
              )}
              {comments.map(c => {
                const cl = commentLikes[c.id] || { liked: false, count: c.like_count || 0 };
                return (
                  <View key={c.id} style={cs.commentRow}>
                    {c.profiles?.avatar_url
                      ? <Image source={{ uri: c.profiles.avatar_url }} style={cs.commentAvatar} />
                      : <View style={[cs.commentAvatar, { backgroundColor: avatarBg(c.profiles?.username), alignItems: 'center', justifyContent: 'center' }]}>
                          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 10 }}>{(c.profiles?.username || '?')[0].toUpperCase()}</Text>
                        </View>
                    }
                    <View style={{ flex: 1 }}>
                      <Text style={[cs.commentUser, { color: primary }]}>@{c.profiles?.username || 'Viber'}</Text>
                      <Text style={[cs.commentBody, { color: textColor }]}>{c.body}</Text>
                    </View>
                    {user && (
                      <TouchableOpacity onPress={() => toggleCommentLike(c.id)} style={cs.commentLikeBtn}>
                        <Feather name="heart" size={14} color={cl.liked ? "#f43f5e" : muted} />
                        {cl.count > 0 && <Text style={[cs.commentLikeCount, { color: cl.liked ? "#f43f5e" : muted }]}>{cl.count}</Text>}
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
          {user && (
            <View style={[cs.commentInput, { borderTopColor: `${primary}15` }]}>
              <TextInput
                style={[cs.commentBox, { color: textColor, backgroundColor: surface }]}
                placeholder="Add a comment..."
                placeholderTextColor={muted}
                value={body}
                onChangeText={setBody}
                multiline
              />
              <TouchableOpacity
                style={[cs.sendBtn, { backgroundColor: body.trim() ? primary : `${primary}30` }]}
                onPress={sendComment}
                disabled={sending || !body.trim()}
              >
                <Feather name="send" size={15} color={body.trim() ? '#000' : muted} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
const cs = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheetInner: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: 32 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 1, textAlign: 'center', marginBottom: 12 },
  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 14, alignItems: 'flex-start', paddingRight: 4 },
  commentLikeBtn: { alignItems: 'center', paddingTop: 2, minWidth: 28 },
  commentLikeCount: { fontSize: 10, fontWeight: '700', marginTop: 2 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16 },
  commentUser: { fontSize: 11, fontWeight: '800', marginBottom: 2 },
  commentBody: { fontSize: 13, lineHeight: 18 },
  commentInput: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1 },
  commentBox: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, maxHeight: 80 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});

// ── Single Reel Item ──────────────────────────────────────────────────────────
const ReelItem = memo(({ reel, isActive, screenFocused, primary, muted, textColor, bg, surface, user, onComment, onProfile, onMessage, onHashtag, onManage, onOpenEvent, onOpenSettings, playerPref = {}, onVideoFinish, reelW, reelH }) => {
  const videoRef = useRef(null);
  const lastTap = useRef(0);
  const heartAnim = useRef(new Animated.Value(0)).current;
  const heartScale = useRef(new Animated.Value(0)).current;
  const progressBarRef = useRef(null);

  const [liked, setLiked] = useState(reel._liked || false);
  const [likeCount, setLikeCount] = useState(reel.like_count || 0);
  const [audioMuted, setAudioMuted] = useState(IS_WEB);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [following, setFollowing] = useState(reel._following || false);
  const [saved, setSaved] = useState(reel._saved || false);
  const [paused, setPaused] = useState(false);
  const [showPauseIcon, setShowPauseIcon] = useState(false);
  const pauseIconAnim = useRef(new Animated.Value(0)).current;

  // Real-time synchronization of like state if updated elsewhere
  useEffect(() => {
    setLiked(reel._liked || false);
    setLikeCount(reel.like_count || 0);
  }, [reel._liked, reel.like_count]);

  useEffect(() => {
    if (isActive && screenFocused && !paused) {
      videoRef.current?.playAsync().catch(() => {});
      if (user && reel?.id) {
        ReelsAnalytics.queueView(reel.id, user.id);
      }
    } else {
      videoRef.current?.pauseAsync().catch(() => {});
    }
  }, [isActive, screenFocused, paused, user, reel?.id]);

  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    setShowPauseIcon(true);
    pauseIconAnim.setValue(1);
    Animated.sequence([
      Animated.delay(600),
      Animated.timing(pauseIconAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setShowPauseIcon(false));
  };

  const handleSeek = (evt) => {
    if (!duration || !videoRef.current) return;
    progressBarRef.current?.measure((_, __, width) => {
      const x = evt.nativeEvent.locationX;
      const ratio = Math.max(0, Math.min(1, x / width));
      videoRef.current?.setPositionAsync(ratio * duration).catch(() => {});
    });
  };

  const isVideo = reel.media_type === 'video' || (!reel.media_type && /\.(mp4|mov|m4v|webm)/i.test(reel.media_url || ''));
  const author = reel.profiles || {};
  const caption = reel.caption || '';

  const parsedCaption = caption.split(/(\s+)/).map((word, i) => {
    if (word.startsWith('#')) {
      return <Text key={i} style={{ color: primary, fontWeight: '900' }} onPress={() => onHashtag?.(word)}>{word}</Text>;
    }
    if (word.startsWith('@')) {
      return <Text key={i} style={{ color: "#60a5fa", fontWeight: '900' }}>{word}</Text>;
    }
    return <Text key={i} style={{ color: 'rgba(255,255,255,0.92)' }}>{word}</Text>;
  });

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      triggerLike();
    } else {
      togglePause();
    }
    lastTap.current = now;
  };

  const handleReport = () => {
    Alert.alert('Report Reel', 'Why are you reporting this?', [
      { text: 'Spam', onPress: async () => { try { await supabase.from('reel_reports').upsert({ reel_id: reel.id, reporter_id: user?.id, reason: 'spam' }, { onConflict: 'reel_id,reporter_id' }); Alert.alert('Thanks', 'Report submitted.'); } catch { Alert.alert('Error', 'Could not submit report. Try again.'); } } },
      { text: 'Inappropriate', onPress: async () => { try { await supabase.from('reel_reports').upsert({ reel_id: reel.id, reporter_id: user?.id, reason: 'inappropriate' }, { onConflict: 'reel_id,reporter_id' }); Alert.alert('Thanks', 'Report submitted.'); } catch { Alert.alert('Error', 'Could not submit report. Try again.'); } } },
      { text: 'Misleading', onPress: async () => { try { await supabase.from('reel_reports').upsert({ reel_id: reel.id, reporter_id: user?.id, reason: 'misleading' }, { onConflict: 'reel_id,reporter_id' }); Alert.alert('Thanks', 'Report submitted.'); } catch { Alert.alert('Error', 'Could not submit report. Try again.'); } } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const triggerLike = async () => {
    if (!user) return;
    const newLiked = !liked;
    if (newLiked) haptics.light();
    setLiked(newLiked);
    setLikeCount(c => newLiked ? c + 1 : Math.max(0, c - 1));
    heartAnim.setValue(1);
    heartScale.setValue(0);
    Animated.parallel([
      Animated.timing(heartScale, { toValue: 1.4, duration: 200, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(heartAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();

    try {
      await ReelsRepository.toggleLike({ reelId: reel.id, userId: user?.id, isLiked: newLiked });
    } catch {
      setLiked(!newLiked);
      setLikeCount(c => newLiked ? Math.max(0, c - 1) : c + 1);
    }
  };

  const handleFollow = async () => {
    if (!user) return;
    const newFollowing = !following;
    setFollowing(newFollowing);
    await resilient(
      newFollowing ? [
        () => supabase.from('follows').upsert({ follower_id: user?.id, following_id: reel.user_id }, { onConflict: 'follower_id,following_id', ignoreDuplicates: true }),
        () => supabase.from('follows').insert({ follower_id: user?.id, following_id: reel.user_id }),
      ] : [
        () => supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', reel.user_id),
      ],
      { attemptsPerTier: 2, baseMs: 300, label: 'ReelItem.handleFollow', fallbackValue: null }
    );
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: `Check out @${reel.profiles?.username}'s reel on The Gruvs!` });
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    const newSaved = !saved;
    if (newSaved) haptics.success();
    setSaved(newSaved);
    try {
      await ReelsRepository.toggleSave({ reelId: reel.id, userId: user?.id, isSaved: newSaved });
    } catch {
      setSaved(!newSaved);
    }
  };

  // ── Advanced Aspect Ratio & Scale Mapping ──────────────────────────────────
  let mediaStyle = [StyleSheet.absoluteFillObject];
  let videoResizeMode = ResizeMode.COVER;

  if (playerPref.aspectRatio === 'contain') {
    videoResizeMode = ResizeMode.CONTAIN;
  } else if (playerPref.aspectRatio === 'stretch') {
    videoResizeMode = ResizeMode.STRETCH;
  } else if (playerPref.aspectRatio === 'zoom') {
    videoResizeMode = ResizeMode.COVER;
    mediaStyle.push({ transform: [{ scale: playerPref.zoomLevel || 1.4 }] });
  }

  // ── Advanced Visual Color Filter Mapping ───────────────────────────────────
  const getFilterOverlayColor = (fid) => {
    switch (fid) {
      case 'greyscale': return 'rgba(0, 0, 0, 0.28)';
      case 'sepia': return 'rgba(217, 119, 6, 0.12)';
      case 'cyberpunk': return 'rgba(168, 85, 247, 0.16)';
      case 'vhs': return 'rgba(16, 185, 129, 0.05)';
      case 'cool': return 'rgba(6, 182, 212, 0.08)';
      case 'warm': return 'rgba(239, 68, 68, 0.06)';
      default: return null;
    }
  };

  const activeFilter = playerPref.visualFilter !== 'none' ? playerPref.visualFilter : (reel.metadata?.filter || 'none');
  const filterOverlayColor = getFilterOverlayColor(activeFilter);

  // ── Advanced Captions Font Scaling ─────────────────────────────────────────
  const captionFontSize = playerPref.captionScale === 'small' ? 11 : playerPref.captionScale === 'large' ? 16 : 13;
  const captionLineHeight = playerPref.captionScale === 'small' ? 15 : playerPref.captionScale === 'large' ? 22 : 18;

  // ── Advanced Creator Stickers Overlays ──────────────────────────────────────
  const stickers = reel.metadata?.stickers || [];
  const trimBounds = reel.metadata?.trim || {};

  return (
    <TouchableWithoutFeedback onPress={handleTap}>
      <View style={[ri.container, { width: reelW ?? SW, height: reelH ?? SH }]}>
        {/* Media */}
        {isVideo ? (
          <Video
            ref={videoRef}
            source={{ uri: reel.media_url }}
            style={mediaStyle}
            resizeMode={videoResizeMode}
            isLooping={!playerPref.autoAdvance}
            isMuted={audioMuted}
            rate={playerPref.speed || 1.0}
            shouldPlay={isActive}
            onReadyForDisplay={() => setVideoLoaded(true)}
            onPlaybackStatusUpdate={s => {
              if (s.durationMillis) {
                setDuration(s.durationMillis);
                setProgress(s.positionMillis / s.durationMillis);
              }
              // Handle simulated trimming looping limits
              if (trimBounds.end && s.positionMillis >= trimBounds.end * 1000) {
                videoRef.current?.setPositionAsync((trimBounds.start || 0) * 1000).catch(() => {});
              }
              // Handle autoplay next reel callbacks
              if (s.didJustFinish) {
                if (playerPref.autoAdvance) {
                  onVideoFinish?.();
                }
              }
            }}
          />
        ) : (
          <Image source={{ uri: reel.media_url }} style={mediaStyle} resizeMode={playerPref.aspectRatio === 'contain' ? 'contain' : 'cover'} />
        )}

        {/* Visual Color Filter Translucent Overlay */}
        {filterOverlayColor && (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: filterOverlayColor, pointerEvents: 'none' }]} />
        )}

        {/* VHS Scanlines Overlays */}
        {activeFilter === 'vhs' && (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.03)', pointerEvents: 'none' }]}>
            <View style={{ flex: 1, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.03)', borderStyle: 'dotted' }} />
          </View>
        )}

        {/* Creator Text Stickers */}
        {stickers.map((st, i) => (
          <View key={i} style={[ri.sticker, { top: `${(st.y || 0.4) * 100}%` }]}>
            <Text style={[ri.stickerText, st.style === 'glow' && { textShadowColor: primary, textShadowRadius: 10 }]}>
              {st.text}
            </Text>
          </View>
        ))}

        {/* Dark gradient overlay */}
        <View style={ri.gradient} />

        {/* Immersive view back toggle */}
        {playerPref.cleanView && (
          <TouchableOpacity
            style={{ position: 'absolute', top: 50, left: 16, zIndex: 100, backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 20 }}
            onPress={onOpenSettings}
            activeOpacity={0.8}
          >
            <Feather name="eye" size={16} color={primary} />
          </TouchableOpacity>
        )}

        {/* Seekable progress bar (video only) */}
        {isVideo && duration > 0 && !playerPref.cleanView && (
          <TouchableOpacity
            ref={progressBarRef}
            style={ri.progressBar}
            onPress={handleSeek}
            activeOpacity={1}
          >
            <View style={[ri.progressFill, { width: `${progress * 100}%`, backgroundColor: primary }]} />
          </TouchableOpacity>
        )}

        {/* Like burst */}
        <Animated.View style={[ri.heartBurst, { opacity: heartAnim, transform: [{ scale: heartScale }] }]}>
          <Text style={{ fontSize: 70 }}>❤️</Text>
        </Animated.View>

        {/* Pause indicator */}
        {showPauseIcon && (
          <Animated.View style={[ri.pauseOverlay, { opacity: pauseIconAnim }]}>
            <Feather name={paused ? 'pause' : 'play'} size={52} color="rgba(255,255,255,0.9)" />
          </Animated.View>
        )}

        {/* Right action bar */}
        {!playerPref.cleanView && (
          <View style={ri.actions}>
            {/* Author avatar + follow */}
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <TouchableOpacity onPress={() => onProfile(author)} activeOpacity={0.8}>
                {author.avatar_url
                  ? <Image source={{ uri: author.avatar_url }} style={ri.avatar} />
                  : <View style={[ri.avatar, { backgroundColor: avatarBg(author.username), alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>{(author.username || 'V')[0].toUpperCase()}</Text>
                    </View>
                }
              </TouchableOpacity>
              {user && user.id !== reel.user_id && (
                <TouchableOpacity onPress={handleFollow} style={[ri.followDot, { borderColor: following ? primary : '#fff', backgroundColor: following ? primary : 'transparent' }]}>
                  <Feather name={following ? 'check' : 'plus'} size={10} color={following ? '#000' : '#fff'} />
                </TouchableOpacity>
              )}
            </View>

            {/* Like */}
            <TouchableOpacity style={ri.actionBtn} onPress={triggerLike} activeOpacity={0.8}>
              <Text style={{ fontSize: 28 }}>{liked ? '❤️' : '🤍'}</Text>
              <Text style={[ri.actionLabel, { color: '#fff' }]}>{fmtCount(likeCount)}</Text>
            </TouchableOpacity>

            {/* Comment */}
            <TouchableOpacity style={ri.actionBtn} onPress={() => onComment(reel)} activeOpacity={0.8}>
              <Feather name="message-circle" size={28} color="#fff" />
              <Text style={[ri.actionLabel, { color: '#fff' }]}>{fmtCount(reel.comment_count || 0)}</Text>
            </TouchableOpacity>

            {/* Share */}
            <TouchableOpacity style={ri.actionBtn} onPress={handleShare} activeOpacity={0.8}>
              <Feather name="send" size={26} color="#fff" />
              <Text style={[ri.actionLabel, { color: '#fff' }]}>Share</Text>
            </TouchableOpacity>

            {/* Save */}
            <TouchableOpacity style={ri.actionBtn} onPress={handleSave} activeOpacity={0.8}>
              <Feather name="bookmark" size={25} color={saved ? primary : '#fff'} style={{ opacity: saved ? 1 : 0.6 }} />
              <Text style={[ri.actionLabel, { color: saved ? primary : '#fff' }]}>{saved ? 'Saved' : 'Save'}</Text>
            </TouchableOpacity>

            {/* Advanced Controls gear */}
            <TouchableOpacity style={ri.actionBtn} onPress={onOpenSettings} activeOpacity={0.8}>
              <Feather name="sliders" size={24} color="#fff" />
              <Text style={[ri.actionLabel, { color: '#fff' }]}>Control</Text>
            </TouchableOpacity>

            {/* View count */}
            {(reel.view_count > 0) && (
              <View style={ri.actionBtn}>
                <Feather name="eye" size={22} color="rgba(255,255,255,0.6)" />
                <Text style={[ri.actionLabel, { color: 'rgba(255,255,255,0.6)' }]}>{fmtCount(reel.view_count)}</Text>
              </View>
            )}

            {/* Message */}
            {user && user.id !== reel.user_id && (
              <TouchableOpacity style={ri.actionBtn} onPress={() => onMessage(author)} activeOpacity={0.8}>
                <Feather name="mail" size={24} color="#fff" />
                <Text style={[ri.actionLabel, { color: '#fff' }]}>DM</Text>
              </TouchableOpacity>
            )}

            {/* Mute / Volume */}
            {isVideo && (
              <TouchableOpacity style={ri.actionBtn} onPress={() => setAudioMuted(m => !m)} activeOpacity={0.8}>
                <Feather name={audioMuted ? 'volume-x' : 'volume-2'} size={24} color="#fff" />
              </TouchableOpacity>
            )}

            {/* Manage (own) / Report (others) */}
            {user && (
              user.id === reel.user_id ? (
                <TouchableOpacity style={ri.actionBtn} onPress={() => onManage?.(reel)} activeOpacity={0.8}>
                  <Feather name="more-vertical" size={22} color="rgba(255,255,255,0.85)" />
                  <Text style={[ri.actionLabel, { color: 'rgba(255,255,255,0.7)' }]}>Manage</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={ri.actionBtn} onPress={handleReport} activeOpacity={0.8}>
                  <Feather name="more-horizontal" size={22} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              )
            )}
          </View>
        )}

        {/* Bottom info */}
        {!playerPref.cleanView && (
          <View style={ri.bottom}>
            <TouchableOpacity onPress={() => onProfile(author)} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={ri.username}>@{author.username || 'Viber'}</Text>
              {author.is_verified && <Feather name="check-circle" size={13} color={primary} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCaptionExpanded(e => !e)} activeOpacity={0.9}>
              <Text style={[ri.caption, { fontSize: captionFontSize, lineHeight: captionLineHeight }]} numberOfLines={captionExpanded ? 0 : 2}>{parsedCaption}</Text>
            </TouchableOpacity>
            {reel.event_title && (
              <TouchableOpacity style={ri.eventPill} activeOpacity={0.8} onPress={() => onOpenEvent?.()} accessibilityRole="button" accessibilityLabel={`Open event: ${reel.event_title}`}>
                <Feather name="calendar" size={10} color={primary} />
                <Text style={[ri.eventPillText, { color: primary }]}>{reel.event_title}</Text>
              </TouchableOpacity>
            )}
            {/* Rotating audio info */}
            <View style={ri.audioPill}>
              <Feather name="music" size={10} color="rgba(255,255,255,0.7)" />
              <Text style={ri.audioPillText} numberOfLines={1}>
                {reel.sound_name || `original sound · @${author.username || 'Viber'}`}
              </Text>
            </View>
          </View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
});

const ri = StyleSheet.create({
  container: { backgroundColor: '#000', position: 'relative' },
  gradient: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent', top: '45%', borderTopWidth: 0 },
  progressBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  progressFill: { height: '100%', borderRadius: 1 },
  heartBurst: { position: 'absolute', alignSelf: 'center', top: '35%', zIndex: 12 },
  pauseOverlay: { position: 'absolute', alignSelf: 'center', top: '40%', backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 40, padding: 12, zIndex: 12 },
  actions: { position: 'absolute', right: 10, bottom: 140, alignItems: 'center', gap: 4, zIndex: 15 },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#fff' },
  followDot: { position: 'absolute', bottom: -6, width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  actionBtn: { alignItems: 'center', paddingVertical: 6 },
  actionLabel: { fontSize: 11, fontWeight: '700', marginTop: 2, textShadowColor: '#000', textShadowRadius: 4 },
  bottom: { position: 'absolute', left: 14, right: 70, bottom: 30, zIndex: 15 },
  username: { color: '#fff', fontWeight: '900', fontSize: 14, marginBottom: 4, textShadowColor: '#000', textShadowRadius: 6 },
  caption: { color: 'rgba(255,255,255,0.92)', textShadowColor: '#000', textShadowRadius: 4 },
  eventPill: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5, backgroundColor: 'rgba(0,0,0,0.5)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  eventPillText: { fontSize: 10, fontWeight: '800' },
  audioPill: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7, backgroundColor: 'rgba(0,0,0,0.45)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, maxWidth: 220 },
  audioPillText: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '600', flex: 1 },
  sticker: { position: 'absolute', left: 24, right: 24, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'center', zIndex: 8 },
  stickerText: { color: '#fff', fontSize: 14, fontWeight: '900', textAlign: 'center', textShadowColor: '#000', textShadowRadius: 4 },
});

// ── Advanced Player Options Sheet ───────────────────────────────────────────
const ReelsAdvancedSettingsSheet = ({ visible, onClose, preferences, onUpdate, primary, bg, textColor, muted, surface }) => {
  useBackClose(visible, onClose);
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 200 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 400, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} />
      </TouchableWithoutFeedback>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <Animated.View style={[as.sheet, { backgroundColor: bg, transform: [{ translateY: slideAnim }] }]}>
          <View style={[as.handle, { backgroundColor: `${primary}40` }]} />
          <View style={as.titleRow}>
            <Text style={[as.title, { color: textColor }]}>Reels Advanced Controls</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={[as.closeBtn, { backgroundColor: `${primary}14`, borderColor: `${primary}30` }]}
              accessibilityRole="button"
              accessibilityLabel="Close advanced controls"
            >
              <Feather name="x" size={18} color={textColor} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            {/* Playback speed */}
            <View style={as.section}>
              <Text style={[as.sectionLabel, { color: muted }]}>PLAYBACK SPEED</Text>
              <View style={as.rowWrap}>
                {PLAYBACK_SPEEDS.map(speed => (
                  <TouchableOpacity
                    key={speed}
                    style={[as.chip, preferences.speed === speed && { backgroundColor: primary, borderColor: primary }]}
                    onPress={() => onUpdate('speed', speed)}
                  >
                    <Text style={[as.chipText, { color: preferences.speed === speed ? '#000' : textColor }]}>{speed}x</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Scale aspect ratio */}
            <View style={as.section}>
              <Text style={[as.sectionLabel, { color: muted }]}>SCREEN SCALE RATIO</Text>
              <View style={as.rowWrap}>
                {ASPECT_RATIOS.map(ratio => (
                  <TouchableOpacity
                    key={ratio}
                    style={[as.chip, preferences.aspectRatio === ratio && { backgroundColor: primary, borderColor: primary }]}
                    onPress={() => {
                      onUpdate('aspectRatio', ratio);
                      if (ratio === 'zoom') {
                        onUpdate('zoomLevel', 1.4);
                      }
                    }}
                  >
                    <Text style={[as.chipText, { color: preferences.aspectRatio === ratio ? '#000' : textColor }]}>
                      {ratio.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {preferences.aspectRatio === 'zoom' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  <Text style={{ color: textColor, fontSize: 11 }}>Zoom Level: {preferences.zoomLevel.toFixed(1)}x</Text>
                  <TouchableOpacity onPress={() => onUpdate('zoomLevel', Math.max(1, preferences.zoomLevel - 0.2))} style={as.zoomBtn}>
                    <Text style={{ color: primary, fontWeight: '900' }}>-</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => onUpdate('zoomLevel', Math.min(3, preferences.zoomLevel + 0.2))} style={as.zoomBtn}>
                    <Text style={{ color: primary, fontWeight: '900' }}>+</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Styling filter presets */}
            <View style={as.section}>
              <Text style={[as.sectionLabel, { color: muted }]}>VISUAL COLOR FILTER</Text>
              <View style={as.rowWrap}>
                {VISUAL_FILTERS.map(filter => (
                  <TouchableOpacity
                    key={filter.id}
                    style={[as.chip, preferences.visualFilter === filter.id && { backgroundColor: primary, borderColor: primary }]}
                    onPress={() => onUpdate('visualFilter', filter.id)}
                  >
                    <Text style={[as.chipText, { color: preferences.visualFilter === filter.id ? '#000' : textColor }]}>
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Readability & Layout Toggles */}
            <View style={as.section}>
              <Text style={[as.sectionLabel, { color: muted }]}>PREFERENCES</Text>
              
              {/* Auto play next */}
              <TouchableOpacity
                style={as.toggleRow}
                onPress={() => onUpdate('autoAdvance', !preferences.autoAdvance)}
              >
                <Text style={{ color: textColor, fontSize: 13, fontWeight: '700' }}>Auto-Advance to Next Reel</Text>
                <Feather name={preferences.autoAdvance ? 'check-square' : 'square'} size={18} color={primary} />
              </TouchableOpacity>

              {/* Clean screen mode */}
              <TouchableOpacity
                style={as.toggleRow}
                onPress={() => onUpdate('cleanView', !preferences.cleanView)}
              >
                <Text style={{ color: textColor, fontSize: 13, fontWeight: '700' }}>Immersive Clean Screen Mode</Text>
                <Feather name={preferences.cleanView ? 'check-square' : 'square'} size={18} color={primary} />
              </TouchableOpacity>
            </View>

            {/* Caption Size */}
            <View style={as.section}>
              <Text style={[as.sectionLabel, { color: muted }]}>CAPTION FONT SIZE</Text>
              <View style={as.rowWrap}>
                {['small', 'medium', 'large'].map(sz => (
                  <TouchableOpacity
                    key={sz}
                    style={[as.chip, preferences.captionScale === sz && { backgroundColor: primary, borderColor: primary }]}
                    onPress={() => onUpdate('captionScale', sz)}
                  >
                    <Text style={[as.chipText, { color: preferences.captionScale === sz ? '#000' : textColor }]}>
                      {sz.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity style={[as.closeBtn, { backgroundColor: primary }]} onPress={onClose}>
            <Text style={{ color: '#000', fontWeight: '900', fontSize: 14 }}>Apply Settings</Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const as = StyleSheet.create({
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 20, paddingBottom: 40 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  title: { fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  section: { marginBottom: 18 },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 11, fontWeight: '700' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  closeBtn: { borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  zoomBtn: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
});

// ── Main ReelsScreen ──────────────────────────────────────────────────────────
export const ReelsScreen = ({ onAuthRequired, onClose, initialReelId, onInitialReelHandled, onExitToDrop, onNavigateToEvent }) => {
  const insets = useSafeAreaInsets();
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const primary   = currentTheme?.primary    || "#00f2ff";
  const bg        = currentTheme?.background || "#0d1112";
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface    || "#1a1f21";

  const { width: winW, height: winH } = useWindowDimensions();
  // Responsive reel dimensions — recalculate on resize
  const REEL_W = IS_WEB ? Math.min(winW, 420) : winW;
  const REEL_H = IS_WEB ? Math.min(winH, 880) : winH;
  const isWide = IS_WEB && winW > 800;

  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [commentTarget, setCommentTarget] = useState(null);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [profileTarget, setProfileTarget] = useState(null);
  const [profileVisible, setProfileVisible] = useState(false);
  const [dmTarget, setDmTarget] = useState(null);
  const [dmVisible, setDmVisible] = useState(false);
  const [tab, setTab] = useState('foryou'); // 'foryou' | 'following' | 'trending'
  const [hashtagFilter, setHashtagFilter] = useState(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [manageTarget, setManageTarget] = useState(null);
  const [manageVisible, setManageVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [playerPref, setPlayerPref] = useState(ReelsPreferences.getPreferences());

  const flatRef = useRef(null);
  const [screenFocused, setScreenFocused] = useState(true);

  // Subscribe to Reels Preferences State Machine changes
  useEffect(() => {
    const unsub = ReelsObservers.subscribe('preference_changed', ({ state }) => {
      setPlayerPref({ ...state });
    });
    const unsubLoad = ReelsObservers.subscribe('preferences_loaded', (state) => {
      setPlayerPref({ ...state });
    });
    return () => {
      unsub();
      unsubLoad();
    };
  }, []);

  const handleUpdatePreference = useCallback((key, value) => {
    ReelsPreferences.updatePreference(key, value);
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      setScreenFocused(state === 'active');
    });
    return () => sub.remove();
  }, []);

  // Handle native Android hardware back button inside ReelsScreen
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const handleBackButton = () => {
      if (settingsVisible) {
        setSettingsVisible(false);
        return true;
      }
      if (commentsVisible) {
        setCommentsVisible(false);
        setCommentTarget(null);
        return true;
      }
      if (profileVisible) {
        setProfileVisible(false);
        setProfileTarget(null);
        return true;
      }
      if (dmVisible) {
        setDmVisible(false);
        setDmTarget(null);
        return true;
      }
      if (createVisible) {
        setCreateVisible(false);
        return true;
      }
      if (manageVisible) {
        setManageVisible(false);
        setManageTarget(null);
        return true;
      }
      return false; // let it bubble to App.js
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', handleBackButton);
    return () => sub.remove();
  }, [commentsVisible, profileVisible, dmVisible, createVisible, manageVisible, settingsVisible]);

  const loadReels = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);

    try {
      // Delegate to ReelsRepository (implements cache, retries, and offline mock fallbacks)
      const data = await ReelsRepository.getReelsFeed({
        tab,
        hashtag: hashtagFilter,
        userId: user?.id
      });

      setReels(data);
      setError(null);

      if (initialReelId && data.length) {
        const idx = data.findIndex(r => r.id === initialReelId);
        if (idx >= 0) {
          setTimeout(() => {
            flatRef.current?.scrollToIndex({ index: idx, animated: false });
            setActiveIndex(idx);
          }, 300);
        }
        onInitialReelHandled?.();
      }
    } catch (e) {
      const message = e?.message || 'Network error';
      setError(message);
      toast.show(`Could not load reels — ${message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, user, hashtagFilter, initialReelId, onInitialReelHandled, toast]);

  useEffect(() => { loadReels(); }, [loadReels]);

  // Real-time: new reels appear at the top of the feed without manual refresh
  useEffect(() => {
    const channel = supabase
      .channel('reels_feed_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reels' }, async (payload) => {
        const newReel = payload.new;
        if (!newReel?.id || !newReel?.media_url) return;
        // Fetch full reel with profile join before prepending. Fall back to a
        // column set that omits metadata/visibility so the prepend still works
        // before those columns are migrated.
        try {
          const FULL = 'id, caption, media_url, media_type, like_count, comment_count, view_count, event_id, event_title, user_id, created_at, sound_name, metadata, visibility, profiles:user_id(id, username, avatar_url, vibe_score, is_verified)';
          const SAFE = 'id, caption, media_url, media_type, like_count, comment_count, view_count, event_id, event_title, user_id, created_at, sound_name, profiles:user_id(id, username, avatar_url, vibe_score, is_verified)';
          let { data } = await supabase.from('reels').select(FULL).eq('id', newReel.id).single();
          if (!data) {
            ({ data } = await supabase.from('reels').select(SAFE).eq('id', newReel.id).single());
          }
          if (data) {
            setReels(prev => {
              if (prev.some(r => r.id === data.id)) return prev;
              return [data, ...prev];
            });
          }
        } catch { /* best-effort */ }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index ?? 0);
  }).current;

  const viewConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const tabSwitcherProps = { insetsTop: insets.top, onClose, hashtagFilter, setHashtagFilter, primary, tab, setTab };

  const onComment = useCallback((r) => { setCommentTarget(r); setCommentsVisible(true); }, []);
  const onProfile = useCallback((p) => { setProfileTarget(p); setProfileVisible(true); }, []);
  const onDmMessage = useCallback((p) => { setDmTarget(p); setDmVisible(true); }, []);

  // Horizontal swipe on a reel: right -> the poster's profile, left -> back to The Drop.
  // Refs keep the memoised responder reading the live reel/index without stale closures.
  const reelsRef = useRef(reels); reelsRef.current = reels;
  const activeIndexRef = useRef(activeIndex); activeIndexRef.current = activeIndex;
  const hSwipe = useMemo(() => PanResponder.create({
    // Only claim clearly-horizontal drags; vertical paging stays with the FlatList.
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 30 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
    onPanResponderRelease: (_e, g) => {
      if (Math.abs(g.dx) < Math.abs(g.dy)) return;
      if (Math.abs(g.dx) < 60 && Math.abs(g.vx) < 0.3) return;
      if (g.dx > 0) {
        const author = reelsRef.current?.[activeIndexRef.current]?.profiles;
        if (author?.id) { try { haptics.select?.(); } catch {} onProfile(author); }
      } else {
        try { haptics.select?.(); } catch {} onExitToDrop?.();
      }
    },
  }), [onProfile, onExitToDrop]);
  const onManage = useCallback((r) => { setManageTarget(r); setManageVisible(true); }, []);

  const handleReelDeleted = useCallback((reelId) => {
    setReels(prev => prev.filter(r => r.id !== reelId));
  }, []);

  const handleCaptionUpdated = useCallback((reelId, newCaption) => {
    setReels(prev => prev.map(r => r.id === reelId ? { ...r, caption: newCaption } : r));
  }, []);
  const onHashtag = useCallback((tag) => {
    setHashtagFilter(tag);
    flatRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  // Auto scroll to next reel on playback complete
  const handleVideoFinish = useCallback(() => {
    if (reels.length > 0 && activeIndex < reels.length - 1) {
      const nextIndex = activeIndex + 1;
      flatRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setActiveIndex(nextIndex);
    }
  }, [reels.length, activeIndex]);

  const renderReelItem = useCallback(({ item, index }) => (
    <ReelItem
      reel={item}
      isActive={index === activeIndex}
      screenFocused={screenFocused}
      primary={primary}
      muted={muted}
      textColor={textColor}
      bg={bg}
      surface={surface}
      user={user}
      onComment={onComment}
      onProfile={onProfile}
      onMessage={onDmMessage}
      onHashtag={onHashtag}
      onManage={onManage}
      onOpenEvent={() => item.event_id && onNavigateToEvent?.({ id: item.event_id, title: item.event_title })}
      onOpenSettings={() => setSettingsVisible(true)}
      playerPref={playerPref}
      onVideoFinish={handleVideoFinish}
      reelW={REEL_W}
      reelH={REEL_H}
    />
  ), [activeIndex, screenFocused, primary, muted, textColor, bg, surface, user, onComment, onProfile, onDmMessage, onHashtag, onManage, onNavigateToEvent, playerPref, handleVideoFinish, REEL_W, REEL_H]);

  if (loading) {
    return (
      <View style={[rs.screen, { backgroundColor: '#000' }]}>
        <ReelTabSwitcher {...tabSwitcherProps} />
        <ReelSkeleton primary={primary} reelW={REEL_W} reelH={REEL_H} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[rs.screen, { backgroundColor: '#000' }]}>
        <ReelTabSwitcher {...tabSwitcherProps} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, marginBottom: 10 }}>Could not load reels</Text>
          <Text style={{ color: muted, fontSize: 13, textAlign: 'center', marginBottom: 18 }}>{error}</Text>
          <TouchableOpacity onPress={() => loadReels()} style={[rs.retryBtn, { borderColor: primary }]} activeOpacity={0.8}>
            <Text style={{ color: primary, fontWeight: '900' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!reels.length) {
    return (
      <View style={[rs.screen, { backgroundColor: '#000' }]}>
        <ReelTabSwitcher {...tabSwitcherProps} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
          <Feather name="film" size={44} color={primary} style={{ marginBottom: 14, opacity: 0.9 }} />
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 17, marginBottom: 8 }}>No reels yet</Text>
          <Text style={{ color: muted, fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 19 }}>
            {hashtagFilter ? `Nothing tagged ${hashtagFilter} yet.` : 'Be the first to drop a reel and set the vibe.'}
          </Text>
          <TouchableOpacity onPress={() => setCreateVisible(true)} style={[rs.retryBtn, { borderColor: primary, backgroundColor: `${primary}14` }]} activeOpacity={0.85}>
            <Text style={{ color: primary, fontWeight: '900' }}>Create a Reel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const reelFeed = (
    <View style={IS_WEB
      ? { width: REEL_W, height: REEL_H, overflow: 'hidden', backgroundColor: '#000', borderRadius: IS_WEB ? 16 : 0 }
      : rs.screen
    }>
      <ReelTabSwitcher {...tabSwitcherProps} absolute />
      <FlatList
        ref={flatRef}
        data={reels}
        keyExtractor={item => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToAlignment="start"
        decelerationRate="fast"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); try { await loadReels(true); } catch (err) { console.warn('Refresh error:', err); } finally { setRefreshing(false); } }}
            tintColor={primary}
            colors={[primary]}
          />
        }
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewConfig}
        getItemLayout={(_, index) => ({ length: REEL_H, offset: REEL_H * index, index })}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews={!IS_WEB}
        renderItem={renderReelItem}
      />
    </View>
  );

  return (
    <ErrorBoundary label="Reels">
    <View style={[rs.screen, IS_WEB && {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: "#050505",
      minHeight: '100vh',
    }]}>

      {/* Left sidebar — trending */}
      {isWide && (
        <View style={[rs.webSidebar, { borderColor: `${primary}12` }]}>
          <Text style={[rs.sidebarHeading, { color: primary }]}>Trending</Text>
          {reels.slice(0, 6).map(r => (
            <TouchableOpacity
              key={r.id}
              style={[rs.sidebarItem, { borderColor: `${primary}18`, backgroundColor: `${primary}06` }]}
              activeOpacity={0.8}
              onPress={() => {
                const idx = reels.findIndex(x => x.id === r.id);
                if (idx >= 0) {
                  flatRef.current?.scrollToIndex({ index: idx, animated: true });
                  setActiveIndex(idx);
                }
              }}
            >
              {r.media_url
                ? <Image source={{ uri: r.media_url }} style={rs.sidebarThumb} />
                : <View style={[rs.sidebarThumb, { backgroundColor: `${primary}20` }]} />
              }
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }} numberOfLines={1}>
                  @{r.profiles?.username}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, lineHeight: 14 }} numberOfLines={2}>{r.caption}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Centre reel feed + FAB wrapper */}
      <View style={{ position: 'relative', flex: IS_WEB ? undefined : 1 }} {...hSwipe.panHandlers}>
        {reelFeed}
        {/* Create Reel FAB — anchored to the feed frame */}
        {user && (
          <TouchableOpacity
            style={[rs.fab, { backgroundColor: primary, bottom: IS_WEB ? 24 : (insets.bottom || 16) + 16 }]}
            onPress={() => setCreateVisible(true)}
            activeOpacity={0.85}
          >
            <Feather name="plus" size={22} color="#000" />
          </TouchableOpacity>
        )}
      </View>

      {/* Right — scroll nav + post button */}
      {isWide && (
        <View style={rs.webSideRight}>
          <TouchableOpacity
            style={[rs.sideNavBtn, { borderColor: `${primary}30` }]}
            onPress={() => {
              const prev = Math.max(0, activeIndex - 1);
              flatRef.current?.scrollToIndex({ index: prev, animated: true });
              setActiveIndex(prev);
            }}
          >
            <Feather name="chevron-up" size={22} color={primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[rs.sideNavBtn, { borderColor: `${primary}30` }]}
            onPress={() => {
              const next = Math.min(reels.length - 1, activeIndex + 1);
              flatRef.current?.scrollToIndex({ index: next, animated: true });
              setActiveIndex(next);
            }}
          >
            <Feather name="chevron-down" size={22} color={primary} />
          </TouchableOpacity>
        </View>
      )}

      <CommentsSheet
        visible={commentsVisible}
        onClose={() => { setCommentsVisible(false); setCommentTarget(null); }}
        reel={commentTarget}
        primary={primary}
        bg={bg}
        textColor={textColor}
        muted={muted}
        surface={surface}
        user={user}
      />

      <ViberProfileModal
        visible={profileVisible}
        user={profileTarget}
        userId={profileTarget?.id}
        onClose={() => setProfileVisible(false)}
      />

      {dmVisible && dmTarget && (
        <DirectMessageModal
          visible={dmVisible}
          onClose={() => { setDmVisible(false); setDmTarget(null); }}
          recipient={dmTarget}
        />
      )}

      <CreateReelModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onPosted={() => { setCreateVisible(false); loadReels(); }}
      />

      <ReelManageSheet
        visible={manageVisible}
        reel={manageTarget}
        onClose={() => { setManageVisible(false); setManageTarget(null); }}
        onDeleted={handleReelDeleted}
        onCaptionUpdated={handleCaptionUpdated}
        primary={primary}
        bg={bg}
        textColor={textColor}
        muted={muted}
        surface={surface}
        user={user}
      />

      <ReelsAdvancedSettingsSheet
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        preferences={playerPref}
        onUpdate={handleUpdatePreference}
        primary={primary}
        bg={bg}
        textColor={textColor}
        muted={muted}
        surface={surface}
      />
    </View>

    </ErrorBoundary>
  );
};

const rs = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  webSidebar: {
    width: 240,
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 8,
    borderRightWidth: 1,
    alignSelf: 'stretch',
    justifyContent: 'flex-start',
  },
  webSideRight: { width: 100, justifyContent: 'center', alignItems: 'center', gap: 16, alignSelf: 'stretch' },
  sidebarHeading: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5, marginBottom: 8 },
  sidebarItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: 1 },
  sidebarThumb: { width: 48, height: 64, borderRadius: 8, backgroundColor: '#111' },
  sideNavBtn: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  fab: { position: 'absolute', right: 18, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.4, shadowOffset: { width: 0, height: 3 }, shadowRadius: 6 },
  tabBar: { flexDirection: 'row', justifyContent: 'center', gap: 32, paddingBottom: 12, backgroundColor: 'rgba(0,0,0,0.4)' },
  tabBarAbsolute: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  tabLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: '800', letterSpacing: 0.5, textShadowColor: '#000', textShadowRadius: 6 },
  tabActive: { color: '#fff' },
  tabUnderline: { height: 2, borderRadius: 1, marginTop: 3 },
  retryBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12 },
});
