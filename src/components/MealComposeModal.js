/**
 * MealComposeModal — a restaurant posts a dish: menu item, special, tasting or
 * fast-food. Business accounts only (RLS enforces it too). Captures a coarse
 * device location so boosted meals can surface "near you".
 */
import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Platform, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Feather from '@expo/vector-icons/Feather';
import { SmartImage } from './SmartImage';
import { uploadToStorage } from '../services/storageService';
import { MealService } from '../services/mealService';
import { LocationService } from '../services/locationService';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';

const TYPES = [
  { key: 'menu', label: 'Menu item', icon: 'book-open' },
  { key: 'special', label: 'Special', icon: 'star' },
  { key: 'tasting', label: 'Tasting', icon: 'award' },
  { key: 'fastfood', label: 'Fast food', icon: 'zap' },
];

export function MealComposeModal({ visible, business, onClose, onPosted }) {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const { show: showToast } = useToast();
  const primary = currentTheme?.primary || '#00f2ff';
  const bg = currentTheme?.background || '#0d1112';
  const text = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const surface = currentTheme?.surface || 'rgba(255,255,255,0.05)';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [type, setType] = useState('menu');
  const [tags, setTags] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => { setTitle(''); setDescription(''); setPrice(''); setType('menu'); setTags(''); setImageUrl(''); };

  const pickImage = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { showToast('Photo access is needed to add a photo.', 'error'); return; }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]) return;
      setUploading(true);
      const asset = result.assets[0];
      const ext = (asset.uri.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
      const fileName = `${user?.id}/meals/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const url = await uploadToStorage(asset.uri, 'event-media', fileName, { mimeType: asset.mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}` });
      setImageUrl(url);
    } catch {
      showToast('Photo upload failed — you can add it later.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!title.trim()) { showToast('Give the dish a name.', 'error'); return; }
    if (!business?.id) { showToast('Set up your business profile first.', 'error'); return; }
    setSaving(true);
    try {
      let coords = LocationService.getCached?.();
      const meal = await MealService.createMeal(business.id, user.id, {
        title, description, price, currency: 'R', image_url: imageUrl || null, meal_type: type,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        lat: coords?.lat ?? null, lon: coords?.lon ?? null,
      });
      showToast('Posted to The Meal 🍽️', 'success');
      reset();
      onPosted?.(meal);
      onClose?.();
    } catch (e) {
      showToast(e?.message || 'Could not post. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: bg, borderColor: `${primary}30` }]}>
          <View style={s.handle} />
          <View style={s.headerRow}>
            <Text style={[s.header, { color: text }]}>Post to The Meal</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Feather name="x" size={22} color={text} /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24, gap: 12 }}>
            <TouchableOpacity onPress={pickImage} activeOpacity={0.85} style={[s.imgPick, { borderColor: `${primary}40`, backgroundColor: surface }]}>
              {uploading
                ? <ActivityIndicator color={primary} />
                : imageUrl
                  ? <SmartImage source={imageUrl} style={s.img} />
                  : <View style={{ alignItems: 'center', gap: 6 }}><Feather name="camera" size={22} color={primary} /><Text style={{ color: muted, fontSize: 12 }}>Add a photo</Text></View>}
            </TouchableOpacity>

            <View style={s.typeRow}>
              {TYPES.map(t => (
                <TouchableOpacity key={t.key} onPress={() => setType(t.key)}
                  style={[s.typeChip, { borderColor: type === t.key ? primary : `${primary}25`, backgroundColor: type === t.key ? primary : 'transparent' }]}>
                  <Feather name={t.icon} size={12} color={type === t.key ? '#000' : primary} />
                  <Text style={{ color: type === t.key ? '#000' : primary, fontSize: 11, fontWeight: '800' }}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput value={title} onChangeText={setTitle} placeholder="Dish name" placeholderTextColor={muted} style={[s.input, { color: text, borderColor: `${primary}25` }]} maxLength={120} />
            <TextInput value={description} onChangeText={setDescription} placeholder="Describe it — ingredients, why it's special…" placeholderTextColor={muted} multiline style={[s.input, { color: text, borderColor: `${primary}25`, height: 84, textAlignVertical: 'top' }]} maxLength={600} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput value={price} onChangeText={setPrice} placeholder="Price (R)" placeholderTextColor={muted} keyboardType="numeric" style={[s.input, { color: text, borderColor: `${primary}25`, flex: 1 }]} />
              <TextInput value={tags} onChangeText={setTags} placeholder="tags, comma, sep" placeholderTextColor={muted} style={[s.input, { color: text, borderColor: `${primary}25`, flex: 1.4 }]} />
            </View>

            <TouchableOpacity onPress={submit} disabled={saving || uploading} style={[s.submit, { backgroundColor: primary, opacity: saving || uploading ? 0.6 : 1 }]}>
              {saving ? <ActivityIndicator color="#000" /> : <Text style={s.submitText}>Post dish</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 16 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  header: { fontSize: 18, fontWeight: '900' },
  imgPick: { height: 150, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, backgroundColor: 'rgba(255,255,255,0.04)' },
  submit: { paddingVertical: 15, borderRadius: 16, alignItems: 'center', marginTop: 4 },
  submitText: { color: '#000', fontWeight: '900', fontSize: 15 },
});

export default MealComposeModal;
