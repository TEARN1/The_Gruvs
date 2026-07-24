/**
 * CallOverlay — the full-screen UI for a 1:1 voice/video call.
 *
 * Rendering the actual media streams is a web concern (RTCPeerConnection gives
 * a MediaStream; on web we attach it to a real <video> element). On native the
 * call feature isn't offered, so the stream views simply don't render.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SmartImage } from './SmartImage';

// A live <video> bound to a MediaStream. Web only.
const StreamVideo = ({ stream, muted, mirror, radius = 0 }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);
  if (Platform.OS !== 'web') return null;
  return React.createElement('video', {
    ref,
    autoPlay: true,
    playsInline: true,
    muted: !!muted,
    style: {
      width: '100%', height: '100%', objectFit: 'cover',
      borderRadius: radius,
      transform: mirror ? 'scaleX(-1)' : 'none',
      background: '#000',
    },
  });
};

const RoundBtn = ({ icon, onPress, active, danger, color }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      cs.roundBtn,
      danger && { backgroundColor: '#ef4444' },
      active && { backgroundColor: 'rgba(255,255,255,0.9)' },
    ]}
  >
    <Feather name={icon} size={22} color={danger ? '#fff' : active ? '#000' : (color || '#fff')} />
  </TouchableOpacity>
);

const fmtDur = (s) => {
  const m = Math.floor(s / 60), ss = s % 60;
  return `${m}:${String(ss).padStart(2, '0')}`;
};

export const CallOverlay = ({
  status,        // 'incoming' | 'connecting' | 'connected' | 'ringing'
  video,         // is this a video call
  peer,          // { username, avatar_url }
  localStream,
  remoteStream,
  muted,
  camOff,
  recording,        // am I recording
  peerRecording,    // is the other side recording
  canRecord,
  sharingScreen,
  peerSharingScreen,
  canShareScreen,
  primary = '#00f2ff',
  onAccept,
  onReject,
  onHangUp,
  onToggleMute,
  onToggleCamera,
  onToggleRecord,
  onToggleScreenShare,
}) => {
  const isIncoming = status === 'incoming';

  // Call duration — starts ticking once connected.
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (status !== 'connected') { setSecs(0); return; }
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  const label = isIncoming
    ? (video ? 'Incoming video call' : 'Incoming call')
    : status === 'connected' ? fmtDur(secs)
    : 'Calling…';

  return (
    <View style={cs.root}>
      {/* Recording banner — always visible to BOTH parties (consent) */}
      {(recording || peerRecording) && (
        <View style={cs.recBanner}>
          <View style={cs.recDot} />
          <Text style={cs.recText}>
            {recording && peerRecording ? 'Both recording'
              : recording ? 'You are recording'
              : `@${peer?.username || 'They'} is recording`}
          </Text>
        </View>
      )}

      {/* Screen-share notice — the other side is presenting */}
      {peerSharingScreen && status === 'connected' && (
        <View style={[cs.recBanner, { top: (recording || peerRecording) ? 56 : 20, backgroundColor: 'rgba(0,242,255,0.15)', borderColor: primary }]}>
          <Feather name="monitor" size={12} color={primary} />
          <Text style={cs.recText}>@{peer?.username || 'They'} is sharing their screen</Text>
        </View>
      )}

      {/* Remote video fills the screen for a connected video call */}
      {video && remoteStream && status === 'connected' ? (
        <View style={StyleSheet.absoluteFill}><StreamVideo stream={remoteStream} /></View>
      ) : (
        <View style={cs.centerStage}>
          {peer?.avatar_url
            ? <SmartImage source={peer.avatar_url} style={cs.bigAvatar} />
            : <View style={[cs.bigAvatar, { backgroundColor: `${primary}22`, alignItems: 'center', justifyContent: 'center' }]}>
                <Feather name="user" size={54} color={primary} />
              </View>}
          <Text style={cs.name}>@{peer?.username || 'Viber'}</Text>
          <Text style={cs.status}>{label}</Text>
        </View>
      )}

      {/* Local preview (video calls, web) */}
      {video && localStream && !camOff ? (
        <View style={cs.pip}><StreamVideo stream={localStream} muted mirror radius={12} /></View>
      ) : null}

      {/* Controls */}
      <View style={cs.controls}>
        {isIncoming ? (
          <>
            <RoundBtn icon="phone-off" danger onPress={onReject} />
            <RoundBtn icon="phone" onPress={onAccept} color="#10b981" />
          </>
        ) : (
          <>
            <RoundBtn icon={muted ? 'mic-off' : 'mic'} active={muted} onPress={onToggleMute} />
            {video ? <RoundBtn icon={camOff ? 'video-off' : 'video'} active={camOff} onPress={onToggleCamera} /> : null}
            {canShareScreen && status === 'connected'
              ? <RoundBtn icon="monitor" active={sharingScreen} onPress={onToggleScreenShare} />
              : null}
            {canRecord && status === 'connected'
              ? <RoundBtn icon={recording ? 'square' : 'circle'} active={recording} onPress={onToggleRecord} color="#ef4444" />
              : null}
            <RoundBtn icon="phone-off" danger onPress={onHangUp} />
          </>
        )}
      </View>
    </View>
  );
};

const cs = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0a0d0e', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  centerStage: { alignItems: 'center', gap: 12, paddingBottom: 60 },
  bigAvatar: { width: 120, height: 120, borderRadius: 60 },
  name: { color: '#fff', fontSize: 22, fontWeight: '900' },
  status: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600' },
  pip: { position: 'absolute', top: 24, right: 16, width: 110, height: 150, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  controls: { position: 'absolute', bottom: 48, flexDirection: 'row', gap: 18, alignItems: 'center' },
  roundBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  recBanner: { position: 'absolute', top: 20, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(239,68,68,0.18)', borderColor: '#ef4444', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, zIndex: 60 },
  recDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#ef4444' },
  recText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});
