/**
 * groupCall.js — crew calls (a full-mesh WebRTC room).
 *
 * Everyone in the room connects directly to everyone else, reusing the same
 * PeerSession that powers 1:1 calls. Mesh is the right shape here because crews
 * are small: it needs no server, no SFU and therefore no bill. It does mean
 * each extra person costs everyone one more upload stream, so the room is
 * capped — beyond that you'd need an SFU, which is a paid box.
 *
 * Presence (Supabase Realtime) is the roster: joining announces you, and every
 * peer already in the room sees you arrive. To avoid "glare" — both sides
 * offering at once — the member with the lexicographically smaller user id is
 * always the caller. That's deterministic and needs no negotiation.
 *
 * One camera/mic is acquired for the whole room and shared into every peer
 * connection (PeerSession.sharedStream).
 */
import { supabase } from './supabase';
import { PeerSession, isCallSupported } from './webrtcCall';
import { requestMedia } from '../utils/permissions';

export const MAX_CREW_CALL = 6; // mesh gets expensive fast; be honest about it

export class GroupCall {
  constructor({ crewId, selfId, selfName, video, onPeersChanged, onLocalStream, onError }) {
    this.crewId = crewId;
    this.selfId = selfId;
    this.selfName = selfName || 'viber';
    this.video = !!video;
    this.onPeersChanged = onPeersChanged;
    this.onLocalStream = onLocalStream;
    this.onError = onError;
    this.roomName = `crewcall:${crewId}`;
    this.room = null;
    this.sessions = new Map();   // peerId -> PeerSession
    this.streams = new Map();    // peerId -> MediaStream
    this.names = new Map();      // peerId -> username
    this.localStream = null;
    this._destroyed = false;
  }

  _emit() {
    if (this._destroyed) return;
    const peers = [...this.sessions.keys()].map((id) => ({
      id,
      username: this.names.get(id) || 'viber',
      stream: this.streams.get(id) || null,
    }));
    this.onPeersChanged?.(peers);
  }

  async join() {
    if (!isCallSupported()) { this.onError?.('unsupported'); return false; }

    const media = await requestMedia({ video: this.video });
    if (!media.ok) { this.onError?.(media.error); return false; }
    this.localStream = media.stream;
    this.onLocalStream?.(this.localStream);

    this.room = supabase.channel(this.roomName, {
      config: { presence: { key: this.selfId } },
    });

    this.room.on('presence', { event: 'sync' }, () => {
      const state = this.room.presenceState();
      const present = Object.keys(state).filter((id) => id !== this.selfId);

      for (const id of present) {
        const meta = state[id]?.[0] || {};
        this.names.set(id, meta.username || 'viber');
        if (!this.sessions.has(id)) this._connectTo(id);
      }
      // Anyone who left the room gets torn down.
      for (const id of [...this.sessions.keys()]) {
        if (!present.includes(id)) this._dropPeer(id);
      }
      this._emit();
    });

    await new Promise((resolve) => {
      this.room.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await this.room.track({ username: this.selfName, video: this.video });
          resolve();
        }
      });
    });
    return true;
  }

  _connectTo(peerId) {
    if (this.sessions.size >= MAX_CREW_CALL - 1) return; // room full
    const session = new PeerSession({
      selfId: this.selfId,
      peerId,
      sharedStream: this.localStream,
      onRemoteStream: (stream) => { this.streams.set(peerId, stream); this._emit(); },
      onIncoming: () => { session.accept().catch(() => {}); }, // in a room, always answer
      onStatus: (st) => { if (st === 'ended' || st === 'failed') this._dropPeer(peerId); },
    });
    this.sessions.set(peerId, session);

    // Deterministic caller avoids both sides offering simultaneously.
    const iCall = this.selfId < peerId;
    session.listen()
      .then(() => { if (iCall) return session.call(this.video); })
      .catch(() => this._dropPeer(peerId));

    this._emit();
  }

  _dropPeer(peerId) {
    const s = this.sessions.get(peerId);
    if (s) { try { s.destroy(); } catch {} }
    this.sessions.delete(peerId);
    this.streams.delete(peerId);
    this._emit();
  }

  toggleMute() {
    const t = this.localStream?.getAudioTracks?.()[0];
    if (t) { t.enabled = !t.enabled; return !t.enabled; }
    return false;
  }

  toggleCamera() {
    const t = this.localStream?.getVideoTracks?.()[0];
    if (t) { t.enabled = !t.enabled; return !t.enabled; }
    return false;
  }

  async leave() {
    if (this._destroyed) return;
    this._destroyed = true;
    for (const [, s] of this.sessions) { try { s.destroy(); } catch {} }
    this.sessions.clear(); this.streams.clear();
    try { await this.room?.untrack(); } catch {}
    if (this.room) { try { supabase.removeChannel(this.room); } catch {} }
    this.room = null;
    // The room owns this stream, so it's ours to stop.
    try { this.localStream?.getTracks().forEach((t) => t.stop()); } catch {}
    this.localStream = null;
  }
}
