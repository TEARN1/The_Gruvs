/**
 * FoodKotaSection — Kasi Street Food, Gourmet Kotas & Late-Night Bites Hub.
 *
 * Dedicated culinary space celebrating South Africa's legendary Kota (quarter loaf),
 * Shisa Nyama braai spots, food trucks, and late-night kitchens active near events:
 *   • Active Kitchen Radar ("Open Now Near Tonight's Events")
 *   • Signature Kotas & Street Menus with ZAR pricing
 *   • "I'm Coming Over" Pre-Order Pickup Alert
 *   • Local food ratings & community reviews
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
import { haptics } from '../utils/haptics';
import { useToast } from './ToastNotification';

const KOTA_SPOTS = [
  {
    id: 'spot_1',
    name: "Braam's Famous Midnight Kota",
    suburb: 'Braamfontein, JHB',
    distance: '0.8 km from active venues',
    hours: 'Open until 4:30 AM 🌙',
    rating: '4.9 ★ (340 vibers)',
    isOpenNow: true,
    signature: 'The Mega Dagwood (Russian, Polony, Cheese, Egg, Chips & Atchar)',
    priceRange: 'R 45 – R 85',
    category: 'kota',
    specials: 'Free drink with any Mega Kota tonight',
  },
  {
    id: 'spot_2',
    name: 'Soweto Sunset Shisa Nyama & Grill',
    suburb: 'Vilakazi St, Soweto',
    distance: 'Near Soweto Festival Hub',
    hours: 'Open until 3:00 AM 🔥',
    rating: '5.0 ★ (620 vibers)',
    isOpenNow: true,
    signature: 'Braai Platter (Wors, Chops, Pap & Spicy Chakalaka)',
    priceRange: 'R 70 – R 160',
    category: 'braai',
    specials: 'VIP Platter comes with 2 Ciders',
  },
  {
    id: 'spot_3',
    name: 'Maboneng Night Market Food Truck',
    suburb: 'Maboneng Precinct',
    distance: '1.2 km from Warehouse Rave',
    hours: 'Open until 2:00 AM 🌮',
    rating: '4.8 ★ (190 vibers)',
    isOpenNow: true,
    signature: 'Smash Burgers & Loaded Truffle Fries',
    priceRange: 'R 60 – R 110',
    category: 'street',
    specials: 'Midnight recovery combo R75',
  },
];

const SIGNATURE_DISHES = [
  {
    id: 'd_1',
    name: 'The Royal King Kota',
    desc: 'Hollowed fresh quarter loaf, double russian, spiced chips, melted gouda, fried egg, beef patty & hot mango atchar.',
    price: 'R 75',
    tag: 'Bestseller 🔥',
    color: '#f59e0b',
  },
  {
    id: 'd_2',
    name: 'Kasi Shisa Nyama Combo',
    desc: 'Wood-fired beef brisket, boerewors, braai broodjie, hot chakalaka & steamed pap.',
    price: 'R 95',
    tag: 'Crowd Voted 🥩',
    color: '#ef4444',
  },
  {
    id: 'd_3',
    name: 'Sunrise Recovery Smash Burger',
    desc: 'Double smash patty, crispy bacon, cheddar, pickles & secret midnight sauce.',
    price: 'R 80',
    tag: 'Afters Hit 🌅',
    color: '#10b981',
  },
];

export function FoodKotaSection({
  visible,
  onClose,
  primary = '#00f2ff',
  bg = '#080b0d',
  textColor = '#fff',
  muted = 'rgba(255,255,255,0.55)',
}) {
  const { show: toast } = useToast();
  const [selectedFilter, setSelectedFilter] = useState('all'); // 'all' | 'kota' | 'braai' | 'street'
  const [glitterFx, setGlitterFx] = useState(0);

  const handleNotifyKitchen = (spotName) => {
    try { haptics.success(); } catch {}
    setGlitterFx(Date.now());
    toast(`Alerted ${spotName}: "Viber en route for pickup!"`, 'success');
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <View style={[styles.sheet, { backgroundColor: 'rgba(10,14,16,0.98)', borderColor: '#f59e0b55' }]}>
          {/* Header */}
          <View style={styles.headRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Text style={{ fontSize: 18 }}>🍔</Text>
                <Text style={[styles.title, { color: textColor }]}>Food & Kota Street Hub</Text>
              </View>
              <Text style={[styles.sub, { color: muted }]}>
                Kasi Kotas, Shisa Nyama & Late-Night Bites near active events
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.closeBtn}>
              <Feather name="x" size={18} color={muted} />
            </TouchableOpacity>
          </View>

          {/* Quick Filters */}
          <View style={styles.filtersRow}>
            {[
              { key: 'all', label: 'All Street Food' },
              { key: 'kota', label: 'Quarter / Kotas 🥪' },
              { key: 'braai', label: 'Shisa Nyama 🔥' },
              { key: 'street', label: 'Food Trucks 🚚' },
            ].map((f) => {
              const active = selectedFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setSelectedFilter(f.key)}
                  style={[
                    styles.filterChip,
                    {
                      borderColor: active ? '#f59e0b' : 'rgba(255,255,255,0.12)',
                      backgroundColor: active ? 'rgba(245,158,11,0.20)' : 'rgba(255,255,255,0.03)',
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterText, { color: active ? '#f59e0b' : muted }]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
            {/* Active Kitchens Radar */}
            <View style={[styles.radarBanner, { borderColor: '#10b98155', backgroundColor: 'rgba(16,185,129,0.10)' }]}>
              <View style={styles.livePulseDot} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#10b981', fontSize: 12, fontWeight: '900' }}>
                  ACTIVE LATE-NIGHT KITCHENS RADAR
                </Text>
                <Text style={{ color: muted, fontSize: 11 }}>
                  3 verified kitchens cooking fresh right now within 2km of tonight’s events.
                </Text>
              </View>
            </View>

            {/* Signature Dishes */}
            <View style={{ gap: 8 }}>
              <Text style={[styles.sectionTitle, { color: muted }]}>POPULAR AFTER-HOURS CRAVINGS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {SIGNATURE_DISHES.map((dish) => (
                  <View key={dish.id} style={[styles.dishCard, { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(15,22,25,0.96)' }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={[styles.dishTag, { borderColor: `${dish.color}50`, backgroundColor: `${dish.color}18` }]}>
                        <Text style={{ color: dish.color, fontSize: 9, fontWeight: '900' }}>{dish.tag}</Text>
                      </View>
                      <Text style={{ color: '#f59e0b', fontSize: 14, fontWeight: '900' }}>{dish.price}</Text>
                    </View>
                    <Text style={[styles.dishTitle, { color: textColor }]}>{dish.name}</Text>
                    <Text style={[styles.dishDesc, { color: muted }]} numberOfLines={3}>
                      {dish.desc}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            {/* List of Kota Spots */}
            <View style={{ gap: 10 }}>
              <Text style={[styles.sectionTitle, { color: muted }]}>VERIFIED SPOTS NEARBY</Text>
              {KOTA_SPOTS.map((spot) => (
                <View key={spot.id} style={[styles.spotCard, { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(15,22,25,0.96)' }]}>
                  <View style={styles.spotCardHead}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.spotName, { color: textColor }]}>{spot.name}</Text>
                        <View style={styles.openNowBadge}>
                          <Text style={styles.openNowText}>OPEN NOW</Text>
                        </View>
                      </View>
                      <Text style={{ color: muted, fontSize: 11, marginTop: 2 }}>
                        {spot.suburb} · {spot.distance}
                      </Text>
                    </View>
                    <Text style={{ color: '#f59e0b', fontSize: 12, fontWeight: '900' }}>{spot.rating}</Text>
                  </View>

                  <View style={styles.signatureBox}>
                    <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: '800' }}>
                      🌟 {spot.signature}
                    </Text>
                    <Text style={{ color: muted, fontSize: 10, marginTop: 2 }}>
                      {spot.hours} · Prices: {spot.priceRange}
                    </Text>
                  </View>

                  {spot.specials ? (
                    <View style={styles.specialsRow}>
                      <Feather name="gift" size={12} color={primary} />
                      <Text style={{ color: primary, fontSize: 11, fontWeight: '700' }}>
                        Tonight's Perk: {spot.specials}
                      </Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    onPress={() => handleNotifyKitchen(spot.name)}
                    style={[styles.notifyBtn, { backgroundColor: '#f59e0b' }]}
                    activeOpacity={0.8}
                  >
                    <Feather name="bell" size={14} color="#000" />
                    <Text style={{ color: '#000', fontWeight: '900', fontSize: 12 }}>
                      Notify Kitchen I'm Coming (Pre-Order Alert)
                    </Text>
                    <ControlledGlitterBurst trigger={glitterFx} count={12} radius={35} colors={['#f59e0b', '#00f2ff', '#fff']} />
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
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 11,
    fontWeight: '800',
  },
  radarBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  dishCard: {
    width: 200,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  dishTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  dishTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  dishDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  spotCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  spotCardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  spotName: {
    fontSize: 14,
    fontWeight: '900',
  },
  openNowBadge: {
    backgroundColor: 'rgba(16,185,129,0.20)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  openNowText: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: '900',
  },
  signatureBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 8,
    borderRadius: 10,
  },
  specialsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 20,
    position: 'relative',
  },
});

export default FoodKotaSection;
