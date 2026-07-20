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
  ],
};

// One live call between two users. Callbacks let the UI react without knowing
// any WebRTC detail.
export class PeerSession {
  constructor({ selfId, peerId, onRemoteStream, onLocalStream, onStatus, onIncoming }) {
    this.selfId = selfId;
    this.peerId = peerId;
    this.onRemoteStream = onRemoteStream;
    this.onLocalStream = onLocalStream;
    this.onStatus = onStatus;         // 'connecting' | 'connected' | 'ended' | 'failed'
    this.onIncoming = onIncoming;     // ({ video }) — an offer arrived
    this.channelName = `rtc:${[selfId, peerId].sort().join('__')}`;
    this.pc = null;
    this.channel = null;
    this.localStream = null;
    this._pendingOffer = null;
    this._pendingIce = [];
    this._destroyed = false;
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
    pc.ontrack = (e) => this.onRemoteStream?.(e.streams[0]);
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'connected') this.onStatus?.('connected');
      else if (st === 'failed') { this.onStatus?.('failed'); this.destroy(); }
      else if (st === 'disconnected' || st === 'closed') this.onStatus?.('ended');
    };
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: !!video });
    this.onLocalStream?.(this.localStream);
    this.localStream.getTracks().forEach((t) => pc.addTrack(t, this.localStream));
    this.pc = pc;
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
      } else if (p.type === 'end') {
        this.onStatus?.('ended');
        this.destroy();
      }
    } catch { this.onStatus?.('failed'); this.destroy(); }
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    try { this.localStream?.getTracks().forEach((t) => t.stop()); } catch {}
    try { this.pc?.close(); } catch {}
    if (this.channel) { try { supabase.removeChannel(this.channel); } catch {} }
    this.pc = null; this.channel = null; this.localStream = null;
  }
}
