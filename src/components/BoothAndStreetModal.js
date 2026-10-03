/**
 * BoothAndStreetModal — DJ Booth Audio, Track ID Radar, Kota Orders, 3AM Recovery & Car Meets.
 *
 * Provides:
 * - "Live From The Booth" 15-second DJ audio drops & vibe listening
 * - DJ Live Tracklist & Unreleased Amapiano ID Radar
 * - Kota Live Order Pipeline (Received → Grill → Frying → Ready)
 * - 3 AM After-Groove Recovery Radar (24/7 petrol kitchens & street braai)
 * - Kasi Car Culture Decibel Sound-Off Leaderboard
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { BoothAndStreetService } from '../services/boothAndStreetService';
import { ControlledGlitterBurst } from './ControlledGlitterBurst';
import { haptics } from '../utils/haptics';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';

const TABS = [
  { key: 'booth', label: 'DJ Booth Live', icon: 'headphones' },
  { key: 'tracks', label: 'Track ID Radar', icon: 'disc' },
  { key: 'kotas', label: 'Kota Orders', icon: 'shopping-bag' },
  { key: 'recovery', label: '3AM Recovery', icon: 'moon' },
  { key: 'car_meet', label: 'Car Sound-Off', icon: 'activity' },
];

export function BoothAndStreetModal({
  visible,
  event,
  onClose,
  primary = '#00f2ff',
  textColor = '#fff',
  muted = 'rgba(255,255,255,0.55)',
  surface = '#111618',
  bg = '#080b0d',
}) {
  const { user } = useAuth();
  const { show: toast } = useToast();

  const [activeTab, setActiveTab] = useState('booth');
  const [boothDrop, setBoothDrop] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [tracklist, setTracklist] = useState([]);
  const [kotaOrders, setKotaOrders] = useState([]);
  const [recoverySpots, setRecoverySpots] = useState([]);
  const [soundOffBoard, setSoundOffBoard] = useState([]);
  const [glitters, setGlitters] = useState({});

  // Form states
  const [newTrackName, setNewTrackName] = useState('');
  const [soundCarModel, setSoundCarModel] = useState('');
  const [soundDb, setSoundDb] = useState('132.5');

  const loadData = useCallback(async () => {
    if (!event?.id) return;
    const [drop, tracks, orders, spots, sound] = await Promise.all([
      BoothAndStreetService.getLatestBoothDrop(event.id),
      BoothAndStreetService.getLiveTracklist(event.id),
      BoothAndStreetService.getKotaOrdersForUser(user?.id),
      BoothAndStreetService.getRecoverySpots(event.id),
      BoothAndStreetService.getSoundOffLeaderboard(event.id),
    ]);
    setBoothDrop(drop);
    setTracklist(tracks);
    setKotaOrders(orders);
    setRecoverySpots(spots);
    setSoundOffBoard(sound);
  }, [event?.id, user?.id]);

  useEffect(() => {
    if (visible) loadData();
  }, [visible, loadData]);

  const triggerGlitter = (key) => {
    haptics.success?.();
    setGlitters(prev => ({ ...prev, [key]: Date.now() }));
  };

  const handleToggleBoothAudio = () => {
    triggerGlitter('play_booth');
    setIsPlayingAudio(prev => !prev);
    if (!isPlayingAudio) {
      toast?.('Streaming 15-second live soundboard snippet from the booth! 🎧🔊', 'success');
      setTimeout(() => setIsPlayingAudio(false), 15000);
    }
  };

  const handleAddTrackId = async () => {
    if (!newTrackName.trim()) return;
    triggerGlitter('add_track');
    await BoothAndStreetService.addTrackId({
      eventId: event.id,
      trackTitle: newTrackName,
      userHandle: `@${user?.user_metadata?.username || 'music_head'}`,
    });
    setNewTrackName('');
    loadData();
    toast?.('Track ID submitted to live tracklist! 🎵', 'success');
  };

  const handleLogSoundScore = async () => {
    if (!soundCarModel.trim()) return;
    triggerGlitter('log_sound');
    await BoothAndStreetService.logSoundOffScore({
      eventId: event.id,
      carModel: soundCarModel,
      crew: 'Gauteng Stance & Sound',
      decibels: soundDb,
      category: 'Exhaust & Bass Reflex',
    });
    setSoundCarModel('');
    loadData();
    toast?.(`Logged ${soundDb} dB for ${soundCarModel}! 🚗💥`, 'success');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
        <View style={[styles.sheetContainer, { backgroundColor: bg, borderColor: `${primary}35` }]}>
          {/* Header */}
          <View style={[styles.headerRow, { borderBottomColor: `${primary}20` }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name="headphones" size={18} color={primary} />
              <Text style={[styles.headerTitle, { color: textColor }]}>DJ Booth & Kasi Street Culture</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={muted} />
            </TouchableOpacity>
          </View>

          {/* Subheader */}
          <View style={styles.eventContextBar}>
            <Text style={[styles.eventContextTitle, { color: textColor }]} numberOfLines={1}>
              {event?.title || 'Soundboard & Street Bites'}
            </Text>
            <Text style={[styles.eventContextSub, { color: primary }]}>Raw Audio, Dubplate IDs & 3 AM Food</Text>
          </View>

          {/* Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsWrap}>
            {TABS.map(tab => {
              const active = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={[
                    styles.tabPill,
                    {
                      backgroundColor: active ? `${primary}20` : 'rgba(255,255,255,0.04)',
                      borderColor: active ? primary : 'rgba(255,255,255,0.12)',
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <Feather name={tab.icon} size={13} color={active ? primary : muted} />
                  <Text style={[styles.tabLabel, { color: active ? primary : muted }]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Body Content */}
          <ScrollView contentContainerStyle={styles.bodyScroll} showsVerticalScrollIndicator={false}>
            {/* ── 1. DJ BOOTH LIVE ── */}
            {activeTab === 'booth' && (
              <View style={styles.sectionWrap}>
                <View style={[styles.infoBanner, { borderColor: `${primary}35`, backgroundColor: `${primary}10` }]}>
                  <Feather name="mic" size={18} color={primary} />
                  <Text style={[styles.infoBannerText, { color: textColor }]}>
                    Is the spot jumping? Listen to a live 15-second soundboard snippet directly from the DJ's mixer!
                  </Text>
                </View>

                {boothDrop && (
                  <View style={[styles.boothCard, { borderColor: isPlayingAudio ? '#10b981' : `${primary}45`, backgroundColor: surface }]}>
                    <View style={styles.boothTop}>
                      <View>
                        <Text style={[styles.boothDj, { color: primary }]}>🎧 {boothDrop.dj_name}</Text>
                        <Text style={[styles.boothGenre, { color: textColor }]}>{boothDrop.track_genre}</Text>
                      </View>
                      <View style={[styles.energyBadge, { backgroundColor: '#10b98125', borderColor: '#10b981' }]}>
                        <Text style={styles.energyText}>{boothDrop.energy_level}</Text>
                      </View>
                    </View>

                    {/* Waveform Visualization Mockup */}
                    <View style={styles.waveRow}>
                      {[18, 32, 48, 24, 60, 40, 52, 28, 64, 38, 50, 22, 58, 30, 44, 20].map((h, i) => (
                        <View
                          key={i}
                          style={[
                            styles.waveBar,
                            {
                              height: isPlayingAudio ? h : 14,
                              backgroundColor: isPlayingAudio ? (i % 2 === 0 ? primary : '#10b981') : 'rgba(255,255,255,0.2)',
                            },
                          ]}
                        />
                      ))}
                    </View>

                    <TouchableOpacity
                      onPress={handleToggleBoothAudio}
                      style={[styles.primaryActionBtn, { backgroundColor: isPlayingAudio ? '#ef4444' : primary, position: 'relative' }]}
                      activeOpacity={0.85}
                    >
                      <Feather name={isPlayingAudio ? 'square' : 'play'} size={15} color="#000" />
                      <Text style={styles.primaryActionBtnText}>
                        {isPlayingAudio ? 'Stop Booth Stream' : 'Listen Live From Booth (15s)'}
                      </Text>
                      <ControlledGlitterBurst trigger={glitters.play_booth} count={12} radius={32} colors={[primary, '#10b981', '#fff']} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* ── 2. TRACK ID RADAR ── */}
            {activeTab === 'tracks' && (
              <View style={styles.sectionWrap}>
                <View style={[styles.boxCard, { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: surface }]}>
                  <Text style={[styles.boxTitle, { color: textColor }]}>Identify an Unreleased Dubplate</Text>
                  <TextInput
                    style={[styles.inputFull, { color: textColor, borderColor: `${primary}35` }]}
                    placeholder="Track Title / Producer / ID description..."
                    placeholderTextColor={muted}
                    value={newTrackName}
                    onChangeText={setNewTrackName}
                  />
                  <TouchableOpacity
                    onPress={handleAddTrackId}
                    style={[styles.primaryActionBtn, { backgroundColor: primary, marginTop: 10, position: 'relative' }]}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.primaryActionBtnText}>Post Track ID</Text>
                    <ControlledGlitterBurst trigger={glitters.add_track} count={10} radius={28} colors={[primary, '#ffd700']} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.sectionSubtitle, { color: textColor }]}>Tracks Dropped Tonight</Text>
                {tracklist.map(tr => (
                  <View key={tr.id} style={[styles.trackRow, { borderColor: `${primary}30`, backgroundColor: surface }]}>
                    <Feather name="disc" size={16} color={primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: textColor, fontSize: 13, fontWeight: '800' }}>{tr.title}</Text>
                      <Text style={{ color: muted, fontSize: 10.5 }}>Tagged by {tr.identifiedBy} · {tr.timestamp}</Text>
                    </View>
                    <View style={[styles.tagBadge, { backgroundColor: `${primary}18` }]}>
                      <Text style={{ color: primary, fontSize: 9.5, fontWeight: '900' }}>VERIFIED ID</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ── 3. KOTA LIVE PIPELINE ── */}
            {activeTab === 'kotas' && (
              <View style={styles.sectionWrap}>
                <View style={[styles.infoBanner, { borderColor: '#f59e0b40', backgroundColor: '#f59e0b12' }]}>
                  <Feather name="shopping-bag" size={18} color="#f59e0b" />
                  <Text style={[styles.infoBannerText, { color: textColor }]}>
                    Live Kota kitchen progress. Know exactly when your quarter hits the grill and fries finish dropping!
                  </Text>
                </View>

                {kotaOrders.map(order => (
                  <View key={order.id} style={[styles.kotaCard, { borderColor: '#f59e0b50', backgroundColor: surface }]}>
                    <Text style={[styles.kitchenName, { color: '#f59e0b' }]}>{order.kitchen_name}</Text>
                    <Text style={[styles.comboName, { color: textColor }]}>{order.combo_name}</Text>
                    <Text style={{ color: textColor, fontWeight: '900', fontSize: 14 }}>R{order.price_zar} · ETA ~{order.eta_minutes} mins</Text>

                    {/* Progress steps */}
                    <View style={styles.pipelineRow}>
                      {[
                        { key: 'received', label: 'Order In' },
                        { key: 'grill', label: 'On Grill' },
                        { key: 'frying', label: 'Chips Frying' },
                        { key: 'ready', label: 'Ready at Counter' },
                      ].map((st, i) => (
                        <View key={st.key} style={styles.pipeStep}>
                          <View
                            style={[
                              styles.pipeCircle,
                              {
                                backgroundColor: i <= 1 ? '#10b981' : 'rgba(255,255,255,0.1)',
                                borderColor: i <= 1 ? '#10b981' : 'rgba(255,255,255,0.2)',
                              },
                            ]}
                          >
                            <Feather name="check" size={10} color={i <= 1 ? '#000' : 'transparent'} />
                          </View>
                          <Text style={[styles.pipeLabel, { color: i <= 1 ? textColor : muted }]}>{st.label}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ── 4. 3AM RECOVERY RADAR ── */}
            {activeTab === 'recovery' && (
              <View style={styles.sectionWrap}>
                <View style={[styles.infoBanner, { borderColor: `${primary}35`, backgroundColor: `${primary}10` }]}>
                  <Feather name="moon" size={18} color={primary} />
                  <Text style={[styles.infoBannerText, { color: textColor }]}>
                    Late night food radar. Open 24/7 petrol station bakeries, midnight street braais, and car washes near this event.
                  </Text>
                </View>

                {recoverySpots.map(spot => (
                  <View key={spot.id} style={[styles.resaleRow, { borderColor: `${primary}30`, backgroundColor: surface }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.resaleTier, { color: textColor }]}>{spot.name}</Text>
                      <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '800' }}>⏰ {spot.openStatus}</Text>
                      <Text style={{ color: muted, fontSize: 10.5 }}>{spot.perk} · ~{spot.distanceKm} km</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => toast?.(`Routing to ${spot.name}! 🗺️`, 'success')}
                      style={[styles.smallBtn, { backgroundColor: primary }]}
                    >
                      <Feather name="navigation" size={13} color="#000" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* ── 5. CAR SOUND-OFF ── */}
            {activeTab === 'car_meet' && (
              <View style={styles.sectionWrap}>
                <View style={[styles.boxCard, { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: surface }]}>
                  <Text style={[styles.boxTitle, { color: textColor }]}>Log Decibel Sound-Off Score</Text>
                  <TextInput
                    style={[styles.inputFull, { color: textColor, borderColor: `${primary}35` }]}
                    placeholder="Car Make & Model (e.g. Golf 7R, BMW E30 Gusheshe)"
                    placeholderTextColor={muted}
                    value={soundCarModel}
                    onChangeText={setSoundCarModel}
                  />
                  <TextInput
                    style={[styles.inputFull, { color: textColor, borderColor: `${primary}35`, marginTop: 8 }]}
                    placeholder="Measured Decibels dB (e.g. 134.5)"
                    placeholderTextColor={muted}
                    keyboardType="numeric"
                    value={soundDb}
                    onChangeText={setSoundDb}
                  />
                  <TouchableOpacity
                    onPress={handleLogSoundScore}
                    style={[styles.primaryActionBtn, { backgroundColor: primary, marginTop: 10, position: 'relative' }]}
                    activeOpacity={0.85}
                  >
                    <Feather name="activity" size={14} color="#000" />
                    <Text style={styles.primaryActionBtnText}>Record Decibels</Text>
                    <ControlledGlitterBurst trigger={glitters.log_sound} count={10} radius={28} colors={[primary, '#fff']} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.sectionSubtitle, { color: textColor }]}>Sound-Off Decibel Leaderboard</Text>
                {soundOffBoard.map(car => (
                  <View key={car.rank} style={[styles.resaleRow, { borderColor: car.rank === 1 ? '#ffd70045' : `${primary}30`, backgroundColor: surface }]}>
                    <Text style={{ color: car.rank === 1 ? '#ffd700' : primary, fontWeight: '900', fontSize: 15 }}>#{car.rank}</Text>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={{ color: textColor, fontWeight: '800', fontSize: 13 }}>{car.car_model}</Text>
                      <Text style={{ color: muted, fontSize: 10.5 }}>{car.crew} · {car.category}</Text>
                    </View>
                    <View style={[styles.tagBadge, { backgroundColor: car.rank === 1 ? '#ffd70020' : `${primary}20` }]}>
                      <Text style={{ color: car.rank === 1 ? '#ffd700' : primary, fontWeight: '900', fontSize: 11 }}>
                        {car.decibels} dB
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheetContainer: { maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, overflow: 'hidden' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  closeBtn: { padding: 4 },
  eventContextBar: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.02)' },
  eventContextTitle: { fontSize: 13, fontWeight: '800' },
  eventContextSub: { fontSize: 10, fontWeight: '700', marginTop: 1 },
  tabsWrap: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tabPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  tabLabel: { fontSize: 11.5, fontWeight: '800' },
  bodyScroll: { padding: 16, paddingBottom: 40 },
  sectionWrap: { gap: 14 },
  infoBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1 },
  infoBannerText: { fontSize: 11.5, lineHeight: 16, flex: 1, fontWeight: '600' },
  boothCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  boothTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  boothDj: { fontSize: 14, fontWeight: '900' },
  boothGenre: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  energyBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  energyText: { fontSize: 9.5, fontWeight: '900', color: '#10b981' },
  waveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 70, paddingVertical: 6 },
  waveBar: { width: 5, borderRadius: 3 },
  primaryActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 14 },
  primaryActionBtnText: { color: '#000', fontWeight: '900', fontSize: 13 },
  boxCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  boxTitle: { fontSize: 13, fontWeight: '800' },
  inputFull: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 },
  sectionSubtitle: { fontSize: 12, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 6 },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12 },
  tagBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  kotaCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 6 },
  kitchenName: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  comboName: { fontSize: 14, fontWeight: '900' },
  pipelineRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  pipeStep: { alignItems: 'center', gap: 4, flex: 1 },
  pipeCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pipeLabel: { fontSize: 9, fontWeight: '700', textAlign: 'center' },
  resaleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 14, padding: 12 },
  resaleTier: { fontSize: 13, fontWeight: '800' },
  smallBtn: { padding: 9, borderRadius: 10 },
});
