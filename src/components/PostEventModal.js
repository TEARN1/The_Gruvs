import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TextInput,
  TouchableOpacity, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform, Image, FlatList,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { GlassView } from './GlassView';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { CategoryPickerModal } from './CategoryPickerModal';
import { ALL_CATEGORIES_MAP } from '../constants/AllCategories';

const MAX_MEDIA = 30;
const EVENT_TYPES = ['Social', 'Concert', 'Workshop', 'Festival', 'Meetup', 'Party', 'Conference', 'Pop-Up', 'Rave', 'Market', 'Retreat', 'Competition'];
const AGE_OPTIONS = [0, 16, 18, 21, 25];

export const PostEventModal = ({ visible, onClose, onPostSuccess }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();

  // Form fields
  const [title, setTitle]         = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress]     = useState('');
  const [city, setCity]           = useState('');
  const [eventDate, setEventDate] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');
  const [eventType, setEventType] = useState('');
  const [ageRestriction, setAgeRestriction] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [mediaItems, setMediaItems] = useState([]); // { uri, type, name }
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [error, setError] = useState('');
  const [catPickerVisible, setCatPickerVisible] = useState(false);
  const scrollRef = useRef(null);

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  const reset = () => {
    setTitle(''); setDescription(''); setAddress(''); setCity('');
    setEventDate(''); setTicketUrl(''); setEventType('');
    setAgeRestriction(0); setSelectedCategories([]); setMediaItems([]);
    setStep(1); setLoading(false); setUploadingMedia(false); setError('');
  };

  const handleClose = () => { reset(); onClose(); };

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
    for (const item of mediaItems) {
      try {
        const ext = item.uri.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `events/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const resp = await fetch(item.uri);
        const blob = await resp.blob();
        const mimeType = item.type === 'video' ? `video/${ext}` : `image/${ext}`;
        const { error: upErr } = await supabase.storage
          .from('event-media')
          .upload(fileName, blob, { contentType: mimeType, upsert: false });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('event-media').getPublicUrl(fileName);
        uploaded.push({ url: urlData.publicUrl, type: item.type });
      } catch (e) {
        console.log('Media upload error:', e.message);
      }
    }
    return uploaded;
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handlePost = async () => {
    if (!title.trim() || !description.trim() || !address.trim()) {
      setError('Title, description and address are required.');
      return;
    }
    if (!user?.id) { setError('Sign in required to post a Gruv.'); return; }

    setLoading(true);
    setError('');

    let mediaUrls = [];
    if (mediaItems.length > 0) {
      setUploadingMedia(true);
      mediaUrls = await uploadAllMedia();
      setUploadingMedia(false);
      // If all uploads failed, continue anyway without media
    }

    const primaryCat = selectedCategories[0] || eventType?.toLowerCase() || null;

    const payload = {
      author_id:   user.id,
      title:       title.trim(),
      description: description.trim(),
      address:     address.trim(),
    };
    if (city.trim())               payload.city            = city.trim();
    if (eventDate.trim())          payload.event_date      = eventDate.trim();
    if (mediaUrls.length > 0)     payload.media           = mediaUrls;
    if (ageRestriction)           payload.age_restriction = ageRestriction;
    if (primaryCat)               payload.category        = primaryCat;
    if (ticketUrl.trim())         payload.ticket_url      = ticketUrl.trim();

    const { error: dbError } = await supabase.from('events').insert(payload);

    setLoading(false);
    if (dbError) {
      const msg = dbError.message || '';
      // Map DB column names → which step contains that field, so we jump there
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
      if (targetStep && targetStep !== step) {
        setStep(targetStep);
      }
      // Scroll down to show the error box
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 350);
    } else {
      reset();
      onPostSuccess?.();
      onClose();
    }
  };

  const canProceedStep1 = title.trim().length > 2 && description.trim().length > 5 && address.trim().length > 3;

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

                  <Text style={[pm.label, { color: muted }]}>City</Text>
                  <TextInput
                    style={[pm.input, { color: textColor, borderColor: `${primary}35` }]}
                    placeholder="e.g. Johannesburg, Cape Town..."
                    placeholderTextColor={muted}
                    value={city}
                    onChangeText={setCity}
                  />

                  <Text style={[pm.label, { color: muted }]}>Date & Time</Text>
                  <TextInput
                    style={[pm.input, { color: textColor, borderColor: `${primary}35` }]}
                    placeholder="e.g. 2025-12-25 or Sat 14 Dec 8pm..."
                    placeholderTextColor={muted}
                    value={eventDate}
                    onChangeText={setEventDate}
                  />

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

                  {/* Categories */}
                  <Text style={[pm.label, { color: muted, marginTop: 20 }]}>Categories & Interests</Text>
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

                  <Text style={[pm.label, { color: muted }]}>Age Restriction</Text>
                  <View style={pm.ageRow}>
                    {AGE_OPTIONS.map(a => (
                      <TouchableOpacity
                        key={a}
                        onPress={() => setAgeRestriction(a)}
                        style={[pm.ageBtn, { backgroundColor: ageRestriction === a ? primary : `${primary}10`, borderColor: ageRestriction === a ? primary : `${primary}20` }]}
                      >
                        <Text style={{ color: ageRestriction === a ? '#000' : textColor, fontWeight: '800', fontSize: 13 }}>
                          {a === 0 ? 'All Ages' : `${a}+`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Summary card */}
                  <GlassView style={[pm.summary, { borderColor: `${primary}20` }]}>
                    <Text style={[pm.summaryTitle, { color: primary }]}>Event Summary</Text>
                    <Text style={[pm.summaryLine, { color: textColor }]}>📛 {title}</Text>
                    <Text style={[pm.summaryLine, { color: muted }]}>📍 {address}{city ? `, ${city}` : ''}</Text>
                    {eventDate ? <Text style={[pm.summaryLine, { color: muted }]}>📅 {eventDate}</Text> : null}
                    {selectedCategories.length > 0 && (
                      <Text style={[pm.summaryLine, { color: muted }]}>
                        🏷️ {selectedCategories.slice(0, 5).map(k => ALL_CATEGORIES_MAP[k]?.label || k).join(', ')}
                        {selectedCategories.length > 5 ? ` +${selectedCategories.length - 5} more` : ''}
                      </Text>
                    )}
                    <Text style={[pm.summaryLine, { color: muted }]}>
                      🖼️ {mediaItems.length} media item{mediaItems.length !== 1 ? 's' : ''}
                    </Text>
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
  ageBtn: { flex: 1, minWidth: 60, paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1 },

  // Summary
  summary: { borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, gap: 6 },
  summaryTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 1, marginBottom: 6 },
  summaryLine: { fontSize: 13, lineHeight: 20 },

  uploadProgress: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },

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
});
