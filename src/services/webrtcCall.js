/**
 * webrtcCall.js — 1:1 voice/video calling with no paid infrastructure.
 *
 * Transport: a per-pair Supabase Realtime broadcast channel carries the WebRTC
 * signalling (offer / answer / ICE / end). Media: the browser's own
 * RTCPeerConnection, connected peer-to-peer using free public STUN servers —
 * so a normal call costs nothing. (Strict-NAT calls would need a TURN relay,
 * which is the one thing that would ever cost money; not included yet.)
 *
 * WEB-FIRST: RTCPeerConnection + getUserMedia are browser APIs. On React
 * Native (no react-native-webrtc dev build) isCallSupported() returns false and
 * the UI offers calls only where they actually work, instead of pretending.
 *
 * This is deliberately self-contained and honest — it does not fake a
 * connection, and every failure path tears the session down cleanly.
 */
import { supabase } from './supabase';
import { requestMedia } from '../utils/permissions';
import { createFilteredVideoTrack } from '../utils/videoFilters';

const RTC = (typeof globalThis !== 'undefined' && globalThis.RTCPeerConnection) || null;

export function isCallSupported() {
  return !!RTC
    && typeof navigator !== 'undefined'
    && !!navigator.mediaDevices
    && typeof navigator.mediaDevices.getUserMedia === 'function';
}

const ICE_CONFIG = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: ['stun:stun2.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
  ],
  // Gather candidates BEFORE the user hits call, so the handshake doesn't spend
  // its first second discovering the network — this is most of the "why does it
  // take so long before they can hear me" delay.
  iceCandidatePoolSize: 4,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

// Audio must never lose bandwidth to video: cap the video sender and mark the
// audio sender high-priority. On a squeezed uplink the picture degrades and the
// voice stays clean — the trade every user actually wants.
const VIDEO_MAX_BITRATE = 900_000; // ~0.9 Mbps is plenty for 720p talking heads

async function tuneSenders(pc) {
  for (const sender of pc.getSenders()) {
    if (!sender.track) continue;
    try {
      const params = sender.getParameters();
      if (!params.encodings || !params.encodings.length) params.encodings = [{}];
      if (sender.track.kind === 'video') {
        params.encodings[0].maxBitrate = VIDEO_MAX_BITRATE;
        params.encodings[0].priority = 'low';
        params.encodings[0].networkPriority = 'low';
        params.degradationPreference = 'maintain-framerate';
      } else {
        params.encodings[0].priority = 'high';
        params.encodings[0].networkPriority = 'high';
      }
      await sender.setParameters(params);
    } catch { /* setParameters is best-effort across browsers */ }
  }
}

// One live call between two users. Callbacks let the UI react without knowing
// any WebRTC detail.
export class PeerSession {
  constructor({ selfId, peerId, onRemoteStream, onLocalStream, onStatus, onIncoming, onPeerRecording, onPeerScreenShare, onPeerReaction, sharedStream }) {
    this.selfId = selfId;
    this.peerId = peerId;
    this.onRemoteStream = onRemoteStream;
    this.onLocalStream = onLocalStream;
    this.onStatus = onStatus;             // 'connecting' | 'connected' | 'ended' | 'failed'
    this.onIncoming = onIncoming;         // ({ video }) — an offer arrived
    this.onPeerRecording = onPeerRecording; // (bool) — the OTHER side started/stopped recording
    this.onPeerScreenShare = onPeerScreenShare; // (bool) — the OTHER side is sharing their screen
    this.onPeerReaction = onPeerReaction;   // (emoji) — they tapped a reaction
    this.channelName = `rtc:${[selfId, peerId].sort().join('__')}`;
    this.pc = null;
    this.channel = null;
    this.localStream = null;
    this.remoteStream = null;
    this._pendingOffer = null;
    this._pendingIce = [];
    this._destroyed = false;
    this._recorder = null;
    this._recChunks = [];
    this._screenStream = null;
    this._camTrack = null;
    this._filter = null;
    this._filterSource = null;
    // Group calls acquire ONE camera/mic and hand the same stream to every
    // peer connection — otherwise a 4-way call would prompt for the camera
    // four times and run four capture pipelines.
    this.sharedStream = sharedStream || null;
  }

  // Subscribe to the signalling channel. Callee calls this on mount so an
  // incoming offer is caught even before it presses anything.
  async listen() {
    if (this.channel) return;
    this.channel = supabase.channel(this.channelName, { config: { broadcast: { self: false } } });
    this.channel.on('broadcast', { event: 'signal' }, ({ payload }) => this._onSignal(payload));
    await new Promise((resolve) => {
      this.channel.subscribe((status) => { if (status === 'SUBSCRIBED') resolve(); });
    });
  }

  _send(type, data = {}) {
    this.channel?.send({ type: 'broadcast', event: 'signal', payload: { type, from: this.selfId, to: this.peerId, ...data } });
  }

  async _makePc(video) {
    const pc = new RTC(ICE_CONFIG);
    pc.onicecandidate = (e) => { if (e.candidate) this._send('ice', { candidate: e.candidate }); };
    pc.ontrack = (e) => { this.remoteStream = e.streams[0]; this.onRemoteStream?.(e.streams[0]); };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'connected') this.onStatus?.('connected');
      else if (st === 'failed') { this.onStatus?.('failed'); this.destroy(); }
      else if (st === 'disconnected' || st === 'closed') this.onStatus?.('ended');
    };
    if (this.sharedStream) {
      this.localStream = this.sharedStream;
    } else {
      // Typed permission errors so the UI can say exactly what to fix.
      const media = await requestMedia({ video });
      if (!media.ok) { const err = new Error('media-' + media.error); err.mediaError = media.error; throw err; }
      this.localStream = media.stream;
    }
    this.onLocalStream?.(this.localStream);
    this.localStream.getTracks().forEach((t) => pc.addTrack(t, this.localStream));
    this.pc = pc;
    await tuneSenders(pc);   // audio high-priority, video bitrate-capped
    return pc;
  }

  // Caller: get mic/cam, create the offer, send it.
  async call(video) {
    this.video = !!video;
    await this.listen();
    this.onStatus?.('connecting');
    const pc = await this._makePc(video);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this._send('offer', { sdp: offer, video: !!video });
  }

  // Callee: accept the pending offer.
  async accept() {
    if (!this._pendingOffer) return;
    this.onStatus?.('connecting');
    const pc = await this._makePc(this._pendingOffer.video);
    await pc.setRemoteDescription(this._pendingOffer.sdp);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this._send('answer', { sdp: answer });
    // Drain any ICE that arrived before the remote description was set.
    for (const c of this._pendingIce.splice(0)) { try { await pc.addIceCandidate(c); } catch {} }
  }

  reject() { this._send('end', { reason: 'rejected' }); this.destroy(); }
  hangUp() { this._send('end', { reason: 'hangup' }); this.destroy(); }

  toggleMute() {
    const track = this.localStream?.getAudioTracks?.()[0];
    if (track) { track.enabled = !track.enabled; return !track.enabled; }
    return false;
  }

  toggleCamera() {
    const track = this.localStream?.getVideoTracks?.()[0];
    if (track) { track.enabled = !track.enabled; return !track.enabled; }
    return false;
  }

  // ── Live look filter ─────────────────────────────────────────────────────
  // Routes the camera through a canvas and sends THAT, so the other person
  // sees the filter too. Swapped via replaceTrack — no renegotiation.
  async setVideoFilter(css) {
    if (!this.pc || !this.localStream) return false;
    const sender = this.pc.getSenders().find((s) => s.track && s.track.kind === 'video');
    if (!sender) return false;

    // Back to the raw camera.
    if (!css || css === 'none') {
      if (!this._filter) return true;
      const cam = this._filterSource || this.localStream.getVideoTracks()[0];
      try { await sender.replaceTrack(cam); } catch {}
      this._filter.stop(); this._filter = null; this._filterSource = null;
      await tuneSenders(this.pc);
      return true;
    }

    // Already filtering — just change the look, no track churn.
    if (this._filter) { this._filter.setFilter(css); return true; }

    const cam = this.localStream.getVideoTracks()[0];
    if (!cam) return false;
    const filtered = createFilteredVideoTrack(this.localStream, css);
    if (!filtered) return false;
    this._filterSource = cam;
    this._filter = filtered;
    try { await sender.replaceTrack(filtered.track); } catch { return false; }
    await tuneSenders(this.pc);
    return true;
  }

  // ── In-call reactions ────────────────────────────────────────────────────
  // A tiny broadcast — the emoji floats on BOTH screens.
  sendReaction(emoji) {
    if (!emoji) return;
    this._send('react', { emoji: String(emoji).slice(0, 8) });
  }

  // ── Screen share ─────────────────────────────────────────────────────────
  // Swaps the outgoing video track for a display capture, then restores the
  // camera when the user stops sharing (browsers fire 'ended' on the track's
  // own "Stop sharing" bar, so that path is handled too).
  canShareScreen() {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia && !!this.pc;
  }

  async startScreenShare() {
    if (!this.canShareScreen() || this._screenStream) return false;
    let display;
    try {
      display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    } catch { return false; } // user cancelled the picker
    const track = display.getVideoTracks()[0];
    if (!track) return false;
    const sender = this.pc.getSenders().find((s) => s.track && s.track.kind === 'video');
    if (!sender) { track.stop(); return false; }
    this._camTrack = sender.track;
    await sender.replaceTrack(track);
    await tuneSenders(this.pc);   // the new track needs the same caps
    this._screenStream = display;
    track.onended = () => { this.stopScreenShare().catch(() => {}); };
    this._send('screen', { on: true });
    return true;
  }

  async stopScreenShare() {
    if (!this._screenStream) return false;
    try { this._screenStream.getTracks().forEach((t) => t.stop()); } catch {}
    this._screenStream = null;
    const sender = this.pc?.getSenders().find((s) => s.track && s.track.kind === 'video');
    if (sender && this._camTrack) {
      try { await sender.replaceTrack(this._camTrack); await tuneSenders(this.pc); } catch {}
    }
    this._camTrack = null;
    this._send('screen', { on: false });
    return true;
  }

  // ── Recording (browser-native MediaRecorder; records the OTHER person's
  //    stream, which is what you'd want to keep). Broadcasts a consent flag so
  //    the other side always sees a "REC" badge — never record silently. ──────
  canRecord() {
    return typeof MediaRecorder !== 'undefined' && !!(this.remoteStream || this.localStream);
  }

  startRecording() {
    if (this._recorder) return false;
    const stream = this.remoteStream || this.localStream;
    if (!stream || typeof MediaRecorder === 'undefined') return false;
    const mime = ['video/webm;codecs=vp8,opus', 'video/webm', 'audio/webm']
      .find((m) => MediaRecorder.isTypeSupported?.(m)) || '';
    try {
      this._recChunks = [];
      this._recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      this._recorder.ondataavailable = (e) => { if (e.data && e.data.size) this._recChunks.push(e.data); };
      this._recorder.start(1000);
      this._send('rec', { on: true });   // consent: tell the other side
      return true;
    } catch { this._recorder = null; return false; }
  }

  // Resolves to a Blob (webm) or null.
  stopRecording() {
    return new Promise((resolve) => {
      const rec = this._recorder;
      if (!rec) return resolve(null);
      rec.onstop = () => {
        const type = rec.mimeType || 'video/webm';
        const blob = this._recChunks.length ? new Blob(this._recChunks, { type }) : null;
        this._recorder = null;
        this._recChunks = [];
        this._send('rec', { on: false });
        resolve(blob);
      };
      try { rec.stop(); } catch { this._recorder = null; resolve(null); }
    });
  }

  async _onSignal(p) {
    if (this._destroyed || p.to !== this.selfId || p.from !== this.peerId) return;
    try {
      if (p.type === 'offer') {
        this._pendingOffer = { sdp: p.sdp, video: p.video };
        this.onIncoming?.({ video: p.video });
      } else if (p.type === 'answer') {
        await this.pc?.setRemoteDescription(p.sdp);
      } else if (p.type === 'ice') {
        if (this.pc?.remoteDescription) { try { await this.pc.addIceCandidate(p.candidate); } catch {} }
        else this._pendingIce.push(p.candidate);
      } else if (p.type === 'rec') {
        this.onPeerRecording?.(!!p.on);
      } else if (p.type === 'react') {
        this.onPeerReaction?.(p.emoji);
      } else if (p.type === 'screen') {
        this.onPeerScreenShare?.(!!p.on);
      } else if (p.type === 'end') {
        this.onStatus?.('ended');
        this.destroy();
      }
    } catch { this.onStatus?.('failed'); this.destroy(); }
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    try { if (this._recorder && this._recorder.state !== 'inactive') this._recorder.stop(); } catch {}
    this._recorder = null;
    try { this._filter?.stop(); } catch {}
    this._filter = null; this._filterSource = null;
    try { this._screenStream?.getTracks().forEach((t) => t.stop()); } catch {}
    this._screenStream = null; this._camTrack = null;
    if (!this.sharedStream) { try { this.localStream?.getTracks().forEach((t) => t.stop()); } catch {} }
    try { this.pc?.close(); } catch {}
    if (this.channel) { try { supabase.removeChannel(this.channel); } catch {} }
    this.pc = null; this.channel = null; this.localStream = null;
  }
}
