/**
 * AppLockGate — optional biometric lock over the whole app.
 *
 * Inert unless the user turns on the lock (Biometric.setLockEnabled). When on,
 * it prompts on cold start and again when the app returns from the background.
 * Fail-open by design: if biometrics are unavailable or error, it unlocks —
 * the user is never bricked out of their own app.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AppState, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Biometric } from '../services/biometric';
import { useTheme } from '../context/ThemeContext';
import { haptics } from '../utils/haptics';

export const AppLockGate = ({ children }) => {
  const { currentTheme } = useTheme();
  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [label, setLabel] = useState('Biometrics');
  const appState = useRef(AppState.currentState);

  const primary = currentTheme?.primary || "#00f2ff";
  const bg = currentTheme?.background || "#0d1112";
  const text = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  const tryUnlock = useCallback(async () => {
    const ok = await Biometric.guard('Unlock The Gruvs');
    if (ok) { setLocked(false); haptics.success(); }
    else { setLocked(true); haptics.error(); }
    setChecking(false);
  }, []);

  // Cold start: lock if enabled
  useEffect(() => {
    let alive = true;
    (async () => {
      const enabled = await Biometric.isLockEnabled();
      if (!alive) return;
      if (enabled) {
        setLabel(await Biometric.label());
        setLocked(true);
        tryUnlock();
      } else {
        setChecking(false);
      }
    })();
    return () => { alive = false; };
  }, [tryUnlock]);

  // Re-lock when returning from background
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      const prev = appState.current;
      appState.current = next;
      if (prev.match(/inactive|background/) && next === 'active') {
        if (await Biometric.isLockEnabled()) setLocked(true);
      }
    });
    return () => sub.remove();
  }, []);

  if (!locked) return children;

  return (
    <View style={[styles.wrap, { backgroundColor: bg }]}>
      <View style={[styles.badge, { borderColor: `${primary}40`, backgroundColor: `${primary}12` }]}>
        <Feather name="lock" size={34} color={primary} />
      </View>
      <Text style={[styles.title, { color: text }]}>The Gruvs is locked</Text>
      <Text style={[styles.sub, { color: muted }]}>
        {Platform.OS === 'web' ? 'Tap to continue.' : `Unlock with ${label} to continue.`}
      </Text>
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: primary }]}
        onPress={() => { setChecking(true); tryUnlock(); }}
        disabled={checking}
        activeOpacity={0.85}
      >
        <Feather name="unlock" size={16} color="#000" />
        <Text style={styles.btnText}>{checking ? 'Verifying…' : 'Unlock'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  badge: { width: 84, height: 84, borderRadius: 42, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '900' },
  sub: { fontSize: 13, textAlign: 'center', marginBottom: 10 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 24 },
  btnText: { color: '#000', fontWeight: '900', fontSize: 15 },
});
