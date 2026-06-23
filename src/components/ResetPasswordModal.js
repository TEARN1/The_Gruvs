/**
 * ResetPasswordModal — the missing second half of password reset.
 *
 * Shown by App when AuthContext.recoveryMode is true (the user arrived via a
 * reset link and now has a temporary recovery session). They set a new password
 * here — supabase.auth.updateUser({ password }) — which was never called
 * anywhere before, so reset always dead-ended. On success they're signed in
 * with the new password.
 */
import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabase';

export const ResetPasswordModal = ({ visible, onDone }) => {
  const { currentTheme } = useTheme();
  const primary = currentTheme?.primary || '#00f2ff';
  const bg = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const surface = currentTheme?.surface || 'rgba(255,255,255,0.06)';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const { error: e } = await supabase.auth.updateUser({ password });
      if (e) { setError(e.message || 'Could not update password. Try the reset link again.'); return; }
      setDone(true);
    } catch (e) {
      setError(e?.message || 'Could not update password. Try the reset link again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => onDone?.()}>
      <View style={s.overlay}>
        <View style={[s.card, { backgroundColor: bg, borderColor: `${primary}30` }]}>
          {done ? (
            <View style={{ alignItems: 'center' }}>
              <View style={[s.icon, { backgroundColor: `${primary}18`, borderColor: `${primary}40` }]}>
                <Feather name="check" size={22} color={primary} />
              </View>
              <Text style={[s.title, { color: textColor }]}>Password updated</Text>
              <Text style={[s.sub, { color: muted }]}>You're all set — you're signed in with your new password.</Text>
              <TouchableOpacity style={[s.btn, { backgroundColor: primary }]} onPress={() => onDone?.()} activeOpacity={0.85}>
                <Text style={s.btnText}>Continue</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={[s.icon, { backgroundColor: `${primary}18`, borderColor: `${primary}40`, alignSelf: 'center' }]}>
                <Feather name="lock" size={20} color={primary} />
              </View>
              <Text style={[s.title, { color: textColor }]}>Set a new password</Text>
              <Text style={[s.sub, { color: muted }]}>Choose a new password for your account.</Text>

              <View style={[s.inputWrap, { backgroundColor: surface, borderColor: `${primary}25` }]}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="New password"
                  placeholderTextColor={muted}
                  secureTextEntry={!showPw}
                  autoCapitalize="none"
                  style={[s.input, { color: textColor }]}
                />
                <TouchableOpacity onPress={() => setShowPw(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name={showPw ? 'eye-off' : 'eye'} size={18} color={muted} />
                </TouchableOpacity>
              </View>

              <View style={[s.inputWrap, { backgroundColor: surface, borderColor: `${primary}25` }]}>
                <TextInput
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="Confirm new password"
                  placeholderTextColor={muted}
                  secureTextEntry={!showPw}
                  autoCapitalize="none"
                  style={[s.input, { color: textColor }]}
                  onSubmitEditing={submit}
                />
              </View>

              {!!error && <Text style={s.error}>{error}</Text>}

              <TouchableOpacity style={[s.btn, { backgroundColor: primary, opacity: busy ? 0.7 : 1 }]} onPress={submit} disabled={busy} activeOpacity={0.85}>
                {busy ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Update password</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onDone?.()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginTop: 12, alignSelf: 'center' }}>
                <Text style={[s.cancel, { color: muted }]}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, borderRadius: 22, borderWidth: 1, padding: 22, ...(Platform.OS === 'web' ? { boxShadow: '0 20px 60px rgba(0,0,0,0.5)' } : {}) },
  icon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  sub: { fontSize: 13, fontWeight: '500', textAlign: 'center', marginTop: 6, marginBottom: 18, lineHeight: 18 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, marginBottom: 10 },
  input: { flex: 1, paddingVertical: 13, fontSize: 14.5, fontWeight: '600' },
  error: { color: '#ef4444', fontSize: 12.5, fontWeight: '700', marginBottom: 8, marginTop: 2 },
  btn: { borderRadius: 13, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  btnText: { color: '#000', fontSize: 15, fontWeight: '900' },
  cancel: { fontSize: 13, fontWeight: '700' },
});

export default ResetPasswordModal;
