/**
 * GetHomeSafeModal — trusted contacts + the "someone knows where I am" check-in.
 *
 * Two screens in one sheet:
 *   • No active check-in → pick who to tell, where you are, and by when.
 *   • Active check-in    → a live countdown with one big "I'm home safe", and
 *                          an explicit "alert them now" once you're overdue.
 *
 * The copy is deliberately precise about what this does and doesn't do (the
 * message sends immediately and reliably; the reminder only nudges while the
 * app is open) — a safety feature must never imply cover it can't deliver.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';
import { useBackClose } from '../hooks/useBackClose';
import { SmartImage } from './SmartImage';
import { MessageManager } from '../services/dataFlow';
import {
  getTrustedContacts, addTrustedContact, removeTrustedContact,
  getActiveCheckIn, startCheckIn, completeCheckIn, raiseOverdueAlert, cancelCheckIn,
} from '../services/safetyCheckIn';

const PRESETS = [30, 60, 120, 180];

export function GetHomeSafeModal({ visible, onClose }) {
  useBackClose(visible, onClose);
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const primary   = currentTheme?.primary    || '#10b981';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  const [contacts, setContacts] = useState([]);
  const [people, setPeople] = useState([]);      // conversation partners to choose from
  const [active, setActive] = useState(null);
  const [place, setPlace] = useState('');
  const [minutes, setMinutes] = useState(60);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(async () => {
    setContacts(await getTrustedContacts());
    setActive(await getActiveCheckIn());
  }, []);

  useEffect(() => { if (visible) refresh(); }, [visible, refresh]);

  // People you already talk to — the realistic pool for "who would check on me".
  useEffect(() => {
    if (!visible || !user?.id) return;
    MessageManager.getConversations(user.id)
      .then((cs) => setPeople((cs || []).map((c) => c.partner).filter(Boolean)))
      .catch(() => setPeople([]));
  }, [visible, user?.id]);

  // Live countdown while a check-in is running.
  useEffect(() => {
    if (!visible || !active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [visible, active]);

  const toggleContact = async (p) => {
    const has = contacts.some((c) => c.id === p.id);
    setContacts(has ? await removeTrustedContact(p.id) : await addTrustedContact(p));
  };

  const begin = async () => {
    if (!contacts.length) { toast?.show('Pick at least one person to tell.', 'error'); return; }
    setBusy(true);
    const { ok, sent } = await startCheckIn({ userId: user?.id, contacts, placeLabel: place.trim(), minutes });
    setBusy(false);
    if (ok) { toast?.show(`${sent} ${sent === 1 ? 'person knows' : 'people know'} where you are 🛟`, 'success'); refresh(); }
    else toast?.show("Couldn't send the check-in — try again.", 'error');
  };

  const imHome = async () => {
    setBusy(true);
    await completeCheckIn({ userId: user?.id });
    setBusy(false);
    toast?.show('Home safe 💚', 'success');
    refresh();
    onClose?.();
  };

  const alertNow = async () => {
    setBusy(true);
    const { ok } = await raiseOverdueAlert({ userId: user?.id });
    setBusy(false);
    toast?.show(ok ? 'Your people have been alerted.' : "Couldn't send the alert.", ok ? 'success' : 'error');
  };

  const remaining = active ? active.dueAt - now : 0;
  const overdue = active && remaining <= 0;
  const mm = Math.floor(Math.abs(remaining) / 60000);
  const ss = Math.floor((Math.abs(remaining) % 60000) / 1000);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <View style={[s.sheet, { backgroundColor: bg }]}>
          <View style={s.handle} />
          <View style={s.header}>
            <Feather name="life-buoy" size={20} color={primary} />
            <Text style={[s.title, { color: textColor }]}>Get home safe</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close"><Feather name="x" size={22} color={muted} /></TouchableOpacity>
          </View>

          {active ? (
            // ── Active check-in ────────────────────────────────────────────
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[s.countdownBox, { borderColor: overdue ? '#ef4444' : `${primary}55`, backgroundColor: overdue ? 'rgba(239,68,68,0.08)' : `${primary}10` }]}>
                <Text style={[s.countdownLabel, { color: muted }]}>
                  {overdue ? 'Overdue by' : 'Checking in within'}
                </Text>
                <Text style={[s.countdown, { color: overdue ? '#ef4444' : primary }]}>
                  {mm}:{String(ss).padStart(2, '0')}
                </Text>
                <Text style={[s.countdownSub, { color: muted }]}>
                  {contacts.length ? `${contacts.map((c) => '@' + c.username).join(', ')} ${contacts.length === 1 ? 'is' : 'are'} expecting you` : 'Your people are expecting you'}
                </Text>
              </View>

              <TouchableOpacity onPress={imHome} disabled={busy} style={[s.primaryBtn, { backgroundColor: primary }]}>
                {busy ? <ActivityIndicator color="#000" /> : <Text style={s.primaryBtnText}>I'm home safe 💚</Text>}
              </TouchableOpacity>

              {overdue && (
                <TouchableOpacity onPress={alertNow} disabled={busy} style={[s.dangerBtn, { borderColor: '#ef4444' }]}>
                  <Feather name="alert-triangle" size={15} color="#ef4444" />
                  <Text style={s.dangerBtnText}>Alert them now</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={async () => { await cancelCheckIn(); refresh(); }} style={s.cancelRow}>
                <Text style={[s.cancelText, { color: muted }]}>Cancel this check-in</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            // ── Set one up ─────────────────────────────────────────────────
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[s.intro, { color: muted }]}>
                Tell someone you trust where you are and when you'll be back. They get a message
                straight away — so someone always knows.
              </Text>

              <Text style={[s.label, { color: textColor }]}>Who should know?</Text>
              {people.length === 0 ? (
                <Text style={[s.empty, { color: muted }]}>
                  Start a chat with someone first — your trusted contacts come from people you talk to.
                </Text>
              ) : (
                <View style={s.peopleWrap}>
                  {people.slice(0, 12).map((p) => {
                    const on = contacts.some((c) => c.id === p.id);
                    return (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => toggleContact(p)}
                        style={[s.person, { borderColor: on ? primary : `${primary}22`, backgroundColor: on ? `${primary}18` : 'transparent' }]}
                      >
                        {p.avatar_url
                          ? <SmartImage source={p.avatar_url} style={s.personAvatar} />
                          : <View style={[s.personAvatar, { backgroundColor: `${primary}22` }]} />}
                        <Text style={[s.personName, { color: on ? primary : textColor }]} numberOfLines={1}>@{p.username}</Text>
                        {on && <Feather name="check" size={13} color={primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Text style={[s.label, { color: textColor }]}>Where are you? <Text style={{ color: muted, fontWeight: '400' }}>(optional)</Text></Text>
              <TextInput
                value={place}
                onChangeText={setPlace}
                placeholder="e.g. Kitcheners, Braamfontein"
                placeholderTextColor={muted}
                maxLength={80}
                style={[s.input, { color: textColor, borderColor: `${primary}30` }]}
              />

              <Text style={[s.label, { color: textColor }]}>Home by</Text>
              <View style={s.presetRow}>
                {PRESETS.map((m) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setMinutes(m)}
                    style={[s.preset, { borderColor: minutes === m ? primary : `${primary}25`, backgroundColor: minutes === m ? `${primary}18` : 'transparent' }]}
                  >
                    <Text style={{ color: minutes === m ? primary : muted, fontWeight: '800', fontSize: 12 }}>
                      {m < 60 ? `${m} min` : `${m / 60} hr${m > 60 ? 's' : ''}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity onPress={begin} disabled={busy || !contacts.length} style={[s.primaryBtn, { backgroundColor: contacts.length ? primary : `${primary}35` }]}>
                {busy ? <ActivityIndicator color="#000" /> : <Text style={s.primaryBtnText}>Start check-in</Text>}
              </TouchableOpacity>

              {/* Never imply cover we can't deliver. */}
              <Text style={[s.fineprint, { color: muted }]}>
                The message sends immediately and doesn't depend on your phone staying on. The
                reminder to mark yourself safe only pops while The Gruvs is open — so tell someone
                who'd notice anyway.
              </Text>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, paddingBottom: 30, maxHeight: '90%' },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  title: { flex: 1, fontSize: 18, fontWeight: '900' },
  intro: { fontSize: 13, lineHeight: 19, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '800', marginTop: 14, marginBottom: 8 },
  empty: { fontSize: 12, lineHeight: 17 },
  peopleWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 10 },
  personAvatar: { width: 22, height: 22, borderRadius: 11 },
  personName: { fontSize: 12, fontWeight: '700', maxWidth: 110 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: { borderWidth: 1, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 14 },
  primaryBtn: { marginTop: 20, borderRadius: 26, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { color: '#000', fontWeight: '900', fontSize: 15 },
  dangerBtn: { marginTop: 10, borderRadius: 26, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, borderWidth: 1 },
  dangerBtnText: { color: '#ef4444', fontWeight: '900', fontSize: 14 },
  cancelRow: { marginTop: 14, alignItems: 'center' },
  cancelText: { fontSize: 12, fontWeight: '700' },
  countdownBox: { borderWidth: 1, borderRadius: 18, padding: 20, alignItems: 'center', gap: 4 },
  countdownLabel: { fontSize: 12, fontWeight: '700' },
  countdown: { fontSize: 40, fontWeight: '900', letterSpacing: -1 },
  countdownSub: { fontSize: 12, textAlign: 'center', marginTop: 4 },
  fineprint: { fontSize: 11, lineHeight: 16, marginTop: 14 },
});
