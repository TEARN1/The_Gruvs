/**
 * BirthDateNudge — the missing half of the age gate.
 *
 * `checkEventAge` deliberately FAILS OPEN when a user's age is unknown, because
 * blocking every adult who never set a birthday would be worse than the risk.
 * Its own comment says the UI should "nudge them to add a birthday" — this is
 * that nudge, which had never been built.
 *
 * It matters more than it looks. A signup bug meant the date of birth captured
 * at registration was silently discarded for every existing user, so the 18+
 * wall on alcohol/nightlife events has had nothing to check. New signups now
 * persist correctly; this is how the people who signed up before that get asked.
 *
 * Non-naggy: shows only when signed in AND no usable DOB exists on the profile.
 * A dismissal is remembered for 3 days — shorter than the notification nudge
 * (7 days) because this one is a legal gate, not a convenience.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { profileAge } from '../utils/ageGate';
import { resetViewerAge, loadViewerAge } from '../utils/viewerAge';
import { CalendarPicker } from './DateTimePickers';
import { useToast } from './ToastNotification';

const SNOOZE_KEY = '@gruvs_birthdate_nudge_snooze';
const SNOOZE_MS = 3 * 24 * 3600 * 1000;

// Open the picker on the most recent date that already clears 18 — the common
// case, and it saves an adult ~18 years of scrolling.
const defaultView = () => {
  const n = new Date();
  return new Date(n.getFullYear() - 18, n.getMonth(), n.getDate());
};

export const BirthDateNudge = ({
  primary = '#00f2ff', surface = '#131a1c',
  textColor = '#fff', muted = 'rgba(255,255,255,0.6)', style,
}) => {
  const { user, profile, refreshProfile } = useAuth();
  const { show: showToast } = useToast();
  const [show, setShow] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.id) { setShow(false); return; }
      try {
        const snoozedAt = Number(await AsyncStorage.getItem(SNOOZE_KEY)) || 0;
        if (Date.now() - snoozedAt < SNOOZE_MS) return;

        // The profile in context may not carry the DOB columns, so ask directly
        // rather than concluding "missing" from an absent field.
        const { data } = await supabase
          .from('profiles').select('birth_date, age, birth_year')
          .eq('id', user.id).maybeSingle();
        if (alive) setShow(profileAge(data) == null);
      } catch { /* stay hidden on any error — never nag on a failed lookup */ }
    })();
    return () => { alive = false; };
  }, [user?.id, profile?.birth_date]);

  const saveDob = useCallback(async (d) => {
    setPickerOpen(false);
    if (!(d instanceof Date) || !user?.id) return;

    const age = profileAge({ birth_date: d.toISOString().split('T')[0] });
    if (age == null || age < 13) {
      // 13 is the floor for holding an account at all; below it this is not a
      // nudge problem, and silently storing the date would be the wrong move.
      showToast('That date doesn’t look right — please check it.', 'error');
      return;
    }

    setSaving(true);
    try {
      const iso = d.toISOString().split('T')[0];
      const { error } = await supabase
        .from('profiles')
        .update({ birth_date: iso, birth_year: d.getFullYear() })
        .eq('id', user.id);
      if (error) throw error;

      // Re-read the cached viewer age immediately: the content filter treats an
      // unknown age as "general only", so without this the user would have to
      // restart the app before mature listings appeared.
      resetViewerAge();
      await loadViewerAge(user.id);
      refreshProfile?.();

      showToast('Birthday saved — thanks 🎂', 'success');
      setShow(false);
    } catch {
      showToast('Could not save your birthday. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  }, [user?.id, refreshProfile, showToast]);

  const dismiss = useCallback(async () => {
    try { await AsyncStorage.setItem(SNOOZE_KEY, String(Date.now())); } catch {}
    setShow(false);
  }, []);

  if (!show) return null;

  return (
    <>
      <View style={[bd.card, { backgroundColor: surface, borderColor: `${primary}40` }, style]}>
        <View style={[bd.icon, { backgroundColor: `${primary}18` }]}>
          <Feather name="gift" size={16} color={primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[bd.title, { color: textColor }]}>Add your birthday</Text>
          <Text style={[bd.body, { color: muted }]} numberOfLines={2}>
            It unlocks 18+ Gruvs, and puts you on the map when your day comes around.
          </Text>
        </View>
        <View style={bd.actions}>
          <TouchableOpacity
            style={[bd.cta, { backgroundColor: primary }]}
            onPress={() => setPickerOpen(true)}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Add your birthday"
          >
            {saving
              ? <ActivityIndicator size="small" color="#000" />
              : <Text style={bd.ctaText}>Add</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={bd.dismissBtn} onPress={dismiss} accessibilityLabel="Dismiss">
            <Feather name="x" size={15} color={muted} />
          </TouchableOpacity>
        </View>
      </View>

      <CalendarPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        value={defaultView()}
        onConfirm={saveDob}
        dimPast={false}
        primary={primary}
        bg={surface}
        textColor={textColor}
        muted={muted}
      />
    </>
  );
};

const bd = StyleSheet.create({
  card:       { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12, marginHorizontal: 16, marginBottom: 10 },
  icon:       { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: 13, fontWeight: '900' },
  body:       { fontSize: 11, marginTop: 2, lineHeight: 15 },
  actions:    { alignItems: 'center', gap: 4 },
  cta:        { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9, minWidth: 46, alignItems: 'center' },
  ctaText:    { color: '#000', fontWeight: '900', fontSize: 12 },
  dismissBtn: { padding: 4 },
});

export default BirthDateNudge;
