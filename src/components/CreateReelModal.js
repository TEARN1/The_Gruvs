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

const FILTERS = [
  { id: 'none', label: 'Original' },
  { id: 'cyberpunk', label: 'Cyber Neon' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'vhs', label: 'VHS' },
  { id: 'cool', label: 'Cool' },
  { id: 'warm', label: 'Sunset' },
  { id: 'greyscale', label: 'Grey' },
];

const VISIBILITIES = [
  { id: 'public', label: 'Public' },
  { id: 'private', label: 'Private (Self Only)' },
  { id: 'attendees', label: 'Event Attendees Only' },
];

const VIBE_COLORS = [
  { id: "#00f2ff", label: 'Cyan' },
  { id: "#d946ef", label: 'Magenta' },
  { id: "#eab308", label: 'Gold' },
  { id: "#10b981", label: 'Emerald' },
  { id: "#8b5cf6", label: 'Purple' }
];

export const CreateReelModal = ({ visible, onClose, onPosted }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const primary   = currentTheme?.primary    || "#00f2ff";
  const bg        = currentTheme?.background || "#0d1112";
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface    || 'rgba(255,255,255,0.06)';

  const [asset, setAsset] = useState(null);
  const [caption, setCaption] = useState('');
  const [soundName, setSoundName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState('pick'); // 'pick' | 'details'

  // Advanced Reel Creator settings state
  const [filter, setFilter] = useState('none');
  const [visibility, setVisibility] = useState('public');
  const [stickers, setStickers] = useState([]);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(30);
  
  // Sticker builder
  const [stickerText, setStickerText] = useState('');
  const [stickerY, setStickerY] = useState(0.4); // 0.1 to 0.8
  const [stickerStyle, setStickerStyle] = useState('glow'); // 'glow' | 'box'
  const [showStickerForm, setShowStickerForm] = useState(false);

  // Aura lighting settings
  const [vibeColor, setVibeColor] = useState("#00f2ff");
  const [vibeIntensity, setVibeIntensity] = useState(70);

  const videoRef = useRef(null);

  const reset = () => {
    videoRef.current?.pauseAsync().catch(() => {});
    setAsset(null);
    setCaption('');
    setSoundName('');
    setStep('pick');
    setUploading(false);
    setFilter('none');
    setVisibility('public');
    setStickers([]);
    setTrimStart(0);
    setTrimEnd(30);
    setStickerText('');
    setStickerY(0.4);
    setStickerStyle('glow');
    setShowStickerForm(false);
    setVibeColor("#00f2ff");
    setVibeIntensity(70);
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
    
    // Automatically set trim end based on duration
    const assetDuration = picked.duration ? Math.floor(picked.duration / 1000) : 30;
    setTrimEnd(Math.min(assetDuration, 30));

    setAsset(picked);
    setStep('details');
  }, []);

  const handleAddSticker = () => {
    if (!stickerText.trim()) return;
    setStickers(prev => [
      ...prev,
      {
        text: stickerText.trim(),
        y: stickerY,
        style: stickerStyle
      }
    ]);
    setStickerText('');
    setShowStickerForm(false);
  };

  const handleRemoveSticker = (idx) => {
    setStickers(prev => prev.filter((_, i) => i !== idx));
  };

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
        user_id: user?.id,
        media_url: publicUrl,
        media_type: isVideo ? 'video' : 'image',
        caption: caption.trim(),
        visibility,
        metadata: {
          filter,
          stickers,
          trim: { start: trimStart, end: trimEnd },
          vibeColor,
          vibeIntensity
        }
      };
      if (soundName.trim()) payload.sound_name = soundName.trim();

      const ok = await resilient(
        [
          () => supabase.from('reels').insert(payload),
          () => supabase.from('reels').upsert(payload),
          () => supabase.rpc('create_reel', { p_user_id: user?.id, p_media_url: publicUrl, p_caption: payload.caption, p_sound_name: payload.sound_name || null, p_metadata: payload.metadata, p_visibility: payload.visibility }),
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

  // ── Helper filter color picker for WYSIWYG Creator preview ──────────────────
  const getFilterColor = (fid) => {
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

  const creatorFilterColor = getFilterColor(filter);
  const isVideoAsset = asset?.type === 'video' || asset?.mimeType?.startsWith('video/');

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
              {step === 'pick' ? 'New Reel' : 'Reel Advanced Editor'}
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

          <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
              /* ── Step 2: Advanced Editor & details ── */
              <View style={s.detailsArea}>
                {/* WYSIWYG Preview Frame */}
                <View style={[s.previewWrap, { backgroundColor: '#000' }]}>
                  {isVideoAsset ? (
                    <Video
                      ref={videoRef}
                      source={{ uri: asset.uri }}
                      style={s.preview}
                      resizeMode={ResizeMode.COVER}
                      shouldPlay
                      isLooping
                      isMuted
                      onPlaybackStatusUpdate={s => {
                        // Loop inside trim bounds if defined
                        if (s.positionMillis && trimEnd && s.positionMillis >= trimEnd * 1000) {
                          videoRef.current?.setPositionAsync(trimStart * 1000).catch(() => {});
                        }
                      }}
                    />
                  ) : (
                    <Image source={{ uri: asset.uri }} style={s.preview} resizeMode="cover" />
                  )}

                  {/* Real-time Visual Filter Overlay */}
                  {creatorFilterColor && (
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: creatorFilterColor, pointerEvents: 'none' }]} />
                  )}

                  {/* Real-time Stickers Overlay */}
                  {stickers.map((st, i) => (
                    <View key={i} style={[s.previewSticker, { top: `${(st.y || 0.4) * 100}%` }]}>
                      <Text style={[s.previewStickerText, st.style === 'glow' && { textShadowColor: primary, textShadowRadius: 8 }]}>
                        {st.text}
                      </Text>
                    </View>
                  ))}

                  <View style={[s.previewBadge, { backgroundColor: `${primary}22`, borderColor: `${primary}40` }]}>
                    <Feather name={isVideoAsset ? 'video' : 'image'} size={10} color={primary} />
                    <Text style={{ color: primary, fontSize: 9, fontWeight: '800' }}>
                      {isVideoAsset ? 'VIDEO' : 'PHOTO'}
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

                {/* Quick tags */}
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

                {/* ADVANCED CREATOR EDITOR CONTROLS */}
                <View style={[s.divider, { backgroundColor: `${primary}20` }]} />
                <Text style={{ color: primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12 }}>CREATOR EDITING TOOLS</Text>

                {/* Real-time Color Filter selection */}
                <Text style={[s.fieldLabel, { color: muted }]}>COLOR FILTER PRESET</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 6 }}>
                  {FILTERS.map(f => (
                    <TouchableOpacity
                      key={f.id}
                      style={[s.editorChip, filter === f.id && { backgroundColor: primary, borderColor: primary }]}
                      onPress={() => setFilter(f.id)}
                    >
                      <Text style={[s.editorChipText, { color: filter === f.id ? '#000' : textColor }]}>{f.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Interactive sticker creator */}
                <Text style={[s.fieldLabel, { color: muted, marginTop: 12 }]}>TEXT OVERLAYS & STICKERS</Text>
                {stickers.length > 0 && (
                  <View style={{ gap: 6, marginBottom: 8 }}>
                    {stickers.map((st, i) => (
                      <View key={i} style={[s.stickerRow, { backgroundColor: surface }]}>
                        <Text style={{ color: textColor, fontSize: 12, flex: 1 }} numberOfLines={1}>"{st.text}" (y: {Math.round(st.y * 100)}%)</Text>
                        <TouchableOpacity onPress={() => handleRemoveSticker(i)}>
                          <Feather name="trash" size={14} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {showStickerForm ? (
                  <View style={[s.stickerForm, { backgroundColor: surface, borderColor: `${primary}30` }]}>
                    <TextInput
                      style={[s.stickerInput, { color: textColor, borderColor: `${primary}20` }]}
                      placeholder="Sticker Text..."
                      placeholderTextColor={muted}
                      value={stickerText}
                      onChangeText={setStickerText}
                      maxLength={40}
                    />
                    
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                      <Text style={{ color: muted, fontSize: 11 }}>Position Y: {Math.round(stickerY * 100)}%</Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {[{ l: 'Top', v: 0.25 }, { l: 'Center', v: 0.45 }, { l: 'Bottom', v: 0.65 }].map(pos => (
                          <TouchableOpacity
                            key={pos.l}
                            onPress={() => setStickerY(pos.v)}
                            style={[s.miniChip, stickerY === pos.v && { backgroundColor: primary }]}
                          >
                            <Text style={{ color: stickerY === pos.v ? '#000' : textColor, fontSize: 10 }}>{pos.l}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                      <Text style={{ color: muted, fontSize: 11 }}>Sticker Style</Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {[{ l: 'Neon Glow', v: 'glow' }, { l: 'Dark Box', v: 'box' }].map(st => (
                          <TouchableOpacity
                            key={st.v}
                            onPress={() => setStickerStyle(st.v)}
                            style={[s.miniChip, stickerStyle === st.v && { backgroundColor: primary }]}
                          >
                            <Text style={{ color: stickerStyle === st.v ? '#000' : textColor, fontSize: 10 }}>{st.l}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                      <TouchableOpacity style={[s.stickerBtn, { backgroundColor: primary }]} onPress={handleAddSticker}>
                        <Text style={{ color: '#000', fontWeight: '900', fontSize: 11 }}>Add</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.stickerBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: `${primary}40` }]} onPress={() => setShowStickerForm(false)}>
                        <Text style={{ color: textColor, fontWeight: '700', fontSize: 11 }}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={[s.addStickerRow, { borderColor: `${primary}30` }]} onPress={() => setShowStickerForm(true)}>
                    <Feather name="type" size={14} color={primary} />
                    <Text style={{ color: primary, fontSize: 12, fontWeight: '700' }}>Add Text Sticker overlay</Text>
                  </TouchableOpacity>
                )}

                {/* Simulated trimming crop boundaries */}
                {isVideoAsset && (
                  <>
                    <Text style={[s.fieldLabel, { color: muted, marginTop: 12 }]}>VIDEO CROP LOOP BOUNDS</Text>
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: muted, fontSize: 9 }}>START SECOND</Text>
                        <TextInput
                          style={[s.numInput, { color: textColor, backgroundColor: surface, borderColor: `${primary}20` }]}
                          keyboardType="numeric"
                          value={String(trimStart)}
                          onChangeText={v => setTrimStart(Math.max(0, parseInt(v) || 0))}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: muted, fontSize: 9 }}>END SECOND (MAX 30s)</Text>
                        <TextInput
                          style={[s.numInput, { color: textColor, backgroundColor: surface, borderColor: `${primary}20` }]}
                          keyboardType="numeric"
                          value={String(trimEnd)}
                          onChangeText={v => setTrimEnd(Math.min(30, parseInt(v) || 30))}
                        />
                      </View>
                    </View>
                  </>
                )}

                {/* Access Visibility settings */}
                <Text style={[s.fieldLabel, { color: muted, marginTop: 12 }]}>WHO CAN VIEW THIS REEL</Text>
                <View style={{ gap: 8 }}>
                  {VISIBILITIES.map(vis => (
                    <TouchableOpacity
                      key={vis.id}
                      style={[s.radioRow, { backgroundColor: surface, borderColor: visibility === vis.id ? primary : 'transparent' }]}
                      onPress={() => setVisibility(vis.id)}
                    >
                      <Feather name={visibility === vis.id ? 'check-circle' : 'circle'} size={14} color={visibility === vis.id ? primary : muted} />
                      <Text style={{ color: textColor, fontSize: 12, fontWeight: '700' }}>{vis.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Vibe color aura picker */}
                <Text style={[s.fieldLabel, { color: muted, marginTop: 12 }]}>REEL BACKDROP AURA LIGHTING</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  {VIBE_COLORS.map(c => (
                    <TouchableOpacity
                      key={c.id}
                      style={[s.vibeBtn, { backgroundColor: c.id }, vibeColor === c.id && { borderWidth: 2, borderColor: '#fff' }]}
                      onPress={() => setVibeColor(c.id)}
                    >
                      {vibeColor === c.id && <Feather name="check" size={12} color="#000" />}
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Sound settings */}
                <Text style={[s.fieldLabel, { color: muted, marginTop: 12 }]}>SOUND NAME (OPTIONAL)</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyBetween: 'space-between', paddingHorizontal: 20, paddingVertical: 14, justifyContent: 'space-between' },
  title: { fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  postBtn: { paddingHorizontal: 18, paddingVertical: 7, borderRadius: 20 },
  postBtnText: { color: '#000', fontWeight: '900', fontSize: 13 },
  body: { paddingHorizontal: 20, paddingBottom: 40 },
  pickArea: { alignItems: 'center', paddingTop: 20, gap: 20 },
  pickBox: { width: SW - 48, aspectRatio: 9 / 16, maxHeight: 340, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 12 },
  pickLabel: { fontSize: 16, fontWeight: '900' },
  pickSub: { fontSize: 12 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tipText: { fontSize: 11 },
  detailsArea: { gap: 4 },
  previewWrap: { width: '100%', aspectRatio: 9 / 16, maxHeight: 260, borderRadius: 16, overflow: 'hidden', alignSelf: 'center', marginBottom: 14, position: 'relative' },
  preview: { width: '100%', height: '100%' },
  previewBadge: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  previewSticker: { position: 'absolute', left: 16, right: 16, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  previewStickerText: { color: '#fff', fontSize: 13, fontWeight: '900', textAlign: 'center' },
  fieldLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginTop: 10, marginBottom: 5 },
  captionInput: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, lineHeight: 20, minHeight: 90, textAlignVertical: 'top' },
  charCount: { fontSize: 10, textAlign: 'right', marginTop: 3 },
  tagChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  soundRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  soundInput: { flex: 1, fontSize: 13 },
  divider: { height: 1, marginVertical: 16 },
  editorChip: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  editorChipText: { fontSize: 11, fontWeight: '700' },
  addStickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, justifyContent: 'center' },
  stickerForm: { padding: 12, borderWidth: 1, borderRadius: 12, marginTop: 6, gap: 4 },
  stickerInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12 },
  miniChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  stickerBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  stickerRow: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 10 },
  numInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, textAlign: 'center' },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
  vibeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
