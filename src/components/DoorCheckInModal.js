/**
 * DoorCheckInModal — the host's door tool.
 *
 * The ticket system had a secure token and atomic, replay-safe validation, but
 * NO way to actually use them — TicketManager was wired into no screen. This is
 * that screen: a host at the door enters a ticket code, and the app admits or
 * rejects it, telling them exactly why.
 *
 * Manual entry (not camera) on purpose: it works on every platform including the
 * web test build, needs no camera permission, and a host reading a code off a
 * phone screen is the common real-world case. A camera scanner can layer on top
 * later — it would call the same validateTicket.
 */
import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ActivityIndicator, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { TicketManager } from '../services/dataFlow';
import { haptics } from '../utils/haptics';

const REASON_TEXT = {
  ok: 'Admitted',
  already_used: 'Already used — someone came in on this ticket',
  wrong_event: "This ticket is for a different event",
  not_found: 'Not a valid ticket',
  empty: 'Enter a ticket code',
  error: "Couldn't check — try again",
};

export function DoorCheckInModal({ visible, onClose, event }) {
  const { currentTheme } = useTheme();
  const primary = currentTheme?.primary || '#22d3ee';
  const bg = currentTheme?.background || '#0b1220';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.55)';

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null);   // { valid, reason, ticket }
  const [admitted, setAdmitted] = useState(0);
  const inputRef = useRef(null);

  const check = async () => {
    if (busy || !code.trim()) return;
    setBusy(true);
    try {
      const res = await TicketManager.validateTicket(code.trim(), event?.id);
      setLast(res);
      if (res.valid) {
        setAdmitted((n) => n + 1);
        haptics?.success?.();
      } else {
        haptics?.warning?.();
      }
      setCode('');
      inputRef.current?.focus();
    } catch {
      setLast({ valid: false, reason: 'error', ticket: null });
    } finally {
      setBusy(false);
    }
  };

  const ok = last?.valid;
  const holder = last?.ticket?.profiles?.username;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 14, maxHeight: '85%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ color: textColor, fontWeight: '900', fontSize: 16 }}>Door check-in</Text>
              <Text style={{ color: muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                {event?.title || 'Your event'} · {admitted} admitted
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={22} color={textColor} />
            </TouchableOpacity>
          </View>

          {/* Result banner */}
          {last && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12,
              backgroundColor: ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.13)',
              borderWidth: 1, borderColor: ok ? '#10b981' : '#ef4444',
            }}>
              <Feather name={ok ? 'check-circle' : 'x-circle'} size={22} color={ok ? '#10b981' : '#ef4444'} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: ok ? '#10b981' : '#ef4444', fontWeight: '900', fontSize: 15 }}>
                  {REASON_TEXT[last.reason] || 'Rejected'}
                </Text>
                {ok && holder ? (
                  <Text style={{ color: textColor, fontSize: 13, marginTop: 1 }}>@{holder}</Text>
                ) : null}
              </View>
            </View>
          )}

          <TextInput
            ref={inputRef}
            style={{
              color: textColor, borderWidth: 1, borderColor: `${primary}45`, borderRadius: 12,
              paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, letterSpacing: 1,
            }}
            placeholder="Enter ticket code (e.g. VIBE-TKT-…)"
            placeholderTextColor={muted}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={check}
          />

          <TouchableOpacity
            onPress={check}
            disabled={busy || !code.trim()}
            style={{
              paddingVertical: 14, borderRadius: 12, alignItems: 'center',
              backgroundColor: code.trim() ? primary : `${muted}22`,
            }}
          >
            {busy ? <ActivityIndicator color="#000" /> : (
              <Text style={{ color: code.trim() ? '#000' : muted, fontWeight: '900', fontSize: 14 }}>Check ticket</Text>
            )}
          </TouchableOpacity>

          <Text style={{ color: muted, fontSize: 11, textAlign: 'center' }}>
            Each ticket admits once — a re-used code is rejected automatically.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

export default DoorCheckInModal;
