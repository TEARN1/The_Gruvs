/**
 * CallContext — one place that owns the app's single voice/video call.
 *
 * Why global: the pair signalling channel only carries an offer once BOTH sides
 * are subscribed. If the callee is anywhere other than that exact chat thread,
 * the offer is lost and the call "rings forever". This provider fixes that by
 * always listening on the user's per-user ring channel, so an incoming call
 * surfaces from any screen — and by owning the one active PeerSession, so an
 * outgoing call started in a chat and an incoming call answered from a banner
 * can never collide into two sessions on the same channel.
 *
 * DirectMessageModal delegates its call buttons here via useCall().startCall.
 * Web-first: on native isCallSupported() is false, so this renders nothing and
 * startCall is a friendly no-op.
 */
import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { PeerSession, isCallSupported, ringChannelName, ringUser } from '../services/webrtcCall';
import { CallOverlay } from '../components/CallOverlay';
import { PermissionGuideModal } from '../components/PermissionGuideModal';
import { SoundFX } from '../services/soundFX';
import { MessageManager } from '../services/dataFlow';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { useToast } from '../components/ToastNotification';

// Native haptic buzz on incoming ring — guarded so a missing module or the web
// platform is simply a silent no-op (never throws into the call UI).
const Haptics = {
  notify() {
    try {
      const H = require('expo-haptics');
      H.notificationAsync?.(H.NotificationFeedbackType?.Warning).catch?.(() => {});
    } catch { /* web / not installed → no haptics */ }
  },
};

const CallContext = createContext({ startCall: () => {}, callSupported: false, inCall: false });
export const useCall = () => useContext(CallContext);

export function CallProvider({ children }) {
  const { user, profile } = useAuth();
  const { currentTheme } = useTheme();
  const { show: showToast } = useToast();
  const primary = currentTheme?.primary || '#00f2ff';

  const supported = isCallSupported();

  const callRef = useRef(null);      // the one live PeerSession
  const peerRef = useRef(null);      // { id, username, avatar_url } we're talking to
  const callStartRef = useRef(null); // ms when it actually connected
  const callMetaRef = useRef(null);  // { video, role } for the summary line
  const roleRef = useRef(null);      // 'caller' | 'callee' for this call
  const videoRef = useRef(false);    // was this a video call
  const connectedRef = useRef(false);// did media ever connect (answered)
  const ringTimerRef = useRef(null); // no-answer timeout

  const [peer, setPeer] = useState(null);
  const [call, setCall] = useState(null); // { status, video, role } | null
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callMuted, setCallMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [recording, setRecording] = useState(false);
  const [peerRecording, setPeerRecording] = useState(false);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [peerSharingScreen, setPeerSharingScreen] = useState(false);
  const [filterKey, setFilterKey] = useState('none');
  const [callReactions, setCallReactions] = useState([]);
  const [permGuide, setPermGuide] = useState(null); // { reason, needVideo }

  const pushCallReaction = useCallback((emoji, mine) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setCallReactions((prev) => [...prev.slice(-14), { id, emoji, mine }]);
    setTimeout(() => setCallReactions((prev) => prev.filter((r) => r.id !== id)), 2800);
  }, []);

  // Leave a call-log line in the thread — "📞 Voice call · 4:12" when answered,
  // "📞 Missed voice call" when not. It's a normal message, so both sides see
  // when they were called (the message timestamp) and can reply to it.
  //
  // Only the CALLER writes it: one entry per call in the shared thread, no
  // duplicate from each end. A missed/declined/cancelled call still logs so the
  // callee can see they were rung.
  const postCallSummary = useCallback(async () => {
    const startedAt = callStartRef.current;
    const other = peerRef.current;
    const wasConnected = connectedRef.current;
    const video = videoRef.current;
    const role = roleRef.current;
    callStartRef.current = null; callMetaRef.current = null; connectedRef.current = false;
    if (role !== 'caller' || !user?.id || !other?.id) return;
    let body;
    if (wasConnected && startedAt) {
      const secs = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      const mm = Math.floor(secs / 60), ss = secs % 60;
      body = `${video ? '📹 Video call' : '📞 Voice call'} · ${mm}:${String(ss).padStart(2, '0')}`;
    } else {
      body = video ? '📹 Missed video call' : '📞 Missed voice call';
    }
    try { await MessageManager.send(user.id, other.id, body); } catch { /* a missing log must never surface */ }
  }, [user?.id]);

  const endCallLocal = useCallback(() => {
    if (ringTimerRef.current) { clearTimeout(ringTimerRef.current); ringTimerRef.current = null; }
    setCall(null); setLocalStream(null); setRemoteStream(null);
    setCallMuted(false); setCamOff(false); setRecording(false); setPeerRecording(false);
    setSharingScreen(false); setPeerSharingScreen(false); setFilterKey('none'); setCallReactions([]);
    postCallSummary();
    callRef.current = null; // peerRef kept so a permission-retry still knows who
  }, [postCallSummary]);

  // Build a session wired to our state for a given peer id.
  const buildSession = useCallback((peerId) => new PeerSession({
    selfId: user.id,
    peerId,
    onLocalStream: setLocalStream,
    onRemoteStream: setRemoteStream,
    onIncoming: ({ video }) => setCall((c) => c || { status: 'incoming', video, role: 'callee' }),
    onPeerRecording: (on) => setPeerRecording(on),
    onPeerScreenShare: (on) => setPeerSharingScreen(on),
    onPeerReaction: (emoji) => pushCallReaction(emoji, false),
    onStatus: (st) => {
      if (st === 'connected') {
        connectedRef.current = true;
        if (ringTimerRef.current) { clearTimeout(ringTimerRef.current); ringTimerRef.current = null; }
        callStartRef.current = Date.now();
        setCall((c) => { if (c) callMetaRef.current = { video: c.video, role: c.role }; return c ? { ...c, status: 'connected' } : c; });
      } else if (st === 'ended' || st === 'failed') {
        endCallLocal();
      }
    },
  }), [user?.id, pushCallReaction, endCallLocal]);

  // Start an outgoing call. targetPeer: { id, username, avatar_url }.
  const startCall = useCallback(async (targetPeer, video) => {
    if (!supported) { showToast('Calls aren\'t available on this device yet.', 'info'); return; }
    if (!user?.id || !targetPeer?.id) return;
    if (callRef.current) { showToast('You\'re already in a call.', 'info'); return; }
    peerRef.current = targetPeer; setPeer(targetPeer);
    roleRef.current = 'caller'; videoRef.current = !!video; connectedRef.current = false;
    const session = buildSession(targetPeer.id);
    callRef.current = session;
    setCall({ status: 'connecting', video: !!video, role: 'caller' });
    // No-answer timeout: if they haven't picked up in 35s, tear down — endCall
    // logs it as a missed call.
    if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
    ringTimerRef.current = setTimeout(() => {
      if (!connectedRef.current && callRef.current) { try { callRef.current.hangUp(); } catch {} endCallLocal(); }
    }, 35000);
    // Ring them app-wide so they get the incoming call from any screen, then
    // place the call on the pair channel.
    ringUser({
      fromId: user.id,
      toId: targetPeer.id,
      fromProfile: { id: user.id, username: profile?.username, avatar_url: profile?.avatar_url },
      video: !!video,
    });
    try {
      await session.call(!!video);
    } catch (e) {
      setCall(null); setLocalStream(null);
      try { session.destroy(); } catch {}
      callRef.current = null;
      setPermGuide({ reason: e?.mediaError || 'unknown', needVideo: !!video });
    }
  }, [supported, user?.id, profile?.username, profile?.avatar_url, buildSession, showToast]);

  const acceptCall = useCallback(async () => {
    if (ringTimerRef.current) { clearTimeout(ringTimerRef.current); ringTimerRef.current = null; }
    try { await callRef.current?.accept(); setCall((c) => (c ? { ...c, status: 'connecting' } : c)); }
    catch (e) {
      const wasVideo = !!call?.video;
      try { callRef.current?.destroy(); } catch {}
      endCallLocal();
      setPermGuide({ reason: e?.mediaError || 'unknown', needVideo: wasVideo });
    }
  }, [call?.video, endCallLocal]);

  const rejectCall = useCallback(() => { callRef.current?.reject(); endCallLocal(); }, [endCallLocal]);
  const hangUp = useCallback(() => { callRef.current?.hangUp(); endCallLocal(); }, [endCallLocal]);
  const toggleCallMute = useCallback(() => setCallMuted(callRef.current?.toggleMute() ?? false), []);
  const toggleCallCam = useCallback(() => setCamOff(callRef.current?.toggleCamera() ?? false), []);

  const sendCallReaction = useCallback((emoji) => {
    pushCallReaction(emoji, true);
    callRef.current?.sendReaction(emoji);
  }, [pushCallReaction]);

  const pickFilter = useCallback(async (f) => {
    setFilterKey(f.key);
    const ok = await callRef.current?.setVideoFilter(f.css);
    if (ok === false) { setFilterKey('none'); showToast("Filters aren't supported on this device.", 'info'); }
  }, [showToast]);

  const toggleScreenShare = useCallback(async () => {
    const s = callRef.current;
    if (!s) return;
    if (sharingScreen) { await s.stopScreenShare(); setSharingScreen(false); }
    else {
      const ok = await s.startScreenShare();
      setSharingScreen(ok);
      if (!ok) showToast('Screen sharing was cancelled or is unavailable here.', 'info');
    }
  }, [sharingScreen, showToast]);

  const toggleRecord = useCallback(async () => {
    const s = callRef.current;
    if (!s) return;
    if (recording) {
      const blob = await s.stopRecording();
      setRecording(false);
      if (blob && typeof document !== 'undefined') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gruvs-call-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.webm`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        showToast('Recording saved.', 'success');
      }
    } else {
      if (s.startRecording()) setRecording(true);
      else showToast("Can't record this call on this device.", 'error');
    }
  }, [recording, showToast]);

  // Audible call state: the callee hears the incoming "ringtone", the caller
  // hears the softer "ringback" purr while waiting for a pick-up. Different
  // sounds so each end always knows which side of the call it's on.
  useEffect(() => {
    if (!call) return;
    const isIncoming = call.status === 'incoming';
    const isCallerWaiting = call.role === 'caller' && call.status === 'connecting';
    if (!isIncoming && !isCallerWaiting) return;
    const name = isIncoming ? 'ringtone' : 'ringback';
    SoundFX.play(name);
    if (isIncoming) Haptics.notify();
    const id = setInterval(() => {
      SoundFX.play(name);
      if (isIncoming) Haptics.notify();
    }, isIncoming ? 1800 : 3200);
    return () => clearInterval(id);
  }, [call?.status, call?.role]);

  // Always-on incoming-call listener — the whole point of this being global.
  useEffect(() => {
    if (!supported || !user?.id) return;
    const ch = supabase.channel(ringChannelName(user.id), { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'ring' }, ({ payload }) => {
      if (!payload?.from) return;
      if (callRef.current) return; // already busy — ignore (caller will time out)
      const from = payload.from;
      const fromProfile = payload.fromProfile && payload.fromProfile.id
        ? payload.fromProfile
        : { id: from, username: 'Viber' };
      peerRef.current = fromProfile; setPeer(fromProfile);
      roleRef.current = 'callee'; videoRef.current = !!payload.video; connectedRef.current = false;
      const session = buildSession(from);
      callRef.current = session;
      setCall({ status: 'incoming', video: !!payload.video, role: 'callee' });
      // Subscribe to the pair channel and announce 'join' so the caller resends
      // the offer — this is what lets us answer from outside the chat thread.
      session.listen().catch(() => {});
      // Auto-dismiss an unanswered incoming call so it doesn't ring forever; the
      // caller writes the "missed call" log on their end.
      if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
      ringTimerRef.current = setTimeout(() => {
        if (!connectedRef.current && callRef.current) { try { callRef.current.reject(); } catch {} endCallLocal(); }
      }, 40000);
    });
    ch.subscribe();
    return () => { try { supabase.removeChannel(ch); } catch {} };
  }, [supported, user?.id, buildSession, endCallLocal]);

  // Tear the call down if the user logs out.
  useEffect(() => {
    if (!user?.id && callRef.current) { try { callRef.current.destroy(); } catch {} endCallLocal(); }
  }, [user?.id, endCallLocal]);

  const value = { startCall, callSupported: supported, inCall: !!call };

  return (
    <CallContext.Provider value={value}>
      {children}
      {call && (
        <CallOverlay
          status={call.status}
          video={call.video}
          peer={peer}
          localStream={localStream}
          remoteStream={remoteStream}
          muted={callMuted}
          camOff={camOff}
          recording={recording}
          peerRecording={peerRecording}
          canRecord={callRef.current?.canRecord?.()}
          sharingScreen={sharingScreen}
          peerSharingScreen={peerSharingScreen}
          canShareScreen={callRef.current?.canShareScreen?.()}
          filterKey={filterKey}
          onPickFilter={pickFilter}
          reactions={callReactions}
          onSendReaction={sendCallReaction}
          primary={primary}
          onAccept={acceptCall}
          onReject={rejectCall}
          onHangUp={hangUp}
          onToggleMute={toggleCallMute}
          onToggleCamera={toggleCallCam}
          onToggleRecord={toggleRecord}
          onToggleScreenShare={toggleScreenShare}
        />
      )}
      <PermissionGuideModal
        visible={!!permGuide}
        reason={permGuide?.reason}
        needVideo={permGuide?.needVideo}
        kind={permGuide?.needVideo ? 'camera and mic' : 'microphone'}
        onGranted={() => { const p = peerRef.current; setPermGuide(null); if (p) startCall(p, !!permGuide?.needVideo); }}
        onClose={() => setPermGuide(null)}
      />
    </CallContext.Provider>
  );
}
