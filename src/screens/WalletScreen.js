/**
 * WalletScreen — The financial hub of the Movement OS.
 * Displays balance, integrity tier, and real-time gig history.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { GlassView } from '../components/GlassView';
import { TrustLedger } from '../services/trustLedger';
import { EscrowService } from '../services/escrowService';
import { VibeEconomyEngine } from '../services/revenueEngine';
import { useToast } from '../components/ToastNotification';
import { ReviewModal } from '../components/ReviewModal';

export const WalletScreen = ({ visible, onClose }) => {
  const { currentTheme } = useTheme();
  const { user, profile } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [sisScore, setSISScore] = useState(50);
  const [tier, setTier] = useState(null);
  const [isRoyal, setIsRoyal] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);

  const primary = currentTheme?.primary || '#00f2ff';
  const bg = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const surface = currentTheme?.surface || '#1a1f21';

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [score, history, status] = await Promise.all([
        TrustLedger.getSISScore(user.id),
        EscrowService.getUserBookings(user.id),
        VibeEconomyEngine.getSovereignStatus(user.id)
      ]);
      setSISScore(score);
      setTier(TrustLedger.getProviderTier(score));
      setBookings(history);
      setIsRoyal(status.isRoyal);
    } catch (e) {
      toast?.show('Failed to load wallet data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleRelease = async (booking) => {
    setLoading(true);
    const ok = await EscrowService.releaseToProvider(booking.id, booking.provider_id);
    if (ok) {
      toast.show('Funds released!', 'success');
      setReviewTarget(booking); // Open review modal immediately after release
      loadData();
    } else {
      toast.show('Failed to release funds', 'error');
    }
    setLoading(false);
  };

  const handleDispute = async (booking) => {
    setLoading(true);
    const ok = await EscrowService.initiateDispute(booking.id, 'Dispute from wallet history');
    if (ok) {
      toast.show('Dispute opened', 'warning');
      loadData();
    }
    setLoading(false);
  };

  const renderBooking = (item) => {
    const isProvider = item.provider_id === user.id;
    const isClient = item.client_id === user.id;
    const amount = (item.amount_cents / 100).toFixed(2);
    const date = new Date(item.created_at).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });
    const isEscrow = item.status === 'escrow_held';

    return (
      <View key={item.id} style={[s.bookingRow, { borderBottomColor: `${primary}10` }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[s.iconBox, { backgroundColor: isProvider ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)' }]}>
            <Feather
              name={isProvider ? "arrow-down-left" : "arrow-up-right"}
              size={16}
              color={isProvider ? "#10b981" : "#3b82f6"}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[s.bookingTitle, { color: textColor }]}>
              {item.service_type.toUpperCase()}
            </Text>
            <Text style={[s.bookingSub, { color: muted }]}>
              {isProvider ? `from @${item.client?.username}` : `to @${item.provider?.username}`} · {date}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[s.bookingAmount, { color: isProvider ? "#10b981" : textColor }]}>
              {isProvider ? '+' : '-'} R{amount}
            </Text>
            <View style={[s.statusBadge, { backgroundColor: item.status === 'completed' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)' }]}>
              <Text style={[s.statusText, { color: item.status === 'completed' ? "#10b981" : "#f59e0b" }]}>
                {item.status.replace('_', ' ')}
              </Text>
            </View>
          </View>
        </View>

        {isClient && isEscrow && (
          <View style={s.actionRow}>
            <TouchableOpacity
              style={[s.miniBtn, { backgroundColor: '#10b981' }]}
              onPress={() => handleRelease(item)}
            >
              <Text style={s.miniBtnText}>Release Funds</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.miniBtn, { backgroundColor: '#ef4444' }]}
              onPress={() => handleDispute(item)}
            >
              <Text style={s.miniBtnText}>Dispute</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (!visible) return null;

  return (
    <View style={[s.screen, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={22} color={primary} />
        </TouchableOpacity>
        <Text style={[s.title, { color: textColor }]}>Movement Wallet</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Feather name="refresh-cw" size={18} color={primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
      >
        {/* Vibe-Equity Card */}
        <GlassView style={s.balanceCard}>
          <Text style={[s.balanceLabel, { color: muted }]}>Vibe-Equity Balance</Text>
          <Text style={[s.balanceValue, { color: textColor }]}>{(profile?.vibe_equity || 0).toFixed(1)}</Text>
          {isRoyal && (
            <View style={{ backgroundColor: '#FFD70020', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 10 }}>
              <Text style={{ color: '#FFD700', fontSize: 10, fontWeight: '900' }}>SOVEREIGN STATUS ACTIVE</Text>
            </View>
          )}
          <View style={s.walletActions}>
            <TouchableOpacity style={[s.walletBtn, { backgroundColor: primary }]}>
              <Text style={s.walletBtnText}>STAKE EQUITY</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.walletBtnOutline, { borderColor: `${primary}50` }]}>
              <Text style={[s.walletBtnText, { color: primary }]}>MINT DETAILS</Text>
            </TouchableOpacity>
          </View>
        </GlassView>

        {/* Integrity Tier */}
        {tier && (
          <GlassView style={s.tierSection}>
            <View style={s.tierHeader}>
              <View style={[s.tierBadge, { backgroundColor: tier.color }]}>
                <Text style={s.tierBadgeText}>{tier.tier.toUpperCase()}</Text>
              </View>
              <View style={s.scoreBox}>
                <Feather name="shield" size={12} color={primary} />
                <Text style={[s.scoreValue, { color: primary }]}>{sisScore}/100</Text>
              </View>
            </View>
            <Text style={[s.tierTitle, { color: textColor }]}>Social Integrity Tier</Text>
            <Text style={[s.tierDesc, { color: muted }]}>
              Maintain a high score to unlock lower fees and priority gig matching.
            </Text>
            <View style={s.perksGrid}>
              {tier.perks.map((p, i) => (
                <View key={i} style={s.perkItem}>
                  <Feather name="check" size={12} color={primary} />
                  <Text style={[s.perkText, { color: textColor }]}>{p}</Text>
                </View>
              ))}
            </View>
          </GlassView>
        )}

        {/* History */}
        <View style={s.historySection}>
          <Text style={[s.sectionLabel, { color: muted }]}>RECENT GIGS</Text>
          {loading ? (
            <ActivityIndicator color={primary} style={{ marginTop: 40 }} />
          ) : bookings.length === 0 ? (
            <View style={s.emptyState}>
              <MaterialCommunityIcons name="wallet-outline" size={48} color={muted} style={{ opacity: 0.3 }} />
              <Text style={{ color: muted, marginTop: 12 }}>No transactions yet</Text>
            </View>
          ) : (
            <View style={[s.historyList, { backgroundColor: surface }]}>
              {bookings.map(renderBooking)}
            </View>
          )}
        </View>
      </ScrollView>

      <ReviewModal
        visible={!!reviewTarget}
        booking={reviewTarget}
        onClose={() => setReviewTarget(null)}
        onReviewSubmitted={() => {
          toast.show('Review shared with the kingdom!', 'success');
          loadData();
        }}
      />
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1, paddingTop: Platform.OS === 'ios' ? 50 : 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15 },
  title: { fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  balanceCard: { margin: 16, padding: 24, borderRadius: 28, alignItems: 'center' },
  balanceLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  balanceValue: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  walletActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  walletBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  walletBtnOutline: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, borderWidth: 1 },
  walletBtnText: { color: '#000', fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },
  tierSection: { margin: 16, padding: 20, borderRadius: 24 },
  tierHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  tierBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  tierBadgeText: { color: '#000', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  scoreBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  scoreValue: { fontSize: 13, fontWeight: '800' },
  tierTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  tierDesc: { fontSize: 12, lineHeight: 18, marginBottom: 16 },
  perksGrid: { gap: 8 },
  perkItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  perkText: { fontSize: 11, fontWeight: '600' },
  historySection: { padding: 16 },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12, marginLeft: 4 },
  historyList: { borderRadius: 24, overflow: 'hidden' },
  bookingRow: { padding: 16, borderBottomWidth: 1 },
  iconBox: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bookingTitle: { fontSize: 13, fontWeight: '800' },
  bookingSub: { fontSize: 11, marginTop: 2 },
  bookingAmount: { fontSize: 14, fontWeight: '900' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4 },
  statusText: { fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12, paddingLeft: 48 },
  miniBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  miniBtnText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  emptyState: { alignItems: 'center', marginTop: 60, opacity: 0.6 }
});
