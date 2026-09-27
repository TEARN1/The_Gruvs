/**
 * NotificationNudge — "turn on notifications" reminder.
 *
 * The OS permission prompt fires once on login; if a user dismisses or never
 * saw it, they silently miss DMs, "pull up" beacons and event reminders. This
 * is the soft re-ask: a calm, dismissible banner that explains the VALUE first
 * (best practice — soft-ask lifts grant rates), then triggers the real prompt
 * on tap.
 *
 * Non-naggy: shows only when signed in AND push is off AND we can still ask;
 * a dismissal is remembered for 7 days. On web where the browser is hard-
 * 'denied', it renders nothing (re-prompting is impossible — pointless nag).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { NotificationService } from '../services/notificationService';
import { useToast } from './ToastNotification';

const SNOOZE_KEY = '@gruvs_notif_nudge_snooze';
const SNOOZE_MS = 7 * 24 * 3600 * 1000; // re-ask at most weekly

export const NotificationNudge = ({ primary = '#00f2ff', surface = '#131a1c', textColor = '#fff', muted = 'rgba(255,255,255,0.6)', style }) => {
  const { user } = useAuth();
  const { show: showToast } = useToast();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.id) { setShow(false); return; }
      try {
        const snoozedAt = Number(await AsyncStorage.getItem(SNOOZE_KEY)) || 0;
        if (Date.now() - snoozedAt < SNOOZE_MS) return; // recently dismissed
        const { granted, canAsk } = await NotificationService.getPermissionState();
        if (alive) setShow(!granted && canAsk); // off, and we can still ask
      } catch { /* stay hidden on any error */ }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  const enable = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await NotificationService.registerForPush(user.id); // triggers the OS/browser prompt
      const { granted } = await NotificationService.getPermissionState();
      if (granted) {
        showToast("Notifications on — you won't miss a message 🔔", 'success');
        setShow(false);
      } else {
        // Denied at the OS level — respect it, don't nag again this week.
        await AsyncStorage.setItem(SNOOZE_KEY, String(Date.now()));
        showToast(
          Platform.OS === 'web'
            ? 'Enable notifications in your browser settings to get messages.'
            : 'Enable notifications in your phone settings to get messages.',
          'info'
        );
        setShow(false);
      }
    } catch {
      showToast('Could not turn on notifications. Try again.', 'error');
    } finally { setBusy(false); }
  }, [busy, user?.id, showToast]);

  const dismiss = useCallback(async () => {
    try { await AsyncStorage.setItem(SNOOZE_KEY, String(Date.now())); } catch {}
    setShow(false);
  }, []);

  if (!show) return null;

  return (
    <View style={[nn.card, { backgroundColor: surface, borderColor: `${primary}40` }, style]}>
      <View style={[nn.icon, { backgroundColor: `${primary}18` }]}>
        <Feather name="bell" size={16} color={primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[nn.title, { color: textColor }]}>Turn on notifications</Text>
        <Text style={[nn.body, { color: muted }]} numberOfLines={2}>
          So a message, a friend's "pull up", or your event starting reaches your phone — even when the app is closed.
        </Text>
      </View>
      <View style={nn.actions}>
        <TouchableOpacity style={[nn.enableBtn, { backgroundColor: primary }]} onPress={enable} disabled={busy}>
          <Text style={nn.enableText}>{busy ? '…' : 'Turn on'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={nn.dismissBtn} onPress={dismiss} accessibilityLabel="Dismiss">
          <Feather name="x" size={15} color={muted} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const nn = StyleSheet.create({
  card:      { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12, marginHorizontal: 16, marginBottom: 10 },
  icon:      { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  title:     { fontSize: 13, fontWeight: '900' },
  body:      { fontSize: 11, marginTop: 2, lineHeight: 15 },
  actions:   { alignItems: 'center', gap: 4 },
  enableBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9 },
  enableText:{ color: '#000', fontWeight: '900', fontSize: 12 },
  dismissBtn:{ padding: 4 },
});
