/**
 * MfaSetupModal — turn two-factor authentication on/off (#997).
 *
 * Flow: open → we check if 2FA is already on. If not, "Enable" runs enroll →
 * shows a QR (scan in Google Authenticator / Authy / 1Password) + the secret for
 * manual entry → the user types the 6-digit code → verify → done. If it's already
 * on, we offer to turn it off.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ActivityIndicator, ScrollView, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../context/ThemeContext';
import { enrollTotp, verifyTotp, mfaStatus, disableMfa, isValidTotpCode } from '../services/mfa';

export function MfaSetupModal({ visible, onClose, onChanged }) {
  const { currentTheme } = useTheme();
  const primary = currentTheme?.primary || '#22d3ee';
  const bg = currentTheme?.background || '#0b1220';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.55)';

  const [phase, setPhase] = useState('loading'); // loading | on | off | enrolling
  const [factorId, setFactorId] = useState(null);
  const [enroll, setEnroll] = useState(null);    // { uri, secret }
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setError(''); setCode(''); setEnroll(null);
    (async () => {
      setPhase('loading');
      const s = await mfaStatus();
      setFactorId(s.factorId);
      setPhase(s.enabled ? 'on' : 'off');
    })();
  }, [visible]);

  const startEnroll = async () => {
    setBusy(true); setError('');
    const r = await enrollTotp();
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setFactorId(r.factorId);
    setEnroll({ uri: r.uri, secret: r.secret });
    setPhase('enrolling');
  };

  const confirm = async () => {
    setBusy(true); setError('');
    const r = await verifyTotp(factorId, code);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setPhase('on'); setCode(''); onChanged?.(true);
  };

  const turnOff = async () => {
    setBusy(true); setError('');
    const r = await disableMfa(factorId);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setPhase('off'); setFactorId(null); onChanged?.(false);
  };

  const Btn = ({ label, onPress, tone = primary, disabled }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || busy}
      style={{ paddingVertical: 13, borderRadius: 12, alignItems: 'center',
        backgroundColor: disabled ? `${muted}22` : tone }}>
      {busy ? <ActivityIndicator color="#000" /> :
        <Text style={{ color: disabled ? muted : '#000', fontWeight: '900', fontSize: 14 }}>{label}</Text>}
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <ScrollView style={{ maxHeight: '90%' }} contentContainerStyle={{ backgroundColor: bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: textColor, fontWeight: '900', fontSize: 17 }}>Two-factor authentication</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={22} color={textColor} />
            </TouchableOpacity>
          </View>

          {phase === 'loading' && <ActivityIndicator color={primary} style={{ paddingVertical: 30 }} />}

          {phase === 'off' && (
            <View style={{ gap: 14 }}>
              <Text style={{ color: muted, fontSize: 13, lineHeight: 19 }}>
                Add a second step at sign-in with an authenticator app (Google Authenticator,
                Authy, 1Password). Even if someone gets your password, they can't get in.
              </Text>
              <Btn label="Enable 2FA" onPress={startEnroll} />
            </View>
          )}

          {phase === 'enrolling' && (
            <View style={{ gap: 14 }}>
              <Text style={{ color: muted, fontSize: 13 }}>1. Scan this in your authenticator app:</Text>
              {enroll?.uri ? (
                <View style={{ alignSelf: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 12 }}>
                  <QRCode value={enroll.uri} size={180} />
                </View>
              ) : null}
              {enroll?.secret ? (
                <Text selectable style={{ color: muted, fontSize: 12, textAlign: 'center' }}>
                  or enter this key manually:{'\n'}<Text style={{ color: textColor, fontWeight: '700', letterSpacing: 1 }}>{enroll.secret}</Text>
                </Text>
              ) : null}
              <Text style={{ color: muted, fontSize: 13 }}>2. Enter the 6-digit code it shows:</Text>
              <TextInput
                style={{ color: textColor, borderWidth: 1, borderColor: `${primary}45`, borderRadius: 12,
                  paddingVertical: 13, textAlign: 'center', fontSize: 22, letterSpacing: 8 }}
                placeholder="000000" placeholderTextColor={muted}
                value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad" maxLength={6}
              />
              <Btn label="Confirm & turn on" onPress={confirm} disabled={!isValidTotpCode(code)} />
            </View>
          )}

          {phase === 'on' && (
            <View style={{ gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Feather name="shield" size={18} color="#10b981" />
                <Text style={{ color: '#10b981', fontWeight: '800', fontSize: 15 }}>2FA is on — your account is protected.</Text>
              </View>
              <Btn label="Turn off 2FA" onPress={turnOff} tone="#ef4444" />
            </View>
          )}

          {!!error && <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 12, textAlign: 'center' }}>⚠️ {error}</Text>}
        </ScrollView>
      </View>
    </Modal>
  );
}

export default MfaSetupModal;
