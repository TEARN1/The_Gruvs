/**
 * DoorCodeEntryModal — the guest side of Touch Down v2. Type the 6-digit code
 * shown at the door; the server verifies it and marks you "verified at the door".
 */
import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { touchDownWithCode, cleanCode } from '../services/doorCode';

export function DoorCodeEntryModal({ visible, eventId, onClose, onVerified, getCoords, primary = '#00f2ff' }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const submit = async () => {
    if (busy) return;
    setBusy(true); setMessage('');
    let coords = null;
    try { coords = getCoords ? await getCoords() : null; } catch { coords = null; } // location is optional here
    const r = await touchDownWithCode(eventId, code, coords);
    setBusy(false);
    if (r.ok) { setCode(''); onVerified?.(r); onClose?.(); }
    else setMessage(r.message);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.head}>
            <Feather name="shield" size={18} color={primary} />
            <Text style={s.title}>Verify at the door</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close"><Feather name="x" size={20} color="rgba(255,255,255,0.6)" /></TouchableOpacity>
          </View>
          <Text style={s.sub}>Type the 6-digit code on the screen at the entrance. It proves you're really here.</Text>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(cleanCode(t))}
            keyboardType="number-pad"
            inputMode="numeric"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            placeholder="000000"
            placeholderTextColor="rgba(255,255,255,0.2)"
            style={[s.input, { borderColor: `${primary}55` }]}
            autoFocus
            onSubmitEditing={submit}
            accessibilityLabel="Door code"
          />
          {!!message && <Text style={s.msg}>{message}</Text>}
          <TouchableOpacity
            onPress={submit}
            disabled={busy || code.length !== 6}
            style={[s.btn, { backgroundColor: primary, opacity: busy || code.length !== 6 ? 0.5 : 1 }]}
          >
            {busy ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Touch Down</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: '#0d1112', padding: 22, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '900' },
  sub: { color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 19, marginTop: 8 },
  input: { marginTop: 18, borderWidth: 1.5, borderRadius: 14, paddingVertical: 14, color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: 10, textAlign: 'center' },
  msg: { color: '#fca5a5', fontSize: 13, marginTop: 10, lineHeight: 18 },
  btn: { marginTop: 16, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#000', fontWeight: '900', fontSize: 15 },
});
