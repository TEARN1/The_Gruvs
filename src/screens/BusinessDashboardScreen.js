/**
 * BusinessDashboardScreen — Full business hub for hosters & vendors.
 * Tabs: Overview · Store · Campaigns · Audience · Analytics · Finance · Ecosystem
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated,
  TextInput, ActivityIndicator, RefreshControl, Dimensions, Modal, Switch,
  Alert, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { GlassView } from '../components/GlassView';
import { BusinessStoreBuilder } from './BusinessStoreBuilder';
import { CampaignBuilderModal } from '../components/CampaignBuilderModal';

const { width: SW } = Dimensions.get('window');

const TABS = [
  { key: 'overview',    label: 'Overview',   icon: 'grid'         },
  { key: 'store',       label: 'Store',      icon: 'layout'       },
  { key: 'campaigns',   label: 'Campaigns',  icon: 'target'       },
  { key: 'audience',    label: 'Audience',   icon: 'users'        },
  { key: 'analytics',   label: 'Analytics',  icon: 'bar-chart-2'  },
  { key: 'finance',     label: 'Finance',    icon: 'dollar-sign'  },
  { key: 'ecosystem',   label: 'Ecosystem',  icon: 'globe'        },
];

const BUSINESS_TYPES = [
  'Event Organiser', 'Music Venue', 'Restaurant/Bar', 'Fashion Brand',
  'Transport Provider', 'Photography', 'Catering', 'DJ / Artist',
  'Sponsor', 'Retail', 'Tech/App', 'Fitness', 'Education', 'Other',
];

const TIERS = {
  starter:    { label: 'Starter',    color: '#94a3b8', perks: ['5 campaigns/mo', 'Basic analytics', '500 targets/campaign'] },
  pro:        { label: 'Pro',        color: '#06b6d4', perks: ['Unlimited campaigns', 'Advanced analytics', '10K targets/campaign', 'Store builder'] },
  royal:      { label: 'Royal',      color: '#8b5cf6', perks: ['Everything in Pro', 'API access', 'Sponsorship marketplace', 'Priority support', 'Custom domain'] },
  enterprise: { label: 'Enterprise', color: '#f59e0b', perks: ['Everything in Royal', 'Dedicated account manager', 'Custom integrations', 'White-label store', 'Bulk campaign tools'] },
};

// ── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, icon, color, trend, primary, textColor, muted, bg }) => (
  <GlassView style={[sc.statCard, { borderColor: `${color}25` }]}>
    <View style={[sc.statIcon, { backgroundColor: `${color}18` }]}>
      <Feather name={icon} size={18} color={color} />
    </View>
    <Text style={[sc.statValue, { color: textColor }]}>{value}</Text>
    <Text style={[sc.statLabel, { color: muted }]}>{label}</Text>
    {sub ? <Text style={[sc.statSub, { color: color }]}>{sub}</Text> : null}
    {trend != null ? (
      <View style={sc.trendRow}>
        <Feather name={trend >= 0 ? 'trending-up' : 'trending-down'} size={10} color={trend >= 0 ? '#10b981' : '#ef4444'} />
        <Text style={{ fontSize: 9, color: trend >= 0 ? '#10b981' : '#ef4444', fontWeight: '700' }}> {Math.abs(trend)}%</Text>
      </View>
    ) : null}
  </GlassView>
);

// ── Mini Bar Chart ────────────────────────────────────────────────────────────
const MiniBarChart = ({ data, color, label, textColor, muted }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <View style={sc.chartWrap}>
      <Text style={[sc.chartLabel, { color: muted }]}>{label}</Text>
      <View style={sc.barsRow}>
        {data.map((d, i) => (
          <View key={i} style={sc.barCol}>
            <View style={sc.barTrack}>
              <View style={[sc.barFill, { height: `${(d.value / max) * 100}%`, backgroundColor: color }]} />
            </View>
            <Text style={[sc.barTick, { color: muted }]}>{d.tick}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// ── Campaign Row ──────────────────────────────────────────────────────────────
const CampaignRow = ({ campaign, primary, textColor, muted, onEdit, onToggle }) => {
  const statusColor = { active: '#10b981', paused: '#f59e0b', draft: '#94a3b8', ended: '#ef4444' }[campaign.status] || '#94a3b8';
  const roi = campaign.budget_spent > 0 ? ((campaign.revenue_attributed / campaign.budget_spent - 1) * 100).toFixed(0) : '—';
  const ctr = campaign.impressions > 0 ? ((campaign.clicks / campaign.impressions) * 100).toFixed(1) : '0';
  return (
    <GlassView style={[sc.campaignRow, { borderColor: `${statusColor}20` }]}>
      <View style={sc.campaignTop}>
        <View style={{ flex: 1 }}>
          <Text style={[sc.campName, { color: textColor }]} numberOfLines={1}>{campaign.name}</Text>
          <View style={sc.campMeta}>
            <View style={[sc.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[sc.campStatus, { color: statusColor }]}>{campaign.status?.toUpperCase()}</Text>
            <Text style={[sc.campType, { color: muted }]}>· {campaign.campaign_type}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onEdit} style={[sc.campEdit, { borderColor: `${primary}30` }]}>
          <Feather name="edit-2" size={12} color={primary} />
        </TouchableOpacity>
      </View>
      <View style={sc.campStats}>
        {[
          { label: 'Reach', value: (campaign.impressions || 0).toLocaleString() },
          { label: 'Clicks', value: (campaign.clicks || 0).toLocaleString() },
          { label: 'CTR', value: `${ctr}%` },
          { label: 'ROI', value: roi === '—' ? '—' : `${roi}%` },
          { label: 'Spent', value: `R${(campaign.budget_spent || 0).toFixed(0)}` },
        ].map(s => (
          <View key={s.label} style={sc.campStat}>
            <Text style={[sc.campStatVal, { color: textColor }]}>{s.value}</Text>
            <Text style={[sc.campStatLbl, { color: muted }]}>{s.label}</Text>
          </View>
        ))}
      </View>
      {campaign.targeting?.event_phases?.length > 0 && (
        <View style={sc.phasesRow}>
          {campaign.targeting.event_phases.map(p => (
            <View key={p} style={[sc.phaseTag, { backgroundColor: `${primary}15`, borderColor: `${primary}30` }]}>
              <Text style={[sc.phaseText, { color: primary }]}>{p.replace('_', ' ').toUpperCase()}</Text>
            </View>
          ))}
        </View>
      )}
    </GlassView>
  );
};

// ── Partner Row ───────────────────────────────────────────────────────────────
const PartnerRow = ({ partner, primary, textColor, muted }) => {
  const statusColor = { active: '#10b981', pending: '#f59e0b', ended: '#94a3b8' }[partner.status] || '#94a3b8';
  return (
    <GlassView style={[sc.partnerRow, { borderColor: `${primary}15` }]}>
      <View style={[sc.partnerIcon, { backgroundColor: `${primary}15` }]}>
        <Feather name="link-2" size={16} color={primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[sc.partnerName, { color: textColor }]}>{partner.partner_name}</Text>
        <Text style={[sc.partnerType, { color: muted }]}>{partner.partner_type} · Rev share {partner.revenue_share || 0}%</Text>
      </View>
      <View style={[sc.partnerStatus, { backgroundColor: `${statusColor}18` }]}>
        <Text style={[sc.partnerStatusText, { color: statusColor }]}>{partner.status?.toUpperCase()}</Text>
      </View>
    </GlassView>
  );
};

// ── Funnel Bar ────────────────────────────────────────────────────────────────
const FunnelBar = ({ label, value, max, color, textColor, muted }) => (
  <View style={sc.funnelRow}>
    <Text style={[sc.funnelLabel, { color: muted }]}>{label}</Text>
    <View style={sc.funnelTrack}>
      <View style={[sc.funnelFill, { width: `${Math.min(100, (value / Math.max(max, 1)) * 100)}%`, backgroundColor: color }]} />
    </View>
    <Text style={[sc.funnelVal, { color: textColor }]}>{value?.toLocaleString()}</Text>
  </View>
);

// ──────────────────────────────────────────────────────────────────────────────
export const BusinessDashboardScreen = ({ onClose }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#ffffff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface    || 'rgba(255,255,255,0.05)';

  const [activeTab, setActiveTab]         = useState('overview');
  const [biz, setBiz]                     = useState(null);
  const [campaigns, setCampaigns]         = useState([]);
  const [partners, setPartners]           = useState([]);
  const [segments, setSegments]           = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [analytics, setAnalytics]         = useState(null);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [showCampaignBuilder, setShowCampaignBuilder] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [setupMode, setSetupMode]         = useState(false);
  const [setupForm, setSetupForm]         = useState({ business_name: '', business_type: '', tagline: '', description: '', website: '', phone: '' });
  const tabScrollRef = useRef(null);
  const headerAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadAll();
    Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Load or create business profile
      const { data: bizData } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!bizData) { setSetupMode(true); setLoading(false); return; }
      setBiz(bizData);

      // Parallel data fetch
      const [campRes, partRes, segRes, notifRes, analyticsRes] = await Promise.all([
        supabase.from('ad_campaigns').select('*').eq('business_id', bizData.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('business_partnerships').select('*').eq('business_id', bizData.id).order('created_at', { ascending: false }),
        supabase.from('audience_segments').select('*').eq('business_id', bizData.id).order('created_at', { ascending: false }),
        supabase.from('business_notifications').select('*').eq('business_id', bizData.id).eq('read', false).order('created_at', { ascending: false }).limit(10),
        supabase.from('campaign_analytics').select('event_type, created_at').eq('business_id', bizData.id).gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
      ]);

      setCampaigns(campRes.data || []);
      setPartners(partRes.data || []);
      setSegments(segRes.data || []);
      setNotifications(notifRes.data || []);

      // Build analytics summary from raw events
      const raw = analyticsRes.data || [];
      const impressions = raw.filter(e => e.event_type === 'impression').length;
      const clicks      = raw.filter(e => e.event_type === 'click').length;
      const conversions = raw.filter(e => e.event_type === 'conversion').length;
      const rsvps       = raw.filter(e => e.event_type === 'rsvp').length;

      // Build 7-day chart from campaigns
      const today = new Date();
      const chart = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today); d.setDate(d.getDate() - (6 - i));
        const ds = d.toISOString().slice(0, 10);
        return {
          tick: d.toLocaleDateString('en-ZA', { weekday: 'short' }).slice(0, 2),
          value: raw.filter(e => e.created_at?.slice(0, 10) === ds).length,
        };
      });

      const totalRevenue   = (campRes.data || []).reduce((a, c) => a + (c.revenue_attributed || 0), 0);
      const totalSpent     = (campRes.data || []).reduce((a, c) => a + (c.budget_spent || 0), 0);
      const totalImpressions = (campRes.data || []).reduce((a, c) => a + (c.impressions || 0), 0) || impressions;
      const totalClicks    = (campRes.data || []).reduce((a, c) => a + (c.clicks || 0), 0) || clicks;
      const totalConversions = (campRes.data || []).reduce((a, c) => a + (c.conversions || 0), 0) || conversions;

      setAnalytics({ impressions: totalImpressions, clicks: totalClicks, conversions: totalConversions, rsvps, totalRevenue, totalSpent, chart });
    } catch (e) {
      console.error('[BusinessDashboard] loadAll error', e);
    }
    setLoading(false);
  };

  const onRefresh = async () => { setRefreshing(true); await loadAll(); setRefreshing(false); };

  const handleSetupSubmit = async () => {
    if (!setupForm.business_name.trim()) { Alert.alert('Required', 'Please enter a business name.'); return; }
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    const { data, error } = await supabase.from('business_profiles').upsert({
      user_id: user.id,
      ...setupForm,
      tier: 'starter',
    }, { onConflict: 'user_id' }).select().single();
    if (!error && data) { setBiz(data); setSetupMode(false); loadAll(); }
    else Alert.alert('Error', error?.message || 'Could not create business profile.');
  };

  const handleTabPress = (key) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setActiveTab(key);
  };

  // ── Setup Screen ────────────────────────────────────────────────────────────
  if (setupMode) {
    return (
      <View style={[sc.root, { backgroundColor: bg }]}>
        <View style={[sc.header, { borderBottomColor: `${primary}15` }]}>
          <TouchableOpacity onPress={onClose} style={sc.backBtn}>
            <Feather name="x" size={20} color={textColor} />
          </TouchableOpacity>
          <Text style={[sc.headerTitle, { color: textColor }]}>Create Business Profile</Text>
          <View style={{ width: 36 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
          <GlassView style={[sc.setupCard, { borderColor: `${primary}25` }]}>
            <View style={[sc.setupIconWrap, { backgroundColor: `${primary}18` }]}>
              <Feather name="briefcase" size={32} color={primary} />
            </View>
            <Text style={[sc.setupTitle, { color: textColor }]}>Your Business Hub</Text>
            <Text style={[sc.setupSub, { color: muted }]}>Create your storefront, run campaigns, and reach your perfect audience.</Text>
          </GlassView>

          {[
            { key: 'business_name', label: 'Business Name *', placeholder: 'e.g. Warehouse IX Events' },
            { key: 'tagline', label: 'Tagline', placeholder: 'e.g. Where Joburg comes alive' },
            { key: 'description', label: 'Description', placeholder: 'Tell people what you do...', multiline: true },
            { key: 'website', label: 'Website', placeholder: 'https://...' },
            { key: 'phone', label: 'Phone / WhatsApp', placeholder: '+27 ...' },
          ].map(f => (
            <View key={f.key} style={sc.fieldWrap}>
              <Text style={[sc.fieldLabel, { color: muted }]}>{f.label.toUpperCase()}</Text>
              <TextInput
                style={[sc.input, { color: textColor, borderColor: `${primary}25`, minHeight: f.multiline ? 80 : 46 }]}
                placeholder={f.placeholder}
                placeholderTextColor={muted}
                value={setupForm[f.key]}
                onChangeText={v => setSetupForm(p => ({ ...p, [f.key]: v }))}
                multiline={f.multiline}
              />
            </View>
          ))}

          <View style={sc.fieldWrap}>
            <Text style={[sc.fieldLabel, { color: muted }]}>BUSINESS TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 6 }}>
              {BUSINESS_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setSetupForm(p => ({ ...p, business_type: t }))}
                  style={[sc.typePill, { borderColor: setupForm.business_type === t ? primary : `${primary}25`, backgroundColor: setupForm.business_type === t ? `${primary}20` : 'transparent' }]}
                >
                  <Text style={[sc.typePillText, { color: setupForm.business_type === t ? primary : muted }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <TouchableOpacity onPress={handleSetupSubmit} style={[sc.submitBtn, { backgroundColor: primary }]} activeOpacity={0.85}>
            <Feather name="zap" size={16} color="#000" />
            <Text style={sc.submitBtnText}>LAUNCH MY BUSINESS PROFILE</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[sc.root, { backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={primary} />
        <Text style={[sc.loadingText, { color: muted }]}>Loading your dashboard...</Text>
      </View>
    );
  }

  const tier = TIERS[biz?.tier] || TIERS.starter;
  const activeCampaigns = campaigns.filter(c => c.status === 'active');

  // ── Render Tab Content ──────────────────────────────────────────────────────
  const renderContent = () => {
    switch (activeTab) {

      // ── OVERVIEW ────────────────────────────────────────────────────────────
      case 'overview': return (
        <ScrollView contentContainerStyle={sc.tabContent} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}>

          {/* Business identity card */}
          <GlassView style={[sc.bizCard, { borderColor: `${primary}25` }]}>
            <View style={[sc.bizIconWrap, { backgroundColor: `${primary}20` }]}>
              <Feather name="briefcase" size={28} color={primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[sc.bizName, { color: textColor }]}>{biz?.business_name}</Text>
              <Text style={[sc.bizType, { color: muted }]}>{biz?.business_type} · {biz?.tagline || 'No tagline yet'}</Text>
            </View>
            <View style={[sc.tierBadge, { backgroundColor: `${tier.color}20`, borderColor: `${tier.color}40` }]}>
              <Feather name="star" size={10} color={tier.color} />
              <Text style={[sc.tierText, { color: tier.color }]}>{tier.label}</Text>
            </View>
          </GlassView>

          {/* Opportunity notifications */}
          {notifications.length > 0 && (
            <View style={sc.section}>
              <Text style={[sc.sectionTitle, { color: textColor }]}>💰 Money Opportunities</Text>
              {notifications.map(n => (
                <GlassView key={n.id} style={[sc.notifRow, { borderColor: `${primary}20` }]}>
                  <View style={[sc.notifDot, { backgroundColor: primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[sc.notifTitle, { color: textColor }]}>{n.title}</Text>
                    <Text style={[sc.notifBody, { color: muted }]}>{n.body}</Text>
                  </View>
                  <Feather name="arrow-right" size={14} color={primary} />
                </GlassView>
              ))}
            </View>
          )}

          {/* Key stats */}
          <Text style={[sc.sectionTitle, { color: textColor }]}>Key Metrics · Last 30 Days</Text>
          <View style={sc.statsGrid}>
            <StatCard label="Revenue" value={`R${(analytics?.totalRevenue || 0).toFixed(0)}`} icon="dollar-sign" color="#10b981" trend={12} primary={primary} textColor={textColor} muted={muted} />
            <StatCard label="Impressions" value={(analytics?.impressions || 0).toLocaleString()} icon="eye" color={primary} trend={8} primary={primary} textColor={textColor} muted={muted} />
            <StatCard label="Clicks" value={(analytics?.clicks || 0).toLocaleString()} icon="mouse-pointer" color="#8b5cf6" trend={-3} primary={primary} textColor={textColor} muted={muted} />
            <StatCard label="Conversions" value={(analytics?.conversions || 0).toLocaleString()} icon="check-circle" color="#f59e0b" trend={22} primary={primary} textColor={textColor} muted={muted} />
            <StatCard label="Ad Spend" value={`R${(analytics?.totalSpent || 0).toFixed(0)}`} icon="credit-card" color="#ef4444" primary={primary} textColor={textColor} muted={muted} />
            <StatCard label="Active Campaigns" value={activeCampaigns.length} icon="target" color="#06b6d4" primary={primary} textColor={textColor} muted={muted} />
          </View>

          {/* 7-day activity chart */}
          {analytics?.chart && (
            <GlassView style={[sc.chartCard, { borderColor: `${primary}15` }]}>
              <MiniBarChart data={analytics.chart} color={primary} label="7-Day Activity" textColor={textColor} muted={muted} />
            </GlassView>
          )}

          {/* Quick actions */}
          <Text style={[sc.sectionTitle, { color: textColor }]}>Quick Actions</Text>
          <View style={sc.quickActions}>
            {[
              { label: 'New Campaign',   icon: 'target',    onPress: () => { setEditingCampaign(null); setShowCampaignBuilder(true); } },
              { label: 'Edit Store',     icon: 'layout',    onPress: () => handleTabPress('store') },
              { label: 'View Analytics', icon: 'bar-chart-2', onPress: () => handleTabPress('analytics') },
              { label: 'Add Partner',    icon: 'link-2',    onPress: () => handleTabPress('ecosystem') },
            ].map(a => (
              <TouchableOpacity key={a.label} onPress={a.onPress} style={[sc.quickAction, { borderColor: `${primary}25`, backgroundColor: `${primary}08` }]} activeOpacity={0.8}>
                <Feather name={a.icon} size={18} color={primary} />
                <Text style={[sc.quickActionText, { color: textColor }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tier perks */}
          <GlassView style={[sc.tierCard, { borderColor: `${tier.color}30` }]}>
            <View style={sc.tierHeader}>
              <Text style={[sc.tierCardTitle, { color: tier.color }]}>{tier.label} Plan</Text>
              <TouchableOpacity style={[sc.upgradeBtn, { borderColor: tier.color }]}>
                <Text style={[sc.upgradeBtnText, { color: tier.color }]}>UPGRADE</Text>
              </TouchableOpacity>
            </View>
            {tier.perks.map(p => (
              <View key={p} style={sc.perkRow}>
                <Feather name="check" size={12} color={tier.color} />
                <Text style={[sc.perkText, { color: muted }]}>{p}</Text>
              </View>
            ))}
          </GlassView>
        </ScrollView>
      );

      // ── STORE ───────────────────────────────────────────────────────────────
      case 'store': return (
        <BusinessStoreBuilder biz={biz} primary={primary} textColor={textColor} muted={muted} bg={bg} surface={surface} />
      );

      // ── CAMPAIGNS ───────────────────────────────────────────────────────────
      case 'campaigns': return (
        <ScrollView contentContainerStyle={sc.tabContent} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}>
          <View style={sc.sectionHeaderRow}>
            <Text style={[sc.sectionTitle, { color: textColor }]}>Campaigns</Text>
            <TouchableOpacity onPress={() => { setEditingCampaign(null); setShowCampaignBuilder(true); }}
              style={[sc.newBtn, { backgroundColor: primary }]}>
              <Feather name="plus" size={14} color="#000" />
              <Text style={sc.newBtnText}>NEW</Text>
            </TouchableOpacity>
          </View>

          {campaigns.length === 0 ? (
            <GlassView style={[sc.emptyState, { borderColor: `${primary}15` }]}>
              <Feather name="target" size={36} color={muted} />
              <Text style={[sc.emptyTitle, { color: textColor }]}>No campaigns yet</Text>
              <Text style={[sc.emptyBody, { color: muted }]}>Create your first campaign to start reaching your audience.</Text>
              <TouchableOpacity onPress={() => setShowCampaignBuilder(true)} style={[sc.emptyBtn, { backgroundColor: primary }]}>
                <Text style={{ color: '#000', fontWeight: '900', fontSize: 12 }}>CREATE CAMPAIGN</Text>
              </TouchableOpacity>
            </GlassView>
          ) : campaigns.map(c => (
            <CampaignRow key={c.id} campaign={c} primary={primary} textColor={textColor} muted={muted}
              onEdit={() => { setEditingCampaign(c); setShowCampaignBuilder(true); }}
              onToggle={() => {}} />
          ))}

          {/* Event phase explainer */}
          <GlassView style={[sc.infoCard, { borderColor: `${primary}15` }]}>
            <Feather name="info" size={14} color={primary} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[sc.infoTitle, { color: textColor }]}>Event Phase Targeting</Text>
              <Text style={[sc.infoBody, { color: muted }]}>Target users PRE-EVENT (transport, outfits, hype), DURING EVENT (food, drinks, merch), and POST-EVENT (photos, reviews, next events). Set this when building your campaign.</Text>
            </View>
          </GlassView>
        </ScrollView>
      );

      // ── AUDIENCE ────────────────────────────────────────────────────────────
      case 'audience': return (
        <ScrollView contentContainerStyle={sc.tabContent} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}>
          <View style={sc.sectionHeaderRow}>
            <Text style={[sc.sectionTitle, { color: textColor }]}>Saved Segments</Text>
            <TouchableOpacity onPress={() => { setEditingCampaign(null); setShowCampaignBuilder(true); }}
              style={[sc.newBtn, { backgroundColor: primary }]}>
              <Feather name="plus" size={14} color="#000" />
              <Text style={sc.newBtnText}>NEW</Text>
            </TouchableOpacity>
          </View>

          {/* Targeting category overview */}
          <GlassView style={[sc.targetingOverview, { borderColor: `${primary}20` }]}>
            <Text style={[sc.toTitle, { color: textColor }]}>Advanced Targeting Engine</Text>
            <Text style={[sc.toSub, { color: muted }]}>Reach any combination of 3 000+ audience signals</Text>
            <View style={sc.targetingCats}>
              {[
                { icon: 'user', label: 'Demographics', count: 24, examples: 'Surname, age, gender, language' },
                { icon: 'heart', label: 'Lifestyle',   count: 18, examples: 'Religion, sport, car, colour' },
                { icon: 'activity', label: 'Behaviour', count: 31, examples: 'RSVP history, spend level, categories' },
                { icon: 'map-pin', label: 'Geographic', count: 12, examples: 'City, neighbourhood, radius' },
                { icon: 'briefcase', label: 'Professional', count: 15, examples: 'Industry, job type, income band' },
                { icon: 'clock', label: 'Time-based', count: 9,  examples: 'Time of day, day of week, season' },
                { icon: 'music', label: 'Interests',  count: 42, examples: 'Music genres, food, art, tech' },
                { icon: 'trending-up', label: 'Purchase Intent', count: 28, examples: 'Searched transport, viewed outfits' },
              ].map(cat => (
                <View key={cat.label} style={[sc.targetCat, { borderColor: `${primary}15` }]}>
                  <Feather name={cat.icon} size={14} color={primary} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[sc.catLabel, { color: textColor }]}>{cat.label} <Text style={{ color: primary }}>({cat.count})</Text></Text>
                    <Text style={[sc.catExamples, { color: muted }]}>{cat.examples}</Text>
                  </View>
                </View>
              ))}
            </View>
          </GlassView>

          {segments.length === 0 ? (
            <GlassView style={[sc.emptyState, { borderColor: `${primary}15` }]}>
              <Feather name="users" size={36} color={muted} />
              <Text style={[sc.emptyTitle, { color: textColor }]}>No saved segments</Text>
              <Text style={[sc.emptyBody, { color: muted }]}>Build your first audience segment inside the campaign builder.</Text>
            </GlassView>
          ) : segments.map(seg => (
            <GlassView key={seg.id} style={[sc.segmentRow, { borderColor: `${primary}15` }]}>
              <View style={[sc.segIcon, { backgroundColor: `${primary}18` }]}>
                <Feather name="users" size={16} color={primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[sc.segName, { color: textColor }]}>{seg.name}</Text>
                <Text style={[sc.segReach, { color: muted }]}>Est. reach: {(seg.estimated_reach || 0).toLocaleString()} vibers</Text>
              </View>
              <Feather name="chevron-right" size={16} color={muted} />
            </GlassView>
          ))}
        </ScrollView>
      );

      // ── ANALYTICS ───────────────────────────────────────────────────────────
      case 'analytics': return (
        <ScrollView contentContainerStyle={sc.tabContent} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}>
          <Text style={[sc.sectionTitle, { color: textColor }]}>Conversion Funnel</Text>
          <GlassView style={[sc.funnelCard, { borderColor: `${primary}15` }]}>
            {[
              { label: 'Impressions',  value: analytics?.impressions  || 0, color: primary },
              { label: 'Clicks',       value: analytics?.clicks       || 0, color: '#8b5cf6' },
              { label: 'RSVPs',        value: analytics?.rsvps        || 0, color: '#f59e0b' },
              { label: 'Conversions',  value: analytics?.conversions  || 0, color: '#10b981' },
            ].map(f => <FunnelBar key={f.label} {...f} max={analytics?.impressions || 1} textColor={textColor} muted={muted} />)}
          </GlassView>

          <Text style={[sc.sectionTitle, { color: textColor }]}>7-Day Activity</Text>
          <GlassView style={[sc.chartCard, { borderColor: `${primary}15` }]}>
            {analytics?.chart && <MiniBarChart data={analytics.chart} color={primary} label="Events (impressions + clicks)" textColor={textColor} muted={muted} />}
          </GlassView>

          <Text style={[sc.sectionTitle, { color: textColor }]}>Campaign Performance</Text>
          {campaigns.length === 0 ? (
            <GlassView style={[sc.emptyState, { borderColor: `${primary}15` }]}>
              <Text style={[sc.emptyBody, { color: muted }]}>Run campaigns to see performance data.</Text>
            </GlassView>
          ) : campaigns.slice(0, 5).map(c => (
            <GlassView key={c.id} style={[sc.analyticsRow, { borderColor: `${primary}15` }]}>
              <Text style={[sc.analyticsName, { color: textColor }]} numberOfLines={1}>{c.name}</Text>
              <View style={sc.analyticsMetrics}>
                {[
                  { l: 'Reach', v: (c.impressions || 0).toLocaleString() },
                  { l: 'CTR',   v: c.impressions > 0 ? `${((c.clicks / c.impressions) * 100).toFixed(1)}%` : '—' },
                  { l: 'ROI',   v: c.budget_spent > 0 ? `${((c.revenue_attributed / c.budget_spent - 1) * 100).toFixed(0)}%` : '—' },
                ].map(m => (
                  <View key={m.l} style={sc.analyticsMetric}>
                    <Text style={[sc.analyticsMetricVal, { color: primary }]}>{m.v}</Text>
                    <Text style={[sc.analyticsMetricLbl, { color: muted }]}>{m.l}</Text>
                  </View>
                ))}
              </View>
            </GlassView>
          ))}

          <Text style={[sc.sectionTitle, { color: textColor }]}>Content Performance</Text>
          <GlassView style={[sc.infoCard, { borderColor: `${primary}15` }]}>
            <Feather name="bar-chart-2" size={14} color={primary} />
            <Text style={[sc.infoBody, { color: muted, marginLeft: 10 }]}>Post events and campaigns to start tracking content reach, engagement rate, save rate, and share velocity.</Text>
          </GlassView>

          <Text style={[sc.sectionTitle, { color: textColor }]}>Registration & Attendance</Text>
          <GlassView style={[sc.infoCard, { borderColor: `${primary}15` }]}>
            <Feather name="users" size={14} color={primary} />
            <Text style={[sc.infoBody, { color: muted, marginLeft: 10 }]}>RSVP-to-attendance conversion, check-in rates, no-show %, and repeat attendee tracking sync automatically when users check in to your events.</Text>
          </GlassView>
        </ScrollView>
      );

      // ── FINANCE ─────────────────────────────────────────────────────────────
      case 'finance': return (
        <ScrollView contentContainerStyle={sc.tabContent} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}>
          <View style={sc.statsGrid}>
            <StatCard label="Total Revenue" value={`R${(analytics?.totalRevenue || 0).toFixed(2)}`} icon="trending-up" color="#10b981" primary={primary} textColor={textColor} muted={muted} />
            <StatCard label="Ad Spend" value={`R${(analytics?.totalSpent || 0).toFixed(2)}`} icon="credit-card" color="#ef4444" primary={primary} textColor={textColor} muted={muted} />
            <StatCard label="Net ROI" value={analytics?.totalSpent > 0 ? `${(((analytics.totalRevenue - analytics.totalSpent) / analytics.totalSpent) * 100).toFixed(0)}%` : '—'} icon="dollar-sign" color="#f59e0b" primary={primary} textColor={textColor} muted={muted} />
            <StatCard label="Partner Revenue" value={`R${partners.reduce((a, p) => a + (p.revenue_earned || 0), 0).toFixed(0)}`} icon="link-2" color="#8b5cf6" primary={primary} textColor={textColor} muted={muted} />
          </View>

          <Text style={[sc.sectionTitle, { color: textColor }]}>Budget Allocation</Text>
          {campaigns.length === 0 ? (
            <GlassView style={[sc.emptyState, { borderColor: `${primary}15` }]}>
              <Text style={[sc.emptyBody, { color: muted }]}>No campaign budgets set yet.</Text>
            </GlassView>
          ) : campaigns.map(c => {
            const pct = c.budget_total > 0 ? Math.min(100, (c.budget_spent / c.budget_total) * 100) : 0;
            return (
              <GlassView key={c.id} style={[sc.budgetRow, { borderColor: `${primary}15` }]}>
                <View style={sc.budgetTop}>
                  <Text style={[sc.budgetName, { color: textColor }]} numberOfLines={1}>{c.name}</Text>
                  <Text style={[sc.budgetFig, { color: muted }]}>R{(c.budget_spent || 0).toFixed(0)} / R{(c.budget_total || 0).toFixed(0)}</Text>
                </View>
                <View style={sc.budgetTrack}>
                  <View style={[sc.budgetFill, { width: `${pct}%`, backgroundColor: pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#10b981' }]} />
                </View>
              </GlassView>
            );
          })}

          <GlassView style={[sc.infoCard, { borderColor: `${primary}15`, marginTop: 12 }]}>
            <Feather name="info" size={14} color={primary} />
            <Text style={[sc.infoBody, { color: muted, marginLeft: 10 }]}>Payouts, invoices, and financial reports are available on Royal and Enterprise plans. Upgrade to unlock full finance management.</Text>
          </GlassView>
        </ScrollView>
      );

      // ── ECOSYSTEM ───────────────────────────────────────────────────────────
      case 'ecosystem': return (
        <ScrollView contentContainerStyle={sc.tabContent} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}>
          <Text style={[sc.sectionTitle, { color: textColor }]}>Partnerships & Ecosystem</Text>

          {partners.length === 0 ? (
            <GlassView style={[sc.emptyState, { borderColor: `${primary}15` }]}>
              <Feather name="globe" size={36} color={muted} />
              <Text style={[sc.emptyTitle, { color: textColor }]}>No partners yet</Text>
              <Text style={[sc.emptyBody, { color: muted }]}>Connect with sponsors, co-hosts, and API partners to grow your revenue.</Text>
            </GlassView>
          ) : partners.map(p => <PartnerRow key={p.id} partner={p} primary={primary} textColor={textColor} muted={muted} />)}

          {/* Ecosystem categories */}
          {[
            { icon: 'star', label: 'Sponsorship Marketplace', body: 'Get discovered by brands looking to sponsor events like yours. Set your sponsorship tiers, audience data, and pricing.', color: '#f59e0b' },
            { icon: 'code', label: 'API Integrations', body: 'Connect Ticketmaster, Eventbrite, WhatsApp Business, Stripe, Yoco, Ozow, and 50+ more to automate your business.', color: '#8b5cf6' },
            { icon: 'users', label: 'Co-Host Network', body: 'Partner with other organisers to cross-promote, share costs, and expand reach. Revenue split managed automatically.', color: '#10b981' },
            { icon: 'share-2', label: 'Affiliate Programme', body: 'Invite promoters to sell tickets and promote your events. Track commissions, set payouts, and manage your affiliate army.', color: primary },
            { icon: 'truck', label: 'Commuting Hub Partner', body: 'Connect with transport providers — Uber, bolt, private charters, and shuttle companies — to offer attendees seamless transport.', color: '#06b6d4' },
            { icon: 'camera', label: 'Creative Network', body: 'Book photographers, videographers, DJs, and designers directly from the platform. All billing tracked inside your dashboard.', color: '#ec4899' },
          ].map(e => (
            <GlassView key={e.label} style={[sc.ecoCard, { borderColor: `${e.color}20` }]}>
              <View style={[sc.ecoIcon, { backgroundColor: `${e.color}15` }]}>
                <Feather name={e.icon} size={18} color={e.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[sc.ecoTitle, { color: textColor }]}>{e.label}</Text>
                <Text style={[sc.ecoBody, { color: muted }]}>{e.body}</Text>
              </View>
              <TouchableOpacity style={[sc.ecoBtn, { borderColor: `${e.color}40` }]}>
                <Text style={[sc.ecoBtnText, { color: e.color }]}>JOIN</Text>
              </TouchableOpacity>
            </GlassView>
          ))}
        </ScrollView>
      );

      default: return null;
    }
  };

  // ── Main Render ─────────────────────────────────────────────────────────────
  return (
    <View style={[sc.root, { backgroundColor: bg }]}>
      {/* Header */}
      <Animated.View style={[sc.header, { borderBottomColor: `${primary}15`, opacity: headerAnim }]}>
        <TouchableOpacity onPress={onClose} style={sc.backBtn}>
          <Feather name="arrow-left" size={20} color={textColor} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[sc.headerTitle, { color: textColor }]} numberOfLines={1}>{biz?.business_name || 'Business'}</Text>
          <Text style={[sc.headerSub, { color: tier.color }]}>{tier.label} Plan</Text>
        </View>
        {notifications.length > 0 && (
          <View style={[sc.notifBadge, { backgroundColor: '#ef4444' }]}>
            <Text style={sc.notifBadgeText}>{notifications.length}</Text>
          </View>
        )}
        <TouchableOpacity style={[sc.settingsBtn, { borderColor: `${primary}25` }]}>
          <Feather name="settings" size={16} color={primary} />
        </TouchableOpacity>
      </Animated.View>

      {/* Tab bar */}
      <ScrollView ref={tabScrollRef} horizontal showsHorizontalScrollIndicator={false}
        style={[sc.tabBar, { borderBottomColor: `${primary}10` }]}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 4 }}>
        {TABS.map(t => {
          const active = activeTab === t.key;
          return (
            <TouchableOpacity key={t.key} onPress={() => handleTabPress(t.key)}
              style={[sc.tabBtn, active && { backgroundColor: `${primary}18`, borderColor: `${primary}40` }, !active && { borderColor: 'transparent' }]}>
              <Feather name={t.icon} size={13} color={active ? primary : muted} />
              <Text style={[sc.tabBtnText, { color: active ? primary : muted }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Content */}
      {renderContent()}

      {/* Campaign Builder Modal */}
      <CampaignBuilderModal
        visible={showCampaignBuilder}
        onClose={() => setShowCampaignBuilder(false)}
        businessId={biz?.id}
        existing={editingCampaign}
        onSaved={() => { setShowCampaignBuilder(false); loadAll(); }}
        primary={primary}
        textColor={textColor}
        muted={muted}
        bg={bg}
      />
    </View>
  );
};

const sc = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 0.2 },
  headerSub: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  settingsBtn: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  notifBadge: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  notifBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  tabBar: { flexGrow: 0, borderBottomWidth: 1, paddingVertical: 8 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  tabBtnText: { fontSize: 11, fontWeight: '800' },
  tabContent: { padding: 16, paddingBottom: 100 },
  loadingText: { marginTop: 12, fontSize: 13 },
  // Biz card
  bizCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 20 },
  bizIconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bizName: { fontSize: 16, fontWeight: '900' },
  bizType: { fontSize: 11, marginTop: 2 },
  tierBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  tierText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  // Stats grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: { width: (SW - 52) / 2, padding: 14, borderRadius: 14, borderWidth: 1 },
  statIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginTop: 2 },
  statSub: { fontSize: 9, marginTop: 3 },
  trendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  // Chart
  chartCard: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 20 },
  chartWrap: {},
  chartLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  barsRow: { flexDirection: 'row', height: 80, alignItems: 'flex-end', gap: 4 },
  barCol: { flex: 1, alignItems: 'center' },
  barTrack: { flex: 1, width: '80%', justifyContent: 'flex-end', overflow: 'hidden', borderRadius: 4 },
  barFill: { borderRadius: 4, minHeight: 4 },
  barTick: { fontSize: 8, marginTop: 4 },
  // Quick actions
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  quickAction: { width: (SW - 52) / 2, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
  quickActionText: { fontSize: 12, fontWeight: '800' },
  // Tier card
  tierCard: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 20 },
  tierHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  tierCardTitle: { fontSize: 14, fontWeight: '900' },
  upgradeBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  upgradeBtnText: { fontSize: 10, fontWeight: '900' },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 3 },
  perkText: { fontSize: 12 },
  // Notifications
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 0.5, marginBottom: 12 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  notifDot: { width: 8, height: 8, borderRadius: 4 },
  notifTitle: { fontSize: 13, fontWeight: '800' },
  notifBody: { fontSize: 11, marginTop: 2 },
  // Campaign
  campaignRow: { padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  campaignTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  campName: { fontSize: 14, fontWeight: '900' },
  campMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  campStatus: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  campType: { fontSize: 10 },
  campEdit: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  campStats: { flexDirection: 'row', justifyContent: 'space-between' },
  campStat: { alignItems: 'center' },
  campStatVal: { fontSize: 13, fontWeight: '900' },
  campStatLbl: { fontSize: 9, marginTop: 2 },
  phasesRow: { flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  phaseTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  phaseText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  // Audience
  targetingOverview: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 16 },
  toTitle: { fontSize: 14, fontWeight: '900', marginBottom: 4 },
  toSub: { fontSize: 11, marginBottom: 14 },
  targetingCats: { gap: 8 },
  targetCat: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  catLabel: { fontSize: 13, fontWeight: '700' },
  catExamples: { fontSize: 10, marginTop: 2 },
  segmentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  segIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segName: { fontSize: 13, fontWeight: '800' },
  segReach: { fontSize: 10, marginTop: 2 },
  // Funnel
  funnelCard: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 20, gap: 12 },
  funnelRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  funnelLabel: { width: 90, fontSize: 11, fontWeight: '700' },
  funnelTrack: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' },
  funnelFill: { height: '100%', borderRadius: 4 },
  funnelVal: { width: 50, fontSize: 11, fontWeight: '800', textAlign: 'right' },
  // Analytics
  analyticsRow: { padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  analyticsName: { fontSize: 13, fontWeight: '800', marginBottom: 8 },
  analyticsMetrics: { flexDirection: 'row', gap: 20 },
  analyticsMetric: { alignItems: 'center' },
  analyticsMetricVal: { fontSize: 14, fontWeight: '900' },
  analyticsMetricLbl: { fontSize: 9, marginTop: 2 },
  // Finance
  budgetRow: { padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  budgetTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  budgetName: { fontSize: 13, fontWeight: '800', flex: 1 },
  budgetFig: { fontSize: 11 },
  budgetTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' },
  budgetFill: { height: '100%', borderRadius: 3 },
  // Ecosystem
  ecoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  ecoIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ecoTitle: { fontSize: 13, fontWeight: '900', marginBottom: 4 },
  ecoBody: { fontSize: 11, lineHeight: 16 },
  ecoBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, alignSelf: 'flex-start' },
  ecoBtnText: { fontSize: 9, fontWeight: '900' },
  // Partner
  partnerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  partnerIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  partnerName: { fontSize: 13, fontWeight: '800' },
  partnerType: { fontSize: 10, marginTop: 2 },
  partnerStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  partnerStatusText: { fontSize: 8, fontWeight: '900' },
  // Empty state
  emptyState: { alignItems: 'center', padding: 32, borderRadius: 16, borderWidth: 1, marginBottom: 16, gap: 10 },
  emptyTitle: { fontSize: 15, fontWeight: '900' },
  emptyBody: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  emptyBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 6 },
  // Info card
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 12 },
  infoTitle: { fontSize: 12, fontWeight: '800', marginBottom: 4 },
  infoBody: { fontSize: 11, lineHeight: 16, flex: 1 },
  // Setup
  setupCard: { alignItems: 'center', padding: 24, borderRadius: 20, borderWidth: 1, marginBottom: 24 },
  setupIconWrap: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  setupTitle: { fontSize: 20, fontWeight: '900', marginBottom: 6 },
  setupSub: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  fieldWrap: { marginBottom: 16 },
  fieldLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, textAlignVertical: 'top' },
  typePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  typePillText: { fontSize: 12, fontWeight: '700' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 16, marginTop: 8 },
  submitBtnText: { color: '#000', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  newBtnText: { color: '#000', fontSize: 11, fontWeight: '900' },
});
