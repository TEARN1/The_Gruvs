import React, { useState, useCallback, useRef } from 'react';
import {
  Modal, View, Text, StyleSheet, TextInput,
  TouchableOpacity, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform, Image, Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';
import { supabase } from '../services/supabase';
import { resilient } from '../utils/resilience';
import { uploadToStorage } from '../services/storageService';

const SW = Dimensions.get('window').width;

const SUGGESTED_TAGS = ['#nightlife', '#gruv', '#vibes', '#capetown', '#joburg', '#durban', '#party', '#music', '#djset', '#festival'];

export const CreateReelModal = ({ visible, onClose, onPosted }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface    || 'rgba(255,255,255,0.06)';

  const [asset, setAsset] = useState(null);
  const [caption, setCaption] = useState('');
  const [soundName, setSoundName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState('pick'); // 'pick' | 'details'
  const videoRef = useRef(null);

  const reset = () => {
    videoRef.current?.pauseAsync().catch(() => {});
    setAsset(null);
    setCaption('');
    setSoundName('');
    setStep('pick');
    setUploading(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const pickMedia = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      toast.show('Media library permission required', 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.85,
      videoMaxDuration: 60,
    });
    if (result.canceled || !result.assets?.length) return;
    const picked = result.assets[0];
    const MAX_BYTES = 150 * 1024 * 1024; // 150 MB
    if (picked.fileSize && picked.fileSize > MAX_BYTES) {
      toast.show('File too large — max 150 MB', 'error');
      return;
    }
    setAsset(picked);
    setStep('details');
  }, []);

  const handlePost = async () => {
    if (!asset || !user) return;
    if (!caption.trim()) {
      toast.show('Add a caption before posting', 'error');
      return;
    }
    setUploading(true);
    try {
      const isVideo = asset.type === 'video' || asset.mimeType?.startsWith('video/');
      const ext = (asset.fileName?.split('.').pop() || (isVideo ? 'mp4' : 'jpg')).toLowerCase();
      const storagePath = `${user.id}/reel_${Date.now()}.${ext}`;
      const publicUrl = await uploadToStorage(asset.uri, 'reels', storagePath, { mimeType: asset.mimeType });

      const payload = {
        user_id: user.id,
        media_url: publicUrl,
        media_type: isVideo ? 'video' : 'image',
        caption: caption.trim(),
      };
      if (soundName.trim()) payload.sound_name = soundName.trim();

      const ok = await resilient(
        [
          () => supabase.from('reels').insert(payload),
          () => supabase.from('reels').upsert(payload),
          () => supabase.rpc('create_reel', { p_user_id: user.id, p_media_url: publicUrl, p_caption: payload.caption }),
        ],
        { attemptsPerTier: 3, baseMs: 500, label: 'CreateReelModal.insert', fallbackValue: null }
      );
      if (ok === null) throw new Error('Could not save reel');

      toast.show('Reel posted! 🎬', 'success');
      onPosted?.();
      handleClose();
    } catch (e) {
      toast.show('Upload failed: ' + (e.message || 'Unknown error'), 'error');
    } finally {
      setUploading(false);
    }
  };

  const appendTag = (tag) => {
    setCaption(prev => {
      const trimmed = prev.trimEnd();
      return trimmed ? `${trimmed} ${tag} ` : `${tag} `;
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: bg, borderColor: `${primary}20` }]}>
          <View style={[s.pill, { backgroundColor: `${primary}40` }]} />

          {/* Header */}
          <View style={s.header}>
            {step === 'details' ? (
              <TouchableOpacity onPress={() => setStep('pick')}>
                <Feather name="arrow-left" size={20} color={primary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleClose}>
                <Feather name="x" size={20} color={muted} />
              </TouchableOpacity>
            )}
            <Text style={[s.title, { color: textColor }]}>
              {step === 'pick' ? 'New Reel' : 'Caption & Details'}
            </Text>
            {step === 'details' ? (
              <TouchableOpacity
                onPress={handlePost}
                disabled={uploading}
                style={[s.postBtn, { backgroundColor: primary, opacity: uploading ? 0.5 : 1 }]}
              >
                {uploading
                  ? <ActivityIndicator size={14} color="#000" />
                  : <Text style={s.postBtnText}>Post</Text>
                }
              </TouchableOpacity>
            ) : (
              <View style={{ width: 48 }} />
            )}
          </View>

          <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
            {step === 'pick' ? (
              /* ── Step 1: Pick media ── */
              <View style={s.pickArea}>
                <TouchableOpacity style={[s.pickBox, { borderColor: `${primary}40`, backgroundColor: `${primary}08` }]} onPress={pickMedia}>
                  <Feather name="film" size={40} color={primary} />
                  <Text style={[s.pickLabel, { color: textColor }]}>Choose Video or Photo</Text>
                  <Text style={[s.pickSub, { color: muted }]}>Up to 60 seconds · MP4, MOV, JPG</Text>
                </TouchableOpacity>

                <View style={s.tipRow}>
                  <Feather name="zap" size={12} color={primary} />
                  <Text style={[s.tipText, { color: muted }]}>Vertical 9:16 videos perform best</Text>
                </View>
              </View>
            ) : (
              /* ── Step 2: Caption & details ── */
              <View style={s.detailsArea}>
                {/* Preview */}
                <View style={[s.previewWrap, { backgroundColor: '#000' }]}>
                  {(asset.type === 'video' || asset.mimeType?.startsWith('video/'))
                    ? <Video
                        ref={videoRef}
                        source={{ uri: asset.uri }}
                        style={s.preview}
                        resizeMode={ResizeMode.COVER}
                        shouldPlay
                        isLooping
                        isMuted
                      />
                    : <Image source={{ uri: asset.uri }} style={s.preview} resizeMode="cover" />
                  }
                  <View style={[s.previewBadge, { backgroundColor: `${primary}22`, borderColor: `${primary}40` }]}>
                    <Feather name={(asset.type === 'video' || asset.mimeType?.startsWith('video/')) ? 'video' : 'image'} size={10} color={primary} />
                    <Text style={{ color: primary, fontSize: 9, fontWeight: '800' }}>
                      {(asset.type === 'video' || asset.mimeType?.startsWith('video/')) ? 'VIDEO' : 'PHOTO'}
                    </Text>
                  </View>
                </View>

                {/* Caption */}
                <Text style={[s.fieldLabel, { color: muted }]}>CAPTION</Text>
                <TextInput
                  style={[s.captionInput, { color: textColor, backgroundColor: surface, borderColor: `${primary}20` }]}
                  placeholder="Write a caption… describe the vibe 🔥"
                  placeholderTextColor={muted}
                  value={caption}
                  onChangeText={setCaption}
                  multiline
                  maxLength={300}
                />
                <Text style={[s.charCount, { color: muted }]}>{caption.length}/300</Text>

                {/* Hashtag suggestions */}
                <Text style={[s.fieldLabel, { color: muted }]}>QUICK TAGS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                  {SUGGESTED_TAGS.map(tag => (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => appendTag(tag)}
                      style={[s.tagChip, { borderColor: `${primary}40`, backgroundColor: `${primary}10` }]}
                    >
                      <Text style={{ color: primary, fontSize: 11, fontWeight: '700' }}>{tag}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Sound name */}
                <Text style={[s.fieldLabel, { color: muted, marginTop: 16 }]}>SOUND (OPTIONAL)</Text>
                <View style={[s.soundRow, { backgroundColor: surface, borderColor: `${primary}20` }]}>
                  <Feather name="music" size={14} color={muted} />
                  <TextInput
                    style={[s.soundInput, { color: textColor }]}
                    placeholder="Original sound or artist — track name"
                    placeholderTextColor={muted}
                    value={soundName}
                    onChangeText={setSoundName}
                    maxLength={80}
                  />
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, paddingBottom: 40, maxHeight: '92%' },
  pill: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  postBtn: { paddingHorizontal: 18, paddingVertical: 7, borderRadius: 20 },
  postBtnText: { color: '#000', fontWeight: '900', fontSize: 13 },
  body: { paddingHorizontal: 20, paddingBottom: 20 },
  pickArea: { alignItems: 'center', paddingTop: 20, gap: 20 },
  pickBox: { width: SW - 48, aspectRatio: 9 / 16, maxHeight: 340, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 12 },
  pickLabel: { fontSize: 16, fontWeight: '900' },
  pickSub: { fontSize: 12 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tipText: { fontSize: 11 },
  detailsArea: { gap: 6 },
  previewWrap: { width: '100%', aspectRatio: 9 / 16, maxHeight: 260, borderRadius: 16, overflow: 'hidden', alignSelf: 'center', marginBottom: 14, position: 'relative' },
  preview: { width: '100%', height: '100%' },
  previewBadge: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  fieldLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginTop: 10, marginBottom: 5 },
  captionInput: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, lineHeight: 20, minHeight: 90, textAlignVertical: 'top' },
  charCount: { fontSize: 10, textAlign: 'right', marginTop: 3 },
  tagChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  soundRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  soundInput: { flex: 1, fontSize: 13 },
});
