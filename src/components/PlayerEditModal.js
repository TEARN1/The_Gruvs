/**
 * PlayerEditModal — edit a talent's profile (creator / claimant / admin).
 *
 * Captures the data the scout filters depend on: category, position, date of
 * birth (→ age), nationality and region — plus photo, headline and names.
 * Backed by TalentEngine.updateTalent.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity,
  TextInput, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useToast } from './ToastNotification';
import { haptics } from '../utils/haptics';
import { TalentEngine } from '../services/talentEngine';
import { TALENT_CATEGORIES } from '../constants/TalentConfig';

const CATEGORY_KEYS = Object.keys(TALENT_CATEGORIES).filter(k => k !== 'default');

export const PlayerEditModal = ({ visible, player, onClose, onSaved }) => {
  const { currentTheme } = useTheme();
  const toast = useToast();

  const primary   = currentTheme?.primary    || "#00f2ff";
  const bg        = currentTheme?.background || "#0d1112";
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface    || "#1a1f21";

  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && player) {
      setForm({
        full_name: player.full_name || '',
        known_as: player.known_as || '',
        headline: player.headline || '',
        category: player.category || '',
        primary_position: player.primary_position || '',
        date_of_birth: player.date_of_birth || '',
        nationality: player.nationality || '',
        region: player.region || '',
        photo_url: player.photo_url || '',
      });
    }
  }, [visible, player?.id]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const dobValid = !form.date_of_birth || /^\d{4}-\d{2}-\d{2}$/.test(form.date_of_birth);

  const save = async () => {
    if (!form.full_name?.trim()) { toast.show('Name is required', 'error'); return; }
    if (!dobValid) { toast.show('Date of birth must be YYYY-MM-DD', 'error'); return; }
    setSaving(true);
    haptics.medium();
    const patch = {
      full_name: form.full_name.trim(),
      known_as: form.known_as.trim() || null,
      headline: form.headline.trim() || null,
      category: form.category || null,
      primary_position: form.primary_position.trim() || null,
      date_of_birth: form.date_of_birth || null,
      nationality: form.nationality.trim() || null,
      region: form.region.trim() || null,
      photo_url: form.photo_url.trim() || null,
    };
    const ok = await TalentEngine.updateTalent(player.id, patch);
    setSaving(false);
    if (ok) { haptics.success(); toast.show('Profile saved', 'success'); onSaved?.(patch); onClose(); }
    else toast.show('Could not save', 'error');
  };

  const Field = ({ label, k, placeholder, keyboardType, hint }) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={[ed.label, { color: muted }]}>{label}</Text>
      <TextInput
        style={[ed.input, { color: textColor, borderColor: `${primary}30`, backgroundColor: surface }]}
        value={form[k]} onChangeText={v => set(k, v)}
        placeholder={placeholder} placeholderTextColor={muted}
        keyboardType={keyboardType}
      />
      {hint ? <Text style={[ed.hint, { color: muted }]}>{hint}</Text> : null}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[ed.root, { backgroundColor: bg }]}>
          <View style={ed.header}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={ed.headerBtn}>
              <Feather name="x" size={22} color={textColor} />
            </TouchableOpacity>
            <Text style={[ed.headerTitle, { color: textColor }]}>Edit Profile</Text>
            <TouchableOpacity onPress={save} disabled={saving} style={ed.headerBtn}>
              <Text style={{ color: primary, fontWeight: '900', fontSize: 14 }}>{saving ? '…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
            <Field label="FULL NAME" k="full_name" placeholder="Lionel Messi" />
            <Field label="KNOWN AS" k="known_as" placeholder="Leo" />
            <Field label="HEADLINE" k="headline" placeholder="Striker · Afro-house DJ · Stand-up" />

            <Text style={[ed.label, { color: muted }]}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2, marginBottom: 14 }}>
              {CATEGORY_KEYS.map(c => (
                <TouchableOpacity
                  key={c}
                  onPress={() => { haptics.select(); set('category', c); }}
                  style={[ed.chip, { backgroundColor: form.category === c ? primary : `${primary}12`, borderColor: form.category === c ? primary : `${primary}30` }]}
                >
                  <Text style={{ color: form.category === c ? '#000' : primary, fontWeight: '800', fontSize: 12 }}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Field label="POSITION / ROLE" k="primary_position" placeholder="Striker · Winger · DJ · Comedian" />
            <Field label="DATE OF BIRTH" k="date_of_birth" placeholder="2004-06-15" keyboardType="numbers-and-punctuation" hint="YYYY-MM-DD — used for age-based scouting" />
            <Field label="NATIONALITY" k="nationality" placeholder="ZA · Nigeria · Brazil" />
            <Field label="REGION / CITY" k="region" placeholder="Gauteng · Cape Town" hint="Used for local talent search" />
            <Field label="PHOTO URL" k="photo_url" placeholder="https://…" />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const ed = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 54 : 36, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  headerBtn: { minWidth: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14 },
  hint: { fontSize: 10, marginTop: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, borderWidth: 1 },
});

export default PlayerEditModal;
