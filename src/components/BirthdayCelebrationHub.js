/**
 * BirthdayCelebrationHub — Active Birthday Radar, Clickable Celebrant Profiles & Paid Gift Drops.
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
    location: 'Rosebank Sanctuary Rooftop · Tonight 9 PM',
    avatar: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=400&q=80',
    photos: [
      'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=400&q=80',
    ],
    isToday: true,
    vibeScore: 640,
    plans: 'Heading to Sanctuary Rooftop at 9 PM (VIP Booth #4)',
    sharingWithGuests: 'First 15 guests on my list get free welcome champagne flutes & sparklers!',
    wishlist: [
      { id: 'w1', title: 'Round of Tequila Shots', price: 'R 120', icon: 'coffee' },
      { id: 'w2', title: 'Custom Birthday Cake Fund', price: 'R 80', icon: 'gift' },
      { id: 'w3', title: 'VIP Bottle Service Share', price: 'R 350', icon: 'zap' },
    ],
  },
  {
    id: 'bday_2',
    name: 'Sipho Zulu',
    username: 'siphoz_sa',
    ageTurned: 27,
    circle: 'Follows You',
    location: 'Zone 6 Soweto · Tonight 10 PM',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    photos: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=400&q=80',
    ],
    isToday: true,
    vibeScore: 890,
    plans: 'VIP Table at Zone 6 Soweto — All black attire',
    sharingWithGuests: 'Live DJ birthday set + 10 free Shisa Nyama VIP passes for my day-ones!',
    wishlist: [
      { id: 'w4', title: 'Hennessy Glass Drop', price: 'R 150', icon: 'award' },
      { id: 'w5', title: 'Birthday Sparkler Parade Bottle', price: 'R 500', icon: 'sun' },
      { id: 'w6', title: 'Direct Cash Birthday Gift', price: 'R 100', icon: 'credit-card' },
    ],
  },
];

const UPCOMING_BIRTHDAYS = [
  {
    id: 'bday_3',
    name: 'Keisha Adams',
    username: 'keisha_vibes',
    ageTurned: 23,
    location: 'Maboneng Precinct · Tomorrow 8 PM',
    daysAway: 'Tomorrow',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80',
    photos: ['https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80'],
    vibeScore: 420,
    plans: 'Sunset rooftop mixer in Maboneng',
    sharingWithGuests: 'Hosting open paint & sip warm-up for early arrivals!',
    wishlist: [
      { id: 'w7', title: 'Pink Gin Cocktail Token', price: 'R 95', icon: 'coffee' },
      { id: 'w8', title: 'Sparkler & Polaroid Frame', price: 'R 140', icon: 'camera' },
    ],
  },
  {
    id: 'bday_4',
    name: 'Thulani Khumalo',
    username: 'thulani_k',
    ageTurned: 29,
    location: 'Ivory Park / Midrand · Saturday 6 PM',
    daysAway: 'In 3 days (Saturday)',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    photos: ['https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80'],
    vibeScore: 780,
    plans: 'Midrand Grill & Amapiano Saturday',
    sharingWithGuests: 'Sharing free Kota & grill platters with the squad from 6–8 PM!',
    wishlist: [
      { id: 'w9', title: 'Bucket of Ciders for the Table', price: 'R 220', icon: 'gift' },
      { id: 'w10', title: 'DJ Shoutout + Birthday Cash Drop', price: 'R 150', icon: 'radio' },
    ],
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
  const { show: toast } = useToast();
  const [wishedMap, setWishedMap] = useState({});
  const [giftedItems, setGiftedItems] = useState({});
  const [selectedCelebrant, setSelectedCelebrant] = useState(null);
  const [glitterTrigger, setGlitterTrigger] = useState(0);

  const handleSendWish = (bdayId, name) => {
    try { haptics.success(); } catch {}
    setWishedMap((prev) => ({ ...prev, [bdayId]: true }));
    setGlitterTrigger(Date.now());
    toast(`Sent Birthday Vibe & Glitter to ${name}!`, 'success');
  };

  const handleSendGift = (celebrant, wishItem) => {
    try { haptics.success(); } catch {}
    setGlitterTrigger(Date.now());
    setGiftedItems((prev) => ({ ...prev, [`${celebrant.id}_${wishItem.id}`]: true }));
    toast(`Gifted "${wishItem.title}" (${wishItem.price}) to @${celebrant.username} via Gruvs Gift Drop! Drink Token delivered.`, 'success');
    onOpenGifting?.();
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
                <Feather name="gift" size={18} color="#ec4899" />
                <Text style={[styles.title, { color: textColor }]}>
                  {selectedCelebrant ? `${selectedCelebrant.name}'s Birthday Profile` : 'Birthday Celebration Radar'}
                </Text>
              </View>
              <Text style={[styles.sub, { color: muted }]}>
                {selectedCelebrant
                  ? `Turning ${selectedCelebrant.ageTurned} · ${selectedCelebrant.location}`
                  : 'Tap anyone to inspect their age, venue, photos, perks & gift wishlist'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => (selectedCelebrant ? setSelectedCelebrant(null) : onClose())}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.closeBtn}
            >
              <Feather name={selectedCelebrant ? 'arrow-left' : 'x'} size={18} color={muted} />
            </TouchableOpacity>
          </View>

          {selectedCelebrant ? (
            /* ── CLICKED CELEBRANT FULL BIRTHDAY PROFILE VIEW ── */
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
              <View style={[styles.profileHero, { borderColor: '#ec489955', backgroundColor: 'rgba(236,72,153,0.09)' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <SmartImage source={selectedCelebrant.avatar} style={styles.profileAvatarLg} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={{ color: textColor, fontSize: 17, fontWeight: '900' }}>{selectedCelebrant.name}</Text>
                      <View style={styles.bdayBadge}>
                        <Text style={styles.bdayBadgeText}>TURNING {selectedCelebrant.ageTurned}</Text>
                      </View>
                    </View>
                    <Text style={{ color: muted, fontSize: 12, marginTop: 2 }}>@{selectedCelebrant.username} · {selectedCelebrant.vibeScore} Vibe XP</Text>
                    <Text style={{ color: primary, fontSize: 11.5, fontWeight: '700', marginTop: 4 }}>📍 {selectedCelebrant.location}</Text>
                  </View>
                </View>

                <Text style={{ color: textColor, fontSize: 12.5, lineHeight: 18 }}>
                  {selectedCelebrant.plans}
                </Text>

                {/* Photo Strip */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {(selectedCelebrant.photos || [selectedCelebrant.avatar]).map((uri, i) => (
                    <SmartImage key={i} source={uri} style={styles.galleryThumb} />
                  ))}
                </ScrollView>
              </View>

              {/* What They Are Giving Guests */}
              <View style={[styles.perkBox, { borderColor: '#10b98150', backgroundColor: 'rgba(16,185,129,0.10)' }]}>
                <Text style={{ color: '#10b981', fontSize: 10.5, fontWeight: '900', letterSpacing: 0.6 }}>
                  🎁 HOST GIFT TO GUESTS / ATTENDEES
                </Text>
                <Text style={{ color: textColor, fontSize: 12.5, fontWeight: '700', marginTop: 3 }}>
                  {selectedCelebrant.sharingWithGuests}
                </Text>
              </View>

              {/* Birthday Gift Registry & Paid Drops */}
              <Text style={[styles.sectionTitle, { color: '#ec4899' }]}>
                SEND A PRESENT (INSTANT DRINK TOKEN / GIFT DROP)
              </Text>
              {(selectedCelebrant.wishlist || []).map((w) => {
                const sent = giftedItems[`${selectedCelebrant.id}_${w.id}`];
                return (
                  <View key={w.id} style={[styles.wishRowCard, { borderColor: sent ? '#10b981' : 'rgba(255,255,255,0.12)' }]}>
                    <View style={[styles.sugIconWrap, { borderColor: '#ec489960', backgroundColor: 'rgba(236,72,153,0.16)' }]}>
                      <Feather name={w.icon} size={15} color="#ec4899" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: textColor, fontSize: 13.5, fontWeight: '900' }}>{w.title}</Text>
                      <Text style={{ color: '#f59e0b', fontSize: 11.5, fontWeight: '800' }}>{w.price} · Instant QR Drink / Gift Token</Text>
                    </View>
                    <TouchableOpacity
                      disabled={sent}
                      onPress={() => handleSendGift(selectedCelebrant, w)}
                      style={[
                        styles.giftPayBtn,
                        { backgroundColor: sent ? 'rgba(16,185,129,0.22)' : '#ec4899' },
                      ]}
                    >
                      <Text style={{ color: sent ? '#10b981' : '#fff', fontWeight: '900', fontSize: 11.5 }}>
                        {sent ? 'Gifted ✓' : 'Send Gift'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}

              <ControlledGlitterBurst trigger={glitterTrigger} count={18} radius={50} colors={['#ec4899', '#fde047', '#00f2ff']} />
            </ScrollView>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
              {/* Today's Celebrants */}
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={styles.livePulse} />
                  <Text style={[styles.sectionTitle, { color: '#ec4899' }]}>
                    CELEBRATING TODAY ({TODAY_BIRTHDAYS.length} VIBERS · TAP PROFILE TO GIFT)
                  </Text>
                </View>

                {TODAY_BIRTHDAYS.map((bday) => {
                  const wished = wishedMap[bday.id];
                  return (
                    <TouchableOpacity
                      key={bday.id}
                      onPress={() => setSelectedCelebrant(bday)}
                      activeOpacity={0.88}
                      style={[styles.bdayCard, { borderColor: '#ec489945', backgroundColor: 'rgba(236,72,153,0.07)' }]}
                    >
                      <View style={styles.bdayCardRow}>
                        <SmartImage source={bday.avatar} style={styles.avatarPhoto} />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Text style={[styles.bdayName, { color: textColor }]}>{bday.name}</Text>
                            <View style={styles.bdayBadge}>
                              <Text style={styles.bdayBadgeText}>TURNING {bday.ageTurned}</Text>
                            </View>
                          </View>
                          <Text style={{ color: muted, fontSize: 11, marginTop: 1 }}>
                            @{bday.username} · {bday.location}
                          </Text>
                          <Text style={{ color: '#10b981', fontSize: 10.5, fontWeight: '700', marginTop: 3 }} numberOfLines={1}>
                            🎁 {bday.sharingWithGuests}
                          </Text>
                        </View>
                        <Feather name="chevron-right" size={17} color="#ec4899" />
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
                            {wished ? 'Vibe Sent' : 'Send Birthday Vibe'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => setSelectedCelebrant(bday)}
                          style={[styles.giftBtn, { borderColor: '#f59e0b60', backgroundColor: 'rgba(245,158,11,0.12)' }]}
                        >
                          <Feather name="gift" size={13} color="#f59e0b" />
                          <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: '900' }}>Wishlist & Gift</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Upcoming Birthdays */}
              <View style={{ gap: 8 }}>
                <Text style={[styles.sectionTitle, { color: muted }]}>UPCOMING BIRTHDAYS THIS WEEK (TAP TO VIEW PROFILE)</Text>
                <View style={[styles.upcomingContainer, { borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.03)' }]}>
                  {UPCOMING_BIRTHDAYS.map((bday, i) => (
                    <TouchableOpacity
                      key={bday.id}
                      onPress={() => setSelectedCelebrant(bday)}
                      style={[styles.upcomingRow, i > 0 && { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }]}
                    >
                      <SmartImage source={bday.avatar} style={{ width: 34, height: 34, borderRadius: 17, marginRight: 10 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: textColor, fontSize: 13, fontWeight: '800' }}>{bday.name} (Turning {bday.ageTurned})</Text>
                        <Text style={{ color: muted, fontSize: 11 }}>@{bday.username} · {bday.location}</Text>
                      </View>
                      <View style={styles.daysAwayPill}>
                        <Text style={{ color: primary, fontSize: 10.5, fontWeight: '800' }}>{bday.daysAway}</Text>
                      </View>
                    </TouchableOpacity>
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
                        Special Birthday Offer: {sug.perk}
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
          )}
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
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '92%',
    padding: 18,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    gap: 12,
    overflow: 'hidden',
  },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 17, fontWeight: '900' },
  sub: { fontSize: 11.5, marginTop: 2, fontWeight: '600' },
  closeBtn: { padding: 4 },
  sectionTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  livePulse: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ec4899' },
  bdayCard: { padding: 12, borderRadius: 16, borderWidth: 1, gap: 10 },
  bdayCardRow: { flexDirection: 'row', alignItems: 'center' },
  avatarPhoto: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: '#ec4899' },
  profileHero: { padding: 14, borderRadius: 18, borderWidth: 1, gap: 12 },
  profileAvatarLg: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#ec4899' },
  galleryThumb: { width: 110, height: 110, borderRadius: 12 },
  bdayName: { fontSize: 14, fontWeight: '900' },
  bdayBadge: { backgroundColor: 'rgba(236,72,153,0.25)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  bdayBadgeText: { color: '#ec4899', fontSize: 9, fontWeight: '900' },
  bdayActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  wishBtn: { flexGrow: 1.3, flexBasis: 160, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 38, borderRadius: 19, borderWidth: 1 },
  wishBtnText: { fontWeight: '900', fontSize: 12 },
  giftBtn: { flexGrow: 1, flexBasis: 120, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 38, borderRadius: 19, borderWidth: 1 },
  wishRowCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.03)' },
  giftPayBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  upcomingContainer: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 12 },
  upcomingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  daysAwayPill: { backgroundColor: 'rgba(0,242,255,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  sugCard: { padding: 12, borderRadius: 16, borderWidth: 1, gap: 8 },
  sugIconWrap: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sugTitle: { fontSize: 13, fontWeight: '900' },
  perkBox: { padding: 10, borderRadius: 12, borderWidth: 1 },
  inquireBtn: { alignItems: 'center', justifyContent: 'center', height: 36, borderRadius: 18, borderWidth: 1 },
});

export default BirthdayCelebrationHub;
