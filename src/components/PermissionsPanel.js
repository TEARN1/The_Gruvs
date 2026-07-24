/**
 * PermissionsPanel — "what The Gruvs can access, and why."
 *
 * Browsers only show their scary allow/block dialog once, and once a user hits
 * Block there is no way for us to re-prompt — the feature just silently stops
 * working (calls that never start, no nearby events, no message pings). This
 * panel makes that state visible and fixable: every permission shows its live
 * status, what it unlocks, a one-tap Allow while it's still askable, and plain
 * unblock instructions once the browser has locked us out.
 *
 * Reads/requests through src/utils/permissions.js so the wording and typed
 * results stay identical to the in-call prompts.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  queryPermission, requestMedia, requestLocation, requestNotifications,
  permissionHint, PERMISSION_COPY,
} from '../utils/permissions';

const ROWS = [
  { key: 'microphone',    kind: 'microphone' },
  { key: 'camera',        kind: 'camera' },
  { key: 'geolocation',   kind: 'location' },
  { key: 'notifications', kind: 'notifications' },
];

// 'granted' → green, 'denied' → red, anything else → "not asked yet".
const STATUS_UI = {
  granted: { color: '#10b981', icon: 'check-circle', label: 'Allowed' },
  denied:  { color: '#ef4444', icon: 'slash',        label: 'Blocked' },
  prompt:  { color: '#f59e0b', icon: 'help-circle',  label: 'Not asked yet' },
  default: { color: '#f59e0b', icon: 'help-circle',  label: 'Not asked yet' },
  unknown: { color: 'rgba(255,255,255,0.4)', icon: 'minus-circle', label: 'Unavailable' },
};

export const PermissionsPanel = ({ primary = '#00f2ff', textColor = '#fff', muted = 'rgba(255,255,255,0.5)' }) => {
  const [status, setStatus] = useState({});
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);

  const refresh = useCallback(async () => {
    const next = {};
    for (const r of ROWS) next[r.key] = await queryPermission(r.key);
    setStatus(next);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const ask = async (row) => {
    setBusy(row.key);
    setNote(null);
    try {
      if (row.key === 'notifications') {
        await requestNotifications();
      } else if (row.key === 'geolocation') {
        await requestLocation();
      } else {
        // Camera/mic: request, then immediately release — we only wanted the grant.
        const res = await requestMedia({ video: row.key === 'camera' });
        if (res.ok) res.stream.getTracks().forEach((t) => t.stop());
        else setNote(permissionHint(res.error, row.kind));
      }
    } finally {
      setBusy(null);
      refresh();
    }
  };

  if (Platform.OS !== 'web') return null; // native uses the OS settings app

  return (
    <View>
      <Text style={[s.intro, { color: muted }]}>
        The Gruvs only asks for what a feature actually needs. Nothing is accessed in the background.
      </Text>

      {ROWS.map((row) => {
        const copy = PERMISSION_COPY[row.key] || {};
        const st = status[row.key] || 'unknown';
        const ui = STATUS_UI[st] || STATUS_UI.unknown;
        const askable = st !== 'granted' && st !== 'unknown';
        return (
          <View key={row.key} style={[s.row, { borderColor: `${primary}14` }]}>
            <View style={[s.iconWrap, { backgroundColor: `${primary}12` }]}>
              <Feather name={copy.icon || 'shield'} size={17} color={primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { color: textColor }]}>{copy.title || row.key}</Text>
              <Text style={[s.why, { color: muted }]}>{copy.why}</Text>
              <View style={s.statusRow}>
                <Feather name={ui.icon} size={11} color={ui.color} />
                <Text style={[s.statusText, { color: ui.color }]}>{ui.label}</Text>
              </View>
            </View>
            {busy === row.key ? (
              <ActivityIndicator color={primary} />
            ) : askable ? (
              <TouchableOpacity onPress={() => ask(row)} style={[s.btn, { backgroundColor: primary }]}>
                <Text style={s.btnText}>{st === 'denied' ? 'Retry' : 'Allow'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        );
      })}

      {/* Blocked permissions can't be re-prompted — tell them exactly what to do. */}
      {Object.values(status).includes('denied') && (
        <View style={[s.blockedBox, { borderColor: '#ef444455' }]}>
          <Feather name="alert-circle" size={13} color="#ef4444" />
          <Text style={[s.blockedText, { color: muted }]}>
            Anything marked <Text style={{ color: '#ef4444', fontWeight: '800' }}>Blocked</Text> can't be
            re-asked by the app — your browser remembers it. Tap the lock icon in the address bar,
            set it back to Allow, then reload.
          </Text>
        </View>
      )}

      {note ? <Text style={[s.note, { color: '#f59e0b' }]}>{note}</Text> : null}
    </View>
  );
};

const s = StyleSheet.create({
  intro: { fontSize: 12, lineHeight: 17, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderTopWidth: 1 },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '800' },
  why: { fontSize: 11, marginTop: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  statusText: { fontSize: 11, fontWeight: '800' },
  btn: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 18 },
  btnText: { color: '#000', fontWeight: '900', fontSize: 12 },
  blockedBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 12 },
  blockedText: { flex: 1, fontSize: 11, lineHeight: 16 },
  note: { fontSize: 11, marginTop: 10, lineHeight: 16 },
});
