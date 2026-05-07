import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  FlatList, Modal, Dimensions, ActivityIndicator, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { GlassView } from './GlassView';

const { width, height } = Dimensions.get('window');
const THUMB_SIZE = (width * 0.9 - 48) / 3;

export const EventGallery = ({ eventId }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const [gallery, setGallery] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [lightboxItem, setLightboxItem] = useState(null);
  const [uploading, setUploading] = useState(false);

  const primary = currentTheme?.primary || '#00f2ff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const textColor = currentTheme?.text || '#fff';

  useEffect(() => {
    if (isModalVisible) fetchGallery();
  }, [eventId, isModalVisible]);

  const fetchGallery = async () => {
    try {
      const { data } = await supabase
        .from('event_gallery')
        .select('*, profiles(username, avatar_url)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      if (data) setGallery(data);
    } catch (e) {
      console.log('Gallery fetch error:', e.message);
    }
  };

  const handleUpload = async () => {
    if (!user) {
      alert('Sign in to add photos to the gallery!');
      return;
    }
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Photo library permission is required to upload photos.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${eventId}/${user.id}_${Date.now()}.${ext}`;
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const { error: uploadError } = await supabase.storage
        .from('event-media')
        .upload(fileName, blob, { contentType: `image/${ext}`, upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('event-media').getPublicUrl(fileName);
      const { error: dbError } = await supabase.from('event_gallery').insert({
        event_id: eventId,
        user_id: user.id,
        url: urlData.publicUrl,
        media_type: 'image',
      });
      if (dbError) throw dbError;
      fetchGallery();
    } catch (e) {
      alert('Upload failed: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  const previewCount = Math.min(gallery.length, 3);

  return (
    <View style={styles.container}>
      {/* Preview strip — lazy, only load count without opening modal */}
      <TouchableOpacity
        style={styles.triggerRow}
        onPress={() => setIsModalVisible(true)}
      >
        <Text style={[styles.triggerText, { color: muted }]}>
          📸 Community Gallery
        </Text>
        <View style={[styles.badge, { backgroundColor: `${primary}22`, borderColor: `${primary}50` }]}>
          <Text style={[styles.badgeText, { color: primary }]}>View All</Text>
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
                <Text style={[styles.subtitle, { color: muted }]}>{gallery.length} photo{gallery.length !== 1 ? 's' : ''}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={[styles.close, { color: textColor }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Grid */}
            <FlatList
              data={gallery}
              keyExtractor={item => item.id}
              numColumns={3}
              columnWrapperStyle={styles.row}
              contentContainerStyle={styles.grid}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => setLightboxItem(item)}>
                  <Image
                    source={{ uri: item.url }}
                    style={styles.thumb}
                  />
                  {item.profiles?.username && (
                    <Text style={[styles.thumbUser, { color: muted }]} numberOfLines={1}>
                      @{item.profiles.username}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
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
              <Image source={{ uri: lightboxItem.url }} style={styles.lightboxImage} resizeMode="contain" />
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
