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
  useWindowDimensions,
  Platform,
  Alert,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { LIGHT_THEME, DARK_THEME, ACCENT, GOLD } from '../../core/theme';
import { useStore } from '../../core/state/useStore';
import { uploadMediaBatch } from '../../services/storage';
import { EVENT_CATEGORIES } from '../../data/eventTaxonomy';

const { width: screenWidth } = Dimensions.get('window');

export default function CreateEventModal({ visible, onClose }) {
  const { width } = useWindowDimensions();
  const { addPulseEvent, setAddEventModalVisible, user, themeMode } = useStore();
  const [isPublishing, setIsPublishing] = useState(false);

  const theme = themeMode === 'dark' ? DARK_THEME : LIGHT_THEME;
  const isDark = themeMode === 'dark';

  const triggerHaptic = (type = 'light') => {
    if (Platform.OS !== 'web') {
      if (type === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      else if (type === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      else if (type === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

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
    privacy: 'Public', // 'Public' | 'Private' | 'Invite-only'
    category: 'General',
    showPreview: false,
    categoryModalVisible: false,
    searchCategory: '',
  });

  const handleAddPhoto = async () => {
    triggerHaptic('light');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Images,
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
    triggerHaptic('light');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Videos,
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
    triggerHaptic('medium');
    setFormData({
      ...formData,
      media: formData.media.filter(m => m.id !== mediaId),
    });
  };

  const handlePublishEvent = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Event name is required');
      return;
    }

    setIsPublishing(true);
    triggerHaptic('medium');
    try {
      // 1. Upload Media to Supabase Storage if present
      console.log('[PUBLISH] Uploading media...');
      const uploadedMedia = await uploadMediaBatch(formData.media, user?.id || 'anon');

      // 2. Add to Pulse Timeline
      const newEvent = await addPulseEvent({
        title: formData.title,
        description: formData.description,
        location: formData.location,
        category: formData.category,
        status: `${formData.startDate || 'Soon'}`,
        media: uploadedMedia.length > 0 ? uploadedMedia : formData.media, // Fallback to local if upload failed/demo
        color: ACCENT,
      });

      triggerHaptic('success');
      Alert.alert('Success', 'Event published to pulse timeline!');
      resetForm();
      onClose(); // Use passed onClose instead of internal setAddEventModalVisible for better parent control
    } catch (error) {
      console.error('[PUBLISH ERROR]', error);
      Alert.alert('Error', 'Failed to publish event');
    } finally {
      setIsPublishing(false);
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
      category: 'General',
      privacy: 'Public',
      showPreview: false,
      categoryModalVisible: false,
      searchCategory: '',
    });
  };

  const filteredCategories = EVENT_CATEGORIES.filter(c =>
    c.toLowerCase().includes(formData.searchCategory.toLowerCase())
  ).slice(0, 50);

  const isMobile = width < 600;
  const contentWidth = isMobile ? width : Math.min(width, 750);

  const PrivacyOption = ({ label, icon, current }) => (
    <TouchableOpacity
      style={[styles.privacyBtn, { backgroundColor: theme.subtle, borderColor: theme.cardBorder }, current === label && { backgroundColor: theme.accent, borderColor: theme.accent }]}
      onPress={() => {
        triggerHaptic('light');
        setFormData({ ...formData, privacy: label });
      }}
      accessibilityRole="button"
      accessibilityLabel={`Set privacy to ${label}`}
      accessibilityState={{ selected: current === label }}
    >
      <Ionicons name={icon} size={18} color={current === label ? '#fff' : theme.textDim} />
      <Text style={[styles.privacyBtnText, { color: theme.textDim }, current === label && { color: '#fff' }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
          <View style={[styles.responsiveWrapper, { width: contentWidth, backgroundColor: theme.bg }]}>
            <View style={[styles.header, { paddingHorizontal: isMobile ? 12 : 20, borderBottomColor: theme.cardBorder }]}>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                accessibilityLabel="Close create event modal"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={isMobile ? 24 : 28} color={ACCENT} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { fontSize: isMobile ? 18 : 22, color: theme.text }]} accessibilityRole="header">
                Create Event
              </Text>
              <View style={{ width: isMobile ? 24 : 28 }} />
            </View>

            <ScrollView
              style={styles.scrollContent}
              contentContainerStyle={[styles.scrollPadding, { paddingHorizontal: isMobile ? 12 : 20 }]}
              showsVerticalScrollIndicator={false}
            >
              {/* Event Name */}
              <Text style={[styles.label, { color: theme.textDim }]}>Event Name</Text>
              <TextInput
                placeholder="e.g. Sunday Shisanyama"
                placeholderTextColor={theme.textDim + '88'}
                style={[styles.input, { fontSize: isMobile ? 14 : 16, backgroundColor: theme.subtle, borderColor: theme.cardBorder, color: theme.text }]}
                value={formData.title}
                onChangeText={(text) => setFormData({ ...formData, title: text })}
                accessibilityLabel="Event Name Input"
              />

              {/* Description */}
              <Text style={[styles.label, { color: theme.textDim }]}>Description</Text>
              <TextInput
                placeholder="What's the vibe?"
                placeholderTextColor={theme.textDim + '88'}
                style={[styles.textArea, { fontSize: isMobile ? 14 : 16, backgroundColor: theme.subtle, borderColor: theme.cardBorder, color: theme.text }]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                multiline
                numberOfLines={4}
                accessibilityLabel="Event Description Input"
              />

              {/* Location */}
              <Text style={[styles.label, { color: theme.textDim }]}>Location</Text>
              <TextInput
                placeholder="Address or venue"
                placeholderTextColor={theme.textDim + '88'}
                style={[styles.input, { fontSize: isMobile ? 14 : 16, backgroundColor: theme.subtle, borderColor: theme.cardBorder, color: theme.text }]}
                value={formData.location}
                onChangeText={(text) => setFormData({ ...formData, location: text })}
                accessibilityLabel="Event Location Input"
              />

              {/* Category Picker */}
              <Text style={[styles.label, { color: theme.textDim }]}>Category</Text>
              <TouchableOpacity
                style={[styles.categoryPickerBtn, { backgroundColor: theme.subtle, borderColor: theme.cardBorder }]}
                onPress={() => {
                  triggerHaptic('light');
                  setFormData({ ...formData, categoryModalVisible: true });
                }}
                accessibilityRole="button"
                accessibilityLabel={`Select category. Current: ${formData.category}`}
              >
                <Text style={[styles.categoryPickerText, { color: formData.category === 'General' ? theme.textDim : theme.text }]}>
                  {formData.category}
                </Text>
                <Ionicons name="chevron-down" size={20} color={ACCENT} />
              </TouchableOpacity>

              {/* Date & Guest Limit */}
              <View style={styles.rowContainer}>
                <View style={styles.halfWidth}>
                  <Text style={[styles.label, { color: theme.textDim }]}>Starting</Text>
                  <TextInput
                    placeholder="Date & Time"
                    placeholderTextColor={theme.textDim + '88'}
                    style={[styles.input, { fontSize: isMobile ? 14 : 16, backgroundColor: theme.subtle, borderColor: theme.cardBorder, color: theme.text }]}
                    value={formData.startDate}
                    onChangeText={(text) => setFormData({ ...formData, startDate: text })}
                    accessibilityLabel="Event Starting Date and Time Input"
                  />
                </View>
                <View style={styles.halfWidth}>
                  <Text style={[styles.label, { color: theme.textDim }]}>Guest Limit</Text>
                  <TextInput
                    placeholder="e.g. 50"
                    placeholderTextColor={theme.textDim + '88'}
                    style={[styles.input, { fontSize: isMobile ? 14 : 16, backgroundColor: theme.subtle, borderColor: theme.cardBorder, color: theme.text }]}
                    value={formData.guestLimit}
                    onChangeText={(text) => setFormData({ ...formData, guestLimit: text })}
                    keyboardType="numeric"
                    accessibilityLabel="Event Guest Limit Input"
                  />
                </View>
              </View>

              {/* NEW: Privacy & Audience Targeting */}
              <Text style={[styles.label, { color: theme.textDim }]}>Privacy & Access</Text>
              <View style={styles.privacyRow}>
                <PrivacyOption label="Public" icon="earth" current={formData.privacy} />
                <PrivacyOption label="Private" icon="lock-closed" current={formData.privacy} />
                <PrivacyOption label="Invite-only" icon="mail" current={formData.privacy} />
              </View>

              {/* Media Section */}
              <Text style={[styles.label, { color: theme.textDim }]}>Media</Text>
              <View style={styles.mediaButtonsRow}>
                <TouchableOpacity
                  style={[styles.mediaBtn, { backgroundColor: theme.subtle, borderColor: theme.cardBorder }]}
                  onPress={handleAddPhoto}
                  accessibilityRole="button"
                  accessibilityLabel="Add Photo"
                >
                  <Ionicons name="image" size={20} color={theme.textDim} />
                  <Text style={[styles.mediaBtnText, { color: theme.textDim }]}>Add Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.mediaBtn, { backgroundColor: theme.subtle, borderColor: theme.cardBorder }]}
                  onPress={handleAddVideo}
                  accessibilityRole="button"
                  accessibilityLabel="Add Video"
                >
                  <Ionicons name="videocam" size={20} color={theme.textDim} />
                  <Text style={[styles.mediaBtnText, { color: theme.textDim }]}>Add Video</Text>
                </TouchableOpacity>
              </View>

              {/* Media Preview */}
              {formData.media.length > 0 && (
                <View style={styles.mediaPreviewContainer}>
                  <Text style={[styles.label, { marginTop: 0, color: theme.textDim }]}>
                    Media Added ({formData.media.length})
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {formData.media.map((media) => (
                      <View key={media.id} style={styles.mediaPreviewItem}>
                        {media.type === 'photo' && (
                          <Image
                            source={{ uri: media.uri }}
                            style={[styles.mediaPreview, { backgroundColor: theme.subtle }]}
                            contentFit="cover"
                            transition={200}
                          />
                        )}
                        {media.type === 'video' && (
                          <View style={[styles.mediaPreview, styles.videoPreview, { backgroundColor: theme.subtle }]}>
                            <Ionicons name="play-circle" size={40} color={ACCENT} />
                          </View>
                        )}
                        <TouchableOpacity
                          style={styles.removeMediaBtn}
                          onPress={() => handleRemoveMedia(media.id)}
                          accessibilityRole="button"
                          accessibilityLabel="Remove this media"
                        >
                          <Ionicons name="close-circle" size={24} color="#ff4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Ticket Tiers */}
              <Text style={[styles.label, { marginTop: 20, color: theme.textDim }]}>Ticket Tiers</Text>
              {formData.ticketTiers.map((tier, idx) => (
                <View key={`tier-${idx}`} style={[styles.tierCard, { borderLeftColor: getTierColor(tier.name), backgroundColor: theme.subtle }]}>
                  <View style={[styles.tierColorBox, { backgroundColor: getTierColor(tier.name) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tierName, { color: theme.text }]}>{tier.name}</Text>
                    <View style={styles.tierInputRow}>
                      <TextInput
                        placeholder="Price (R)"
                        placeholderTextColor={theme.textDim + '88'}
                        style={[styles.tierInput, { flex: 1, backgroundColor: theme.bg, borderColor: theme.cardBorder, color: theme.text }]}
                        value={tier.price.toString()}
                        keyboardType="numeric"
                        editable={tier.name !== 'Free'}
                        accessibilityLabel={`${tier.name} ticket price input`}
                      />
                      <TextInput
                        placeholder="Entries"
                        placeholderTextColor={theme.textDim + '88'}
                        style={[styles.tierInput, { flex: 1, marginLeft: 8, backgroundColor: theme.bg, borderColor: theme.cardBorder, color: theme.text }]}
                        value={tier.entries}
                        keyboardType="numeric"
                        accessibilityLabel={`${tier.name} ticket entry limit input`}
                      />
                    </View>
                  </View>
                </View>
              ))}

              {/* Custom Tier */}
              <View style={[styles.customTierCard, { backgroundColor: theme.subtle, borderColor: theme.cardBorder }]}>
                <Text style={[styles.label, { color: theme.textDim }]}>Add Custom Tier</Text>
                <TextInput
                  placeholder="Tier name (e.g. PLATINUM)"
                  placeholderTextColor={theme.textDim + '88'}
                  style={[styles.input, { marginBottom: 8, backgroundColor: theme.bg, borderColor: theme.cardBorder, color: theme.text }]}
                  value={formData.customTier.name}
                  onChangeText={(text) =>
                    setFormData({
                      ...formData,
                      customTier: { ...formData.customTier, name: text },
                    })
                  }
                  accessibilityLabel="Custom tier name input"
                />
                <View style={styles.tierInputRow}>
                  <TextInput
                    placeholder="Price"
                    placeholderTextColor={theme.textDim + '88'}
                    style={[styles.tierInput, { flex: 1, backgroundColor: theme.bg, borderColor: theme.cardBorder, color: theme.text }]}
                    value={formData.customTier.price}
                    keyboardType="numeric"
                    onChangeText={(text) =>
                      setFormData({
                        ...formData,
                        customTier: { ...formData.customTier, price: text },
                      })
                    }
                    accessibilityLabel="Custom tier price input"
                  />
                  <TextInput
                    placeholder="Entries"
                    placeholderTextColor={theme.textDim + '88'}
                    style={[styles.tierInput, { flex: 1, marginLeft: 8, backgroundColor: theme.bg, borderColor: theme.cardBorder, color: theme.text }]}
                    value={formData.customTier.entries}
                    keyboardType="numeric"
                    onChangeText={(text) =>
                      setFormData({
                        ...formData,
                        customTier: { ...formData.customTier, entries: text },
                      })
                    }
                    accessibilityLabel="Custom tier entry limit input"
                  />
                </View>
                <TouchableOpacity
                  style={styles.addTierBtn}
                  onPress={() => triggerHaptic('light')}
                  accessibilityRole="button"
                  accessibilityLabel="Add custom ticket tier"
                >
                  <Ionicons name="add-circle" size={18} color="#fff" />
                  <Text style={styles.addTierBtnText}>Add Tier</Text>
                </TouchableOpacity>
              </View>

              {/* Publish Button */}
              <View style={styles.footerActions}>
                <TouchableOpacity
                  style={[styles.previewToggle, { borderColor: ACCENT }, formData.showPreview && { backgroundColor: ACCENT }]}
                  onPress={() => {
                    triggerHaptic('light');
                    setFormData({ ...formData, showPreview: !formData.showPreview });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={formData.showPreview ? 'Hide live preview' : 'Show live preview'}
                  accessibilityState={{ selected: formData.showPreview }}
                >
                  <Ionicons name={formData.showPreview ? "eye-off" : "eye"} size={20} color={formData.showPreview ? "#fff" : ACCENT} />
                  <Text style={[styles.previewToggleText, { color: ACCENT }, formData.showPreview && { color: '#fff' }]}>
                    {formData.showPreview ? 'Hide Preview' : 'Show Preview'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.publishBtn, isPublishing && { opacity: 0.7 }]}
                  onPress={handlePublishEvent}
                  disabled={isPublishing}
                  accessibilityRole="button"
                  accessibilityLabel={isPublishing ? 'Publishing event' : 'Publish event to timeline'}
                >
                  {isPublishing ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name="rocket" size={20} color="#fff" />
                  )}
                  <Text style={styles.publishBtnText}>
                    {isPublishing ? 'Publishing...' : 'Publish Event'}
                  </Text>
                </TouchableOpacity>
              </View>

              {formData.showPreview && (
                <View style={[styles.previewContainer, { backgroundColor: ACCENT + '11', borderColor: ACCENT + '33' }]}>
                  <Text style={[styles.previewLabel, { color: ACCENT }]}>LIVE PREVIEW</Text>
                  <View style={[styles.previewCard, { backgroundColor: theme.card }]}>
                    <Text style={[styles.previewTitle, { color: theme.text }]}>{formData.title || 'Event Name'}</Text>
                    <Text style={[styles.previewDesc, { color: theme.textDim }]} numberOfLines={2}>{formData.description || 'No description yet...'}</Text>
                    <View style={styles.previewMeta}>
                      <Ionicons name="pricetag" size={12} color={ACCENT} />
                      <Text style={[styles.previewMetaText, { color: ACCENT }]}>{formData.category}</Text>
                      <View style={{ width: 10 }} />
                      <Ionicons name="location" size={12} color={ACCENT} />
                      <Text style={[styles.previewMetaText, { color: ACCENT }]}>{formData.location || 'Location'}</Text>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>

          {/* Category Search Modal */}
          <Modal visible={formData.categoryModalVisible} animationType="fade" transparent onRequestClose={() => setFormData({ ...formData, categoryModalVisible: false })}>
            <View style={styles.modalOverlay}>
              <View style={[styles.categoryModalContent, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                <View style={styles.categoryModalHeader}>
                  <Text style={[styles.categoryModalTitle, { color: theme.text }]}>Select Category</Text>
                  <TouchableOpacity
                    onPress={() => {
                      triggerHaptic('light');
                      setFormData({ ...formData, categoryModalVisible: false });
                    }}
                    accessibilityLabel="Close category picker"
                    accessibilityRole="button"
                  >
                    <Ionicons name="close" size={24} color={theme.text} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[styles.categorySearchInput, { backgroundColor: theme.subtle, borderColor: theme.cardBorder, color: theme.text }]}
                  placeholder="Search categories..."
                  placeholderTextColor={theme.textDim + '88'}
                  value={formData.searchCategory}
                  onChangeText={(text) => setFormData({ ...formData, searchCategory: text })}
                  autoFocus
                  accessibilityLabel="Search categories input"
                />
                <FlatList
                  data={filteredCategories}
                  keyExtractor={(item) => item}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.categoryItem, { borderBottomColor: theme.cardBorder }]}
                      onPress={() => {
                        triggerHaptic('medium');
                        setFormData({ ...formData, category: item, categoryModalVisible: false, searchCategory: '' });
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${item} category`}
                      accessibilityState={{ selected: formData.category === item }}
                    >
                      <Text style={[styles.categoryItemText, { color: theme.textDim }, formData.category === item && { color: ACCENT }]}>{item}</Text>
                      {formData.category === item && <Ionicons name="checkmark" size={18} color={ACCENT} />}
                    </TouchableOpacity>
                  )}
                  style={{ maxHeight: 400 }}
                />
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </KeyboardAvoidingView>
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
  container: { flex: 1, backgroundColor: '#050514', alignItems: 'center' },
  responsiveWrapper: { flex: 1, backgroundColor: '#050514' },
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
  categoryPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1d2e',
    borderColor: '#2d2f4a',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  categoryPickerText: { fontSize: 14, fontWeight: '500' },
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
  privacyRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  privacyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1d2e', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#2d2f4a', gap: 6 },
  privacyBtnActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  privacyBtnText: { color: '#55608a', fontSize: 12, fontWeight: '700' },
  privacyBtnTextActive: { color: '#fff' },
  footerActions: { gap: 15, marginTop: 30, marginBottom: 40 },
  previewToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: ACCENT },
  previewToggleActive: { backgroundColor: ACCENT },
  previewToggleText: { color: ACCENT, fontSize: 14, fontWeight: '700' },
  previewContainer: { backgroundColor: 'rgba(255,77,166,0.05)', borderRadius: 20, padding: 20, marginBottom: 40, borderWidth: 1, borderColor: 'rgba(255,77,166,0.2)' },
  previewLabel: { color: ACCENT, fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 15, textAlign: 'center' },
  previewCard: { backgroundColor: '#1e1e3f', borderRadius: 16, padding: 16 },
  previewTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  previewDesc: { color: '#94a3b8', fontSize: 13, lineHeight: 18, marginBottom: 12 },
  previewMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  previewMetaText: { color: ACCENT, fontSize: 12, fontWeight: '600' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  categoryModalContent: {
    backgroundColor: '#0a0a1e',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e1e3f',
    maxHeight: '80%',
  },
  categoryModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  categoryModalTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  categorySearchInput: {
    backgroundColor: '#1a1d2e',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#2d2f4a',
  },
  categoryItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryItemText: { color: '#94a3b8', fontSize: 16, fontWeight: '500' },
});
