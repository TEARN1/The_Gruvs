/**
 * BusinessActivationPortal — Guided Business & Creator Activation Studio,
 * Upcoming Event Gig Marketplace & Verified Business-to-Business (B2B) Open Line.
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

const PRODUCT_CATEGORIES = [
  { key: 'beverage', label: 'Beverages & Drinks', icon: 'coffee', bestVibe: 'club', color: '#00f2ff' },
  { key: 'food', label: 'Food & Gourmet Kotas', icon: 'pie-chart', bestVibe: 'market', color: '#f59e0b' },
  { key: 'fashion', label: 'Streetwear & Merch', icon: 'tag', bestVibe: 'festival', color: '#ec4899' },
  { key: 'sound', label: 'DJ / Audio & Lighting', icon: 'music', bestVibe: 'rave', color: '#8b5cf6' },
  { key: 'media', label: 'Photo & Video Production', icon: 'camera', bestVibe: 'rooftop', color: '#10b981' },
  { key: 'security', label: 'Security & Safe Transit', icon: 'shield', bestVibe: 'club', color: '#64748b' },
];

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

const ACTIVATION_MODES = [
  {
    key: 'flyer',
    title: 'In-Event AirDrop Digital Flyer',
    badge: 'High Reach',
    desc: 'Pushes your digital promo directly onto the phone screens of everyone checked in or RSVP’d.',
    icon: 'send',
  },
  {
    key: 'stall',
    title: 'Pop-Up Vendor Stall & Bar Stand',
    badge: 'Direct Sales',
    desc: 'Official on-the-ground presence inside the venue perimeter with Touch Down verification.',
    icon: 'map-pin',
  },
  {
    key: 'sponsor',
    title: 'Event Partner & Live Map Sponsor',
    badge: 'Brand Authority',
    desc: 'Your brand logo lights up the event card and radar ring on the interactive map.',
    icon: 'star',
  },
];

const UPCOMING_EVENT_GIGS = [
  {
    id: 'gig_1',
    eventTitle: 'Soweto Amapiano Spring Fest',
    venue: 'Zone 6 Venue, Soweto · Sat 14:00',
    neededCategory: 'food',
    slotFee: 'R 350 Stall Pass',
    estEarnings: 'R 8,500 – R 16,000',
    headcount: '2,800 Expected Vibers',
    hostBiz: '@zone6_events',
  },
  {
    id: 'gig_2',
    eventTitle: 'Rosebank Skybar Sunset Session',
    venue: 'Elevate Rooftop · Fri 17:00',
    neededCategory: 'beverage',
    slotFee: 'R 450 Bar Activation',
    estEarnings: 'R 12,000 – R 22,000',
    headcount: '650 VIP Guests',
    hostBiz: '@elevate_skybar',
  },
  {
    id: 'gig_3',
    eventTitle: 'Braam Streetwear Pop-Up & Cipher',
    venue: 'Maboneng Courtyard · Sun 13:00',
    neededCategory: 'fashion',
    slotFee: 'R 250 Booth Pass',
    estEarnings: 'R 6,000 – R 14,000',
    headcount: '1,100 Creators',
    hostBiz: '@kasi_drip_collective',
  },
  {
    id: 'gig_4',
    eventTitle: 'Midrand Warehouse Sound-Off & Night Cup',
    venue: 'Ivory Park Arena · Sat 19:00',
    neededCategory: 'sound',
    slotFee: 'R 400 Vendor License',
    estEarnings: 'R 9,000 – R 19,000',
    headcount: '1,900 Attendees',
    hostBiz: '@midrand_motorsport',
  },
];

const B2B_PARTNER_THREADS = [
  {
    id: 'b2b_1',
    partnerName: 'Konka Soweto Promenade Ops',
    type: 'Venue Organizer',
    request: 'Looking for 2 verified midnight Kota kitchens + 1 VIP photographer for Saturday closing.',
    verified: true,
  },
  {
    id: 'b2b_2',
    partnerName: 'JHB Beverage Wholesale Hub',
    type: 'Drink & Ice Supplier',
    request: 'Bulk ice, mixer & sparkler drops available for registered Business Mode stall owners (20% B2B trade discount).',
    verified: true,
  },
  {
    id: 'b2b_3',
    partnerName: 'Mzansi Guard & Safe Convoy',
    type: 'Licensed Security & Transit',
    request: 'Co-host bundle: Discounted bouncer + checked ID shuttle coverage for upcoming festivals.',
    verified: true,
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
  const { profile } = useAuth();
  const { show: toast } = useToast();

  const [portalTab, setPortalTab] = useState('studio'); // 'studio' | 'gigs' | 'b2b'
  const [selectedCategory, setSelectedCategory] = useState('food');
  const [selectedParty, setSelectedParty] = useState('market');
  const [selectedMode, setSelectedMode] = useState('flyer');
  const [productTitle, setProductTitle] = useState('');
  const [productPrice, setProductPrice] = useState('65');
  const [businessModeEnabled, setBusinessModeEnabled] = useState(
    Boolean(profile?.account_type === 'business' || profile?.business_profiles)
  );
  const [b2bPassPaid, setB2bPassPaid] = useState(false);
  const [b2bMessages, setB2bMessages] = useState({});
  const [b2bDraft, setB2bDraft] = useState('');
  const [glitterFx, setGlitterFx] = useState(0);

  const activeCategoryMeta = useMemo(
    () => PRODUCT_CATEGORIES.find((c) => c.key === selectedCategory) || PRODUCT_CATEGORIES[0],
    [selectedCategory]
  );

  const activePartyMeta = useMemo(
    () => PARTY_TYPES.find((p) => p.key === selectedParty) || PARTY_TYPES[0],
    [selectedParty]
  );

  const filteredGigs = useMemo(() => {
    const exact = UPCOMING_EVENT_GIGS.filter((g) => g.neededCategory === selectedCategory);
    return exact.length > 0 ? [...exact, ...UPCOMING_EVENT_GIGS.filter((g) => g.neededCategory !== selectedCategory)] : UPCOMING_EVENT_GIGS;
  }, [selectedCategory]);

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
    toast(
      `Activation "${productTitle.trim() || activeCategoryMeta.label}" launched for ${activePartyMeta.label}!`,
      'success'
    );
    setTimeout(() => {
      onClose();
      onOpenDashboard?.();
    }, 450);
  };

  const handleSendB2bPitch = (partnerId, partnerName) => {
    if (!businessModeEnabled || !b2bPassPaid) {
      toast('Enable Business Mode and unlock the R49 B2B Open Line pass first.', 'info');
      return;
    }
    const text = b2bDraft.trim() || `Hi ${partnerName}, we'd like to host a ${activeCategoryMeta.label} activation at your upcoming event.`;
    setB2bMessages((prev) => ({ ...prev, [partnerId]: text }));
    setB2bDraft('');
    try { haptics.success(); } catch {}
    toast(`B2B Line message sent directly to ${partnerName}!`, 'success');
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
                Event Gigs, Activation ROI & Exclusive Business-to-Business Line
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.closeBtn}>
              <Feather name="x" size={18} color={muted} />
            </TouchableOpacity>
          </View>

          {/* Studio Mode Switcher */}
          <View style={styles.studioTabs}>
            {[
              { key: 'studio', label: '1. Studio & ROI', icon: 'sliders' },
              { key: 'gigs', label: '2. Event Gigs', icon: 'dollar-sign' },
              { key: 'b2b', label: '3. B2B Open Line', icon: 'shield' },
            ].map((t) => {
              const active = portalTab === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => setPortalTab(t.key)}
                  style={[
                    styles.studioTabBtn,
                    {
                      backgroundColor: active ? primary : 'rgba(255,255,255,0.04)',
                      borderColor: active ? primary : 'rgba(255,255,255,0.12)',
                    },
                  ]}
                >
                  <Feather name={t.icon} size={12} color={active ? '#000' : muted} />
                  <Text style={{ color: active ? '#000' : textColor, fontSize: 11, fontWeight: '900' }}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
            {/* Shared Working Category Filter */}
            <View style={{ gap: 8 }}>
              <Text style={[styles.sectionLabel, { color: muted }]}>SELECT YOUR BUSINESS / PRODUCT NICHE</Text>
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
                          backgroundColor: active ? `${cat.color}22` : 'rgba(255,255,255,0.03)',
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

            {/* ── TAB 1: ACTIVATION STUDIO ── */}
            {portalTab === 'studio' && (
              <>
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.textInput, { flex: 1.5, color: textColor }]}
                    placeholder="Product or brand name (e.g. Soweto Wings)"
                    placeholderTextColor={muted}
                    value={productTitle}
                    onChangeText={setProductTitle}
                  />
                  <TextInput
                    style={[styles.textInput, { flex: 0.7, color: primary, fontWeight: '800' }]}
                    placeholder="Price R"
                    placeholderTextColor={muted}
                    value={productPrice}
                    onChangeText={setProductPrice}
                    keyboardType="numeric"
                  />
                </View>

                <View style={{ gap: 8 }}>
                  <Text style={[styles.sectionLabel, { color: muted }]}>WHERE DOES IT WORK BEST? (PARTY TYPE)</Text>
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
                            <Text style={{ color: party.color, fontSize: 10, fontWeight: '800' }}>{party.footTraffic}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                <View style={{ gap: 8 }}>
                  <Text style={[styles.sectionLabel, { color: muted }]}>CHOOSE YOUR ACTIVATION MODEL</Text>
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
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={[styles.modeIconWrap, { borderColor: active ? primary : 'rgba(255,255,255,0.15)', backgroundColor: active ? `${primary}25` : 'transparent' }]}>
                            <Feather name={mode.icon} size={15} color={active ? primary : muted} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={[styles.modeTitle, { color: active ? primary : textColor }]}>{mode.title}</Text>
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

                <View style={[styles.roiCard, { borderColor: 'rgba(16,185,129,0.40)', backgroundColor: 'rgba(16,185,129,0.07)' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Feather name="trending-up" size={15} color="#10b981" />
                    <Text style={{ color: '#10b981', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 }}>
                      PROJECTED NIGHTLY ROI ({activePartyMeta.peakTime})
                    </Text>
                  </View>
                  <View style={styles.metricsRow}>
                    <View style={styles.metricItem}>
                      <Text style={{ color: muted, fontSize: 10, fontWeight: '700' }}>VERIFIED REACH</Text>
                      <Text style={{ color: textColor, fontSize: 17, fontWeight: '900', marginTop: 2 }}>~{projectedMetrics.impressions}</Text>
                    </View>
                    <View style={[styles.metricDivider, { backgroundColor: 'rgba(255,255,255,0.10)' }]} />
                    <View style={styles.metricItem}>
                      <Text style={{ color: muted, fontSize: 10, fontWeight: '700' }}>EST. BUYERS</Text>
                      <Text style={{ color: primary, fontSize: 17, fontWeight: '900', marginTop: 2 }}>{projectedMetrics.conversions}</Text>
                    </View>
                    <View style={[styles.metricDivider, { backgroundColor: 'rgba(255,255,255,0.10)' }]} />
                    <View style={styles.metricItem}>
                      <Text style={{ color: muted, fontSize: 10, fontWeight: '700' }}>PROJECTED REV</Text>
                      <Text style={{ color: '#f59e0b', fontSize: 17, fontWeight: '900', marginTop: 2 }}>{projectedMetrics.estRevenue}</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity onPress={handleLaunch} style={[styles.launchBtn, { backgroundColor: primary }]} activeOpacity={0.85}>
                  <Feather name="zap" size={17} color="#000" />
                  <Text style={styles.launchBtnText}>Launch Business Activation</Text>
                  <ControlledGlitterBurst trigger={glitterFx} count={14} radius={40} />
                </TouchableOpacity>
              </>
            )}

            {/* ── TAB 2: UPCOMING EVENT GIGS MARKETPLACE ── */}
            {portalTab === 'gigs' && (
              <View style={{ gap: 10 }}>
                <View style={[styles.intelCard, { borderColor: '#f59e0b50', backgroundColor: 'rgba(245,158,11,0.08)' }]}>
                  <Text style={{ color: '#f59e0b', fontSize: 12, fontWeight: '900' }}>
                    MAKE MONEY AT UPCOMING EVENTS
                  </Text>
                  <Text style={{ color: muted, fontSize: 11.5, lineHeight: 16 }}>
                    Book verified vendor stalls, pop-up bars, and production gigs at upcoming events. Hosts unlock your gig chat line as soon as the slot pass is paid.
                  </Text>
                </View>

                {filteredGigs.map((gig) => {
                  const isMatch = gig.neededCategory === selectedCategory;
                  return (
                    <View
                      key={gig.id}
                      style={[
                        styles.modeCard,
                        {
                          borderColor: isMatch ? primary : 'rgba(255,255,255,0.12)',
                          backgroundColor: isMatch ? `${primary}10` : 'rgba(255,255,255,0.03)',
                          gap: 8,
                        },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: textColor, fontSize: 13.5, fontWeight: '900', flex: 1 }}>{gig.eventTitle}</Text>
                        <View style={[styles.modeBadge, { borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.18)' }]}>
                          <Text style={{ color: '#10b981', fontSize: 9.5, fontWeight: '900' }}>{gig.slotFee}</Text>
                        </View>
                      </View>
                      <Text style={{ color: muted, fontSize: 11 }}>{gig.venue} · {gig.headcount}</Text>
                      <Text style={{ color: '#f59e0b', fontSize: 11.5, fontWeight: '800' }}>
                        Est. Vendor Earnings: {gig.estEarnings} · Host {gig.hostBiz}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          if (!businessModeEnabled) {
                            toast('Switch to Business Mode (see Tab 3) to claim paid Event Gigs.', 'info');
                            setPortalTab('b2b');
                            return;
                          }
                          setGlitterFx(Date.now());
                          toast(`Gig Pass requested for ${gig.eventTitle} (${gig.slotFee}) — Host line opened!`, 'success');
                        }}
                        style={[styles.launchBtn, { height: 38, backgroundColor: primary }]}
                      >
                        <Feather name="briefcase" size={14} color="#000" />
                        <Text style={{ color: '#000', fontWeight: '900', fontSize: 12 }}>
                          Book Gig & Message Promoter
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            {/* ── TAB 3: STRICT BUSINESS-TO-BUSINESS (B2B) OPEN LINE ── */}
            {portalTab === 'b2b' && (
              <View style={{ gap: 12 }}>
                <View
                  style={[
                    styles.intelCard,
                    {
                      borderColor: businessModeEnabled ? '#10b981' : '#ef444460',
                      backgroundColor: businessModeEnabled ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                    },
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: businessModeEnabled ? '#10b981' : '#ef4444', fontSize: 12.5, fontWeight: '900' }}>
                        {businessModeEnabled ? 'BUSINESS MODE ACTIVE · B2B NETWORK' : 'LOCKED TO BUSINESS ACCOUNTS ONLY'}
                      </Text>
                      <Text style={{ color: muted, fontSize: 11, marginTop: 3 }}>
                        Personal individuals cannot enter B2B Open Line chats. Switch to Business Mode & activate the R49 B2B Trade Pass to negotiate wholesale deals, sound rigs, and event stalls.
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                    <TouchableOpacity
                      onPress={() => {
                        setBusinessModeEnabled((v) => !v);
                        toast(!businessModeEnabled ? 'Switched to Business Mode!' : 'Returned to Personal Mode', 'info');
                      }}
                      style={[
                        styles.studioTabBtn,
                        {
                          flex: 1,
                          backgroundColor: businessModeEnabled ? '#10b981' : 'rgba(255,255,255,0.08)',
                          borderColor: businessModeEnabled ? '#10b981' : primary,
                        },
                      ]}
                    >
                      <Text style={{ color: businessModeEnabled ? '#000' : textColor, fontSize: 11.5, fontWeight: '900' }}>
                        {businessModeEnabled ? 'Business Mode: ON ✓' : 'Switch to Business Mode'}
                      </Text>
                    </TouchableOpacity>

                    {businessModeEnabled && (
                      <TouchableOpacity
                        onPress={() => {
                          setB2bPassPaid(true);
                          setGlitterFx(Date.now());
                          toast('R49 B2B Open Line Pass Unlocked! Trade threads open.', 'success');
                        }}
                        style={[
                          styles.studioTabBtn,
                          {
                            flex: 1,
                            backgroundColor: b2bPassPaid ? 'rgba(0,242,255,0.2)' : '#f59e0b',
                            borderColor: b2bPassPaid ? primary : '#f59e0b',
                          },
                        ]}
                      >
                        <Text style={{ color: b2bPassPaid ? primary : '#000', fontSize: 11.5, fontWeight: '900' }}>
                          {b2bPassPaid ? 'B2B Line Open ✓' : 'Unlock Line (R49 Pass)'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {businessModeEnabled && (
                  <>
                    <TextInput
                      style={[styles.textInput, { color: textColor }]}
                      placeholder="Write your B2B offer / pitch (e.g. 200 Kotas at wholesale split)..."
                      placeholderTextColor={muted}
                      value={b2bDraft}
                      onChangeText={setB2bDraft}
                    />
                    {B2B_PARTNER_THREADS.map((p) => {
                      const sent = b2bMessages[p.id];
                      return (
                        <View key={p.id} style={[styles.modeCard, { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.03)', gap: 8 }]}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ color: textColor, fontSize: 13.5, fontWeight: '900' }}>{p.partnerName}</Text>
                            <View style={[styles.modeBadge, { borderColor: primary, backgroundColor: `${primary}18` }]}>
                              <Text style={{ color: primary, fontSize: 9, fontWeight: '900' }}>{p.type}</Text>
                            </View>
                          </View>
                          <Text style={{ color: muted, fontSize: 11.5, lineHeight: 16 }}>{p.request}</Text>
                          {sent ? (
                            <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '800' }}>✓ Sent: "{sent}"</Text>
                          ) : (
                            <TouchableOpacity
                              onPress={() => handleSendB2bPitch(p.id, p.partnerName)}
                              style={[styles.storeBtn, { height: 36, borderColor: primary, backgroundColor: `${primary}15` }]}
                            >
                              <Feather name="message-square" size={13} color={primary} />
                              <Text style={{ color: primary, fontWeight: '900', fontSize: 11.5 }}>Open B2B Line Chat</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </>
                )}
              </View>
            )}

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
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 4 },
  title: { fontSize: 17, fontWeight: '900' },
  sub: { fontSize: 11.5, marginTop: 2, fontWeight: '600' },
  closeBtn: { padding: 4 },
  studioTabs: { flexDirection: 'row', gap: 6 },
  studioTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  inputRow: { flexDirection: 'row', gap: 8 },
  textInput: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12.5,
  },
  catPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  catPillText: { fontSize: 12, fontWeight: '800' },
  partyCard: { width: 210, padding: 12, borderRadius: 16, borderWidth: 1, gap: 6 },
  partyTitle: { fontSize: 13, fontWeight: '800', flex: 1 },
  partyAudience: { fontSize: 11, lineHeight: 15 },
  trafficTag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, borderWidth: 1, marginTop: 2 },
  intelCard: { padding: 14, borderRadius: 18, borderWidth: 1, gap: 8 },
  modeCard: { padding: 12, borderRadius: 16, borderWidth: 1 },
  modeIconWrap: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modeTitle: { fontSize: 13, fontWeight: '800' },
  modeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  roiCard: { padding: 14, borderRadius: 18, borderWidth: 1, gap: 12 },
  metricsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metricItem: { flex: 1, alignItems: 'center' },
  metricDivider: { width: 1, height: 32 },
  launchBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 23, position: 'relative' },
  launchBtnText: { color: '#000', fontWeight: '900', fontSize: 14 },
  storeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 22, borderWidth: 1 },
});

export default BusinessActivationPortal;
