/**
 * PermissionGuideModal — "your camera and mic are blocked, here's exactly how
 * to turn them back on."
 *
 * Once a browser has been told Block, the app can NEVER re-prompt — the
 * getUserMedia call just rejects instantly, forever. A toast saying "check your
 * settings" is where people give up, because the steps are different in every
 * browser and buried two menus deep. So this detects the actual browser and
 * gives the real, numbered steps, re-checks live, and lets them retry without
 * leaving the call they were trying to start.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useBackClose } from '../hooks/useBackClose';
import {
  detectBrowser, unblockSteps, BROWSER_LABEL,
  queryPermission, requestMedia, permissionHint,
} from '../utils/permissions';

export function PermissionGuideModal({
  visible,
  onClose,
  onGranted,               // called once access is actually working
  kind = 'camera and mic', // wording for the thing that was blocked
  reason,                  // typed error from requestMedia: 'denied' | 'no-device' | ...
  needVideo = true,
}) {
  useBackClose(visible, onClose);
  const { currentTheme } = useTheme();
  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  const browser = detectBrowser();
  const steps = unblockSteps(browser);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState({ cam: 'unknown', mic: 'unknown' });

  const refresh = useCallback(async () => {
    setStatus({
      cam: await queryPermission('camera'),
      mic: await queryPermission('microphone'),
    });
  }, []);

  useEffect(() => { if (visible) refresh(); }, [visible, refresh]);

  // Re-check while the sheet is open — the moment they flip the switch in
  // browser settings this flips to "working", with no extra tap.
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [visible, refresh]);

  const retry = async () => {
    setChecking(true);
    const res = await requestMedia({ video: needVideo });
    setChecking(false);
    if (res.ok) {
      res.stream.getTracks().forEach((t) => t.stop()); // only wanted the grant
      onGranted?.();
      onClose?.();
    } else {
      refresh();
    }
  };

  const noDevice = reason === 'no-device';
  const insecure = reason === 'insecure';
  const ok = status.cam === 'granted' && status.mic === 'granted';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <View style={[s.sheet, { backgroundColor: bg }]}>
          <View style={s.handle} />
          <View style={s.header}>
            <Feather name={noDevice ? 'camera-off' : 'lock'} size={20} color="#f59e0b" />
            <Text style={[s.title, { color: textColor }]}>
              {noDevice ? `No ${kind} found` : `Turn on your ${kind}`}
            </Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close">
              <Feather name="x" size={22} color={muted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[s.intro, { color: muted }]}>
              {noDevice
                ? `We couldn't find a ${kind} on this device. If you have one plugged in, check it isn't being used by another app.`
                : insecure
                  ? `Browsers only allow ${kind} on a secure (https) connection. Open thegruvs.com directly rather than through a preview link.`
                  : `Your browser is blocking ${kind} for The Gruvs, and it won't ask again on its own — you have to switch it back on in ${BROWSER_LABEL[browser]}.`}
            </Text>

            {!noDevice && !insecure && (
              <>
                {/* Live status — flips as soon as they change the setting */}
                <View style={[s.statusBox, { borderColor: ok ? '#10b981' : `${primary}25`, backgroundColor: ok ? 'rgba(16,185,129,0.08)' : 'transparent' }]}>
                  <Feather name={ok ? 'check-circle' : 'clock'} size={14} color={ok ? '#10b981' : muted} />
                  <Text style={[s.statusText, { color: ok ? '#10b981' : muted }]}>
                    {ok ? 'Access granted — you can start the call.' : 'Watching for the change…'}
                  </Text>
                </View>

                <Text style={[s.stepsTitle, { color: textColor }]}>In {BROWSER_LABEL[browser]}:</Text>
                {steps.map((step, i) => (
                  <View key={i} style={s.stepRow}>
                    <View style={[s.stepNum, { backgroundColor: `${primary}18`, borderColor: `${primary}40` }]}>
                      <Text style={{ color: primary, fontWeight: '900', fontSize: 11 }}>{i + 1}</Text>
                    </View>
                    <Text style={[s.stepText, { color: textColor }]}>{step}</Text>
                  </View>
                ))}
              </>
            )}

            {reason && !noDevice && !insecure && (
              <Text style={[s.hint, { color: muted }]}>{permissionHint(reason, kind)}</Text>
            )}

            <TouchableOpacity onPress={retry} disabled={checking} style={[s.cta, { backgroundColor: primary }]}>
              {checking ? <ActivityIndicator color="#000" /> : <Text style={s.ctaText}>Try again</Text>}
            </TouchableOpacity>

            {typeof window !== 'undefined' && (
              <TouchableOpacity onPress={() => { try { window.location.reload(); } catch {} }} style={s.secondary}>
                <Text style={[s.secondaryText, { color: muted }]}>Reload the page</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, paddingBottom: 30, maxHeight: '88%' },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  title: { flex: 1, fontSize: 17, fontWeight: '900' },
  intro: { fontSize: 13, lineHeight: 19, marginBottom: 14 },
  statusBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 16 },
  statusText: { fontSize: 12, fontWeight: '700', flex: 1 },
  stepsTitle: { fontSize: 13, fontWeight: '900', marginBottom: 10 },
  stepRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 10 },
  stepNum: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepText: { flex: 1, fontSize: 13, lineHeight: 19 },
  hint: { fontSize: 11, lineHeight: 16, marginTop: 6 },
  cta: { marginTop: 18, borderRadius: 26, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#000', fontWeight: '900', fontSize: 15 },
  secondary: { marginTop: 12, alignItems: 'center' },
  secondaryText: { fontSize: 12, fontWeight: '700' },
});
