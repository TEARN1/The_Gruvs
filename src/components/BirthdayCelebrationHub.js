/**
 * BirthdayCelebrationHub — Active Birthday Radar, Perks & Concierge.
 *
 * Keeps birthdays vibrant and active across the community:
 *   • "Whose Birthday Is It?" Radar — Today's & Upcoming birthdays in your crew & city
 *   • 1-Tap Birthday Wish with ControlledGlitterBurst & gifting drinks
 *   • "Where To Spend Your Birthday" Curated Venue Concierge
 *   • Free Entry & VIP Birthday Perks from local venues
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { ControlledGlitterBurst } from './ControlledGlitterBurst';
import { SmartImage } from './SmartImage';
import { haptics } from '../utils/haptics';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';

const TODAY_BIRTHDAYS = [
  {
    id: 'bday_1',
    name: 'Nandi Sithole',
    username: 'nandi_vibe',
    ageTurned: 24,
    circle: 'Mutual Crew',
    avatar: null,
    isToday: true,
    vibeScore: 640,
    plans: 'Heading to Rosebank Rooftop at 9 PM',
  },
  {
    id: 'bday_2',
    name: 'Sipho Zulu',
    username: 'siphoz_sa',
    ageTurned: 27,
    circle: 'Follows You',
    avatar: null,
    isToday: true,
    vibeScore: 890,
    plans: 'VIP Table at Zone 6 Soweto',
  },
];

const UPCOMING_BIRTHDAYS = [
  {
    id: 'bday_3',
    name: 'Keisha Adams',
    username: 'keisha_vibes',
    daysAway: 'Tomorrow',
    avatar: null,
    vibeScore: 420,
  },
  {
    id: 'bday_4',
    name: 'Thulani Khumalo',
    username: 'thulani_k',
    daysAway: 'In 3 days (Saturday)',
    avatar: null,
    vibeScore: 780,
  },
];

const BIRTHDAY_VENUE_SUGGESTIONS = [
  {
    id: 'pkg_1',
    title: 'VIP Bottle Service & Sparklers',
    venue: 'Sanctuary Lounge, Rosebank',
    vibe: 'High Energy · Sparkler Parade',
    perk: 'FREE bottle of sparkling wine for groups of 4+',
    icon: 'zap',
    color: '#00f2ff',
  },
  {
    id: 'pkg_2',
    title: 'Rooftop Sunset Dinner & Cocktails',
    venue: 'Elevate Rooftop, Maboneng',
    vibe: 'Sunset Views · Deep House Beats',
    perk: 'Free round of tequila shots + birthday dessert',
    icon: 'sunset',
    color: '#f59e0b',
  },
  {
    id: 'pkg_3',
    title: 'Exclusive Shisa Nyama VIP Booth',
    venue: 'Konka, Soweto',
    vibe: 'Live Amapiano DJs · Premium Grill',
    perk: 'Free entry for birthday host + 3 squad members',
    icon: 'radio',
    color: '#ec4899',
  },
];

export function BirthdayCelebrationHub({
  visible,
  onClose,
  onOpenGifting,
  primary = '#00f2ff',
  bg = '#080b0d',
  textColor = '#fff',
  muted = 'rgba(255,255,255,0.55)',
}) {
  const { user } = useAuth();
  const { show: toast } = useToast();
  const [wishedMap, setWishedMap] = useState({});
  const [glitterTrigger, setGlitterTrigger] = useState(0);

  const handleSendWish = (bdayId, name) => {
    try { haptics.success(); } catch {}
    setWishedMap((prev) => ({ ...prev, [bdayId]: true }));
    setGlitterTrigger(Date.now());
    toast(`Sent Birthday Vibe & Glitter to ${name}! 🎂✨`, 'success');
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <View style={[styles.sheet, { backgroundColor: 'rgba(10,14,16,0.98)', borderColor: '#ec489955' }]}>
          {/* Header */}
          <View style={styles.headRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Text style={{ fontSize: 18 }}>🎂</Text>
                <Text style={[styles.title, { color: textColor }]}>Birthday Celebration Radar</Text>
              </View>
              <Text style={[styles.sub, { color: muted }]}>
                See whose birthday it is, wish them vibes, and find celebration spots
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.closeBtn}>
              <Feather name="x" size={18} color={muted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
            {/* Today's Celebrants */}
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={styles.livePulse} />
                <Text style={[styles.sectionTitle, { color: '#ec4899' }]}>
                  CELEBRATING TODAY ({TODAY_BIRTHDAYS.length} VIBERS)
                </Text>
              </View>

              {TODAY_BIRTHDAYS.map((bday) => {
                const wished = wishedMap[bday.id];
                return (
                  <View key={bday.id} style={[styles.bdayCard, { borderColor: '#ec489945', backgroundColor: 'rgba(236,72,153,0.07)' }]}>
                    <View style={styles.bdayCardRow}>
                      <View style={[styles.avatarFallback, { backgroundColor: '#ec489925' }]}>
                        <Text style={{ color: '#ec4899', fontWeight: '900', fontSize: 16 }}>
                          {bday.name[0]}
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.bdayName, { color: textColor }]}>{bday.name}</Text>
                          <View style={styles.bdayBadge}>
                            <Text style={styles.bdayBadgeText}>TURNING {bday.ageTurned} 🎈</Text>
                          </View>
                        </View>
                        <Text style={{ color: muted, fontSize: 11, marginTop: 1 }}>
                          @{bday.username} · {bday.circle}
                        </Text>
                        {bday.plans ? (
                          <Text style={{ color: primary, fontSize: 11, fontWeight: '700', marginTop: 3 }}>
                            📍 {bday.plans}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    <View style={styles.bdayActionsRow}>
                      <TouchableOpacity
                        onPress={() => handleSendWish(bday.id, bday.name)}
                        disabled={wished}
                        style={[
                          styles.wishBtn,
                          {
                            backgroundColor: wished ? 'rgba(16,185,129,0.20)' : '#ec4899',
                            borderColor: wished ? '#10b981' : '#ec4899',
                          },
                        ]}
                        activeOpacity={0.8}
                      >
                        <Feather name={wished ? 'check' : 'heart'} size={13} color={wished ? '#10b981' : '#fff'} />
                        <Text numberOfLines={1} style={[styles.wishBtnText, { color: wished ? '#10b981' : '#fff' }]}>
                          {wished ? 'Vibe Sent ✨' : 'Send Birthday Vibe ✨'}
                        </Text>
                        <ControlledGlitterBurst trigger={glitterTrigger} count={12} radius={35} colors={['#ec4899', '#fde047', '#fff']} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => {
                          toast(`Opening gift drink card for ${bday.name}!`, 'info');
                          onOpenGifting?.();
                        }}
                        style={[styles.giftBtn, { borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.04)' }]}
                      >
                        <Feather name="gift" size={13} color="#f59e0b" />
                        <Text style={{ color: textColor, fontSize: 11, fontWeight: '800' }}>Gift a Drink</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Upcoming Birthdays */}
            <View style={{ gap: 8 }}>
              <Text style={[styles.sectionTitle, { color: muted }]}>UPCOMING BIRTHDAYS THIS WEEK</Text>
              <View style={[styles.upcomingContainer, { borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.03)' }]}>
                {UPCOMING_BIRTHDAYS.map((bday, i) => (
                  <View key={bday.id} style={[styles.upcomingRow, i > 0 && { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: textColor, fontSize: 13, fontWeight: '800' }}>{bday.name}</Text>
                      <Text style={{ color: muted, fontSize: 11 }}>@{bday.username}</Text>
                    </View>
                    <View style={styles.daysAwayPill}>
                      <Text style={{ color: primary, fontSize: 11, fontWeight: '800' }}>{bday.daysAway}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Where to spend your birthday concierge */}
            <View style={{ gap: 10 }}>
              <Text style={[styles.sectionTitle, { color: muted }]}>
                WHERE TO SPEND YOUR BIRTHDAY (CURATED PERKS)
              </Text>
              {BIRTHDAY_VENUE_SUGGESTIONS.map((sug) => (
                <View key={sug.id} style={[styles.sugCard, { borderColor: `${sug.color}45`, backgroundColor: 'rgba(15,22,25,0.96)' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.sugIconWrap, { borderColor: `${sug.color}50`, backgroundColor: `${sug.color}20` }]}>
                      <Feather name={sug.icon} size={16} color={sug.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sugTitle, { color: textColor }]}>{sug.title}</Text>
                      <Text style={{ color: muted, fontSize: 11 }}>{sug.venue} · {sug.vibe}</Text>
                    </View>
                  </View>

                  <View style={[styles.perkBox, { borderColor: `${sug.color}35`, backgroundColor: `${sug.color}10` }]}>
                    <Text style={{ color: sug.color, fontSize: 11, fontWeight: '800' }}>
                      🎁 Special Birthday Offer: {sug.perk}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => toast(`Inquired about birthday package at ${sug.venue}!`, 'success')}
                    style={[styles.inquireBtn, { borderColor: `${sug.color}55`, backgroundColor: 'rgba(255,255,255,0.04)' }]}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: sug.color, fontWeight: '800', fontSize: 12 }}>
                      Inquire & Reserve Birthday Table
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
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
    backgroundColor: 'rgba(0,0,0,0.80)',
    justifyContent: 'flex-end',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } : {}),
  },
  sheet: {
    // Bottom sheet on phones; on tablets/desktop it stayed full-window wide,
    // stretching every button into a 1,200 px bar. Cap and centre it.
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '92%',
    padding: 18,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    gap: 12,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
  },
  sub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 4,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  livePulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ec4899',
  },
  bdayCard: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  bdayCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bdayName: {
    fontSize: 14,
    fontWeight: '900',
  },
  bdayBadge: {
    backgroundColor: 'rgba(236,72,153,0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bdayBadgeText: {
    color: '#ec4899',
    fontSize: 9,
    fontWeight: '900',
  },
  bdayActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',   // small phones: Gift drops under Wish instead of squeezing it
    gap: 8,
  },
  wishBtn: {
    flexGrow: 1.3,
    flexBasis: 170,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    position: 'relative',
  },
  wishBtnText: {
    fontWeight: '900',
    fontSize: 12,
  },
  giftBtn: {
    flexGrow: 1,
    flexBasis: 110,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
  },
  upcomingContainer: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  daysAwayPill: {
    backgroundColor: 'rgba(0,242,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sugCard: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  sugIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sugTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  perkBox: {
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  inquireBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
  },
});

export default BirthdayCelebrationHub;
