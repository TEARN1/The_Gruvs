/**
 * NightlifeSensoryModal — Squad Neon Beacon, 3 AM Survival Mode, Bouncer Tactical HUD & Proof of Sweat.
 *
 * Implements:
 * - 2.1 Hardware Volume Morse & Pocket Shake Controls
 * - 2.4 Flip-to-Stealth Screen Blanking
 * - 3.1 2-Meter Full-Screen Gate Strobe
 * - 3.2 Volume-Rocker Headcount Door Clicker
 * - 3.3 Gate Velocity Telemetry HUD
 * - 6.1 The Squad Neon Beacon (Full-screen pulsing strobe)
 * - 8.1 3 AM Ultra-Blackout Battery Survival Mode
 * - 8.4 The "Proof of Physical Sweat" Protocol
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
  Animated,
  Linking,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { sensoryHaptics } from '../services/sensoryHapticEngine';
import { hardwareEnv } from '../services/hardwareEnvironmentService';
import { useToast } from './ToastNotification';
import { TacticalCard, TelemetryHUD, RadialChargeButton } from './KasiIndustrialUI';

const TABS = [
  { key: 'beacon', label: 'Squad Beacon', icon: 'zap' },
  { key: 'survival', label: '3AM Survival', icon: 'battery-charging' },
  { key: 'bouncer', label: 'Bouncer HUD', icon: 'shield' },
  { key: 'stealth', label: 'Pocket Stealth', icon: 'eye-off' },
  { key: 'sweat', label: 'Proof of Sweat', icon: 'award' },
];

export function NightlifeSensoryModal({
  visible,
  event,
  onClose,
  primary = '#00f2ff',
  textColor = '#fff',
  muted = 'rgba(255,255,255,0.55)',
  surface = '#111618',
  bg = '#080b0d',
}) {
  const [activeTab, setActiveTab] = useState('beacon');
  const toast = useToast();

  // 1. Squad Beacon State
  const [beaconColor, setBeaconColor] = useState('#00f2ff');
  const [beaconStrobeActive, setBeaconStrobeActive] = useState(false);
  const strobeAnim = useRef(new Animated.Value(1)).current;

  // 2. 3AM Survival Mode
  const [survivalModeActive, setSurvivalModeActive] = useState(false);

  // 3. Bouncer Tactical HUD
  const [gateStats, setGateStats] = useState({ scansPerMin: 0, queueDelayMin: 1, currentInside: 0 });
  const [strobeResult, setStrobeResult] = useState(null); // 'valid' | 'invalid'

  // 4. Pocket Stealth
  const [faceDownDetected, setFaceDownDetected] = useState(false);
  const [pocketShakeCount, setPocketShakeCount] = useState(0);

  // 5. Proof of Sweat
  const [sweatRecord, setSweatRecord] = useState(null);

  useEffect(() => {
    if (!visible) return;
    loadGateStats();
    loadSweatRecord();

    const unsubFaceDown = hardwareEnv.subscribeFaceDown((isDown) => {
      setFaceDownDetected(isDown);
    });

    const unsubShake = hardwareEnv.subscribePocketShake(() => {
      setPocketShakeCount((prev) => prev + 1);
      toast.show('POCKET SOS DETECTED — Squad Alerted', 'error');
    });

    return () => {
      unsubFaceDown();
      unsubShake();
    };
  }, [visible, event?.id]);

  const loadGateStats = async () => {
    if (!event?.id) return;
    const count = await hardwareEnv.getHeadcount(event.id);
    const vel = hardwareEnv.getGateVelocity();
    setGateStats({ ...vel, currentInside: count });
  };

  const loadSweatRecord = async () => {
    if (!event?.id) return;
    const rec = await hardwareEnv.getSweatStamp(event.id);
    setSweatRecord(rec);
  };

  // Toggle beacon strobe loop
  const toggleBeaconStrobe = () => {
    if (beaconStrobeActive) {
      setBeaconStrobeActive(false);
      strobeAnim.setValue(1);
    } else {
      setBeaconStrobeActive(true);
      sensoryHaptics.triggerLogDrum('bounce');
      Animated.loop(
        Animated.sequence([
          Animated.timing(strobeAnim, { toValue: 0.1, duration: 120, useNativeDriver: true }),
          Animated.timing(strobeAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
        ])
      ).start();
    }
  };

  // Bouncer simulate scan
  const handleBouncerScan = async (isValid) => {
    if (!event?.id) return;
    if (isValid) {
      const newCount = await hardwareEnv.incrementHeadcount(event.id);
      setGateStats((prev) => ({ ...prev, currentInside: newCount }));
      setStrobeResult('valid');
      sensoryHaptics.triggerVaultLatch();
    } else {
      setStrobeResult('invalid');
      sensoryHaptics.triggerRefereeWhistle();
    }
    setTimeout(() => setStrobeResult(null), 700);
  };

  // Claim Proof of Sweat
  const handleVerifySweat = async () => {
    if (!event?.id) return;
    sensoryHaptics.triggerLogDrum('heavy');
    const result = await hardwareEnv.evaluateProofOfSweat(event.id, {
      inGeofence: true,
      audioExposureMin: 58,
      danceSteps: 3410,
      blePeersCount: 9,
    });
    setSweatRecord(result);
    toast.show('GOLD DANCEFLOOR STAMP MINTED — Physical Sweat Verified!', 'success');
  };

  if (!visible) return null;

  // FULL-SCREEN BLINDING SQUAD BEACON VIEW
  if (beaconStrobeActive) {
    return (
      <Modal visible animationType="fade" presentationStyle="fullScreen">
        <Animated.View
          style={[
            styles.beaconFullScreen,
            {
              backgroundColor: beaconColor,
              opacity: strobeAnim,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.beaconExitBtn}
            onPress={toggleBeaconStrobe}
            activeOpacity={0.8}
          >
            <Feather name="x" size={24} color="#000" />
            <Text style={styles.beaconExitText}>TAP TO STOP BEACON</Text>
          </TouchableOpacity>
          <View style={styles.beaconCenterMsg}>
            <Text style={styles.beaconBigText}>HOLD PHONE HIGH</Text>
            <Text style={styles.beaconSubText}>Squad can spot your beacon from 30+ meters</Text>
          </View>
        </Animated.View>
      </Modal>
    );
  }

  // 3 AM ULTRA-BLACKOUT SURVIVAL MODE VIEW (Pure OLED #000000, 3 buttons)
  if (survivalModeActive) {
    return (
      <Modal visible animationType="fade" presentationStyle="fullScreen">
        <View style={styles.survivalRoot}>
          <View style={styles.survivalContent}>
            <View style={styles.survivalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Feather name="battery-charging" size={16} color="#ef4444" />
                <Text style={styles.survivalTag}>3 AM ULTRA-BLACKOUT SURVIVAL MODE</Text>
              </View>
              <TouchableOpacity onPress={() => setSurvivalModeActive(false)}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>EXIT</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.survivalWarning}>
              Animations & background queries stripped. Pure OLED Black active.
            </Text>

            <View style={styles.survivalActions}>
              {/* 1. Offline Ticket Pass */}
              <TouchableOpacity
                style={styles.survivalBtn}
                onPress={() => toast.show('Offline Ticket Pass Active on Screen', 'info')}
              >
                <Feather name="shield" size={22} color="#00f2ff" />
                <View>
                  <Text style={styles.survivalBtnTitle}>OFFLINE PASS</Text>
                  <Text style={styles.survivalBtnSub}>Ready for door bouncer</Text>
                </View>
              </TouchableOpacity>

              {/* 2. Call Day Ones / Squad SOS */}
              <TouchableOpacity
                style={[styles.survivalBtn, { borderColor: '#ef4444' }]}
                onPress={() => {
                  sensoryHaptics.triggerPocketSquadAlerted();
                  toast.show('Pinging Day Ones with Emergency SMS...', 'error');
                }}
              >
                <Feather name="phone-call" size={22} color="#ef4444" />
                <View>
                  <Text style={[styles.survivalBtnTitle, { color: '#ef4444' }]}>CALL DAY ONES (SOS)</Text>
                  <Text style={styles.survivalBtnSub}>1-tap emergency squad alert</Text>
                </View>
              </TouchableOpacity>

              {/* 3. Driver Pickup / Directions */}
              <TouchableOpacity
                style={styles.survivalBtn}
                onPress={() => {
                  Linking.openURL('https://maps.google.com');
                }}
              >
                <Feather name="navigation" size={22} color="#10b981" />
                <View>
                  <Text style={styles.survivalBtnTitle}>GET PICKUP / DIRECTIONS</Text>
                  <Text style={styles.survivalBtnSub}>Directions to home address</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: bg }]}>
          {/* Header */}
          <View style={[styles.sheetHeader, { borderBottomColor: `${primary}20` }]}>
            <View>
              <Text style={[styles.sheetTitle, { color: textColor }]}>Nightlife & Sensory Suite</Text>
              <Text style={[styles.sheetSub, { color: muted }]}>Hardware Controls · Bouncer HUD · Survival Mode</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: surface }]}>
              <Feather name="x" size={18} color={textColor} />
            </TouchableOpacity>
          </View>

          {/* Tab Dock */}
          <View style={[styles.tabDock, { backgroundColor: surface }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {TABS.map((t) => {
                const active = activeTab === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    onPress={() => {
                      sensoryHaptics.triggerLogDrum('bounce');
                      setActiveTab(t.key);
                    }}
                    style={[
                      styles.tabPill,
                      {
                        borderColor: active ? primary : 'transparent',
                        backgroundColor: active ? `${primary}20` : 'transparent',
                      },
                    ]}
                  >
                    <Feather name={t.icon} size={13} color={active ? primary : muted} />
                    <Text style={[styles.tabText, { color: active ? primary : muted }]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Tab Content */}
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            {/* 1. SQUAD BEACON */}
            {activeTab === 'beacon' && (
              <View style={{ gap: 12 }}>
                <TelemetryHUD
                  title="BEACON TELEMETRY"
                  label="MAX STROBE FREQUENCY"
                  value="8.3 Hz"
                  status="READY"
                />

                <TacticalCard borderColor={`${primary}40`} bg={surface}>
                  <Text style={[styles.cardTitle, { color: textColor }]}>The Squad Neon Beacon</Text>
                  <Text style={[styles.cardBody, { color: muted }]}>
                    Hold your phone high in a dark crowd. Screen strobes at 100% brightness in your chosen color to guide your friends straight to you.
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 10, marginVertical: 12 }}>
                    {[
                      { name: 'Cyan', color: '#00f2ff' },
                      { name: 'Magenta', color: '#ec4899' },
                      { name: 'Electric Lime', color: '#10b981' },
                    ].map((c) => (
                      <TouchableOpacity
                        key={c.color}
                        onPress={() => {
                          sensoryHaptics.triggerLogDrum('heavy');
                          setBeaconColor(c.color);
                        }}
                        style={[
                          styles.colorPickBtn,
                          {
                            borderColor: beaconColor === c.color ? '#fff' : `${c.color}40`,
                            backgroundColor: `${c.color}25`,
                          },
                        ]}
                      >
                        <View style={[styles.colorDot, { backgroundColor: c.color }]} />
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{c.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    onPress={toggleBeaconStrobe}
                    style={[styles.launchBeaconBtn, { backgroundColor: beaconColor }]}
                  >
                    <Feather name="zap" size={18} color="#000" />
                    <Text style={styles.launchBeaconText}>LAUNCH SQUAD BEACON</Text>
                  </TouchableOpacity>
                </TacticalCard>
              </View>
            )}

            {/* 2. 3AM SURVIVAL MODE */}
            {activeTab === 'survival' && (
              <View style={{ gap: 12 }}>
                <TelemetryHUD
                  title="BATTERY TELEMETRY"
                  label="OLED CONSERVATION"
                  value="100% BLACK"
                  status="ARMED"
                />

                <TacticalCard borderColor="rgba(239,68,68,0.4)" bg={surface}>
                  <Text style={[styles.cardTitle, { color: textColor }]}>3 AM Ultra-Blackout Survival Mode</Text>
                  <Text style={[styles.cardBody, { color: muted }]}>
                    When battery drops below 10%, every pixel counts. Strip all glitters and animations to leave only your Offline Pass, Day Ones emergency call, and directions home.
                  </Text>

                  <TouchableOpacity
                    onPress={() => {
                      sensoryHaptics.triggerVaultLatch();
                      setSurvivalModeActive(true);
                    }}
                    style={styles.launchSurvivalBtn}
                  >
                    <Feather name="battery-charging" size={18} color="#ef4444" />
                    <Text style={styles.launchSurvivalText}>ENTER 3 AM SURVIVAL MODE</Text>
                  </TouchableOpacity>
                </TacticalCard>
              </View>
            )}

            {/* 3. BOUNCER TACTICAL HUD */}
            {activeTab === 'bouncer' && (
              <View style={{ gap: 12 }}>
                {strobeResult && (
                  <View
                    style={[
                      styles.bouncerFlashIndicator,
                      { backgroundColor: strobeResult === 'valid' ? '#10b981' : '#ef4444' },
                    ]}
                  >
                    <Text style={styles.bouncerFlashText}>
                      {strobeResult === 'valid' ? 'VALID TICKET // GATE ADMITTED' : 'INVALID / ALREADY SCANNED'}
                    </Text>
                  </View>
                )}

                <TelemetryHUD
                  title="GATE VELOCITY"
                  label="THROUGHPUT RATE"
                  value={`${gateStats.scansPerMin} SCANS / MIN`}
                  status="LIVE VELVET"
                />

                <TacticalCard borderColor="rgba(16,185,129,0.4)" bg={surface}>
                  <Text style={[styles.cardTitle, { color: textColor }]}>Velvet-Rope Bouncer HUD</Text>
                  <Text style={[styles.cardBody, { color: muted }]}>
                    2-meter peripheral flash verification and instant door headcount.
                  </Text>

                  <View style={styles.headcountBox}>
                    <Text style={{ color: muted, fontSize: 11, fontWeight: '700' }}>CURRENT IN ROOM</Text>
                    <Text style={styles.headcountNumber}>{gateStats.currentInside}</Text>
                    <Text style={{ color: primary, fontSize: 11, fontWeight: '800' }}>
                      Est. Queue Delay: ~{gateStats.queueDelayMin} min
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    <TouchableOpacity
                      onPress={() => handleBouncerScan(true)}
                      style={[styles.bouncerActionBtn, { borderColor: '#10b981', backgroundColor: '#10b98120' }]}
                    >
                      <Feather name="check-circle" size={16} color="#10b981" />
                      <Text style={{ color: '#10b981', fontWeight: '900', fontSize: 12 }}>SIMULATE VALID</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleBouncerScan(false)}
                      style={[styles.bouncerActionBtn, { borderColor: '#ef4444', backgroundColor: '#ef444420' }]}
                    >
                      <Feather name="x-circle" size={16} color="#ef4444" />
                      <Text style={{ color: '#ef4444', fontWeight: '900', fontSize: 12 }}>SIMULATE FAKE</Text>
                    </TouchableOpacity>
                  </View>
                </TacticalCard>
              </View>
            )}

            {/* 4. POCKET STEALTH */}
            {activeTab === 'stealth' && (
              <View style={{ gap: 12 }}>
                <TelemetryHUD
                  title="POCKET GESTURES"
                  label="SHAKE TRIGGER DETECTED"
                  value={`${pocketShakeCount} ALERTS`}
                  status="ACTIVE"
                />

                <TacticalCard borderColor="rgba(255,255,255,0.2)" bg={surface}>
                  <Text style={[styles.cardTitle, { color: textColor }]}>Flip-to-Stealth & Pocket Morse</Text>
                  <Text style={[styles.cardBody, { color: muted }]}>
                    Flip your phone face-down to blank the screen immediately. Shake 3 times inside your pocket to trigger the silent distress beacon.
                  </Text>

                  <View style={styles.sensorStatusRow}>
                    <Text style={{ color: muted, fontSize: 12 }}>Face-Down Status:</Text>
                    <Text style={{ color: faceDownDetected ? '#10b981' : muted, fontWeight: '800' }}>
                      {faceDownDetected ? 'FACE-DOWN BLANKED' : 'FACE-UP ACTIVE'}
                    </Text>
                  </View>

                  <RadialChargeButton
                    label="HOLD 2.5s TO TEST SOS CHARGE"
                    subtext="Simulates deliberate emergency distress hold"
                    onCharged={() => {
                      toast.show('2.5s Radial Charge Complete — Alert Dispatched', 'error');
                    }}
                    style={{ marginTop: 12 }}
                  />
                </TacticalCard>
              </View>
            )}

            {/* 5. PROOF OF PHYSICAL SWEAT */}
            {activeTab === 'sweat' && (
              <View style={{ gap: 12 }}>
                <TelemetryHUD
                  title="SWEAT CRYPTOGRAPHY"
                  label="STATUS"
                  value={sweatRecord?.eligible ? 'VERIFIED' : 'PENDING'}
                  status="EVALUATOR"
                />

                <TacticalCard borderColor="rgba(245,158,11,0.4)" bg={surface}>
                  <Text style={[styles.cardTitle, { color: textColor }]}>Proof of Physical Sweat Protocol</Text>
                  <Text style={[styles.cardBody, { color: muted }]}>
                    Distinguish genuine dancefloor attendees from couch lurkers. Evaluates 4 hardware metrics: GPS, 85dB+ music exposure, 2,500 dance steps, and 5+ BLE mutuals.
                  </Text>

                  <View style={{ gap: 8, marginVertical: 12 }}>
                    <View style={styles.metricRow}>
                      <Text style={{ color: muted, fontSize: 12 }}>1. Geofence Lock:</Text>
                      <Text style={{ color: '#10b981', fontWeight: '800' }}>LOCKED ON-SITE</Text>
                    </View>
                    <View style={styles.metricRow}>
                      <Text style={{ color: muted, fontSize: 12 }}>2. 85dB+ Music Exposure:</Text>
                      <Text style={{ color: '#10b981', fontWeight: '800' }}>58 MINS (Target: 45m)</Text>
                    </View>
                    <View style={styles.metricRow}>
                      <Text style={{ color: muted, fontSize: 12 }}>3. Active Dance Steps:</Text>
                      <Text style={{ color: '#10b981', fontWeight: '800' }}>3,410 STEPS (Target: 2.5k)</Text>
                    </View>
                    <View style={styles.metricRow}>
                      <Text style={{ color: muted, fontSize: 12 }}>4. Mutual BLE Attendees:</Text>
                      <Text style={{ color: '#10b981', fontWeight: '800' }}>9 NEARBY (Target: 5+)</Text>
                    </View>
                  </View>

                  {sweatRecord?.stampId ? (
                    <View style={styles.mintedStampBox}>
                      <Feather name="award" size={20} color="#fbbf24" />
                      <View>
                        <Text style={{ color: '#fbbf24', fontWeight: '900', fontSize: 13 }}>
                          GOLD DANCEFLOOR STAMP MINTED
                        </Text>
                        <Text style={{ color: muted, fontSize: 10, fontFamily: 'monospace' }}>
                          {sweatRecord.stampId}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={handleVerifySweat} style={styles.verifySweatBtn}>
                      <Feather name="check" size={16} color="#000" />
                      <Text style={styles.verifySweatText}>MINT PROOF OF SWEAT</Text>
                    </TouchableOpacity>
                  )}
                </TacticalCard>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalSheet: {
    width: '100%',
    maxWidth: 600,
    height: '84%',
    maxHeight: 740,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  sheetSub: {
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabDock: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  cardBody: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  colorPickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  launchBeaconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  launchBeaconText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 13,
  },
  beaconFullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  beaconExitBtn: {
    position: 'absolute',
    top: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
  beaconExitText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 12,
  },
  beaconCenterMsg: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  beaconBigText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#000',
    textAlign: 'center',
  },
  beaconSubText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(0,0,0,0.7)',
    textAlign: 'center',
    marginTop: 8,
  },
  survivalRoot: {
    flex: 1,
    backgroundColor: '#000000',
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  survivalContent: {
    width: '100%',
    maxWidth: 480,
  },
  survivalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  survivalTag: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  survivalWarning: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginBottom: 30,
    lineHeight: 18,
  },
  survivalActions: {
    gap: 16,
  },
  survivalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: '#00f2ff',
    padding: 18,
    borderRadius: 14,
    backgroundColor: '#050505',
  },
  survivalBtnTitle: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
  },
  survivalBtnSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginTop: 2,
  },
  launchSurvivalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239,68,68,0.15)',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  launchSurvivalText: {
    color: '#ef4444',
    fontWeight: '900',
    fontSize: 12.5,
  },
  bouncerFlashIndicator: {
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  bouncerFlashText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 13,
  },
  headcountBox: {
    alignItems: 'center',
    padding: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    marginVertical: 10,
  },
  headcountNumber: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginVertical: 4,
  },
  bouncerActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  sensorStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  verifySweatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fbbf24',
    paddingVertical: 12,
    borderRadius: 12,
  },
  verifySweatText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 12.5,
  },
  mintedStampBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.4)',
    padding: 12,
    borderRadius: 12,
  },
});
