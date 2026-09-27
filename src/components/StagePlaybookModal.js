/**
 * StagePlaybookModal — the easy way for a business to run offers across an
 * event's life. Instead of building three separate campaigns, the owner fills in
 * one short offer for each stage — BEFORE · DURING · AFTER — and publishes them
 * in one tap. Each enabled stage becomes a live, phase-targeted ad_campaign that
 * EventContextualAds surfaces at exactly the right moment (src/utils/eventPhase).
 *
 * Pre-filled with sensible defaults per stage so a business can ship in seconds.
 */
import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Switch, ActivityIndicator, Platform,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { supabase } from '../services/supabase';
import { resilient } from '../utils/resilience';
import { PHASE_META } from '../utils/eventPhase';

// Stage defaults — what a typical offer looks like at each point of the night.
const STAGES = [
  {
    key: 'pre_event',
    blurb: 'Reach people planning their night — tickets, outfits, pre-drinks, rides.',
    headline: 'Get ready for the night',
    cta_text: 'Plan ahead',
    campaign_type: 'gruv_promo',
  },
  {
    key: 'during_event',
    blurb: "They're out right now — food, drinks, merch, your stall, upgrades.",
    headline: "We're here at the Gruv",
    cta_text: 'Find us',
    campaign_type: 'awareness',
  },
  {
    key: 'post_event',
    blurb: 'The night winds down — after-party, late-night food, rides home, next time.',
    headline: 'Keep the night going',
    cta_text: 'See more',
    campaign_type: 'engagement',
  },
];

const StageBlock = ({ stage, state, onChange, primary, textColor, muted, surface }) => {
  const meta = PHASE_META[stage.key] || {};
  const accent = meta.color || primary;
  return (
    <View style={[s.block, { borderColor: state.enabled ? `${accent}55` : 'rgba(255,255,255,0.10)', backgroundColor: surface }]}>
      <View style={s.blockHead}>
        <View style={[s.badge, { backgroundColor: `${accent}18`, borderColor: `${accent}40` }]}>
          <Feather name={meta.icon || 'tag'} size={12} color={accent} />
          <Text style={[s.badgeText, { color: accent }]}>{meta.label || stage.key}</Text>
        </View>
        <Switch
          value={state.enabled}
          onValueChange={v => onChange({ ...state, enabled: v })}
          trackColor={{ false: 'rgba(255,255,255,0.15)', true: `${accent}80` }}
          thumbColor={state.enabled ? accent : '#888'}
        />
      </View>
      <Text style={[s.blurb, { color: muted }]}>{stage.blurb}</Text>

      {state.enabled && (
        <View style={{ marginTop: 10, gap: 8 }}>
          <TextInput
            value={state.headline}
            onChangeText={t => onChange({ ...state, headline: t })}
            placeholder="Offer headline"
            placeholderTextColor={muted}
            style={[s.input, { color: textColor, borderColor: `${accent}30` }]}
            maxLength={60}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={state.cta_text}
              onChangeText={t => onChange({ ...state, cta_text: t })}
              placeholder="Button text"
              placeholderTextColor={muted}
              style={[s.input, { color: textColor, borderColor: `${accent}30`, flex: 1 }]}
              maxLength={24}
            />
            <TextInput
              value={state.cta_url}
              onChangeText={t => onChange({ ...state, cta_url: t })}
              placeholder="Link (optional)"
              placeholderTextColor={muted}
              autoCapitalize="none"
              style={[s.input, { color: textColor, borderColor: `${accent}30`, flex: 1.4 }]}
            />
          </View>
        </View>
      )}
    </View>
  );
};

export const StagePlaybookModal = ({ visible, onClose, businessId, onSaved, primary = '#00f2ff', textColor = '#fff', muted = 'rgba(255,255,255,0.5)', bg = '#0d1112', surface = 'rgba(255,255,255,0.06)' }) => {
  const [stageState, setStageState] = useState(() =>
    STAGES.reduce((acc, st) => {
      acc[st.key] = { enabled: true, headline: st.headline, cta_text: st.cta_text, cta_url: '' };
      return acc;
    }, {})
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const enabledCount = STAGES.filter(st => stageState[st.key]?.enabled).length;

  const publish = async () => {
    if (!businessId) { setError('No business profile loaded.'); return; }
    const chosen = STAGES.filter(st => {
      const s = stageState[st.key];
      return s?.enabled && s.headline.trim();
    });
    if (!chosen.length) { setError('Enable at least one stage and add a headline.'); return; }

    setSaving(true);
    setError(null);
    try {
      // One live, phase-targeted campaign per enabled stage.
      const rows = chosen.map(st => {
        const s = stageState[st.key];
        const label = (PHASE_META[st.key]?.label || st.key);
        return {
          business_id: businessId,
          name: `${label} offer`,
          campaign_type: st.campaign_type,
          headline: s.headline.trim(),
          subline: st.blurb,
          cta_text: s.cta_text.trim() || 'Learn More',
          cta_url: s.cta_url.trim() || '',
          budget_total: 0,
          status: 'active',
          targeting: { event_phases: [st.key] },
        };
      });

      const ok = await resilient(
        [
          async () => { const { error } = await supabase.from('ad_campaigns').insert(rows); if (error) throw error; return true; },
          async () => { const { error } = await supabase.from('ad_campaigns').upsert(rows); if (error) throw error; return true; },
          // Last resort: insert one-by-one so a single bad row can't sink the batch.
          async () => {
            for (const r of rows) { const { error } = await supabase.from('ad_campaigns').insert(r); if (error) throw error; }
            return true;
          },
        ],
        { attemptsPerTier: 2, baseMs: 400, label: 'StagePlaybook.publish', fallbackValue: null }
      );
      if (ok === null) { setError('Could not publish. Please try again.'); return; }
      onSaved?.(chosen.length);
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: bg }]}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { color: textColor }]}>Stage Playbook</Text>
              <Text style={[s.subtitle, { color: muted }]}>One offer for each part of the night — published in a tap.</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={22} color={muted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 12, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
            {STAGES.map(st => (
              <StageBlock
                key={st.key}
                stage={st}
                state={stageState[st.key]}
                onChange={ns => setStageState(prev => ({ ...prev, [st.key]: ns }))}
                primary={primary} textColor={textColor} muted={muted} surface={surface}
              />
            ))}
          </ScrollView>

          {error && <Text style={[s.error]}>{error}</Text>}

          <TouchableOpacity
            style={[s.publish, { backgroundColor: enabledCount ? primary : 'rgba(255,255,255,0.15)' }]}
            onPress={publish}
            disabled={saving || !enabledCount}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#000" />
              : <Text style={s.publishText}>{enabledCount ? `Publish ${enabledCount} stage offer${enabledCount > 1 ? 's' : ''}` : 'Enable a stage'}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: Platform.OS === 'ios' ? 34 : 18 },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  title: { fontSize: 19, fontWeight: '900' },
  subtitle: { fontSize: 12.5, fontWeight: '500', marginTop: 2, paddingRight: 12 },
  block: { borderWidth: 1, borderRadius: 16, padding: 14 },
  blockHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  badgeText: { fontSize: 10.5, fontWeight: '900', letterSpacing: 0.5 },
  blurb: { fontSize: 12, fontWeight: '500', marginTop: 8, lineHeight: 16 },
  input: { borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, fontWeight: '600' },
  error: { color: '#ef4444', fontSize: 12.5, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  publish: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 14 },
  publishText: { color: '#000', fontSize: 15, fontWeight: '900' },
});

export default StagePlaybookModal;
