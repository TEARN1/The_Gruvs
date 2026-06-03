/**
 * AwardCeremonyPanel — host control to create and publish awards for any event type.
 * Works for sports (top scorer, MVP), music (crowd favourite), hackathons (best project), etc.
 * Award categories are auto-selected based on event.category.
 *
 * Usage:
 *   <AwardCeremonyPanel event={event} />   — inside EventManagementPanel
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Modal, Alert, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AwardManager } from '../services/clubEngine';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { NotificationService } from '../services/notificationService';

export const AwardCeremonyPanel = ({ event }) => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const primary   = colors?.primary   || "#00f2ff";
  const textColor = colors?.text      || '#fff';
  const muted     = colors?.muted     || 'rgba(255,255,255,0.5)';
  const surface   = colors?.surface   || "#1a1f21";

  const [awards, setAwards]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding]   = useState(false);
  const [saving, setSaving]   = useState(false);

  // Search for recipient
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipientResults, setRecipientResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const categories = AwardManager.getCategoriesForEvent(event?.category);

  const [form, setForm] = useState({
    category: '',
    award_label: '',
    award_icon: '🏆',
    recipient_user_id: null,
    recipient_name: '',
    recipient_club_id: null,
    recipient_club_name: '',
    stat_value: '',
    stat_label: '',
    season: new Date().getFullYear().toString(),
    notes: '',
    is_published: false,
  });

  const load = useCallback(async () => {
    if (!event?.id) return;
    setLoading(true);
    try {
      const data = await AwardManager.listForEvent(event.id, false); // load all, including unpublished
      setAwards(data);
    } finally {
      setLoading(false);
    }
  }, [event?.id]);

  useEffect(() => { load(); }, [load]);

  const searchRecipients = async (q) => {
    if (!q.trim()) { setRecipientResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .ilike('username', `%${q}%`)
      .limit(8);
    setRecipientResults(data || []);
    setSearching(false);
  };

  const selectCategory = (cat) => {
    setForm(f => ({ ...f, category: cat.key, award_label: cat.label, award_icon: cat.icon }));
  };

  const selectRecipient = (profile) => {
    setForm(f => ({ ...f, recipient_user_id: profile.id, recipient_name: profile.display_name || profile.username }));
    setRecipientSearch(profile.display_name || profile.username);
    setRecipientResults([]);
  };

  const handleSave = async (publish = false) => {
    if (!form.category || !form.recipient_name.trim()) {
      Alert.alert('Missing fields', 'Select a category and enter a recipient name.');
      return;
    }
    setSaving(true);
    try {
      const created = await AwardManager.create(event.id, {
        ...form,
        stat_value: form.stat_value ? parseFloat(form.stat_value) : null,
        is_published: publish,
      }, user.id);

      if (publish && form.recipient_user_id) {
        // Notify winner
        await NotificationService.send(form.recipient_user_id, {
          type: 'rating',
          title: `🏆 You won: ${form.award_label}`,
          body: `Awarded at ${event.title}`,
          eventId: event.id,
          actorId: user?.id,
        });
      }

      setAdding(false);
      resetForm();
      load();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (awardId) => {
    try {
      await AwardManager.publish(awardId);
      load();
    } catch (e) { Alert.alert('Error', e.message); }
  };

  const handleDelete = (id) => {
    Alert.alert('Delete', 'Delete this award?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await AwardManager.delete(id); load(); } },
    ]);
  };

  const resetForm = () => {
    setForm({ category: '', award_label: '', award_icon: '🏆', recipient_user_id: null, recipient_name: '', recipient_club_id: null, recipient_club_name: '', stat_value: '', stat_label: '', season: new Date().getFullYear().toString(), notes: '', is_published: false });
    setRecipientSearch('');
    setRecipientResults([]);
  };

  if (loading) return <ActivityIndicator color={primary} style={{ marginTop: 20 }} />;

  return (
    <View>
      <View style={[ss.headerRow]}>
        <Text style={[ss.title, { color: textColor }]}>Awards & Recognition ({awards.length})</Text>
        <TouchableOpacity
          style={[ss.addBtn, { backgroundColor: primary }]}
          onPress={() => { resetForm(); setAdding(true); }}
        >
          <Feather name="plus" size={14} color="#000" />
          <Text style={ss.addBtnText}>Create Award</Text>
        </TouchableOpacity>
      </View>

      {awards.length === 0 && (
        <View style={ss.empty}>
          <Text style={{ fontSize: 36 }}>🏆</Text>
          <Text style={[ss.emptyText, { color: muted }]}>No awards created yet</Text>
        </View>
      )}

      {awards.map(a => (
        <View key={a.id} style={[ss.card, { backgroundColor: `${primary}06`, borderColor: a.is_published ? primary : `${primary}25` }]}>
          <Text style={ss.awardIconText}>{a.award_icon || '🏆'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[ss.awardLabel, { color: textColor }]}>{a.award_label}</Text>
            <Text style={[ss.recipientName, { color: primary }]}>{a.recipient_name}</Text>
            {a.stat_value != null && (
              <Text style={[ss.stat, { color: muted }]}>{a.stat_value} {a.stat_label}</Text>
            )}
            {a.is_published && (
              <View style={ss.publishedBadge}>
                <Feather name="check-circle" size={10} color="#10b981" />
                <Text style={ss.publishedText}>Published</Text>
              </View>
            )}
          </View>
          <View style={{ gap: 6 }}>
            {!a.is_published && (
              <TouchableOpacity onPress={() => handlePublish(a.id)} style={[ss.publishBtn, { backgroundColor: "#10b981" }]}>
                <Text style={ss.publishBtnText}>Publish</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => handleDelete(a.id)} style={{ padding: 4 }}>
              <Feather name="trash-2" size={14} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {/* Create Award Modal */}
      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setAdding(false)} />
          <View style={[ss.sheet, { backgroundColor: surface }]}>
            <View style={ss.sheetHeader}>
              <Text style={[ss.sheetTitle, { color: textColor }]}>Create Award</Text>
              <TouchableOpacity onPress={() => setAdding(false)}>
                <Feather name="x" size={20} color={muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
              {/* Category picker */}
              <Text style={[ss.fieldLabel, { color: muted }]}>AWARD CATEGORY *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {categories.map(cat => {
                    const active = form.category === cat.key;
                    return (
                      <TouchableOpacity
                        key={cat.key}
                        style={[ss.catChip, { backgroundColor: active ? primary : `${primary}15`, borderColor: active ? primary : `${primary}30` }]}
                        onPress={() => selectCategory(cat)}
                      >
                        <Text style={{ fontSize: 16 }}>{cat.icon}</Text>
                        <Text style={[ss.catChipText, { color: active ? '#000' : textColor }]}>{cat.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Custom award label */}
              <Text style={[ss.fieldLabel, { color: muted }]}>AWARD NAME *</Text>
              <TextInput
                style={[ss.input, { color: textColor, borderColor: `${primary}30`, backgroundColor: `${primary}08` }]}
                value={form.award_label}
                onChangeText={v => setForm(f => ({ ...f, award_label: v }))}
                placeholder="e.g. Golden Boot, Best Speaker…"
                placeholderTextColor={muted}
              />

              {/* Icon */}
              <Text style={[ss.fieldLabel, { color: muted, marginTop: 12 }]}>ICON</Text>
              <TextInput
                style={[ss.input, { color: textColor, borderColor: `${primary}30`, backgroundColor: `${primary}08`, fontSize: 22 }]}
                value={form.award_icon}
                onChangeText={v => setForm(f => ({ ...f, award_icon: v }))}
                placeholder="🏆"
                placeholderTextColor={muted}
              />

              {/* Recipient search */}
              <Text style={[ss.fieldLabel, { color: muted, marginTop: 12 }]}>RECIPIENT *</Text>
              <View style={[ss.searchRow, { borderColor: `${primary}30`, backgroundColor: `${primary}08` }]}>
                <Feather name="search" size={14} color={muted} />
                <TextInput
                  style={[{ flex: 1, color: textColor, fontSize: 14 }]}
                  value={recipientSearch}
                  onChangeText={q => { setRecipientSearch(q); setForm(f => ({ ...f, recipient_name: q, recipient_user_id: null })); searchRecipients(q); }}
                  placeholder="Search by username or enter name…"
                  placeholderTextColor={muted}
                />
                {searching && <ActivityIndicator size="small" color={primary} />}
              </View>
              {recipientResults.map(p => (
                <TouchableOpacity key={p.id} style={[ss.resultRow, { borderColor: `${primary}15` }]} onPress={() => selectRecipient(p)}>
                  <Feather name="user" size={14} color={primary} />
                  <Text style={[ss.resultName, { color: textColor }]}>{p.display_name || p.username}</Text>
                  <Text style={[ss.resultUser, { color: muted }]}>@{p.username}</Text>
                  {form.recipient_user_id === p.id && <Feather name="check" size={14} color={primary} style={{ marginLeft: 'auto' }} />}
                </TouchableOpacity>
              ))}

              {/* Stats */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[ss.fieldLabel, { color: muted }]}>STAT VALUE</Text>
                  <TextInput
                    style={[ss.input, { color: textColor, borderColor: `${primary}30`, backgroundColor: `${primary}08` }]}
                    value={form.stat_value}
                    onChangeText={v => setForm(f => ({ ...f, stat_value: v }))}
                    placeholder="e.g. 12"
                    placeholderTextColor={muted}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[ss.fieldLabel, { color: muted }]}>STAT LABEL</Text>
                  <TextInput
                    style={[ss.input, { color: textColor, borderColor: `${primary}30`, backgroundColor: `${primary}08` }]}
                    value={form.stat_label}
                    onChangeText={v => setForm(f => ({ ...f, stat_label: v }))}
                    placeholder="goals, points…"
                    placeholderTextColor={muted}
                  />
                </View>
              </View>

              {/* Season */}
              <Text style={[ss.fieldLabel, { color: muted, marginTop: 12 }]}>SEASON</Text>
              <TextInput
                style={[ss.input, { color: textColor, borderColor: `${primary}30`, backgroundColor: `${primary}08` }]}
                value={form.season}
                onChangeText={v => setForm(f => ({ ...f, season: v }))}
                placeholder="2024 or 2024/25"
                placeholderTextColor={muted}
              />

              {/* Notes */}
              <Text style={[ss.fieldLabel, { color: muted, marginTop: 12 }]}>NOTES</Text>
              <TextInput
                style={[ss.input, { color: textColor, borderColor: `${primary}30`, backgroundColor: `${primary}08`, minHeight: 60 }]}
                value={form.notes}
                onChangeText={v => setForm(f => ({ ...f, notes: v }))}
                placeholder="Additional context…"
                placeholderTextColor={muted}
                multiline
              />

              {/* Action buttons */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  style={[ss.btn, { borderColor: `${primary}40`, borderWidth: 1, flex: 1 }]}
                  onPress={() => handleSave(false)}
                  disabled={saving}
                >
                  <Text style={[ss.btnText, { color: primary }]}>Save Draft</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[ss.btn, { backgroundColor: primary, flex: 1 }]}
                  onPress={() => handleSave(true)}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator size="small" color="#000" />
                    : <Text style={[ss.btnText, { color: '#000' }]}>Publish Award</Text>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const ss = StyleSheet.create({
  headerRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title:          { fontSize: 15, fontWeight: '900' },
  addBtn:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14 },
  addBtnText:     { fontSize: 12, fontWeight: '900', color: '#000' },
  card:           { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 8 },
  awardIconText:  { fontSize: 28 },
  awardLabel:     { fontSize: 14, fontWeight: '900' },
  recipientName:  { fontSize: 13, fontWeight: '700', marginTop: 2 },
  stat:           { fontSize: 11, marginTop: 2 },
  publishedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  publishedText:  { fontSize: 10, fontWeight: '700', color: "#10b981" },
  publishBtn:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  publishBtnText: { fontSize: 11, fontWeight: '900', color: '#fff' },
  empty:          { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyText:      { fontSize: 13 },
  sheet:          { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  sheetHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle:     { fontSize: 17, fontWeight: '900' },
  fieldLabel:     { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 6 },
  input:          { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  catChip:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  catChipText:    { fontSize: 12, fontWeight: '700' },
  searchRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  resultRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1 },
  resultName:     { fontSize: 14, fontWeight: '700' },
  resultUser:     { fontSize: 12 },
  btn:            { borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  btnText:        { fontSize: 14, fontWeight: '900' },
});
