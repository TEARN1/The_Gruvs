/**
 * CultureArtifactsModal — Butcher Receipts, Bottle Sparklers, Drink Tokens, Tachometer Dials, Split-Flap Scoreboards & Scratch-Off Cards.
 *
 * Implements:
 * - 7.1 Digital Butcher-Paper Perforated Order Stub (Kota pipeline receipt)
 * - 7.2 Vibrating Kitchen Buzzer Haptic Cadence
 * - 7.3 Synchronized Golden Screen Bottle Sparkler (Birthday toast)
 * - 7.4 Tamper-Proof Oscillating Watermark Drink Token (1-swipe bartender pour gesture)
 * - 7.5 Analog Automotive Tachometer Decibel Dial (0-140 dB redline gauge)
 * - 7.6 Technical Blueprint Car Spec Sheets
 * - 7.7 Mechanical Split-Flap Sports Scoreboard & Penalty Dot-Track
 * - 7.8 Scratch-Card Secret Headliner Reveal
 * - 8.5 Woven Cloth Digital Festival Wristbands
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
  Animated,
  PanResponder,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { sensoryHaptics } from '../services/sensoryHapticEngine';
import { useToast } from './ToastNotification';
import { TacticalCard, TelemetryHUD, PerimeterSparkler } from './KasiIndustrialUI';

const TABS = [
  { key: 'butcher', label: 'Kota Receipt', icon: 'file-text' },
  { key: 'sparkler', label: 'Bottle Sparkler', icon: 'sun' },
  { key: 'drink_token', label: 'Drink Token', icon: 'coffee' },
  { key: 'tachometer', label: 'Car Decibels', icon: 'activity' },
  { key: 'split_flap', label: 'Scoreboard', icon: 'flag' },
  { key: 'scratch', label: 'Scratch Card', icon: 'gift' },
  { key: 'wristband', label: 'Cloth Wristband', icon: 'tag' },
];

export function CultureArtifactsModal({
  visible,
  event,
  onClose,
  primary = '#00f2ff',
  textColor = '#fff',
  muted = 'rgba(255,255,255,0.55)',
  surface = '#111618',
  bg = '#080b0d',
}) {
  const [activeTab, setActiveTab] = useState('butcher');
  const toast = useToast();

  // 1. Butcher Receipt State
  const [receiptTorn, setReceiptTorn] = useState(false);

  // 2. Bottle Sparkler State
  const [sparklerActive, setSparklerActive] = useState(false);
  const sparklerAnim = useRef(new Animated.Value(0)).current;

  // 3. Tamper-Proof Drink Token State
  const [tokenRedeemed, setTokenRedeemed] = useState(false);
  const pourAnim = useRef(new Animated.Value(0)).current;

  // 4. Tachometer State
  const [currentDb, setCurrentDb] = useState(118.4);
  const needleAnim = useRef(new Animated.Value(currentDb)).current;

  // 5. Split-Flap Scoreboard State
  const [teamAScore, setTeamAScore] = useState(2);
  const [teamBScore, setTeamBScore] = useState(1);
  const [penalties, setPenalties] = useState({
    teamA: ['scored', 'scored', 'missed', 'scored', 'pending'],
    teamB: ['scored', 'scored', 'scored', 'missed', 'pending'],
  });

  // 6. Scratch Card State
  const [scratchProgress, setScratchProgress] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);

  // 7. Cloth Wristband State
  const wristbandSerial = `#GRV-${(event?.id || '8842').slice(0, 4).toUpperCase()}-VIP`;

  // Sparkler Animation Loop
  useEffect(() => {
    if (!sparklerActive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sparklerAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(sparklerAnim, { toValue: 0.2, duration: 250, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [sparklerActive]);

  // Handle Tear Receipt
  const handleTearReceipt = () => {
    sensoryHaptics.triggerKitchenBuzzer();
    setReceiptTorn(true);
    toast.show('KOTA STUB COLLECTED — Kitchen Buzzer Triggered', 'success');
  };

  // Handle Bartender Pour Swipe
  const handlePourRedeem = () => {
    sensoryHaptics.triggerVaultLatch();
    Animated.timing(pourAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      setTokenRedeemed(true);
      toast.show('TOKEN REDEEMED — Drink Poured by Bartender', 'success');
    });
  };

  // Scratch card touch responder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: () => {
        if (isRevealed) return;
        sensoryHaptics.triggerVinylScrub();
        setScratchProgress((prev) => {
          const next = prev + 8;
          if (next >= 100) {
            setIsRevealed(true);
            sensoryHaptics.triggerLogDrum('heavy');
            toast.show('SECRET ACT REVEALED: KABZA DE SMALL & FRIENDS', 'success');
            return 100;
          }
          return next;
        });
      },
    })
  ).current;

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: bg }]}>
          {/* Header */}
          <View style={[styles.sheetHeader, { borderBottomColor: `${primary}20` }]}>
            <View>
              <Text style={[styles.sheetTitle, { color: textColor }]}>Cultural Artifacts Hub</Text>
              <Text style={[styles.sheetSub, { color: muted }]}>Receipts · Sparklers · Dials · Scoreboards · Scratch Cards</Text>
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
            {/* 1. KOTA BUTCHER RECEIPT */}
            {activeTab === 'butcher' && (
              <View style={{ gap: 12 }}>
                <TelemetryHUD
                  title="KITCHEN TELEMETRY"
                  label="GRILL STATUS"
                  value={receiptTorn ? 'COLLECTED' : 'HOT AT COUNTER'}
                  status="CHIPS FRYING"
                />

                <View style={styles.butcherPaperStub}>
                  <View style={styles.butcherHeader}>
                    <Text style={styles.butcherKasiName}>SOWETO CORNER KITCHEN // 02:40 AM</Text>
                    <Text style={styles.butcherOrderNum}>ORDER #48</Text>
                  </View>

                  <View style={styles.butcherBody}>
                    <Text style={styles.butcherItem}>1x SPECIAL KOTA (Russian, Polony, Cheese, Atchar)</Text>
                    <Text style={styles.butcherItem}>1x EXTRA CHIPS & CHAKALAKA</Text>
                    <Text style={styles.butcherTotal}>TOTAL: R 75.00 · PAID VIA COINS</Text>
                  </View>

                  {/* Jagged Perforated Tear Line */}
                  <View style={styles.perforatedLine} />

                  <View style={styles.butcherBottom}>
                    <Text style={styles.butcherStubId}>VERIFIED RECEIPT: #KOTA-9921-SOW</Text>
                    {receiptTorn ? (
                      <View style={styles.tornBadge}>
                        <Feather name="check" size={14} color="#10b981" />
                        <Text style={{ color: '#10b981', fontWeight: '900', fontSize: 11 }}>COLLECTED AT COUNTER</Text>
                      </View>
                    ) : (
                      <TouchableOpacity onPress={handleTearReceipt} style={styles.tearBtn}>
                        <Feather name="scissors" size={14} color="#000" />
                        <Text style={styles.tearBtnText}>TEAR OFF STUB & BUZZ KITCHEN</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* 2. BOTTLE SPARKLER */}
            {activeTab === 'sparkler' && (
              <View style={{ gap: 12 }}>
                <TelemetryHUD
                  title="VIP TOAST TELEMETRY"
                  label="SPARKLER BURST"
                  value={sparklerActive ? 'FIZZING' : 'IDLE'}
                  status="SYNCHRONIZED"
                />

                <TacticalCard borderColor="rgba(251,191,36,0.4)" bg={surface}>
                  <Text style={[styles.cardTitle, { color: textColor }]}>Synchronized Screen Bottle Sparkler</Text>
                  <Text style={[styles.cardBody, { color: muted }]}>
                    When the champagne bottle arrives or the clock hits midnight, all squad members hold their phones high to light up the VIP table.
                  </Text>

                  <View style={[styles.sparklerDisplayBox, { borderColor: sparklerActive ? '#fbbf24' : 'rgba(255,255,255,0.1)' }]}>
                    <Animated.View
                      style={[
                        styles.sparklerCenterFlame,
                        {
                          transform: [{ scale: sparklerActive ? sparklerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.4] }) : 1 }],
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 52 }}>🍾✨</Text>
                    </Animated.View>
                    <Text style={{ color: sparklerActive ? '#fbbf24' : muted, fontWeight: '900', fontSize: 14 }}>
                      {sparklerActive ? '✨ VIP BOTTLE SPARKLER FIZZING ✨' : 'READY TO LIGHT VIP SPARKLER'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      sensoryHaptics.triggerLogDrum('double_drop');
                      setSparklerActive(!sparklerActive);
                    }}
                    style={[styles.sparklerToggleBtn, { backgroundColor: sparklerActive ? '#ef4444' : '#fbbf24' }]}
                  >
                    <Feather name={sparklerActive ? 'slash' : 'sun'} size={18} color="#000" />
                    <Text style={styles.sparklerToggleText}>
                      {sparklerActive ? 'EXTINGUISH SPARKLER' : 'LIGHT SQUAD BOTTLE SPARKLER'}
                    </Text>
                  </TouchableOpacity>
                </TacticalCard>
              </View>
            )}

            {/* 3. TAMPER-PROOF DRINK TOKEN */}
            {activeTab === 'drink_token' && (
              <View style={{ gap: 12 }}>
                <TelemetryHUD
                  title="VOUCHER TELEMETRY"
                  label="WATERMARK OSCILLATION"
                  value="TAMPER-PROOF SECURE"
                  status={tokenRedeemed ? 'VOIDED' : 'VALID'}
                />

                <TacticalCard borderColor="rgba(236,72,153,0.4)" bg={surface}>
                  <Text style={[styles.cardTitle, { color: textColor }]}>Tamper-Proof Birthday Drink Token</Text>
                  <Text style={[styles.cardBody, { color: muted }]}>
                    Features an oscillating live watermark. Bartender swipes across the glass to redeem and pour your free celebratory drink.
                  </Text>

                  <View style={styles.tokenCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.tokenType}>FREE BIRTHDAY COCKTAIL / SHOT</Text>
                      <View style={styles.liveWatermarkPill}>
                        <Text style={styles.liveWatermarkText}>LIVE OSCILLATION</Text>
                      </View>
                    </View>

                    <Text style={styles.tokenValue}>1x SIGNATURE POUR</Text>
                    <Text style={{ color: muted, fontSize: 10.5 }}>Redeemable at any main venue bar before 03:00 AM</Text>

                    {tokenRedeemed ? (
                      <View style={styles.redeemedStamp}>
                        <Text style={styles.redeemedStampText}>POURED & REDEEMED // VOID</Text>
                      </View>
                    ) : (
                      <TouchableOpacity onPress={handlePourRedeem} style={styles.pourSwipeBtn}>
                        <Feather name="droplet" size={16} color="#000" />
                        <Text style={styles.pourSwipeText}>BARTENDER: SWIPE TO POUR</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TacticalCard>
              </View>
            )}

            {/* 4. TACHOMETER DECIBEL DIAL */}
            {activeTab === 'tachometer' && (
              <View style={{ gap: 12 }}>
                <TelemetryHUD
                  title="SOUND-OFF TELEMETRY"
                  label="PEAK PRESSURE"
                  value={`${currentDb} dB`}
                  status="REDLINE"
                />

                <TacticalCard borderColor="rgba(245,158,11,0.4)" bg={surface}>
                  <Text style={[styles.cardTitle, { color: textColor }]}>Automotive Tachometer Decibel Dial</Text>
                  <Text style={[styles.cardBody, { color: muted }]}>
                    Modeled after competition Defi/VDO gauges with sweeping redline needle and peak shift-light.
                  </Text>

                  <View style={styles.tachometerBox}>
                    <View style={styles.tachometerDial}>
                      <Text style={styles.tachometerUnit}>dB PEAK</Text>
                      <Text style={styles.tachometerValue}>{currentDb}</Text>
                      <View style={[styles.shiftLight, { backgroundColor: currentDb > 115 ? '#ef4444' : '#10b981' }]} />
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    {[104.2, 118.4, 126.8, 134.1].map((db) => (
                      <TouchableOpacity
                        key={db}
                        onPress={() => {
                          sensoryHaptics.triggerLogDrum('heavy');
                          setCurrentDb(db);
                        }}
                        style={[
                          styles.presetDbBtn,
                          { borderColor: currentDb === db ? '#f59e0b' : 'rgba(255,255,255,0.1)' },
                        ]}
                      >
                        <Text style={{ color: currentDb === db ? '#f59e0b' : muted, fontWeight: '800', fontSize: 11 }}>
                          {db} dB
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </TacticalCard>
              </View>
            )}

            {/* 5. SPLIT-FLAP SCOREBOARD & PENALTIES */}
            {activeTab === 'split_flap' && (
              <View style={{ gap: 12 }}>
                <TelemetryHUD
                  title="MATCH CLOCK TELEMETRY"
                  label="TOURNAMENT FINAL"
                  value="88' MIN // EXTRA TIME"
                  status="TOP 32"
                />

                <TacticalCard borderColor="rgba(16,185,129,0.4)" bg={surface}>
                  <Text style={[styles.cardTitle, { color: textColor }]}>Mechanical Split-Flap Scoreboard</Text>
                  <Text style={[styles.cardBody, { color: muted }]}>
                    Analog stadium score cards with sudden-death penalty shootout dot-track.
                  </Text>

                  <View style={styles.scoreRow}>
                    <View style={styles.splitFlapBox}>
                      <Text style={styles.splitFlapTeam}>SOWETO STARS</Text>
                      <Text style={styles.splitFlapDigit}>{teamAScore}</Text>
                    </View>

                    <Text style={{ color: muted, fontWeight: '900', fontSize: 20 }}>VS</Text>

                    <View style={styles.splitFlapBox}>
                      <Text style={styles.splitFlapTeam}>ALEX BIRDS</Text>
                      <Text style={styles.splitFlapDigit}>{teamBScore}</Text>
                    </View>
                  </View>

                  {/* Penalty Shootout Dot Track */}
                  <View style={styles.penaltyTrack}>
                    <Text style={{ color: muted, fontSize: 10.5, fontWeight: '800' }}>PENALTY SHOOTOUT DOT-TRACK</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {penalties.teamA.map((p, i) => (
                          <View
                            key={i}
                            style={[
                              styles.penaltyDot,
                              { backgroundColor: p === 'scored' ? '#10b981' : p === 'missed' ? '#ef4444' : 'rgba(255,255,255,0.2)' },
                            ]}
                          />
                        ))}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {penalties.teamB.map((p, i) => (
                          <View
                            key={i}
                            style={[
                              styles.penaltyDot,
                              { backgroundColor: p === 'scored' ? '#10b981' : p === 'missed' ? '#ef4444' : 'rgba(255,255,255,0.2)' },
                            ]}
                          />
                        ))}
                      </View>
                    </View>
                  </View>
                </TacticalCard>
              </View>
            )}

            {/* 6. SCRATCH-CARD SECRET HEADLINER */}
            {activeTab === 'scratch' && (
              <View style={{ gap: 12 }}>
                <TelemetryHUD
                  title="REVEAL TELEMETRY"
                  label="SCRATCH PROGRESS"
                  value={`${scratchProgress}% FOIL REMOVED`}
                  status={isRevealed ? 'UNLOCKED' : 'SCRATCH TO UNLOCK'}
                />

                <TacticalCard borderColor="rgba(251,191,36,0.4)" bg={surface}>
                  <Text style={[styles.cardTitle, { color: textColor }]}>Scratch-Card Secret Headliner</Text>
                  <Text style={[styles.cardBody, { color: muted }]}>
                    Rub your thumb back and forth across the card to scratch off the foil and reveal the surprise guest act.
                  </Text>

                  <View {...panResponder.panHandlers} style={styles.scratchPadArea}>
                    <View style={styles.scratchRevealedContent}>
                      <Text style={{ fontSize: 32 }}>👑 🎹</Text>
                      <Text style={styles.secretActName}>KABZA DE SMALL</Text>
                      <Text style={{ color: '#fbbf24', fontSize: 11, fontWeight: '800' }}>LIVE 3-HOUR CLOSING SET</Text>
                    </View>

                    {!isRevealed && (
                      <View style={[styles.scratchFoilOverlay, { opacity: 1 - scratchProgress / 100 }]}>
                        <Feather name="lock" size={24} color="#000" />
                        <Text style={styles.scratchFoilText}>RUB THUMB HERE TO SCRATCH FOIL</Text>
                      </View>
                    )}
                  </View>
                </TacticalCard>
              </View>
            )}

            {/* 7. CLOTH FESTIVAL WRISTBAND */}
            {activeTab === 'wristband' && (
              <View style={{ gap: 12 }}>
                <TelemetryHUD
                  title="WRISTBAND PROOF"
                  label="SERIAL NUMBER"
                  value={wristbandSerial}
                  status="PERMANENT ASSET"
                />

                <TacticalCard borderColor={`${primary}40`} bg={surface}>
                  <Text style={[styles.cardTitle, { color: textColor }]}>Woven Cloth Digital Wristband</Text>
                  <Text style={[styles.cardBody, { color: muted }]}>
                    Permanent proof of attendance minted into your profile passport. Woven fabric pattern with custom metal closure clamp.
                  </Text>

                  <View style={styles.wristbandGraphic}>
                    <View style={[styles.wristbandStrap, { borderColor: primary }]}>
                      <Text style={styles.wristbandText}>★ {event?.title || 'THE GRUVS GROOVE FESTIVAL'} ★</Text>
                      <Text style={styles.wristbandSub}>OFFICIAL ATTENDEE WRISTBAND</Text>
                    </View>
                    <View style={styles.wristbandClamp}>
                      <Text style={styles.clampText}>{wristbandSerial}</Text>
                    </View>
                  </View>
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
  },
  modalSheet: {
    height: '84%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
  butcherPaperStub: {
    backgroundColor: '#dfd7c2', // Warm authentic brown butcher paper
    borderRadius: 6,
    padding: 16,
    borderWidth: 1,
    borderColor: '#c4baa0',
  },
  butcherHeader: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.2)',
    paddingBottom: 8,
    marginBottom: 8,
  },
  butcherKasiName: {
    color: '#332a1e',
    fontSize: 10,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  butcherOrderNum: {
    color: '#000',
    fontSize: 26,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
  },
  butcherBody: {
    gap: 4,
    paddingVertical: 6,
  },
  butcherItem: {
    color: '#221a10',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  butcherTotal: {
    color: '#000',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  perforatedLine: {
    height: 1,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#7a6f56',
    marginVertical: 12,
  },
  butcherBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  butcherStubId: {
    color: '#554936',
    fontSize: 9.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '800',
  },
  tearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tearBtnText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '900',
  },
  tornBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sparklerDisplayBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    marginVertical: 12,
    gap: 10,
  },
  sparklerCenterFlame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparklerToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  sparklerToggleText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 12.5,
  },
  tokenCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ec489950',
    backgroundColor: 'rgba(236,72,153,0.12)',
    marginVertical: 10,
    gap: 6,
  },
  tokenType: {
    color: '#ec4899',
    fontSize: 11,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  liveWatermarkPill: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveWatermarkText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tokenValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },
  pourSwipeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ec4899',
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  pourSwipeText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 12,
  },
  redeemedStamp: {
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#ef4444',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  redeemedStampText: {
    color: '#ef4444',
    fontWeight: '900',
    fontSize: 11.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  tachometerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 14,
    marginVertical: 10,
  },
  tachometerDial: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tachometerUnit: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '800',
  },
  tachometerValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  shiftLight: {
    position: 'absolute',
    top: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  presetDbBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginVertical: 12,
  },
  splitFlapBox: {
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: '#0a0d0f',
    width: 120,
  },
  splitFlapTeam: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  splitFlapDigit: {
    color: '#10b981',
    fontSize: 42,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 4,
  },
  penaltyTrack: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  penaltyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  scratchPadArea: {
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    marginVertical: 12,
    backgroundColor: '#0a0d0f',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
  },
  scratchRevealedContent: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  secretActName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  scratchFoilOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#d1d5db', // Metallic silver foil
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scratchFoilText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '900',
  },
  wristbandGraphic: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  wristbandStrap: {
    flex: 1,
    backgroundColor: '#00f2ff15',
    borderWidth: 1,
    padding: 14,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    gap: 2,
  },
  wristbandText: {
    color: '#00f2ff',
    fontWeight: '900',
    fontSize: 13,
  },
  wristbandSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '700',
  },
  wristbandClamp: {
    backgroundColor: '#374151', // Metal clamp
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  clampText: {
    color: '#f3f4f6',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '900',
  },
});
