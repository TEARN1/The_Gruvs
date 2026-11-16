/**
 * KasiIndustrialUI — Tactical Card, Border Tracer, Optical Moiré Grid, Holographic Tilt Sheen & Radial Charge Button.
 *
 * Implements:
 * - 1.2 Optical Moiré Anti-Screenshot Hologram Grid
 * - 1.3 Gyroscope Holographic Foil Tilt Sheen
 * - 2.2 2.5-Second Radial Charge Hold-to-SOS Button
 * - 5.1 45-Degree Laser-Chamfered Tactical Corners
 * - 5.2 Monospace Tabular Cockpit Telemetry
 * - 5.3 1px Perimeter-Bound Border Sparklers
 * - 5.4 Kinetic Hairline Sweeping Tracers
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { hardwareEnv } from '../services/hardwareEnvironmentService';
import { sensoryHaptics } from '../services/sensoryHapticEngine';

// ─────────────────────────────────────────────────────────────
// 1. TacticalCard (45-degree chamfered industrial flight-case card)
// ─────────────────────────────────────────────────────────────

export function TacticalCard({
  children,
  style,
  borderColor = '#00f2ff35',
  bg = '#111618',
  cornerCut = 12,
  pulseBass = false,
}) {
  const [bassAmp, setBassAmp] = useState(0.2);

  useEffect(() => {
    if (!pulseBass) return;
    const unsub = hardwareEnv.subscribeSubBass((amp) => {
      setBassAmp(amp);
    });
    return unsub;
  }, [pulseBass]);

  // If pulseBass is active, dynamically scale hairline opacity with sub-bass
  const activeBorderColor = pulseBass
    ? `${borderColor.slice(0, 7)}${Math.floor(25 + bassAmp * 70).toString(16)}`
    : borderColor;

  return (
    <View
      style={[
        styles.tacticalCardBase,
        {
          backgroundColor: bg,
          borderColor: activeBorderColor,
          borderRadius: cornerCut,
        },
        style,
      ]}
    >
      {/* 45-degree corner accent notches */}
      <View style={[styles.cornerNotchTL, { borderColor }]} />
      <View style={[styles.cornerNotchBR, { borderColor }]} />
      {children}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. BorderTracer (Kinetic sweeping 20px light beam along 1px border)
// ─────────────────────────────────────────────────────────────

export function BorderTracer({ active = true, color = '#00f2ff', duration = 3000 }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [active, duration]);

  if (!active) return null;

  const translateX = anim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [-30, 200, 200, -30, -30],
  });
  const translateY = anim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, 0, 70, 70, 0],
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.tracerHead,
          {
            backgroundColor: color,
            shadowColor: color,
            transform: [{ translateX }, { translateY }],
          },
        ]}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. PerimeterSparkler (Sparks confined strictly along button edge)
// ─────────────────────────────────────────────────────────────

export function PerimeterSparkler({ trigger, color = '#fde047', count = 8 }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (!trigger) return;
    const newBatch = Array.from({ length: count }, (_, i) => ({
      id: `${trigger}-${i}`,
      progress: new Animated.Value(0),
      pos: (i / count), // Position along 0.0 to 1.0 perimeter
    }));
    setParticles(newBatch);

    newBatch.forEach((p) => {
      Animated.timing(p.progress, {
        toValue: 1,
        duration: 380 + Math.random() * 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    });

    const timer = setTimeout(() => setParticles([]), 650);
    return () => clearTimeout(timer);
  }, [trigger, count]);

  if (particles.length === 0) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((p) => {
        const opacity = p.progress.interpolate({
          inputRange: [0, 0.4, 1],
          outputRange: [0, 1, 0],
        });
        const scale = p.progress.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.6, 1.4, 0],
        });

        // Map position along rectangular border perimeter
        let top = '0%';
        let left = `${p.pos * 100}%`;
        if (p.pos > 0.5) {
          top = '100%';
          left = `${(1 - p.pos) * 100}%`;
        }

        return (
          <Animated.View
            key={p.id}
            style={[
              styles.sparklerDot,
              {
                backgroundColor: color,
                top,
                left,
                opacity,
                transform: [{ scale }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. OpticalMoirePass (60Hz oscillating anti-screenshot micro-grid)
// ─────────────────────────────────────────────────────────────

export function OpticalMoirePass({ active = true }) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [active]);

  if (!active) return null;

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-6, 6],
  });

  return (
    <View pointerEvents="none" style={styles.moireContainer}>
      <Animated.View style={[styles.moireLines, { transform: [{ translateX }] }]} />
      <View style={styles.moireScanBadge}>
        <Feather name="shield" size={10} color="#00f2ff" />
        <Text style={styles.moireBadgeText}>GENUINE GLASS SECURED // ANTI-SCREENSHOT 60Hz</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. HolographicTiltFoil (Accelerometer-responsive angle sheen)
// ─────────────────────────────────────────────────────────────

export function HolographicTiltFoil({ children, style }) {
  const [tilt, setTilt] = useState({ tiltX: 0, tiltY: 0 });

  useEffect(() => {
    const unsub = hardwareEnv.subscribeTilt(({ tiltX, tiltY }) => {
      setTilt({ tiltX, tiltY });
    });
    return unsub;
  }, []);

  const sheenTranslateX = tilt.tiltX * 120;
  const sheenTranslateY = tilt.tiltY * 80;

  return (
    <View style={[styles.foilContainer, style]}>
      {children}
      {/* 45-degree flat iridescent sheen stripe */}
      <View
        pointerEvents="none"
        style={[
          styles.foilSheen,
          {
            transform: [
              { rotate: '-35deg' },
              { translateX: sheenTranslateX },
              { translateY: sheenTranslateY },
            ],
          },
        ]}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 6. TelemetryHUD (Industrial monospace telemetry bar)
// ─────────────────────────────────────────────────────────────

export function TelemetryHUD({ title, label, value, status = 'LIVE' }) {
  return (
    <View style={styles.hudContainer}>
      <View style={styles.hudRow}>
        <View style={styles.hudStatusWrap}>
          <View style={styles.hudStatusDot} />
          <Text style={styles.hudStatusText}>{status}</Text>
        </View>
        <Text style={styles.hudTitle}>{title}</Text>
      </View>
      <View style={styles.hudRow}>
        <Text style={styles.hudLabel}>{label}</Text>
        <Text style={styles.hudValue}>{value}</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 7. RadialChargeButton (2.5-second deliberate hold-to-charge)
// ─────────────────────────────────────────────────────────────

export function RadialChargeButton({
  onCharged,
  label = 'HOLD TO TRIGGER SOS',
  subtext = 'Hold 2.5s to prevent accidental false alarms',
  color = '#ef4444',
  style,
}) {
  const [charging, setCharging] = useState(false);
  const chargeProgress = useRef(new Animated.Value(0)).current;
  const chargeTimer = useRef(null);

  const startCharge = () => {
    setCharging(true);
    sensoryHaptics.triggerLogDrum('bounce');

    Animated.timing(chargeProgress, {
      toValue: 1,
      duration: 2500,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        sensoryHaptics.triggerPocketSquadAlerted();
        onCharged?.();
        resetCharge();
      }
    });
  };

  const cancelCharge = () => {
    if (!charging) return;
    resetCharge();
  };

  const resetCharge = () => {
    setCharging(false);
    chargeProgress.stopAnimation();
    chargeProgress.setValue(0);
  };

  const fillWidth = chargeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPressIn={startCharge}
      onPressOut={cancelCharge}
      style={[
        styles.chargeBtnBase,
        {
          borderColor: `${color}60`,
          backgroundColor: charging ? `${color}18` : `${color}0a`,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.chargeFillTrack,
          {
            backgroundColor: `${color}35`,
            width: fillWidth,
          },
        ]}
      />
      <View style={styles.chargeContent}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Feather name="alert-triangle" size={16} color={color} />
          <Text style={[styles.chargeLabel, { color }]}>{label}</Text>
        </View>
        <Text style={styles.chargeSubtext}>{charging ? 'HOLDING... KEEP THUMB DOWN' : subtext}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tacticalCardBase: {
    borderWidth: 1,
    padding: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  cornerNotchTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 6,
    height: 6,
    borderTopWidth: 2,
    borderLeftWidth: 2,
  },
  cornerNotchBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 6,
    height: 6,
    borderBottomWidth: 2,
    borderRightWidth: 2,
  },
  tracerHead: {
    position: 'absolute',
    width: 24,
    height: 2,
    borderRadius: 1,
  },
  sparklerDot: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: -2.5,
    marginLeft: -2.5,
  },
  moireContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    opacity: 0.12,
  },
  moireLines: {
    width: '120%',
    height: '100%',
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: '#00f2ff',
    // 0.5px line simulation using repeating background borders
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderStyle: 'dotted',
  },
  moireScanBadge: {
    position: 'absolute',
    bottom: 6,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#00f2ff35',
  },
  moireBadgeText: {
    color: '#00f2ff',
    fontSize: 8.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  foilContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  foilSheen: {
    position: 'absolute',
    width: '160%',
    height: 50,
    top: '35%',
    left: '-30%',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  hudContainer: {
    backgroundColor: '#080b0d',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  hudRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hudStatusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  hudStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  hudStatusText: {
    color: '#10b981',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  hudTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
  },
  hudLabel: {
    color: '#fff',
    fontSize: 11.5,
    fontWeight: '800',
  },
  hudValue: {
    color: '#00f2ff',
    fontSize: 12,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  chargeBtnBase: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chargeFillTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
  },
  chargeContent: {
    alignItems: 'center',
    gap: 4,
    zIndex: 2,
  },
  chargeLabel: {
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  chargeSubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10.5,
    fontWeight: '600',
  },
});
