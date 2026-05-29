import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  FlatList, Modal, Dimensions, ActivityIndicator, Platform,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { resilient } from '../utils/resilience';
import { uploadToStorage } from '../services/storageService';
import { GlassView } from './GlassView';
import { useToast } from './ToastNotification';

const { width, height } = Dimensions.get('window');
const THUMB_SIZE = (width * 0.9 - 48) / 3;

export const EventGallery = ({ eventId }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const [gallery, setGallery] = useState([]);
  const [hostMedia, setHostMedia] = useState([]);
  const [previewCount, setPreviewCount] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [lightboxItem, setLightboxItem] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [tableError, setTableError] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState(null);
  const [myLikes, setMyLikes] = useState(new Set()); // gallery item IDs liked by current user
  const [likingId, setLikingId] = useState(null);

  const primary = currentTheme?.primary || '#00f2ff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const textColor = currentTheme?.text || '#fff';

  useEffect(() => {
    if (!eventId) return;
    supabase
      .from('event_gallery')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .then(({ count }) => { if (count != null) setPreviewCount(count); });
  }, [eventId]);

  useEffect(() => {
    if (isModalVisible) fetchGallery();
  }, [eventId, isModalVisible]);

  const fetchGallery = async () => {
    try {
      // Fetch community gallery sorted by likes descending
      const { data, error } = await supabase
        .from('event_gallery')
        .select('*, profiles(username, avatar_url)')
        .eq('event_id', eventId)
        .order('like_count', { ascending: false })
        .order('created_at', { ascending: false });
      if (!error && data) setGallery(data);
      else setTableError(true);

      // Load current user's likes for this gallery
      if (user) {
        const { data: liked } = await supabase
          .from('event_gallery_likes')
          .select('gallery_id')
          .eq('user_id', user.id);
        if (liked) setMyLikes(new Set(liked.map(l => l.gallery_id)));
      }

      // Fetch host's own event media
      const { data: ev } = await supabase
        .from('events')
        .select('media, media_urls, author_id, profiles:author_id(username, avatar_url)')
        .eq('id', eventId)
        .single();
      if (ev) {
        let hostImgs = [];
        if (Array.isArray(ev.media)) {
          hostImgs = ev.media.filter(m => m?.url).map(m => ({
            id: `host_${m.url}`,
            url: m.url,
            media_type: m.type || 'image',
            profiles: ev.profiles,
            is_host: true,
          }));
        }
        if (!hostImgs.length && Array.isArray(ev.media_urls)) {
          hostImgs = ev.media_urls.map((url, i) => ({
            id: `host_url_${i}`,
            url,
            media_type: 'image',
            profiles: ev.profiles,
            is_host: true,
          }));
        }
        setHostMedia(hostImgs);
      }
    } catch {
      setTableError(true);
    }
  };

  const isVideoItem = (item) =>
    item.media_type === 'video' || /\.(mp4|mov|webm|avi|m4v)(\?|$)/i.test(item.url || '');

  const renderGalleryItem = useCallback(({ item }) => {
    const isVid = isVideoItem(item);
    const isPlaying = activeVideoId === item.id;
    const liked = myLikes.has(item.id);
    return (
      <View style={{ position: 'relative' }}>
        <TouchableOpacity
          onPress={() => isVid ? setActiveVideoId(isPlaying ? null : item.id) : setLightboxItem(item)}
          activeOpacity={0.85}
        >
          {isVid ? (
            <Video
              source={{ uri: item.url }}
              style={styles.thumb}
              resizeMode={ResizeMode.COVER}
              shouldPlay={isPlaying}
              isLooping
              isMuted={!isPlaying}
            />
          ) : (
            <Image source={{ uri: item.url }} style={styles.thumb} />
          )}
          {isVid && !isPlaying && (
            <View style={styles.playOverlay}>
              <Feather name="play-circle" size={24} color="rgba(255,255,255,0.9)" />
            </View>
          )}
          {item.is_host && (
            <View style={styles.hostBadge}>
              <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900' }}>HOST</Text>
            </View>
          )}
        </TouchableOpacity>
        {/* Like button */}
        <TouchableOpacity
          style={[styles.likeBtn, liked && { backgroundColor: 'rgba(239,68,68,0.85)' }]}
          onPress={() => handleLike(item)}
          activeOpacity={0.8}
        >
          <Feather name="heart" size={11} color={liked ? '#fff' : 'rgba(255,255,255,0.7)'} />
          {(item.like_count > 0) && (
            <Text style={{ color: liked ? '#fff' : 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '800' }}>{item.like_count}</Text>
          )}
        </TouchableOpacity>
        {item.profiles?.username && (
          <Text style={[styles.thumbUser, { color: muted }]} numberOfLines={1}>
            @{item.profiles.username}
          </Text>
        )}
      </View>
    );
  }, [activeVideoId, muted, myLikes, likingId]);

  const handleLike = async (item) => {
    if (!user) { toast.show('Sign in to like photos!', 'info'); return; }
    if (likingId) return;
    const alreadyLiked = myLikes.has(item.id);
    // Optimistic update
    setMyLikes(prev => {
      const next = new Set(prev);
      alreadyLiked ? next.delete(item.id) : next.add(item.id);
      return next;
    });
    setGallery(prev => prev.map(g =>
      g.id === item.id ? { ...g, like_count: Math.max(0, (g.like_count || 0) + (alreadyLiked ? -1 : 1)) } : g
    ));
    setLikingId(item.id);
    try {
      if (alreadyLiked) {
        await supabase.from('event_gallery_likes').delete().eq('gallery_id', item.id).eq('user_id', user.id);
        await supabase.from('event_gallery').update({ like_count: Math.max(0, (item.like_count || 0) - 1) }).eq('id', item.id);
      } else {
        await supabase.from('event_gallery_likes').upsert({ gallery_id: item.id, user_id: user.id }, { onConflict: 'gallery_id,user_id' });
        await supabase.from('event_gallery').update({ like_count: (item.like_count || 0) + 1 }).eq('id', item.id);
      }
    } catch {
      // Rollback optimistic update on failure
      setMyLikes(prev => { const next = new Set(prev); alreadyLiked ? next.add(item.id) : next.delete(item.id); return next; });
      setGallery(prev => prev.map(g =>
        g.id === item.id ? { ...g, like_count: item.like_count || 0 } : g
      ));
    } finally {
      setLikingId(null);
    }
  };

  const handleUpload = async () => {
    if (!user) {
      toast.show('Sign in to add photos to the gallery!', 'info');
      return;
    }
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        toast.show('Photo library permission is required.', 'error');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.8,
      videoMaxDuration: 60,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const isVideo = asset.type === 'video' || asset.mimeType?.startsWith('video/');
    setUploading(true);
    try {
      const ext = (asset.fileName?.split('.').pop() || (isVideo ? 'mp4' : 'jpg')).toLowerCase();
      const fileName = `${user.id}/gallery/${eventId}_${Date.now()}.${ext}`;
      const publicUrl = await uploadToStorage(asset.uri, 'event-media', fileName, { mimeType: asset.mimeType });
      const galleryPayload = { event_id: eventId, user_id: user.id, url: publicUrl, media_type: isVideo ? 'video' : 'image' };
      const ok = await resilient(
        [
          () => supabase.from('event_gallery').insert(galleryPayload),
          () => supabase.from('event_gallery').upsert(galleryPayload),
          () => supabase.rpc('add_gallery_item', { p_event_id: eventId, p_user_id: user.id, p_url: publicUrl, p_type: isVideo ? 'video' : 'image' }),
        ],
        { attemptsPerTier: 2, baseMs: 400, label: `EventGallery.upload:${eventId}`, fallbackValue: null }
      );
      if (ok === null) {
        setTableError(true);
        toast.show('Photo uploaded but gallery save failed. Contact your admin.', 'info');
      } else {
        toast.show('Photo added to gallery!', 'success');
        fetchGallery();
      }
    } catch (e) {
      toast.show('Upload failed: ' + e.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const displayCount = isModalVisible
    ? gallery.length + hostMedia.length
    : previewCount;

  return (
    <View style={styles.container}>
      {/* Preview strip — shows count fetched on mount */}
      <TouchableOpacity
        style={styles.triggerRow}
        onPress={() => setIsModalVisible(true)}
      >
        <Text style={[styles.triggerText, { color: muted }]}>
          📸 Community Gallery
        </Text>
        <View style={[styles.badge, { backgroundColor: `${primary}22`, borderColor: `${primary}50` }]}>
          <Text style={[styles.badgeText, { color: primary }]}>
            {displayCount != null ? `${displayCount} photo${displayCount !== 1 ? 's' : ''}` : 'View All'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Gallery Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <GlassView style={styles.galleryCard}>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={[styles.title, { color: textColor }]}>Community Gallery</Text>
                <Text style={[styles.subtitle, { color: muted }]}>{gallery.length + hostMedia.length} item{(gallery.length + hostMedia.length) !== 1 ? 's' : ''}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={[styles.close, { color: textColor }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Grid */}
            <FlatList
              data={[...hostMedia, ...gallery]}
              keyExtractor={item => item.id}
              numColumns={3}
              columnWrapperStyle={styles.row}
              contentContainerStyle={styles.grid}
              renderItem={renderGalleryItem}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={{ fontSize: 40 }}>📷</Text>
                  <Text style={[styles.emptyText, { color: muted }]}>No community photos yet.</Text>
                  <Text style={[styles.emptyText, { color: muted }]}>Be the first to capture the vibe!</Text>
                </View>
              }
              style={{ flex: 1 }}
            />

            <TouchableOpacity
              style={[styles.uploadBtn, { backgroundColor: primary }, uploading && styles.disabled]}
              onPress={handleUpload}
              disabled={uploading}
            >
              {uploading
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.uploadText}>+ Add My Photo / Video</Text>
              }
            </TouchableOpacity>
          </GlassView>
        </View>

        {/* Lightbox */}
        {lightboxItem && (
          <Modal visible transparent animationType="fade" onRequestClose={() => setLightboxItem(null)}>
            <TouchableOpacity
              style={styles.lightbox}
              activeOpacity={1}
              onPress={() => setLightboxItem(null)}
            >
              {isVideoItem(lightboxItem) ? (
                <Video
                  source={{ uri: lightboxItem.url }}
                  style={styles.lightboxImage}
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay
                  isLooping
                  useNativeControls
                />
              ) : (
                <Image source={{ uri: lightboxItem.url }} style={styles.lightboxImage} resizeMode="contain" />
              )}
              <View style={styles.lightboxMeta}>
                <Text style={styles.lightboxUser}>
                  @{lightboxItem.profiles?.username || 'Viber'}
                </Text>
              </View>
              <Text style={styles.lightboxClose}>✕ Tap to close</Text>
            </TouchableOpacity>
          </Modal>
        )}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginVertical: 6 },
  triggerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  triggerText: { fontSize: 12, fontWeight: '600' },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'flex-end',
  },
  galleryCard: {
    height: height * 0.82,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: 20,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '900' },
  subtitle: { fontSize: 12, marginTop: 3 },
  close: { fontSize: 22, padding: 4 },
  grid: { paddingBottom: 10 },
  row: { gap: 4, marginBottom: 4 },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
  },
  thumbUser: { fontSize: 9, marginTop: 3, textAlign: 'center', width: THUMB_SIZE },
  playOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 8 },
  hostBadge: { position: 'absolute', top: 3, left: 3, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },
  likeBtn: { position: 'absolute', top: 4, right: 4, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 10 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 13, marginTop: 6 },
  uploadBtn: {
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 14,
  },
  uploadText: { color: '#000', fontWeight: '900', fontSize: 14 },
  disabled: { opacity: 0.6 },
  lightbox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.97)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxImage: {
    width: width,
    height: height * 0.75,
  },
  lightboxMeta: {
    marginTop: 16,
  },
  lightboxUser: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
  },
  lightboxClose: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginTop: 20,
  },
});
