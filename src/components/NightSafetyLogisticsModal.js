/**
 * NightSafetyLogisticsModal — Nightlife Safety, Squad Care, Lost & Found, Shuttles & Floorplan.
 *
 * Provides:
 * - "Safe Ride Home" Departure Countdown & WhatsApp SOS ping
 * - "Walk Me to My Car" Squad Ping
 * - Live In-Event Lost & Found Bulletin
 * - Festival Party Shuttle Passes & Convoy Tracker
 * - Venue Floorplan & Sound Zones (High-intensity, Chillout, Quiet Corner)
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
  Alert,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { NightSafetyService, buildSafetyShareUrl } from '../services/nightSafetyService';
import { SecurityService } from '../services/securityService';
import { ControlledGlitterBurst } from './ControlledGlitterBurst';
import { haptics } from '../utils/haptics';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';

const TABS = [
  { key: 'safe_home', label: 'Safe Ride Home', icon: 'shield' },
  { key: 'walk_car', label: 'Walk to Car', icon: 'map-pin' },
  { key: 'lost_found', label: 'Lost & Found', icon: 'help-circle' },
  { key: 'shuttles', label: 'Party Shuttles', icon: 'navigation' },
  { key: 'floorplan', label: 'Venue Floorplan', icon: 'layout' },
];

export function NightSafetyLogisticsModal({
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

  const [activeTab, setActiveTab] = useState('safe_home');
  const [activeTimer, setActiveTimer] = useState(null);
  const [lostFoundItems, setLostFoundItems] = useState([]);
  const [shuttles, setShuttles] = useState([]);
  const [floorplan, setFloorplan] = useState(null);
  const [glitters, setGlitters] = useState({});

  // Form states
  const [safeDuration, setSafeDuration] = useState('35');
  const [safeDest, setSafeDest] = useState('Home / Residence');
  const [parkingNote, setParkingNote] = useState('Sector B - Near Main Gate');
  const [reportType, setReportType] = useState('lost');
  const [reportTitle, setReportTitle] = useState('');
  const [reportDesc, setReportDesc] = useState('');

  const loadData = useCallback(async () => {
    if (!event?.id) return;
    const [timer, lf, sht, fp] = await Promise.all([
      NightSafetyService.getActiveSafeTimer(),
      NightSafetyService.getLostAndFoundForEvent(event.id),
      NightSafetyService.getShuttlesForEvent(event.id),
      NightSafetyService.getVenueFloorplan(event.id),
    ]);
    setActiveTimer(timer);
    setLostFoundItems(lf);
    setShuttles(sht);
    setFloorplan(fp);
  }, [event?.id]);

  useEffect(() => {
    if (visible) loadData();
  }, [visible, loadData]);

  const triggerGlitter = (key) => {
    haptics.success?.();
    setGlitters(prev => ({ ...prev, [key]: Date.now() }));
  };

  const handleStartSafeTimer = async () => {
    triggerGlitter('start_timer');
    const timer = await NightSafetyService.startSafeTimer({
      userId: user?.id,
      eventId: event.id,
      durationMinutes: Number(safeDuration),
      destinationLabel: safeDest,
    });
    setActiveTimer(timer);
    // Nobody is alerted automatically (see buildSafetyShareUrl): the trip goes
    // to whoever the user picks in WhatsApp.
    await SecurityService.safeOpenURL(buildSafetyShareUrl('trip', {
      eventTitle: event?.title, destination: safeDest, minutes: safeDuration,
    }));
    toast?.('Timer started on this phone. Send your trip to someone you trust in WhatsApp.', 'success');
  };

  const handleConfirmHomeSafe = async () => {
    triggerGlitter('home_safe');
    await NightSafetyService.confirmHomeSafe();
    setActiveTimer(null);
    await SecurityService.safeOpenURL(buildSafetyShareUrl('home'));
    toast?.('Timer cleared. Let your friend know you made it home.', 'success');
  };

  const handleWalkToCar = async () => {
    triggerGlitter('walk_car');
    await NightSafetyService.sendWalkToCarPing({
      userId: user?.id,
      username: user?.user_metadata?.username || 'You',
      eventId: event.id,
      parkingArea: parkingNote,
    });
    await SecurityService.safeOpenURL(buildSafetyShareUrl('walk', {
      eventTitle: event?.title, parkingArea: parkingNote,
    }));
    toast?.('Pick someone in WhatsApp to walk with you.', 'success');
  };

  const handlePostLostFound = async () => {
    if (!reportTitle.trim()) return;
    triggerGlitter('post_lf');
    await NightSafetyService.postLostOrFoundItem({
      eventId: event.id,
      userId: user?.id,
      type: reportType,
      itemTitle: reportTitle,
      description: reportDesc,
      contactHandle: `@${user?.user_metadata?.username || 'viber'}`,
    });
    setReportTitle('');
    setReportDesc('');
    loadData();
    toast?.(`Item posted to event ${reportType === 'lost' ? 'Lost' : 'Found'} bulletin!`, 'success');
  };

  const handleBookShuttle = (sht) => {
    triggerGlitter(`book_shuttle_${sht.id}`);
    toast?.(`Seat reserved on ${sht.route_name}! Driver contact: ${sht.driver_contact}`, 'success');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
        <View style={[styles.sheetContainer, { backgroundColor: bg, borderColor: `${primary}35` }]}>
          {/* Header */}
          <View style={[styles.headerRow, { borderBottomColor: `${primary}20` }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name="shield" size={18} color="#10b981" />
              <Text style={[styles.headerTitle, { color: textColor }]}>Nightlife Safety & Squad Care</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={muted} />
            </TouchableOpacity>
          </View>

          {/* Subheader */}
          <View style={styles.eventContextBar}>
            <Text style={[styles.eventContextTitle, { color: textColor }]} numberOfLines={1}>
              {event?.title || 'Event Logistics'}
            </Text>
            <Text style={[styles.eventContextSub, { color: '#10b981' }]}>Real-World Protection & Venue Navigation</Text>
          </View>

          {/* Tab Strip */}
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
                      backgroundColor: active ? '#10b98120' : 'rgba(255,255,255,0.04)',
                      borderColor: active ? '#10b981' : 'rgba(255,255,255,0.12)',
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <Feather name={tab.icon} size={13} color={active ? '#10b981' : muted} />
                  <Text style={[styles.tabLabel, { color: active ? '#10b981' : muted }]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Body Content */}
          <ScrollView contentContainerStyle={styles.bodyScroll} showsVerticalScrollIndicator={false}>
            {/* ── 1. SAFE RIDE HOME ── */}
            {activeTab === 'safe_home' && (
              <View style={styles.sectionWrap}>
                <View style={[styles.infoBanner, { borderColor: '#10b98140', backgroundColor: '#10b98112' }]}>
                  <Feather name="shield" size={18} color="#10b981" />
                  <Text style={[styles.infoBannerText, { color: textColor }]}>
                    Heading out? Start a Safe Ride timer and send your trip to someone you trust on WhatsApp. The timer runs on this phone only. The Gruvs does not alert anyone automatically, so make sure a friend knows where you're going.
                  </Text>
                </View>

                {activeTimer ? (
                  <View style={[styles.activeTimerCard, { borderColor: '#10b981', backgroundColor: surface }]}>
                    <Text style={[styles.timerTitle, { color: textColor }]}>Safe Ride Countdown Active</Text>
                    <Text style={[styles.timerSub, { color: muted }]}>Heading to: {activeTimer.destination}</Text>
                    <View style={styles.timerClockBox}>
                      <Feather name="clock" size={32} color="#10b981" />
                      <Text style={[styles.timerClockVal, { color: '#10b981' }]}>Timer Running</Text>
                    </View>
                    <TouchableOpacity
                      onPress={handleConfirmHomeSafe}
                      style={[styles.primaryActionBtn, { backgroundColor: '#10b981', position: 'relative' }]}
                      activeOpacity={0.85}
                    >
                      <Feather name="check-circle" size={16} color="#000" />
                      <Text style={styles.primaryActionBtnText}>I'm Home Safe & Sound</Text>
                      <ControlledGlitterBurst trigger={glitters.home_safe} count={14} radius={34} colors={['#10b981', '#fff', '#ffd700']} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={[styles.boxCard, { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: surface }]}>
                    <Text style={[styles.boxTitle, { color: textColor }]}>Start Departure Countdown</Text>
                    <TextInput
                      style={[styles.inputFull, { color: textColor, borderColor: 'rgba(255,255,255,0.2)' }]}
                      placeholder="Destination (e.g. Home, Fourways residence)"
                      placeholderTextColor={muted}
                      value={safeDest}
                      onChangeText={setSafeDest}
                    />
                    <TextInput
                      style={[styles.inputFull, { color: textColor, borderColor: 'rgba(255,255,255,0.2)', marginTop: 8 }]}
                      placeholder="Estimated Drive Minutes (e.g. 30)"
                      placeholderTextColor={muted}
                      keyboardType="numeric"
                      value={safeDuration}
                      onChangeText={setSafeDuration}
                    />
                    <TouchableOpacity
                      onPress={handleStartSafeTimer}
                      style={[styles.primaryActionBtn, { backgroundColor: '#10b981', marginTop: 12, position: 'relative' }]}
                      activeOpacity={0.85}
                    >
                      <Feather name="play" size={14} color="#000" />
                      <Text style={styles.primaryActionBtnText}>Start Timer & Share Trip</Text>
                      <ControlledGlitterBurst trigger={glitters.start_timer} count={10} radius={28} colors={['#10b981', '#fff']} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* ── 2. WALK TO CAR ── */}
            {activeTab === 'walk_car' && (
              <View style={styles.sectionWrap}>
                <View style={[styles.infoBanner, { borderColor: `${primary}35`, backgroundColor: `${primary}10` }]}>
                  <Feather name="users" size={18} color={primary} />
                  <Text style={[styles.infoBannerText, { color: textColor }]}>
                    Never walk alone to dark parking lots late at night. Ask a friend on WhatsApp to walk with you or stay on the phone. For an emergency, call 10111 (SAPS) or 112.
                  </Text>
                </View>

                <View style={[styles.boxCard, { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: surface }]}>
                  <Text style={[styles.boxTitle, { color: textColor }]}>Where is your car parked?</Text>
                  <TextInput
                    style={[styles.inputFull, { color: textColor, borderColor: `${primary}35` }]}
                    placeholder="Parking Area (e.g. Outside gate, sector 3)"
                    placeholderTextColor={muted}
                    value={parkingNote}
                    onChangeText={setParkingNote}
                  />
                  <TouchableOpacity
                    onPress={handleWalkToCar}
                    style={[styles.primaryActionBtn, { backgroundColor: primary, marginTop: 12, position: 'relative' }]}
                    activeOpacity={0.85}
                  >
                    <Feather name="radio" size={15} color="#000" />
                    <Text style={styles.primaryActionBtnText}>Ask a Friend on WhatsApp</Text>
                    <ControlledGlitterBurst trigger={glitters.walk_car} count={12} radius={32} colors={[primary, '#fff']} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── 3. LOST & FOUND ── */}
            {activeTab === 'lost_found' && (
              <View style={styles.sectionWrap}>
                {/* Post Item */}
                <View style={[styles.boxCard, { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: surface }]}>
                  <Text style={[styles.boxTitle, { color: textColor }]}>Report Lost or Found Item</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                    {['lost', 'found'].map(t => (
                      <TouchableOpacity
                        key={t}
                        onPress={() => setReportType(t)}
                        style={[
                          styles.tabPill,
                          {
                            flex: 1,
                            justifyContent: 'center',
                            backgroundColor: reportType === t ? (t === 'lost' ? '#ef444425' : '#10b98125') : 'transparent',
                            borderColor: reportType === t ? (t === 'lost' ? '#ef4444' : '#10b981') : 'rgba(255,255,255,0.15)',
                          },
                        ]}
                      >
                        <Text style={{ color: textColor, fontWeight: '800', fontSize: 11 }}>
                          {t === 'lost' ? 'I LOST SOMETHING' : 'I FOUND SOMETHING'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={[styles.inputFull, { color: textColor, borderColor: 'rgba(255,255,255,0.2)' }]}
                    placeholder="Item (e.g. BMW Car Key, Black Wallet)"
                    placeholderTextColor={muted}
                    value={reportTitle}
                    onChangeText={setReportTitle}
                  />
                  <TextInput
                    style={[styles.inputFull, { color: textColor, borderColor: 'rgba(255,255,255,0.2)', marginTop: 8 }]}
                    placeholder="Description & Where handed in / lost..."
                    placeholderTextColor={muted}
                    value={reportDesc}
                    onChangeText={setReportDesc}
                  />
                  <TouchableOpacity
                    onPress={handlePostLostFound}
                    style={[styles.primaryActionBtn, { backgroundColor: reportType === 'lost' ? '#ef4444' : '#10b981', marginTop: 12, position: 'relative' }]}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.primaryActionBtnText}>Post to Event Bulletin</Text>
                    <ControlledGlitterBurst trigger={glitters.post_lf} count={10} radius={28} colors={['#fff']} />
                  </TouchableOpacity>
                </View>

                {/* Bulletin list */}
                <Text style={[styles.sectionSubtitle, { color: textColor }]}>Recent Event Reports</Text>
                {lostFoundItems.map(item => (
                  <View key={item.id} style={[styles.lfCard, { borderColor: item.type === 'found' ? '#10b98140' : '#ef444440', backgroundColor: surface }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[styles.lfTitle, { color: textColor }]}>{item.title}</Text>
                      <View style={[styles.lfBadge, { backgroundColor: item.type === 'found' ? '#10b98120' : '#ef444420' }]}>
                        <Text style={{ color: item.type === 'found' ? '#10b981' : '#ef4444', fontSize: 9.5, fontWeight: '900' }}>
                          {item.type.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ color: muted, fontSize: 11.5, lineHeight: 16 }}>{item.description}</Text>
                    <Text style={{ color: primary, fontSize: 10.5, fontWeight: '700' }}>Contact: {item.contact_handle}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* ── 4. PARTY SHUTTLES ── */}
            {activeTab === 'shuttles' && (
              <View style={styles.sectionWrap}>
                <View style={[styles.infoBanner, { borderColor: `${primary}35`, backgroundColor: `${primary}10` }]}>
                  <Feather name="navigation" size={18} color={primary} />
                  <Text style={[styles.infoBannerText, { color: textColor }]}>
                    Verified festival party shuttles. Hop on with fellow attendees with direct pickup and return routes.
                  </Text>
                </View>

                {shuttles.map(sht => (
                  <View key={sht.id} style={[styles.shuttleCard, { borderColor: `${primary}35`, backgroundColor: surface }]}>
                    <Text style={[styles.shuttleTitle, { color: textColor }]}>{sht.route_name}</Text>
                    <Text style={{ color: primary, fontSize: 11, fontWeight: '800' }}>📍 Pickup: {sht.pickup_point}</Text>
                    <Text style={{ color: muted, fontSize: 11 }}>Departures: {sht.departure_times.join(', ')}</Text>
                    <Text style={{ color: '#10b981', fontSize: 10.5, fontWeight: '800' }}>Status: {sht.live_status}</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                      <Text style={{ color: textColor, fontWeight: '900', fontSize: 14 }}>R{sht.price_zar} / seat</Text>
                      <TouchableOpacity
                        onPress={() => handleBookShuttle(sht)}
                        style={[styles.smallBtn, { backgroundColor: primary, position: 'relative' }]}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.smallBtnText}>Reserve Shuttle Seat</Text>
                        <ControlledGlitterBurst trigger={glitters[`book_shuttle_${sht.id}`]} count={10} radius={26} colors={[primary, '#fff']} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ── 5. VENUE FLOORPLAN & SOUND ZONES ── */}
            {activeTab === 'floorplan' && (
              <View style={styles.sectionWrap}>
                <View style={[styles.infoBanner, { borderColor: '#f59e0b40', backgroundColor: '#f59e0b12' }]}>
                  <Feather name="activity" size={18} color="#f59e0b" />
                  <Text style={[styles.infoBannerText, { color: textColor }]}>
                    Decibel sound map. Know where to dance at peak intensity or find quiet corners to catch your breath.
                  </Text>
                </View>

                <Text style={[styles.sectionSubtitle, { color: textColor }]}>Sound Zones & Decibels</Text>
                {floorplan?.zones?.map(zone => (
                  <View key={zone.id} style={[styles.zoneCard, { borderColor: `${zone.color}45`, backgroundColor: surface }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[styles.zoneName, { color: textColor }]}>{zone.name}</Text>
                      <View style={[styles.dbBadge, { backgroundColor: `${zone.color}20`, borderColor: zone.color }]}>
                        <Text style={{ color: zone.color, fontWeight: '900', fontSize: 10 }}>~{zone.dbLevel} dB</Text>
                      </View>
                    </View>
                    <Text style={{ color: muted, fontSize: 11 }}>{zone.desc}</Text>
                  </View>
                ))}

                <Text style={[styles.sectionSubtitle, { color: textColor, marginTop: 10 }]}>Key Venue Facilities</Text>
                {floorplan?.facilities?.map(fac => (
                  <View key={fac.id} style={[styles.facRow, { borderColor: 'rgba(255,255,255,0.1)', backgroundColor: surface }]}>
                    <Feather name={fac.icon} size={15} color={primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: textColor, fontSize: 12.5, fontWeight: '800' }}>{fac.name}</Text>
                      <Text style={{ color: muted, fontSize: 10.5 }}>Location: {fac.location}</Text>
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
  boxCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  boxTitle: { fontSize: 13, fontWeight: '800' },
  inputFull: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 },
  primaryActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 14 },
  primaryActionBtnText: { color: '#000', fontWeight: '900', fontSize: 13 },
  activeTimerCard: { borderWidth: 1, borderRadius: 16, padding: 20, alignItems: 'center', gap: 12 },
  timerTitle: { fontSize: 16, fontWeight: '900' },
  timerSub: { fontSize: 12 },
  timerClockBox: { alignItems: 'center', gap: 6, paddingVertical: 10 },
  timerClockVal: { fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  sectionSubtitle: { fontSize: 12, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 6 },
  lfCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 6 },
  lfTitle: { fontSize: 13, fontWeight: '800' },
  lfBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  shuttleCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 6 },
  shuttleTitle: { fontSize: 14, fontWeight: '900' },
  smallBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  smallBtnText: { color: '#000', fontWeight: '900', fontSize: 11.5 },
  zoneCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 },
  zoneName: { fontSize: 13, fontWeight: '800' },
  dbBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  facRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
});
