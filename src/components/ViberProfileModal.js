import React from 'react';
import { Modal, View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import { GlassView } from './GlassView';
import { useTheme } from '../context/ThemeContext';

export const ViberProfileModal = ({ visible, user, onClose }) => {
  const { currentTheme } = useTheme();

  if (!user) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <GlassView style={styles.container}>
          <TouchableOpacity style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <Image source={{ uri: user.avatar_url || 'https://via.placeholder.com/150' }} style={[styles.avatar, { borderColor: currentTheme?.primary || '#00f2ff' }]} />
            <Text style={styles.username}>@{user.username}</Text>
            <View style={[styles.badge, { backgroundColor: currentTheme?.primary || '#00f2ff' }]}>
                <Text style={styles.badgeText}>{user.rank || 'Royal Viber'}</Text>
            </View>

            <View style={styles.statsRow}>
                <View style={styles.stat}>
                    <Text style={styles.statVal}>{user.vibe_score || 0}</Text>
                    <Text style={styles.statLab}>Vibe Score</Text>
                </View>
                <View style={styles.stat}>
                    <Text style={styles.statVal}>?</Text>
                    <Text style={styles.statLab}>Followers</Text>
                </View>
            </View>

            <Text style={styles.sectionTitle}>INTERESTS</Text>
            <View style={styles.interests}>
                {(user.interests || ['None']).map(i => (
                    <View key={i} style={styles.tag}>
                        <Text style={styles.tagText}>{i}</Text>
                    </View>
                ))}
            </View>

            <TouchableOpacity style={[styles.msgBtn, { backgroundColor: currentTheme?.primary || '#00f2ff' }]}>
                <Text style={styles.msgBtnText}>SEND ROYAL DECREE (DM)</Text>
            </TouchableOpacity>
          </ScrollView>
        </GlassView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  container: { width: '85%', maxHeight: '70%', padding: 20 },
  close: { alignSelf: 'flex-end', padding: 5 },
  closeText: { color: 'white', fontSize: 18 },
  content: { alignItems: 'center', paddingBottom: 20 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, marginBottom: 15 },
  username: { color: 'white', fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  badge: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  badgeText: { color: 'black', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  statsRow: { flexDirection: 'row', marginTop: 25, width: '100%', justifyContent: 'space-around', borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 20 },
  stat: { alignItems: 'center' },
  statVal: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  statLab: { color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 4 },
  sectionTitle: { color: 'white', fontWeight: 'bold', fontSize: 12, marginTop: 30, letterSpacing: 1, alignSelf: 'flex-start' },
  interests: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, alignSelf: 'flex-start' },
  tag: { backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, marginRight: 8, marginBottom: 8 },
  tagText: { color: 'white', fontSize: 11 },
  msgBtn: { marginTop: 30, paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25, width: '100%', alignItems: 'center' },
  msgBtnText: { color: 'black', fontWeight: '900', fontSize: 12 },
});
