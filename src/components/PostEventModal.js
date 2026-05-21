import React, { useState, useRef } from 'react';
import {
  Modal, View, Text, StyleSheet, TextInput,
  TouchableOpacity, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform, Image, Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

const SCREEN_W = Dimensions.get('window').width;
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { GlassView } from './GlassView';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { resilient } from '../utils/resilience';
import { uploadToStorage } from '../services/storageService';
import { CategoryPickerModal } from './CategoryPickerModal';
import { ALL_CATEGORIES_MAP } from '../constants/AllCategories';
import { VibeEquityLedger } from '../services/vibeEquityLedger';
import { CalendarPicker, TimePicker } from './DateTimePickers';

const MAX_MEDIA = 30;
const EVENT_TYPES = ['Social', 'Concert', 'Workshop', 'Festival', 'Meetup', 'Party', 'Conference', 'Pop-Up', 'Rave', 'Market', 'Retreat', 'Competition'];
const AGE_MIN_OPTIONS = [0, 13, 16, 18, 21, 25, 30, 35];
const AGE_MAX_OPTIONS = [0, 17, 20, 25, 30, 35, 45, 99]; // 0 = no upper limit

export const PostEventModal = ({ visible, onClose, onPostSuccess }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [pickedDate, setPickedDate] = useState(null);      // Date object
  const [pickedHour, setPickedHour] = useState(20);
  const [pickedMinute, setPickedMinute] = useState(0);
  const [timeSet, setTimeSet] = useState(false);
  const [ticketUrl, setTicketUrl] = useState('');
  const [eventType, setEventType] = useState('');
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);
  const [ageMin, setAgeMin] = useState(0);
  const [ageMax, setAgeMax] = useState(0);
  const [endHour, setEndHour] = useState(null);
  const [endMinute, setEndMinute] = useState(null);
  const [endTimeSet, setEndTimeSet] = useState(false);
  const [endTimePickerVisible, setEndTimePickerVisible] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [mediaItems, setMediaItems] = useState([]); // { uri, type, name, mimeType }
  const [scheduleItems, setScheduleItems] = useState([]); // { id, time, title, performer, notes }
  const [scheduleFormVisible, setScheduleFormVisible] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ time: '', title: '', performer: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [error, setError] = useState('');
  const [catPickerVisible, setCatPickerVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [step, setStep] = useState(1);
  const scrollRef = useRef(null);

  const primary = currentTheme?.primary || '#00f2ff';
  const bg = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  const reset = () => {
    setTitle(''); setDescription(''); setAddress(''); setCity('');
    setPickedDate(null); setPickedHour(20); setPickedMinute(0); setTimeSet(false);
    setTicketUrl(''); setEventType('');
    setLat(null); setLon(null);
    setAgeMin(0); setAgeMax(0); setSelectedCategories([]); setMediaItems([]);
    setEndHour(null); setEndMinute(null); setEndTimeSet(false); setEndTimePickerVisible(false);
    setScheduleItems([]); setScheduleFormVisible(false);
    setScheduleForm({ time: '', title: '', performer: '', notes: '' });
    setStep(1);
    setLoading(false); setUploadingMedia(false); setError('');
    setCalendarVisible(false); setTimePickerVisible(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const pinLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission is required to pin the Spot.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      setLat(loc.coords.latitude);
      setLon(loc.coords.longitude);
    } catch (e) {
      setError('Could not get precise location fix.');
    }
  };

  // ── Media picker ─────────────────────────────────────────────────────────
  const pickMedia = async () => {
    if (mediaItems.length >= MAX_MEDIA) {
      setError(`Maximum ${MAX_MEDIA} media items allowed.`);
      return;
    }
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setError('Photo library access is required to upload media.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      selectionLimit: MAX_MEDIA - mediaItems.length,
      quality: 0.85,
    });
    if (!result.canceled && result.assets) {
      const newItems = result.assets.map(a => ({
        uri: a.uri,
        type: a.type || (a.uri.includes('.mp4') || a.uri.includes('.mov') ? 'video' : 'image'),
        name: a.fileName || `media_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        mimeType: a.mimeType || undefined,
      }));
      setMediaItems(prev => [...prev, ...newItems].slice(0, MAX_MEDIA));
    }
  };

  const removeMedia = (index) => {
    setMediaItems(prev => prev.filter((_, i) => i !== index));
  };

  // ── Upload all media to Supabase Storage ─────────────────────────────────
  const uploadAllMedia = async () => {
    const uploaded = [];
    let failCount = 0;
    for (const item of mediaItems) {
      try {
        const ext = (item.uri.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
        const fileName = `events/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const mimeType = item.mimeType || (item.type === 'video' ? `video/${ext}` : `image/${ext}`);
        const publicUrl = await uploadToStorage(item.uri, 'event-media', fileName, { mimeType });
        uploaded.push({ url: publicUrl, type: item.type });
      } catch {
        failCount++;
      }
    }
    if (failCount > 0) setError(`${failCount} media file${failCount > 1 ? 's' : ''} failed to upload — continuing with ${uploaded.length} uploaded.`);
    return uploaded;
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handlePost = async () => {
    if (!title.trim() || !description.trim() || !address.trim()) {
      setError('Title, description and address are required.');
      return;
    }
    if (!pickedDate) {
      setError('Event date is required.');
      return;
    }
    if (!user?.id) { setError('Sign in required to post a Gruv.'); return; }

    setLoading(true);
    setError('');

    try {
    let mediaUrls = [];
    if (mediaItems.length > 0) {
      setUploadingMedia(true);
      mediaUrls = await uploadAllMedia();
      setUploadingMedia(false);
      // If all uploads failed, continue anyway without media
    }

    const primaryCat = selectedCategories[0] || eventType?.toLowerCase() || null;

    const payload = {
      author_id: user.id,
      title: title.trim(),
      description: description.trim(),
      address: address.trim(),
      lat,
      lon,
      coords: lat && lon ? `POINT(${lon} ${lat})` : null,
      is_published: true,
      is_cancelled: false,
    };
    if (city.trim()) payload.city = city.trim();
    if (pickedDate) {
      const y = pickedDate.getFullYear();
      const mo = String(pickedDate.getMonth() + 1).padStart(2, '0');
      const d = String(pickedDate.getDate()).padStart(2, '0');
      payload.event_date = `${y}-${mo}-${d}`;
    }
    if (timeSet) {
      payload.event_time = `${String(pickedHour).padStart(2, '0')}:${String(pickedMinute).padStart(2, '0')}`;
    }
    if (mediaUrls.length > 0) {
      payload.media = mediaUrls;
      payload.media_urls = mediaUrls.map(m => m.url);
    }
    if (scheduleItems.length > 0) payload.schedule = scheduleItems.map(({ id, ...rest }) => rest);
    if (ageMin > 0) payload.age_restriction = ageMin;
    if (ageMax > 0) payload.age_max = ageMax;
    if (endTimeSet && endHour !== null) {
      payload.end_time = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
    }
    if (primaryCat) payload.category = primaryCat;
    if (ticketUrl.trim()) payload.ticket_url = ticketUrl.trim();

    let insertError = null;
    const result = await resilient(
      [
        async () => {
          const { error } = await supabase.from('events').insert(payload);
          if (error) throw error;
          return true;
        },
        async () => {
          const minPayload = { title: payload.title, description: payload.description, author_id: payload.author_id, event_date: payload.event_date, city: payload.city };
          const { error } = await supabase.from('events').insert(minPayload);
          if (error) throw error;
          return true;
        },
        async () => {
          const { error } = await supabase.rpc('create_event', { p_payload: payload });
          if (error) throw error;
          return true;
        },
      ],
      {
        attemptsPerTier: 3, baseMs: 500, label: 'PostEventModal.insert',
        fallbackValue: null,
        onExhausted: async () => { insertError = new Error('All save attempts failed'); return null; },
      }
    );

    if (result !== null) {
      VibeEquityLedger.mintEquity(user.id, 'EVENT_HOSTING').catch(() => {});
      reset();
      onPostSuccess?.();
      onClose();
    } else {
      const err = insertError || new Error('Could not save event');
      const msg = err.message || '';
      const fieldStepMap = {
        title: 1, description: 1, address: 1, city: 1, event_date: 1,
        category: 2, media: 2,
        ticket_url: 3, age_restriction: 3,
      };
      let targetStep = null;
      Object.entries(fieldStepMap).forEach(([col, s]) => {
        if (msg.includes(`"${col}"`)) targetStep = s;
      });
      let friendly = msg;
      if (msg.includes('author_id')) {
        friendly = 'You must be signed in to post. Tap your Vibe Card to sign in, then try again.';
      } else if (targetStep) {
        const fieldNames = { 1: 'title, description or address', 2: 'categories or media', 3: 'ticket link or age setting' };
        friendly = `Check your ${fieldNames[targetStep] || 'details'} — ${msg}`;
      }
      setError(friendly);
      if (targetStep && targetStep !== step) setStep(targetStep);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 350);
    }
    } finally {
      setLoading(false);
      setUploadingMedia(false);
    }
  };


  const canProceedStep1 = title.trim().length > 2 && description.trim().length > 5 && address.trim().length > 3;

  const addScheduleItem = () => {
    if (!scheduleForm.time.trim() || !scheduleForm.title.trim()) return;
    setScheduleItems(prev => [
      ...prev,
      { id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, ...scheduleForm },
    ]);
    setScheduleForm({ time: '', title: '', performer: '', notes: '' });
    setScheduleFormVisible(false);
  };

  const removeScheduleItem = (id) => setScheduleItems(prev => prev.filter(s => s.id !== id));

  const renderScheduleBuilder = () => (
    <View style={{ marginBottom: 20 }}>
      <View style={pm.sectionHeader}>
        <Text style={[pm.label, { color: muted, marginBottom: 0 }]}>Event Schedule</Text>
        <TouchableOpacity
          onPress={() => setScheduleFormVisible(v => !v)}
          style={[pm.addScheduleBtn, { borderColor: primary, backgroundColor: `${primary}12` }]}
        >
          <Feather name="plus" size={13} color={primary} />
          <Text style={{ color: primary, fontSize: 12, fontWeight: '800' }}>Add Slot</Text>
        </TouchableOpacity>
      </View>

      {scheduleItems.length > 0 && (
        <View style={{ gap: 8, marginBottom: 10 }}>
          {scheduleItems.map((item) => (
            <View key={item.id} style={[pm.scheduleRow, { borderColor: `${primary}30`, backgroundColor: `${primary}08` }]}>
              <View style={[pm.scheduleTimeBadge, { backgroundColor: `${primary}20` }]}>
                <Text style={[pm.scheduleTime, { color: primary }]}>{item.time}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[pm.scheduleTitle, { color: textColor }]}>{item.title}</Text>
                {!!item.performer && <Text style={[pm.scheduleSub, { color: muted }]}>{item.performer}</Text>}
                {!!item.notes && <Text style={[pm.scheduleSub, { color: muted, fontStyle: 'italic' }]}>{item.notes}</Text>}
              </View>
              <TouchableOpacity onPress={() => removeScheduleItem(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={16} color={muted} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {scheduleFormVisible && (
        <View style={[pm.scheduleForm, { borderColor: `${primary}30`, backgroundColor: `${primary}06` }]}>
          <Text style={[pm.scheduleFormTitle, { color: primary }]}>New Schedule Slot</Text>
          <View style={pm.scheduleRow2}>
            <TextInput
              style={[pm.scheduleInput, { color: textColor, borderColor: `${primary}35`, flex: 0.7 }]}
              placeholder="Time (e.g. 22:00)"
              placeholderTextColor={muted}
              value={scheduleForm.time}
              onChangeText={v => setScheduleForm(f => ({ ...f, time: v }))}
              maxLength={10}
            />
            <TextInput
              style={[pm.scheduleInput, { color: textColor, borderColor: `${primary}35`, flex: 1.3 }]}
              placeholder="Activity / Set title *"
              placeholderTextColor={muted}
              value={scheduleForm.title}
              onChangeText={v => setScheduleForm(f => ({ ...f, title: v }))}
              maxLength={60}
            />
          </View>
          <TextInput
            style={[pm.scheduleInput, { color: textColor, borderColor: `${primary}35` }]}
            placeholder="Performer / Artist (optional)"
            placeholderTextColor={muted}
            value={scheduleForm.performer}
            onChangeText={v => setScheduleForm(f => ({ ...f, performer: v }))}
            maxLength={60}
          />
          <TextInput
            style={[pm.scheduleInput, { color: textColor, borderColor: `${primary}35` }]}
            placeholder="Notes / details (optional)"
            placeholderTextColor={muted}
            value={scheduleForm.notes}
            onChangeText={v => setScheduleForm(f => ({ ...f, notes: v }))}
            maxLength={100}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <TouchableOpacity
              style={[pm.scheduleConfirmBtn, { backgroundColor: scheduleForm.time && scheduleForm.title ? primary : `${primary}30`, flex: 1 }]}
              onPress={addScheduleItem}
              disabled={!scheduleForm.time.trim() || !scheduleForm.title.trim()}
            >
              <Feather name="check" size={14} color={scheduleForm.time && scheduleForm.title ? '#000' : muted} />
              <Text style={{ color: scheduleForm.time && scheduleForm.title ? '#000' : muted, fontWeight: '800', fontSize: 13 }}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[pm.scheduleConfirmBtn, { borderColor: `${primary}30`, borderWidth: 1, backgroundColor: 'transparent' }]}
              onPress={() => { setScheduleFormVisible(false); setScheduleForm({ time: '', title: '', performer: '', notes: '' }); }}
            >
              <Text style={{ color: muted, fontWeight: '700', fontSize: 13 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {scheduleItems.length === 0 && !scheduleFormVisible && (
        <TouchableOpacity
          onPress={() => setScheduleFormVisible(true)}
          style={[pm.scheduleEmpty, { borderColor: `${primary}25` }]}
        >
          <Feather name="clock" size={18} color={`${primary}60`} />
          <Text style={{ color: muted, fontSize: 12, marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
            Add a timeline — DJ sets, performances,{'\n'}speakers, activities, etc.
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderCategoryChips = () => {
    if (selectedCategories.length === 0) return null;
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {selectedCategories.map(key => {
          const meta = ALL_CATEGORIES_MAP[key];
          const label = meta?.label || key.replace('custom_', '').replace(/_/g, ' ');
          const color = meta?.color || primary;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setSelectedCategories(prev => prev.filter(k => k !== key))}
              style={[pm.chip, { backgroundColor: `${color}20`, borderColor: `${color}50` }]}
            >
              <Text style={{ fontSize: 13 }}>{meta?.icon || '✦'}</Text>
              <Text style={[pm.chipText, { color }]}>{label}</Text>
              <Feather name="x" size={11} color={color} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={pm.overlay}>
          <View style={[pm.sheet, { backgroundColor: bg, borderColor: `${primary}30` }]}>
            {/* Pill */}
            <View style={[pm.pill, { backgroundColor: `${primary}50` }]} />

            {/* Header */}
            <View style={pm.headerRow}>
              <View>
                <Text style={[pm.title, { color: primary }]}>NEW ROYAL VIBE</Text>
                <Text style={[pm.stepLabel, { color: muted }]}>Step {step} of 3</Text>
              </View>
              <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x" size={22} color={textColor} />
              </TouchableOpacity>
            </View>

            {/* Progress */}
            <View style={pm.progressBar}>
              <View style={[pm.progressFill, { backgroundColor: primary, width: `${(step / 3) * 100}%` }]} />
            </View>

            <ScrollView ref={scrollRef} style={pm.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* ── STEP 0: AI Fill — HIDDEN under development ─────────────────────────────────────── */}
              {/* {step === 0 && ( ... )} */}

              {/* ── STEP 1: Core info ────────────────────────────────────── */}
              {step === 1 && (
                <>
                  <Text style={[pm.label, { color: muted }]}>Event Title *</Text>
                  <TextInput
                    style={[pm.input, { color: textColor, borderColor: `${primary}35` }]}
                    placeholder="Give your event a name..."
                    placeholderTextColor={muted}
                    value={title}
                    onChangeText={setTitle}
                    maxLength={100}
                  />

                  <Text style={[pm.label, { color: muted }]}>What's the vibe? *</Text>
                  <TextInput
                    style={[pm.input, pm.textarea, { color: textColor, borderColor: `${primary}35` }]}
                    placeholder="Describe your event — make it sound elite..."
                    placeholderTextColor={muted}
                    multiline
                    numberOfLines={4}
                    value={description}
                    onChangeText={setDescription}
                    maxLength={600}
                  />
                  <Text style={[pm.charCount, { color: muted }]}>{description.length}/600</Text>

                  <Text style={[pm.label, { color: muted }]}>Venue / Address *</Text>
                  <TextInput
                    style={[pm.input, { color: textColor, borderColor: `${primary}35` }]}
                    placeholder="Full address or venue name..."
                    placeholderTextColor={muted}
                    value={address}
                    onChangeText={setAddress}
                  />

                  <TouchableOpacity
                    onPress={pinLocation}
                    style={[pm.catBtn, { marginBottom: 18, borderColor: lat ? '#10b981' : `${primary}40`, backgroundColor: lat ? '#10b98115' : `${primary}08` }]}
                  >
                    <Feather name={lat ? "check-circle" : "map-pin"} size={16} color={lat ? '#10b981' : primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[{ color: lat ? '#10b981' : primary, fontWeight: '800', fontSize: 13 }]}>
                        {lat ? 'Spot Pinned Successfully' : 'Pin Exact Spot (GPS)'}
                      </Text>
                      {lat && <Text style={{ color: '#10b981', fontSize: 10 }}>{lat.toFixed(5)}, {lon.toFixed(5)}</Text>}
                    </View>
                  </TouchableOpacity>

                  <Text style={[pm.label, { color: muted }]}>City</Text>
                  <TextInput
                    style={[pm.input, { color: textColor, borderColor: `${primary}35` }]}
                    placeholder="e.g. Johannesburg, Cape Town..."
                    placeholderTextColor={muted}
                    value={city}
                    onChangeText={setCity}
                  />

                  <Text style={[pm.label, { color: muted }]}>Date & Time</Text>
                  <View style={pm.pickerRow}>
                    {/* Date picker button */}
                    <TouchableOpacity
                      style={[pm.pickerBtn, { borderColor: pickedDate ? primary : `${primary}35`, backgroundColor: pickedDate ? `${primary}12` : 'rgba(255,255,255,0.05)', flex: 1.4 }]}
                      onPress={() => setCalendarVisible(true)}
                    >
                      <Feather name="calendar" size={15} color={pickedDate ? primary : muted} />
                      <Text style={[pm.pickerBtnText, { color: pickedDate ? primary : muted }]} numberOfLines={1}>
                        {pickedDate
                          ? pickedDate.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
                          : 'Pick date'}
                      </Text>
                    </TouchableOpacity>

                    {/* Start time picker */}
                    <TouchableOpacity
                      style={[pm.pickerBtn, { borderColor: timeSet ? primary : `${primary}35`, backgroundColor: timeSet ? `${primary}12` : 'rgba(255,255,255,0.05)', flex: 1 }]}
                      onPress={() => setTimePickerVisible(true)}
                    >
                      <Feather name="clock" size={15} color={timeSet ? primary : muted} />
                      <Text style={[pm.pickerBtnText, { color: timeSet ? primary : muted }]}>
                        {timeSet
                          ? `${String(pickedHour).padStart(2, '0')}:${String(pickedMinute).padStart(2, '0')}`
                          : 'Start'}
                      </Text>
                    </TouchableOpacity>

                    {/* End time picker */}
                    <TouchableOpacity
                      style={[pm.pickerBtn, { borderColor: endTimeSet ? primary : `${primary}25`, backgroundColor: endTimeSet ? `${primary}12` : 'rgba(255,255,255,0.03)', flex: 1 }]}
                      onPress={() => setEndTimePickerVisible(true)}
                    >
                      <Feather name="clock" size={15} color={endTimeSet ? primary : muted} />
                      <Text style={[pm.pickerBtnText, { color: endTimeSet ? primary : muted }]}>
                        {endTimeSet && endHour !== null
                          ? `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`
                          : 'End (opt)'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {!!error && <View style={pm.errorBox}><Text style={pm.errorText}>⚠️ {error}</Text></View>}

                  <TouchableOpacity
                    style={[pm.nextBtn, { backgroundColor: canProceedStep1 ? primary : `${primary}20` }]}
                    onPress={() => {
                      if (!canProceedStep1) {
                        setError('Fill in title, description and address first.');
                        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
                        return;
                      }
                      setError(''); setStep(2);
                    }}
                  >
                    <Text style={{ color: canProceedStep1 ? '#000' : muted, fontWeight: '900', fontSize: 15 }}>NEXT →</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* ── STEP 2: Media & categories ───────────────────────────── */}
              {step === 2 && (
                <>
                  {/* Media */}
                  <View style={pm.sectionHeader}>
                    <Text style={[pm.label, { color: muted, marginBottom: 0 }]}>
                      Media ({mediaItems.length}/{MAX_MEDIA})
                    </Text>
                    <Text style={[{ color: muted, fontSize: 11 }]}>Photos & Videos</Text>
                  </View>

                  {/* Media thumbnails */}
                  {mediaItems.length > 0 && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ marginBottom: 12 }}
                      contentContainerStyle={{ gap: 8 }}
                    >
                      {mediaItems.map((item, idx) => (
                        <View key={idx} style={pm.thumbWrap}>
                          <Image source={{ uri: item.uri }} style={pm.thumb} resizeMode="cover" />
                          {item.type === 'video' && (
                            <View style={pm.videoOverlay}>
                              <Feather name="play" size={16} color="#fff" />
                            </View>
                          )}
                          <TouchableOpacity style={[pm.removeBtn, { backgroundColor: '#ef4444' }]} onPress={() => removeMedia(idx)}>
                            <Feather name="x" size={10} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  )}

                  <TouchableOpacity
                    style={[pm.mediaPickBtn, { borderColor: `${primary}40`, backgroundColor: `${primary}08` }]}
                    onPress={pickMedia}
                    disabled={mediaItems.length >= MAX_MEDIA}
                  >
                    <Feather name="image" size={20} color={mediaItems.length >= MAX_MEDIA ? muted : primary} />
                    <Text style={[pm.mediaPickText, { color: mediaItems.length >= MAX_MEDIA ? muted : primary }]}>
                      {mediaItems.length === 0
                        ? `Add Photos & Videos (up to ${MAX_MEDIA})`
                        : `Add more (${MAX_MEDIA - mediaItems.length} left)`}
                    </Text>
                  </TouchableOpacity>

                  {/* Schedule */}
                  {renderScheduleBuilder()}

                  {/* Categories */}
                  <Text style={[pm.label, { color: muted, marginTop: 4 }]}>Categories & Interests</Text>
                  {renderCategoryChips()}
                  <TouchableOpacity
                    style={[pm.catBtn, { borderColor: `${primary}40`, backgroundColor: `${primary}08` }]}
                    onPress={() => setCatPickerVisible(true)}
                  >
                    <Feather name="tag" size={16} color={primary} />
                    <Text style={[{ color: primary, fontWeight: '800', fontSize: 13 }]}>
                      {selectedCategories.length > 0
                        ? `${selectedCategories.length} selected — tap to change`
                        : 'Pick from 1000+ categories'}
                    </Text>
                    <Feather name="chevron-right" size={16} color={`${primary}80`} style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>

                  {/* Event type */}
                  <Text style={[pm.label, { color: muted, marginTop: 20 }]}>Event Format</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                    {EVENT_TYPES.map(t => (
                      <TouchableOpacity
                        key={t}
                        onPress={() => setEventType(t === eventType ? '' : t)}
                        style={[pm.tag, { backgroundColor: eventType === t ? primary : `${primary}10`, borderColor: eventType === t ? primary : `${primary}20` }]}
                      >
                        <Text style={{ color: eventType === t ? '#000' : textColor, fontSize: 12, fontWeight: '700' }}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {!!error && <View style={pm.errorBox}><Text style={pm.errorText}>⚠️ {error}</Text></View>}

                  <View style={pm.bottomRow}>
                    <TouchableOpacity style={pm.backBtn} onPress={() => setStep(1)}>
                      <Feather name="arrow-left" size={14} color={muted} />
                      <Text style={[pm.backText, { color: muted }]}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[pm.postBtn, { backgroundColor: primary }]}
                      onPress={() => { setError(''); setStep(3); }}
                    >
                      <Text style={pm.postBtnText}>NEXT →</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* ── STEP 3: Settings & publish ───────────────────────────── */}
              {step === 3 && (
                <>
                  <Text style={[pm.label, { color: muted }]}>Ticket / RSVP Link</Text>
                  <TextInput
                    style={[pm.input, { color: textColor, borderColor: `${primary}35` }]}
                    placeholder="https://tickets.example.com..."
                    placeholderTextColor={muted}
                    value={ticketUrl}
                    onChangeText={setTicketUrl}
                    autoCapitalize="none"
                    keyboardType="url"
                  />

                  <Text style={[pm.label, { color: muted }]}>Age Range</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[{ color: muted, fontSize: 10, fontWeight: '800', marginBottom: 5 }]}>MIN AGE</Text>
                      <View style={[pm.ageRow, { flexWrap: 'wrap' }]}>
                        {AGE_MIN_OPTIONS.map(a => (
                          <TouchableOpacity
                            key={a}
                            onPress={() => setAgeMin(a)}
                            style={[pm.ageBtn, { backgroundColor: ageMin === a ? primary : `${primary}10`, borderColor: ageMin === a ? primary : `${primary}20` }]}
                          >
                            <Text style={{ color: ageMin === a ? '#000' : textColor, fontWeight: '800', fontSize: 11 }}>
                              {a === 0 ? 'Any' : `${a}+`}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[{ color: muted, fontSize: 10, fontWeight: '800', marginBottom: 5 }]}>MAX AGE</Text>
                    <View style={[pm.ageRow, { flexWrap: 'wrap' }]}>
                      {AGE_MAX_OPTIONS.map(a => (
                        <TouchableOpacity
                          key={a}
                          onPress={() => setAgeMax(a)}
                          style={[pm.ageBtn, { backgroundColor: ageMax === a ? primary : `${primary}10`, borderColor: ageMax === a ? primary : `${primary}20` }]}
                        >
                          <Text style={{ color: ageMax === a ? '#000' : textColor, fontWeight: '800', fontSize: 11 }}>
                            {a === 0 ? 'No limit' : a === 99 ? '99+' : `≤${a}`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  {ageMin > 0 && (
                    <Text style={{ color: primary, fontSize: 11, fontWeight: '800', marginTop: 4 }}>
                      Allowed: {ageMin}{ageMax > 0 ? `–${ageMax === 99 ? '99+' : ageMax}` : '+'}
                    </Text>
                  )}

                  {/* Summary card */}
                  <GlassView style={[pm.summary, { borderColor: `${primary}20` }]}>
                    <Text style={[pm.summaryTitle, { color: primary }]}>Event Summary</Text>
                    <Text style={[pm.summaryLine, { color: textColor }]}>📛 {title}</Text>
                    <Text style={[pm.summaryLine, { color: muted }]}>📍 {address}{city ? `, ${city}` : ''}</Text>
                    {pickedDate ? (
                      <Text style={[pm.summaryLine, { color: muted }]}>
                        📅 {pickedDate.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        {timeSet ? ` ${String(pickedHour).padStart(2, '0')}:${String(pickedMinute).padStart(2, '0')}` : ''}
                        {endTimeSet && endHour !== null ? ` – ${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}` : ''}
                      </Text>
                    ) : null}
                    {ageMin > 0 && (
                      <Text style={[pm.summaryLine, { color: muted }]}>
                        🔞 Ages {ageMin}{ageMax > 0 ? `–${ageMax === 99 ? '99+' : ageMax}` : '+'}
                      </Text>
                    )}
                    {selectedCategories.length > 0 && (
                      <Text style={[pm.summaryLine, { color: muted }]}>
                        🏷️ {selectedCategories.slice(0, 5).map(k => ALL_CATEGORIES_MAP[k]?.label || k).join(', ')}
                        {selectedCategories.length > 5 ? ` +${selectedCategories.length - 5} more` : ''}
                      </Text>
                    )}
                    <Text style={[pm.summaryLine, { color: muted }]}>
                      🖼️ {mediaItems.length} media item{mediaItems.length !== 1 ? 's' : ''}
                    </Text>
                    {scheduleItems.length > 0 && (
                      <Text style={[pm.summaryLine, { color: muted }]}>
                        🗓️ {scheduleItems.length} schedule slot{scheduleItems.length !== 1 ? 's' : ''}
                        {' — '}{scheduleItems.map(s => s.time).join(', ')}
                      </Text>
                    )}
                  </GlassView>

                  {uploadingMedia && (
                    <View style={pm.uploadProgress}>
                      <ActivityIndicator color={primary} size="small" />
                      <Text style={[{ color: muted, fontSize: 12, marginLeft: 8 }]}>Uploading media...</Text>
                    </View>
                  )}

                  {!!error && <View style={pm.errorBox}><Text style={pm.errorText}>⚠️ {error}</Text></View>}

                  <View style={pm.bottomRow}>
                    <TouchableOpacity style={pm.backBtn} onPress={() => setStep(2)}>
                      <Feather name="arrow-left" size={14} color={muted} />
                      <Text style={[pm.backText, { color: muted }]}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[pm.postBtn, { backgroundColor: primary }, loading && pm.disabled]}
                      onPress={handlePost}
                      disabled={loading}
                    >
                      {loading
                        ? <ActivityIndicator color="#000" />
                        : <Text style={pm.postBtnText}>ANNOUNCE EVENT 👑</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </>
              )}

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Category picker */}
      <CategoryPickerModal
        visible={catPickerVisible}
        onClose={() => setCatPickerVisible(false)}
        selected={selectedCategories}
        onConfirm={setSelectedCategories}
        title="Event Categories"
      />

      {/* Date picker */}
      <CalendarPicker
        visible={calendarVisible}
        onClose={() => setCalendarVisible(false)}
        onConfirm={(date) => { setPickedDate(date); setCalendarVisible(false); }}
        value={pickedDate}
        primary={primary} bg={bg} textColor={textColor} muted={muted}
      />

      {/* Time picker */}
      <TimePicker
        visible={timePickerVisible}
        onClose={() => setTimePickerVisible(false)}
        onConfirm={(h, m) => { setPickedHour(h); setPickedMinute(m); setTimeSet(true); setTimePickerVisible(false); }}
        initialHour={pickedHour}
        initialMinute={pickedMinute}
        primary={primary} bg={bg} textColor={textColor} muted={muted}
      />

      <TimePicker
        visible={endTimePickerVisible}
        onClose={() => setEndTimePickerVisible(false)}
        onConfirm={(h, m) => { setEndHour(h); setEndMinute(m); setEndTimeSet(true); setEndTimePickerVisible(false); }}
        initialHour={endHour ?? pickedHour}
        initialMinute={endMinute ?? 0}
        primary={primary} bg={bg} textColor={textColor} muted={muted}
      />
    </>
  );
};

const pm = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.78)' },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, paddingHorizontal: 22, paddingBottom: 10, maxHeight: '94%',
  },
  pill: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  title: { fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  stepLabel: { fontSize: 11, marginTop: 3 },
  progressBar: { height: 3, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, marginBottom: 22, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  form: { flex: 1 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  input: {
    borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 15, paddingVertical: 13,
    fontSize: 14, marginBottom: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  textarea: { height: 110, textAlignVertical: 'top' },
  charCount: { fontSize: 10, textAlign: 'right', marginTop: -14, marginBottom: 16 },

  // Media
  thumbWrap: { position: 'relative', width: 90, height: 90 },
  thumb: { width: 90, height: 90, borderRadius: 12, backgroundColor: '#1a1a1a' },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
  },
  removeBtn: {
    position: 'absolute', top: 4, right: 4,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  mediaPickBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 16, paddingVertical: 18, marginBottom: 4,
  },
  mediaPickText: { fontWeight: '800', fontSize: 13 },

  // Categories
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, marginRight: 8,
  },
  chipText: { fontSize: 12, fontWeight: '800' },
  catBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14,
  },

  tag: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  ageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  ageBtn: { flex: 1, minWidth: SCREEN_W < 375 ? 45 : 60, paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1 },

  // Summary
  summary: { borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, gap: 6 },
  summaryTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 1, marginBottom: 6 },
  summaryLine: { fontSize: 13, lineHeight: 20 },

  uploadProgress: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },

  pickerRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 13,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  pickerBtnText: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  nextBtn: { paddingVertical: 16, borderRadius: 30, alignItems: 'center', marginTop: 10, marginBottom: 10 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 16, paddingHorizontal: 10 },
  backText: { fontSize: 15, fontWeight: '700' },
  postBtn: { flex: 1, paddingVertical: 16, borderRadius: 30, alignItems: 'center' },
  postBtnText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  disabled: { opacity: 0.6 },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 10,
    padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  errorText: { color: '#ef4444', fontSize: 12, fontWeight: '600' },

  // Schedule builder
  addScheduleBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  scheduleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12 },
  scheduleTimeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, minWidth: 50, alignItems: 'center' },
  scheduleTime: { fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  scheduleTitle: { fontSize: 13, fontWeight: '800', lineHeight: 18 },
  scheduleSub: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  scheduleForm: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10, marginBottom: 10 },
  scheduleFormTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  scheduleRow2: { flexDirection: SCREEN_W < 375 ? 'column' : 'row', gap: 8 },
  scheduleInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 13, backgroundColor: 'rgba(255,255,255,0.05)' },
  scheduleConfirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 30 },
  scheduleEmpty: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 16, paddingVertical: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
});
