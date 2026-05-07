import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { useToast } from './ToastNotification';

const RATING_CATEGORIES = [
  { key: 'overall',       label: 'OVERALL'      },
  { key: 'atmosphere',    label: 'ATMOSPHERE'   },
  { key: 'organisation',  label: 'ORGANISATION' },
];

const StarRow = ({ value, onChange, color }) => (
  <View style={styles.starRow}>
    {[1, 2, 3, 4, 5].map(n => (
      <TouchableOpacity key={n} onPress={() => onChange(n)}>
        <Text style={[styles.star, { color: n <= value ? color : 'rgba(255,255,255,0.2)' }]}>★</Text>
      </TouchableOpacity>
    ))}
    {value > 0 && (
      <Text style={[styles.starLabel, { color }]}>{value}.0</Text>
    )}
  </View>
);

export const RatingSection = ({ eventId, isSample, onAuthRequired }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const [stars, setStars] = useState({ overall: 0, atmosphere: 0, organisation: 0 });
  const [review, setReview] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const primary = currentTheme?.primary || '#00f2ff';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  const handleSubmit = async () => {
    if (!user) { onAuthRequired(); return; }
    if (stars.overall === 0) {
      toast.show('Give an overall rating first!', 'info');
      return;
    }
    if (isSample) {
      setSubmitted(true);
      toast.show('Gruv rated! Thanks for the feedback 🌟', 'success');
      return;
    }
    setSubmitting(true);
    const filled = [stars.overall, stars.atmosphere, stars.organisation].filter(v => v > 0);
    const avgRating = Math.round(filled.reduce((a, b) => a + b, 0) / filled.length);
    const { error } = await supabase.from('event_ratings').upsert({
      event_id: eventId,
      user_id: user.id,
      rating: avgRating,
      review: review.trim() || null,
    }, { onConflict: 'event_id,user_id' });
    setSubmitting(false);
    if (!error) {
      setSubmitted(true);
      toast.show('Gruv rated! Thanks for the feedback 🌟', 'success');
    } else {
      toast.show('Failed to submit rating.', 'error');
    }
  };

  if (submitted) {
    return (
      <View style={[styles.container, { borderTopColor: `${primary}18` }]}>
        <View style={styles.thanks}>
          <Text style={{ fontSize: 32 }}>🌟</Text>
          <Text style={[styles.thanksText, { color: primary }]}>Rating submitted!</Text>
          <Text style={[styles.thanksSub, { color: muted }]}>Your feedback helps the organiser.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { borderTopColor: `${primary}18` }]}>
      <Text style={[styles.title, { color: textColor }]}>Rate this Gruv</Text>

      {RATING_CATEGORIES.map(cat => (
        <View key={cat.key} style={styles.catRow}>
          <Text style={[styles.catLabel, { color: muted }]}>{cat.label}</Text>
          <StarRow
            value={stars[cat.key]}
            onChange={v => setStars(prev => ({ ...prev, [cat.key]: v }))}
            color={primary}
          />
        </View>
      ))}

      <TextInput
        style={[styles.reviewInput, { color: textColor, borderColor: `${primary}30` }]}
        placeholder="Tell the organiser what you thought..."
        placeholderTextColor={muted}
        multiline
        numberOfLines={2}
        value={review}
        onChangeText={setReview}
        maxLength={300}
      />

      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: primary }, submitting && styles.disabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting
          ? <ActivityIndicator color="#000" size="small" />
          : <Text style={styles.submitText}>Submit Feedback</Text>
        }
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10, borderTopWidth: 1 },
  title: { fontSize: 12, fontWeight: '800', marginBottom: 12 },
  catRow: { marginBottom: 10 },
  catLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  star: { fontSize: 24 },
  starLabel: { fontSize: 13, fontWeight: '800', marginLeft: 6 },
  reviewInput: {
    borderWidth: 1, borderRadius: 10,
    padding: 10, fontSize: 13,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 12, textAlignVertical: 'top',
  },
  submitBtn: { paddingVertical: 12, borderRadius: 25, alignItems: 'center' },
  submitText: { color: '#000', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
  disabled: { opacity: 0.6 },
  thanks: { alignItems: 'center', paddingVertical: 14 },
  thanksText: { fontSize: 16, fontWeight: '800', marginTop: 8 },
  thanksSub: { fontSize: 12, marginTop: 4 },
});
