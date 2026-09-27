/**
 * EventFollowButton — follow/unfollow any event (music, sport, conference, etc.)
 * Writes to event_followers and respects per-type notification preferences.
 * Works for both sport_event_followers (sport) and event_followers (all others).
 */
import React, { useState, useEffect } from 'react';
import {
  TouchableOpacity, Text, View, StyleSheet, Modal,
  Switch, Platform, ActivityIndicator,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { supabase, isSupabaseEnabled } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const DEFAULT_SPORT_PREFS = { notify_goals: true, notify_results: true, notify_fixtures: true };
const DEFAULT_EVENT_PREFS = { notify_lineup: true, notify_updates: true, notify_nowplaying: true, notify_results: true };

export const EventFollowButton = ({ eventId, isSport = false, teamId = null, style }) => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const primary = colors?.primary || "#00f2ff";
  const bg = colors?.card || '#111';
  const textColor = colors?.text || '#fff';
  const muted = colors?.muted || 'rgba(255,255,255,0.5)';

  const table = isSport ? 'sport_event_followers' : 'event_followers';

  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [prefs, setPrefs] = useState(isSport ? DEFAULT_SPORT_PREFS : DEFAULT_EVENT_PREFS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !eventId || !isSupabaseEnabled) { setLoading(false); return; }
    supabase
      .from(table)
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', user?.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) { setFollowing(true); setPrefs(p => ({ ...p, ...data })); }
        setLoading(false);
      });
  }, [eventId, user?.id]);

  const toggle = async () => {
    if (!user || !isSupabaseEnabled) return;
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}

    const next = !following;
    setFollowing(next); // optimistic

    // A Supabase write resolves (not rejects) on RLS/constraint errors — we MUST
    // inspect `error` and revert, otherwise the button sticks on the new state
    // while nothing actually saved (and reverts anyway on the next reload).
    let error;
    if (next) {
      const row = { event_id: eventId, user_id: user?.id, ...prefs };
      if (isSport && teamId) row.team_id = teamId;
      ({ error } = await supabase.from(table).upsert(row, { onConflict: 'event_id,user_id' }));
    } else {
      ({ error } = await supabase.from(table).delete().eq('event_id', eventId).eq('user_id', user?.id));
    }

    if (error) {
      console.error('[EventFollowButton] toggle failed', error);
      setFollowing(!next); // revert — the write didn't persist
    }
  };

  const savePrefs = async () => {
    if (!user || !isSupabaseEnabled) return;
    setSaving(true);
    try {
      await supabase.from(table).upsert(
        { event_id: eventId, user_id: user?.id, ...prefs },
        { onConflict: 'event_id,user_id' }
      );
      setPrefsOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;
  if (loading) return <ActivityIndicator size="small" color={primary} style={style} />;

  const prefKeys = isSport
    ? [
        { key: 'notify_goals',    label: 'Goals & tries' },
        { key: 'notify_results',  label: 'Match results' },
        { key: 'notify_fixtures', label: 'New fixtures' },
      ]
    : [
        { key: 'notify_lineup',     label: 'Lineup changes' },
        { key: 'notify_nowplaying', label: 'Now playing' },
        { key: 'notify_updates',    label: 'Announcements' },
        { key: 'notify_results',    label: 'Results & awards' },
      ];

  return (
    <>
      <View style={[s.row, style]}>
        <TouchableOpacity
          style={[s.btn, { backgroundColor: following ? primary : `${primary}20`, borderColor: primary }]}
          onPress={toggle}
          activeOpacity={0.8}
          accessibilityLabel={following ? 'Unfollow event' : 'Follow event'}
        >
          <Feather name={following ? 'bell' : 'bell-off'} size={14} color={following ? '#000' : primary} />
          <Text style={[s.label, { color: following ? '#000' : primary }]}>
            {following ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>

        {following && (
          <TouchableOpacity
            style={[s.prefsBtn, { borderColor: `${primary}40`, backgroundColor: `${primary}10` }]}
            onPress={() => setPrefsOpen(true)}
            accessibilityLabel="Notification preferences"
          >
            <Feather name="settings" size={14} color={primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Notification prefs modal */}
      <Modal visible={prefsOpen} transparent animationType="fade" onRequestClose={() => setPrefsOpen(false)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setPrefsOpen(false)} />
        <View style={[s.sheet, { backgroundColor: bg }]}>
          <Text style={[s.sheetTitle, { color: textColor }]}>Notify me about</Text>
          {prefKeys.map(({ key, label }) => (
            <View key={key} style={s.prefRow}>
              <Text style={[s.prefLabel, { color: textColor }]}>{label}</Text>
              <Switch
                value={!!prefs[key]}
                onValueChange={v => setPrefs(p => ({ ...p, [key]: v }))}
                trackColor={{ true: primary, false: `${primary}30` }}
                thumbColor={Platform.OS === 'android' ? primary : undefined}
              />
            </View>
          ))}
          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: primary }]}
            onPress={savePrefs}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color="#000" />
              : <Text style={s.saveBtnText}>Save</Text>
            }
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
};

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  label: { fontSize: 13, fontWeight: '800' },
  prefsBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16 },
  sheetTitle: { fontSize: 17, fontWeight: '900', marginBottom: 4 },
  prefRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  prefLabel: { fontSize: 14, fontWeight: '600' },
  saveBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { fontSize: 15, fontWeight: '900', color: '#000' },
});
