import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TextInput,
  TouchableOpacity, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GlassView } from './GlassView';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

const INTEREST_TAGS = ['Music', 'Nightlife', 'Tech', 'Art', 'Sports', 'Food', 'Fashion', 'Culture', 'Business', 'Wellness'];
const EVENT_TYPES   = ['Social', 'Concert', 'Workshop', 'Festival', 'Meetup', 'Party', 'Conference', 'Pop-Up'];
const AGE_OPTIONS   = [0, 16, 18, 21, 25];

export const PostEventModal = ({ visible, onClose, onPostSuccess }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();

  const [description, setDescription]     = useState('');
  const [address, setAddress]             = useState('');
  const [mediaUrl, setMediaUrl]           = useState('');
  const [ageRestriction, setAgeRestriction] = useState(0);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [eventType, setEventType]         = useState('');
  const [ticketUrl, setTicketUrl]         = useState('');
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');
  const [step, setStep]                   = useState(1); // 2-step form

  const primary   = currentTheme?.primary || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text || '#fff';
  const muted     = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  const toggleInterest = (item) => {
    setSelectedInterests(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  const reset = () => {
    setDescription('');
    setAddress('');
    setMediaUrl('');
    setAgeRestriction(0);
    setSelectedInterests([]);
    setEventType('');
    setTicketUrl('');
    setLoading(false);
    setError('');
    setStep(1);
  };

  const handleClose = () => { reset(); onClose(); };

  const handlePost = async () => {
    if (!description.trim() || !address.trim()) {
      setError('Description and address are required.');
      return;
    }
    if (!user) {
      setError('You must be signed in to post an event.');
      return;
    }
    setLoading(true);
    setError('');

    const { error: dbError } = await supabase.from('events').insert({
      user_id: user.id,
      description: description.trim(),
      address: address.trim(),
      media: mediaUrl.trim() ? [{ url: mediaUrl.trim(), type: 'image' }] : [],
      age_restriction: ageRestriction,
      interests: selectedInterests,
      event_type: eventType || null,
      ticket_url: ticketUrl.trim() || null,
    });

    setLoading(false);
    if (dbError) {
      setError(dbError.message);
    } else {
      reset();
      onPostSuccess();
      onClose();
    }
  };

  const canProceed = description.trim().length > 5 && address.trim().length > 3;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: bg, borderColor: `${primary}30` }]}>
          {/* Top pill */}
          <View style={[styles.pill, { backgroundColor: `${primary}50` }]} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.title, { color: primary }]}>NEW ROYAL VIBE</Text>
              <Text style={[styles.stepLabel, { color: muted }]}>Step {step} of 2</Text>
            </View>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={22} color={textColor} />
            </TouchableOpacity>
          </View>

          {/* Step progress bar */}
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { backgroundColor: primary, width: step === 1 ? '50%' : '100%' }]} />
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {step === 1 ? (
              <>
                <Text style={[styles.label, { color: muted }]}>What's the vibe?</Text>
                <TextInput
                  style={[styles.input, styles.textarea, { color: textColor, borderColor: `${primary}35` }]}
                  placeholder="Describe your event — make it sound elite..."
                  placeholderTextColor={muted}
                  multiline
                  numberOfLines={4}
                  value={description}
                  onChangeText={setDescription}
                  maxLength={500}
                />
                <Text style={[styles.charCount, { color: muted }]}>{description.length}/500</Text>

                <Text style={[styles.label, { color: muted }]}>Where's the kingdom?</Text>
                <TextInput
                  style={[styles.input, { color: textColor, borderColor: `${primary}35` }]}
                  placeholder="Full address or venue name..."
                  placeholderTextColor={muted}
                  value={address}
                  onChangeText={setAddress}
                />

                <Text style={[styles.label, { color: muted }]}>Event Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagScroll}>
                  {EVENT_TYPES.map(t => (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setEventType(t === eventType ? '' : t)}
                      style={[styles.tag, { backgroundColor: eventType === t ? primary : 'rgba(255,255,255,0.07)', borderColor: eventType === t ? primary : 'rgba(255,255,255,0.15)' }]}
                    >
                      <Text style={{ color: eventType === t ? '#000' : textColor, fontSize: 12, fontWeight: '700' }}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  style={[styles.nextBtn, { backgroundColor: canProceed ? primary : 'rgba(255,255,255,0.12)' }]}
                  onPress={() => canProceed && setStep(2)}
                  disabled={!canProceed}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: canProceed ? '#000' : muted, fontWeight: '900', fontSize: 15, letterSpacing: 1 }}>NEXT</Text>
                    <Feather name="arrow-right" size={16} color={canProceed ? '#000' : muted} />
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={[styles.label, { color: muted }]}>Interests / Categories</Text>
                <View style={styles.tagsWrap}>
                  {INTEREST_TAGS.map(t => {
                    const active = selectedInterests.includes(t);
                    return (
                      <TouchableOpacity
                        key={t}
                        onPress={() => toggleInterest(t)}
                        style={[styles.tag, { backgroundColor: active ? primary : 'rgba(255,255,255,0.07)', borderColor: active ? primary : 'rgba(255,255,255,0.15)' }]}
                      >
                        <Text style={{ color: active ? '#000' : textColor, fontSize: 12, fontWeight: '700' }}>{t}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.label, { color: muted }]}>Media URL (optional)</Text>
                <TextInput
                  style={[styles.input, { color: textColor, borderColor: `${primary}35` }]}
                  placeholder="Paste image or video link..."
                  placeholderTextColor={muted}
                  value={mediaUrl}
                  onChangeText={setMediaUrl}
                  autoCapitalize="none"
                />

                <Text style={[styles.label, { color: muted }]}>Ticket / RSVP Link (optional)</Text>
                <TextInput
                  style={[styles.input, { color: textColor, borderColor: `${primary}35` }]}
                  placeholder="https://..."
                  placeholderTextColor={muted}
                  value={ticketUrl}
                  onChangeText={setTicketUrl}
                  autoCapitalize="none"
                  keyboardType="url"
                />

                <Text style={[styles.label, { color: muted }]}>Age Restriction</Text>
                <View style={styles.ageRow}>
                  {AGE_OPTIONS.map(a => (
                    <TouchableOpacity
                      key={a}
                      onPress={() => setAgeRestriction(a)}
                      style={[styles.ageBtn, { backgroundColor: ageRestriction === a ? primary : 'rgba(255,255,255,0.07)', borderColor: ageRestriction === a ? primary : 'rgba(255,255,255,0.15)' }]}
                    >
                      <Text style={{ color: ageRestriction === a ? '#000' : textColor, fontWeight: '800', fontSize: 13 }}>
                        {a === 0 ? 'All' : `${a}+`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {!!error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>⚠️ {error}</Text>
                  </View>
                )}

                <View style={styles.bottomRow}>
                  <TouchableOpacity style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center', gap: 4 }]} onPress={() => setStep(1)}>
                    <Feather name="arrow-left" size={14} color={muted} />
                    <Text style={[styles.backText, { color: muted }]}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.postBtn, { backgroundColor: primary }, loading && styles.disabled]}
                    onPress={handlePost}
                    disabled={loading}
                  >
                    {loading
                      ? <ActivityIndicator color="#000" />
                      : <Text style={styles.postBtnText}>ANNOUNCE EVENT 👑</Text>
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
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.75)' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingBottom: 10,
    maxHeight: '92%',
  },
  pill: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 12, marginBottom: 18 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  stepLabel: { fontSize: 11, marginTop: 3 },
  closeBtn: { fontSize: 22, padding: 4 },
  progressBar: { height: 3, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, marginBottom: 24, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  form: { flex: 1 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  input: {
    borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 15, paddingVertical: 13,
    fontSize: 14, marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  textarea: { height: 110, textAlignVertical: 'top' },
  charCount: { fontSize: 10, textAlign: 'right', marginTop: -15, marginBottom: 18 },
  tagScroll: { marginBottom: 20 },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  tag: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 6, marginBottom: 6 },
  ageRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  ageBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  nextBtn: { paddingVertical: 16, borderRadius: 30, alignItems: 'center', marginTop: 10 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  backBtn: { paddingVertical: 16, paddingHorizontal: 10 },
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
