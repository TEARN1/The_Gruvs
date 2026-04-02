import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  SafeAreaView,
  Dimensions,
  Image,
  useWindowDimensions,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { THEME, ACCENT, GOLD } from '../theme';
import { useStore } from '../state/useStore';

const { width: screenWidth } = Dimensions.get('window');

export default function CreateEventModal({ visible, onClose }) {
  const { width } = useWindowDimensions();
  const { addPulseEvent, setAddEventModalVisible } = useStore();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    startDate: '',
    guestLimit: '',
    media: [],
    ticketTiers: [
      { name: 'Free', price: 0, entries: '' },
      { name: 'VIP', price: '', entries: '' },
      { name: 'VVIP', price: '', entries: '' },
      { name: 'VVVIP', price: '', entries: '' },
    ],
    customTier: { name: '', price: '', entries: '' },
  });

  const handleAddPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        const newMedia = {
          id: `photo-${Date.now()}`,
          type: 'photo',
          uri: result.assets[0].uri,
        };
        setFormData({
          ...formData,
          media: [...formData.media, newMedia],
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleAddVideo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled) {
        const newMedia = {
          id: `video-${Date.now()}`,
          type: 'video',
          uri: result.assets[0].uri,
        };
        setFormData({
          ...formData,
          media: [...formData.media, newMedia],
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick video');
    }
  };

  const handleRemoveMedia = (mediaId) => {
    setFormData({
      ...formData,
      media: formData.media.filter(m => m.id !== mediaId),
    });
  };

  const handlePublishEvent = () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Event name is required');
      return;
    }

    try {
      const newEvent = addPulseEvent({
        title: formData.title,
        description: formData.description,
        location: formData.location,
        status: `${formData.startDate || 'Soon'}`,
        media: formData.media,
        color: ACCENT,
      });

      Alert.alert('Success', 'Event published to pulse timeline!');
      resetForm();
      setAddEventModalVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to publish event');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      location: '',
      startDate: '',
      guestLimit: '',
      media: [],
      ticketTiers: [
        { name: 'Free', price: 0, entries: '' },
        { name: 'VIP', price: '', entries: '' },
        { name: 'VVIP', price: '', entries: '' },
        { name: 'VVVIP', price: '', entries: '' },
      ],
      customTier: { name: '', price: '', entries: '' },
    });
  };

  const isMobile = width < 600;

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <SafeAreaView style={[styles.container, { backgroundColor: THEME.bg }]}>
        <View style={[styles.header, { paddingHorizontal: isMobile ? 12 : 20 }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={isMobile ? 24 : 28} color={ACCENT} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { fontSize: isMobile ? 18 : 22 }]}>Create Event</Text>
          <View style={{ width: isMobile ? 24 : 28 }} />
        </View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={[styles.scrollPadding, { paddingHorizontal: isMobile ? 12 : 20 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Event Name */}
          <Text style={styles.label}>Event Name</Text>
          <TextInput
            placeholder="e.g. Sunday Shisanyama"
            placeholderTextColor="#55608a"
            style={[styles.input, { fontSize: isMobile ? 14 : 16 }]}
            value={formData.title}
            onChangeText={(text) => setFormData({ ...formData, title: text })}
          />

          {/* Description */}
          <Text style={styles.label}>Description</Text>
          <TextInput
            placeholder="What's the vibe?"
            placeholderTextColor="#55608a"
            style={[styles.textArea, { fontSize: isMobile ? 14 : 16 }]}
            value={formData.description}
            onChangeText={(text) => setFormData({ ...formData, description: text })}
            multiline
            numberOfLines={4}
          />

          {/* Location */}
          <Text style={styles.label}>Location</Text>
          <TextInput
            placeholder="Address or venue"
            placeholderTextColor="#55608a"
            style={[styles.input, { fontSize: isMobile ? 14 : 16 }]}
            value={formData.location}
            onChangeText={(text) => setFormData({ ...formData, location: text })}
          />

          {/* Date & Guest Limit */}
          <View style={styles.rowContainer}>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Starting</Text>
              <TextInput
                placeholder="Date & Time"
                placeholderTextColor="#55608a"
                style={[styles.input, { fontSize: isMobile ? 14 : 16 }]}
                value={formData.startDate}
                onChangeText={(text) => setFormData({ ...formData, startDate: text })}
              />
            </View>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Guest Limit</Text>
              <TextInput
                placeholder="e.g. 50"
                placeholderTextColor="#55608a"
                style={[styles.input, { fontSize: isMobile ? 14 : 16 }]}
                value={formData.guestLimit}
                onChangeText={(text) => setFormData({ ...formData, guestLimit: text })}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Media Section */}
          <Text style={styles.label}>Media</Text>
          <View style={styles.mediaButtonsRow}>
            <TouchableOpacity style={styles.mediaBtn} onPress={handleAddPhoto}>
              <Ionicons name="image" size={20} color="#55608a" />
              <Text style={styles.mediaBtnText}>Add Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mediaBtn} onPress={handleAddVideo}>
              <Ionicons name="videocam" size={20} color="#55608a" />
              <Text style={styles.mediaBtnText}>Add Video</Text>
            </TouchableOpacity>
          </View>

          {/* Media Preview */}
          {formData.media.length > 0 && (
            <View style={styles.mediaPreviewContainer}>
              <Text style={[styles.label, { marginTop: 0 }]}>
                Media Added ({formData.media.length})
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {formData.media.map((media) => (
                  <View key={media.id} style={styles.mediaPreviewItem}>
                    {media.type === 'photo' && (
                      <Image source={{ uri: media.uri }} style={styles.mediaPreview} />
                    )}
                    {media.type === 'video' && (
                      <View style={[styles.mediaPreview, styles.videoPreview]}>
                        <Ionicons name="play-circle" size={40} color={ACCENT} />
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.removeMediaBtn}
                      onPress={() => handleRemoveMedia(media.id)}
                    >
                      <Ionicons name="close-circle" size={24} color="#ff4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Ticket Tiers */}
          <Text style={[styles.label, { marginTop: 20 }]}>Ticket Tiers</Text>
          {formData.ticketTiers.map((tier, idx) => (
            <View key={`tier-${idx}`} style={[styles.tierCard, { borderLeftColor: getTierColor(tier.name) }]}>
              <View style={[styles.tierColorBox, { backgroundColor: getTierColor(tier.name) }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.tierName}>{tier.name}</Text>
                <View style={styles.tierInputRow}>
                  <TextInput
                    placeholder="Price (R)"
                    placeholderTextColor="#55608a"
                    style={[styles.tierInput, { flex: 1 }]}
                    value={tier.price.toString()}
                    keyboardType="numeric"
                    editable={tier.name !== 'Free'}
                  />
                  <TextInput
                    placeholder="Entries"
                    placeholderTextColor="#55608a"
                    style={[styles.tierInput, { flex: 1, marginLeft: 8 }]}
                    value={tier.entries}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>
          ))}

          {/* Custom Tier */}
          <View style={styles.customTierCard}>
            <Text style={styles.label}>Add Custom Tier</Text>
            <TextInput
              placeholder="Tier name (e.g. PLATINUM)"
              placeholderTextColor="#55608a"
              style={[styles.input, { marginBottom: 8 }]}
              value={formData.customTier.name}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  customTier: { ...formData.customTier, name: text },
                })
              }
            />
            <View style={styles.tierInputRow}>
              <TextInput
                placeholder="Price"
                placeholderTextColor="#55608a"
                style={[styles.tierInput, { flex: 1 }]}
                value={formData.customTier.price}
                keyboardType="numeric"
                onChangeText={(text) =>
                  setFormData({
                    ...formData,
                    customTier: { ...formData.customTier, price: text },
                  })
                }
              />
              <TextInput
                placeholder="Entries"
                placeholderTextColor="#55608a"
                style={[styles.tierInput, { flex: 1, marginLeft: 8 }]}
                value={formData.customTier.entries}
                keyboardType="numeric"
                onChangeText={(text) =>
                  setFormData({
                    ...formData,
                    customTier: { ...formData.customTier, entries: text },
                  })
                }
              />
            </View>
            <TouchableOpacity style={styles.addTierBtn}>
              <Ionicons name="add-circle" size={18} color="#fff" />
              <Text style={styles.addTierBtnText}>Add Tier</Text>
            </TouchableOpacity>
          </View>

          {/* Publish Button */}
          <TouchableOpacity
            style={[styles.publishBtn, { marginTop: 30, marginBottom: 40 }]}
            onPress={handlePublishEvent}
          >
            <Ionicons name="rocket" size={20} color="#fff" />
            <Text style={styles.publishBtnText}>🚀 Publish Event</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function getTierColor(tierName) {
  const colors = {
    Free: '#10b981',
    VIP: ACCENT,
    VVIP: GOLD,
    VVVIP: '#a78bfa',
  };
  return colors[tierName] || ACCENT;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050514' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 1,
    flex: 1,
    textAlign: 'center',
  },
  closeBtn: { padding: 8 },
  scrollContent: { flex: 1 },
  scrollPadding: { paddingVertical: 20 },
  label: {
    color: '#7291PR',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#1a1d2e',
    borderColor: '#2d2f4a',
    borderWidth: 1,
    borderRadius: 12,
    color: '#fff',
    padding: 12,
    marginBottom: 12,
  },
  textArea: {
    backgroundColor: '#1a1d2e',
    borderColor: '#2d2f4a',
    borderWidth: 1,
    borderRadius: 12,
    color: '#fff',
    padding: 12,
    marginBottom: 12,
    height: 100,
    textAlignVertical: 'top',
  },
  rowContainer: { flexDirection: 'row', gap: 12 },
  halfWidth: { flex: 1 },
  mediaButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  mediaBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1d2e',
    borderColor: '#2d2f4a',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
  },
  mediaBtnText: { color: '#55608a', fontSize: 12, fontWeight: '600' },
  mediaPreviewContainer: { marginVertical: 16 },
  mediaPreviewItem: { position: 'relative', marginRight: 12 },
  mediaPreview: { width: 100, height: 100, borderRadius: 12, backgroundColor: '#1a1d2e' },
  videoPreview: { justifyContent: 'center', alignItems: 'center' },
  removeMediaBtn: { position: 'absolute', top: -8, right: -8 },
  tierCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1d2e',
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  tierColorBox: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  tierName: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  tierInputRow: { flexDirection: 'row', gap: 8 },
  tierInput: {
    backgroundColor: '#0f1118',
    borderColor: '#2d2f4a',
    borderWidth: 1,
    borderRadius: 8,
    color: '#fff',
    padding: 10,
    fontSize: 12,
  },
  customTierCard: {
    backgroundColor: '#1a1d2e',
    borderColor: '#2d2f4a',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  addTierBtn: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  addTierBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  publishBtn: {
    backgroundColor: ACCENT,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  publishBtnText: { color: '#fff', fontWeight: '700', fontSize: 18 },
});
