/**
 * InPersonVibeRadarModal — In-Person Networking, Crew Proximity Radar & Morning After Memories.
 *
 * Provides:
 * - NFC & Dynamic Vibe Handshake (Instant contact swap)
 * - "Where's My Crew?" Live Venue Proximity Radar
 * - Mutual Ground Co-attendance History ("Crossed Paths")
 * - "The Morning After" 24h Collective Camera Roll
 * - "Mayor of the Spot" Physical Touch Down Leaderboard
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Modal,
  Switch,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { InPersonVibeService } from '../services/inPersonVibeService';
import { ControlledGlitterBurst } from './ControlledGlitterBurst';
import { haptics } from '../utils/haptics';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';

const TABS = [
  { key: 'handshake', label: 'Vibe Handshake', icon: 'zap' },
  { key: 'crew_radar', label: 'Crew Radar', icon: 'radio' },
  { key: 'crossed_paths', label: 'Crossed Paths', icon: 'git-merge' },
  { key: 'morning_roll', label: 'Morning Roll', icon: 'camera' },
  { key: 'mayor', label: 'Venue Mayor', icon: 'award' },
];

export function InPersonVibeRadarModal({
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

  const [activeTab, setActiveTab] = useState('handshake');
  const [crewList, setCrewList] = useState([]);
  const [mutualEvents, setMutualEvents] = useState([]);
  const [morningRoll, setMorningRoll] = useState([]);
  const [mayorData, setMayorData] = useState(null);
  const [glitters, setGlitters] = useState({});

  // Form states
  const [rollCaption, setRollCaption] = useState('');
  const [ghostMode, setGhostMode] = useState(false);

  const loadData = useCallback(async () => {
    if (!event?.id) return;
    const [crew, mutuals, roll, mayors] = await Promise.all([
      InPersonVibeService.getCrewProximity(event.id, user?.id),
      InPersonVibeService.getMutualGroundEvents(user?.id, 'partner_sample'),
      InPersonVibeService.getMorningAfterRoll(event.id),
      InPersonVibeService.getVenueMayors(event.id),
    ]);
    setCrewList(crew);
    setMutualEvents(mutuals);
    setMorningRoll(roll);
    setMayorData(mayors);
  }, [event?.id, user?.id]);

  useEffect(() => {
    if (visible) loadData();
  }, [visible, loadData]);

  const triggerGlitter = (key) => {
    haptics.success?.();
    setGlitters(prev => ({ ...prev, [key]: Date.now() }));
  };

  const handleSimulateHandshake = async () => {
    triggerGlitter('handshake_act');
    await InPersonVibeService.recordHandshake({
      myUserId: user?.id,
      partnerUser: { username: 'Kagiso_Vibe', bio: 'Amapiano producer & DJ' },
      eventId: event.id,
    });
    toast?.('NFC Vibe Handshake Complete! Contact card exchanged & saved. ⚡', 'success');
  };

  const handleDropToRoll = async () => {
    triggerGlitter('drop_photo');
    await InPersonVibeService.dropMediaToMorningRoll({
      eventId: event.id,
      author: user?.user_metadata?.username || 'You',
      mediaUrl: 'https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=600',
      caption: rollCaption || 'Midnight moment at the sound desk 🎧',
      ghostMode,
    });
    setRollCaption('');
    loadData();
    toast?.('Photo dropped into 24h Collective Camera Roll! 📸', 'success');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
        <View style={[styles.sheetContainer, { backgroundColor: bg, borderColor: `${primary}35` }]}>
          {/* Header */}
          <View style={[styles.headerRow, { borderBottomColor: `${primary}20` }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name="zap" size={18} color={primary} />
              <Text style={[styles.headerTitle, { color: textColor }]}>In-Person Vibe & Crew Radar</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={muted} />
            </TouchableOpacity>
          </View>

          {/* Subheader */}
          <View style={styles.eventContextBar}>
            <Text style={[styles.eventContextTitle, { color: textColor }]} numberOfLines={1}>
              {event?.title || 'Physical Connection'}
            </Text>
            <Text style={[styles.eventContextSub, { color: primary }]}>NFC Tap, Squad Proximity & Memories</Text>
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
            {/* ── 1. VIBE HANDSHAKE ── */}
            {activeTab === 'handshake' && (
              <View style={styles.sectionWrap}>
                <View style={[styles.infoBanner, { borderColor: `${primary}35`, backgroundColor: `${primary}10` }]}>
                  <Feather name="zap" size={18} color={primary} />
                  <Text style={[styles.infoBannerText, { color: textColor }]}>
                    Too loud to shout handles? Hold phones back-to-back to instantly exchange your Vibe Profile & mutual contacts!
                  </Text>
                </View>

                <View style={[styles.handshakeBox, { borderColor: `${primary}45`, backgroundColor: surface }]}>
                  <View style={[styles.nfcIconPulse, { borderColor: primary }]}>
                    <Feather name="smartphone" size={38} color={primary} />
                  </View>
                  <Text style={[styles.handshakeTitle, { color: textColor }]}>NFC Ready · Tap Phones Together</Text>
                  <Text style={[styles.handshakeSub, { color: muted }]}>
                    Hold the back of your phone near another viber's phone.
                  </Text>

                  <TouchableOpacity
                    onPress={handleSimulateHandshake}
                    style={[styles.primaryActionBtn, { backgroundColor: primary, marginTop: 14, width: '100%', position: 'relative' }]}
                    activeOpacity={0.85}
                  >
                    <Feather name="refresh-cw" size={14} color="#000" />
                    <Text style={styles.primaryActionBtnText}>Trigger Vibe Handshake (Tap)</Text>
                    <ControlledGlitterBurst trigger={glitters.handshake_act} count={12} radius={32} colors={[primary, '#ffd700', '#fff']} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── 2. CREW PROXIMITY RADAR ── */}
            {activeTab === 'crew_radar' && (
              <View style={styles.sectionWrap}>
                <View style={[styles.infoBanner, { borderColor: '#10b98140', backgroundColor: '#10b98112' }]}>
                  <Feather name="radio" size={18} color="#10b981" />
                  <Text style={[styles.infoBannerText, { color: textColor }]}>
                    Live directional radar. Find your squad inside crowded multi-stage venues without endless calling.
                  </Text>
                </View>

                {crewList.map(member => (
                  <View key={member.id} style={[styles.crewCard, { borderColor: `${primary}30`, backgroundColor: surface }]}>
                    <View style={[styles.avatarCircle, { borderColor: primary, backgroundColor: `${primary}20` }]}>
                      <Text style={{ color: primary, fontWeight: '900', fontSize: 13 }}>
                        {member.username.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.crewName, { color: textColor }]}>@{member.username}</Text>
                      <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '800' }}>
                        📍 ~{member.distanceMeters}m away · {member.locationDesc}
                      </Text>
                      <Text style={{ color: muted, fontSize: 10 }}>🔋 Battery: {member.batteryLevel}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => toast?.(`Pinging @${member.username} with radar ping! 📍`, 'success')}
                      style={[styles.smallBtn, { backgroundColor: `${primary}18`, borderColor: `${primary}45` }]}
                    >
                      <Feather name="navigation" size={13} color={primary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* ── 3. CROSSED PATHS ── */}
            {activeTab === 'crossed_paths' && (
              <View style={styles.sectionWrap}>
                <View style={[styles.infoBanner, { borderColor: `${primary}35`, backgroundColor: `${primary}10` }]}>
                  <Feather name="git-merge" size={18} color={primary} />
                  <Text style={[styles.infoBannerText, { color: textColor }]}>
                    Mutual Ground. Events and festivals you and this viber both attended together in the past.
                  </Text>
                </View>

                <Text style={[styles.sectionSubtitle, { color: textColor }]}>Shared Event Footprints</Text>
                {mutualEvents.map(ev => (
                  <View key={ev.event_id} style={[styles.resaleRow, { borderColor: `${primary}30`, backgroundColor: surface }]}>
                    <View>
                      <Text style={[styles.resaleTier, { color: textColor }]}>{ev.title}</Text>
                      <Text style={{ color: primary, fontSize: 11, fontWeight: '800' }}>📍 {ev.location} · {ev.date}</Text>
                    </View>
                    <View style={[styles.matchBadge, { backgroundColor: `${primary}18` }]}>
                      <Text style={{ color: primary, fontSize: 10, fontWeight: '900' }}>CO-PRESENT</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ── 4. MORNING AFTER ROLL ── */}
            {activeTab === 'morning_roll' && (
              <View style={styles.sectionWrap}>
                <View style={[styles.infoBanner, { borderColor: '#ec489945', backgroundColor: '#ec489912' }]}>
                  <Feather name="camera" size={18} color="#ec4899" />
                  <Text style={[styles.infoBannerText, { color: textColor }]}>
                    24-hour collective camera roll. Raw event memories dumped by attendees. Disappears after 24 hours.
                  </Text>
                </View>

                {/* Drop photo form */}
                <View style={[styles.boxCard, { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: surface }]}>
                  <Text style={[styles.boxTitle, { color: textColor }]}>Drop a Photo to the Event Dump</Text>
                  <TextInput
                    style={[styles.inputFull, { color: textColor, borderColor: 'rgba(255,255,255,0.2)' }]}
                    placeholder="Caption (e.g. When the DJ dropped that log drum 🔥)"
                    placeholderTextColor={muted}
                    value={rollCaption}
                    onChangeText={setRollCaption}
                  />
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
                    <View>
                      <Text style={{ color: textColor, fontSize: 12.5, fontWeight: '800' }}>Ghost Mode (Privacy Blur)</Text>
                      <Text style={{ color: muted, fontSize: 10.5 }}>Softly blur faces in the public gallery</Text>
                    </View>
                    <Switch value={ghostMode} onValueChange={setGhostMode} trackColor={{ false: '#333', true: primary }} />
                  </View>
                  <TouchableOpacity
                    onPress={handleDropToRoll}
                    style={[styles.primaryActionBtn, { backgroundColor: '#ec4899', marginTop: 10, position: 'relative' }]}
                    activeOpacity={0.85}
                  >
                    <Feather name="upload" size={14} color="#fff" />
                    <Text style={[styles.primaryActionBtnText, { color: '#fff' }]}>Drop to 24h Collective Roll</Text>
                    <ControlledGlitterBurst trigger={glitters.drop_photo} count={12} radius={30} colors={['#ec4899', '#fff']} />
                  </TouchableOpacity>
                </View>

                {/* Media gallery */}
                <Text style={[styles.sectionSubtitle, { color: textColor }]}>Live Collective Dump</Text>
                <View style={{ gap: 12 }}>
                  {morningRoll.map(item => (
                    <View key={item.id} style={[styles.mediaCard, { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: surface }]}>
                      <Image source={{ uri: item.media_url }} style={styles.mediaImg} />
                      <View style={{ padding: 12, gap: 4 }}>
                        <Text style={{ color: primary, fontSize: 11, fontWeight: '800' }}>@{item.author}</Text>
                        <Text style={{ color: textColor, fontSize: 12.5, lineHeight: 16 }}>{item.caption}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── 5. MAYOR OF THE SPOT ── */}
            {activeTab === 'mayor' && (
              <View style={styles.sectionWrap}>
                <View style={[styles.mayorCard, { borderColor: '#ffd70045', backgroundColor: surface }]}>
                  <View style={styles.crownWrap}>
                    <Text style={{ fontSize: 32 }}>👑</Text>
                  </View>
                  <Text style={[styles.mayorTitle, { color: '#ffd700' }]}>Reigning Mayor of {event?.title}</Text>
                  <Text style={[styles.mayorHandle, { color: textColor }]}>@{mayorData?.mayor?.username || 'King_Thabo'}</Text>
                  <Text style={{ color: primary, fontWeight: '800', fontSize: 13 }}>
                    {mayorData?.mayor?.touchdowns_30d || 14} Verified Physical Touch Downs
                  </Text>
                  <View style={[styles.perkBox, { borderColor: '#ffd70030', backgroundColor: '#ffd70010' }]}>
                    <Text style={{ color: '#ffd700', fontSize: 11, fontWeight: '800', textAlign: 'center' }}>
                      🎁 Mayor Perk: {mayorData?.mayor?.perk || 'Free VIP Entry & Reserved Door Parking'}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.sectionSubtitle, { color: textColor }]}>Top Touch Down Challengers</Text>
                {mayorData?.runnersUp?.map((challenger, idx) => (
                  <View key={idx} style={[styles.resaleRow, { borderColor: 'rgba(255,255,255,0.1)', backgroundColor: surface }]}>
                    <Text style={{ color: primary, fontWeight: '900', fontSize: 13 }}>#{idx + 2}</Text>
                    <Text style={{ color: textColor, fontWeight: '800', flex: 1, marginLeft: 10 }}>@{challenger.username}</Text>
                    <Text style={{ color: muted, fontSize: 12, fontWeight: '700' }}>{challenger.touchdowns_30d} check-ins</Text>
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
  handshakeBox: { borderWidth: 1, borderRadius: 18, padding: 24, alignItems: 'center', gap: 8 },
  nfcIconPulse: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  handshakeTitle: { fontSize: 15, fontWeight: '900' },
  handshakeSub: { fontSize: 11.5, textAlign: 'center' },
  primaryActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 14 },
  primaryActionBtnText: { color: '#000', fontWeight: '900', fontSize: 13 },
  crewCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12 },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  crewName: { fontSize: 13, fontWeight: '900' },
  smallBtn: { padding: 9, borderRadius: 10, borderWidth: 1 },
  sectionSubtitle: { fontSize: 12, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 6 },
  resaleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 14, padding: 12 },
  resaleTier: { fontSize: 13, fontWeight: '800' },
  matchBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  boxCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  boxTitle: { fontSize: 13, fontWeight: '800' },
  inputFull: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 },
  mediaCard: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  mediaImg: { width: '100%', height: 180 },
  mayorCard: { borderWidth: 1, borderRadius: 18, padding: 20, alignItems: 'center', gap: 6 },
  crownWrap: { marginBottom: 2 },
  mayorTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  mayorHandle: { fontSize: 18, fontWeight: '900' },
  perkBox: { borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 6, width: '100%' },
});
