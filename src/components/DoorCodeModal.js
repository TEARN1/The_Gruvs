/**
 * DoorCodeModal — the host's door screen for Touch Down v2.
 * Big rotating 6-digit code with a countdown; refreshes itself each window.
 * Put the phone or a tablet at the door; guests type the code to verify.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { getDoorCode } from '../services/doorCode';

export function DoorCodeModal({ visible, eventId, eventTitle, onClose, primary = '#00f2ff' }) {
  const [code, setCode] = useState('');
  const [left, setLeft] = useState(0);
  const [period, setPeriod] = useState(30);
  const [error, setError] = useState('');
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const r = await getDoorCode(eventId);
      setCode(r.code); setLeft(r.secondsLeft); setPeriod(r.period); setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [eventId]);

  useEffect(() => {
    if (!visible || !eventId) return undefined;
    load();
    timer.current = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(timer.current);
  }, [visible, eventId, load]);

  // New window → fetch the next code (the server is the only source of truth).
  useEffect(() => { if (visible && code && left <= 0) load(); }, [left, visible, code, load]);

  const pct = Math.max(0, Math.min(1, left / period));
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={s.wrap}>
        <TouchableOpacity onPress={onClose} style={s.close} accessibilityLabel="Close door code">
          <Feather name="x" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.kicker}>DOOR CODE</Text>
        {!!eventTitle && <Text style={s.title} numberOfLines={2}>{eventTitle}</Text>}
        {error ? (
          <Text style={s.error}>{error}</Text>
        ) : !code ? (
          <ActivityIndicator color={primary} size="large" style={{ marginVertical: 40 }} />
        ) : (
          <>
            <Text style={[s.code, { color: primary }]} accessibilityLabel={`Door code ${code.split('').join(' ')}`}>
              {code.slice(0, 3)} {code.slice(3)}
            </Text>
            <View style={s.bar}><View style={[s.fill, { width: `${pct * 100}%`, backgroundColor: primary }]} /></View>
            <Text style={s.hint}>New code in {Math.max(0, left)}s</Text>
          </>
        )}
        <Text style={s.help}>
          Guests open this event, tap “Verify at the door” and type this code.
          It changes every 30 seconds, so only people standing here can use it.
        </Text>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#05080a', alignItems: 'center', justifyContent: 'center', padding: 24 },
  close: { position: 'absolute', top: 40, right: 20, padding: 10 },
  kicker: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '800', letterSpacing: 3 },
  title: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 8, textAlign: 'center' },
  code: { fontSize: 76, fontWeight: '900', letterSpacing: 6, marginTop: 28, fontVariant: ['tabular-nums'] },
  bar: { width: 260, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 18, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  hint: { color: 'rgba(255,255,255,0.6)', marginTop: 10, fontSize: 13, fontWeight: '700' },
  error: { color: '#fca5a5', fontSize: 15, marginVertical: 40, textAlign: 'center' },
  help: { color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 36, maxWidth: 340 },
});
