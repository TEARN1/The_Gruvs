import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GlassView } from './GlassView';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabase';
import { useToast } from './ToastNotification';
import { CalendarPicker, TimePicker } from './DateTimePickers';

export const EditEventModal = ({ visible, onClose, event, onSaved }) => {
  const { currentTheme } = useTheme();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [title, setTitle]           = useState('');
  const [description, setDescription] = useState('');
  const [venueName, setVenueName]   = useState('');
  const [pickedDate, setPickedDate] = useState(null);
  const [pickedHour, setPickedHour] = useState(20);
  const [pickedMinute, setPickedMinute] = useState(0);
  const [timeSet, setTimeSet]       = useState(false);
  const [price, setPrice]           = useState('');
  const [capacity, setCapacity]     = useState('');
  const [ticketUrl, setTicketUrl]   = useState('');
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setDescription(event.description || '');
      setVenueName(event.venue_name || '');
      setPrice(event.price ? String(event.price) : '');
      setCapacity(event.capacity ? String(event.capacity) : '');
      setTicketUrl(event.ticket_url || '');

      // Parse stored date/time back into picker state
      if (event.event_date) {
        const d = new Date(event.event_date + 'T00:00:00');
        if (!isNaN(d)) setPickedDate(d);
      } else {
        setPickedDate(null);
      }
      if (event.event_time) {
        const parts = event.event_time.split(':');
        if (parts.length >= 2) {
          setPickedHour(parseInt(parts[0], 10) || 0);
          setPickedMinute(parseInt(parts[1], 10) || 0);
          setTimeSet(true);
        }
      } else {
        setPickedHour(20); setPickedMinute(0); setTimeSet(false);
      }
    }
  }, [event]);

  const fmtDate = (d) => d
    ? d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  const fmtTime = () =>
    `${String(pickedHour).padStart(2, '0')}:${String(pickedMinute).padStart(2, '0')}`;

  const handleSave = async () => {
    if (!title.trim()) { toast.show('Event title is required', 'error'); return; }
    setSaving(true);

    let eventDate = null;
    if (pickedDate) {
      const y = pickedDate.getFullYear();
      const mo = String(pickedDate.getMonth() + 1).padStart(2, '0');
      const d = String(pickedDate.getDate()).padStart(2, '0');
      eventDate = `${y}-${mo}-${d}`;
    }

    const { error } = await supabase.from('events').update({
      title: title.trim(),
      description: description.trim(),
      venue_name: venueName.trim() || null,
      event_date: eventDate,
      event_time: timeSet ? fmtTime() : null,
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

  // ── Cancel event: set is_cancelled = true, notify all interactors ───────────
  const handleCancel = () => {
    const msg = `Cancel "${event?.title}"? All Vibers who liked or RSVP'd will be notified.`;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(msg)) confirmCancel();
    } else {
      Alert.alert('Cancel Event', msg, [
        { text: 'Keep Event', style: 'cancel' },
        { text: 'Cancel Event', style: 'destructive', onPress: confirmCancel },
      ]);
    }
  };

  const confirmCancel = async () => {
    setCancelling(true);
    const { error } = await supabase.from('events').update({ is_cancelled: true }).eq('id', event.id);
    if (error) {
      toast.show('Could not cancel event', 'error');
      setCancelling(false);
      return;
    }

    // Notify everyone who vibed or RSVP'd
    try {
      const [{ data: vibers }, { data: rsvpers }] = await Promise.all([
        supabase.from('event_vibes').select('user_id').eq('event_id', event.id),
        supabase.from('event_rsvps').select('user_id').eq('event_id', event.id),
      ]);
      const allIds = [...new Set([
        ...(vibers || []).map(r => r.user_id),
        ...(rsvpers || []).map(r => r.user_id),
      ])];
      // Batch-insert cancellation notifications
      if (allIds.length > 0) {
        const notifications = allIds.map(uid => ({
          recipient_id: uid,
          type: 'event_cancelled',
          title: '🚫 Event Cancelled',
          body: `"${event.title}" has been cancelled by the organizer.`,
          data: { event_id: event.id, event_title: event.title },
        }));
        await supabase.from('notifications').insert(notifications);
      }
    } catch { /* non-critical */ }

    setCancelling(false);
    toast.show('Event cancelled — attendees notified', 'info');
    onSaved?.();
    onClose();
  };

  // ── Delete event ─────────────────────────────────────────────────────────────
  const handleDelete = () => {
    const msg = `Delete "${event?.title}"? This cannot be undone.`;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(msg)) confirmDelete();
    } else {
      Alert.alert('Delete Event', msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirmDelete },
      ]);
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
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={f.overlay}>
            <GlassView style={[f.sheet, { backgroundColor: `${bg}F5` }]}>
              <View style={[f.pill, { backgroundColor: `${primary}40` }]} />

              <View style={f.header}>
                <Text style={[f.title, { color: primary }]}>Edit Event</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Feather name="x" size={22} color={textColor} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
                <Field label="Title" value={title} onChange={setTitle} placeholder="Event name" />
                <Field label="Description" value={description} onChange={setDescription} placeholder="What's the vibe?" multiline />
                <Field label="Venue" value={venueName} onChange={setVenueName} placeholder="Where is it?" />

                {/* ── Date picker ── */}
                <View style={f.fieldWrap}>
                  <Text style={[f.fieldLabel, { color: muted }]}>Date</Text>
                  <TouchableOpacity
                    style={[f.pickerBtn, { borderColor: pickedDate ? primary : `${primary}25`, backgroundColor: pickedDate ? `${primary}10` : 'rgba(255,255,255,0.04)' }]}
                    onPress={() => setCalendarVisible(true)}
                  >
                    <Feather name="calendar" size={15} color={pickedDate ? primary : muted} />
                    <Text style={[f.pickerText, { color: pickedDate ? primary : muted }]}>
                      {fmtDate(pickedDate) || 'Pick a date'}
                    </Text>
                    {pickedDate && (
                      <TouchableOpacity onPress={() => setPickedDate(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Feather name="x" size={14} color={muted} />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                </View>

                {/* ── Time picker ── */}
                <View style={f.fieldWrap}>
                  <Text style={[f.fieldLabel, { color: muted }]}>Time</Text>
                  <TouchableOpacity
                    style={[f.pickerBtn, { borderColor: timeSet ? primary : `${primary}25`, backgroundColor: timeSet ? `${primary}10` : 'rgba(255,255,255,0.04)' }]}
                    onPress={() => setTimePickerVisible(true)}
                  >
                    <Feather name="clock" size={15} color={timeSet ? primary : muted} />
                    <Text style={[f.pickerText, { color: timeSet ? primary : muted }]}>
                      {timeSet ? fmtTime() : 'Pick a time'}
                    </Text>
                    {timeSet && (
                      <TouchableOpacity onPress={() => setTimeSet(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Feather name="x" size={14} color={muted} />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={f.row}>
                  <View style={{ flex: 1 }}>
                    <Field label="Price" value={price} onChange={setPrice} placeholder="FREE or amount" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Capacity" value={capacity} onChange={setCapacity} placeholder="Max guests" keyboardType="numeric" />
                  </View>
                </View>
                <Field label="Ticket URL" value={ticketUrl} onChange={setTicketUrl} placeholder="https://..." />

                {/* Save */}
                <TouchableOpacity style={[f.saveBtn, { backgroundColor: primary }]} onPress={handleSave} disabled={saving}>
                  {saving
                    ? <ActivityIndicator color="#000" size="small" />
                    : <Text style={f.saveBtnText}>Save Changes</Text>
                  }
                </TouchableOpacity>

                {/* Cancel Event */}
                <TouchableOpacity style={[f.actionBtn, { borderColor: 'rgba(251,146,60,0.4)' }]} onPress={handleCancel} disabled={cancelling}>
                  {cancelling
                    ? <ActivityIndicator color="#f97316" size="small" />
                    : (
                      <View style={f.btnInner}>
                        <Feather name="slash" size={15} color="#f97316" />
                        <Text style={[f.actionBtnText, { color: '#f97316' }]}>Cancel Event</Text>
                      </View>
                    )
                  }
                </TouchableOpacity>

                {/* Delete */}
                <TouchableOpacity style={[f.actionBtn, { borderColor: 'rgba(239,68,68,0.3)' }]} onPress={handleDelete} disabled={deleting}>
                  {deleting
                    ? <ActivityIndicator color="#ef4444" size="small" />
                    : (
                      <View style={f.btnInner}>
                        <Feather name="trash-2" size={15} color="#ef4444" />
                        <Text style={[f.actionBtnText, { color: '#ef4444' }]}>Delete Event</Text>
                      </View>
                    )
                  }
                </TouchableOpacity>
              </ScrollView>
            </GlassView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <CalendarPicker
        visible={calendarVisible}
        onClose={() => setCalendarVisible(false)}
        onConfirm={(date) => { setPickedDate(date); setCalendarVisible(false); }}
        value={pickedDate}
        primary={primary} bg={bg} textColor={textColor} muted={muted}
      />

      <TimePicker
        visible={timePickerVisible}
        onClose={() => setTimePickerVisible(false)}
        onConfirm={(h, m) => { setPickedHour(h); setPickedMinute(m); setTimeSet(true); setTimePickerVisible(false); }}
        initialHour={pickedHour}
        initialMinute={pickedMinute}
        primary={primary} bg={bg} textColor={textColor} muted={muted}
      />
    </>
  );
};

const f = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'flex-end' },
  sheet:       { maxHeight: '92%', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 },
  pill:        { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 16 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title:       { fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  fieldWrap:   { marginBottom: 14 },
  fieldLabel:  { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  input:       { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, backgroundColor: 'rgba(255,255,255,0.04)' },
  pickerBtn:   { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  pickerText:  { flex: 1, fontSize: 14, fontWeight: '600' },
  row:         { flexDirection: 'row', gap: 12 },
  saveBtn:     { paddingVertical: 16, borderRadius: 30, alignItems: 'center', marginTop: 6, marginBottom: 10 },
  saveBtnText: { color: '#000', fontWeight: '900', fontSize: 15 },
  actionBtn:   { paddingVertical: 14, borderRadius: 30, alignItems: 'center', borderWidth: 1, marginBottom: 10 },
  btnInner:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtnText: { fontWeight: '800', fontSize: 14 },
});
