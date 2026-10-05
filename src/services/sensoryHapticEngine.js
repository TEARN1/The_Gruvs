/**
 * SensoryHapticEngine — Amapiano Log-Drum Synthesizer, Analog Earcons & Pocket Morse Codes.
 *
 * Implements:
 * - 4.1 Synthesized Amapiano Log-Drum Haptic Driver (Sharp attack, rolling hollow wood resonance, clean release)
 * - 4.2 Vinyl Needle-Drop & Backspin Scrub Haptics
 * - 4.3 Mechanical Steel Vault Latch Acoustic Chime
 * - 4.4 35mm Rangefinder Camera Shutter Snap
 * - 4.5 Sudden-Death Referee Whistle Pulse
 * - 2.3 Covert Pocket Haptic Confirmation Codes (Morse code vibrations in pocket)
 * - 7.2 Vibrating Commercial Restaurant Kitchen Buzzer Cadence
 */
import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';

class SensoryHapticEngine {
  constructor() {
    this._audioContext = null;
    this._soundMuted = false;
  }

  // ─────────────────────────────────────────────────────────────
  // 1. Synthesized Amapiano Log-Drum Haptic Driver
  // ─────────────────────────────────────────────────────────────

  /**
   * Triggers an authentic Amapiano log-drum vibration waveform.
   * @param {'heavy' | 'bounce' | 'double_drop'} style
   */
  async triggerLogDrum(style = 'heavy') {
    try {
      if (Platform.OS === 'web') {
        if (navigator?.vibrate) {
          if (style === 'double_drop') {
            navigator.vibrate([15, 40, 10, 30, 25, 60]);
          } else if (style === 'bounce') {
            navigator.vibrate([10, 30, 20, 50]);
          } else {
            // Heavy: 10ms mallet strike, 50ms pause, 35ms hollow wood swell
            navigator.vibrate([12, 45, 30]);
          }
        }
        this._synthesizeLogDrumTone(style);
        return;
      }

      if (Platform.OS === 'ios') {
        // iOS Taptic Engine sequence
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setTimeout(async () => {
          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } catch (_e) {
            // Audio/Haptic fallback safe
          }
        }, 65);
        if (style === 'double_drop') {
          setTimeout(async () => {
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (_e) {
              // Audio/Haptic fallback safe
            }
          }, 140);
        }
      } else {
        // Android custom vibration pattern
        if (style === 'double_drop') {
          Vibration.vibrate([0, 15, 35, 12, 25, 35]);
        } else if (style === 'bounce') {
          Vibration.vibrate([0, 12, 30, 22]);
        } else {
          Vibration.vibrate([0, 14, 45, 32]);
        }
      }

      this._synthesizeLogDrumTone(style);
    } catch (err) {
      console.warn('[SensoryHapticEngine] logDrum haptic failed:', err);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. Vinyl Needle-Drop & Scrub Haptics
  // ─────────────────────────────────────────────────────────────

  async triggerVinylScrub() {
    try {
      if (Platform.OS === 'web') {
        if (navigator?.vibrate) navigator.vibrate(8);
        this._synthesizeVinylCrackle();
        return;
      }
      await Haptics.selectionAsync();
      this._synthesizeVinylCrackle();
    } catch (_err) {
      // Audio/Haptic fallback safe
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. Mechanical Steel Vault Latch Acoustic Chime
  // ─────────────────────────────────────────────────────────────

  async triggerVaultLatch() {
    try {
      if (Platform.OS === 'ios') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (Platform.OS === 'android') {
        Vibration.vibrate([0, 30, 50, 40]);
      } else if (navigator?.vibrate) {
        navigator.vibrate([25, 40, 35]);
      }
      this._synthesizeMetallicLatch();
    } catch (_err) {
      // Audio/Haptic fallback safe
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 4. 35mm Rangefinder Camera Shutter Snap
  // ─────────────────────────────────────────────────────────────

  async triggerCameraShutter() {
    try {
      if (Platform.OS === 'ios') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid || Haptics.ImpactFeedbackStyle.Heavy);
        setTimeout(async () => {
          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch (_e) {
            // Audio/Haptic fallback safe
          }
        }, 40);
      } else {
        Vibration.vibrate([0, 20, 25, 12]);
      }
      this._synthesizeShutterClick();
    } catch (_err) {
      // Audio/Haptic fallback safe
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 5. Sudden-Death Referee Whistle Pulse
  // ─────────────────────────────────────────────────────────────

  async triggerRefereeWhistle() {
    try {
      if (Platform.OS === 'ios') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        Vibration.vibrate([0, 45, 30, 55]);
      }
      this._synthesizeWhistle();
    } catch (_err) {
      // Audio/Haptic fallback safe
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 6. Vibrating Commercial Restaurant Kitchen Buzzer (Kota Ready)
  // ─────────────────────────────────────────────────────────────

  async triggerKitchenBuzzer() {
    try {
      // 4 persistent pulses: [delay, buzz, pause, buzz, pause...]
      const pattern = [0, 180, 100, 180, 100, 180, 100, 280];
      if (Platform.OS === 'web') {
        if (navigator?.vibrate) navigator.vibrate(pattern);
      } else {
        Vibration.vibrate(pattern);
      }
      this._synthesizeBuzzerTone();
    } catch (_err) {
      // Audio/Haptic fallback safe
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 7. Covert Pocket Morse Code Vibrations
  // ─────────────────────────────────────────────────────────────

  /**
   * Morse code vibration: 3 rapid micro-taps confirming squad was alerted
   */
  triggerPocketSquadAlerted() {
    const pattern = [0, 70, 50, 70, 50, 70];
    if (Platform.OS === 'web' && navigator?.vibrate) {
      navigator.vibrate(pattern);
    } else {
      Vibration.vibrate(pattern);
    }
  }

  /**
   * Morse code vibration: 1 long sustained vibration confirming security dispatch
   */
  triggerPocketSecurityAcknowledged() {
    const pattern = [0, 400];
    if (Platform.OS === 'web' && navigator?.vibrate) {
      navigator.vibrate(pattern);
    } else {
      Vibration.vibrate(pattern);
    }
  }

  /**
   * Morse code vibration: double pulse confirming Safe Ride timer extension
   */
  triggerPocketTimerExtended() {
    const pattern = [0, 90, 70, 90];
    if (Platform.OS === 'web' && navigator?.vibrate) {
      navigator.vibrate(pattern);
    } else {
      Vibration.vibrate(pattern);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 8. Synthetic Web Audio Synthesizer (Zero asset file bloat)
  // ─────────────────────────────────────────────────────────────

  _getAudioContext() {
    if (this._soundMuted) return null;
    if (typeof window === 'undefined') return null;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      if (!this._audioContext) {
        this._audioContext = new AudioCtx();
      }
      if (this._audioContext.state === 'suspended') {
        this._audioContext.resume();
      }
      return this._audioContext;
    } catch (_e) {
      return null;
    }
  }

  _synthesizeLogDrumTone(style) {
    const ctx = this._getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      // Oscillator 1: Low-sub 55Hz pitch drop (hollow log)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(style === 'heavy' ? 72 : 84, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.14);

      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } catch (_err) {
      // Audio synth safe
    }
  }

  _synthesizeMetallicLatch() {
    const ctx = this._getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(880, now + 0.03);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch (_err) {
      // Audio synth safe
    }
  }

  _synthesizeShutterClick() {
    const ctx = this._getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.setValueAtTime(600, now + 0.02);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch (_err) {
      // Audio synth safe
    }
  }

  _synthesizeVinylCrackle() {
    const ctx = this._getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.03);
    } catch (_err) {
      // Audio synth safe
    }
  }

  _synthesizeWhistle() {
    const ctx = this._getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2400, now);
      osc.frequency.setValueAtTime(2600, now + 0.08);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch (_err) {
      // Audio synth safe
    }
  }

  _synthesizeBuzzerTone() {
    const ctx = this._getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch (_err) {
      // Audio synth safe
    }
  }
}

export const sensoryHaptics = new SensoryHapticEngine();
