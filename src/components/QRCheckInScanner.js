/**
 * QRCheckInScanner — Camera-based QR scanner for door check-ins.
 * Reads gruvsticket://<event_id>/<user_id>/<rsvp_id> payloads,
 * validates against the DB, and marks the attendee as checked in.
 * Falls back to manual text entry if camera is unavailable.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  ActivityIndicator, Image, Platform, Vibration,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { resilient } from '../utils/resilience';

// expo-camera is optional — if unavailable we fall back to manual entry
let CameraView = null;
let useCameraPermissions = null;
try {
  const cam = require('expo-camera');
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
} catch {}

const TICKET_PREFIX = 'gruvsticket://';

const parsePayload = (raw) => {
  if (!raw?.startsWith(TICKET_PREFIX)) return null;
  const parts = raw.slice(TICKET_PREFIX.length).split('/');
  if (parts.length < 3) return null;
  return { eventId: parts[0], userId: parts[1], rsvpId: parts[2] };
};

// ─── Result card ─────────────────────────────────────────────────────────────

const ResultCard = ({ result, primary, onDismiss }) => {
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 70, friction: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const ok = result?.ok;
  const color = ok ? '#10b981' : '#ef4444';

  return (
    <Animated.View style={[rs.card, { borderColor: color, transform: [{ scale }], opacity }]}>
      <View style={[rs.iconCircle, { backgroundColor: `${color}20` }]}>
        <Feather name={ok ? 'check-circle' : 'x-circle'} size={32} color={color} />
      </View>

      {result.avatar ? (
        <Image source={{ uri: result.avatar }} style={rs.avatar} />
      ) : result.username ? (
        <View style={[rs.avatar, { backgroundColor: color + '30', alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color, fontSize: 20, fontWeight: '900' }}>
            {result.username[0].toUpperCase()}
          </Text>
        </View>
      ) : null}

      <Text style={[rs.username, { color }]}>
        {result.username ? `@${result.username}` : (ok ? 'Checked In' : 'Denied')}
      </Text>
      <Text style={[rs.msg, { color: ok ? '#10b981' : '#ef4444' }]}>{result.msg}</Text>

      {result.tier && (
        <View style={[rs.tierPill, { backgroundColor: `${color}20`, borderColor: `${color}40` }]}>
          <Text style={{ color, fontSize: 11, fontWeight: '800' }}>{result.tier}</Text>
        </View>
      )}

      <TouchableOpacity style={[rs.dismissBtn, { borderColor: `${color}50` }]} onPress={onDismiss}>
        <Text style={{ color, fontSize: 13, fontWeight: '800' }}>
          {ok ? 'Scan Next' : 'Try Again'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const rs = StyleSheet.create({
  card: {
    position: 'absolute',
    bottom: 32,
    left: 24,
    right: 24,
    backgroundColor: '#0d1112',
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    zIndex: 20,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: 2,
  },
  username: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  msg: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.85,
  },
  tierPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  dismissBtn: {
    marginTop: 6,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
});

// ─── Scan frame overlay ──────────────────────────────────────────────────────

const ScanFrame = ({ primary, scanning }) => {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const lineY = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 220] });

  return (
    <View style={sf.wrap} pointerEvents="none">
      <View style={[sf.frame, { borderColor: scanning ? primary : 'rgba(255,255,255,0.3)' }]}>
        {/* Corners */}
        {[['TL', { top: -1, left: -1 }], ['TR', { top: -1, right: -1 }], ['BL', { bottom: -1, left: -1 }], ['BR', { bottom: -1, right: -1 }]].map(([key, style]) => (
          <View key={key} style={[sf.corner, style, { borderColor: primary }]} />
        ))}
        {/* Scan line */}
        <Animated.View style={[sf.scanLine, { backgroundColor: primary, transform: [{ translateY: lineY }] }]} />
      </View>
      <Text style={[sf.label, { color: scanning ? primary : 'rgba(255,255,255,0.6)' }]}>
        {scanning ? 'Processing...' : 'Point at QR code'}
      </Text>
    </View>
  );
};

const sf = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 240,
    height: 240,
    borderWidth: 1.5,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderWidth: 3,
    borderRadius: 3,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.75,
  },
  label: {
    marginTop: 18,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

// ─── Main component ───────────────────────────────────────────────────────────

export const QRCheckInScanner = ({ eventId, organizerId, primary, textColor, muted, onCheckedIn }) => {
  const [permState, requestPerm] = useCameraPermissions ? useCameraPermissions() : [null, null];
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [checkedInIds, setCheckedInIds] = useState({});
  const [todayCount, setTodayCount] = useState(0);
  const lastScan = useRef(null);
  const cooldown = useRef(false);

  // Load today's check-in count
  useEffect(() => {
    if (!eventId) return;
    supabase
      .from('event_checkins')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .then(({ count }) => setTodayCount(count ?? 0));
  }, [eventId]);

  const enableCamera = async () => {
    if (!useCameraPermissions) return;
    if (!permState?.granted) {
      const res = await requestPerm();
      if (!res.granted) return;
    }
    setCameraEnabled(true);
  };

  const processPayload = useCallback(async (parsed) => {
    if (!parsed || !eventId) return;
    if (parsed.eventId !== eventId) {
      setResult({ ok: false, msg: 'This ticket is for a different event.' });
      return;
    }
    // SECURITY: verify the scanning user is the event organizer server-side
    if (organizerId) {
      const { data: evt } = await supabase
        .from('events').select('author_id').eq('id', eventId).single();
      if (!evt || evt.author_id !== organizerId) {
        setResult({ ok: false, msg: 'Not authorized to check in guests for this event.' });
        return;
      }
    }
    if (checkedInIds[parsed.userId]) {
      setResult({ ok: false, msg: 'Already checked in at this door.', username: lastScan.current?.username });
      return;
    }

    setScanning(true);
    try {
      // Look up the guest's RSVP. event_rsvps is keyed by (event_id, user_id) —
      // there is no standalone rsvp id, so the QR payload's user_id is the identity.
      const { data: rsvp } = await supabase
        .from('event_rsvps')
        .select('status, user_id, profiles:user_id(username, avatar_url, vibe_score)')
        .eq('event_id', eventId)
        .eq('user_id', parsed.userId)
        .maybeSingle();

      if (!rsvp) {
        setResult({ ok: false, msg: 'Ticket not found in guest list.' });
        return;
      }
      if (rsvp.status !== 'going') {
        setResult({
          ok: false,
          msg: `RSVP status: "${rsvp.status}" — not confirmed going.`,
          username: rsvp.profiles?.username,
          avatar: rsvp.profiles?.avatar_url,
        });
        return;
      }

      // Check if already checked in in DB — check-ins are keyed by (event_id, user_id)
      const { data: existing } = await supabase
        .from('event_checkins')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', rsvp.user_id)
        .maybeSingle();

      if (existing) {
        setResult({
          ok: false,
          msg: 'Already checked in (DB).',
          username: rsvp.profiles?.username,
          avatar: rsvp.profiles?.avatar_url,
        });
        setCheckedInIds(prev => ({ ...prev, [rsvp.user_id]: true }));
        return;
      }

      // Mark checked in via secure server-side RPC (validates organiser role + status),
      // falling back to a direct upsert keyed on (event_id, user_id).
      await resilient(
        [
          () => supabase.rpc('secure_check_in', {
            p_event_id: eventId,
            p_user_id: rsvp.user_id,
          }),
          () => supabase.from('event_checkins').upsert({ event_id: eventId, user_id: rsvp.user_id }, { onConflict: 'event_id,user_id' }),
          () => supabase.from('event_checkins').insert({ event_id: eventId, user_id: rsvp.user_id }),
        ],
        { attemptsPerTier: 2, baseMs: 300, label: `QRCheckIn:${rsvp.user_id}`, fallbackValue: null }
      );

      const score = rsvp.profiles?.vibe_score ?? 0;
      const tier = score >= 2001 ? 'Gruv Master' : score >= 501 ? 'Royal Viber' : score >= 101 ? 'Elite Viber' : 'Viber';

      setCheckedInIds(prev => ({ ...prev, [rsvp.user_id]: true }));
      setTodayCount(prev => prev + 1);
      lastScan.current = { username: rsvp.profiles?.username };
      setResult({
        ok: true,
        msg: 'Welcome to the Gruv!',
        username: rsvp.profiles?.username,
        avatar: rsvp.profiles?.avatar_url,
        tier,
      });
      if (Platform.OS !== 'web') {
        Vibration.vibrate([0, 80, 60, 80]);
      }
      onCheckedIn?.({ userId: rsvp.user_id });
    } finally {
      setScanning(false);
    }
  }, [eventId, organizerId, checkedInIds, onCheckedIn]);

  const onBarCodeScanned = useCallback(({ data }) => {
    if (cooldown.current || scanning || result) return;
    if (!data?.startsWith(TICKET_PREFIX)) return;
    const parsed = parsePayload(data);
    if (!parsed) return;
    cooldown.current = true;
    setTimeout(() => { cooldown.current = false; }, 2500);
    processPayload(parsed);
  }, [scanning, result, processPayload]);

  const dismiss = () => {
    setResult(null);
    cooldown.current = false;
  };

  const cameraAvailable = !!CameraView && !!useCameraPermissions;

  return (
    <View style={[qr.wrap, { borderColor: `${primary}20`, backgroundColor: `${primary}05` }]}>
      {/* Header bar */}
      <View style={qr.header}>
        <View style={[qr.headerIcon, { backgroundColor: `${primary}20` }]}>
          <Feather name="camera" size={15} color={primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[qr.headerTitle, { color: textColor }]}>QR Scanner</Text>
          <Text style={[qr.headerSub, { color: muted }]}>{todayCount} checked in today</Text>
        </View>
        {cameraEnabled && (
          <TouchableOpacity onPress={() => { setCameraEnabled(false); setResult(null); }}>
            <Feather name="x" size={18} color={muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Camera view */}
      {cameraEnabled && CameraView ? (
        <View style={qr.cameraWrap}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={result ? undefined : onBarCodeScanned}
          />
          <ScanFrame primary={primary} scanning={scanning} />
          {result && <ResultCard result={result} primary={primary} onDismiss={dismiss} />}
          {scanning && !result && (
            <View style={qr.processingOverlay}>
              <ActivityIndicator color={primary} size="large" />
            </View>
          )}
        </View>
      ) : (
        <View style={qr.launchWrap}>
          {!cameraAvailable ? (
            <View style={qr.unavailableBox}>
              <Feather name="camera-off" size={28} color={muted} />
              <Text style={[qr.unavailableTitle, { color: textColor }]}>Camera Unavailable</Text>
              <Text style={[qr.unavailableBody, { color: muted }]}>
                Camera access requires an EAS dev build. Use the manual check-in tab to search by @username.
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[qr.launchBtn, { backgroundColor: primary }]}
              onPress={enableCamera}
              activeOpacity={0.85}
            >
              <Feather name="camera" size={20} color="#000" />
              <Text style={qr.launchBtnText}>Open Camera Scanner</Text>
            </TouchableOpacity>
          )}
          <View style={qr.instructionRow}>
            <Feather name="info" size={12} color={muted} style={{ marginTop: 1 }} />
            <Text style={[qr.instructionText, { color: muted }]}>
              Scan the QR code on a guest's ticket (The Gruvs app → Tickets tab)
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const qr = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  headerSub: {
    fontSize: 11,
    marginTop: 1,
  },
  cameraWrap: {
    height: 340,
    position: 'relative',
    backgroundColor: '#000',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  launchWrap: {
    padding: 20,
    gap: 14,
    alignItems: 'center',
  },
  launchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
  },
  launchBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '900',
  },
  unavailableBox: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  unavailableTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  unavailableBody: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  instructionRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
    maxWidth: 280,
  },
  instructionText: {
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
});
