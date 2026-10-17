/**
 * cyberAudio — futuristic micro-acoustic synthesizer for The Gruvs.
 *
 * Uses the Web Audio API on web to generate pure mathematical sine/square
 * cyber-frequencies (0 byte assets, 0ms network latency).
 * On native, triggers synchronized precision haptics and safe audio chimes.
 */
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

let webAudioCtx = null;

function getAudioContext() {
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!webAudioCtx) {
    try {
      webAudioCtx = new AudioCtx();
    } catch {}
  }
  if (webAudioCtx && webAudioCtx.state === 'suspended') {
    const resume = () => {
      try { webAudioCtx.resume(); } catch {}
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
    };
    window.addEventListener('pointerdown', resume, { once: true });
    window.addEventListener('keydown', resume, { once: true });
  }
  return webAudioCtx;
}

export const cyberAudio = {
  /**
   * Play a synthesized sci-fi sound effect.
   * Types: 'sonarPing' | 'radarSweep' | 'bubbleSquish' | 'lockVibe' | 'warpOpen' | 'telemetryTick'
   */
  play(type = 'telemetryTick') {
    // 1. Always fire synchronized tactile haptic feedback
    try {
      if (type === 'lockVibe' || type === 'radarSweep') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else if (type === 'bubbleSquish' || type === 'telemetryTick') {
        Haptics.selectionAsync();
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {}

    // 2. Synthesize audio on web if available
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'sonarPing') {
        // High harmonic sonar ping: 880Hz -> 440Hz decay
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.35);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'radarSweep') {
        // Harmonic frequency sweep: 220Hz -> 660Hz
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(660, now + 0.22);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'bubbleSquish') {
        // Soft tactile bubble pop: 330Hz -> 200Hz
        osc.type = 'sine';
        osc.frequency.setValueAtTime(330, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'lockVibe') {
        // Futuristic double-tone success chime: 523.25Hz (C5) -> 783.99Hz (G5)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(783.99, now + 0.08);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (type === 'warpOpen') {
        // Ethereal holographic expansion sweep
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(580, now + 0.25);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else {
        // Telemetry tick: short 1200Hz micro-click
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        gain.gain.setValueAtTime(0.03, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.04);
      }
    } catch {}
  },
};
