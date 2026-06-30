/**
 * SafetyHubModal — one visible place that makes The Gruvs' protections legible
 * (#150). For a women-first product, *feeling* safe drives adoption as much as
 * being safe — so this surfaces the protections you already have, your current
 * visibility status, and the one-tap "Disappear now" panic action. Reuses
 * existing services (PanicMode, IdentityContext); no new data, no DB.
 */
import React from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useIdentity } from '../context/IdentityContext';
import { useToast } from './ToastNotification';
import { PanicMode } from '../services/panicMode';
import { useBackClose } from '../hooks/useBackClose';

const PROTECTIONS = [
  { icon: 'message-circle', title: 'No cold messages', body: "Only people you follow back can DM you. Strangers can't reach you." },
  { icon: 'user-x',         title: 'Silent, two-way block', body: "Block anyone — you both vanish from each other, and they're never told." },
  { icon: 'eye-off',        title: 'You choose who sees you', body: 'Ghost counts you in but anonymously; Incognito hides you unless you Drop a Beacon.' },
  { icon: 'flag',           title: 'One-tap report', body: 'Report from any screen — trust-weighted, and dodgy content auto-hides fast.' },
  { icon: 'shield',         title: '18+ at the door', body: 'Age is the one hard gate; checked at entry, never stored.' },
  { icon: 'navigation',     title: 'Safe ride home', body: 'Coordinate rides through your Crew and trusted people — never strangers.' },
];

export function SafetyHubModal({ visible, onClose, onManageContacts }) {
  useBackClose(visible, onClose);
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const { identityMode, setIdentityMode } = useIdentity();
  const toast = useToast();

  const primary   = currentTheme?.primary   || '#10b981';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  const modeLabel = identityMode === 'ghost' ? 'Ghost (anonymous)'
    : identityMode === 'celebrity' ? 'Incognito (hidden)' : 'Public';

  const handlePanic = () => {
    if (!user) return;
    Alert.alert(
      'Disappear now?',
      "You'll instantly go invisible: switched to Ghost, hidden from discovery, and removed from every live 'here now' list. Reversible any time.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disappear', style: 'destructive', onPress: async () => {
            const { ok } = await PanicMode.disappear(user.id);
            try { setIdentityMode?.('ghost'); } catch {}
            toast?.show(ok ? "You're invisible now 🫥" : 'Going invisible…', ok ? 'success' : 'info');
            onClose?.();
          } },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <View style={[s.sheet, { backgroundColor: bg }]}>
          <View style={s.handle} />
          <View style={s.header}>
            <Feather name="shield" size={20} color={primary} />
            <Text style={[s.title, { color: textColor }]}>Your Safety</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close"><Feather name="x" size={22} color={muted} /></TouchableOpacity>
          </View>
          <Text style={[s.intro, { color: muted }]}>You're protected by default. Here's how — and how to vanish instantly if you ever need to.</Text>

          <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
            {/* Current visibility */}
            <View style={[s.statusBox, { borderColor: `${primary}30`, backgroundColor: `${primary}0d` }]}>
              <Feather name="eye" size={14} color={primary} />
              <Text style={[s.statusText, { color: textColor }]}>You're currently <Text style={{ fontWeight: '900', color: primary }}>{modeLabel}</Text></Text>
            </View>

            {/* Panic — the prominent action */}
            <TouchableOpacity onPress={handlePanic} accessibilityRole="button" accessibilityLabel="Disappear now"
              style={[s.panic, { borderColor: 'rgba(239,68,68,0.45)', backgroundColor: 'rgba(239,68,68,0.10)' }]}>
              <Feather name="eye-off" size={18} color="#ef4444" />
              <View style={{ flex: 1 }}>
                <Text style={s.panicTitle}>Disappear now</Text>
                <Text style={[s.panicSub, { color: muted }]}>Instantly invisible everywhere — Ghost + cleared presence</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#ef4444" />
            </TouchableOpacity>

            {/* Emergency contacts */}
            {onManageContacts && (
              <TouchableOpacity onPress={() => { onClose?.(); onManageContacts(); }} style={[s.row, { borderColor: `${primary}20` }]}>
                <Feather name="phone" size={16} color={primary} />
                <Text style={[s.rowText, { color: textColor }]}>Emergency contacts & SOS</Text>
                <Feather name="chevron-right" size={16} color={muted} />
              </TouchableOpacity>
            )}

            {/* The protections, made legible */}
            <Text style={[s.sectionLabel, { color: muted }]}>ALWAYS ON</Text>
            {PROTECTIONS.map((p) => (
              <View key={p.title} style={s.protection}>
                <View style={[s.pIcon, { backgroundColor: `${primary}15` }]}><Feather name={p.icon} size={15} color={primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.pTitle, { color: textColor }]}>{p.title}</Text>
                  <Text style={[s.pBody, { color: muted }]}>{p.body}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 12, maxHeight: '88%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 18, fontWeight: '900', flex: 1 },
  intro: { fontSize: 13, lineHeight: 18, marginTop: 8, marginBottom: 14 },
  'statusBox': { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  statusText: { fontSize: 13, fontWeight: '700' },
  panic: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  panicTitle: { color: '#ef4444', fontSize: 15, fontWeight: '900' },
  panicSub: { fontSize: 11, marginTop: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 16 },
  rowText: { fontSize: 14, fontWeight: '800', flex: 1 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 8 },
  protection: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  pIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pTitle: { fontSize: 14, fontWeight: '800' },
  pBody: { fontSize: 12, lineHeight: 16, marginTop: 2 },
});
