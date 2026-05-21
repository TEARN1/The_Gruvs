/**
 * ReelsScreen — Short-form vertical video feed (TikTok/Reels style).
 * Features: snap-scroll, like/comment/share, follow from reel, mention tagging,
 * volume control, caption expand, duet/stitch concept, mute toggle, speed control,
 * progress bar, double-tap like, swipe-up details, hashtag discovery.
 */
import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TouchableWithoutFeedback,
  Image, Dimensions, Platform, TextInput, Modal, ScrollView, KeyboardAvoidingView,
  Animated, ActivityIndicator, Share, PanResponder, Alert, RefreshControl, AppState,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastNotification';
import { supabase } from '../services/supabase';
import { resilient } from '../utils/resilience';
import { ViberProfileModal } from '../components/ViberProfileModal';
import { DirectMessageModal } from '../components/DirectMessageModal';
import { CreateReelModal } from '../components/CreateReelModal';

const { width: SW, height: SH } = Dimensions.get('window');
const IS_WEB = Platform.OS === 'web';
// On web constrain reel to phone-like frame
const REEL_W = IS_WEB ? Math.min(SW, 420) : SW;
const REEL_H = IS_WEB ? Math.min(SH, 820) : SH;

const avatarBg = (u = '') =>
  ['#0891b2', '#7c3aed', '#059669', '#d97706', '#db2777'][(u.charCodeAt(0) || 0) % 5];

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
const ReelSkeleton = ({ primary }) => {
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
    <View style={{ width: REEL_W, height: REEL_H, backgroundColor: '#0a0a0a' }}>
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

// ── Comment sheet ─────────────────────────────────────────────────────────────
const CommentsSheet = ({ visible, onClose, reel, primary, bg, textColor, muted, surface, user }) => {
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible || !reel) return;
    setLoading(true);
    supabase
      .from('reel_comments')
      .select('id, body, created_at, profiles:user_id(id, username, avatar_url)')
      .eq('reel_id', reel.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { setComments(data || []); })
      .catch(() => {})
      .finally(() => { setLoading(false); });
  }, [visible, reel?.id]);

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
            const { error } = await supabase.from('reel_comments').insert({ reel_id: reel.id, user_id: user.id, body: text });
            if (error) throw error;
            return true;
          },
          // Tier 2: upsert
          async () => {
            const { error } = await supabase.from('reel_comments').upsert({ reel_id: reel.id, user_id: user.id, body: text, created_at: new Date().toISOString() });
            if (error) throw error;
            return true;
          },
          // Tier 3: RPC send comment
          async () => {
            const { error } = await supabase.rpc('add_reel_comment', { p_reel_id: reel.id, p_user_id: user.id, p_body: text });
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
              {comments.map(c => (
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
                </View>
              ))}
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
  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 14, alignItems: 'flex-start' },
  commentAvatar: { width: 32, height: 32, borderRadius: 16 },
  commentUser: { fontSize: 11, fontWeight: '800', marginBottom: 2 },
  commentBody: { fontSize: 13, lineHeight: 18 },
  commentInput: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1 },
  commentBox: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, maxHeight: 80 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});

// ── Single Reel Item ──────────────────────────────────────────────────────────
const ReelItem = memo(({ reel, isActive, screenFocused, primary, muted, textColor, bg, surface, user, onComment, onProfile, onMessage, onHashtag }) => {
  const videoRef = useRef(null);
  const lastTap = useRef(0);
  const heartAnim = useRef(new Animated.Value(0)).current;
  const heartScale = useRef(new Animated.Value(0)).current;
  const progressBarRef = useRef(null);

  const [liked, setLiked] = useState(reel._liked || false);
  const [likeCount, setLikeCount] = useState(reel.like_count || 0);
  const [audioMuted, setAudioMuted] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [following, setFollowing] = useState(reel._following || false);
  const [saved, setSaved] = useState(reel._saved || false);
  const [paused, setPaused] = useState(false);
  const [showPauseIcon, setShowPauseIcon] = useState(false);
  const pauseIconAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive && screenFocused && !paused) {
      videoRef.current?.playAsync().catch(() => {});
      if (user && reel?.id) {
        supabase.from('reel_views').upsert(
          { reel_id: reel.id, viewer_id: user.id },
          { onConflict: 'reel_id,viewer_id', ignoreDuplicates: true }
        ).then(() => {});
      }
    } else {
      videoRef.current?.pauseAsync().catch(() => {});
    }
  }, [isActive, screenFocused, paused]);

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

  // Declarations moved above parsedCaption to avoid temporal dead zone crash
  const isVideo = reel.media_type === 'video';
  const author = reel.profiles || {};
  const caption = reel.caption || '';
  const hashtags = (caption.match(/#\w+/g) || []);

  const parsedCaption = caption.split(/(\s+)/).map((word, i) => {
    if (word.startsWith('#')) {
      return <Text key={i} style={{ color: primary, fontWeight: '800' }} onPress={() => onHashtag?.(word)}>{word}</Text>;
    }
    if (word.startsWith('@')) {
      return <Text key={i} style={{ color: '#60a5fa', fontWeight: '800' }}>{word}</Text>;
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
      { text: 'Spam', onPress: async () => { await supabase.from('reel_reports').upsert({ reel_id: reel.id, reporter_id: user?.id, reason: 'spam' }, { onConflict: 'reel_id,reporter_id' }); Alert.alert('Thanks', 'Report submitted.'); } },
      { text: 'Inappropriate', onPress: async () => { await supabase.from('reel_reports').upsert({ reel_id: reel.id, reporter_id: user?.id, reason: 'inappropriate' }, { onConflict: 'reel_id,reporter_id' }); Alert.alert('Thanks', 'Report submitted.'); } },
      { text: 'Misleading', onPress: async () => { await supabase.from('reel_reports').upsert({ reel_id: reel.id, reporter_id: user?.id, reason: 'misleading' }, { onConflict: 'reel_id,reporter_id' }); Alert.alert('Thanks', 'Report submitted.'); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const triggerLike = async () => {
    if (!user) return;
    const newLiked = !liked;
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
      const ok = await resilient(
        newLiked ? [
          // Tier 1: upsert like row
          () => supabase.from('reel_likes').upsert({ reel_id: reel.id, user_id: user.id }, { onConflict: 'reel_id,user_id', ignoreDuplicates: true }),
          // Tier 2: plain insert
          () => supabase.from('reel_likes').insert({ reel_id: reel.id, user_id: user.id }),
          // Tier 3: RPC increment
          () => supabase.rpc('increment_reel_like', { p_reel_id: reel.id, p_user_id: user.id }),
        ] : [
          // Tier 1: delete like row
          () => supabase.from('reel_likes').delete().eq('reel_id', reel.id).eq('user_id', user.id),
          // Tier 2: soft-flag removal
          () => supabase.from('reel_likes').update({ removed: true }).eq('reel_id', reel.id).eq('user_id', user.id),
          // Tier 3: RPC decrement
          () => supabase.rpc('decrement_reel_like', { p_reel_id: reel.id, p_user_id: user.id }),
        ],
        { attemptsPerTier: 3, baseMs: 300, label: 'ReelItem.triggerLike', fallbackValue: null }
      );
      if (ok === null) throw new Error('all tiers failed');
    } catch {
      // Rollback optimistic update
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
        () => supabase.from('follows').upsert({ follower_id: user.id, following_id: reel.user_id }, { onConflict: 'follower_id,following_id', ignoreDuplicates: true }),
        () => supabase.from('follows').insert({ follower_id: user.id, following_id: reel.user_id }),
        () => supabase.rpc('follow_user', { p_follower: user.id, p_following: reel.user_id }),
      ] : [
        () => supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', reel.user_id),
        () => supabase.from('follows').update({ unfollowed_at: new Date().toISOString() }).eq('follower_id', user.id).eq('following_id', reel.user_id),
        () => supabase.rpc('unfollow_user', { p_follower: user.id, p_following: reel.user_id }),
      ],
      { attemptsPerTier: 3, baseMs: 300, label: 'ReelItem.handleFollow', fallbackValue: null }
    );
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: `Check out @${reel.profiles?.username}'s reel on The Gruvs!` });
    } catch {}
  };

  const handleSave = async () => {
    if (!user) return;
    const newSaved = !saved;
    setSaved(newSaved);
    await resilient(
      newSaved ? [
        () => supabase.from('saved_reels').upsert({ reel_id: reel.id, user_id: user.id }, { onConflict: 'reel_id,user_id', ignoreDuplicates: true }),
        () => supabase.from('saved_reels').insert({ reel_id: reel.id, user_id: user.id }),
        () => supabase.rpc('save_reel', { p_reel_id: reel.id, p_user_id: user.id }),
      ] : [
        () => supabase.from('saved_reels').delete().eq('reel_id', reel.id).eq('user_id', user.id),
        () => supabase.from('saved_reels').update({ removed: true }).eq('reel_id', reel.id).eq('user_id', user.id),
        () => supabase.rpc('unsave_reel', { p_reel_id: reel.id, p_user_id: user.id }),
      ],
      { attemptsPerTier: 3, baseMs: 300, label: 'ReelItem.handleSave', fallbackValue: null }
    );
  };

  return (
    <TouchableWithoutFeedback onPress={handleTap}>
      <View style={[ri.container, { width: REEL_W, height: REEL_H }]}>
        {/* Media */}
        {isVideo ? (
          <Video
            ref={videoRef}
            source={{ uri: reel.media_url }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.COVER}
            isLooping
            isMuted={audioMuted}
            rate={speed}
            shouldPlay={isActive}
            onReadyForDisplay={() => setVideoLoaded(true)}
            onPlaybackStatusUpdate={s => {
              if (s.durationMillis) {
                setDuration(s.durationMillis);
                setProgress(s.positionMillis / s.durationMillis);
              }
            }}
          />
        ) : (
          <Image source={{ uri: reel.media_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        )}

        {/* Dark gradient overlay */}
        <View style={ri.gradient} />

        {/* Seekable progress bar (video only) */}
        {isVideo && duration > 0 && (
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

          {/* Speed selector */}
          {isVideo && (
            <TouchableOpacity
              style={ri.actionBtn}
              onPress={() => setSpeed(s => s === 1 ? 1.5 : s === 1.5 ? 0.5 : 1)}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>{speed}x</Text>
            </TouchableOpacity>
          )}

          {/* Report / more */}
          {user && user.id !== reel.user_id && (
            <TouchableOpacity style={ri.actionBtn} onPress={handleReport} activeOpacity={0.8}>
              <Feather name="more-horizontal" size={22} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          )}
        </View>

        {/* Bottom info */}
        <View style={ri.bottom}>
          <TouchableOpacity onPress={() => onProfile(author)} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={ri.username}>@{author.username || 'Viber'}</Text>
            {author.is_verified && <Feather name="check-circle" size={13} color={primary} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCaptionExpanded(e => !e)} activeOpacity={0.9}>
            <Text style={ri.caption} numberOfLines={captionExpanded ? 0 : 2}>{parsedCaption}</Text>
          </TouchableOpacity>
          {reel.event_title && (
            <View style={ri.eventPill}>
              <Feather name="calendar" size={10} color={primary} />
              <Text style={[ri.eventPillText, { color: primary }]}>{reel.event_title}</Text>
            </View>
          )}
          {/* Rotating audio info */}
          <View style={ri.audioPill}>
            <Feather name="music" size={10} color="rgba(255,255,255,0.7)" />
            <Text style={ri.audioPillText} numberOfLines={1}>
              {reel.sound_name || `original sound · @${author.username || 'Viber'}`}
            </Text>
          </View>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
});
const ri = StyleSheet.create({
  container: { backgroundColor: '#000' },
  gradient: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent', top: '45%',
    // Bottom-up dark fade so caption/actions are readable
    borderTopWidth: 0 },
  progressBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  progressFill: { height: '100%', borderRadius: 1 },
  heartBurst: { position: 'absolute', alignSelf: 'center', top: '35%' },
  pauseOverlay: { position: 'absolute', alignSelf: 'center', top: '40%', backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 40, padding: 12 },
  actions: { position: 'absolute', right: 10, bottom: 140, alignItems: 'center', gap: 4 },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#fff' },
  followDot: { position: 'absolute', bottom: -6, width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  actionBtn: { alignItems: 'center', paddingVertical: 6 },
  actionLabel: { fontSize: 11, fontWeight: '700', marginTop: 2, textShadowColor: '#000', textShadowRadius: 4 },
  bottom: { position: 'absolute', left: 14, right: 70, bottom: 30 },
  username: { color: '#fff', fontWeight: '900', fontSize: 14, marginBottom: 4, textShadowColor: '#000', textShadowRadius: 6 },
  caption: { color: 'rgba(255,255,255,0.92)', fontSize: 13, lineHeight: 18, textShadowColor: '#000', textShadowRadius: 4 },
  eventPill: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5, backgroundColor: 'rgba(0,0,0,0.5)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  eventPillText: { fontSize: 10, fontWeight: '800' },
  audioPill: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7, backgroundColor: 'rgba(0,0,0,0.45)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, maxWidth: 220 },
  audioPillText: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '600', flex: 1 },
});

// ── Main ReelsScreen ──────────────────────────────────────────────────────────
export const ReelsScreen = ({ onAuthRequired, onClose, initialReelId, onInitialReelHandled }) => {
  const insets = useSafeAreaInsets();
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface    || '#1a1f21';

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

  const flatRef = useRef(null);
  const [screenFocused, setScreenFocused] = useState(true);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      setScreenFocused(state === 'active');
    });
    return () => sub.remove();
  }, []);

  const loadReels = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);

    const applyOrder = (qb) => {
      if (tab === 'trending') return qb.order('like_count', { ascending: false });
      return qb.order('created_at', { ascending: false });
    };

    // Resolve followed IDs once for the 'following' tab
    let followedIds = [];
    if (tab === 'following' && user) {
      try {
        const { data } = await supabase.from('follows').select('following_id').eq('follower_id', user.id).limit(200);
        followedIds = (data || []).map(r => r.following_id);
      } catch { followedIds = []; }
    }

    const enrich = async (data) => {
      let enriched = data || [];
      if (user && enriched.length) {
        try {
          const { data: likedData } = await supabase
            .from('reel_likes').select('reel_id').eq('user_id', user.id)
            .in('reel_id', enriched.map(r => r.id));
          const likedSet = new Set((likedData || []).map(r => r.reel_id));
          enriched = enriched.map(r => ({ ...r, _liked: likedSet.has(r.id) }));
        } catch { /* likes not critical — show reels without like state */ }
      }
      return enriched;
    };

    try {
      const data = await resilient(
        [
          // Tier 1: full select with profile join
          async () => {
            let qb = supabase.from('reels')
              .select('id, caption, media_url, media_type, like_count, comment_count, view_count, event_id, event_title, user_id, created_at, sound_name, profiles:user_id(id, username, avatar_url, vibe_score, is_verified)')
              .eq('is_deleted', false).limit(30);
            if (tab === 'following' && followedIds.length) qb = qb.in('user_id', followedIds);
            if (hashtagFilter) qb = qb.ilike('caption', `%${hashtagFilter}%`);
            qb = applyOrder(qb);
            const { data: d, error } = await qb;
            if (error) throw error;
            return d;
          },
          // Tier 2: no profile join — lighter
          async () => {
            let qb = supabase.from('reels')
              .select('id, caption, media_url, media_type, like_count, comment_count, view_count, user_id, created_at')
              .eq('is_deleted', false).limit(30);
            if (tab === 'following' && followedIds.length) qb = qb.in('user_id', followedIds);
            if (hashtagFilter) qb = qb.ilike('caption', `%${hashtagFilter}%`);
            qb = applyOrder(qb);
            const { data: d, error } = await qb;
            if (error) throw error;
            return d;
          },
          // Tier 3: minimal fields, no filters — always returns something
          async () => {
            const { data: d, error } = await supabase.from('reels')
              .select('id, caption, media_url, media_type, like_count, user_id, created_at')
              .eq('is_deleted', false).order('created_at', { ascending: false }).limit(15);
            if (error) throw error;
            return d;
          },
        ],
        { attemptsPerTier: 3, baseMs: 300, label: 'ReelsScreen.loadReels', fallbackValue: [] }
      );

      const enriched = await enrich(data);
      setReels(enriched);
      setError(null);

      if (initialReelId && enriched.length) {
        const idx = enriched.findIndex(r => r.id === initialReelId);
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

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index ?? 0);
  }).current;

  const viewConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const tabSwitcherProps = { insetsTop: insets.top, onClose, hashtagFilter, setHashtagFilter, primary, tab, setTab };

  const onComment = useCallback((r) => { setCommentTarget(r); setCommentsVisible(true); }, []);
  const onProfile = useCallback((p) => { setProfileTarget(p); setProfileVisible(true); }, []);
  const onDmMessage = useCallback((p) => { setDmTarget(p); setDmVisible(true); }, []);
  const onHashtag = useCallback((tag) => {
    setHashtagFilter(tag);
    flatRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

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
    />
  ), [activeIndex, screenFocused, primary, muted, textColor, bg, surface, user, onComment, onProfile, onDmMessage, onHashtag]);

  if (loading) {
    return (
      <View style={[rs.screen, { backgroundColor: '#000' }]}>
        <ReelTabSwitcher {...tabSwitcherProps} />
        <ReelSkeleton primary={primary} />
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

  const reelFeed = (
    <View style={IS_WEB ? rs.webFeedContainer : rs.screen}>
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
            onRefresh={async () => { setRefreshing(true); try { await loadReels(true); } catch { } finally { setRefreshing(false); } }}
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
    <View style={[rs.screen, IS_WEB && rs.webRoot]}>
      {IS_WEB && SW > 800 && (
        <View style={rs.webSidebar}>
          <Text style={[rs.sidebarHeading, { color: primary }]}>Trending</Text>
          {reels.slice(0, 5).map(r => (
            <TouchableOpacity
              key={r.id}
              style={[rs.sidebarItem, { borderColor: `${primary}20` }]}
              onPress={() => {
                const idx = reels.findIndex(x => x.id === r.id);
                if (idx >= 0) {
                  flatRef.current?.scrollToIndex({ index: idx, animated: true });
                  setActiveIndex(idx);
                }
              }}
            >
              <Image source={{ uri: r.media_url }} style={rs.sidebarThumb} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
                  @{r.profiles?.username}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }} numberOfLines={1}>{r.caption}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {reelFeed}

      {IS_WEB && SW > 800 && (
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

      {/* Create Reel FAB */}
      {user && (
        <TouchableOpacity
          style={[rs.fab, { backgroundColor: primary, bottom: (insets.bottom || 16) + 16 }]}
          onPress={() => setCreateVisible(true)}
          activeOpacity={0.85}
        >
          <Feather name="plus" size={22} color="#000" />
        </TouchableOpacity>
      )}

      <CreateReelModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onPosted={() => { setCreateVisible(false); loadReels(); }}
      />
    </View>
  );
};

const rs = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  webRoot: { flexDirection: 'row', justifyContent: 'center', alignItems: 'stretch', backgroundColor: '#000' },
  webFeedContainer: { width: REEL_W, height: REEL_H, overflow: 'hidden', backgroundColor: '#000' },
  webSidebar: { width: 220, paddingTop: 60, paddingHorizontal: 16, gap: 10 },
  webSideRight: { width: 80, justifyContent: 'center', alignItems: 'center', gap: 16 },
  sidebarHeading: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5, marginBottom: 8 },
  sidebarItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 10, borderWidth: 1 },
  sidebarThumb: { width: 44, height: 60, borderRadius: 6, backgroundColor: '#111' },
  sideNavBtn: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  fab: { position: 'absolute', right: 18, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.4, shadowOffset: { width: 0, height: 3 }, shadowRadius: 6 },
  tabBar: { flexDirection: 'row', justifyContent: 'center', gap: 32, paddingBottom: 12, backgroundColor: 'rgba(0,0,0,0.4)' },
  tabBarAbsolute: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  tabLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: '800', letterSpacing: 0.5, textShadowColor: '#000', textShadowRadius: 6 },
  tabActive: { color: '#fff' },
  tabUnderline: { height: 2, borderRadius: 1, marginTop: 3 },
  retryBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12 },
});
