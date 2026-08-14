import { FeedManager } from '../services/dataFlow';
import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Platform, KeyboardAvoidingView, Image,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import { GlassView } from './GlassView';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { resilient } from '../utils/resilience';
import { useToast } from './ToastNotification';
import { uploadToStorage } from '../services/storageService';
import { CalendarPicker, TimePicker } from './DateTimePickers';
import { useBackClose } from '../hooks/useBackClose';
import { money } from '../constants/currencies';

const Field = ({ label, value, onChange, placeholder, multiline, keyboardType, textColor, muted, primary }) => (
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

export const EditEventModal = ({ visible, onClose, event, onSaved, onDeleted, onUpdated }) => {
  useBackClose(visible, onClose);
  const { currentTheme } = useTheme();
  const { user } = useAuth();
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
  const [entryPrice, setEntryPrice] = useState('');
  const [vipPrice, setVipPrice]     = useState('');
  const [vvipPrice, setVvipPrice]   = useState('');
  const [otherTickets, setOtherTickets] = useState('');
  const [capacity, setCapacity]     = useState('');
  const [ticketUrl, setTicketUrl]   = useState('');
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [tiers, setTiers] = useState([]);
  const [tierForm, setTierForm] = useState(null); // null = hidden, {} = new, {id} = editing
  const [coverUri, setCoverUri] = useState(null);
  const [coverUrl, setCoverUrl] = useState(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const primary   = currentTheme?.primary    || "#00f2ff";
  const bg        = currentTheme?.background || "#0d1112";
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setDescription(event.description || '');
      setVenueName(event.venue_name || '');
      setCapacity(event.capacity ? String(event.capacity) : '');
      setTicketUrl(event.ticket_url || '');
      setContactPhone(event.contact_phone || '');
      setContactEmail(event.contact_email || '');
      setTiers(Array.isArray(event.rsvp_tiers) ? event.rsvp_tiers : []);
      // TODO(v6): remove image_url/cover_image fallbacks after migration
      const existing = event.cover_url || event.image_url || event.cover_image || (Array.isArray(event.media) && event.media[0]?.url) || null;
      setCoverUrl(existing);
      setCoverUri(null);

      // Parse JSON prices if applicable
      let genP = '';
      let vipP = '';
      let vvipP = '';
      let otherP = '';
      if (event.price) {
        if (event.price.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(event.price);
            genP = parsed.general ? String(parsed.general) : '';
            vipP = parsed.vip ? String(parsed.vip) : '';
            vvipP = parsed.vvip ? String(parsed.vvip) : '';
            otherP = parsed.other ? String(parsed.other) : '';
          } catch (e) {
            genP = String(event.price);
          }
        } else {
          genP = event.price === 'FREE' ? '' : String(event.price);
        }
      }
      setEntryPrice(genP);
      setVipPrice(vipP);
      setVvipPrice(vvipP);
      setOtherTickets(otherP);

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

  const pickCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { toast.show('Photo library permission required', 'error'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.length) return;
    setCoverUri(result.assets[0].uri);
  };

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

    try {
      let finalCoverUrl = coverUrl;
      if (coverUri) {
        setUploadingCover(true);
        try {
          const ext = coverUri.split('.').pop()?.toLowerCase() || 'jpg';
          const ownerId = user?.id || event?.author_id || 'unknown';
          const path = `${ownerId}/events/${event.id}/cover_${Date.now()}.${ext}`;
          finalCoverUrl = await uploadToStorage(coverUri, 'event-media', path, { mimeType: `image/${ext === 'jpg' ? 'jpeg' : ext}` });
          setCoverUrl(finalCoverUrl);
          setCoverUri(null);
        } catch (e) {
          toast.show('Cover upload failed: ' + e.message, 'error');
        } finally {
          setUploadingCover(false);
        }
      }

      // Ticket Tiers & Prices
      let computedPrice = 'FREE';
      let minP = null;
      let maxP = null;

      const parsedEntry = entryPrice.trim() ? parseFloat(entryPrice) : null;
      const parsedVip = vipPrice.trim() ? parseFloat(vipPrice) : null;
      const parsedVvip = vvipPrice.trim() ? parseFloat(vvipPrice) : null;

      const pricesList = [parsedEntry, parsedVip, parsedVvip].filter(p => p !== null && !isNaN(p));
      if (pricesList.length > 0) {
        minP = Math.min(...pricesList);
        maxP = Math.max(...pricesList);
      }

      if (entryPrice.trim() || vipPrice.trim() || vvipPrice.trim() || otherTickets.trim()) {
        const tiersObj = {};
        if (entryPrice.trim()) tiersObj.general = entryPrice.trim();
        if (vipPrice.trim()) tiersObj.vip = vipPrice.trim();
        if (vvipPrice.trim()) tiersObj.vvip = vvipPrice.trim();
        if (otherTickets.trim()) tiersObj.other = otherTickets.trim();
        computedPrice = JSON.stringify(tiersObj);
      }

      const payload = {
        title: title.trim(),
        description: description.trim(),
        venue_name: venueName.trim() || null,
        event_date: eventDate,
        event_time: timeSet ? fmtTime() : null,
        price: computedPrice,
        price_min: minP,
        price_max: maxP,
        capacity: capacity ? parseInt(capacity) : null,
        ticket_url: ticketUrl.trim() || null,
        contact_phone: contactPhone.trim() || null,
        contact_email: contactEmail.trim() || null,
        rsvp_tiers: tiers.length > 0 ? tiers : null,
        ...(finalCoverUrl ? { cover_url: finalCoverUrl, media: [{ url: finalCoverUrl, type: 'image' }], media_urls: [finalCoverUrl] } : {}),
      };
      const ok = await resilient(
        [
          () => supabase.from('events').update(payload).eq('id', event.id),
          () => supabase.from('events').update({ title: payload.title, description: payload.description, event_date: payload.event_date }).eq('id', event.id),
          () => supabase.rpc('update_event', { p_event_id: event.id, p_payload: payload }),
        ],
        { attemptsPerTier: 3, baseMs: 400, label: `EditEventModal.save:${event.id}`, fallbackValue: null }
      );
      if (ok !== null) {
        FeedManager.invalidate(event.id);
        toast.show('Event updated!', 'success');
        onUpdated?.({ ...event, ...payload });
        onSaved?.();
        onClose();
      } else {
        toast.show('Failed to save changes', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Cancel event: set status = 'cancelled', notify all interactors ───────────
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
    if (!user?.id) return;
    setCancelling(true);
    try {
      const ok = await resilient(
        [
          () => supabase.from('events').update({ status: 'cancelled' }).eq('id', event.id).eq('author_id', user?.id),
          () => supabase.from('events').update({ status: 'cancelled' }).eq('id', event.id).eq('author_id', user?.id),
          () => supabase.rpc('cancel_event', { p_event_id: event.id, p_caller_id: user?.id }),
        ],
        { attemptsPerTier: 3, baseMs: 400, label: `EditEventModal.cancel:${event.id}`, fallbackValue: null }
      );
      if (ok === null) {
        toast.show('Could not cancel event', 'error');
        return;
      }
      FeedManager.invalidate(event.id);

      // Notify everyone who vibed or RSVP'd — best effort
      try {
        const [vibersRes, rsvpersRes] = await Promise.allSettled([
          supabase.from('event_vibes').select('user_id').eq('event_id', event.id),
          supabase.from('event_rsvps').select('user_id').eq('event_id', event.id),
        ]);
        const vibers = vibersRes.status === 'fulfilled' ? vibersRes.value.data : [];
        const rsvpers = rsvpersRes.status === 'fulfilled' ? rsvpersRes.value.data : [];
        const allIds = [...new Set([
          ...(vibers || []).map(r => r.user_id),
          ...(rsvpers || []).map(r => r.user_id),
        ])];
        if (allIds.length > 0) {
          const notifications = allIds.map(uid => ({
            recipient_id: uid,
            type: 'event_cancelled',
            title: '🚫 Event Cancelled',
            body: `"${event.title}" has been cancelled by the organizer.`,
            data: { event_id: event.id, event_title: event.title },
          }));
          await resilient(
            [
              () => supabase.from('notifications').insert(notifications),
              () => supabase.from('notifications').insert(notifications.slice(0, 50)),
              () => supabase.rpc('bulk_notify_cancel', { p_event_id: event.id }),
            ],
            { attemptsPerTier: 2, baseMs: 500, label: `EditEventModal.cancelNotify:${event.id}`, fallbackValue: null }
          );
        }
      } catch { /* non-critical */ }

      toast.show('Event cancelled — attendees notified', 'info');
      onSaved?.();
      onClose();
    } finally {
      setCancelling(false);
    }
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
    if (!user?.id) return;
    setDeleting(true);
    try {
      const ok = await resilient(
        [
          // IDOR guard: always pin author_id so RLS + extra check prevents deleting others' events
          () => supabase.from('events').delete().eq('id', event.id).eq('author_id', user?.id),
          () => supabase.from('events').update({ status: 'deleted', deleted_at: new Date().toISOString() }).eq('id', event.id).eq('author_id', user?.id),
          () => supabase.rpc('delete_event', { p_event_id: event.id }),
        ],
        { attemptsPerTier: 3, baseMs: 400, label: `EditEventModal.delete:${event.id}`, fallbackValue: null }
      );
      if (ok !== null) {
        FeedManager.invalidate(event.id);
        toast.show('Event deleted', 'info');
        onDeleted?.(event.id);
        onSaved?.();
        onClose();
      } else {
        toast.show('Could not delete event', 'error');
      }
    } finally {
      setDeleting(false);
    }
  };


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
                {/* Cover Photo */}
                <Text style={[em.sectionLabel, { color: muted }]}>COVER PHOTO</Text>
                <TouchableOpacity onPress={pickCover} activeOpacity={0.8}
                  style={[em.coverWrap, { borderColor: `${primary}30`, backgroundColor: `${primary}08` }]}
                >
                  {uploadingCover ? (
                    <ActivityIndicator color={primary} />
                  ) : coverUri || coverUrl ? (
                    <Image source={{ uri: coverUri || coverUrl }} style={em.coverImg} resizeMode="cover" />
                  ) : (
                    <View style={{ alignItems: 'center', gap: 8 }}>
                      <Feather name="image" size={28} color={primary} />
                      <Text style={{ color: muted, fontSize: 12 }}>Tap to add cover photo</Text>
                    </View>
                  )}
                  <View style={[em.coverEditBadge, { backgroundColor: primary }]}>
                    <Feather name="camera" size={11} color="#000" />
                  </View>
                </TouchableOpacity>

                <Field label="Title" value={title} onChange={setTitle} placeholder="Event name" textColor={textColor} muted={muted} primary={primary} />
                <Field label="Description" value={description} onChange={setDescription} placeholder="What's the vibe?" multiline textColor={textColor} muted={muted} primary={primary} />
                <Field label="Venue" value={venueName} onChange={setVenueName} placeholder="Where is it?" textColor={textColor} muted={muted} primary={primary} />

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

                <Text style={[f.fieldLabel, { color: muted, marginTop: 12 }]}>Ticket Prices & Entry (Optional)</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[{ color: muted, fontSize: 10, fontWeight: '800', marginBottom: 5 }]}>ENTRY / GEN (R)</Text>
                    <TextInput
                      style={[f.input, { color: textColor, borderColor: `${primary}25`, fontSize: 13, height: 40, paddingVertical: 8 }]}
                      placeholder="e.g. 150"
                      placeholderTextColor={muted}
                      value={entryPrice}
                      onChangeText={setEntryPrice}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[{ color: muted, fontSize: 10, fontWeight: '800', marginBottom: 5 }]}>VIP (R)</Text>
                    <TextInput
                      style={[f.input, { color: textColor, borderColor: `${primary}25`, fontSize: 13, height: 40, paddingVertical: 8 }]}
                      placeholder="e.g. 350"
                      placeholderTextColor={muted}
                      value={vipPrice}
                      onChangeText={setVipPrice}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[{ color: muted, fontSize: 10, fontWeight: '800', marginBottom: 5 }]}>VVIP (R)</Text>
                    <TextInput
                      style={[f.input, { color: textColor, borderColor: `${primary}25`, fontSize: 13, height: 40, paddingVertical: 8 }]}
                      placeholder="e.g. 600"
                      placeholderTextColor={muted}
                      value={vvipPrice}
                      onChangeText={setVvipPrice}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={f.fieldWrap}>
                  <Text style={[{ color: muted, fontSize: 10, fontWeight: '800', marginBottom: 5 }]}>OTHER PACKAGES (Optional)</Text>
                  <TextInput
                    style={[f.input, { color: textColor, borderColor: `${primary}25`, fontSize: 13, height: 40, paddingVertical: 8 }]}
                    placeholder="e.g. Table bookings / packages / early birds..."
                    placeholderTextColor={muted}
                    value={otherTickets}
                    onChangeText={setOtherTickets}
                  />
                </View>

                <View style={f.row}>
                  <View style={{ flex: 1 }}>
                    <Field label="Capacity" value={capacity} onChange={setCapacity} placeholder="Max guests" keyboardType="numeric" textColor={textColor} muted={muted} primary={primary} />
                  </View>
                  <View style={{ flex: 1.5 }}>
                    <Field label="Ticket URL" value={ticketUrl} onChange={setTicketUrl} placeholder="https://..." textColor={textColor} muted={muted} primary={primary} />
                  </View>
                </View>

                <View style={f.row}>
                  <View style={{ flex: 1 }}>
                    <Field label="Contact Number" value={contactPhone} onChange={setContactPhone} placeholder="+27 82 000 0000" keyboardType="phone-pad" textColor={textColor} muted={muted} primary={primary} />
                  </View>
                  <View style={{ flex: 1.5 }}>
                    <Field label="Contact Email" value={contactEmail} onChange={setContactEmail} placeholder="organizer@email.com" textColor={textColor} muted={muted} primary={primary} />
                  </View>
                </View>

                {/* VIP Tier Builder */}
                <View style={f.tierSection}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={[f.fieldLabel, { color: muted }]}>VIP TIERS</Text>
                    <TouchableOpacity
                      onPress={() => setTierForm({ id: `tier_${Date.now()}`, name: '', description: '', price: '', capacity: '' })}
                      style={[f.addTierBtn, { borderColor: `${primary}40` }]}
                    >
                      <Feather name="plus" size={12} color={primary} />
                      <Text style={[{ fontSize: 11, color: primary, fontWeight: '800' }]}>Add Tier</Text>
                    </TouchableOpacity>
                  </View>

                  {tiers.map(tier => (
                    <View key={tier.id} style={[f.tierRow, { borderColor: `${primary}25` }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[{ fontSize: 13, fontWeight: '800', color: textColor }]}>{tier.name || 'Unnamed'}</Text>
                        <Text style={[{ fontSize: 11, color: muted }]}>
                          {tier.price > 0 ? money(tier.price) : 'Free'}{tier.capacity > 0 ? ` · ${tier.capacity} spots` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => setTierForm({ ...tier, price: String(tier.price || ''), capacity: String(tier.capacity || '') })} style={{ padding: 4 }}>
                        <Feather name="edit-2" size={13} color={muted} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setTiers(prev => prev.filter(t => t.id !== tier.id))} style={{ padding: 4 }}>
                        <Feather name="trash-2" size={13} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ))}

                  {tierForm && (
                    <View style={[f.tierForm, { borderColor: `${primary}30` }]}>
                      <TextInput
                        value={tierForm.name}
                        onChangeText={v => setTierForm(p => ({ ...p, name: v }))}
                        placeholder="Tier name (e.g. VIP, Table)"
                        placeholderTextColor={muted}
                        style={[f.input, { color: textColor, borderColor: `${primary}25`, marginBottom: 6 }]}
                      />
                      <TextInput
                        value={tierForm.description}
                        onChangeText={v => setTierForm(p => ({ ...p, description: v }))}
                        placeholder="Description (optional)"
                        placeholderTextColor={muted}
                        style={[f.input, { color: textColor, borderColor: `${primary}25`, marginBottom: 6 }]}
                      />
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                        <TextInput
                          value={tierForm.price}
                          onChangeText={v => setTierForm(p => ({ ...p, price: v }))}
                          placeholder="Price (0 = Free)"
                          placeholderTextColor={muted}
                          keyboardType="numeric"
                          style={[f.input, { color: textColor, borderColor: `${primary}25`, flex: 1 }]}
                        />
                        <TextInput
                          value={tierForm.capacity}
                          onChangeText={v => setTierForm(p => ({ ...p, capacity: v }))}
                          placeholder="Capacity (0 = ∞)"
                          placeholderTextColor={muted}
                          keyboardType="numeric"
                          style={[f.input, { color: textColor, borderColor: `${primary}25`, flex: 1 }]}
                        />
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={() => setTierForm(null)} style={[f.tierCancelBtn, { borderColor: `${primary}30` }]}>
                          <Text style={[{ fontSize: 12, color: muted, fontWeight: '700' }]}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[f.tierSaveBtn, { backgroundColor: `${primary}20`, borderColor: `${primary}50`, flex: 1 }]}
                          onPress={() => {
                            if (!tierForm.name.trim()) return;
                            const newTier = {
                              id: tierForm.id,
                              name: tierForm.name.trim(),
                              description: tierForm.description.trim() || null,
                              price: parseFloat(tierForm.price) || 0,
                              capacity: parseInt(tierForm.capacity) || 0,
                            };
                            setTiers(prev => {
                              const idx = prev.findIndex(t => t.id === newTier.id);
                              if (idx >= 0) { const n = [...prev]; n[idx] = newTier; return n; }
                              return [...prev, newTier];
                            });
                            setTierForm(null);
                          }}
                        >
                          <Text style={[{ fontSize: 12, color: primary, fontWeight: '900' }]}>
                            {tiers.find(t => t.id === tierForm.id) ? 'Update Tier' : 'Add Tier'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

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
                        <Text style={[f.actionBtnText, { color: "#f97316" }]}>Cancel Event</Text>
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
                        <Text style={[f.actionBtnText, { color: "#ef4444" }]}>Delete Event</Text>
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

const em = StyleSheet.create({
  sectionLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 8, marginTop: 4 },
  coverWrap: {
    width: '100%', aspectRatio: 16 / 9, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16, overflow: 'hidden', position: 'relative',
  },
  coverImg: { width: '100%', height: '100%' },
  coverEditBadge: {
    position: 'absolute', bottom: 8, right: 8,
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
});

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
  tierSection: { marginBottom: 14 },
  addTierBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  tierRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 6 },
  tierForm:    { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 6, gap: 0 },
  tierCancelBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  tierSaveBtn:   { borderWidth: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
});
