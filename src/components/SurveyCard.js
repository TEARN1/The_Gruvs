/**
 * SurveyCard — the drip-survey prompt. Shows AT MOST one unanswered business
 * question the user is eligible for (audience match), then goes quiet for
 * SURVEY_COOLDOWN_HOURS. Renders nothing when there's no eligible question,
 * when the surveys table isn't migrated yet, or while offline.
 *
 * Answer types: 'single' (tap = submit), 'multi' (toggle + send), 'text'.
 * reward_xp is a non-cash thank-you (no money movement, per project rules).
 */
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { haptics } from '../utils/haptics';
import { getNextSurvey, submitSurveyResponse } from '../services/surveys';

export const SurveyCard = ({
  primary = '#00f2ff', textColor = '#fff',
  muted = 'rgba(255,255,255,0.55)', surface = 'rgba(255,255,255,0.05)',
}) => {
  const { user } = useAuth();
  const [survey, setSurvey] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [freeText, setFreeText] = useState('');
  const [sending, setSending] = useState(false);
  const [thanked, setThanked] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    if (!user) { setSurvey(null); return; }
    getNextSurvey(user.id).then((s) => {
      if (!alive || !s) return;
      setSurvey(s);
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
    return () => { alive = false; };
  }, [user, fade]);

  if (!user || !survey) return null;

  const submit = async (answer) => {
    if (sending) return;
    setSending(true);
    try {
      const ok = await submitSurveyResponse(survey.id, user.id, answer);
      if (ok) {
        try { haptics.success?.(); } catch {}
        setThanked(true);
        setTimeout(() => setSurvey(null), 1600); // brief thank-you, then gone
      }
    } finally {
      setSending(false);
    }
  };

  const skip = async () => {
    submitSurveyResponse(survey.id, user.id, [], { skipped: true });
    setSurvey(null);
  };

  const togglePick = (opt) => {
    try { haptics.select?.(); } catch {}
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(opt)) n.delete(opt);
      else { if (survey.answer_type === 'single') n.clear(); n.add(opt); }
      return n;
    });
    if (survey.answer_type === 'single') submit([opt]);
  };

  const options = Array.isArray(survey.options) ? survey.options : [];
  const isMulti = survey.answer_type === 'multi';
  const isText = survey.answer_type === 'text';

  return (
    <Animated.View style={[sc.wrap, { opacity: fade, borderColor: `${primary}30`, backgroundColor: surface }]}>
      {thanked ? (
        <View style={sc.thanksRow}>
          <Feather name="check-circle" size={18} color="#10b981" />
          <Text style={[sc.thanksText, { color: textColor }]}>
            Answered{survey.reward_xp > 0 ? ` — +${survey.reward_xp} XP` : ''} 🎉
          </Text>
        </View>
      ) : (
        <>
          <View style={sc.topRow}>
            <View style={[sc.tag, { backgroundColor: `${primary}18` }]}>
              <Feather name="message-square" size={10} color={primary} />
              <Text style={[sc.tagText, { color: primary }]}>COMMUNITY QUESTION</Text>
            </View>
            {survey.reward_xp > 0 && (
              <Text style={[sc.xp, { color: '#f59e0b' }]}>+{survey.reward_xp} XP</Text>
            )}
          </View>

          <Text style={[sc.question, { color: textColor }]}>{survey.question}</Text>

          {isText ? (
            <View style={sc.textRow}>
              <TextInput
                value={freeText}
                onChangeText={setFreeText}
                placeholder="Type your answer…"
                placeholderTextColor={muted}
                style={[sc.input, { color: textColor, borderColor: `${primary}30` }]}
                maxLength={280}
                multiline
              />
              <TouchableOpacity
                onPress={() => freeText.trim() && submit([freeText.trim()])}
                disabled={sending || !freeText.trim()}
                style={[sc.sendBtn, { backgroundColor: freeText.trim() ? primary : `${primary}30` }]}
                accessibilityRole="button"
                accessibilityLabel="Send answer"
              >
                <Feather name="send" size={14} color="#000" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={sc.optWrap}>
              {options.map((opt) => {
                const on = picked.has(opt);
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => togglePick(opt)}
                    disabled={sending}
                    style={[sc.opt, { borderColor: on ? primary : `${primary}30`, backgroundColor: on ? `${primary}20` : 'transparent' }]}
                  >
                    <Text style={{ color: on ? primary : textColor, fontSize: 12, fontWeight: '700' }}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={sc.bottomRow}>
            <TouchableOpacity onPress={skip} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[sc.skipText, { color: muted }]}>Not now</Text>
            </TouchableOpacity>
            {isMulti && picked.size > 0 && (
              <TouchableOpacity
                onPress={() => submit([...picked])}
                disabled={sending}
                style={[sc.submitBtn, { backgroundColor: primary }]}
              >
                <Text style={sc.submitText}>Send {picked.size > 1 ? `(${picked.size})` : ''}</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </Animated.View>
  );
};

const sc = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 20, padding: 14, borderRadius: 16, borderWidth: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tagText: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 },
  xp: { fontSize: 11, fontWeight: '900' },
  question: { fontSize: 14, fontWeight: '800', lineHeight: 20, marginBottom: 10 },
  optWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opt: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 18, borderWidth: 1 },
  textRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, minHeight: 38, maxHeight: 90 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  skipText: { fontSize: 11, fontWeight: '700' },
  submitBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12 },
  submitText: { color: '#000', fontSize: 11, fontWeight: '900' },
  thanksRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  thanksText: { fontSize: 13, fontWeight: '800' },
});

export default SurveyCard;