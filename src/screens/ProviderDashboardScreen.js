/**
 * ProviderDashboardScreen — Dedicated hub for Service Nodes.
 * Tracks earnings, ratings, SIS score, and active gigs.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions, Platform, Switch, Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { GlassView } from '../components/GlassView';
import { AnalyticsManager } from '../services/dataFlow';
import { TrustLedger } from '../services/trustLedger';
import { ProviderSetupModal } from '../components/ProviderSetupModal';
import { supabase } from '../services/supabase';
import { useToast } from '../components/ToastNotification';
import { ErrorBoundary } from '../components/ErrorBoundary';

const { width: SW } = Dimensions.get('window');

const MiniChart = ({ data, color, textColor, muted }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <View style={s.chartRow}>
      {data.map((d, i) => (
        <View key={i} style={s.chartCol}>
          <View style={[s.chartBar, { height: `${(d.value / max) * 80 + 5}%`, backgroundColor: color }]} />
          <Text style={[s.chartTick, { color: muted }]}>{d.tick}</Text>
        </View>
      ))}
    </View>
  );
};

const ProviderSkeleton = ({ primary }) => {
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
    <Animated.View style={{ opacity: pulse, padding: 16, gap: 12, flex: 1 }}>
      <View style={{ height: 100, borderRadius: 14, backgroundColor: `${primary}12` }} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1, height: 70, borderRadius: 12, backgroundColor: `${primary}10` }} />
        <View style={{ flex: 1, height: 70, borderRadius: 12, backgroundColor: `${primary}10` }} />
      </View>
      {[1, 2, 3].map(i => (
        <View key={i} style={{ height: 64, borderRadius: 12, backgroundColor: `${primary}08` }} />
      ))}
    </Animated.View>
  );
};

export const ProviderDashboardScreen = ({ visible, onClose }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [sisScore, setSISScore] = useState(50);
  const [setupVisible, setSetupVisible] = useState(false);
  const [togglingAvail, setTogglingAvail] = useState(false);

  const primary = currentTheme?.primary || "#00f2ff";
  const bg = currentTheme?.background || "#0d1112";
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const surface = currentTheme?.surface || "#1a1f21";

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [sRes, scoreRes] = await Promise.allSettled([
        AnalyticsManager.getProviderStats(user.id),
        TrustLedger.getSISScore(user.id)
      ]);
      if (sRes.status === 'fulfilled') setStats(sRes.value);
      if (scoreRes.status === 'fulfilled') setSISScore(scoreRes.value);
    } catch (e) {
      toast.show('Failed to load provider stats', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, toast]);

  const toggleAvailability = useCallback(async () => {
    if (!user || togglingAvail) return;
    const newVal = !stats?.isAvailable;
    setTogglingAvail(true);
    setStats(prev => prev ? { ...prev, isAvailable: newVal } : prev);
    try {
      const { error } = await supabase
        .from('service_nodes')
        .upsert({ user_id: user?.id, available: newVal, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (error) {
        setStats(prev => prev ? { ...prev, isAvailable: !newVal } : prev);
        toast.show('Failed to update status', 'error');
      } else {
        toast.show(newVal ? "You're now Open for Business!" : 'Status set to Offline', 'success');
      }
    } catch {
      setStats(prev => prev ? { ...prev, isAvailable: !newVal } : prev);
      toast.show('Failed to update status', 'error');
    } finally {
      setTogglingAvail(false);
    }
  }, [user, stats?.isAvailable, togglingAvail]);

  useEffect(() => {
    if (visible) loadData();
  }, [visible, loadData]);

  if (!visible) return null;

  return (
    <ErrorBoundary label="Provider Dashboard">
    <View style={[s.screen, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={22} color={primary} />
        </TouchableOpacity>
        <Text style={[s.title, { color: textColor }]}>Provider Hub</Text>
        <TouchableOpacity onPress={() => setSetupVisible(true)}>
          <Feather name="settings" size={18} color={primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ProviderSkeleton primary={primary} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={primary} />}
        >
          {/* Main Earnings Card */}
          <GlassView style={s.mainCard}>
            <View style={s.mainRow}>
              <View>
                <Text style={[s.label, { color: muted }]}>NET EARNINGS</Text>
                <Text style={[s.earningsVal, { color: textColor }]}>
                  R{(stats?.totalEarnings ?? 0).toFixed(2)}
                </Text>
                {stats?.completedCount === 0 && (
                  <Text style={[s.earningsHint, { color: muted }]}>Complete gigs to earn</Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 8 }}>
                <TouchableOpacity
                  onPress={toggleAvailability}
                  disabled={togglingAvail}
                  style={[s.statusBadge, { backgroundColor: stats?.isAvailable ? '#10b98120' : '#ef444420', borderColor: stats?.isAvailable ? "#10b981" : "#ef4444" }]}
                  activeOpacity={0.7}
                >
                  {togglingAvail
                    ? <ActivityIndicator size={10} color={stats?.isAvailable ? "#10b981" : "#ef4444"} />
                    : <Text style={[s.statusText, { color: stats?.isAvailable ? "#10b981" : "#ef4444" }]}>
                        {stats?.isAvailable ? '● OPEN FOR BUSINESS' : '● OFFLINE'}
                      </Text>
                  }
                </TouchableOpacity>
                <Text style={[{ fontSize: 9, color: muted }]}>Tap to toggle</Text>
              </View>
            </View>

            {!stats?.serviceType || stats.serviceType === 'General' ? (
              <TouchableOpacity
                onPress={() => setSetupVisible(true)}
                style={[s.setupCta, { borderColor: `${primary}40`, backgroundColor: `${primary}10` }]}
              >
                <Feather name="plus-circle" size={14} color={primary} />
                <Text style={[s.setupCtaText, { color: primary }]}>Set up your provider profile to start earning</Text>
              </TouchableOpacity>
            ) : (
              <MiniChart data={stats?.earningsChart || []} color={primary} textColor={textColor} muted={muted} />
            )}
          </GlassView>

          {/* Stats Grid */}
          <View style={s.grid}>
            <GlassView style={s.gridItem}>
              <Feather name="star" size={16} color="#FFD700" />
              <Text style={[s.gridVal, { color: textColor }]}>{stats?.avgRating}</Text>
              <Text style={[s.gridLab, { color: muted }]}>Avg Rating ({stats?.reviewCount})</Text>
            </GlassView>
            <GlassView style={s.gridItem}>
              <Feather name="shield" size={16} color={primary} />
              <Text style={[s.gridVal, { color: textColor }]}>{sisScore}</Text>
              <Text style={[s.gridLab, { color: muted }]}>Integrity Score</Text>
            </GlassView>
            <GlassView style={s.gridItem}>
              <Feather name="check-circle" size={16} color="#10b981" />
              <Text style={[s.gridVal, { color: textColor }]}>{stats?.completedCount}</Text>
              <Text style={[s.gridLab, { color: muted }]}>Gigs Completed</Text>
            </GlassView>
            <GlassView style={s.gridItem}>
              <Feather name="tool" size={16} color={primary} />
              <Text style={[s.gridVal, { color: textColor }]} numberOfLines={1}>{stats?.serviceType}</Text>
              <Text style={[s.gridLab, { color: muted }]}>Service Class</Text>
            </GlassView>
          </View>

          {/* Recent Reviews */}
          <View style={s.section}>
            <Text style={[s.sectionLabel, { color: muted }]}>RECENT FEEDBACK</Text>
            {stats?.recentReviews?.length === 0 ? (
              <Text style={[s.emptyText, { color: muted }]}>No reviews yet. Complete gigs to earn feedback!</Text>
            ) : (
              stats?.recentReviews.map((rev, i) => (
                <GlassView key={i} style={s.reviewCard}>
                  <View style={s.reviewHeader}>
                    <Text style={[s.reviewer, { color: primary }]}>@{rev.reviewer?.username}</Text>
                    <View style={s.starRating}>
                      {[1,2,3,4,5].map(n => (
                        <Feather key={n} name="star" size={10} color={n <= rev.rating ? "#FFD700" : muted} fill={n <= rev.rating ? "#FFD700" : "transparent"} />
                      ))}
                    </View>
                  </View>
                  <Text style={[s.comment, { color: textColor }]}>"{rev.comment}"</Text>
                  <Text style={[s.revDate, { color: muted }]}>
                    {new Date(rev.created_at).toLocaleDateString()}
                  </Text>
                </GlassView>
              ))
            )}
          </View>
        </ScrollView>
      )}

      <ProviderSetupModal
        visible={setupVisible}
        onClose={() => setSetupVisible(false)}
        onSaveSuccess={() => {
          toast.show('Settings updated', 'success');
          loadData();
        }}
      />
    </View>

    </ErrorBoundary>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1, paddingTop: Platform.OS === 'ios' ? 50 : 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15 },
  title: { fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mainCard: { margin: 16, padding: 20, borderRadius: 24 },
  mainRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  earningsVal: { fontSize: 32, fontWeight: '900', marginTop: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, minWidth: 60, alignItems: 'center' },
  statusText: { fontSize: 9, fontWeight: '900' },
  earningsHint: { fontSize: 10, marginTop: 2 },
  setupCta: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 12 },
  setupCtaText: { fontSize: 12, fontWeight: '700', flex: 1 },
  chartRow: { flexDirection: 'row', height: 80, alignItems: 'flex-end', gap: 6 },
  chartCol: { flex: 1, alignItems: 'center' },
  chartBar: { width: '100%', borderRadius: 4, minHeight: 4 },
  chartTick: { fontSize: 8, marginTop: 4, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16 },
  gridItem: { width: (SW - 44) / 2, padding: 16, borderRadius: 20, gap: 4 },
  gridVal: { fontSize: 18, fontWeight: '900' },
  gridLab: { fontSize: 10, fontWeight: '700' },
  section: { padding: 16, marginTop: 10 },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12, marginLeft: 4 },
  reviewCard: { padding: 16, borderRadius: 16, marginBottom: 10, gap: 8 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewer: { fontSize: 13, fontWeight: '800' },
  starRating: { flexDirection: 'row', gap: 2 },
  comment: { fontSize: 13, lineHeight: 18, fontStyle: 'italic' },
  revDate: { fontSize: 10, textAlign: 'right' },
  emptyText: { textAlign: 'center', fontSize: 12, marginTop: 20, opacity: 0.6 }
});
