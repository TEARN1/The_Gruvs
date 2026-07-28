/**
 * WalletScreen — The financial hub of the Movement OS.
 * Displays balance, integrity tier, and real-time gig history.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Platform, Animated, TextInput, ActivityIndicator, Linking, Modal } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { GlassView } from '../components/GlassView';
import { supabase } from '../services/supabase';
import { APP_WEB_URL } from '../constants/appUrl';
import { resilientRead } from '../utils/resilience';
import { TrustLedger } from '../services/trustLedger';
import { EscrowService } from '../services/escrowService';
import { VibeEconomyEngine } from '../services/revenueEngine';
import { useToast } from '../components/ToastNotification';
import { ReviewModal } from '../components/ReviewModal';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useBackClose } from '../hooks/useBackClose';
import { money } from '../constants/currencies';
import { MonetizationService } from '../services/monetizationService';

const WalletSkeleton = ({ primary }) => {
  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);
  return (
    <Animated.View style={{ opacity: pulse, gap: 10, marginTop: 8 }}>
      {[1, 2, 3].map(i => (
        <View key={i} style={{ height: 64, borderRadius: 12, backgroundColor: `${primary}10` }} />
      ))}
    </Animated.View>
  );
};

export const WalletScreen = ({ visible, onClose }) => {
  useBackClose(visible, onClose);
  const { currentTheme } = useTheme();
  const { user, profile } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState('gigs');
  const [sisScore, setSISScore] = useState(50);
  const [tier, setTier] = useState(null);
  const [isRoyal, setIsRoyal] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [coins, setCoins] = useState(0);
  const [diamonds, setDiamonds] = useState(0);
  const [cashouts, setCashouts] = useState([]);
  const [cashoutAmount, setCashoutAmount] = useState('');
  const [cashingOut, setCashingOut] = useState(false);
  const [cashoutModalOpen, setCashoutModalOpen] = useState(false);

  const primary = currentTheme?.primary || "#00f2ff";
  const bg = currentTheme?.background || "#0d1112";
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const surface = currentTheme?.surface || "#1a1f21";

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [score, history, status, transactions, coinsBal, diamondsBal, cashoutHistory] = await Promise.all([
        TrustLedger.getSISScore(user.id).catch(() => 0),
        EscrowService.getUserBookings(user.id).catch(() => []),
        VibeEconomyEngine.getSovereignStatus(user.id).catch(() => ({ isRoyal: false })),
        resilientRead(
          async () => {
            const { data, error } = await supabase.from('wallet_transactions').select('*').eq('user_id', user?.id).order('created_at', { ascending: false }).limit(50);
            if (error) throw error;
            return data;
          },
          async () => {
            const { data, error } = await supabase.from('wallet_transactions').select('id, amount, direction, created_at, reason').eq('user_id', user?.id).order('created_at', { ascending: false }).limit(50);
            if (error) throw error;
            return data;
          },
          async () => [],
          [],
          'WalletScreen.transactions'
        ),
        MonetizationService.getCoinBalance(user.id).catch(() => 0),
        MonetizationService.getDiamondBalance(user.id).catch(() => 0),
        MonetizationService.getCashoutHistory(user.id).catch(() => []),
      ]);
      setSISScore(score);
      setTier(TrustLedger.getProviderTier(score));
      setBookings(history);
      setIsRoyal(status.isRoyal);
      setTransactions(transactions || []);
      setCoins(coinsBal);
      setDiamonds(diamondsBal);
      setCashouts(cashoutHistory || []);
    } catch (e) {
      toast?.show('Failed to load wallet data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleRelease = async (booking) => {
    setLoading(true);
    try {
      const ok = await EscrowService.releaseToProvider(booking.id, booking.provider_id);
      if (ok) {
        toast.show('Funds released!', 'success');
        setReviewTarget(booking);
        loadData();
      } else {
        toast.show('Failed to release funds', 'error');
      }
    } catch {
      toast.show('Failed to release funds', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDispute = async (booking) => {
    if (!user) return;
    setLoading(true);
    try {
      const ok = await EscrowService.initiateDispute(booking.id, 'Dispute from wallet history', user.id);
      if (ok) {
        toast.show('Dispute opened', 'warning');
        loadData();
      }
    } catch {
      toast.show('Could not open dispute', 'error');
    } finally {
      setLoading(false);
    }
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
              {(item.service_type || 'Service').toUpperCase()}
            </Text>
            <Text style={[s.bookingSub, { color: muted }]}>
              {isProvider ? `from ${item.client?.username}` : `to ${item.provider?.username}`} · {date}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[s.bookingAmount, { color: isProvider ? "#10b981" : textColor }]}>
              {isProvider ? '+' : '-'} {money(amount)}
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
              style={[s.miniBtn, { backgroundColor: "#10b981" }]}
              onPress={() => handleRelease(item)}
            >
              <Text style={s.miniBtnText}>Release Funds</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.miniBtn, { backgroundColor: "#ef4444" }]}
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
    <ErrorBoundary label="Wallet">
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
        {/* Vibe Score Card */}
        <GlassView style={s.balanceCard}>
          <Text style={[s.balanceLabel, { color: muted }]}>Vibe Score Balance</Text>
          <Text style={[s.balanceValue, { color: textColor }]}>{(profile?.vibe_score || 0).toFixed(1)}</Text>
          {isRoyal && (
            <View style={{ backgroundColor: '#FFD70020', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 10 }}>
              <Text style={{ color: "#FFD700", fontSize: 10, fontWeight: '900' }}>SOVEREIGN STATUS ACTIVE</Text>
            </View>
          )}
          <View style={s.walletActions}>
            <TouchableOpacity
              style={[s.walletBtn, { backgroundColor: primary }]}
              onPress={() => toast.show('Upgrade to Royal tier with Vibe Score >= 1000', 'info')}
            >
              <Text style={s.walletBtnText}>UPGRADE TIER</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.walletBtnOutline, { borderColor: `${primary}50` }]}
              onPress={() => toast.show(`Vibe Score: ${profile?.vibe_score || 0} · Tier: ${tier?.tier || 'Standard'}`, 'info')}
            >
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

        {/* Tab bar */}
        <View style={[s.tabBar, { borderBottomColor: `${primary}18` }]}>
          {[
            { key: 'gigs', label: 'Gigs', icon: 'briefcase' },
            { key: 'xp', label: 'XP Ledger', icon: 'zap' },
            { key: 'gifting', label: 'Gifting & Earnings', icon: 'gift' }
          ].map(t => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setActiveTab(t.key)}
              style={[s.tabBtn, activeTab === t.key && { borderBottomColor: primary, borderBottomWidth: 2 }]}
            >
              <Feather name={t.icon} size={13} color={activeTab === t.key ? primary : muted} />
              <Text style={[s.tabLabel, { color: activeTab === t.key ? primary : muted }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Gigs history */}
        {activeTab === 'gigs' && (
          <View style={s.historySection}>
            <Text style={[s.sectionLabel, { color: muted }]}>RECENT GIGS</Text>
            {loading ? (
              <WalletSkeleton primary={primary} />
            ) : bookings.length === 0 ? (
              <View style={s.emptyState}>
                <MaterialCommunityIcons name="wallet-outline" size={48} color={muted} style={{ opacity: 0.3 }} />
                <Text style={{ color: muted, marginTop: 12 }}>No gigs yet</Text>
              </View>
            ) : (
              <View style={[s.historyList, { backgroundColor: surface }]}>
                {bookings.map(renderBooking)}
              </View>
            )}
          </View>
        )}

        {/* XP / vibe-equity transaction ledger */}
        {activeTab === 'xp' && (
          <View style={s.historySection}>
            <Text style={[s.sectionLabel, { color: muted }]}>VIBE-EQUITY LEDGER</Text>
            {loading ? (
              <WalletSkeleton primary={primary} />
            ) : transactions.length === 0 ? (
              <View style={s.emptyState}>
                <Feather name="activity" size={40} color={muted} style={{ opacity: 0.3 }} />
                <Text style={{ color: muted, marginTop: 12 }}>No economy activity yet</Text>
              </View>
            ) : (
              <View style={[s.historyList, { backgroundColor: surface }]}>
                {transactions.map(t => {
                  const isCredit = t.direction === 'credit';
                  const date = new Date(t.created_at).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });
                  return (
                    <View key={t.id} style={[s.bookingRow, { borderBottomColor: `${primary}10` }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={[s.iconBox, { backgroundColor: isCredit ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }]}>
                          <Feather name={isCredit ? 'arrow-down-left' : 'arrow-up-right'} size={16} color={isCredit ? "#10b981" : "#ef4444"} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={[s.bookingTitle, { color: textColor }]}>{t.reason?.replace(/_/g, ' ').toUpperCase()}</Text>
                          <Text style={[s.bookingSub, { color: muted }]}>{date}</Text>
                        </View>
                        <Text style={[s.bookingAmount, { color: isCredit ? "#10b981" : "#ef4444" }]}>
                          {isCredit ? '+' : '-'}{t.amount.toFixed(1)} VE
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Gifting & Earnings Tab */}
        {activeTab === 'gifting' && (
          <View style={s.historySection}>
            <Text style={[s.sectionLabel, { color: muted }]}>VIRTUAL WALLET & EARNINGS</Text>
            
            {/* Coins Balance Box */}
            <GlassView style={[s.giftingCard, { borderColor: `${primary}20` }]}>
              <View style={s.giftCardRow}>
                <View>
                  <Text style={[s.giftLabel, { color: muted }]}>Vibe Coins</Text>
                  <View style={s.giftBalanceRow}>
                    <Feather name="database" size={20} color={primary} style={{ marginRight: 6 }} />
                    <Text style={[s.giftValue, { color: textColor }]}>{coins}</Text>
                  </View>
                  <Text style={{ color: muted, fontSize: 11, marginTop: 4 }}>Used to send virtual gifts to hosts</Text>
                </View>
                <TouchableOpacity
                  style={[s.giftingActionBtn, { backgroundColor: primary }]}
                  onPress={() => {
                    const checkoutUrl = `${APP_WEB_URL}/buy-coins?uid=${user?.id || ''}`;
                    Linking.openURL(checkoutUrl).catch(() => {
                      toast?.show('Could not open web payment portal.', 'error');
                    });
                  }}
                >
                  <Text style={s.giftingActionBtnText}>TOP UP</Text>
                </TouchableOpacity>
              </View>
            </GlassView>

            {/* Diamonds Balance Box */}
            <GlassView style={[s.giftingCard, { borderColor: `${primary}20`, marginTop: 16 }]}>
              <View style={s.giftCardRow}>
                <View>
                  <Text style={[s.giftLabel, { color: muted }]}>Diamonds Earned</Text>
                  <View style={s.giftBalanceRow}>
                    <MaterialCommunityIcons name="diamond-stone" size={20} color="#ff00a0" style={{ marginRight: 6 }} />
                    <Text style={[s.giftValue, { color: textColor }]}>{diamonds.toFixed(1)}</Text>
                  </View>
                  <Text style={{ color: muted, fontSize: 11, marginTop: 4 }}>
                    Est. Value: {money((diamonds * 0.18).toFixed(2))}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[s.giftingActionBtn, { backgroundColor: '#ff00a0', opacity: diamonds > 0 ? 1 : 0.5 }]}
                  disabled={diamonds <= 0}
                  onPress={() => setCashoutModalOpen(true)}
                >
                  <Text style={[s.giftingActionBtnText, { color: '#fff' }]}>CASH OUT</Text>
                </TouchableOpacity>
              </View>
            </GlassView>

            {/* Cashout/Withdrawal History */}
            <Text style={[s.sectionLabel, { color: muted, marginTop: 24 }]}>CASHOUT HISTORY</Text>
            {loading ? (
              <WalletSkeleton primary={primary} />
            ) : cashouts.length === 0 ? (
              <View style={s.emptyState}>
                <Feather name="list" size={40} color={muted} style={{ opacity: 0.3 }} />
                <Text style={{ color: muted, marginTop: 12 }}>No cashout requests yet</Text>
              </View>
            ) : (
              <View style={[s.historyList, { backgroundColor: surface }]}>
                {cashouts.map(c => {
                  const date = new Date(c.created_at).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });
                  const statusColors = {
                    pending: '#f59e0b',
                    processing: '#3b82f6',
                    completed: '#10b981',
                    failed: '#ef4444'
                  };
                  const statusColor = statusColors[c.status] || muted;
                  return (
                    <View key={c.id} style={[s.bookingRow, { borderBottomColor: `${primary}10` }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={[s.iconBox, { backgroundColor: 'rgba(255,0,160,0.1)' }]}>
                          <Feather name="arrow-up-right" size={16} color="#ff00a0" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={[s.bookingTitle, { color: textColor }]}>WITHDRAWAL</Text>
                          <Text style={[s.bookingSub, { color: muted }]}>{date} · {c.diamond_amount} Diamonds</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[s.bookingAmount, { color: textColor }]}>
                            {money(c.fiat_amount)}
                          </Text>
                          <View style={[s.statusBadge, { backgroundColor: `${statusColor}20` }]}>
                            <Text style={[s.statusText, { color: statusColor }]}>
                              {c.status}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
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

      {/* Cashout Request Modal */}
      <Modal visible={cashoutModalOpen} transparent animationType="fade" onRequestClose={() => setCashoutModalOpen(false)}>
        <View style={s.modalOverlay}>
          <GlassView style={[s.modalCard, { backgroundColor: `${bg}F9`, borderColor: `${primary}33` }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: textColor }]}>Request Cash Out</Text>
              <TouchableOpacity onPress={() => setCashoutModalOpen(false)}>
                <Feather name="x" size={20} color={textColor} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: muted, fontSize: 13, marginBottom: 15 }}>
              Enter the number of diamonds you want to convert to ZAR. Min withdrawal is 100 diamonds ({money(18)}).
            </Text>

            <View style={[s.inputWrap, { borderColor: `${primary}40`, backgroundColor: `${textColor}05` }]}>
              <MaterialCommunityIcons name="diamond-stone" size={18} color="#ff00a0" style={{ marginRight: 8 }} />
              <TextInput
                style={[s.input, { color: textColor }]}
                placeholder="0"
                placeholderTextColor={muted}
                keyboardType="numeric"
                value={cashoutAmount}
                onChangeText={setCashoutAmount}
              />
            </View>

            {!!cashoutAmount && !isNaN(parseFloat(cashoutAmount)) && (
              <Text style={{ color: primary, fontSize: 13, marginTop: 8, fontWeight: '700' }}>
                You will receive: {money((parseFloat(cashoutAmount) * 0.18).toFixed(2))}
              </Text>
            )}

            <TouchableOpacity
              style={[s.submitBtn, { backgroundColor: primary, opacity: cashingOut ? 0.7 : 1 }]}
              onPress={async () => {
                const amt = parseFloat(cashoutAmount);
                if (isNaN(amt) || amt < 100) {
                  toast.show('Minimum cash out is 100 diamonds.', 'warning');
                  return;
                }
                if (amt > diamonds) {
                  toast.show('Insufficient diamond balance.', 'warning');
                  return;
                }
                setCashingOut(true);
                try {
                  const res = await MonetizationService.requestCashout(user.id, amt);
                  if (res.success) {
                    toast.show(`Cashout request submitted: ${money(res.fiatAmount)}`, 'success');
                    setCashoutAmount('');
                    setCashoutModalOpen(false);
                    loadData();
                  } else {
                    toast.show(res.error || 'Failed to submit request.', 'error');
                  }
                } catch {
                  toast.show('Error submitting cashout request.', 'error');
                } finally {
                  setCashingOut(false);
                }
              }}
              disabled={cashingOut}
            >
              {cashingOut ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={s.submitBtnText}>Submit Request</Text>
              )}
            </TouchableOpacity>
          </GlassView>
        </View>
      </Modal>
    </View>

    </ErrorBoundary>
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
  emptyState: { alignItems: 'center', marginTop: 60, opacity: 0.6 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, marginHorizontal: 0 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  tabLabel: { fontSize: 12, fontWeight: '800' },
  giftingCard: { padding: 18, borderRadius: 20, borderWidth: 1, marginTop: 8 },
  giftCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  giftLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  giftBalanceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  giftValue: { fontSize: 24, fontWeight: '900' },
  giftingActionBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  giftingActionBtnText: { color: '#000', fontWeight: '900', fontSize: 11, letterSpacing: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 360, padding: 22, borderRadius: 24, borderWidth: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 16, fontWeight: '900' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 48 },
  input: { flex: 1, fontSize: 16, fontWeight: '700', paddingVertical: 0 },
  submitBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  submitBtnText: { color: '#000', fontWeight: '900', fontSize: 14 },
});
