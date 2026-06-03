/**
 * ClubCreateModal — create a club you own.
 *
 * A club is the "team" you vote with in tournament governance, and the entity a
 * player's career spells attach to. Backed by TournamentEngine.createClub.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity,
  TextInput, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';
import { haptics } from '../utils/haptics';
import { TournamentEngine } from '../services/tournamentEngine';
import { TALENT_CATEGORIES } from '../constants/TalentConfig';
import { useBackClose } from '../hooks/useBackClose';

const CATEGORY_KEYS = Object.keys(TALENT_CATEGORIES).filter(k => k !== 'default');

export const ClubCreateModal = ({ visible, onClose, onCreated }) => {
  useBackClose(visible, onClose);
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface    || '#1a1f21';

  const [form, setForm] = useState({ name: '', short_name: '', category: 'sport', city: '', logo_url: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) { toast.show('Club name is required', 'error'); return; }
    setSaving(true);
    haptics.medium();
    let club = null;
    try {
      club = await TournamentEngine.createClub({
        name: form.name, short_name: form.short_name.trim() || null,
        sport_type: form.category === 'sport' ? null : form.category, category: form.category,
        city: form.city.trim() || null, logo_url: form.logo_url.trim() || null, ownerId: user?.id,
      });
    } finally {
      setSaving(false);
    }
    if (club) { haptics.success(); toast.show(`${club.name} created`, 'success'); onCreated?.(club); onClose(); }
    else toast.show('Could not create club', 'error');
  };

  const Field = ({ label, k, placeholder }) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={[c.label, { color: muted }]}>{label}</Text>
      <TextInput
        style={[c.input, { color: textColor, borderColor: `${primary}30`, backgroundColor: surface }]}
        value={form[k]} onChangeText={v => set(k, v)} placeholder={placeholder} placeholderTextColor={muted}
      />
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[c.root, { backgroundColor: bg }]}>
          <View style={c.header}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={c.headerBtn}>
              <Feather name="x" size={22} color={textColor} />
            </TouchableOpacity>
            <Text style={[c.headerTitle, { color: textColor }]}>Create Club</Text>
            <TouchableOpacity onPress={save} disabled={saving} style={c.headerBtn}>
              <Text style={{ color: primary, fontWeight: '900', fontSize: 14 }}>{saving ? '…' : 'Create'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
            <Field label="CLUB NAME" k="name" placeholder="AmaZulu FC · The Comedy Crew" />
            <Field label="SHORT NAME" k="short_name" placeholder="AMA" />
            <Text style={[c.label, { color: muted }]}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2, marginBottom: 14 }}>
              {CATEGORY_KEYS.map(k => (
                <TouchableOpacity key={k} onPress={() => { haptics.select(); set('category', k); }}
                  style={[c.chip, { backgroundColor: form.category === k ? primary : `${primary}12`, borderColor: form.category === k ? primary : `${primary}30` }]}>
                  <Text style={{ color: form.category === k ? '#000' : primary, fontWeight: '800', fontSize: 12 }}>{k.charAt(0).toUpperCase() + k.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Field label="CITY" k="city" placeholder="Durban · Gauteng" />
            <Field label="LOGO URL" k="logo_url" placeholder="https://…" />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const c = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 54 : 36, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  headerBtn: { minWidth: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, borderWidth: 1 },
});

export default ClubCreateModal;
