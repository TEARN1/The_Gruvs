/**
 * src/utils/audioState.js
 *
 * Global session-level audio mute manager.
 * Remembers user volume preference across video players (Reels, Event clips)
 * and defaults to muted on first launch to avoid public noise.
 */

let globalAudioMuted = true; // Muted by default on all platforms for launch safety
const listeners = new Set();

export const audioState = {
  isMuted() {
    return globalAudioMuted;
  },
  
  setMuted(muted) {
    if (globalAudioMuted === muted) return;
    globalAudioMuted = muted;
    listeners.forEach(cb => cb(muted));
  },
  
  subscribe(cb) {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }
};
