/**
 * CrewCallModal — the whole crew on one call.
 *
 * A responsive grid of everyone's video (you in the corner tile), with the same
 * controls as a 1:1 call. Mesh-based, so the room is capped at MAX_CREW_CALL
 * and the UI says so rather than degrading mysteriously.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';
import { useBackClose } from '../hooks/useBackClose';
import { GroupCall, MAX_CREW_CALL } from '../services/groupCall';
import { isCallSupported } from '../services/webrtcCall';
import { permissionHint } from '../utils/permissions';

const Tile = ({ stream, label, muted, mirror, primary }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <View style={[s.tile, { borderColor: `${primary}30` }]}>
      {Platform.OS === 'web' && stream
        ? React.createElement('video', {
            ref, autoPlay: true, playsInline: true, muted: !!muted,
            style: {
              width: '100%', height: '100%', objectFit: 'cover',
              transform: mirror ? 'scaleX(-1)' : 'none', background: '#000',
            },
          })
        : (
          <View style={s.tilePlaceholder}>
            <Feather name="user" size={26} color={primary} />
          </View>
        )}
      <View style={s.tileLabel}><Text style={s.tileLabelText} numberOfLines={1}>{label}</Text></View>
    </View>
  );
};

export function CrewCallModal({ visible, crew, onClose }) {
  useBackClose(visible, onClose);
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const { width } = useWindowDimensions();

  const primary = crew?.color || currentTheme?.primary || '#00f2ff';
  const bg = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  const callRef = useRef(null);
  const [peers, setPeers] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [joining, setJoining] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [video, setVideo] = useState(true);

  const leave = useCallback(async () => {
    await callRef.current?.leave();
    callRef.current = null;
    setInCall(false); setPeers([]); setLocalStream(null);
    setIsMuted(false); setCamOff(false);
  }, []);

  // Always release the camera when the sheet closes or unmounts.
  useEffect(() => { if (!visible && inCall) leave(); }, [visible, inCall, leave]);
  useEffect(() => () => { callRef.current?.leave(); }, []);

  const join = async (withVideo) => {
    if (!crew?.id || !user?.id) return;
    setVideo(withVideo);
    setJoining(true);
    const gc = new GroupCall({
      crewId: crew.id,
      selfId: user.id,
      selfName: user.user_metadata?.username || 'viber',
      video: withVideo,
      onPeersChanged: setPeers,
      onLocalStream: setLocalStream,
      onError: (err) => toast?.show(permissionHint(err, withVideo ? 'camera and mic' : 'microphone'), 'error'),
    });
    callRef.current = gc;
    const ok = await gc.join();
    setJoining(false);
    if (ok) setInCall(true); else { callRef.current = null; }
  };

  const total = peers.length + 1;
  const cols = total <= 2 ? 1 : 2;
  const sheetW = Math.min(width, 720) - 36;
  const tileW = cols === 1 ? sheetW : (sheetW - 10) / 2;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.backdrop}>
        <View style={[s.sheet, { backgroundColor: bg }]}>
          <View style={s.header}>
            <Feather name="users" size={19} color={primary} />
            <Text style={[s.title, { color: textColor }]} numberOfLines={1}>
              {crew?.name || 'Crew'} call
            </Text>
            <TouchableOpacity onPress={() => { leave(); onClose?.(); }} accessibilityLabel="Close">
              <Feather name="x" size={22} color={muted} />
            </TouchableOpacity>
          </View>

          {!isCallSupported() ? (
            <Text style={[s.note, { color: muted }]}>
              Crew calls run in the browser for now — open The Gruvs on the web to call your crew.
            </Text>
          ) : !inCall ? (
            <View style={{ paddingVertical: 10 }}>
              <Text style={[s.note, { color: muted }]}>
                Everyone who joins connects directly to everyone else — no server in the middle.
                Best with up to {MAX_CREW_CALL} people.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity onPress={() => join(false)} disabled={joining} style={[s.joinBtn, { borderColor: primary }]}>
                  <Feather name="phone" size={16} color={primary} />
                  <Text style={[s.joinText, { color: primary }]}>Voice</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => join(true)} disabled={joining} style={[s.joinBtn, { backgroundColor: primary, borderColor: primary }]}>
                  {joining ? <ActivityIndicator color="#000" /> : (
                    <>
                      <Feather name="video" size={16} color="#000" />
                      <Text style={[s.joinText, { color: '#000' }]}>Video</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <View style={s.grid}>
                <View style={{ width: tileW, height: tileW * 0.72 }}>
                  <Tile stream={localStream} label="You" muted mirror primary={primary} />
                </View>
                {peers.map((p) => (
                  <View key={p.id} style={{ width: tileW, height: tileW * 0.72 }}>
                    <Tile stream={p.stream} label={`@${p.username}`} primary={primary} />
                  </View>
                ))}
              </View>

              {peers.length === 0 && (
                <Text style={[s.note, { color: muted, textAlign: 'center' }]}>
                  Waiting for your crew to join…
                </Text>
              )}

              <View style={s.controls}>
                <TouchableOpacity onPress={() => setIsMuted(callRef.current?.toggleMute() ?? false)} style={[s.ctrl, isMuted && s.ctrlOn]}>
                  <Feather name={isMuted ? 'mic-off' : 'mic'} size={20} color={isMuted ? '#000' : '#fff'} />
                </TouchableOpacity>
                {video && (
                  <TouchableOpacity onPress={() => setCamOff(callRef.current?.toggleCamera() ?? false)} style={[s.ctrl, camOff && s.ctrlOn]}>
                    <Feather name={camOff ? 'video-off' : 'video'} size={20} color={camOff ? '#000' : '#fff'} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => { leave(); onClose?.(); }} style={[s.ctrl, { backgroundColor: '#ef4444' }]}>
                  <Feather name="phone-off" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, paddingBottom: 28, maxHeight: '92%' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  title: { flex: 1, fontSize: 17, fontWeight: '900' },
  note: { fontSize: 12, lineHeight: 18 },
  joinBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 24, paddingVertical: 13 },
  joinText: { fontWeight: '900', fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  tile: { flex: 1, borderRadius: 14, overflow: 'hidden', borderWidth: 1, backgroundColor: '#000' },
  tilePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  tileLabel: { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  tileLabelText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  controls: { flexDirection: 'row', gap: 16, justifyContent: 'center', marginTop: 18 },
  ctrl: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  ctrlOn: { backgroundColor: 'rgba(255,255,255,0.9)' },
});
