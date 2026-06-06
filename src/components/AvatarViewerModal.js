/**
 * AvatarViewerModal — tap a profile picture to view it full-screen.
 *
 * Handles the empty case explicitly: if the person has no photo (or it fails to
 * load) it shows a clear "No profile picture" placeholder instead of a broken
 * image. Theme-aware. Used anywhere an avatar is tappable.
 */
import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const { width: SCREEN_W } = Dimensions.get('window');

export const AvatarViewerModal = ({ visible, onClose, uri, username }) => {
  const { currentTheme } = useTheme();
  const primary = currentTheme?.primary || '#00f2ff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  const [failed, setFailed] = useState(false);
  useEffect(() => { if (visible) setFailed(false); }, [visible, uri]);

  const hasPic = !!uri && !failed;
  const initial = (username || '?').trim().slice(0, 1).toUpperCase();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        {!!username && (
          <View style={s.header} pointerEvents="none">
            <Text style={s.handle}>@{username}</Text>
          </View>
        )}

        {hasPic ? (
          <Image
            source={{ uri }}
            style={s.image}
            resizeMode="contain"
            onError={() => setFailed(true)}
          />
        ) : (
          <View style={s.emptyWrap}>
            <View style={[s.emptyCircle, { borderColor: `${primary}40`, backgroundColor: `${primary}12` }]}>
              <Text style={[s.emptyInitial, { color: primary }]}>{initial}</Text>
            </View>
            <Feather name="image" size={20} color={muted} style={{ marginTop: 18 }} />
            <Text style={[s.emptyText, { color: muted }]}>
              {uri ? 'Picture could not be loaded' : 'No profile picture yet'}
            </Text>
          </View>
        )}

        <TouchableOpacity style={s.closeBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="x" size={24} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' },
  header: { position: 'absolute', top: 54, left: 0, right: 0, alignItems: 'center' },
  handle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  image: { width: SCREEN_W, height: SCREEN_W },
  closeBtn: { position: 'absolute', top: 48, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { alignItems: 'center', paddingHorizontal: 40 },
  emptyCircle: { width: 120, height: 120, borderRadius: 60, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  emptyInitial: { fontSize: 52, fontWeight: '900' },
  emptyText: { fontSize: 14, marginTop: 8, textAlign: 'center' },
});

export default AvatarViewerModal;
