/**
 * CallOverlay — the full-screen UI for a 1:1 voice/video call.
 *
 * Rendering the actual media streams is a web concern (RTCPeerConnection gives
 * a MediaStream; on web we attach it to a real <video> element). On native the
 * call feature isn't offered, so the stream views simply don't render.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SmartImage } from './SmartImage';
import { VIDEO_FILTERS } from '../utils/videoFilters';

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

export const CALL_REACTIONS = ['❤️', '😂', '🔥', '😮', '👏', '🥂'];

// One emoji drifting up and fading — mine on the right, theirs on the left.
const FloatingReaction = ({ emoji, mine }) => {
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: 2600, useNativeDriver: true }).start();
  }, [rise]);
  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [0, -190] });
  const opacity = rise.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] });
  const scale = rise.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.6, 1.15, 0.95] });
  return (
    <Animated.Text
      style={{
        position: 'absolute', bottom: 0, fontSize: 34,
        [mine ? 'right' : 'left']: 26 + Math.random() * 40,
        opacity, transform: [{ translateY }, { scale }],
      }}
    >
      {emoji}
    </Animated.Text>
  );
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
  filterKey,
  onPickFilter,
  reactions,        // [{ id, emoji, mine }]
  onSendReaction,
  primary = '#00f2ff',
  onAccept,
  onReject,
  onHangUp,
  onToggleMute,
  onToggleCamera,
  onSwitchCamera,
  onToggleRecord,
  onToggleScreenShare,
}) => {
  const isIncoming = status === 'incoming';

  // Call duration — starts ticking once connected.
  const [secs, setSecs] = useState(0);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status === 'connecting' || status === 'incoming') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulse.setValue(1);
    }
  }, [status, pulse]);

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
              : `${peer?.username || 'They'} is recording`}
          </Text>
        </View>
      )}

      {/* Screen-share notice — the other side is presenting */}
      {peerSharingScreen && status === 'connected' && (
        <View style={[cs.recBanner, { top: (recording || peerRecording) ? 56 : 20, backgroundColor: 'rgba(0,242,255,0.15)', borderColor: primary }]}>
          <Feather name="monitor" size={12} color={primary} />
          <Text style={cs.recText}>{peer?.username || 'They'} is sharing their screen</Text>
        </View>
      )}

      {/* Remote video fills the screen for a connected video call */}
      {video && remoteStream && status === 'connected' ? (
        <View style={StyleSheet.absoluteFill}><StreamVideo stream={remoteStream} /></View>
      ) : (
        <View style={cs.centerStage}>
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            {peer?.avatar_url
              ? <SmartImage source={peer.avatar_url} style={cs.bigAvatar} />
              : <View style={[cs.bigAvatar, { backgroundColor: `${primary}22`, alignItems: 'center', justifyContent: 'center' }]}>
                  <Feather name="user" size={54} color={primary} />
                </View>}
          </Animated.View>
          <Text style={cs.name}>{peer?.username || 'Viber'}</Text>
          <Text style={cs.status}>{label}</Text>
        </View>
      )}

      {/* Local preview (video calls, web) */}
      {video && localStream && !camOff ? (
        <View style={cs.pip}><StreamVideo stream={localStream} muted mirror radius={12} /></View>
      ) : null}

      {/* Floating reactions — drift up and fade on BOTH screens */}
      <View pointerEvents="none" style={cs.reactionLayer}>
        {(reactions || []).map((r) => (
          <FloatingReaction key={r.id} emoji={r.emoji} mine={r.mine} />
        ))}
      </View>

      {/* Quick reactions */}
      {status === 'connected' && (
        <View style={cs.reactionBar}>
          {CALL_REACTIONS.map((e) => (
            <TouchableOpacity key={e} onPress={() => onSendReaction?.(e)} style={cs.reactionBtn}>
              <Text style={{ fontSize: 21 }}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Look filters — only meaningful while sending video */}
      {video && status === 'connected' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={cs.filterStrip}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 14 }}
        >
          {VIDEO_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={() => onPickFilter?.(f)}
              style={[cs.filterChip, filterKey === f.key && { borderColor: primary, backgroundColor: 'rgba(0,242,255,0.18)' }]}
            >
              <Text style={{ color: filterKey === f.key ? primary : '#fff', fontSize: 12, fontWeight: '800' }}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

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
            {video ? (
              <>
                <RoundBtn icon={camOff ? 'video-off' : 'video'} active={camOff} onPress={onToggleCamera} />
                {!camOff && <RoundBtn icon="refresh-cw" onPress={onSwitchCamera} />}
              </>
            ) : null}
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
  reactionLayer: { position: 'absolute', left: 0, right: 0, bottom: 170, height: 220 },
  reactionBar: { position: 'absolute', bottom: 122, flexDirection: 'row', gap: 6, alignSelf: 'center' },
  reactionBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  filterStrip: { position: 'absolute', bottom: 178, left: 0, right: 0, maxHeight: 40 },
  filterChip: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 16, paddingVertical: 7, paddingHorizontal: 13, backgroundColor: 'rgba(0,0,0,0.35)' },
  recText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});
