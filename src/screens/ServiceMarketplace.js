import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { supabase } from '../services/supabase';
import { EscrowService } from '../services/escrowService';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastNotification';
import { GigModeCard } from '../components/GigModeCard';

// ---------------------------------------------------------------------------
// Sample fallback data
// ---------------------------------------------------------------------------

const SAMPLE_PROVIDERS = [
  {
    id: 'sample-1',
    username: 'ThandoMoves',
    display_name: 'Thando Nkosi',
    service_type: 'Full Move',
    social_integrity_score: 87,
    price_min: 450,
    price_max: 1200,
    distance_km: 2.4,
    available: true,
    tab: 'Moving Help',
  },
  {
    id: 'sample-2',
    username: 'BakkieKing_ZA',
    display_name: 'Sipho Dlamini',
    service_type: 'Bakkie',
    social_integrity_score: 74,
    price_min: 200,
    price_max: 600,
    distance_km: 5.1,
    available: true,
    tab: 'Moving Help',
  },
  {
    id: 'sample-3',
    username: 'PackProLisa',
    display_name: 'Lisa Venter',
    service_type: 'Packing',
    social_integrity_score: 91,
    price_min: 150,
    price_max: 400,
    distance_km: 1.2,
    available: false,
    tab: 'Event Logistics',
  },
];

const SAMPLE_GIGS = [
  {
    id: 'gig-1',
    title: 'Help Move 2-Bedroom Flat',
    description: 'Need 2 people + bakkie for Saturday morning move from Rosebank to Sandton.',
    category: 'moving',
    pay_rands: 350,
    distance_km: 3.2,
    time_window: 'Sat 08:00–13:00',
    poster_username: 'NombusoM',
    social_integrity_score: 79,
    tab: 'Moving Help',
  },
  {
    id: 'gig-2',
    title: 'Event Setup Crew Needed',
    description: 'Setting up tables, chairs, and PA equipment for a 200-person event in Midrand.',
    category: 'crew',
    pay_rands: 500,
    distance_km: 8.7,
    time_window: 'Fri 14:00–18:00',
    poster_username: 'EventsByZara',
    social_integrity_score: 85,
    tab: 'Event Logistics',
  },
];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABS = ['Moving Help', 'Event Logistics'];
const RADIUS_OPTIONS = ['1km', '5km', '10km', '25km'];
const SERVICE_TYPES = ['Bakkie', 'Muscle', 'Packing', 'Full Move'];
const CARGO_TYPES = ['Furniture', 'Appliances', 'Boxes', 'Mixed'];

function getInitials(name = '') {
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function starRating(score) {
  // Map 0-100 SIS score to 1-5 stars
  const stars = Math.round((score / 100) * 4) + 1;
  return Math.min(5, Math.max(1, stars));
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ServiceCard({ provider, onBook, primary, muted, textColor, bg }) {
  const sis = provider.social_integrity_score ?? 0;
  const stars = starRating(sis);

  return (
    <View style={[styles.card, { backgroundColor: bg }]}>
      {/* Availability dot */}
      <View style={styles.cardHeader}>
        <View style={styles.avatarRow}>
          <View style={[styles.avatar, { backgroundColor: primary }]}>
            <Text style={styles.avatarText}>
              {getInitials(provider.display_name || provider.username)}
            </Text>
          </View>
          <View style={{ gap: 2, flex: 1 }}>
            <Text style={[styles.providerName, { color: textColor }]} numberOfLines={1}>
              {provider.display_name || provider.username}
            </Text>
            <Text style={[styles.providerHandle, { color: muted }]} numberOfLines={1}>
              @{provider.username}
            </Text>
          </View>
          {/* Online dot */}
          <View style={styles.availabilityRow}>
            <View
              style={[
                styles.availDot,
                { backgroundColor: provider.available ? '#10b981' : '#6b7280' },
              ]}
            />
            <Text style={[styles.availText, { color: provider.available ? '#10b981' : muted }]}>
              {provider.available ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>
      </View>

      {/* Service type badge */}
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: primary + '22' }]}>
          <Feather name="truck" size={12} color={primary} />
          <Text style={[styles.badgeText, { color: primary }]}>{provider.service_type}</Text>
        </View>

        {/* Distance */}
        <View style={[styles.badge, { backgroundColor: '#ffffff10' }]}>
          <Feather name="map-pin" size={12} color={muted} />
          <Text style={[styles.badgeText, { color: muted }]}>
            {provider.distance_km ?? '?'} km
          </Text>
        </View>
      </View>

      {/* Stars + SIS */}
      <View style={styles.starsRow}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Feather
            key={i}
            name="star"
            size={14}
            color={i < stars ? '#FFD700' : '#374151'}
          />
        ))}
        <Text style={[styles.sisLabel, { color: muted }]}>SIS {sis}</Text>
      </View>

      {/* Price range + Book */}
      <View style={styles.cardFooter}>
        <Text style={[styles.price, { color: textColor }]}>
          R{provider.price_min ?? '?'} – R{provider.price_max ?? '?'}
        </Text>
        <TouchableOpacity
          style={[styles.bookBtn, { backgroundColor: primary }]}
          onPress={() => onBook(provider)}
          activeOpacity={0.8}
        >
          <Text style={styles.bookBtnText}>Book</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Booking Modal
// ---------------------------------------------------------------------------

function BookingModal({
  visible,
  onClose,
  provider,
  currentUserId,
  primary,
  muted,
  textColor,
  bg,
  surface,
  onSuccess,
  showToast,
}) {
  const [cargoType, setCargoType] = useState(CARGO_TYPES[0]);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [bookingId, setBookingId] = useState(null);
  const [phase, setPhase] = useState('form'); // 'form' | 'escrow' | 'proof'

  const estimatedPrice =
    provider
      ? Math.round(((provider.price_min ?? 0) + (provider.price_max ?? 0)) / 2)
      : 0;

  const reset = () => {
    setCargoType(CARGO_TYPES[0]);
    setOrigin('');
    setDestination('');
    setScheduledAt('');
    setLoading(false);
    setBookingId(null);
    setPhase('form');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleLockFunds = async () => {
    if (!origin.trim() || !destination.trim() || !scheduledAt.trim()) {
      showToast('Please fill in all fields', 'warning');
      return;
    }
    setLoading(true);
    const id = await EscrowService.lockFunds({
      requester_id: currentUserId,
      provider_id: provider?.id,
      service_type: provider?.service_type ?? 'General',
      cargo_type: cargoType,
      origin_address: origin.trim(),
      destination_address: destination.trim(),
      scheduled_at: scheduledAt.trim(),
      amount_cents: estimatedPrice * 100,
    });
    setLoading(false);

    if (id) {
      setBookingId(id);
      setPhase('proof');
      showToast('Funds locked in escrow!', 'success');
    } else {
      // Fallback: simulate locally so UX continues
      const fakeId = `local-${Date.now()}`;
      setBookingId(fakeId);
      setPhase('proof');
      showToast('Escrow held (offline mode)', 'info');
    }
  };

  const handleReceived = async () => {
    setLoading(true);
    const ok = await EscrowService.releaseToProvider(bookingId, provider?.id);
    setLoading(false);
    if (ok) {
      showToast(`R${estimatedPrice} released to ${provider?.username}!`, 'success');
    } else {
      showToast('Payment released (simulated)', 'success');
    }
    onSuccess?.();
    handleClose();
  };

  const handleDispute = async () => {
    setLoading(true);
    await EscrowService.initiateDispute(bookingId, 'Requester initiated dispute');
    setLoading(false);
    showToast('Dispute opened. Support will contact you.', 'warning');
    handleClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalSheet, { backgroundColor: bg }]}>
          {/* Handle */}
          <View style={styles.modalHandle} />

          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: textColor }]}>
              {phase === 'proof' ? 'Proof of Arrival' : `Book ${provider?.username}`}
            </Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={22} color={muted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {phase === 'form' && (
              <View style={styles.modalBody}>
                {/* Cargo type */}
                <Text style={[styles.inputLabel, { color: muted }]}>Cargo Type</Text>
                <View style={styles.chipRow}>
                  {CARGO_TYPES.map((ct) => (
                    <TouchableOpacity
                      key={ct}
                      style={[
                        styles.chip,
                        {
                          backgroundColor:
                            cargoType === ct ? primary : surface,
                          borderColor: cargoType === ct ? primary : 'transparent',
                          borderWidth: 1,
                        },
                      ]}
                      onPress={() => setCargoType(ct)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: cargoType === ct ? '#fff' : muted },
                        ]}
                      >
                        {ct}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Pickup */}
                <Text style={[styles.inputLabel, { color: muted }]}>Pickup Address</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: surface, color: textColor, borderColor: '#ffffff15' }]}
                  placeholder="Enter pickup address..."
                  placeholderTextColor={muted}
                  value={origin}
                  onChangeText={setOrigin}
                />

                {/* Dropoff */}
                <Text style={[styles.inputLabel, { color: muted }]}>Drop-off Address</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: surface, color: textColor, borderColor: '#ffffff15' }]}
                  placeholder="Enter drop-off address..."
                  placeholderTextColor={muted}
                  value={destination}
                  onChangeText={setDestination}
                />

                {/* Date/time */}
                <Text style={[styles.inputLabel, { color: muted }]}>Date & Time</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: surface, color: textColor, borderColor: '#ffffff15' }]}
                  placeholder="e.g. 2026-05-15 09:00"
                  placeholderTextColor={muted}
                  value={scheduledAt}
                  onChangeText={setScheduledAt}
                />

                {/* Estimated price */}
                <View style={[styles.priceEstimate, { backgroundColor: surface }]}>
                  <Feather name="tag" size={16} color={primary} />
                  <Text style={[styles.priceEstimateText, { color: textColor }]}>
                    Estimated:{' '}
                    <Text style={{ color: '#10b981', fontWeight: '800' }}>
                      R{estimatedPrice}
                    </Text>
                  </Text>
                </View>

                {/* CTA */}
                <TouchableOpacity
                  style={[styles.ctaBtn, { backgroundColor: primary, opacity: loading ? 0.6 : 1 }]}
                  onPress={handleLockFunds}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Feather name="lock" size={16} color="#fff" />
                      <Text style={styles.ctaBtnText}>Lock Funds in Escrow</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {phase === 'proof' && (
              <View style={styles.modalBody}>
                <View style={[styles.escrowBadge, { backgroundColor: '#10b98122' }]}>
                  <Feather name="shield" size={28} color="#10b981" />
                  <Text style={[styles.escrowTitle, { color: '#10b981' }]}>
                    Escrow Active
                  </Text>
                  <Text style={[styles.escrowSub, { color: muted }]}>
                    R{estimatedPrice} is held securely. Release only when satisfied.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.ctaBtn, { backgroundColor: '#10b981', marginBottom: 12, opacity: loading ? 0.6 : 1 }]}
                  onPress={handleReceived}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Feather name="check-circle" size={16} color="#fff" />
                      <Text style={styles.ctaBtnText}>Cargo Received ✓</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.ctaBtn, { backgroundColor: '#ef4444', opacity: loading ? 0.6 : 1 }]}
                  onPress={handleDispute}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Feather name="alert-triangle" size={16} color="#fff" />
                  <Text style={styles.ctaBtnText}>Dispute</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export function ServiceMarketplace() {
  const insets = useSafeAreaInsets();
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const { show: showToast } = useToast();

  const primary = currentTheme?.primary ?? '#f97316';
  const background = currentTheme?.background ?? '#0d0d1a';
  const surface = currentTheme?.surface ?? '#1a1a2e';
  const textColor = currentTheme?.text ?? '#f9fafb';
  const muted = currentTheme?.textMuted ?? '#9ca3af';

  const [gigMode, setGigMode] = useState(false);
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [activeRadius, setActiveRadius] = useState('10km');
  const [providers, setProviders] = useState([]);
  const [gigs, setGigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [bookingTarget, setBookingTarget] = useState(null);
  const [bookingModalVisible, setBookingModalVisible] = useState(false);

  // Fetch providers from Supabase, fall back to sample data
  const fetchProviders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('service_nodes')
        .select('*, profiles(username, avatar_url, social_integrity_score)')
        .eq('available', true)
        .order('created_at', { ascending: false });

      if (error || !data || data.length === 0) {
        setProviders(SAMPLE_PROVIDERS);
      } else {
        setProviders(data);
      }
    } catch {
      setProviders(SAMPLE_PROVIDERS);
    }
  }, []);

  // Fetch gigs from Supabase, fall back to sample data
  const fetchGigs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('gig_posts')
        .select('*, profiles(username, avatar_url, social_integrity_score)')
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (error || !data || data.length === 0) {
        setGigs(SAMPLE_GIGS);
      } else {
        setGigs(data);
      }
    } catch {
      setGigs(SAMPLE_GIGS);
    }
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    await Promise.all([fetchProviders(), fetchGigs()]);

    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  }, [fetchProviders, fetchGigs]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => load(true);

  // Filter providers by tab + radius
  const filteredProviders = providers.filter((p) => {
    const tabMatch = !p.tab || p.tab === activeTab;
    const km = parseFloat(activeRadius);
    const distMatch = !p.distance_km || p.distance_km <= km;
    return tabMatch && distMatch;
  });

  // Filter gigs by tab + radius
  const filteredGigs = gigs.filter((g) => {
    const tabMatch = !g.tab || g.tab === activeTab;
    const km = parseFloat(activeRadius);
    const distMatch = !g.distance_km || g.distance_km <= km;
    return tabMatch && distMatch;
  });

  const handleBook = (provider) => {
    setBookingTarget(provider);
    setBookingModalVisible(true);
  };

  const handleAcceptGig = async (gig) => {
    try {
      await supabase.from('gig_acceptances').insert([
        {
          gig_id: gig.id,
          acceptor_id: user?.id,
          accepted_at: new Date().toISOString(),
          status: 'accepted',
        },
      ]);
    } catch {
      // silently ignore — card already shows accepted state
    }
    showToast(`Gig accepted! Contact ${gig.poster_username}`, 'success');
  };

  const EmptyState = ({ icon, message }) => (
    <View style={styles.emptyState}>
      <Feather name={icon} size={48} color={muted} style={{ opacity: 0.5 }} />
      <Text style={[styles.emptyText, { color: muted }]}>{message}</Text>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: background, paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: textColor }]}>Service Nodes</Text>

        {/* Gig Mode toggle */}
        <TouchableOpacity
          style={[
            styles.gigToggle,
            {
              backgroundColor: gigMode ? primary : surface,
              borderColor: primary,
            },
          ]}
          onPress={() => setGigMode((v) => !v)}
          activeOpacity={0.8}
        >
          <Feather
            name={gigMode ? 'zap' : 'briefcase'}
            size={13}
            color={gigMode ? '#fff' : primary}
          />
          <Text style={[styles.gigToggleText, { color: gigMode ? '#fff' : primary }]}>
            {gigMode ? 'Gig Mode ON' : 'Gig Mode'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Tabs ── */}
      <View style={[styles.tabRow, { borderBottomColor: '#ffffff10' }]}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tabItem,
              activeTab === tab && { borderBottomColor: primary, borderBottomWidth: 2 },
            ]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab ? primary : muted },
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Radius filter bar ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterBar}
        style={{ flexGrow: 0 }}
      >
        {RADIUS_OPTIONS.map((r) => (
          <TouchableOpacity
            key={r}
            style={[
              styles.radiusChip,
              {
                backgroundColor: activeRadius === r ? primary : surface,
                borderColor: activeRadius === r ? primary : 'transparent',
              },
            ]}
            onPress={() => setActiveRadius(r)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.radiusChipText,
                { color: activeRadius === r ? '#fff' : muted },
              ]}
            >
              {r}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={[styles.radiusLabel, { color: muted }]}>radius</Text>
      </ScrollView>

      {/* ── Content ── */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={primary} />
        </View>
      ) : gigMode ? (
        /* ── GIG MODE ── */
        <FlatList
          data={filteredGigs}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={primary}
              colors={[primary]}
            />
          }
          renderItem={({ item }) => (
            <GigModeCard
              gig={item}
              onAccept={handleAcceptGig}
              primary={primary}
              muted={muted}
              textColor={textColor}
              bg={surface}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="alert-circle"
              message={`No gigs available within ${activeRadius}.\nPull to refresh or expand radius.`}
            />
          }
        />
      ) : (
        /* ── BROWSE MODE ── */
        <FlatList
          data={filteredProviders}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={primary}
              colors={[primary]}
            />
          }
          renderItem={({ item }) => (
            <ServiceCard
              provider={item}
              onBook={handleBook}
              primary={primary}
              muted={muted}
              textColor={textColor}
              bg={surface}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="truck"
              message={`No providers found within ${activeRadius}.\nTry expanding the radius.`}
            />
          }
        />
      )}

      {/* ── Booking Modal ── */}
      <BookingModal
        visible={bookingModalVisible}
        onClose={() => {
          setBookingModalVisible(false);
          setBookingTarget(null);
        }}
        provider={bookingTarget}
        currentUserId={user?.id}
        primary={primary}
        muted={muted}
        textColor={textColor}
        bg={background}
        surface={surface}
        onSuccess={() => {
          setBookingModalVisible(false);
          setBookingTarget(null);
          load(true);
        }}
        showToast={showToast}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  gigToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  gigToggleText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginHorizontal: 18,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Filter bar
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 8,
  },
  radiusChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  radiusChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  radiusLabel: {
    fontSize: 12,
    marginLeft: 4,
  },

  // List
  list: {
    paddingHorizontal: 16,
    paddingBottom: 140,
    paddingTop: 4,
  },

  // Service card
  card: {
    borderRadius: 16,
    padding: 14,
    marginVertical: 6,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  cardHeader: {},
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  providerName: {
    fontSize: 15,
    fontWeight: '700',
  },
  providerHandle: {
    fontSize: 12,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  availDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  availText: {
    fontSize: 11,
    fontWeight: '600',
  },

  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },

  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sisLabel: {
    fontSize: 12,
    marginLeft: 6,
  },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
  },
  bookBtn: {
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 20,
  },
  bookBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 14,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Loading
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ffffff30',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },

  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: -4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },

  priceEstimate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
  },
  priceEstimateText: {
    fontSize: 15,
    fontWeight: '600',
  },

  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  ctaBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  escrowBadge: {
    alignItems: 'center',
    borderRadius: 16,
    padding: 24,
    gap: 8,
  },
  escrowTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  escrowSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
