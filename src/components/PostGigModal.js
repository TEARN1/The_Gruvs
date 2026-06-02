import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TextInput,
  TouchableOpacity, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GlassView } from './GlassView';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { resilient } from '../utils/resilience';

const GIG_CATEGORIES = [
  { key: 'moving',   label: 'Moving',   icon: 'truck' },
  { key: 'assembly', label: 'Assembly', icon: 'tool' },
  { key: 'packing',  label: 'Packing',  icon: 'box' },
  { key: 'crew',     label: 'Event Crew', icon: 'users' },
];

export const PostGigModal = ({ visible, onClose, onPostSuccess }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(GIG_CATEGORIES[0].key);
  const [pay, setPay] = useState('');
  const [timeWindow, setTimeWindow] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const primary = currentTheme?.primary || "#00f2ff";
  const bg = currentTheme?.background || "#0d1112";
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const surface = currentTheme?.surface || 'rgba(255,255,255,0.06)';

  const reset = () => {
    setTitle('');
    setDescription('');
    setCategory(GIG_CATEGORIES[0].key);
    setPay('');
    setTimeWindow('');
    setLoading(false);
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handlePost = async () => {
    if (!title.trim() || !description.trim() || !pay.trim()) {
      setError('Title, description and pay are required.');
      return;
    }
    if (!user) {
      setError('You must be signed in to post a gig.');
      return;
    }

    setLoading(true);
    setError('');

    const payload = {
      user_id: user?.id,
      title: title.trim(),
      description: description.trim(),
      category,
      pay_rands: parseFloat(pay),
      time_window: timeWindow.trim() || 'Flexible',
      active: true,
      created_at: new Date().toISOString(),
    };

    try {
      const ok = await resilient(
        [
          () => supabase.from('gig_posts').insert([payload]),
          () => supabase.from('gig_posts').upsert([payload]),
          () => supabase.rpc('create_gig_post', { p_payload: payload }),
        ],
        { attemptsPerTier: 3, baseMs: 400, label: 'PostGigModal.insert', fallbackValue: null }
      );
      if (ok === null) throw new Error('Could not post gig');

      onPostSuccess?.();
      handleClose();
    } catch (e) {
      setError(e.message || 'Failed to post gig');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: bg, borderColor: `${primary}30` }]}>
          <View style={[s.pill, { backgroundColor: `${primary}50` }]} />

          <View style={s.header}>
            <Text style={[s.title, { color: primary }]}>POST A GIG</Text>
            <TouchableOpacity onPress={handleClose}>
              <Feather name="x" size={22} color={textColor} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[s.label, { color: muted }]}>Title *</Text>
            <TextInput
              style={[s.input, { color: textColor, borderColor: `${primary}30`, backgroundColor: surface }]}
              placeholder="What do you need help with?"
              placeholderTextColor={muted}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={[s.label, { color: muted }]}>Category</Text>
            <View style={s.catRow}>
              {GIG_CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.key}
                  style={[s.catBtn, {
                    borderColor: category === cat.key ? primary : `${primary}20`,
                    backgroundColor: category === cat.key ? `${primary}15` : 'transparent'
                  }]}
                  onPress={() => setCategory(cat.key)}
                >
                  <Feather name={cat.icon} size={14} color={category === cat.key ? primary : muted} />
                  <Text style={[s.catText, { color: category === cat.key ? primary : muted }]}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[s.label, { color: muted }]}>Description *</Text>
            <TextInput
              style={[s.input, s.textarea, { color: textColor, borderColor: `${primary}30`, backgroundColor: surface }]}
              placeholder="Give more details about the task..."
              placeholderTextColor={muted}
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
            />

            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: muted }]}>Pay (Rands) *</Text>
                <TextInput
                  style={[s.input, { color: textColor, borderColor: `${primary}30`, backgroundColor: surface }]}
                  placeholder="e.g. 500"
                  placeholderTextColor={muted}
                  keyboardType="numeric"
                  value={pay}
                  onChangeText={setPay}
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: muted }]}>Time Window</Text>
                <TextInput
                  style={[s.input, { color: textColor, borderColor: `${primary}30`, backgroundColor: surface }]}
                  placeholder="e.g. Sat 10am"
                  placeholderTextColor={muted}
                  value={timeWindow}
                  onChangeText={setTimeWindow}
                />
              </View>
            </View>

            {!!error && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>⚠️ {error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[s.postBtn, { backgroundColor: primary }]}
              onPress={handlePost}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#000" /> : <Text style={s.postBtnText}>POST GIG</Text>}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.8)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, borderTopWidth: 1 },
  pill: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 14, marginBottom: 18 },
  textarea: { height: 100, textAlignVertical: 'top' },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  catBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  catText: { fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row' },
  postBtn: { paddingVertical: 16, borderRadius: 30, alignItems: 'center', marginTop: 10 },
  postBtnText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  errorBox: { backgroundColor: 'rgba(239,68,68,0.1)', padding: 12, borderRadius: 10, marginBottom: 16 },
  errorText: { color: "#ef4444", fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
