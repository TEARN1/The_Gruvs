import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GlassView } from './GlassView';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabase';
import { useToast } from './ToastNotification';

export const EditEventModal = ({ visible, onClose, event, onSaved }) => {
  const { currentTheme } = useTheme();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [title, setTitle]           = useState('');
  const [description, setDescription] = useState('');
  const [venueName, setVenueName]   = useState('');
  const [eventDate, setEventDate]   = useState('');
  const [eventTime, setEventTime]   = useState('');
  const [price, setPrice]           = useState('');
  const [capacity, setCapacity]     = useState('');
  const [ticketUrl, setTicketUrl]   = useState('');

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setDescription(event.description || '');
      setVenueName(event.venue_name || '');
      setEventDate(event.event_date || '');
      setEventTime(event.event_time || '');
      setPrice(event.price ? String(event.price) : '');
      setCapacity(event.capacity ? String(event.capacity) : '');
      setTicketUrl(event.ticket_url || '');
    }
  }, [event]);

  const handleSave = async () => {
    if (!title.trim()) { toast.show('Event title is required', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.from('events').update({
      title: title.trim(),
      description: description.trim(),
      venue_name: venueName.trim() || null,
      event_date: eventDate || null,
      event_time: eventTime || null,
      price: price.trim() || null,
      capacity: capacity ? parseInt(capacity) : null,
      ticket_url: ticketUrl.trim() || null,
    }).eq('id', event.id);
    setSaving(false);
    if (error) {
      toast.show('Failed to save changes', 'error');
    } else {
      toast.show('Event updated!', 'success');
      onSaved?.();
      onClose();
    }
  };

  const handleDelete = () => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${event?.title}"? This cannot be undone.`)) confirmDelete();
    } else {
      Alert.alert(
        'Delete Event',
        `Are you sure you want to delete "${event?.title}"? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: confirmDelete },
        ]
      );
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from('events').delete().eq('id', event.id);
    setDeleting(false);
    if (error) {
      toast.show('Could not delete event', 'error');
    } else {
      toast.show('Event deleted', 'info');
      onSaved?.();
      onClose();
    }
  };

  const Field = ({ label, value, onChange, placeholder, multiline, keyboardType }) => (
    <View style={f.fieldWrap}>
      <Text style={[f.fieldLabel, { color: muted }]}>{label}</Text>
      <TextInput
        style={[f.input, { color: textColor, borderColor: `${primary}25` }, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder || label}
        placeholderTextColor={muted}
        multiline={multiline}
        keyboardType={keyboardType || 'default'}
      />
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={f.overlay}>
        <GlassView style={[f.sheet, { backgroundColor: `${bg}F5` }]}>
          <View style={[f.pill, { backgroundColor: `${primary}40` }]} />

          <View style={f.header}>
            <Text style={[f.title, { color: primary }]}>Edit Event</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={22} color={textColor} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            <Field label="Title" value={title} onChange={setTitle} placeholder="Event name" />
            <Field label="Description" value={description} onChange={setDescription} placeholder="What's the vibe?" multiline />
            <Field label="Venue" value={venueName} onChange={setVenueName} placeholder="Where is it?" />
            <Field label="Date (YYYY-MM-DD)" value={eventDate} onChange={setEventDate} placeholder="2025-12-31" />
            <Field label="Time" value={eventTime} onChange={setEventTime} placeholder="20:00" />
            <View style={f.row}>
              <View style={{ flex: 1 }}>
                <Field label="Price" value={price} onChange={setPrice} placeholder="FREE or amount" keyboardType="default" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Capacity" value={capacity} onChange={setCapacity} placeholder="Max guests" keyboardType="numeric" />
              </View>
            </View>
            <Field label="Ticket URL" value={ticketUrl} onChange={setTicketUrl} placeholder="https://..." />

            <TouchableOpacity
              style={[f.saveBtn, { backgroundColor: primary }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#000" size="small" />
                : <Text style={f.saveBtnText}>Save Changes</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={f.deleteBtn}
              onPress={handleDelete}
              disabled={deleting}
            >
              {deleting
                ? <ActivityIndicator color="#ef4444" size="small" />
                : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Feather name="trash-2" size={16} color="#ef4444" />
                    <Text style={f.deleteBtnText}>Delete Event</Text>
                  </View>
                )
              }
            </TouchableOpacity>
          </ScrollView>
        </GlassView>
      </View>
    </Modal>
  );
};

const f = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '92%', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 },
  pill: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, backgroundColor: 'rgba(255,255,255,0.04)' },
  row: { flexDirection: 'row', gap: 12 },
  saveBtn: { paddingVertical: 16, borderRadius: 30, alignItems: 'center', marginTop: 6, marginBottom: 12 },
  saveBtnText: { color: '#000', fontWeight: '900', fontSize: 15 },
  deleteBtn: { paddingVertical: 14, borderRadius: 30, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  deleteBtnText: { color: '#ef4444', fontWeight: '800', fontSize: 14 },
});
