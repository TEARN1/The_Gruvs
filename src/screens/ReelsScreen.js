/**
 * ReelsScreen — Short-form vertical video feed (TikTok/Reels style).
 * Features: snap-scroll, like/comment/share, follow from reel, mention tagging,
 * volume control, caption expand, duet/stitch concept, mute toggle, speed control,
 * progress bar, double-tap like, swipe-up details, hashtag discovery.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TouchableWithoutFeedback,
  Image, Dimensions, Platform, TextInput, Modal, ScrollView, KeyboardAvoidingView,
  Animated, ActivityIndicator, Share,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastNotification';
import { supabase } from '../services/supabase';
import { ViberProfileModal } from '../components/ViberProfileModal';
import { DirectMessageModal } from '../components/DirectMessageModal';

const { width: SW, height: SH } = Dimensions.get('window');

const avatarBg = (u = '') =>
  ['#0891b2', '#7c3aed', '#059669', '#d97706', '#db2777'][(u.charCodeAt(0) || 0) % 5];

const fmtCount = (n) => {
  if (!n) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
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
      .then(({ data }) => { setComments(data || []); setLoading(false); });
  }, [visible, reel?.id]);

  const sendComment = async () => {
    if (!body.trim() || !user) return;
    setSending(true);
    const text = body.trim();
    setBody('');
    const { error } = await supabase.from('reel_comments').insert({ reel_id: reel.id, user_id: user.id, body: text });
    if (!error) {
      const { data } = await supabase
        .from('profiles').select('id, username, avatar_url').eq('id', user.id).single();
      setComments(prev => [{ id: Date.now(), body: text, created_at: new Date().toISOString(), profiles: data }, ...prev]);
    }
    setSending(false);
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
const ReelItem = ({ reel, isActive, primary, muted, textColor, bg, surface, user, onComment, onProfile, onMessage }) => {
  const videoRef = useRef(null);
  const doubleTapTimer = useRef(null);
  const lastTap = useRef(0);
  const heartAnim = useRef(new Animated.Value(0)).current;
  const heartScale = useRef(new Animated.Value(0)).current;

  const [liked, setLiked] = useState(reel._liked || false);
  const [likeCount, setLikeCount] = useState(reel.like_count || 0);
  const [audioMuted, setAudioMuted] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [following, setFollowing] = useState(reel._following || false);

  useEffect(() => {
    if (isActive) {
      videoRef.current?.playAsync().catch(() => {});
      // Log view (unique per user per reel — DB has primary key guard)
      if (user && reel?.id) {
        supabase.from('reel_views').upsert(
          { reel_id: reel.id, viewer_id: user.id },
          { onConflict: 'reel_id,viewer_id', ignoreDuplicates: true }
        ).then(() => {});
      }
    } else {
      videoRef.current?.pauseAsync().catch(() => {});
    }
  }, [isActive]);

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      triggerLike();
    }
    lastTap.current = now;
  };

  const triggerLike = async () => {
    if (!user) return;
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount(c => newLiked ? c + 1 : Math.max(0, c - 1));
    // Burst heart animation
    heartAnim.setValue(1);
    heartScale.setValue(0);
    Animated.parallel([
      Animated.timing(heartScale, { toValue: 1.4, duration: 200, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(heartAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
    if (newLiked) {
      await supabase.from('reel_likes').upsert({ reel_id: reel.id, user_id: user.id }, { onConflict: 'reel_id,user_id', ignoreDuplicates: true });
    } else {
      await supabase.from('reel_likes').delete().eq('reel_id', reel.id).eq('user_id', user.id);
    }
  };

  const handleFollow = async () => {
    if (!user) return;
    const newFollowing = !following;
    setFollowing(newFollowing);
    if (newFollowing) {
      await supabase.from('follows').upsert({ follower_id: user.id, following_id: reel.user_id }, { onConflict: 'follower_id,following_id', ignoreDuplicates: true });
    } else {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', reel.user_id);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: `Check out @${reel.profiles?.username}'s reel on The Gruvs!` });
    } catch {}
  };

  const isVideo = reel.media_type === 'video';
  const author = reel.profiles || {};
  const caption = reel.caption || '';
  const hashtags = (caption.match(/#\w+/g) || []);

  return (
    <TouchableWithoutFeedback onPress={handleDoubleTap}>
      <View style={[ri.container, { width: SW, height: SH }]}>
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

        {/* Progress bar (video only) */}
        {isVideo && duration > 0 && (
          <View style={ri.progressBar}>
            <View style={[ri.progressFill, { width: `${progress * 100}%`, backgroundColor: primary }]} />
          </View>
        )}

        {/* Double-tap heart burst */}
        <Animated.View style={[ri.heartBurst, { opacity: heartAnim, transform: [{ scale: heartScale }] }]}>
          <Text style={{ fontSize: 70 }}>❤️</Text>
        </Animated.View>

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
        </View>

        {/* Bottom info */}
        <View style={ri.bottom}>
          <TouchableOpacity onPress={() => onProfile(author)} activeOpacity={0.8}>
            <Text style={ri.username}>@{author.username || 'Viber'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCaptionExpanded(e => !e)} activeOpacity={0.9}>
            <Text style={ri.caption} numberOfLines={captionExpanded ? 0 : 2}>{caption}</Text>
          </TouchableOpacity>
          {hashtags.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {hashtags.map((tag, i) => (
                <Text key={i} style={[ri.hashtag, { color: primary }]}>{tag}</Text>
              ))}
            </View>
          )}
          {reel.event_title && (
            <View style={ri.eventPill}>
              <Feather name="calendar" size={10} color={primary} />
              <Text style={[ri.eventPillText, { color: primary }]}>{reel.event_title}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
};
const ri = StyleSheet.create({
  container: { backgroundColor: '#000' },
  gradient: { ...StyleSheet.absoluteFillObject, background: undefined, backgroundColor: 'transparent',
    // simulate bottom gradient
    top: '40%', borderTopWidth: 0 },
  progressBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  progressFill: { height: '100%', borderRadius: 1 },
  heartBurst: { position: 'absolute', alignSelf: 'center', top: '35%' },
  actions: { position: 'absolute', right: 10, bottom: 120, alignItems: 'center', gap: 4 },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#fff' },
  followDot: { position: 'absolute', bottom: -6, width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  actionBtn: { alignItems: 'center', paddingVertical: 6 },
  actionLabel: { fontSize: 11, fontWeight: '700', marginTop: 2, textShadowColor: '#000', textShadowRadius: 4 },
  bottom: { position: 'absolute', left: 14, right: 70, bottom: 24 },
  username: { color: '#fff', fontWeight: '900', fontSize: 14, marginBottom: 4, textShadowColor: '#000', textShadowRadius: 6 },
  caption: { color: 'rgba(255,255,255,0.92)', fontSize: 13, lineHeight: 18, textShadowColor: '#000', textShadowRadius: 4 },
  hashtag: { fontSize: 12, fontWeight: '800' },
  eventPill: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, backgroundColor: 'rgba(0,0,0,0.5)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  eventPillText: { fontSize: 10, fontWeight: '800' },
});

// ── Main ReelsScreen ──────────────────────────────────────────────────────────
export const ReelsScreen = ({ onAuthRequired, onClose }) => {
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
  const [activeIndex, setActiveIndex] = useState(0);
  const [commentTarget, setCommentTarget] = useState(null);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [profileTarget, setProfileTarget] = useState(null);
  const [profileVisible, setProfileVisible] = useState(false);
  const [dmTarget, setDmTarget] = useState(null);
  const [dmVisible, setDmVisible] = useState(false);
  const [tab, setTab] = useState('foryou'); // 'foryou' | 'following'

  const flatRef = useRef(null);

  const loadReels = useCallback(async () => {
    setLoading(true);
    try {
      let qb = supabase
        .from('reels')
        .select(`
          id, caption, media_url, media_type, like_count, comment_count, view_count,
          event_id, event_title, user_id, created_at,
          profiles:user_id(id, username, avatar_url, vibe_score, is_verified)
        `)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(30);

      if (tab === 'following' && user) {
        const { data: followData } = await supabase.from('follows').select('following_id').eq('follower_id', user.id).limit(200);
        const ids = (followData || []).map(r => r.following_id);
        if (ids.length) qb = qb.in('user_id', ids);
      }

      const { data, error } = await qb;
      if (error) throw error;

      let enriched = data || [];
      if (user && enriched.length) {
        const { data: likedData } = await supabase
          .from('reel_likes').select('reel_id').eq('user_id', user.id)
          .in('reel_id', enriched.map(r => r.id));
        const likedSet = new Set((likedData || []).map(r => r.reel_id));
        enriched = enriched.map(r => ({ ...r, _liked: likedSet.has(r.id) }));
      }

      setReels(enriched);
    } catch (e) {
      toast.show('Could not load reels', 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, user]);

  useEffect(() => { loadReels(); }, [loadReels]);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index ?? 0);
  }).current;

  const viewConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  if (loading) {
    return (
      <View style={[rs.screen, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={primary} size="large" />
        <Text style={{ color: muted, marginTop: 12, fontSize: 13 }}>Loading Reels...</Text>
      </View>
    );
  }

  if (!reels.length) {
    return (
      <View style={[rs.screen, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontSize: 36 }}>🎬</Text>
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, marginTop: 12 }}>No Reels yet</Text>
        <Text style={{ color: muted, fontSize: 13, marginTop: 6 }}>Be the first to post a reel on The Gruvs</Text>
      </View>
    );
  }

  return (
    <View style={[rs.screen, { paddingTop: insets.top }]}>
      {/* Tab bar overlay */}
      <View style={rs.tabBar}>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={{ position: 'absolute', left: 16 }}>
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => setTab('foryou')}>
          <Text style={[rs.tabLabel, tab === 'foryou' && rs.tabActive]}>For You</Text>
          {tab === 'foryou' && <View style={[rs.tabUnderline, { backgroundColor: primary }]} />}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('following')}>
          <Text style={[rs.tabLabel, tab === 'following' && rs.tabActive]}>Following</Text>
          {tab === 'following' && <View style={[rs.tabUnderline, { backgroundColor: primary }]} />}
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatRef}
        data={reels}
        keyExtractor={item => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewConfig}
        getItemLayout={(_, index) => ({ length: SH, offset: SH * index, index })}
        renderItem={({ item, index }) => (
          <ReelItem
            reel={item}
            isActive={index === activeIndex}
            primary={primary}
            muted={muted}
            textColor={textColor}
            bg={bg}
            surface={surface}
            user={user}
            onComment={(r) => { setCommentTarget(r); setCommentsVisible(true); }}
            onProfile={(p) => { setProfileTarget(p); setProfileVisible(true); }}
            onMessage={(p) => { setDmTarget(p); setDmVisible(true); }}
          />
        )}
      />

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
    </View>
  );
};

const rs = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  tabBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', justifyContent: 'center', gap: 32, paddingVertical: 12 },
  tabLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: '800', letterSpacing: 0.5, textShadowColor: '#000', textShadowRadius: 6 },
  tabActive: { color: '#fff' },
  tabUnderline: { height: 2, borderRadius: 1, marginTop: 3 },
});
