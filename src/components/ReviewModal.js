/**
 * ReviewModal — Verified feedback for Service Providers.
 * Links to a completed booking and impacts SIS Score.
 */
import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator, Platform, KeyboardAvoidingView
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabase';
import { resilient } from '../utils/resilience';
import { TrustLedger } from '../services/trustLedger';

import { useBackClose } from '../hooks/useBackClose';

export const ReviewModal = ({ visible, onClose, booking, onReviewSubmitted }) => {
  useBackClose(visible, onClose);
  const { currentTheme } = useTheme();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const primary = currentTheme?.primary || "#00f2ff";
  const bg = currentTheme?.background || "#0d1112";
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const surface = currentTheme?.surface || 'rgba(255,255,255,0.06)';

  if (!booking) return null;

  const handleSubmit = async () => {
    if (!comment.trim()) {
      setError('Please add a short comment about the service.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Insert Review
      const reviewPayload = { booking_id: booking.id, provider_id: booking.provider_id, reviewer_id: booking.client_id, rating, comment: comment.trim(), created_at: new Date().toISOString() };
      const ok = await resilient(
        [
          () => supabase.from('service_reviews').insert([reviewPayload]),
          () => supabase.from('service_reviews').upsert([reviewPayload], { onConflict: 'booking_id', ignoreDuplicates: false }),
          () => supabase.rpc('submit_service_review', { p_booking_id: booking.id, p_rating: rating, p_comment: comment.trim() }),
        ],
        { attemptsPerTier: 3, baseMs: 400, label: `ReviewModal.submit:${booking.id}`, fallbackValue: null }
      );
      if (ok === null) throw new Error('Could not submit review');

      // 2. Adjust SIS Score based on rating
      // 5 stars = bonus, 1-2 stars = penalty
      const sisFlags = {
        checkinReliable: rating >= 4,
        cargoIntact: rating >= 3,
        socialPositive: rating >= 4
      };

      await TrustLedger.updateAfterPath(booking.provider_id, sisFlags);

      onReviewSubmitted?.();
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to submit review');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: bg, borderColor: `${primary}30` }]}>
          <View style={[s.pill, { backgroundColor: `${primary}50` }]} />

          <View style={s.header}>
            <Text style={[s.title, { color: primary }]}>RATE SERVICE</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color={textColor} />
            </TouchableOpacity>
          </View>

          <Text style={[s.subTitle, { color: textColor }]}>
            How was your experience with @{booking.provider?.username}?
          </Text>

          {/* Star Selector */}
          <View style={s.starRow}>
            {[1, 2, 3, 4, 5].map((num) => (
              <TouchableOpacity key={num} onPress={() => setRating(num)}>
                <Feather
                  name="star"
                  size={32}
                  color={num <= rating ? "#FFD700" : muted}
                  fill={num <= rating ? "#FFD700" : 'transparent'}
                />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[s.label, { color: muted }]}>Feedback</Text>
          <TextInput
            style={[s.input, { color: textColor, borderColor: `${primary}30`, backgroundColor: surface }]}
            placeholder="Tell others about the service..."
            placeholderTextColor={muted}
            multiline
            numberOfLines={3}
            value={comment}
            onChangeText={setComment}
          />

          {!!error && <Text style={s.errorText}>⚠️ {error}</Text>}

          <TouchableOpacity
            style={[s.submitBtn, { backgroundColor: primary }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#000" /> : <Text style={s.submitText}>SUBMIT REVIEW</Text>}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, borderTopWidth: 1 },
  pill: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  subTitle: { fontSize: 14, fontWeight: '700', textAlign: 'center', marginBottom: 24 },
  starRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 30 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 14, padding: 16, fontSize: 14, minHeight: 100, textAlignVertical: 'top' },
  submitBtn: { paddingVertical: 16, borderRadius: 30, alignItems: 'center', marginTop: 24 },
  submitText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  errorText: { color: "#ef4444", fontSize: 12, fontWeight: '600', marginTop: 12, textAlign: 'center' }
});
