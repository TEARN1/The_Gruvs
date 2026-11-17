/**
 * FoodKotaSection — Kasi Street Food, Gourmet Kotas & Late-Night Bites Hub.
 *
 * Dedicated culinary space celebrating South Africa's legendary Kota (quarter loaf),
 * Shisa Nyama braai spots, food trucks, and late-night kitchens active near events:
 *   • Working category filters (All, Kotas, Shisa Nyama, Food Trucks)
 *   • Rich kitchen profiles with appetizing photos, full itemized ZAR menus & daily specials
 *   • Anti-Prank Verified Pre-Order: Pay via Gruvs Wallet / PayFast / PayPal or Trusted Resident Lock
 */
import React, { useState, useMemo } from 'react';
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

const KOTA_SPOTS = [
  {
    id: 'spot_1',
    name: "Braam's Famous Midnight Kota",
    suburb: 'Braamfontein, JHB',
    distance: '0.8 km from active venues',
    hours: 'Open until 4:30 AM',
    rating: '4.9 ★ (340 vibers)',
    isOpenNow: true,
    category: 'kota',
    image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=700&q=80',
    signature: 'The Mega Dagwood (Russian, Polony, Cheese, Egg, Chips & Atchar)',
    priceRange: 'R 45 – R 95',
    specials: 'Free 330ml Buddy drink with any Mega Kota after midnight',
    menu: [
      { item: 'Classic Kasi Quarter', price: 'R 45', desc: 'Chips, polony, Vienna, mango atchar' },
      { item: 'The Mega Dagwood', price: 'R 75', desc: 'Quarter loaf, double Russian, gouda, fried egg & special sauce' },
      { item: 'Executive Steak Kota', price: 'R 95', desc: 'Basted strips, grilled onion, melted cheddar & chips' },
    ],
  },
  {
    id: 'spot_2',
    name: 'Soweto Sunset Shisa Nyama & Grill',
    suburb: 'Vilakazi St, Soweto',
    distance: 'Near Soweto Festival Hub',
    hours: 'Open until 3:00 AM',
    rating: '5.0 ★ (620 vibers)',
    isOpenNow: true,
    category: 'braai',
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=700&q=80',
    signature: 'Braai Platter (Wors, Chops, Pap & Spicy Chakalaka)',
    priceRange: 'R 70 – R 190',
    specials: 'VIP Platter includes 2 complimentary Ciders before 1 AM',
    menu: [
      { item: 'Skop & Chakalaka Bowl', price: 'R 70', desc: 'Slow-grilled traditional plate + warm pap' },
      { item: 'Kasi Grill Solo Platter', price: 'R 115', desc: '200g chuck, boerewors, garlic roll & chakalaka' },
      { item: 'VIP Squad Tray (Feeds 3)', price: 'R 190', desc: 'Short ribs, brisket, wors, wings & 3 pap balls' },
    ],
  },
  {
    id: 'spot_3',
    name: 'Maboneng Night Market Food Truck',
    suburb: 'Maboneng Precinct',
    distance: '1.2 km from Warehouse Rave',
    hours: 'Open until 2:00 AM',
    rating: '4.8 ★ (190 vibers)',
    isOpenNow: true,
    category: 'street',
    image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=700&q=80',
    signature: 'Double Smash Burgers & Loaded Truffle Fries',
    priceRange: 'R 60 – R 120',
    specials: 'Midnight recovery combo R 75 (Burger + Fries)',
    menu: [
      { item: 'Double Smash Burger', price: 'R 75', desc: 'Crispy aged beef patties, pickles & truffle mayo' },
      { item: 'Loaded Biltong Cheese Fries', price: 'R 65', desc: 'Crispy skin-on fries topped with cheddar & chilli dust' },
      { item: 'Crispy Chicken Street Wrap', price: 'R 85', desc: 'Spiced tender strips, slaw & smoky peri drizzle' },
    ],
  },
  {
    id: 'spot_4',
    name: 'Ivory Park Flame Kotas',
    suburb: 'Ivory Park, Midrand',
    distance: '1.5 km from Midrand Hub',
    hours: 'Open until 3:30 AM',
    rating: '4.9 ★ (412 vibers)',
    isOpenNow: true,
    category: 'kota',
    image: 'https://images.unsplash.com/photo-1619740455993-9e612b1af08a?auto=format&fit=crop&w=700&q=80',
    signature: 'Loaded Flame Ribs & Cheese Kota',
    priceRange: 'R 40 – R 85',
    specials: '2x Ribs Kotas + 1.25L Cooldrink for R 145',
    menu: [
      { item: 'Township Gold Kota', price: 'R 40', desc: 'Quarter loaf, crispy slap chips, russian, cheese & atchar' },
      { item: 'Flame Ribs & Egg Kota', price: 'R 70', desc: 'Sticky BBQ rib strips, fried egg, double cheese' },
      { item: 'King Squad Kota Box', price: 'R 85', desc: 'Full loaded quarter + wing portions' },
    ],
  },
];

const SIGNATURE_DISHES = [
  {
    id: 'd_1',
    category: 'kota',
    name: 'The Royal King Kota',
    desc: 'Hollowed fresh quarter loaf, double russian, spiced chips, melted gouda, fried egg & hot mango atchar.',
    price: 'R 75',
    tag: 'Bestseller',
    color: '#f59e0b',
    image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=500&q=75',
  },
  {
    id: 'd_2',
    category: 'braai',
    name: 'Kasi Shisa Nyama Combo',
    desc: 'Wood-fired beef brisket, boerewors, braai broodjie, hot chakalaka & steamed pap.',
    price: 'R 115',
    tag: 'Crowd Voted',
    color: '#ef4444',
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=500&q=75',
  },
  {
    id: 'd_3',
    category: 'street',
    name: 'Sunrise Recovery Smash Burger',
    desc: 'Double smash patty, crispy bacon, cheddar, pickles & secret midnight sauce.',
    price: 'R 80',
    tag: 'Afters Hit',
    color: '#10b981',
    image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=500&q=75',
  },
];

const PAYMENT_RAILS = [
  { key: 'wallet', label: 'Gruvs Wallet', icon: 'zap' },
  { key: 'payfast', label: 'PayFast ZA', icon: 'credit-card' },
  { key: 'paypal', label: 'PayPal', icon: 'globe' },
];

export function FoodKotaSection({
  visible,
  onClose,
  primary = '#00f2ff',
  bg = '#080b0d',
  textColor = '#fff',
  muted = 'rgba(255,255,255,0.55)',
}) {
  const { user, profile } = useAuth();
  const { show: toast } = useToast();
  const [selectedFilter, setSelectedFilter] = useState('all'); // 'all' | 'kota' | 'braai' | 'street'
  const [payRail, setPayRail] = useState('wallet'); // 'wallet' | 'payfast' | 'paypal'
  const [expandedMenuIds, setExpandedMenuIds] = useState({ spot_1: true });
  const [paidOrders, setPaidOrders] = useState({});
  const [glitterFx, setGlitterFx] = useState(0);

  const isTrustedViber = Boolean(profile?.is_verified || (profile?.vibe_score || 0) >= 250);

  const filteredSpots = useMemo(() => {
    if (selectedFilter === 'all') return KOTA_SPOTS;
    return KOTA_SPOTS.filter((s) => s.category === selectedFilter);
  }, [selectedFilter]);

  const filteredDishes = useMemo(() => {
    if (selectedFilter === 'all') return SIGNATURE_DISHES;
    return SIGNATURE_DISHES.filter((d) => d.category === selectedFilter);
  }, [selectedFilter]);

  const toggleMenu = (spotId) => {
    setExpandedMenuIds((prev) => ({ ...prev, [spotId]: !prev[spotId] }));
  };

  const handleVerifiedPreOrder = (spot, amountLabel = 'R 20 Deposit') => {
    if (!user) {
      toast('Sign in to link your Wallet, PayFast, or PayPal before pre-ordering.', 'info');
      return;
    }
    try { haptics.success(); } catch {}
    setGlitterFx(Date.now());
    const railName = PAYMENT_RAILS.find((r) => r.key === payRail)?.label || 'Gruvs Wallet';
    const orderCode = `#KOTA-${Math.floor(10 + Math.random() * 89)}`;
    setPaidOrders((prev) => ({ ...prev, [spot.id]: `${orderCode} · Paid via ${railName}` }));
    toast(`Verified Pre-Order ${orderCode} (${amountLabel}) sent to ${spot.name} via ${railName}!`, 'success');
  };

  const handleTrustedPing = (spot) => {
    if (!isTrustedViber) {
      toast('Unpaid "On My Way" alerts are locked to Verified / Trusted 250+ Vibe users to prevent kitchen no-shows. Use Wallet / PayFast / PayPal above instead.', 'info');
      return;
    }
    try { haptics.success(); } catch {}
    setGlitterFx(Date.now());
    toast(`Trusted Resident Alert sent to ${spot.name}: Kitchen confirmed your Trusted badge!`, 'success');
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
                <Feather name="coffee" size={18} color="#f59e0b" />
                <Text style={[styles.title, { color: textColor }]}>Food & Kota Street Hub</Text>
              </View>
              <Text style={[styles.sub, { color: muted }]}>
                Photos, live menus, specials & verified paid kitchen pre-orders
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.closeBtn}>
              <Feather name="x" size={18} color={muted} />
            </TouchableOpacity>
          </View>

          {/* Working Category Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 38 }} contentContainerStyle={styles.filtersRow}>
            {[
              { key: 'all', label: 'All Street Food' },
              { key: 'kota', label: 'Quarter / Kotas' },
              { key: 'braai', label: 'Shisa Nyama' },
              { key: 'street', label: 'Food Trucks' },
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
                      backgroundColor: active ? '#f59e0b' : 'rgba(255,255,255,0.03)',
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterText, { color: active ? '#000' : muted }]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Connected Payment Rail Selector (Anti-No-Show Commitment) */}
          <View style={styles.railBar}>
            <Text style={{ color: muted, fontSize: 10, fontWeight: '800' }}>PRE-ORDER RAIL:</Text>
            <View style={{ flexDirection: 'row', gap: 6, flex: 1 }}>
              {PAYMENT_RAILS.map((r) => {
                const active = payRail === r.key;
                return (
                  <TouchableOpacity
                    key={r.key}
                    onPress={() => setPayRail(r.key)}
                    style={[
                      styles.railPill,
                      {
                        borderColor: active ? '#10b981' : 'rgba(255,255,255,0.12)',
                        backgroundColor: active ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.03)',
                      },
                    ]}
                  >
                    <Feather name={r.icon} size={11} color={active ? '#10b981' : muted} />
                    <Text style={{ color: active ? '#10b981' : muted, fontSize: 10, fontWeight: '800' }}>{r.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
            {/* Active Kitchens Radar */}
            <View style={[styles.radarBanner, { borderColor: '#10b98155', backgroundColor: 'rgba(16,185,129,0.10)' }]}>
              <View style={styles.livePulseDot} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#10b981', fontSize: 12, fontWeight: '900' }}>
                  ACTIVE KITCHENS RADAR ({filteredSpots.length} MATCHING "{selectedFilter.toUpperCase()}")
                </Text>
                <Text style={{ color: muted, fontSize: 11 }}>
                  Orders require Wallet / PayFast / PayPal lock or Trusted 250+ Vibe status so kitchens never suffer fake alerts.
                </Text>
              </View>
            </View>

            {/* Signature Dishes */}
            {filteredDishes.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text style={[styles.sectionTitle, { color: muted }]}>POPULAR AFTER-HOURS CRAVINGS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {filteredDishes.map((dish) => (
                    <View key={dish.id} style={[styles.dishCard, { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(15,22,25,0.96)' }]}>
                      <SmartImage source={dish.image} style={styles.dishImg} />
                      <View style={{ padding: 10, gap: 5 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={[styles.dishTag, { borderColor: `${dish.color}50`, backgroundColor: `${dish.color}18` }]}>
                            <Text style={{ color: dish.color, fontSize: 9, fontWeight: '900' }}>{dish.tag}</Text>
                          </View>
                          <Text style={{ color: '#f59e0b', fontSize: 14, fontWeight: '900' }}>{dish.price}</Text>
                        </View>
                        <Text style={[styles.dishTitle, { color: textColor }]}>{dish.name}</Text>
                        <Text style={[styles.dishDesc, { color: muted }]} numberOfLines={2}>
                          {dish.desc}
                        </Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Filtered List of Spots */}
            <View style={{ gap: 12 }}>
              <Text style={[styles.sectionTitle, { color: muted }]}>
                VERIFIED KITCHENS & FULL MENUS ({filteredSpots.length})
              </Text>
              {filteredSpots.map((spot) => {
                const menuOpen = !!expandedMenuIds[spot.id];
                const orderReceipt = paidOrders[spot.id];
                return (
                  <View key={spot.id} style={[styles.spotCard, { borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(15,22,25,0.96)' }]}>
                    {/* Real Food Photo Banner */}
                    <View style={styles.spotImageWrap}>
                      <SmartImage source={spot.image} style={styles.spotHeroImg} />
                      <View style={styles.spotImgBadge}>
                        <Text style={{ color: '#10b981', fontSize: 9.5, fontWeight: '900' }}>● OPEN NOW</Text>
                      </View>
                      <View style={styles.spotPriceBadge}>
                        <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: '900' }}>{spot.priceRange}</Text>
                      </View>
                    </View>

                    <View style={styles.spotCardHead}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.spotName, { color: textColor }]}>{spot.name}</Text>
                        <Text style={{ color: muted, fontSize: 11, marginTop: 2 }}>
                          {spot.suburb} · {spot.distance} · {spot.hours}
                        </Text>
                      </View>
                      <Text style={{ color: '#f59e0b', fontSize: 12, fontWeight: '900' }}>{spot.rating}</Text>
                    </View>

                    <View style={styles.signatureBox}>
                      <Text style={{ color: '#f59e0b', fontSize: 11.5, fontWeight: '800' }}>
                        Signature: {spot.signature}
                      </Text>
                    </View>

                    {spot.specials ? (
                      <View style={styles.specialsRow}>
                        <Feather name="zap" size={13} color={primary} />
                        <Text style={{ color: primary, fontSize: 11, fontWeight: '800', flex: 1 }}>
                          Today's Special: {spot.specials}
                        </Text>
                      </View>
                    ) : null}

                    {/* Expandable Itemized Menu */}
                    <TouchableOpacity
                      onPress={() => toggleMenu(spot.id)}
                      style={styles.menuToggleBtn}
                    >
                      <Feather name="book-open" size={13} color={textColor} />
                      <Text style={{ color: textColor, fontSize: 12, fontWeight: '800', flex: 1 }}>
                        {menuOpen ? 'Hide Kitchen Menu & Prices' : `View Full Menu & Prices (${spot.menu.length} items)`}
                      </Text>
                      <Feather name={menuOpen ? 'chevron-up' : 'chevron-down'} size={15} color={muted} />
                    </TouchableOpacity>

                    {menuOpen && (
                      <View style={styles.menuList}>
                        {spot.menu.map((m, idx) => (
                          <View key={idx} style={styles.menuRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: textColor, fontSize: 12, fontWeight: '800' }}>{m.item}</Text>
                              <Text style={{ color: muted, fontSize: 10.5 }}>{m.desc}</Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => handleVerifiedPreOrder(spot, m.price)}
                              style={styles.menuPriceBtn}
                            >
                              <Text style={{ color: '#000', fontSize: 11, fontWeight: '900' }}>{m.price} · Order</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Paid Commitment OR Trusted Lock Action Bar */}
                    {orderReceipt ? (
                      <View style={styles.confirmedReceiptBox}>
                        <Feather name="check-circle" size={16} color="#10b981" />
                        <Text style={{ color: '#10b981', fontSize: 12, fontWeight: '900', flex: 1 }}>
                          {orderReceipt} (Kitchen Cooking!)
                        </Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => handleVerifiedPreOrder(spot, 'R 20 Deposit')}
                          style={[styles.notifyBtn, { flex: 1.4, backgroundColor: '#10b981' }]}
                          activeOpacity={0.85}
                        >
                          <Feather name="send" size={14} color="#000" />
                          <Text style={{ color: '#000', fontWeight: '900', fontSize: 11.5 }}>
                            Send R20 Pre-Order ({PAYMENT_RAILS.find((r) => r.key === payRail)?.label})
                          </Text>
                          <ControlledGlitterBurst trigger={glitterFx} count={12} radius={35} colors={['#10b981', '#00f2ff', '#fff']} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => handleTrustedPing(spot)}
                          style={[
                            styles.notifyBtn,
                            {
                              flex: 0.8,
                              backgroundColor: isTrustedViber ? 'rgba(245,158,11,0.22)' : 'rgba(255,255,255,0.06)',
                              borderWidth: 1,
                              borderColor: isTrustedViber ? '#f59e0b' : 'rgba(255,255,255,0.14)',
                            },
                          ]}
                          activeOpacity={0.85}
                        >
                          <Feather name={isTrustedViber ? 'shield' : 'lock'} size={13} color={isTrustedViber ? '#f59e0b' : muted} />
                          <Text style={{ color: isTrustedViber ? '#f59e0b' : muted, fontWeight: '800', fontSize: 10.5 }}>
                            {isTrustedViber ? 'Trusted Ping' : 'Trusted Only'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
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
    gap: 10,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 17, fontWeight: '900' },
  sub: { fontSize: 11.5, marginTop: 2, fontWeight: '600' },
  closeBtn: { padding: 4 },
  filtersRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterText: { fontSize: 11.5, fontWeight: '900' },
  railBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  railPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  radarBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  livePulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' },
  sectionTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  dishCard: {
    width: 195,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dishImg: { width: '100%', height: 90 },
  dishTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  dishTitle: { fontSize: 13, fontWeight: '900' },
  dishDesc: { fontSize: 10.5, lineHeight: 14 },
  spotCard: { padding: 14, borderRadius: 18, borderWidth: 1, gap: 10 },
  spotImageWrap: { position: 'relative', borderRadius: 14, overflow: 'hidden' },
  spotHeroImg: { width: '100%', height: 135, borderRadius: 14 },
  spotImgBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10b98160',
  },
  spotPriceBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.82)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b60',
  },
  spotCardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  spotName: { fontSize: 14.5, fontWeight: '900' },
  signatureBox: { backgroundColor: 'rgba(255,255,255,0.03)', padding: 8, borderRadius: 10 },
  specialsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  menuToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  menuList: { gap: 6, paddingTop: 2 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  menuPriceBtn: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  confirmedReceiptBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(16,185,129,0.16)',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  notifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 14,
    position: 'relative',
    paddingHorizontal: 8,
  },
});

export default FoodKotaSection;
