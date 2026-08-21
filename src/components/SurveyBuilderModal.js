/**
 * SurveyBuilderModal — business side of drip surveys (data: 19_business_surveys,
 * service: services/surveys.js). Two views in one modal:
 *
 *   LIST    — your surveys with live anonymous results (votes per answer),
 *             pause/resume, and a "new question" button.
 *   COMPOSE — one question, answer type (single / multi / text), options,
 *             XP thank-you and optional expiry. No money moves — reward is XP.
 *
 * Audience targeting reuses the events.audience JSONB shape; v1 ships untargeted
 * (everyone) — the matching engine already filters per-profile on delivery.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity,
  TextInput, Platform, KeyboardAvoidingView, ActivityIndicator, Switch,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';
import { haptics } from '../utils/haptics';
import { useBackClose } from '../hooks/useBackClose';
import { createSurvey, listMySurveys, setSurveyActive, getSurveyResults } from '../services/surveys';

const ANSWER_TYPES = [
  { key: 'single', label: 'One choice', icon: 'check-circle' },
  { key: 'multi', label: 'Multi choice', icon: 'check-square' },
  { key: 'text', label: 'Free text', icon: 'edit-3' },
];

const ResultsBar = ({ answer, votes, total, primary, textColor, muted }) => {
  const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
  return (
    <View style={{ marginBottom: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
        <Text style={{ color: textColor, fontSize: 11, fontWeight: '700' }} numberOfLines={1}>{answer}</Text>
        <Text style={{ color: muted, fontSize: 10 }}>{votes} · {pct}%</Text>
      </View>
      <View style={{ height: 5, borderRadius: 3, backgroundColor: `${primary}15`, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', borderRadius: 3, backgroundColor: primary }} />
      </View>
    </View>
  );
};

export const SurveyBuilderModal = ({ visible, onClose }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  useBackClose(visible, onClose);

  const primary = currentTheme?.primary || '#00f2ff';
  const bg = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const surface = currentTheme?.surface || '#131a1c';

  const [view, setView] = useState('list'); // 'list' | 'compose'
  const [mine, setMine] = useState([]);
  const [results, setResults] = useState({}); // surveyId → [{answer, votes}]
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Compose state
  const [question, setQuestion] = useState('');
  const [answerType, setAnswerType] = useState('single');
  const [options, setOptions] = useState(['', '']);
  const [rewardXp, setRewardXp] = useState('5');
  const [expiresDays, setExpiresDays] = useState('14');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const rows = await listMySurveys(user.id);
      setMine(rows);
      const agg = {};
      await Promise.all(rows.slice(0, 20).map(async (s) => {
        agg[s.id] = await getSurveyResults(s.id);
      }));
      setResults(agg);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { if (visible) { setView('list'); load(); } }, [visible, load]);

  const resetCompose = () => {
    setQuestion(''); setAnswerType('single'); setOptions(['', '']);
    setRewardXp('5'); setExpiresDays('14');
  };

  const save = async () => {
    const q = question.trim();
    if (!q) { toast.show('Ask a question first', 'error'); return; }
    const opts = options.map(o => o.trim()).filter(Boolean);
    if (answerType !== 'text' && opts.length < 2) {
      toast.show('Give people at least 2 options', 'error'); return;
    }
    setSaving(true);
    try {
      const days = parseInt(expiresDays, 10);
      const created = await createSurvey(user.id, {
        question: q,
        answerType,
        options: answerType === 'text' ? [] : opts,
        rewardXp: Math.max(0, Math.min(50, parseInt(rewardXp, 10) || 0)),
        expiresAt: days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null,
      });
      if (!created) { toast.show('Could not create the survey — is the surveys table migrated?', 'error'); return; }
      haptics.success();
      toast.show('Question is live — answers drip in anonymously 🎉', 'success');
      resetCompose();
      setView('list');
      load();
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s) => {
    const ok = await setSurveyActive(s.id, !s.is_active);
    if (ok) setMine(prev => prev.map(x => x.id === s.id ? { ...x, is_active: !s.is_active } : x));
  };

  const setOpt = (i, v) => setOptions(prev => prev.map((o, idx) => (idx === i ? v : o)));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={sb.overlay}>
        <View style={[sb.sheet, { backgroundColor: bg, borderColor: `${primary}25` }]}>
          {/* Header */}
          <View style={sb.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {view === 'compose' && (
                <TouchableOpacity onPress={() => setView('list')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="arrow-left" size={18} color={textColor} />
                </TouchableOpacity>
              )}
              <Text style={[sb.title, { color: textColor }]}>
                {view === 'list' ? 'Drip Surveys' : 'New Question'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={20} color={muted} />
            </TouchableOpacity>
          </View>
          <Text style={[sb.sub, { color: muted }]}>
            {view === 'list'
              ? 'One question at a time, served gently to the right Vibers. Results are anonymous.'
              : 'Keep it short — Vibers answer in one tap.'}
          </Text>

          {view === 'list' ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <TouchableOpacity
                onPress={() => setView('compose')}
                activeOpacity={0.85}
                style={[sb.newBtn, { backgroundColor: primary }]}
              >
                <Feather name="plus" size={15} color="#000" />
                <Text style={sb.newBtnText}>ASK THE COMMUNITY</Text>
              </TouchableOpacity>

              {loading ? (
                <ActivityIndicator color={primary} style={{ marginTop: 28 }} />
              ) : mine.length === 0 ? (
                <View style={sb.empty}>
                  <Feather name="message-square" size={34} color={muted} />
                  <Text style={[sb.emptyTitle, { color: textColor }]}>No questions yet</Text>
                  <Text style={[sb.emptyBody, { color: muted }]}>
                    Ask what your crowd wants — genres, drinks, ticket prices, venues — and watch anonymous answers drip in.
                  </Text>
                </View>
              ) : mine.map((s) => {
                const r = results[s.id] || [];
                const total = r.reduce((sum, row) => sum + Number(row.votes || 0), 0);
                return (
                  <View key={s.id} style={[sb.surveyRow, { borderColor: `${primary}20`, backgroundColor: surface }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={[sb.q, { color: textColor, flex: 1 }]} numberOfLines={2}>{s.question}</Text>
                      <Switch
                        value={!!s.is_active}
                        onValueChange={() => toggleActive(s)}
                        trackColor={{ false: '#3f3f46', true: `${primary}80` }}
                        thumbColor={s.is_active ? primary : '#9ca3af'}
                      />
                    </View>
                    <Text style={[sb.meta, { color: muted }]}>
                      {total} answer{total !== 1 ? 's' : ''} · {s.answer_type === 'text' ? 'free text' : `${(s.options || []).length} options`}
                      {s.reward_xp > 0 ? ` · +${s.reward_xp} XP` : ''}
                      {s.expires_at ? ` · ends ${new Date(s.expires_at).toLocaleDateString()}` : ''}
                      {!s.is_active ? ' · PAUSED' : ''}
                    </Text>
                    {r.length > 0 && s.answer_type !== 'text' && (
                      <View style={{ marginTop: 8 }}>
                        {r.slice(0, 6).map((row) => (
                          <ResultsBar key={row.answer} answer={row.answer} votes={Number(row.votes || 0)} total={total}
                            primary={primary} textColor={textColor} muted={muted} />
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={[sb.label, { color: muted }]}>QUESTION</Text>
              <TextInput
                value={question}
                onChangeText={setQuestion}
                placeholder="e.g. Which genre should headline our next Gruv?"
                placeholderTextColor={muted}
                style={[sb.input, { color: textColor, borderColor: `${primary}30` }]}
                maxLength={160}
                multiline
              />

              <Text style={[sb.label, { color: muted }]}>ANSWER TYPE</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {ANSWER_TYPES.map((t) => {
                  const on = answerType === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      onPress={() => setAnswerType(t.key)}
                      style={[sb.typeChip, { borderColor: on ? primary : `${primary}30`, backgroundColor: on ? `${primary}18` : 'transparent' }]}
                    >
                      <Feather name={t.icon} size={12} color={on ? primary : muted} />
                      <Text style={{ color: on ? primary : muted, fontSize: 11, fontWeight: '800' }}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {answerType !== 'text' && (
                <>
                  <Text style={[sb.label, { color: muted }]}>OPTIONS (2–6)</Text>
                  {options.map((opt, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <TextInput
                        value={opt}
                        onChangeText={(v) => setOpt(i, v)}
                        placeholder={`Option ${i + 1}`}
                        placeholderTextColor={muted}
                        style={[sb.input, { color: textColor, borderColor: `${primary}30`, flex: 1, marginBottom: 0 }]}
                        maxLength={60}
                      />
                      {options.length > 2 && (
                        <TouchableOpacity onPress={() => setOptions(prev => prev.filter((_, idx) => idx !== i))}>
                          <Feather name="trash-2" size={15} color={muted} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                  {options.length < 6 && (
                    <TouchableOpacity onPress={() => setOptions(prev => [...prev, ''])} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                      <Feather name="plus-circle" size={14} color={primary} />
                      <Text style={{ color: primary, fontSize: 12, fontWeight: '800' }}>Add option</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[sb.label, { color: muted }]}>THANK-YOU XP (0–50)</Text>
                  <TextInput
                    value={rewardXp}
                    onChangeText={setRewardXp}
                    keyboardType="number-pad"
                    placeholder="5"
                    placeholderTextColor={muted}
                    style={[sb.input, { color: textColor, borderColor: `${primary}30` }]}
                    maxLength={2}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[sb.label, { color: muted }]}>RUNS FOR (DAYS)</Text>
                  <TextInput
                    value={expiresDays}
                    onChangeText={setExpiresDays}
                    keyboardType="number-pad"
                    placeholder="14"
                    placeholderTextColor={muted}
                    style={[sb.input, { color: textColor, borderColor: `${primary}30` }]}
                    maxLength={3}
                  />
                </View>
              </View>

              <TouchableOpacity
                onPress={save}
                disabled={saving}
                activeOpacity={0.85}
                style={[sb.saveBtn, { backgroundColor: primary, opacity: saving ? 0.6 : 1 }]}
              >
                {saving
                  ? <ActivityIndicator color="#000" />
                  : <>
                      <Feather name="send" size={15} color="#000" />
                      <Text style={sb.saveBtnText}>GO LIVE</Text>
                    </>}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const sb = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '88%', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, padding: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 17, fontWeight: '900' },
  sub: { fontSize: 11.5, marginTop: 4, marginBottom: 14, lineHeight: 16 },
  newBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14, marginBottom: 14 },
  newBtnText: { color: '#000', fontSize: 12, fontWeight: '900', letterSpacing: 0.6 },
  empty: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyTitle: { fontSize: 14, fontWeight: '900' },
  emptyBody: { fontSize: 12, textAlign: 'center', lineHeight: 17, paddingHorizontal: 20 },
  surveyRow: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10 },
  q: { fontSize: 13.5, fontWeight: '800', lineHeight: 18, marginRight: 8 },
  meta: { fontSize: 10.5, marginTop: 4 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, marginBottom: 14 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, marginTop: 6 },
  saveBtnText: { color: '#000', fontSize: 13, fontWeight: '900', letterSpacing: 0.6 },
});

export default SurveyBuilderModal;