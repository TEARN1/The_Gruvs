/**
 * BroadcastModal — the host tells everyone who's coming, right now.
 *
 * "Moved to Hall B." · "Doors pushed to 22:00." · "Cancelled."
 *
 * Without this, a last-minute change strands every person who committed at a
 * locked door. That one experience destroys trust in the app far more than any
 * missing feature does.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { broadcastToAttendees, BROADCAST_KINDS } from '../services/broadcast';

const KINDS = [
  { key: 'update', label: 'Update', icon: 'info' },
  { key: 'venue', label: 'Venue change', icon: 'map-pin' },
  { key: 'time', label: 'Time change', icon: 'clock' },
  { key: 'cancel', label: 'Cancelled', icon: 'x-octagon' },
];

export function BroadcastModal({ visible, onClose, event, hostId, onSent }) {
  const { currentTheme } = useTheme();
  const primary = currentTheme?.primary || '#22d3ee';
  const bg = currentTheme?.background || '#0b1220';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.55)';

  const [kind, setKind] = useState('update');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    if (sending) return;
    setSending(true);
    setError('');
    const res = await broadcastToAttendees(event, message, kind, hostId);
    setSending(false);
    if (!res.ok) { setError(res.error || "Couldn't send."); return; }
    onSent?.(res.sent);
    setMessage('');
    onClose?.();
  };

  const isCancel = kind === 'cancel';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ color: textColor, fontWeight: '900', fontSize: 16 }}>Tell everyone who's coming</Text>
              <Text style={{ color: muted, fontSize: 12, marginTop: 2 }}>
                Goes only to people who RSVP'd or Touched Down.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={22} color={textColor} />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {KINDS.map((k) => {
              const on = kind === k.key;
              const tone = k.key === 'cancel' ? '#ef4444' : primary;
              return (
                <TouchableOpacity
                  key={k.key}
                  onPress={() => setKind(k.key)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
                    borderWidth: 1,
                    borderColor: on ? tone : `${muted}44`,
                    backgroundColor: on ? `${tone}18` : 'transparent',
                  }}
                >
                  <Feather name={k.icon} size={12} color={on ? tone : muted} />
                  <Text style={{ color: on ? tone : muted, fontSize: 12, fontWeight: '800' }}>{k.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            style={{
              color: textColor, borderWidth: 1, borderColor: `${primary}35`, borderRadius: 12,
              padding: 12, minHeight: 90, textAlignVertical: 'top', fontSize: 14,
            }}
            placeholder={isCancel
              ? "Tell them why, and what happens next — people are counting on this."
              : "e.g. Doors moved to 22:00 — same venue."}
            placeholderTextColor={muted}
            value={message}
            onChangeText={setMessage}
            maxLength={280}
            multiline
          />
          <Text style={{ color: muted, fontSize: 11, textAlign: 'right' }}>{message.length}/280</Text>

          {!!error && <Text style={{ color: '#ef4444', fontSize: 12 }}>⚠️ {error}</Text>}

          <TouchableOpacity
            onPress={send}
            disabled={sending || message.trim().length < 3}
            style={{
              paddingVertical: 14, borderRadius: 12, alignItems: 'center',
              backgroundColor: message.trim().length < 3
                ? `${muted}22`
                : (isCancel ? '#ef4444' : primary),
            }}
          >
            {sending
              ? <ActivityIndicator color="#000" />
              : (
                <Text style={{ color: message.trim().length < 3 ? muted : '#000', fontWeight: '900', fontSize: 14 }}>
                  {isCancel ? 'Send cancellation' : 'Send update'}
                </Text>
              )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default BroadcastModal;
