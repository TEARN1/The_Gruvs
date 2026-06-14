import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  Modal, TouchableWithoutFeedback, Animated, ActivityIndicator,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { uploadToStorage } from '../services/storageService';
import { resilient } from '../utils/resilience';
import { useToast } from './ToastNotification';

import { useBackClose } from '../hooks/useBackClose';

const STORY_DURATION = 5000;

// ── Story avatar bubble ───────────────────────────────────────────────────────
const StoryBubble = ({ story, seen, primary, onPress }) => {
  const ringColor = seen ? 'rgba(255,255,255,0.2)' : primary;
  return (
    <TouchableOpacity style={sb.wrap} onPress={onPress} activeOpacity={0.8}>
      <View style={[sb.ring, { borderColor: ringColor }]}>
        {story.avatar_url
          ? <Image source={{ uri: story.avatar_url }} style={sb.avatar} />
          : <View style={[sb.avatar, { backgroundColor: "#1a2a2c", alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>
                {(story.username || '?')[0].toUpperCase()}
              </Text>
            </View>
        }
      </View>
      <Text style={[sb.name, { color: seen ? 'rgba(255,255,255,0.4)' : '#fff' }]} numberOfLines={1}>
        {story.username}
      </Text>
    </TouchableOpacity>
  );
};

const AddStoryBubble = ({ primary, onPress, avatarUrl }) => (
  <TouchableOpacity style={sb.wrap} onPress={onPress} activeOpacity={0.8}>
    <View style={[sb.ring, { borderColor: `${primary}60` }]}>
      {avatarUrl
        ? <Image source={{ uri: avatarUrl }} style={sb.avatar} />
        : <View style={[sb.avatar, { backgroundColor: "#1a2a2c", alignItems: 'center', justifyContent: 'center' }]}>
            <Feather name="user" size={22} color={primary} />
          </View>
      }
      {/* Plus badge — clearly an "add to your story" affordance */}
      <View style={[sb.addBadge, { backgroundColor: primary, borderColor: "#0d1112" }]}>
        <Feather name="plus" size={11} color="#000" />
      </View>
    </View>
    <Text style={[sb.name, { color: primary }]}>Your Story</Text>
  </TouchableOpacity>
);

const sb = StyleSheet.create({
  wrap: { width: 68, alignItems: 'center', marginRight: 10 },
  ring: { borderWidth: 2.5, borderRadius: 35, padding: 2, marginBottom: 5 },
  avatar: { width: 54, height: 54, borderRadius: 27 },
  name: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  addBadge: { position: 'absolute', right: 0, bottom: 4, width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});

// ── Story viewer modal ────────────────────────────────────────────────────────
const StoryViewerModal = ({ visible, stories, startIndex, onClose, primary }) => {
  useBackClose(visible, onClose);
  const [currentIndex, setCurrentIndex] = useState(startIndex || 0);
  const [storyIndex, setStoryIndex] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);
  const videoRef = useRef(null);

  const currentUser = stories[currentIndex];
  const userStories = currentUser?.stories || [];
  const currentStory = userStories[storyIndex];

  const goNext = useCallback(() => {
    if (storyIndex < userStories.length - 1) {
      setStoryIndex(i => i + 1);
    } else if (currentIndex < stories.length - 1) {
      setCurrentIndex(i => i + 1);
      setStoryIndex(0);
    } else {
      onClose();
    }
  }, [storyIndex, userStories.length, currentIndex, stories.length, onClose]);

  const goPrev = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex(i => i - 1);
    } else if (currentIndex > 0) {
      setCurrentIndex(i => i - 1);
      setStoryIndex(0);
    }
  }, [storyIndex, currentIndex]);

  useEffect(() => {
    if (!visible || !currentStory) return;
    progress.setValue(0);
    clearTimeout(timerRef.current);
    if (currentStory.media_type !== 'video') {
      Animated.timing(progress, {
        toValue: 1, duration: STORY_DURATION, useNativeDriver: false,
      }).start(({ finished }) => { if (finished) goNext(); });
    }
    return () => { progress.stopAnimation(); clearTimeout(timerRef.current); };
  }, [visible, currentIndex, storyIndex, currentStory]);

  useEffect(() => {
    if (visible) { setCurrentIndex(startIndex || 0); setStoryIndex(0); }
  }, [visible, startIndex]);

  if (!visible || !currentStory) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={sv.root}>
        {/* Progress bars */}
        <View style={sv.progressRow}>
          {userStories.map((_, i) => (
            <View key={i} style={[sv.progTrack, { flex: 1, marginHorizontal: 2 }]}>
              <Animated.View style={[sv.progFill, {
                backgroundColor: primary,
                width: i < storyIndex ? '100%' : i === storyIndex
                  ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                  : '0%',
              }]} />
            </View>
          ))}
        </View>

        {/* Header */}
        <View style={sv.header}>
          {currentUser.avatar_url
            ? <Image source={{ uri: currentUser.avatar_url }} style={sv.headerAvatar} />
            : <View style={[sv.headerAvatar, { backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: '#fff', fontWeight: '900' }}>{(currentUser.username || '?')[0].toUpperCase()}</Text>
              </View>
          }
          <Text style={sv.headerName}>@{currentUser.username}</Text>
          <Text style={sv.headerTime}>{fmtAge(currentStory.created_at)}</Text>
          <TouchableOpacity onPress={onClose} style={{ marginLeft: 'auto', padding: 8 }}>
            <Feather name="x" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Media */}
        {currentStory.media_type === 'video'
          ? <Video
              ref={videoRef}
              source={{ uri: currentStory.media_url }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              shouldPlay
              isLooping={false}
              onPlaybackStatusUpdate={(s) => {
                if (s.didJustFinish) goNext();
                if (s.durationMillis > 0) {
                  progress.setValue(s.positionMillis / s.durationMillis);
                }
              }}
            />
          : <Image source={{ uri: currentStory.media_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        }

        {/* Caption */}
        {currentStory.caption ? (
          <View style={sv.caption}>
            <Text style={sv.captionText}>{currentStory.caption}</Text>
          </View>
        ) : null}

        {/* Tap zones */}
        <View style={sv.tapRow}>
          <TouchableWithoutFeedback onPress={goPrev}>
            <View style={{ flex: 1 }} />
          </TouchableWithoutFeedback>
          <TouchableWithoutFeedback onPress={goNext}>
            <View style={{ flex: 1 }} />
          </TouchableWithoutFeedback>
        </View>
      </View>
    </Modal>
  );
};

const fmtAge = (ts) => {
  if (!ts) return '';
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
};

const sv = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  progressRow: { flexDirection: 'row', paddingHorizontal: 8, paddingTop: Platform.OS === 'ios' ? 54 : 36, zIndex: 10 },
  progTrack: { height: 2.5, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
  progFill: { height: '100%', borderRadius: 2 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, zIndex: 10 },
  headerAvatar: { width: 34, height: 34, borderRadius: 17, marginRight: 8 },
  headerName: { color: '#fff', fontWeight: '800', fontSize: 14 },
  headerTime: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginLeft: 8 },
  caption: { position: 'absolute', bottom: 60, left: 0, right: 0, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: 'rgba(0,0,0,0.5)' },
  captionText: { color: '#fff', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  tapRow: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', top: 120 },
});

// ── Main StoriesRow export ────────────────────────────────────────────────────
export const StoriesRow = ({ onAuthRequired }) => {
  const { currentTheme } = useTheme();
  const { user, profile } = useAuth();
  const { show: showToast } = useToast();
  const [grouped, setGrouped] = useState([]);
  const [seenMap, setSeenMap] = useState({});
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStart, setViewerStart] = useState(0);
  const [uploading, setUploading] = useState(false);

  const primary = currentTheme?.primary || "#00f2ff";

  const loadStories = useCallback(async () => {
    if (!user) return;
    try {
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);
      const ids = [user.id, ...(follows || []).map(f => f.following_id)];

      const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data: stories } = await supabase
        .from('stories')
        .select('*, profiles(username, avatar_url)')
        .in('user_id', ids)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false });

      if (!stories) return;

      const byUser = {};
      for (const s of stories) {
        const uid = s.user_id;
        if (!byUser[uid]) byUser[uid] = { userId: uid, username: s.profiles?.username, avatar_url: s.profiles?.avatar_url, stories: [] };
        byUser[uid].stories.push(s);
      }
      const sorted = Object.values(byUser).sort((a, b) => a.userId === user.id ? -1 : b.userId === user.id ? 1 : 0);
      setGrouped(sorted);

      const { data: seen } = await supabase
        .from('story_views')
        .select('story_id')
        .eq('viewer_id', user.id);
      const map = {};
      for (const v of seen || []) map[v.story_id] = true;
      setSeenMap(map);
    } catch { /* keep current stories on transient failure */ }
  }, [user]);

  useEffect(() => { loadStories(); }, [loadStories]);

  const openViewer = async (index) => {
    const group = grouped[index];
    if (!group) return;
    setViewerStart(index);
    setViewerOpen(true);
    // Mark all stories in this group as seen
    if (user) {
      const unseen = group.stories.filter(s => !seenMap[s.id]).map(s => ({ story_id: s.id, viewer_id: user?.id }));
      if (unseen.length > 0) {
        await resilient(
          [
            () => supabase.from('story_views').upsert(unseen, { onConflict: 'story_id,viewer_id' }),
            () => supabase.from('story_views').insert(unseen),
            () => supabase.rpc('mark_stories_seen', { p_story_ids: unseen.map(u => u.story_id), p_viewer_id: user?.id }),
          ],
          { attemptsPerTier: 2, baseMs: 300, label: 'StoriesRow.markSeen', fallbackValue: null }
        );
        const updated = { ...seenMap };
        for (const u of unseen) updated[u.story_id] = true;
        setSeenMap(updated);
      }
    }
  };

  const addStory = async () => {
    if (!user) { onAuthRequired?.(); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.85,
      videoMaxDuration: 15,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    const MAX_BYTES = 100 * 1024 * 1024;
    if (asset.fileSize && asset.fileSize > MAX_BYTES) {
      alert('File too large — max 100 MB for stories.');
      return;
    }
    setUploading(true);
    try {
      const isVideo = asset.type === 'video' || asset.mimeType?.startsWith('video/');
      const ext = (asset.fileName?.split('.').pop() || (isVideo ? 'mp4' : 'jpg')).toLowerCase();
      const path = `${user.id}/story_${Date.now()}.${ext}`;
      // There is no dedicated "stories" storage bucket — reuse event-media (public
      // read, 100 MB, mp4/quicktime + images), with the user id as the first path
      // segment so the event-media INSERT policy allows it.
      const url = await uploadToStorage(asset.uri, 'event-media', path, { mimeType: asset.mimeType });
      const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const storyPayload = { user_id: user?.id, media_url: url, media_type: isVideo ? 'video' : 'image', caption: '', expires_at: expiresAt };
      await resilient(
        [
          () => supabase.from('stories').insert(storyPayload),
          () => supabase.from('stories').upsert(storyPayload),
          () => supabase.rpc('create_story', { p_user_id: user?.id, p_url: url, p_type: isVideo ? 'video' : 'image', p_expires_at: expiresAt }),
        ],
        { attemptsPerTier: 2, baseMs: 400, label: 'StoriesRow.addStory', fallbackValue: null }
      );
      await loadStories();
      showToast('Story posted! Visible for 24 hours', 'success');
    } catch (e) {
      showToast(e?.message?.includes('storage') ? 'Upload failed — check your connection' : 'Could not post story', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 16 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 4 }}
      >
        {uploading
          ? <View style={[sb.wrap, { justifyContent: 'center' }]}>
              <ActivityIndicator color={primary} />
            </View>
          : <AddStoryBubble primary={primary} onPress={addStory} avatarUrl={profile?.avatar_url} />
        }
        {grouped.map((g, i) => {
          const allSeen = g.stories.every(s => seenMap[s.id]);
          return (
            <StoryBubble
              key={g.userId}
              story={g}
              seen={allSeen}
              primary={primary}
    i            onPress={() => openViewer(i)}
            />
          );
        })}
      </ScrollView>

      <StoryViewerModal
        visible={viewerOpen}
        stories={grouped}
        startIndex={viewerStart}
        onClose={() => setViewerOpen(false)}
        primary={primary}
      />
    </>
  );
};
