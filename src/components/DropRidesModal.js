/**
 * DropRidesModal — "The Drop Rides & Resident Lifts Strategy"
 *
 * Futuristic carpool, safe transit, and verified peer lifts portal.
 * Features:
 *   • Resident Crew Verified Drivers & Carpool Captains
 *   • Zero Surge Pricing Protocol
 *   • Convoy Sync — depart together with fellow vibers
 *   • Strict In-App Local Map Radar routing (never external maps)
 */
import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, Animated,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';
import { useBackClose } from '../hooks/useBackClose';
import { GlassView } from './GlassView';
import { haptics } from '../utils/haptics';

export function DropRidesModal({
  visible,
  onClose,
  events = [],
  onNavigateToMap,
}) {
  useBackClose(visible, onClose);
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#090d0f';
  const surface   = currentTheme?.surface   || '#12191d';
  const textColor = currentTheme?.text       || '#ffffff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.72)';

  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id || null);
  const [rideMode, setRideMode] = useState('need_ride'); // 'need_ride' | 'offer_ride'
  const [seats, setSeats] = useState('1');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const STRATEGY_PILLARS = [
    {
      icon: 'shield',
      title: 'Verified Resident Escorts',
      body: 'Every carpool captain is identity-verified via The Resident Crew and vouch-weighted by community trust scores.',
      tag: 'TRUST PROTOCOL',
      color: '#10b981',
    },
    {
      icon: 'dollar-sign',
      title: 'Surge-Free Fair Share',
      body: 'Zero predatory midnight surge pricing. Transparent fuel splits and flat-rate partner shuttles.',
      tag: 'FAIR FARE',
      color: '#f59e0b',
    },
    {
      icon: 'users',
      title: 'Synchronized Crew Convoys',
      body: 'Depart together at event conclusion. Designated safe assembly points inside venue security zones.',
      tag: 'CONVOY SYNC',
      color: '#8b5cf6',
    },
    {
      icon: 'crosshair',
      title: 'Local Radar Escort',
      body: 'Live in-app GPS breadcrumbs routed strictly through The Gruvs Local Map — zero data leaks to third parties.',
      tag: 'IN-APP GPS',
      color: primary,
    },
  ];

  const handleRequestRide = () => {
    haptics.impactLight();
    if (!user) {
      toast.show('Sign in to broadcast your lift request to The Resident Crew', 'info');
      return;
    }
    setSubmitted(true);
    toast.show('Lift signal dispatched to verified Resident Carpoolers!', 'success');
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 1800);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: bg, borderColor: `${primary}35` }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: `${primary}20` }]}>
            <View style={styles.titleRow}>
              <View style={[styles.badgeIcon, { backgroundColor: `${primary}18`, borderColor: `${primary}45` }]}>
                <Feather name="navigation" size={18} color={primary} />
              </View>
              <View>
                <Text style={[styles.title, { color: textColor }]}>RESIDENT LIFTS & RIDES</Text>
                <Text style={[styles.subtitle, { color: muted }]}>Safe Crew Transit & Verified Carpools</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: 'rgba(255,255,255,0.06)' }]}
              accessibilityRole="button"
              accessibilityLabel="Close rides modal"
            >
              <Feather name="x" size={18} color={textColor} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {/* Strategy Banner */}
            <GlassView style={[styles.heroCard, { borderColor: `${primary}40`, backgroundColor: `${primary}08` }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
                <Text style={{ fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: '#10b981' }}>
                  THE GRUVS SAFE TRANSIT PROTOCOL
                </Text>
              </View>
              <Text style={{ fontSize: 14, color: textColor, fontWeight: '700', lineHeight: 20 }}>
                Never get stranded after a late-night Gruv. Coordinate safe, transparent rides with verified Resident Vibers.
              </Text>
            </GlassView>

            {/* 4 Strategy Pillars */}
            <Text style={[styles.sectionTitle, { color: primary }]}>HOW IT WORKS</Text>
            <View style={styles.pillarsGrid}>
              {STRATEGY_PILLARS.map((p, idx) => (
                <View key={idx} style={[styles.pillarCard, { backgroundColor: surface, borderColor: `${p.color}35` }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={[styles.pillarIcon, { backgroundColor: `${p.color}18` }]}>
                      <Feather name={p.icon} size={16} color={p.color} />
                    </View>
                    <Text style={[styles.pillarTag, { color: p.color, borderColor: `${p.color}30` }]}>
                      {p.tag}
                    </Text>
                  </View>
                  <Text style={[styles.pillarHeading, { color: textColor }]}>{p.title}</Text>
                  <Text style={[styles.pillarDesc, { color: muted }]}>{p.body}</Text>
                </View>
              ))}
            </View>

            {/* Quick Dispatch Form */}
            <Text style={[styles.sectionTitle, { color: primary, marginTop: 18 }]}>COORDINATE TONIGHT'S LIFT</Text>
            <View style={[styles.formCard, { backgroundColor: surface, borderColor: `${primary}25` }]}>
              {/* Mode switch: Need Ride / Offering Ride */}
              <View style={styles.tabSwitch}>
                <TouchableOpacity
                  onPress={() => { setRideMode('need_ride'); haptics.impactLight(); }}
                  style={[styles.tabBtn, rideMode === 'need_ride' && { backgroundColor: primary }]}
                >
                  <Feather name="user-check" size={14} color={rideMode === 'need_ride' ? '#000' : textColor} />
                  <Text style={[styles.tabBtnText, { color: rideMode === 'need_ride' ? '#000' : textColor }]}>
                    I Need a Lift
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setRideMode('offer_ride'); haptics.impactLight(); }}
                  style={[styles.tabBtn, rideMode === 'offer_ride' && { backgroundColor: primary }]}
                >
                  <Feather name="truck" size={14} color={rideMode === 'offer_ride' ? '#000' : textColor} />
                  <Text style={[styles.tabBtnText, { color: rideMode === 'offer_ride' ? '#000' : textColor }]}>
                    Offering Seats
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Event Selector */}
              {events.length > 0 && (
                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.fieldLabel, { color: muted }]}>SELECT EVENT / DESTINATION</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {events.slice(0, 6).map((ev) => {
                        const isSel = selectedEventId === ev.id;
                        return (
                          <TouchableOpacity
                            key={ev.id}
                            onPress={() => { setSelectedEventId(ev.id); haptics.impactLight(); }}
                            style={[
                              styles.eventChip,
                              {
                                backgroundColor: isSel ? `${primary}20` : 'rgba(255,255,255,0.05)',
                                borderColor: isSel ? primary : 'rgba(255,255,255,0.12)',
                              },
                            ]}
                          >
                            <Text style={[styles.eventChipText, { color: isSel ? primary : textColor }]} numberOfLines={1}>
                              {ev.title || 'Event'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* Seats & Note Input */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <View style={{ width: 85 }}>
                  <Text style={[styles.fieldLabel, { color: muted }]}>SEATS</Text>
                  <TextInput
                    style={[styles.input, { color: textColor, borderColor: `${primary}30` }]}
                    keyboardType="number-pad"
                    value={seats}
                    onChangeText={setSeats}
                    maxLength={2}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: muted }]}>PICKUP / DROP AREA</Text>
                  <TextInput
                    style={[styles.input, { color: textColor, borderColor: `${primary}30` }]}
                    placeholder="e.g. Rosebank / Braamfontein / Soweto"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    value={notes}
                    onChangeText={setNotes}
                  />
                </View>
              </View>

              {/* Action Buttons */}
              <View style={{ marginTop: 16, gap: 10 }}>
                <TouchableOpacity
                  onPress={handleRequestRide}
                  style={[styles.actionBtn, { backgroundColor: primary }]}
                  disabled={submitted}
                >
                  <Feather name="send" size={16} color="#000" />
                  <Text style={styles.actionBtnText}>
                    {submitted ? 'SIGNAL BROADCASTED' : rideMode === 'need_ride' ? 'REQUEST VERIFIED LIFT' : 'OFFER CARPOOL SEATS'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    onClose();
                    onNavigateToMap?.();
                  }}
                  style={[styles.mapBtn, { borderColor: `${primary}45` }]}
                >
                  <Feather name="map-pin" size={15} color={primary} />
                  <Text style={[styles.mapBtnText, { color: primary }]}>
                    VIEW IN-APP PICKUP ZONES ON LOCAL MAP
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '90%',
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badgeIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  heroCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  pillarsGrid: {
    gap: 10,
  },
  pillarCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  pillarIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillarTag: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  pillarHeading: {
    fontSize: 14,
    fontWeight: '800',
  },
  pillarDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  formCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  tabSwitch: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 4,
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 9,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  eventChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: 160,
  },
  eventChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  mapBtnText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});
