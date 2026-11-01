/**
 * VideoStickerMakerModal — Turn any video or clip into an animated chat sticker!
 *
 * Supports picking from camera roll, selecting a video URL,
 * adding punchy captions/emojis, and sending as a compact animated sticker.
 */
import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { SmartImage } from './SmartImage';
import { useTheme } from '../context/ThemeContext';
import { useToast } from './ToastNotification';
import { uploadToStorage } from '../services/storageService';
import { useAuth } from '../context/AuthContext';
import { haptics } from '../utils/haptics';

export function VideoStickerMakerModal({
  visible,
  onClose,
  onStickerCreated,
}) {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#090d0f';
  const surface   = currentTheme?.surface   || '#131b1f';
  const textColor = currentTheme?.text       || '#ffffff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.72)';

  const [mediaUri, setMediaUri] = useState(null);
  const [isVideo, setIsVideo] = useState(true);
  const [stickerCaption, setStickerCaption] = useState('');
  const [emojiBadge, setEmojiBadge] = useState('🔥');
  const [creating, setCreating] = useState(false);

  const STICKER_EMOJIS = ['🔥', '😂', '💀', '💯', '👑', '👀', '🎉', '⚡', '😎', '🫡'];

  const pickVideo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.7,
        videoMaxDuration: 15,
      });

      if (!result.canceled && result.assets?.length) {
        const a = result.assets[0];
        setMediaUri(a.uri);
        const isVid = a.type === 'video' || a.mimeType?.startsWith('video/') || /\.(mp4|mov|webm|3gp)/i.test(a.uri);
        setIsVideo(isVid);
      }
    } catch {
      toast.show('Failed to pick video for sticker.', 'error');
    }
  };

  const handleCreateAndSend = async () => {
    if (!mediaUri) {
      toast.show('Select a video or clip first.', 'info');
      return;
    }
    if (!user) return;
    setCreating(true);
    haptics.impactLight();

    try {
      // Upload sticker asset
      const ext = isVideo ? 'mp4' : 'jpg';
      const path = `${user.id}/sticker_${Date.now()}.${ext}`;
      const url = await uploadToStorage(mediaUri, 'chat_media', path, {
        mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
      });

      onStickerCreated?.({
        stickerUrl: url,
        caption: stickerCaption.trim(),
        emoji: emojiBadge,
        isVideo,
      });

      toast.show('Sticker created!', 'success');
      setMediaUri(null);
      setStickerCaption('');
      onClose();
    } catch (e) {
      toast.show('Failed to upload sticker.', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: bg, borderColor: `${primary}35` }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: `${primary}20` }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Feather name="film" size={18} color={primary} />
              <Text style={[styles.headerTitle, { color: textColor }]}>VIDEO STICKER MAKER</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={18} color={textColor} />
            </TouchableOpacity>
          </View>

          {/* Video Preview or Pick Prompt */}
          <View style={[styles.previewArea, { backgroundColor: surface, borderColor: `${primary}25` }]}>
            {mediaUri ? (
              <View style={styles.stickerPreviewBox}>
                {isVideo ? (
                  <Video
                    source={{ uri: mediaUri }}
                    style={styles.previewVideo}
                    resizeMode={ResizeMode.COVER}
                    isLooping
                    isMuted
                    shouldPlay
                  />
                ) : (
                  <SmartImage source={mediaUri} style={styles.previewVideo} resizeMode="cover" />
                )}
                {/* Floating Sticker Badge */}
                <View style={[styles.floatingBadge, { borderColor: primary }]}>
                  <Text style={{ fontSize: 20 }}>{emojiBadge}</Text>
                  {stickerCaption ? (
                    <Text style={[styles.floatingCaption, { color: '#fff' }]} numberOfLines={1}>
                      {stickerCaption}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity onPress={() => setMediaUri(null)} style={styles.clearBtn}>
                  <Feather name="refresh-cw" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={pickVideo} style={styles.pickPrompt}>
                <View style={[styles.pickIcon, { backgroundColor: `${primary}18`, borderColor: `${primary}45` }]}>
                  <Feather name="video" size={26} color={primary} />
                </View>
                <Text style={[styles.pickTitle, { color: textColor }]}>Choose Video Clip to Loop</Text>
                <Text style={[styles.pickSub, { color: muted }]}>Tap to pick from phone or saved media</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Emoji Badge Selector */}
          <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
            <Text style={[styles.sectionLabel, { color: muted }]}>STICKER BADGE</Text>
            <View style={styles.emojiRow}>
              {STICKER_EMOJIS.map((e) => (
                <TouchableOpacity
                  key={e}
                  onPress={() => { setEmojiBadge(e); haptics.impactLight(); }}
                  style={[
                    styles.emojiBtn,
                    emojiBadge === e && { borderColor: primary, backgroundColor: `${primary}20` },
                  ]}
                >
                  <Text style={{ fontSize: 18 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Caption Input */}
          <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
            <Text style={[styles.sectionLabel, { color: muted }]}>CAPTION TEXT (OPTIONAL)</Text>
            <TextInput
              style={[styles.captionInput, { color: textColor, backgroundColor: surface, borderColor: `${primary}30` }]}
              placeholder="e.g. MOOD TONIGHT 🔥"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={stickerCaption}
              onChangeText={setStickerCaption}
              maxLength={32}
            />
          </View>

          {/* Action Button */}
          <View style={{ padding: 16 }}>
            <TouchableOpacity
              onPress={handleCreateAndSend}
              disabled={creating || !mediaUri}
              style={[
                styles.sendStickerBtn,
                { backgroundColor: mediaUri ? primary : `${primary}40` },
              ]}
            >
              {creating ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <>
                  <Feather name="send" size={16} color="#000" />
                  <Text style={styles.sendStickerText}>DROP STICKER IN CHAT</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  closeBtn: {
    padding: 4,
  },
  previewArea: {
    height: 190,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerPreviewBox: {
    width: '100%',
    height: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewVideo: {
    width: '100%',
    height: '100%',
  },
  floatingBadge: {
    position: 'absolute',
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderWidth: 1,
  },
  floatingCaption: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  clearBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickPrompt: {
    alignItems: 'center',
    gap: 8,
  },
  pickIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  pickSub: {
    fontSize: 12,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  emojiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emojiBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
  },
  sendStickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  sendStickerText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
