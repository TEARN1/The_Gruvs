import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { GlassView } from './GlassView';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { resilient } from '../utils/resilience';
import { SecurityService } from '../services/securityService';
import { useBackClose } from '../hooks/useBackClose';

const REASONS = [
  'Misleading information',
  'Inappropriate content',
  'Spam or fake event',
  'Hate speech',
  'Safety concern',
  'Copyright violation',
  'Other',
];

export const ReportModal = ({ visible, onClose, targetId, targetType = 'event' }) => {
  useBackClose(visible, onClose);
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const primary   = currentTheme?.primary    || "#00f2ff";
  const bg        = currentTheme?.background || "#0d1112";
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  const handleClose = () => {
    setSelected(null);
    setDetails('');
    setDone(false);
    setErrorMsg('');
    onClose();
  };

  const submit = async () => {
    if (!selected || !user) return;
    // Rate-limit: reporting is genuinely infrequent, so a burst is either abuse
    // or weaponised mass-reporting (#308). 8 per 5 min is generous for a real
    // user. The same-target dedup (onConflict below) already stops repeat spam of
    // one target; this stops flooding across many.
    const rl = SecurityService.rateLimitCheck(`report:${user.id}`, { maxPerWindow: 8, windowMs: 5 * 60_000 });
    if (!rl.allowed) { setErrorMsg(rl.message); return; }
    setErrorMsg('');
    setSubmitting(true);
    try {
      const payload = { reporter_id: user?.id, target_id: targetId, target_type: targetType, reason: selected, details: details.trim() || null };
      await resilient(
        [
          () => supabase.from('reports').insert(payload),
          () => supabase.from('reports').upsert(payload, { onConflict: 'reporter_id,target_id,target_type', ignoreDuplicates: true }),
          () => supabase.rpc('submit_report', { p_reporter_id: user?.id, p_target_id: targetId, p_target_type: targetType, p_reason: selected }),
        ],
        { attemptsPerTier: 2, baseMs: 300, label: `ReportModal.submit:${targetId}`, fallbackValue: null }
      );
      setDone(true);
    } catch { /* report failed silently — UI stays open so user can retry */ }
    finally { setSubmitting(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={s.overlay}>
        <GlassView style={[s.sheet, { backgroundColor: `${bg}F5` }]}>
          <View style={[s.pill, { backgroundColor: `${primary}40` }]} />

          <View style={s.header}>
            <Text style={[s.title, { color: "#ef4444" }]}>
              <Feather name="flag" size={16} color="#ef4444" /> Report {targetType === 'event' ? 'Event' : 'User'}
            </Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={20} color={textColor} />
            </TouchableOpacity>
          </View>

          {done ? (
            <View style={s.doneWrap}>
              <Feather name="check-circle" size={48} color="#10b981" />
              <Text style={[s.doneTitle, { color: textColor }]}>Report Submitted</Text>
              <Text style={[s.doneSub, { color: muted }]}>
                Thank you. Our team will review this and take action if needed.
              </Text>
              <TouchableOpacity style={[s.submitBtn, { backgroundColor: primary }]} onPress={handleClose}>
                <Text style={s.submitText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={[s.label, { color: muted }]}>Select a reason</Text>
              {REASONS.map(r => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setSelected(r)}
                  style={[
                    s.reasonRow,
                    { borderColor: selected === r ? primary : `${primary}20` },
                    selected === r && { backgroundColor: `${primary}10` },
                  ]}
                >
                  <View style={[s.radio, { borderColor: selected === r ? primary : muted }]}>
                    {selected === r && <View style={[s.radioDot, { backgroundColor: primary }]} />}
                  </View>
                  <Text style={[s.reasonText, { color: selected === r ? textColor : muted }]}>{r}</Text>
                </TouchableOpacity>
              ))}

              <TextInput
                style={[s.input, { color: textColor, borderColor: `${primary}30` }]}
                placeholder="Additional details (optional)"
                placeholderTextColor={muted}
                value={details}
                onChangeText={setDetails}
                multiline
                numberOfLines={3}
                maxLength={300}
              />

              {!!errorMsg && <Text style={{ color: '#ef4444', fontSize: 12, marginBottom: 10, textAlign: 'center' }}>{errorMsg}</Text>}

              <TouchableOpacity
                style={[s.submitBtn, { backgroundColor: selected ? "#ef4444" : `rgba(239,68,68,0.3)` }]}
                onPress={submit}
                disabled={!selected || submitting}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.submitText}>Submit Report</Text>
                }
              </TouchableOpacity>
            </>
          )}
        </GlassView>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 },
  pill: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 17, fontWeight: '900' },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 9, height: 9, borderRadius: 5 },
  reasonText: { fontSize: 14 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 13, marginTop: 12, marginBottom: 16, minHeight: 80, textAlignVertical: 'top', backgroundColor: 'rgba(255,255,255,0.04)' },
  submitBtn: { paddingVertical: 15, borderRadius: 30, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  doneWrap: { alignItems: 'center', paddingVertical: 30, gap: 12 },
  doneTitle: { fontSize: 20, fontWeight: '900' },
  doneSub: { fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
});
