/**
 * EventMomentsSection — Instagram/Snapchat-style 24hr stories tied to an event.
 * Attendees post photos/videos that vanish after 24 hours.
 * Table: event_moments (id, event_id, user_id, media_url, media_type, caption, expires_at, view_count, created_at)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image,
  Modal, Pressable, Animated, TextInput, ActivityIndicator,
  Dimensions, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';
import { uploadToStorage } from '../services/storageService';
import { resilient } from '../utils/resilience';
import { useBackClose } from '../hooks/useBackClose';

const { width: SW, height: SH } = Dimensions.get('window');

const REACTIONS = ['🔥', '❤️', '😍', '🙌', '💥', '👑'];

// ─── Moment ring (story circle) ────────────────────────────────────────────────

const MomentRing = React.memo(({ moment, primary, onPress, isSeen }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
    onPress(moment);
  };

  const initial = (moment.profiles?.username || '?')[0].toUpperCase();

  return (
    <Animated.View style={[mr.wrap, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.9}>
        <View style={[mr.ring, {
          borderColor: isSeen ? 'rgba(255,255,255,0.15)' : primary,
          borderWidth: isSeen ? 1 : 2.5,
        }]}>
          {moment.profiles?.avatar_url
            ? <Image source={{ uri: moment.profiles.avatar_url }} style={mr.avatar} />
            : (
              <View style={[mr.avatar, { backgroundColor: `${primary}25`, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: primary, fontWeight: '900', fontSize: 16 }}>{initial}</Text>
              </View>
            )
          }
          {/* Thumbnail peek */}
          <View style={[mr.thumbPeek, { borderColor: primary }]}>
            <Image source={{ uri: moment.media_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          </View>
        </View>
        <Text style={[mr.name, { color: isSeen ? 'rgba(255,255,255,0.4)' : '#fff' }]} numberOfLines={1}>
          {moment.profiles?.username || 'Viber'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

const mr = StyleSheet.create({
  wrap: { alignItems: 'center', marginRight: 12, width: 68 },
  ring: { width: 68, height: 68, borderRadius: 34, padding: 2, position: 'relative' },
  avatar: { width: '100%', height: '100%', borderRadius: 30 },
  thumbPeek: { position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderRadius: 12, overflow: 'hidden', borderWidth: 2 },
  name: { fontSize: 10, fontWeight: '700', marginTop: 5, textAlign: 'center', width: 68 },
});

// ─── Moment Viewer (fullscreen story) ─────────────────────────────────────────

const MomentViewer = ({ moments, startIndex = 0, visible, onClose, primary, user }) => {
  useBackClose(visible, onClose);
  const [idx, setIdx] = useState(startIndex);
  const [reactionVisible, setReactionVisible] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressRef = useRef(null);
  const DURATION = 6000;

  const current = moments[idx];

  useEffect(() => {
    if (!visible) return;
    setIdx(startIndex);
  }, [visible, startIndex]);

  useEffect(() => {
    if (!visible || !current) return;
    progressAnim.setValue(0);
    progressRef.current = Animated.timing(progressAnim, {
      toValue: 1, duration: DURATION, useNativeDriver: false,
    });
    progressRef.current.start(({ finished }) => {
      if (finished) advance();
    });
    // Record view
    if (current.id && user?.id && current.user_id !== user?.id) {
      supabase.from('event_moment_views').upsert({ moment_id: current.id, viewer_id: user?.id }, { onConflict: 'moment_id,viewer_id' }).then(() => {
        supabase.from('event_moments').update({ view_count: (current.view_count || 0) + 1 }).eq('id', current.id).then(() => {});
      });
    }
    return () => progressRef.current?.stop();
  }, [idx, visible]);

  const advance = () => {
    if (idx < moments.length - 1) setIdx(i => i + 1);
    else onClose();
  };

  const retreat = () => {
    if (idx > 0) setIdx(i => i - 1);
    else onClose();
  };

  const sendReaction = async (emoji) => {
    setReactionVisible(false);
    if (!user || !current) return;
    try {
      await supabase.from('event_moment_reactions').insert({ moment_id: current.id, user_id: user?.id, emoji });
    } catch { /* fire-and-forget reaction — silent fail is acceptable */ }
  };

  if (!visible || !current) return null;

  const isOwn = current.user_id === user?.id;
  const timeLeft = current.expires_at ? (() => {
    const ms = new Date(current.expires_at) - Date.now();
    const h = Math.floor(ms / 3600000);
    return h > 0 ? `${h}h left` : `${Math.floor(ms / 60000)}m left`;
  })() : '';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={sv.root}>
        {/* Progress bars */}
        <View style={sv.progressRow}>
          {moments.map((_, i) => (
            <View key={i} style={[sv.progressTrack, { flex: 1, marginHorizontal: 2 }]}>
              <Animated.View style={[
                sv.progressFill,
                { backgroundColor: primary },
                i < idx ? { width: '100%' } : i === idx ? {
                  width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                } : { width: '0%' },
              ]} />
            </View>
          ))}
        </View>

        {/* Header */}
        <View style={sv.header}>
          <View style={sv.userRow}>
            {current.profiles?.avatar_url
              ? <Image source={{ uri: current.profiles.avatar_url }} style={sv.headerAvatar} />
              : <View style={[sv.headerAvatar, { backgroundColor: `${primary}30`, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: primary, fontWeight: '900' }}>{(current.profiles?.username || '?')[0].toUpperCase()}</Text>
                </View>
            }
            <View>
              <Text style={sv.username}>@{current.profiles?.username || 'Viber'}</Text>
              {!!timeLeft && <Text style={sv.timeLeft}>{timeLeft}</Text>}
            </View>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Media */}
        <View style={sv.mediaWrap}>
          {current.media_type === 'video' ? (
            <Video
              source={{ uri: current.media_url }}
              style={StyleSheet.absoluteFill}
              resizeMode={ResizeMode.COVER}
              shouldPlay
              isLooping={false}
              isMuted={false}
              onPlaybackStatusUpdate={s => { if (s.didJustFinish) advance(); }}
            />
          ) : (
            <Image source={{ uri: current.media_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          )}

          {/* Tap zones */}
          <Pressable style={sv.tapLeft} onPress={retreat} />
          <Pressable style={sv.tapRight} onPress={advance} />
        </View>

        {/* Caption */}
        {!!current.caption && (
          <View style={sv.captionWrap}>
            <Text style={sv.caption}>{current.caption}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={sv.footer}>
          {isOwn ? (
            <View style={sv.viewCount}>
              <Feather name="eye" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={sv.viewCountText}>{current.view_count || 0} views</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[sv.reactBtn, { borderColor: `${primary}60` }]}
              onPress={() => setReactionVisible(v => !v)}
            >
              <Text style={{ fontSize: 18 }}>😊</Text>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 6 }}>React</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Reaction picker */}
        {reactionVisible && (
          <View style={[sv.reactionPicker, { borderColor: `${primary}30` }]}>
            {REACTIONS.map(e => (
              <TouchableOpacity key={e} onPress={() => sendReaction(e)} style={sv.reactionBtn}>
                <Text style={{ fontSize: 26 }}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
};

const sv = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  progressRow: { flexDirection: 'row', paddingHorizontal: 8, paddingTop: Platform.OS === 'ios' ? 54 : 12, paddingBottom: 8, zIndex: 10, position: 'absolute', top: 0, left: 0, right: 0 },
  progressTrack: { height: 2.5, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  header: { position: 'absolute', top: Platform.OS === 'ios' ? 72 : 30, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19 },
  username: { color: '#fff', fontSize: 14, fontWeight: '800' },
  timeLeft: { color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 1 },
  mediaWrap: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  tapLeft: { flex: 1, height: '100%' },
  tapRight: { flex: 1.5, height: '100%' },
  captionWrap: { position: 'absolute', bottom: 90, left: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, padding: 12 },
  caption: { color: '#fff', fontSize: 14, lineHeight: 20 },
  footer: { position: 'absolute', bottom: Platform.OS === 'ios' ? 40 : 20, left: 16, right: 16, flexDirection: 'row', alignItems: 'center' },
  viewCount: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  viewCountText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '700' },
  reactBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1 },
  reactionPicker: { position: 'absolute', bottom: Platform.OS === 'ios' ? 90 : 70, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-around', backgroundColor: 'rgba(20,20,20,0.95)', borderRadius: 20, paddingVertical: 12, borderWidth: 1 },
  reactionBtn: { padding: 6 },
});

// ─── Add Moment sheet ──────────────────────────────────────────────────────────

const AddMomentSheet = ({ visible, onClose, eventId, primary, surface, textColor, muted, onAdded }) => {
  useBackClose(visible, onClose);
  const { user } = useAuth();
  const toast = useToast();
  const [media, setMedia] = useState(null);
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: visible ? 1 : 0, useNativeDriver: true, damping: 20, stiffness: 180 }).start();
  }, [visible]);

  const pickMedia = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { toast.show('Photo library access required', 'info'); return; }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]) {
      const a = result.assets[0];
      setMedia({ uri: a.uri, type: a.type || (a.uri.match(/\.mp4|\.mov/i) ? 'video' : 'image'), mimeType: a.mimeType });
    }
  };

  const handlePost = async () => {
    if (!media) { toast.show('Pick a photo or video first', 'info'); return; }
    if (!user) { toast.show('Sign in to post a moment', 'info'); return; }
    setPosting(true);
    try {
      const cleanUri = media.uri.split('?')[0];
      let ext = (cleanUri.split('.').pop() || 'jpg').toLowerCase();
      if (!ext || ext.length > 5) ext = media.type === 'video' ? 'mp4' : 'jpg';
      const path = `moments/${user.id}/${Date.now()}.${ext}`;
      const mimeType = media.mimeType || (media.type === 'video' ? 'video/mp4' : `image/${ext === 'jpg' ? 'jpeg' : ext}`);
      const url = await uploadToStorage(media.uri, 'event-media', path, { mimeType });
      const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const { error } = await supabase.from('event_moments').insert({
        event_id: eventId, user_id: user?.id,
        media_url: url, media_type: media.type,
        caption: caption.trim() || null,
        expires_at: expiresAt,
      });
      if (error) throw error;
      toast.show('Moment posted!', 'success');
      setMedia(null); setCaption('');
      onAdded?.();
      onClose();
    } catch (e) {
      toast.show(`Failed: ${e.message || 'Try again'}`, 'error');
    } finally { setPosting(false); }
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Animated.View
          style={[as.sheet, { backgroundColor: surface, transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }] }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={as.handle} />
          <Text style={[as.title, { color: textColor }]}>Add a Moment</Text>
          <Text style={[as.sub, { color: muted }]}>Disappears in 24 hours</Text>

          {/* Media picker */}
          <TouchableOpacity
            style={[as.mediaPick, { borderColor: media ? primary : `${primary}30`, backgroundColor: media ? `${primary}08` : 'transparent' }]}
            onPress={pickMedia}
            activeOpacity={0.8}
          >
            {media ? (
              <>
                <Image source={{ uri: media.uri }} style={as.mediaPreview} resizeMode="cover" />
                {media.type === 'video' && (
                  <View style={{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                    <Feather name="play-circle" size={36} color="#fff" />
                  </View>
                )}
                <View style={[as.changeBtn, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                  <Feather name="refresh-cw" size={14} color="#fff" />
                </View>
              </>
            ) : (
              <View style={{ alignItems: 'center', gap: 8 }}>
                <Feather name="camera" size={32} color={primary} style={{ opacity: 0.7 }} />
                <Text style={{ color: muted, fontSize: 13 }}>Tap to pick photo or video</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Caption */}
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Add a caption..."
            placeholderTextColor={muted}
            style={[as.captionInput, { color: textColor, borderColor: `${primary}30`, backgroundColor: `${primary}06` }]}
            maxLength={200}
            multiline
          />

          <TouchableOpacity
            style={[as.postBtn, { backgroundColor: media ? primary : `${primary}30`, opacity: posting ? 0.7 : 1 }]}
            onPress={handlePost}
            disabled={posting || !media}
            activeOpacity={0.85}
          >
            {posting ? <ActivityIndicator color="#000" size="small" /> : <Text style={as.postBtnText}>Post Moment</Text>}
          </TouchableOpacity>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const as = StyleSheet.create({
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ffffff30', alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 17, fontWeight: '900', textAlign: 'center' },
  sub: { fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  mediaPick: { height: 180, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 14, overflow: 'hidden' },
  mediaPreview: { width: '100%', height: '100%' },
  changeBtn: { position: 'absolute', top: 10, right: 10, padding: 8, borderRadius: 20 },
  captionInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, minHeight: 60, marginBottom: 14, textAlignVertical: 'top' },
  postBtn: { borderRadius: 14, padding: 14, alignItems: 'center' },
  postBtnText: { color: '#000', fontSize: 15, fontWeight: '900' },
});

// ─── EventMomentsSection ──────────────────────────────────────────────────────

export const EventMomentsSection = ({ event, eventId: eventIdProp, primary, textColor, muted, surface, triggerCapture, onCaptureHandled }) => {
  const eventId = eventIdProp || event?.id;
  const { user } = useAuth();
  const toast = useToast();
  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [seenIds, setSeenIds] = useState(new Set());

  // Allow LiveEventBanner to open the capture sheet externally
  useEffect(() => {
    if (triggerCapture && !addSheetVisible) {
      setAddSheetVisible(true);
      onCaptureHandled?.();
    }
  }, [triggerCapture]);

  const fetchMoments = useCallback(async () => {
    if (!eventId) return;
    const now = new Date().toISOString();
    const { data } = await supabase
      .from('event_moments')
      .select('id, event_id, user_id, media_url, media_type, caption, expires_at, view_count, created_at, profiles:user_id(username, avatar_url)')
      .eq('event_id', eventId)
      .gt('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(30);
    setMoments(data || []);
    setLoading(false);
  }, [eventId]);

  useEffect(() => { fetchMoments(); }, [fetchMoments]);

  // Realtime: new moments appear instantly
  useEffect(() => {
    if (!eventId) return;
    const ch = supabase.channel(`moments:${eventId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_moments', filter: `event_id=eq.${eventId}` },
        () => fetchMoments())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [eventId, fetchMoments]);

  const openViewer = (moment) => {
    const i = moments.findIndex(m => m.id === moment.id);
    setViewerIndex(i >= 0 ? i : 0);
    setViewerVisible(true);
    setSeenIds(prev => new Set([...prev, moment.id]));
  };

  if (loading) return null;

  // Separate own moment from others
  const ownMoment = moments.find(m => m.user_id === user?.id);
  const otherMoments = moments.filter(m => m.user_id !== user?.id);

  return (
    <View style={ms.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 4, gap: 2 }}
      >
        {/* Add / view own moment button */}
        <TouchableOpacity
          style={ms.addBtn}
          onPress={() => ownMoment ? openViewer(ownMoment) : setAddSheetVisible(true)}
          activeOpacity={0.8}
        >
          <View style={[ms.addRing, { borderColor: ownMoment ? primary : `${primary}40`, borderStyle: ownMoment ? 'solid' : 'dashed' }]}>
            {ownMoment ? (
              <Image source={{ uri: ownMoment.media_url }} style={ms.addRingImg} resizeMode="cover" />
            ) : (
              <View style={[ms.addRingInner, { backgroundColor: `${primary}15` }]}>
                <Feather name="plus" size={24} color={primary} />
              </View>
            )}
          </View>
          <Text style={[ms.addLabel, { color: ownMoment ? primary : muted }]}>
            {ownMoment ? 'Your Moment' : 'Add Moment'}
          </Text>
        </TouchableOpacity>

        {/* Other moments */}
        {otherMoments.map(m => (
          <MomentRing
            key={m.id}
            moment={m}
            primary={primary}
            onPress={openViewer}
            isSeen={seenIds.has(m.id)}
          />
        ))}

        {moments.length === 0 && !loading && (
          <View style={{ paddingVertical: 8, paddingLeft: 8 }}>
            <Text style={{ color: muted, fontSize: 12 }}>No moments yet — be the first!</Text>
          </View>
        )}
      </ScrollView>

      {/* Viewer */}
      <MomentViewer
        moments={moments}
        startIndex={viewerIndex}
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
        primary={primary}
        user={user}
      />

      {/* Add sheet */}
      <AddMomentSheet
        visible={addSheetVisible}
        onClose={() => setAddSheetVisible(false)}
        eventId={eventId}
        primary={primary}
        surface={surface}
        textColor={textColor}
        muted={muted}
        onAdded={fetchMoments}
      />
    </View>
  );
};

const ms = StyleSheet.create({
  container: { marginBottom: 4 },
  addBtn: { alignItems: 'center', marginRight: 12, width: 68 },
  addRing: { width: 68, height: 68, borderRadius: 34, borderWidth: 2, overflow: 'hidden' },
  addRingImg: { width: '100%', height: '100%' },
  addRingInner: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  addLabel: { fontSize: 10, fontWeight: '700', marginTop: 5, textAlign: 'center', width: 68 },
});
