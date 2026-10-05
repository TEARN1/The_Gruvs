/**
 * BusinessActivationPortal — Guided Business & Creator Activation Studio.
 *
 * Answers the essential creator/business questions:
 *   • WHERE your product works (party type, venue category)
 *   • HOW it works (in-room digital flyers, vendor pop-ups, map sponsorship)
 *   • WHEN it works (nightlife time phases: warmup, peak, afters)
 *   • What your business BENEFITS (projected foot traffic, conversion, revenue)
 */
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { ControlledGlitterBurst } from './ControlledGlitterBurst';
import { haptics } from '../utils/haptics';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';

// ── PRODUCT CATEGORIES ────────────────────────────────────────────────────────
const PRODUCT_CATEGORIES = [
  { key: 'beverage', label: 'Beverages & Drinks', icon: 'coffee', bestVibe: 'club', color: '#00f2ff' },
  { key: 'food', label: 'Food & Gourmet Kotas', icon: 'pie-chart', bestVibe: 'market', color: '#f59e0b' },
  { key: 'fashion', label: 'Streetwear & Merch', icon: 'tag', bestVibe: 'festival', color: '#ec4899' },
  { key: 'sound', label: 'DJ / Audio & Lighting', icon: 'music', bestVibe: 'rave', color: '#8b5cf6' },
  { key: 'media', label: 'Photo & Video Production', icon: 'camera', bestVibe: 'rooftop', color: '#10b981' },
  { key: 'security', label: 'Security & Safe Transit', icon: 'shield', bestVibe: 'club', color: '#64748b' },
];

// ── PARTY & EVENT TYPES ───────────────────────────────────────────────────────
const PARTY_TYPES = [
  {
    key: 'rave',
    label: 'Underground Warehouse Rave',
    icon: 'moon',
    peakTime: '1:30 AM – 4:00 AM (Peak Afters)',
    audience: 'High-energy electronic, amapiano & techno crowd',
    footTraffic: '1,200 – 3,500 Vibers',
    color: '#a855f7',
  },
  {
    key: 'rooftop',
    label: 'Rooftop Sunset Lounge',
    icon: 'sunset',
    peakTime: '6:00 PM – 10:00 PM (Sunset Warmup)',
    audience: 'Cocktail lovers, lifestyle creators & VIP networkers',
    footTraffic: '300 – 800 Vibers',
    color: '#f59e0b',
  },
  {
    key: 'club',
    label: 'High-Energy Club & VIP Lounge',
    icon: 'zap',
    peakTime: '11:00 PM – 2:00 AM (Headliners Peak)',
    audience: 'Celebrity tables, bottle service & dancefloor peak',
    footTraffic: '800 – 2,200 Vibers',
    color: '#00f2ff',
  },
  {
    key: 'festival',
    label: 'Kasi Street Festival & Sound System',
    icon: 'radio',
    peakTime: '2:00 PM – 11:00 PM (All-Day Surge)',
    audience: 'Community vibers, dance crews & music enthusiasts',
    footTraffic: '2,500 – 8,000 Vibers',
    color: '#ec4899',
  },
  {
    key: 'sport',
    label: 'Sports Tournament & 5-a-Side Cup',
    icon: 'award',
    peakTime: '10:00 AM – 6:00 PM (Matchday Surge)',
    audience: 'Athletes, fans, local squads & families',
    footTraffic: '500 – 1,800 Vibers',
    color: '#10b981',
  },
  {
    key: 'market',
    label: 'Night Food Market & Pop-Up Hub',
    icon: 'shopping-bag',
    peakTime: '5:00 PM – 11:30 PM (Dinner & Early Vibes)',
    audience: 'Foodies, casual squads & weekend explorers',
    footTraffic: '1,500 – 4,000 Vibers',
    color: '#06b6d4',
  },
];

// ── ACTIVATION MODES (HOW IT WORKS) ──────────────────────────────────────────
const ACTIVATION_MODES = [
  {
    key: 'flyer',
    title: 'In-Event AirDrop Digital Flyer',
    badge: 'High Reach',
    desc: 'Pushes your digital promo directly onto the phone screens of everyone checked in or RSVP’d.',
    benefit: '85%+ direct engagement rate with zero paper waste.',
    icon: 'send',
  },
  {
    key: 'stall',
    title: 'Pop-Up Vendor Stall & Bar Stand',
    badge: 'Direct Sales',
    desc: 'Official on-the-ground presence inside the venue perimeter with Touch Down verification.',
    benefit: 'Instant on-site sales, contactless QR payments, and live footfall.',
    icon: 'map-pin',
  },
  {
    key: 'sponsor',
    title: 'Event Partner & Live Map Sponsor',
    badge: 'Brand Authority',
    desc: 'Your brand logo lights up the event card and radar ring on the interactive map.',
    benefit: 'High-frequency branding to thousands of city-wide vibers.',
    icon: 'star',
  },
];

export function BusinessActivationPortal({
  visible,
  onClose,
  onOpenStoreBuilder,
  onOpenDashboard,
  primary = '#00f2ff',
  bg = '#080b0d',
  textColor = '#fff',
  muted = 'rgba(255,255,255,0.55)',
}) {
  const { user } = useAuth();
  const { show: toast } = useToast();

  const [selectedCategory, setSelectedCategory] = useState('food');
  const [selectedParty, setSelectedParty] = useState('market');
  const [selectedMode, setSelectedMode] = useState('flyer');
  const [productTitle, setProductTitle] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [glitterFx, setGlitterFx] = useState(0);

  const activeCategoryMeta = useMemo(() => {
    return PRODUCT_CATEGORIES.find((c) => c.key === selectedCategory) || PRODUCT_CATEGORIES[0];
  }, [selectedCategory]);

  const activePartyMeta = useMemo(() => {
    return PARTY_TYPES.find((p) => p.key === selectedParty) || PARTY_TYPES[0];
  }, [selectedParty]);

  const activeModeMeta = useMemo(() => {
    return ACTIVATION_MODES.find((m) => m.key === selectedMode) || ACTIVATION_MODES[0];
  }, [selectedMode]);

  // Projected Value Calculation
  const projectedMetrics = useMemo(() => {
    const base = selectedParty === 'festival' ? 4500 : selectedParty === 'rave' ? 2200 : selectedParty === 'club' ? 1400 : 750;
    const estImpressions = Math.round(base * 0.85);
    const estConversions = Math.round(estImpressions * 0.08);
    const priceNum = parseFloat(productPrice) || (selectedCategory === 'food' ? 65 : selectedCategory === 'beverage' ? 50 : 250);
    const estRevenue = estConversions * priceNum;

    return {
      impressions: estImpressions.toLocaleString(),
      conversions: estConversions,
      estRevenue: `R ${estRevenue.toLocaleString()}`,
    };
  }, [selectedParty, selectedCategory, productPrice]);

  const handleLaunch = () => {
    try { haptics.success(); } catch {}
    setGlitterFx(Date.now());
    toast('Activation Plan Saved! Opening Business Dashboard...', 'success');
    setTimeout(() => {
      onClose();
      onOpenDashboard?.();
    }, 450);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <View style={[styles.sheet, { backgroundColor: 'rgba(10,14,16,0.98)', borderColor: `${primary}35` }]}>
          {/* Header */}
          <View style={styles.headRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Feather name="briefcase" size={17} color={primary} />
                <Text style={[styles.title, { color: textColor }]}>Business & Creator Studio</Text>
              </View>
              <Text style={[styles.sub, { color: muted }]}>
                Where, how & when your product will thrive in nightlife
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.closeBtn}>
              <Feather name="x" size={18} color={muted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
            {/* Step 1: Select What You Sell */}
            <View style={{ gap: 8 }}>
              <Text style={[styles.sectionLabel, { color: muted }]}>1. WHAT IS YOUR PRODUCT OR SERVICE?</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {PRODUCT_CATEGORIES.map((cat) => {
                  const active = selectedCategory === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      onPress={() => setSelectedCategory(cat.key)}
                      style={[
                        styles.catPill,
                        {
                          borderColor: active ? cat.color : 'rgba(255,255,255,0.12)',
                          backgroundColor: active ? `${cat.color}20` : 'rgba(255,255,255,0.03)',
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Feather name={cat.icon} size={13} color={active ? cat.color : muted} />
                      <Text style={[styles.catPillText, { color: active ? cat.color : textColor }]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Step 2: Where Does It Work? (Party Types) */}
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.sectionLabel, { color: muted }]}>2. WHERE DOES IT WORK BEST? (PARTY TYPE)</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {PARTY_TYPES.map((party) => {
                  const active = selectedParty === party.key;
                  return (
                    <TouchableOpacity
                      key={party.key}
                      onPress={() => setSelectedParty(party.key)}
                      style={[
                        styles.partyCard,
                        {
                          borderColor: active ? party.color : 'rgba(255,255,255,0.12)',
                          backgroundColor: active ? `${party.color}15` : 'rgba(255,255,255,0.03)',
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Feather name={party.icon} size={15} color={active ? party.color : muted} />
                        <Text style={[styles.partyTitle, { color: active ? party.color : textColor }]} numberOfLines={1}>
                          {party.label}
                        </Text>
                      </View>
                      <Text style={[styles.partyAudience, { color: muted }]} numberOfLines={2}>
                        {party.audience}
                      </Text>
                      <View style={[styles.trafficTag, { borderColor: `${party.color}40`, backgroundColor: `${party.color}12` }]}>
                        <Feather name="users" size={10} color={party.color} />
                        <Text style={{ color: party.color, fontSize: 10, fontWeight: '800' }}>
                          {party.footTraffic}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Step 3: How & When It Works Intel Card */}
            <View style={[styles.intelCard, { borderColor: `${activePartyMeta.color}45`, backgroundColor: 'rgba(15,22,25,0.96)' }]}>
              <View style={styles.intelHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Feather name="clock" size={14} color={activePartyMeta.color} />
                  <Text style={[styles.intelTitle, { color: textColor }]}>WHEN IT WORKS (OPTIMAL TIMING)</Text>
                </View>
                <View style={[styles.timeBadge, { borderColor: `${activePartyMeta.color}55`, backgroundColor: `${activePartyMeta.color}20` }]}>
                  <Text style={{ color: activePartyMeta.color, fontSize: 10, fontWeight: '900' }}>
                    {activePartyMeta.peakTime}
                  </Text>
                </View>
              </View>

              <Text style={{ color: muted, fontSize: 12, lineHeight: 18 }}>
                At {activePartyMeta.label}, products in {activeCategoryMeta.label} capture maximum interest during the peak nightlife surge. Vibers are actively seeking quality items, food, drinks, and entertainment on the ground.
              </Text>
            </View>

            {/* Step 4: How It Works (Activation Modes) */}
            <View style={{ gap: 8 }}>
              <Text style={[styles.sectionLabel, { color: muted }]}>3. HOW IT WORKS (CHOOSE YOUR ACTIVATION)</Text>
              <View style={{ gap: 8 }}>
                {ACTIVATION_MODES.map((mode) => {
                  const active = selectedMode === mode.key;
                  return (
                    <TouchableOpacity
                      key={mode.key}
                      onPress={() => setSelectedMode(mode.key)}
                      style={[
                        styles.modeCard,
                        {
                          borderColor: active ? primary : 'rgba(255,255,255,0.12)',
                          backgroundColor: active ? `${primary}12` : 'rgba(255,255,255,0.03)',
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[styles.modeIconWrap, { borderColor: active ? primary : 'rgba(255,255,255,0.15)', backgroundColor: active ? `${primary}25` : 'transparent' }]}>
                          <Feather name={mode.icon} size={15} color={active ? primary : muted} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.modeTitle, { color: active ? primary : textColor }]}>
                              {mode.title}
                            </Text>
                            <View style={[styles.modeBadge, { borderColor: `${primary}50`, backgroundColor: `${primary}20` }]}>
                              <Text style={{ color: primary, fontSize: 9, fontWeight: '900' }}>{mode.badge}</Text>
                            </View>
                          </View>
                          <Text style={{ color: muted, fontSize: 11, marginTop: 2 }}>{mode.desc}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Step 5: ROI & Value Calculator */}
            <View style={[styles.roiCard, { borderColor: 'rgba(16,185,129,0.40)', backgroundColor: 'rgba(16,185,129,0.07)' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Feather name="trending-up" size={15} color="#10b981" />
                <Text style={{ color: '#10b981', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 }}>
                  ESTIMATED BUSINESS BENEFIT (ROI CALCULATOR)
                </Text>
              </View>

              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Text style={{ color: muted, fontSize: 10, fontWeight: '700' }}>VERIFIED REACH</Text>
                  <Text style={{ color: textColor, fontSize: 17, fontWeight: '900', marginTop: 2 }}>
                    ~{projectedMetrics.impressions}
                  </Text>
                  <Text style={{ color: '#10b981', fontSize: 10, fontWeight: '600' }}>In-Room Vibers</Text>
                </View>

                <View style={[styles.metricDivider, { backgroundColor: 'rgba(255,255,255,0.10)' }]} />

                <View style={styles.metricItem}>
                  <Text style={{ color: muted, fontSize: 10, fontWeight: '700' }}>EST. CUSTOMERS</Text>
                  <Text style={{ color: primary, fontSize: 17, fontWeight: '900', marginTop: 2 }}>
                    {projectedMetrics.conversions}
                  </Text>
                  <Text style={{ color: primary, fontSize: 10, fontWeight: '600' }}>Direct Buyers</Text>
                </View>

                <View style={[styles.metricDivider, { backgroundColor: 'rgba(255,255,255,0.10)' }]} />

                <View style={styles.metricItem}>
                  <Text style={{ color: muted, fontSize: 10, fontWeight: '700' }}>PROJECTED REV</Text>
                  <Text style={{ color: '#f59e0b', fontSize: 17, fontWeight: '900', marginTop: 2 }}>
                    {projectedMetrics.estRevenue}
                  </Text>
                  <Text style={{ color: '#f59e0b', fontSize: 10, fontWeight: '600' }}>Nightly Gross</Text>
                </View>
              </View>
            </View>

            {/* Launch / Action CTA */}
            <TouchableOpacity
              onPress={handleLaunch}
              style={[styles.launchBtn, { backgroundColor: primary }]}
              activeOpacity={0.8}
            >
              <Feather name="zap" size={17} color="#000" />
              <Text style={styles.launchBtnText}>Launch Business Activation</Text>
              <ControlledGlitterBurst trigger={glitterFx} count={14} radius={40} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                onClose();
                onOpenStoreBuilder?.();
              }}
              style={[styles.storeBtn, { borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.04)' }]}
              activeOpacity={0.8}
            >
              <Feather name="shopping-bag" size={14} color={textColor} />
              <Text style={{ color: textColor, fontWeight: '800', fontSize: 13 }}>
                Open Storefront & Manage Products
              </Text>
            </TouchableOpacity>
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
    paddingBottom: 4,
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
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  partyCard: {
    width: 210,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  partyTitle: {
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  partyAudience: {
    fontSize: 11,
    lineHeight: 15,
  },
  trafficTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 2,
  },
  intelCard: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
  },
  intelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  intelTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  timeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  modeCard: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  modeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  modeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
  },
  roiCard: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 32,
  },
  launchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 24,
    marginTop: 4,
    position: 'relative',
  },
  launchBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 14,
  },
  storeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
  },
});

export default BusinessActivationPortal;
